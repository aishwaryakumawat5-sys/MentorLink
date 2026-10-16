"""
MentorLink — Flask Application Backend
Full-stack mentoring platform connecting mentors and mentees.
"""

import os
import re
import secrets
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    session,
    redirect,
    url_for,
    abort
)
from werkzeug.security import check_password_hash, generate_password_hash

import database
from database import (
    get_db,
    init_db,
    create_notification,
    get_user_by_id,
    get_user_by_email,
    get_assigned_mentor,
    get_assigned_mentees,
    count_mentees_for_mentor,
    are_mentor_mentee,
    MAX_MENTEES_PER_MENTOR
)

# Initialize Flask application
app = Flask(__name__)

# Security & Session Configuration
app.config["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY", "mentorlink-secure-session-key-dev-2026-antigravity"
)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = bool(os.environ.get("VERCEL"))
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

# Email regex pattern
EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")


# ==========================================
# Application Lifecycle & CSRF Security
# ==========================================

@app.before_request
def setup_security_and_csrf():
    """
    1. Ensure a unique CSRF token is present in the session.
    2. Enforce CSRF token verification on state-changing API requests.
    """
    session.permanent = True
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)

    # Protect state-changing HTTP methods
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        # Allow static endpoints if any, but all /api/ and form posts must provide CSRF token
        if request.path.startswith("/api/") or request.path in ("/login", "/register"):
            client_token = (
                request.headers.get("X-CSRF-Token")
                or request.form.get("csrf_token")
                or (request.is_json and request.get_json(silent=True) and request.get_json().get("csrf_token"))
            )
            session_token = session.get("csrf_token")

            if not client_token or not session_token or not secrets.compare_digest(client_token, session_token):
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": "Invalid or missing CSRF token. Please refresh the page and try again."}), 403
                # For standard HTML forms
                abort(403, description="CSRF validation failed.")


@app.context_processor
def inject_globals():
    """Inject CSRF token and current user info into all Jinja templates."""
    current_user = None
    if "user_id" in session:
        with get_db() as conn:
            current_user = get_user_by_id(conn, session["user_id"])
    return {
        "csrf_token": session.get("csrf_token", ""),
        "current_user": current_user
    }


# ==========================================
# Authentication & Role Decorators
# ==========================================

def login_required(f):
    """Ensure the user is authenticated."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required. Please log in."}), 401
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated_function


def role_required(*allowed_roles):
    """Ensure the authenticated user has one of the specified roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_id" not in session:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Authentication required."}), 401
                return redirect(url_for("login_page"))

            user_role = session.get("role")
            if user_role not in allowed_roles:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Access denied. Insufficient permissions."}), 403
                abort(403, description="Access denied.")
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ==========================================
# HTML Page Routes
# ==========================================

@app.route("/")
def index():
    """Landing page introducing MentorLink, or direct redirect to dashboard if logged in."""
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return render_template("index.html")


@app.route("/login")
def login_page():
    """Login page. Redirect to dashboard if already authenticated."""
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return render_template("login.html")


@app.route("/register")
def register_page():
    """Registration page for Mentors and Mentees."""
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return render_template("register.html")


@app.route("/dashboard")
@login_required
def dashboard_page():
    """Main application dashboard serving Admin, Mentor, and Mentee views."""
    return render_template("dashboard.html")


# ==========================================
# Authentication & Profile API
# ==========================================

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    """Register a new Mentor or Mentee account."""
    data = request.get_json(silent=True) or request.form
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "").strip().lower()
    department = (data.get("department") or "").strip()
    skills = (data.get("skills") or "").strip()
    interests = (data.get("interests") or "").strip()
    bio = (data.get("bio") or "").strip()

    # Server-side validation
    if not name or len(name) < 2 or len(name) > 100:
        return jsonify({"error": "Full name is required (between 2 and 100 characters)."}), 400

    if not email or not EMAIL_REGEX.match(email) or len(email) > 120:
        return jsonify({"error": "A valid email address is required (max 120 characters)."}), 400

    if not password or len(password) < 6 or len(password) > 128:
        return jsonify({"error": "Password must be at least 6 characters long (max 128)."}), 400

    if role not in ("mentor", "mentee"):
        return jsonify({"error": "Invalid role. Public registration allows 'mentor' or 'mentee' only."}), 400

    if len(department) > 100:
        return jsonify({"error": "Department must not exceed 100 characters."}), 400
    if len(skills) > 255:
        return jsonify({"error": "Skills must not exceed 255 characters."}), 400
    if len(interests) > 255:
        return jsonify({"error": "Interests must not exceed 255 characters."}), 400
    if len(bio) > 500:
        return jsonify({"error": "Bio must not exceed 500 characters."}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            return jsonify({"error": "An account with this email address already exists."}), 409

        hashed_password = generate_password_hash(password)
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, department, skills, interests, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, email, hashed_password, role, department, skills, interests, bio))
        new_user_id = cursor.lastrowid

        # Welcome notification
        create_notification(
            conn,
            new_user_id,
            "Welcome to MentorLink!",
            f"Hello {name}, your {role.capitalize()} profile has been created successfully.",
            "info"
        )

        # Log user in directly
        session.clear()
        session["user_id"] = new_user_id
        session["role"] = role
        session["csrf_token"] = secrets.token_hex(32)

        user_info = get_user_by_id(conn, new_user_id)

    return jsonify({
        "message": "Registration successful! Welcome to MentorLink.",
        "user": user_info,
        "csrf_token": session["csrf_token"]
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    """Authenticate an existing user via email and password."""
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    with get_db() as conn:
        user = get_user_by_email(conn, email)

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password. Please try again."}), 401

    # Regenerate session securely
    session.clear()
    session["user_id"] = user["id"]
    session["role"] = user["role"]
    session["csrf_token"] = secrets.token_hex(32)

    safe_user = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "department": user["department"],
        "skills": user["skills"],
        "interests": user["interests"],
        "bio": user["bio"],
        "created_at": user["created_at"]
    }

    return jsonify({
        "message": "Login successful.",
        "user": safe_user,
        "csrf_token": session["csrf_token"]
    }), 200


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    """Log out current user and clear session."""
    session.clear()
    return jsonify({"message": "Successfully logged out."}), 200


@app.route("/api/auth/me", methods=["GET"])
@login_required
def api_current_user():
    """Retrieve profile and mentorship relationship for currently logged-in user."""
    with get_db() as conn:
        user = get_user_by_id(conn, session["user_id"])
        if not user:
            session.clear()
            return jsonify({"error": "User account no longer exists."}), 404

        extra = {}
        if user["role"] == "mentee":
            extra["assigned_mentor"] = get_assigned_mentor(conn, user["id"])
        elif user["role"] == "mentor":
            extra["assigned_mentees"] = get_assigned_mentees(conn, user["id"])
            extra["mentee_count"] = count_mentees_for_mentor(conn, user["id"])
            extra["max_mentees"] = MAX_MENTEES_PER_MENTOR

    return jsonify({
        "user": user,
        "extra": extra,
        "csrf_token": session.get("csrf_token", "")
    }), 200


@app.route("/api/auth/profile", methods=["PUT"])
@login_required
def api_update_profile():
    """Update permitted profile details (name, department, skills, interests, bio)."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    department = (data.get("department") or "").strip()
    skills = (data.get("skills") or "").strip()
    interests = (data.get("interests") or "").strip()
    bio = (data.get("bio") or "").strip()

    if not name or len(name) < 2 or len(name) > 100:
        return jsonify({"error": "Full name is required (between 2 and 100 characters)."}), 400

    if len(department) > 100 or len(skills) > 255 or len(interests) > 255 or len(bio) > 500:
        return jsonify({"error": "One or more fields exceed maximum allowed character limits."}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET name = ?, department = ?, skills = ?, interests = ?, bio = ?
            WHERE id = ?
        """, (name, department, skills, interests, bio, session["user_id"]))

        updated = get_user_by_id(conn, session["user_id"])

    return jsonify({"message": "Profile updated successfully.", "user": updated}), 200


