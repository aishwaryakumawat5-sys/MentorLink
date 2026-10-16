"""
MentorLink - Database Management Module
Handles SQLite connection, schema creation, query helpers, and constraints.
"""

import os
import sqlite3
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("VERCEL"):
    INSTANCE_DIR = "/tmp"
    DB_PATH = os.path.join(INSTANCE_DIR, "mentorlink.db")
else:
    INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
    DB_PATH = os.path.join(INSTANCE_DIR, "mentorlink.db")
MAX_MENTEES_PER_MENTOR = 5


def ensure_instance_dir():
    """Ensure the instance directory exists."""
    if not os.path.exists(INSTANCE_DIR):
        os.makedirs(INSTANCE_DIR, exist_ok=True)


def get_db_connection():
    """Create and return a database connection with foreign key support and Row factory."""
    ensure_instance_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db():
    """Context manager for safe database transactions."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(reset=False):
    """
    Initialize database tables.
    If reset=True, drop existing tables first.
    """
    ensure_instance_dir()
    with get_db() as conn:
        cursor = conn.cursor()

        if reset:
            # Drop tables in reverse order of foreign key dependencies
            cursor.execute("PRAGMA foreign_keys = OFF;")
            tables = [
                "impact_metrics",
                "support_signals",
                "adaptive_roadmaps",
                "skill_assessments",
                "feedback",
                "notifications",
                "messages",
                "tasks",
                "meetings",
                "mentor_mentee_assignments",
                "users"
            ]
            for table in tables:
                cursor.execute(f"DROP TABLE IF EXISTS {table}")
            cursor.execute("PRAGMA foreign_keys = ON;")

        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'mentor', 'mentee')),
                department TEXT DEFAULT '',
                skills TEXT DEFAULT '',
                interests TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Mentor-Mentee Assignments Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mentor_mentee_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mentee_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 3. Meetings Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meetings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mentee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                agenda TEXT NOT NULL,
                meeting_date TEXT NOT NULL,
                meeting_time TEXT NOT NULL,
                mode TEXT NOT NULL CHECK(mode IN ('online', 'offline')),
                location_or_link TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Requested' CHECK(status IN ('Requested', 'Scheduled', 'Completed', 'Cancelled')),
                notes TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 4. Tasks Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mentee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                due_date TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Completed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 5. Messages Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 6. Notifications Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'info',
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 7. Feedback Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                comments TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 8. AI Skill-Gap Detective Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skill_assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                skill_name TEXT NOT NULL,
                score INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
                status TEXT NOT NULL DEFAULT 'gap_detected' CHECK(status IN ('gap_detected', 'proficient')),
                recommended_activity TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 9. Adaptive Mentoring Roadmap Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS adaptive_roadmaps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                week_number INTEGER NOT NULL,
                goal_title TEXT NOT NULL,
                target_skill TEXT NOT NULL,
                adjusted_reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'In Progress' CHECK(status IN ('Pending', 'In Progress', 'Completed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 10. Early Support Signal Engine Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS support_signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mentor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                signal_type TEXT NOT NULL CHECK(signal_type IN ('missed_assignment', 'low_activity', 'skill_struggle', 'at_risk')),
                severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
                title TEXT NOT NULL,
                details TEXT NOT NULL,
                is_resolved INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 11. Mentoring Impact Analyzer Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS impact_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mentee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mentor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                baseline_score INTEGER NOT NULL,
                current_score INTEGER NOT NULL,
                improvement_pct INTEGER NOT NULL,
                sessions_attended INTEGER NOT NULL DEFAULT 0,
                tasks_completed INTEGER NOT NULL DEFAULT 0,
                impact_summary TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assignments_mentor ON mentor_mentee_assignments(mentor_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assignments_mentee ON mentor_mentee_assignments(mentee_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_meetings_mentor ON meetings(mentor_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_meetings_mentee ON meetings(mentee_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_mentor ON tasks(mentor_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_mentee ON tasks(mentee_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_feedback_recipient ON feedback(recipient_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_skills_user ON skill_assessments(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_mentee ON adaptive_roadmaps(mentee_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_signals_mentor ON support_signals(mentor_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_signals_mentee ON support_signals(mentee_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_impact_mentee ON impact_metrics(mentee_id);")

    return True


# ==========================================
# Helper Query Functions
# ==========================================

def create_notification(conn, user_id, title, message, notif_type="info"):
    """Insert an in-app notification for a given user."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
    """, (user_id, title, message, notif_type))
    return cursor.lastrowid


def get_user_by_id(conn, user_id):
    """Retrieve a single user dictionary by ID."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, role, department, skills, interests, bio, created_at
        FROM users WHERE id = ?
    """, (user_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


def get_user_by_email(conn, email):
    """Retrieve full user row by email (including password_hash)."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    return dict(row) if row else None


def get_assigned_mentor(conn, mentee_id):
    """Retrieve the active assigned mentor for a mentee, if any."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.name, u.email, u.role, u.department, u.skills, u.interests, u.bio,
               a.id as assignment_id, a.assigned_at
        FROM mentor_mentee_assignments a
        JOIN users u ON a.mentor_id = u.id
        WHERE a.mentee_id = ? AND a.status = 'active'
    """, (mentee_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


def get_assigned_mentees(conn, mentor_id):
    """Retrieve all active assigned mentees for a mentor."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.name, u.email, u.role, u.department, u.skills, u.interests, u.bio,
               a.id as assignment_id, a.assigned_at
        FROM mentor_mentee_assignments a
        JOIN users u ON a.mentee_id = u.id
        WHERE a.mentor_id = ? AND a.status = 'active'
        ORDER BY u.name ASC
    """, (mentor_id,))
    return [dict(row) for row in cursor.fetchall()]


def count_mentees_for_mentor(conn, mentor_id):
    """Count active mentees currently assigned to a mentor."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM mentor_mentee_assignments
        WHERE mentor_id = ? AND status = 'active'
    """, (mentor_id,))
    row = cursor.fetchone()
    return row["count"] if row else 0


def are_mentor_mentee(conn, user1_id, user2_id):
    """
    Check if two users share an active mentor-mentee relationship (either order).
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM mentor_mentee_assignments
        WHERE status = 'active'
          AND ((mentor_id = ? AND mentee_id = ?) OR (mentor_id = ? AND mentee_id = ?))
    """, (user1_id, user2_id, user2_id, user1_id))
    return cursor.fetchone() is not None


if __name__ == "__main__":
    import sys
    reset_flag = "--reset" in sys.argv
    init_db(reset=reset_flag)
    action = "reset and initialized" if reset_flag else "initialized"
    print(f"MentorLink database successfully {action} at: {DB_PATH}")