# ==========================================
# Admin Management & Matching API
# ==========================================

@app.route("/api/admin/users", methods=["GET"])
@login_required
@role_required("admin")
def api_admin_users():
    """List all registered users with mentorship summary."""
    role_filter = request.args.get("role")
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT u.id, u.name, u.email, u.role, u.department, u.skills, u.interests, u.bio, u.created_at,
                   (SELECT COUNT(*) FROM mentor_mentee_assignments a WHERE a.mentor_id = u.id AND a.status = 'active') as active_mentees_count,
                   (SELECT m.name FROM mentor_mentee_assignments a2 JOIN users m ON a2.mentor_id = m.id WHERE a2.mentee_id = u.id AND a2.status = 'active') as assigned_mentor_name,
                   (SELECT a3.mentor_id FROM mentor_mentee_assignments a3 WHERE a3.mentee_id = u.id AND a3.status = 'active') as assigned_mentor_id
            FROM users u
        """
        params = []
        if role_filter in ("admin", "mentor", "mentee"):
            query += " WHERE u.role = ?"
            params.append(role_filter)
        query += " ORDER BY u.created_at DESC"

        cursor.execute(query, params)
        users = [dict(row) for row in cursor.fetchall()]

    return jsonify({"users": users}), 200


@app.route("/api/admin/assignments", methods=["GET"])
@login_required
@role_required("admin")
def api_admin_assignments():
    """List all mentor-mentee assignments with full relation details."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id, a.mentor_id, a.mentee_id, a.status, a.assigned_at,
                   m.name as mentor_name, m.email as mentor_email, m.department as mentor_department,
                   s.name as mentee_name, s.email as mentee_email, s.department as mentee_department
            FROM mentor_mentee_assignments a
            JOIN users m ON a.mentor_id = m.id
            JOIN users s ON a.mentee_id = s.id
            ORDER BY a.assigned_at DESC
        """)
        assignments = [dict(row) for row in cursor.fetchall()]
    return jsonify({"assignments": assignments}), 200


@app.route("/api/admin/assignments", methods=["POST"])
@login_required
@role_required("admin")
def api_admin_create_or_update_assignment():
    """
    Assign or update a mentor for a mentee.
    Enforces maximum of 5 mentees per mentor, verified roles, and notifies both parties.
    """
    data = request.get_json(silent=True) or {}
    try:
        mentor_id = int(data.get("mentor_id"))
        mentee_id = int(data.get("mentee_id"))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid numeric mentor_id and mentee_id are required."}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        # Validate Mentor
        mentor = get_user_by_id(conn, mentor_id)
        if not mentor or mentor["role"] != "mentor":
            return jsonify({"error": "Selected mentor does not exist or does not hold the 'mentor' role."}), 400

        # Validate Mentee
        mentee = get_user_by_id(conn, mentee_id)
        if not mentee or mentee["role"] != "mentee":
            return jsonify({"error": "Selected mentee does not exist or does not hold the 'mentee' role."}), 400

        # Check existing assignment for this mentee
        cursor.execute("SELECT id, mentor_id FROM mentor_mentee_assignments WHERE mentee_id = ?", (mentee_id,))
        existing_assignment = cursor.fetchone()

        # Check mentor capacity (limit of 5 mentees)
        current_mentees_count = count_mentees_for_mentor(conn, mentor_id)
        if existing_assignment and existing_assignment["mentor_id"] == mentor_id:
            return jsonify({"message": f"{mentee['name']} is already assigned to {mentor['name']}."}), 200

        if current_mentees_count >= MAX_MENTEES_PER_MENTOR:
            return jsonify({
                "error": f"Mentor {mentor['name']} has reached the maximum capacity of {MAX_MENTEES_PER_MENTOR} mentees."
            }), 400

        # Update or Insert assignment
        if existing_assignment:
            old_mentor_id = existing_assignment["mentor_id"]
            cursor.execute("""
                UPDATE mentor_mentee_assignments
                SET mentor_id = ?, status = 'active', assigned_at = CURRENT_TIMESTAMP
                WHERE mentee_id = ?
            """, (mentor_id, mentee_id))

            # Notify previous mentor of re-assignment
            create_notification(
                conn,
                old_mentor_id,
                "Mentee Reassigned",
                f"Mentee {mentee['name']} has been reassigned to a different mentor.",
                "assignment"
            )
        else:
            cursor.execute("""
                INSERT INTO mentor_mentee_assignments (mentor_id, mentee_id, status)
                VALUES (?, ?, 'active')
            """, (mentor_id, mentee_id))

        # Notify both mentor and mentee
        create_notification(
            conn,
            mentee_id,
            "Mentor Assigned!",
            f"You have been successfully matched with mentor {mentor['name']} ({mentor['department']}).",
            "assignment"
        )
        create_notification(
            conn,
            mentor_id,
            "New Mentee Assigned!",
            f"{mentee['name']} ({mentee['department']}) has been assigned to you as a mentee.",
            "assignment"
        )

    return jsonify({
        "message": f"Successfully assigned {mentee['name']} to mentor {mentor['name']}."
    }), 200


@app.route("/api/admin/assignments/<int:assignment_id>", methods=["DELETE"])
@login_required
@role_required("admin")
def api_admin_delete_assignment(assignment_id):
    """Remove a mentor-mentee assignment and notify both parties."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id, a.mentor_id, a.mentee_id, m.name as mentor_name, s.name as mentee_name
            FROM mentor_mentee_assignments a
            JOIN users m ON a.mentor_id = m.id
            JOIN users s ON a.mentee_id = s.id
            WHERE a.id = ?
        """, (assignment_id,))
        assignment = cursor.fetchone()

        if not assignment:
            return jsonify({"error": "Assignment record not found."}), 404

        mentor_id = assignment["mentor_id"]
        mentee_id = assignment["mentee_id"]
        mentor_name = assignment["mentor_name"]
        mentee_name = assignment["mentee_name"]

        cursor.execute("DELETE FROM mentor_mentee_assignments WHERE id = ?", (assignment_id,))

        # Notify both users
        create_notification(
            conn,
            mentee_id,
            "Mentorship Concluded",
            f"Your active mentorship pairing with {mentor_name} has been removed by administration.",
            "assignment"
        )
        create_notification(
            conn,
            mentor_id,
            "Mentorship Concluded",
            f"Your pairing with mentee {mentee_name} has been removed by administration.",
            "assignment"
        )

    return jsonify({"message": f"Mentorship assignment between {mentor_name} and {mentee_name} was removed."}), 200


# ==========================================
# Meeting Management API
# ==========================================

@app.route("/api/meetings", methods=["GET"])
@login_required
def api_get_meetings():
    """Retrieve meetings relevant to the current user's role and identity."""
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()
        base_query = """
            SELECT m.id, m.mentor_id, m.mentee_id, m.agenda, m.meeting_date, m.meeting_time,
                   m.mode, m.location_or_link, m.status, m.notes, m.created_at,
                   mentor.name as mentor_name, mentor.email as mentor_email,
                   mentee.name as mentee_name, mentee.email as mentee_email
            FROM meetings m
            JOIN users mentor ON m.mentor_id = mentor.id
            JOIN users mentee ON m.mentee_id = mentee.id
        """

        if role == "admin":
            cursor.execute(base_query + " ORDER BY m.meeting_date DESC, m.meeting_time DESC")
        elif role == "mentor":
            cursor.execute(base_query + " WHERE m.mentor_id = ? ORDER BY m.meeting_date DESC, m.meeting_time DESC", (user_id,))
        elif role == "mentee":
            cursor.execute(base_query + " WHERE m.mentee_id = ? ORDER BY m.meeting_date DESC, m.meeting_time DESC", (user_id,))
        else:
            return jsonify({"meetings": []}), 200

        meetings = [dict(row) for row in cursor.fetchall()]

    return jsonify({"meetings": meetings}), 200


@app.route("/api/meetings", methods=["POST"])
@login_required
def api_create_meeting():
    """
    Schedule or request a meeting.
    Mentees request a meeting with their assigned mentor.
    Mentors can schedule directly with one of their assigned mentees.
    Admins can schedule on behalf of valid pairs.
    """
    user_id = session["user_id"]
    role = session["role"]
    data = request.get_json(silent=True) or {}

    agenda = (data.get("agenda") or "").strip()
    meeting_date = (data.get("meeting_date") or "").strip()
    meeting_time = (data.get("meeting_time") or "").strip()
    mode = (data.get("mode") or "").strip().lower()
    location_or_link = (data.get("location_or_link") or "").strip()
    notes = (data.get("notes") or "").strip()

    if not agenda or len(agenda) > 200:
        return jsonify({"error": "Meeting agenda is required (max 200 characters)."}), 400

    if not meeting_date:
        return jsonify({"error": "Meeting date is required (YYYY-MM-DD)."}), 400

    if not meeting_time:
        return jsonify({"error": "Meeting time is required (HH:MM)."}), 400

    if mode not in ("online", "offline"):
        return jsonify({"error": "Mode must be either 'online' or 'offline'."}), 400

    with get_db() as conn:
        # Determine mentor_id and mentee_id based on role
        if role == "mentee":
            mentor_info = get_assigned_mentor(conn, user_id)
            if not mentor_info:
                return jsonify({"error": "You do not have an assigned mentor yet. Please wait for an administrator to assign you one."}), 400
            mentor_id = mentor_info["id"]
            mentee_id = user_id
            initial_status = "Requested"
        elif role == "mentor":
            try:
                mentee_id = int(data.get("mentee_id"))
            except (ValueError, TypeError):
                return jsonify({"error": "Please select an assigned mentee for this meeting."}), 400

            if not are_mentor_mentee(conn, user_id, mentee_id):
                return jsonify({"error": "You can only schedule meetings with your assigned mentees."}), 403

            mentor_id = user_id
            initial_status = "Scheduled"
        elif role == "admin":
            try:
                mentor_id = int(data.get("mentor_id"))
                mentee_id = int(data.get("mentee_id"))
            except (ValueError, TypeError):
                return jsonify({"error": "Valid mentor_id and mentee_id are required."}), 400

            if not are_mentor_mentee(conn, mentor_id, mentee_id):
                return jsonify({"error": "The selected mentor and mentee must share an active assignment."}), 400
            initial_status = "Scheduled"
        else:
            return jsonify({"error": "Unauthorized action."}), 403

        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO meetings (mentor_id, mentee_id, agenda, meeting_date, meeting_time, mode, location_or_link, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (mentor_id, mentee_id, agenda, meeting_date, meeting_time, mode, location_or_link, initial_status, notes))
        meeting_id = cursor.lastrowid

        mentor = get_user_by_id(conn, mentor_id)
        mentee = get_user_by_id(conn, mentee_id)

        # Notify recipient
        if role == "mentee":
            create_notification(
                conn,
                mentor_id,
                "New Meeting Request",
                f"Mentee {mentee['name']} requested a meeting on {meeting_date} at {meeting_time}: '{agenda}'.",
                "meeting"
            )
        else:
            create_notification(
                conn,
                mentee_id,
                "New Meeting Scheduled",
                f"Mentor {mentor['name']} scheduled a meeting on {meeting_date} at {meeting_time}: '{agenda}'.",
                "meeting"
            )

    return jsonify({
        "message": f"Meeting successfully {initial_status.lower()}.",
        "meeting_id": meeting_id
    }), 201


@app.route("/api/meetings/<int:meeting_id>/status", methods=["PUT"])
@login_required
def api_update_meeting_status(meeting_id):
    """
    Update meeting status (Confirm / Scheduled, Completed, Cancelled).
    Mentors can confirm, complete, or cancel.
    Mentees can cancel.
    Admins can update to any state.
    """
    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip()
    notes = (data.get("notes") or "").strip()
    user_id = session["user_id"]
    role = session["role"]

    if new_status not in ("Requested", "Scheduled", "Completed", "Cancelled"):
        return jsonify({"error": "Invalid meeting status."}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT m.*, mentor.name as mentor_name, mentee.name as mentee_name
            FROM meetings m
            JOIN users mentor ON m.mentor_id = mentor.id
            JOIN users mentee ON m.mentee_id = mentee.id
            WHERE m.id = ?
        """, (meeting_id,))
        meeting = cursor.fetchone()

        if not meeting:
            return jsonify({"error": "Meeting not found."}), 404

        # Permission check
        if role == "mentor" and meeting["mentor_id"] != user_id:
            return jsonify({"error": "You can only update meetings where you are the mentor."}), 403
        elif role == "mentee":
            if meeting["mentee_id"] != user_id:
                return jsonify({"error": "You can only update meetings where you are the mentee."}), 403
            if new_status != "Cancelled":
                return jsonify({"error": "Mentees are only authorized to cancel meetings."}), 403

        # Perform update
        if notes:
            cursor.execute("UPDATE meetings SET status = ?, notes = ? WHERE id = ?", (new_status, notes, meeting_id))
        else:
            cursor.execute("UPDATE meetings SET status = ? WHERE id = ?", (new_status, meeting_id))

        # Notify the other party
        recipient_id = meeting["mentee_id"] if user_id == meeting["mentor_id"] else meeting["mentor_id"]
        updater_name = meeting["mentor_name"] if user_id == meeting["mentor_id"] else meeting["mentee_name"]

        create_notification(
            conn,
            recipient_id,
            f"Meeting Status: {new_status}",
            f"{updater_name} updated the status of '{meeting['agenda']}' to {new_status}.",
            "meeting"
        )

    return jsonify({"message": f"Meeting status updated to {new_status}."}), 200


# ==========================================
# Task Management API
# ==========================================

@app.route("/api/tasks", methods=["GET"])
@login_required
def api_get_tasks():
    """Retrieve tasks according to user role."""
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()
        base_query = """
            SELECT t.id, t.mentor_id, t.mentee_id, t.title, t.description, t.due_date,
                   t.status, t.created_at, t.updated_at,
                   mentor.name as mentor_name, mentee.name as mentee_name
            FROM tasks t
            JOIN users mentor ON t.mentor_id = mentor.id
            JOIN users mentee ON t.mentee_id = mentee.id
        """

        if role == "admin":
            cursor.execute(base_query + " ORDER BY t.created_at DESC")
        elif role == "mentor":
            cursor.execute(base_query + " WHERE t.mentor_id = ? ORDER BY t.created_at DESC", (user_id,))
        elif role == "mentee":
            cursor.execute(base_query + " WHERE t.mentee_id = ? ORDER BY t.created_at DESC", (user_id,))
        else:
            return jsonify({"tasks": []}), 200

        tasks = [dict(row) for row in cursor.fetchall()]

    return jsonify({"tasks": tasks}), 200


@app.route("/api/tasks", methods=["POST"])
@login_required
@role_required("mentor", "admin")
def api_create_task():
    """Create a new task assigned to a mentee."""
    user_id = session["user_id"]
    role = session["role"]
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    due_date = (data.get("due_date") or "").strip()

    if not title or len(title) > 150:
        return jsonify({"error": "Task title is required (max 150 characters)."}), 400
    if len(description) > 1000:
        return jsonify({"error": "Task description must not exceed 1000 characters."}), 400

    try:
        mentee_id = int(data.get("mentee_id"))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid mentee_id is required."}), 400

    with get_db() as conn:
        if role == "mentor":
            if not are_mentor_mentee(conn, user_id, mentee_id):
                return jsonify({"error": "You can only assign tasks to your assigned mentees."}), 403
            mentor_id = user_id
        else:  # Admin
            try:
                mentor_id = int(data.get("mentor_id"))
            except (ValueError, TypeError):
                return jsonify({"error": "Valid mentor_id is required for admin task assignment."}), 400
            if not are_mentor_mentee(conn, mentor_id, mentee_id):
                return jsonify({"error": "Mentor and mentee must share an active assignment."}), 400

        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (mentor_id, mentee_id, title, description, due_date, status)
            VALUES (?, ?, ?, ?, ?, 'Pending')
        """, (mentor_id, mentee_id, title, description, due_date))
        task_id = cursor.lastrowid

        mentor = get_user_by_id(conn, mentor_id)
        create_notification(
            conn,
            mentee_id,
            "New Task Assigned",
            f"Mentor {mentor['name']} assigned a new task: '{title}'.",
            "task"
        )

    return jsonify({"message": "Task created successfully.", "task_id": task_id}), 201


@app.route("/api/tasks/<int:task_id>/status", methods=["PUT"])
@login_required
def api_update_task_status(task_id):
    """
    Update task progress status (Pending, In Progress, Completed).
    Mentees can update status of their tasks; Mentors can also update.
    """
    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip()
    user_id = session["user_id"]
    role = session["role"]

    if new_status not in ("Pending", "In Progress", "Completed"):
        return jsonify({"error": "Invalid task status. Must be 'Pending', 'In Progress', or 'Completed'."}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*, mentee.name as mentee_name, mentor.name as mentor_name
            FROM tasks t
            JOIN users mentee ON t.mentee_id = mentee.id
            JOIN users mentor ON t.mentor_id = mentor.id
            WHERE t.id = ?
        """, (task_id,))
        task = cursor.fetchone()

        if not task:
            return jsonify({"error": "Task not found."}), 404

        # Access control
        if role == "mentee" and task["mentee_id"] != user_id:
            return jsonify({"error": "You can only update status for tasks assigned to you."}), 403
        if role == "mentor" and task["mentor_id"] != user_id:
            return jsonify({"error": "You can only update tasks you assigned."}), 403

        cursor.execute("""
            UPDATE tasks
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_status, task_id))

        # Notify mentor if mentee updated
        if role == "mentee":
            create_notification(
                conn,
                task["mentor_id"],
                "Task Progress Updated",
                f"{task['mentee_name']} marked task '{task['title']}' as {new_status}.",
                "task"
            )

    return jsonify({"message": f"Task status updated to {new_status}."}), 200


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@login_required
@role_required("mentor", "admin")
def api_delete_task(task_id):
    """Delete a task."""
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            return jsonify({"error": "Task not found."}), 404

        if role == "mentor" and task["mentor_id"] != user_id:
            return jsonify({"error": "You can only delete tasks you created."}), 403

        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

    return jsonify({"message": "Task deleted successfully."}), 200


# ==========================================
# Messaging & Conversations API
# ==========================================

@app.route("/api/messages", methods=["GET"])
@login_required
def api_get_messages():
    """
    Retrieve message history between current user and a conversation partner.
    Only authorized mentor-mentee pairs or admins can communicate.
    Automatically marks incoming messages as read.
    """
    user_id = session["user_id"]
    role = session["role"]

    try:
        partner_id = int(request.args.get("partner_id"))
    except (ValueError, TypeError):
        return jsonify({"error": "A valid partner_id query parameter is required."}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        partner = get_user_by_id(conn, partner_id)
        if not partner:
            return jsonify({"error": "Conversation partner not found."}), 404

        # Verify pair relation unless admin
        if role != "admin" and not are_mentor_mentee(conn, user_id, partner_id):
            return jsonify({"error": "You can only message your assigned mentor or mentee."}), 403

        # Mark messages sent from partner to current user as read
        cursor.execute("""
            UPDATE messages
            SET is_read = 1
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
        """, (partner_id, user_id))

        # Retrieve conversation history
        cursor.execute("""
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
                   s.name as sender_name, r.name as receiver_name
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
        """, (user_id, partner_id, partner_id, user_id))

        messages = [dict(row) for row in cursor.fetchall()]

    return jsonify({
        "partner": partner,
        "messages": messages
    }), 200


@app.route("/api/messages", methods=["POST"])
@login_required
def api_send_message():
    """Send a direct message to an assigned mentor/mentee."""
    user_id = session["user_id"]
    role = session["role"]
    data = request.get_json(silent=True) or {}

    try:
        receiver_id = int(data.get("receiver_id"))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid numeric receiver_id is required."}), 400

    content = (data.get("message") or "").strip()
    if not content or len(content) > 2000:
        return jsonify({"error": "Message content cannot be empty (max 2000 characters)."}), 400

    with get_db() as conn:
        cursor = conn.cursor()

        recipient = get_user_by_id(conn, receiver_id)
        if not recipient:
            return jsonify({"error": "Recipient user not found."}), 404

        if role != "admin" and not are_mentor_mentee(conn, user_id, receiver_id):
            return jsonify({"error": "Messaging is restricted to authorized mentor-mentee pairings."}), 403

        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, message)
            VALUES (?, ?, ?)
        """, (user_id, receiver_id, content))
        msg_id = cursor.lastrowid

        sender = get_user_by_id(conn, user_id)
        # Notify recipient
        create_notification(
            conn,
            receiver_id,
            f"New message from {sender['name']}",
            content[:80] + ("..." if len(content) > 80 else ""),
            "message"
        )

        cursor.execute("""
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
                   s.name as sender_name, r.name as receiver_name
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            WHERE m.id = ?
        """, (msg_id,))
        sent_msg = dict(cursor.fetchone())

    return jsonify({"message": "Message sent successfully.", "data": sent_msg}), 201


# ==========================================
# In-App Notifications API
# ==========================================

@app.route("/api/notifications", methods=["GET"])
@login_required
def api_get_notifications():
    """List recent notifications for the logged-in user and unread count."""
    user_id = session["user_id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id, title, message, type, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 30
        """, (user_id,))
        notifications = [dict(row) for row in cursor.fetchall()]

        cursor.execute("""
            SELECT COUNT(*) as count FROM notifications
            WHERE user_id = ? AND is_read = 0
        """, (user_id,))
        unread_count = cursor.fetchone()["count"]

    return jsonify({
        "notifications": notifications,
        "unread_count": unread_count
    }), 200


@app.route("/api/notifications/<int:notification_id>/read", methods=["PUT"])
@login_required
def api_mark_notification_read(notification_id):
    """Mark a specific notification as read."""
    user_id = session["user_id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND user_id = ?
        """, (notification_id, user_id))
    return jsonify({"message": "Notification marked as read."}), 200


@app.route("/api/notifications/read-all", methods=["PUT"])
@login_required
def api_mark_all_notifications_read():
    """Mark all notifications for the current user as read."""
    user_id = session["user_id"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = ?
        """, (user_id,))
    return jsonify({"message": "All notifications marked as read."}), 200


# ==========================================
# Feedback & Ratings API
# ==========================================

@app.route("/api/feedback", methods=["GET"])
@login_required
def api_get_feedback():
    """Retrieve feedback records relevant to the current user."""
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()
        base_query = """
            SELECT f.id, f.author_id, f.recipient_id, f.rating, f.comments, f.created_at,
                   author.name as author_name, author.role as author_role,
                   recipient.name as recipient_name, recipient.role as recipient_role
            FROM feedback f
            JOIN users author ON f.author_id = author.id
            JOIN users recipient ON f.recipient_id = recipient.id
        """

        if role == "admin":
            cursor.execute(base_query + " ORDER BY f.created_at DESC")
        else:
            cursor.execute(base_query + " WHERE f.author_id = ? OR f.recipient_id = ? ORDER BY f.created_at DESC", (user_id, user_id))

        feedback_list = [dict(row) for row in cursor.fetchall()]

    return jsonify({"feedback": feedback_list}), 200


@app.route("/api/feedback", methods=["POST"])
@login_required
def api_submit_feedback():
    """Submit a rating (1-5) and written feedback for an assigned mentor/mentee."""
    user_id = session["user_id"]
    role = session["role"]
    data = request.get_json(silent=True) or {}

    try:
        recipient_id = int(data.get("recipient_id"))
        rating = int(data.get("rating"))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid numeric recipient_id and rating (1-5) are required."}), 400

    comments = (data.get("comments") or "").strip()

    if rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be an integer between 1 and 5 stars."}), 400

    if not comments or len(comments) < 5 or len(comments) > 1000:
        return jsonify({"error": "Feedback comment must be between 5 and 1000 characters."}), 400

    with get_db() as conn:
        # Check mentorship relationship
        if role != "admin" and not are_mentor_mentee(conn, user_id, recipient_id):
            return jsonify({"error": "You can only submit feedback for a mentor or mentee with whom you have an active relationship."}), 403

        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO feedback (author_id, recipient_id, rating, comments)
            VALUES (?, ?, ?, ?)
        """, (user_id, recipient_id, rating, comments))
        feedback_id = cursor.lastrowid

        author = get_user_by_id(conn, user_id)
        create_notification(
            conn,
            recipient_id,
            f"New {rating}★ Feedback Received",
            f"{author['name']} submitted feedback for you: '{comments[:70]}...'",
            "feedback"
        )

    return jsonify({"message": "Feedback submitted successfully.", "feedback_id": feedback_id}), 201


# ==========================================
# Dashboard Statistics API
# ==========================================

@app.route("/api/dashboard/stats", methods=["GET"])
@login_required
def api_dashboard_stats():
    """Return live database statistics tailored for Admin, Mentor, or Mentee."""
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()

        if role == "admin":
            cursor.execute("SELECT COUNT(*) as count FROM users")
            total_users = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'mentor'")
            total_mentors = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'mentee'")
            total_mentees = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM mentor_mentee_assignments WHERE status = 'active'")
            total_assignments = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM meetings")
            total_meetings = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM tasks")
            total_tasks = cursor.fetchone()["count"]

            cursor.execute("SELECT COUNT(*) as count FROM feedback")
            total_feedback = cursor.fetchone()["count"]

            # Recent 5 activities
            cursor.execute("""
                SELECT 'Meeting' as type, agenda as label, created_at FROM meetings
                UNION ALL
                SELECT 'Task' as type, title as label, created_at FROM tasks
                UNION ALL
                SELECT 'User' as type, name as label, created_at FROM users
                ORDER BY created_at DESC LIMIT 5
            """)
            recent_activities = [dict(row) for row in cursor.fetchall()]

            return jsonify({
                "role": "admin",
                "stats": {
                    "total_users": total_users,
                    "total_mentors": total_mentors,
                    "total_mentees": total_mentees,
                    "total_assignments": total_assignments,
                    "total_meetings": total_meetings,
                    "total_tasks": total_tasks,
                    "total_feedback": total_feedback
                },
                "recent_activities": recent_activities
            }), 200

        elif role == "mentor":
            # Mentor stats
            assigned_mentees = get_assigned_mentees(conn, user_id)

            cursor.execute("""
                SELECT COUNT(*) as count FROM meetings
                WHERE mentor_id = ? AND status IN ('Requested', 'Scheduled')
            """, (user_id,))
            upcoming_meetings = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT COUNT(*) as count FROM tasks
                WHERE mentor_id = ? AND status != 'Completed'
            """, (user_id,))
            pending_tasks = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT COUNT(*) as count FROM tasks
                WHERE mentor_id = ? AND status = 'Completed'
            """, (user_id,))
            completed_tasks = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT COUNT(*) as count FROM messages
                WHERE receiver_id = ? AND is_read = 0
            """, (user_id,))
            unread_messages = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM feedback
                WHERE recipient_id = ?
            """, (user_id,))
            f_row = cursor.fetchone()
            avg_rating = round(f_row["avg_rating"], 1) if f_row and f_row["avg_rating"] else None
            review_count = f_row["count"] if f_row else 0

            return jsonify({
                "role": "mentor",
                "stats": {
                    "mentees_count": len(assigned_mentees),
                    "max_mentees": MAX_MENTEES_PER_MENTOR,
                    "upcoming_meetings": upcoming_meetings,
                    "pending_tasks": pending_tasks,
                    "completed_tasks": completed_tasks,
                    "unread_messages": unread_messages,
                    "avg_rating": avg_rating,
                    "review_count": review_count
                },
                "mentees": assigned_mentees
            }), 200

        elif role == "mentee":
            mentor_info = get_assigned_mentor(conn, user_id)

            cursor.execute("""
                SELECT COUNT(*) as count FROM meetings
                WHERE mentee_id = ? AND status IN ('Requested', 'Scheduled')
            """, (user_id,))
            upcoming_meetings = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT COUNT(*) as count FROM tasks
                WHERE mentee_id = ? AND status != 'Completed'
            """, (user_id,))
            pending_tasks = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT COUNT(*) as count FROM tasks
                WHERE mentee_id = ? AND status = 'Completed'
            """, (user_id,))
            completed_tasks = cursor.fetchone()["count"]

            cursor.execute("""
                SELECT COUNT(*) as count FROM messages
                WHERE receiver_id = ? AND is_read = 0
            """, (user_id,))
            unread_messages = cursor.fetchone()["count"]

            return jsonify({
                "role": "mentee",
                "stats": {
                    "has_mentor": mentor_info is not None,
                    "upcoming_meetings": upcoming_meetings,
                    "pending_tasks": pending_tasks,
                    "completed_tasks": completed_tasks,
                    "unread_messages": unread_messages
                },
                "mentor": mentor_info
            }), 200

    return jsonify({"error": "Unknown role"}), 400


# ==========================================
# 1. AI Skill-Gap Detective API
# ==========================================

@app.route("/api/skills/gap-analysis", methods=["GET"])
@login_required
def api_skills_gap_analysis():
    user_id = session["user_id"]
    role = session["role"]
    target_user_id = request.args.get("user_id", type=int) or user_id

    with get_db() as conn:
        cursor = conn.cursor()
        if target_user_id != user_id and role not in ("mentor", "admin"):
            return jsonify({"error": "Unauthorized access to student skill analysis."}), 403

        cursor.execute("""
            SELECT id, user_id, skill_name, score, status, recommended_activity, created_at
            FROM skill_assessments
            WHERE user_id = ?
            ORDER BY score ASC, created_at DESC
        """, (target_user_id,))
        assessments = [dict(row) for row in cursor.fetchall()]

        total = len(assessments)
        gaps = sum(1 for a in assessments if a["status"] == "gap_detected")
        proficient = total - gaps
        avg_score = round(sum(a["score"] for a in assessments) / total) if total > 0 else 0

    return jsonify({
        "assessments": assessments,
        "stats": {
            "total_skills": total,
            "gaps_detected": gaps,
            "proficient_skills": proficient,
            "average_score": avg_score
        }
    }), 200


@app.route("/api/skills/assess", methods=["POST"])
@login_required
def api_submit_skill_assessment():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    skill_name = (data.get("skill_name") or "").strip()
    try:
        score = int(data.get("score"))
    except (ValueError, TypeError):
        return jsonify({"error": "Score must be an integer between 0 and 100."}), 400

    if not skill_name or len(skill_name) > 100:
        return jsonify({"error": "Skill name is required (max 100 characters)."}), 400

    score = max(0, min(100, score))
    status = "gap_detected" if score < 70 else "proficient"
    activity = (data.get("recommended_activity") or "").strip()
    if not activity:
        if score < 50:
            activity = f"Foundational workshop and hands-on lab exercises in {skill_name}."
        elif score < 70:
            activity = f"Practice targeted problem sets and code review sessions in {skill_name}."
        else:
            activity = f"Advanced architecture challenges and peer mentoring in {skill_name}."

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO skill_assessments (user_id, skill_name, score, status, recommended_activity)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, skill_name, score, status, activity))
        assessment_id = cursor.lastrowid

    return jsonify({
        "message": f"Skill evaluation recorded. Status: {status.replace('_', ' ').title()}.",
        "assessment_id": assessment_id,
        "status": status,
        "recommended_activity": activity
    }), 201


# ==========================================
# 2. Adaptive Mentoring Roadmap API
# ==========================================

@app.route("/api/roadmap", methods=["GET"])
@login_required
def api_get_adaptive_roadmap():
    user_id = session["user_id"]
    role = session["role"]
    mentee_id = request.args.get("mentee_id", type=int)

    if role == "mentee":
        target_id = user_id
    elif role in ("mentor", "admin"):
        target_id = mentee_id or user_id
    else:
        target_id = user_id

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.*, m.name as mentee_name, f.name as mentor_name
            FROM adaptive_roadmaps r
            JOIN users m ON r.mentee_id = m.id
            LEFT JOIN users f ON r.mentor_id = f.id
            WHERE r.mentee_id = ?
            ORDER BY r.week_number ASC, r.id ASC
        """, (target_id,))
        milestones = [dict(row) for row in cursor.fetchall()]

        completed = sum(1 for m in milestones if m["status"] == "Completed")
        total = len(milestones)
        progress_pct = round((completed / total) * 100) if total > 0 else 0

    return jsonify({
        "roadmap": milestones,
        "progress_pct": progress_pct,
        "completed_goals": completed,
        "total_goals": total
    }), 200


@app.route("/api/roadmap/<int:roadmap_id>/status", methods=["PUT"])
@login_required
def api_update_roadmap_status(roadmap_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    adjusted_reason = (data.get("adjusted_reason") or "").strip()

    if new_status not in ("Pending", "In Progress", "Completed"):
        return jsonify({"error": "Invalid status."}), 400

    with get_db() as conn:
        cursor = conn.cursor()
        if adjusted_reason:
            cursor.execute("""
                UPDATE adaptive_roadmaps
                SET status = ?, adjusted_reason = ?
                WHERE id = ?
            """, (new_status, adjusted_reason, roadmap_id))
        else:
            cursor.execute("UPDATE adaptive_roadmaps SET status = ? WHERE id = ?", (new_status, roadmap_id))

    return jsonify({"message": f"Roadmap goal updated to {new_status}."}), 200


# ==========================================
# 3. Early Support Signal Engine API
# ==========================================

@app.route("/api/support-signals", methods=["GET"])
@login_required
def api_get_support_signals():
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()
        base_query = """
            SELECT s.*, m.name as mentee_name, m.email as mentee_email, f.name as mentor_name
            FROM support_signals s
            JOIN users m ON s.mentee_id = m.id
            LEFT JOIN users f ON s.mentor_id = f.id
        """
        if role == "admin":
            cursor.execute(base_query + " WHERE s.is_resolved = 0 ORDER BY s.created_at DESC")
        elif role == "mentor":
            cursor.execute(base_query + " WHERE s.mentor_id = ? AND s.is_resolved = 0 ORDER BY s.created_at DESC", (user_id,))
        elif role == "mentee":
            cursor.execute(base_query + " WHERE s.mentee_id = ? AND s.is_resolved = 0 ORDER BY s.created_at DESC", (user_id,))
        else:
            return jsonify({"signals": []}), 200

        signals = [dict(row) for row in cursor.fetchall()]

    return jsonify({
        "signals": signals,
        "active_signals_count": len(signals)
    }), 200


@app.route("/api/support-signals/<int:signal_id>/resolve", methods=["PUT"])
@login_required
def api_resolve_support_signal(signal_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE support_signals SET is_resolved = 1 WHERE id = ?", (signal_id,))
    return jsonify({"message": "Early support alert marked as resolved."}), 200


# ==========================================
# 4. Explainable Mentor-Mentee Matching API
# ==========================================

@app.route("/api/matching/recommendations", methods=["GET"])
@login_required
def api_get_matching_recommendations():
    mentee_id = request.args.get("mentee_id", type=int) or session["user_id"]

    with get_db() as conn:
        cursor = conn.cursor()
        mentee = get_user_by_id(conn, mentee_id)
        if not mentee:
            return jsonify({"error": "Mentee not found."}), 404

        cursor.execute("SELECT * FROM users WHERE role = 'mentor' ORDER BY name ASC")
        mentors = [dict(row) for row in cursor.fetchall()]

        mentee_skills = [s.strip().lower() for s in mentee["skills"].split(",") if s.strip()]
        mentee_interests = [s.strip().lower() for s in mentee["interests"].split(",") if s.strip()]
        mentee_dept = (mentee["department"] or "").strip().lower()

        recommendations = []
        for mentor in mentors:
            mentor_id = mentor["id"]
            active_mentees = count_mentees_for_mentor(conn, mentor_id)
            capacity_left = MAX_MENTEES_PER_MENTOR - active_mentees

            score = 40  # base compatibility
            reasons = []

            # 1. Department affinity (+25)
            mentor_dept = (mentor["department"] or "").strip().lower()
            if mentee_dept and mentor_dept and (mentee_dept in mentor_dept or mentor_dept in mentee_dept):
                score += 25
                reasons.append(f"Shared academic department: {mentor['department'] or 'Aligned'}")

            # 2. Skill overlap (+12 each, max 36)
            mentor_skills = [s.strip().lower() for s in mentor["skills"].split(",") if s.strip()]
            matched_skills = [s for s in mentee_skills if any(s in ms or ms in s for ms in mentor_skills)]
            if matched_skills:
                bonus = min(36, len(matched_skills) * 12)
                score += bonus
                reasons.append(f"Matches {len(matched_skills)} core skill(s): {', '.join(matched_skills[:3]).title()}")

            # 3. Interest overlap (+15)
            mentor_interests = [s.strip().lower() for s in mentor["interests"].split(",") if s.strip()]
            matched_interests = [s for s in mentee_interests if any(s in mi or mi in s for mi in mentor_interests)]
            if matched_interests:
                score += 15
                reasons.append(f"Shared passion in {', '.join(matched_interests[:2]).title()}")

            # 4. Capacity availability
            if capacity_left > 0:
                score += 10
                reasons.append(f"Available mentorship capacity ({capacity_left}/5 slots open)")
            else:
                score -= 30
                reasons.append("Currently at maximum capacity (5/5 mentees assigned)")

            score = max(20, min(99, score))
            recommendations.append({
                "mentor_id": mentor["id"],
                "mentor_name": mentor["name"],
                "department": mentor["department"],
                "skills": mentor["skills"],
                "interests": mentor["interests"],
                "bio": mentor["bio"],
                "active_mentees": active_mentees,
                "capacity_left": capacity_left,
                "is_full": capacity_left <= 0,
                "match_percentage": score,
                "explanation_reasons": reasons
            })

        recommendations.sort(key=lambda x: x["match_percentage"], reverse=True)

    return jsonify({
        "mentee": mentee,
        "recommendations": recommendations
    }), 200


# ==========================================
# 5. Mentoring Impact Analyzer API
# ==========================================

@app.route("/api/impact/analytics", methods=["GET"])
@login_required
def api_get_impact_analytics():
    user_id = session["user_id"]
    role = session["role"]

    with get_db() as conn:
        cursor = conn.cursor()
        base_query = """
            SELECT im.*, m.name as mentee_name, m.department as mentee_department,
                   f.name as mentor_name, f.department as mentor_department
            FROM impact_metrics im
            JOIN users m ON im.mentee_id = m.id
            JOIN users f ON im.mentor_id = f.id
        """

        if role == "admin":
            cursor.execute(base_query + " ORDER BY im.improvement_pct DESC")
        elif role == "mentor":
            cursor.execute(base_query + " WHERE im.mentor_id = ? ORDER BY im.improvement_pct DESC", (user_id,))
        elif role == "mentee":
            cursor.execute(base_query + " WHERE im.mentee_id = ? ORDER BY im.improvement_pct DESC", (user_id,))
        else:
            return jsonify({"metrics": []}), 200

        metrics = [dict(row) for row in cursor.fetchall()]

        avg_boost = round(sum(m["improvement_pct"] for m in metrics) / len(metrics)) if metrics else 0
        total_sessions = sum(m["sessions_attended"] for m in metrics)
        total_tasks = sum(m["tasks_completed"] for m in metrics)

    return jsonify({
        "metrics": metrics,
        "summary": {
            "average_improvement_pct": avg_boost,
            "total_mentoring_sessions": total_sessions,
            "total_milestones_completed": total_tasks
        }
    }), 200


# ==========================================
# Error Handlers
# ==========================================

@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found."}), 404
    return render_template("base.html", page_title="Page Not Found", error_message="The requested page could not be found."), 404


@app.errorhandler(403)
def handle_403(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": getattr(e, "description", "Forbidden access.")}), 403
    return render_template("base.html", page_title="Access Forbidden", error_message="You do not have permission to view this resource."), 403


@app.errorhandler(500)
def handle_500(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Internal server error. Please try again later."}), 500
    return render_template("base.html", page_title="Server Error", error_message="An unexpected server error occurred. Please try again."), 500


# ==========================================
# Application Bootstrap
# ==========================================

# Ensure DB is created on startup; if fresh (e.g. Vercel serverless /tmp), automatically seed demo data
db_already_existed = os.path.exists(database.DB_PATH)
init_db(reset=False)
if not db_already_existed:
    try:
        from seed import seed_database
        seed_database(verbose=False)
    except Exception as e:
        print(f"Auto-seed notification: {e}")

if __name__ == "__main__":
    # Start development server
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    print(f"Starting MentorLink Web Application on http://127.0.0.1:{port} (Debug: {debug_mode})")
    app.run(host="127.0.0.1", port=port, debug=debug_mode)
