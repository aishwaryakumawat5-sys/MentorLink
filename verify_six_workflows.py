"""
MentorLink — Explicit Six-Workflow Verification Script
Verifies that all 6 specific requested workflows are 100% functional:
1. Admin assigns a mentee to an available mentor, respecting capacity.
2. Mentee requests a meeting; mentor confirms or rejects it.
3. Mentor creates a task; mentee updates its status.
4. Mentor and mentee send and receive persistent messages.
5. Users submit and view real star ratings and feedback.
6. Admin, mentor, and mentee have separate permissions and working dashboards.
"""

import json
from app import app
from database import get_db, init_db, count_mentees_for_mentor, MAX_MENTEES_PER_MENTOR
from seed import seed_database


def run_verification():
    print("=" * 65)
    print("MENTORLINK SIX WORKFLOWS VERIFICATION")
    print("=" * 65)

    client = app.test_client()

    # Step 0: Ensure pristine seeded database
    seed_database(verbose=False)

    def get_csrf(session_client):
        session_client.get("/")
        with session_client.session_transaction() as sess:
            return sess.get("csrf_token")

    def login_user(email, password):
        c = app.test_client()
        csrf = get_csrf(c)
        res = c.post(
            "/api/auth/login",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"email": email, "password": password}),
            content_type="application/json"
        )
        assert res.status_code == 200, f"Login failed for {email}: {res.get_json()}"
        new_csrf = res.get_json().get("csrf_token") or csrf
        return c, new_csrf

    # -------------------------------------------------------------
    # Workflow 1: Admin assigns a mentee to an available mentor, respecting capacity
    # -------------------------------------------------------------
    print("\n[Workflow 1] Testing Admin Assignment & Capacity Enforcement...")
    admin_client, admin_csrf = login_user("admin@mentorlink.edu", "Admin@123")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = 'taylor.kim@mentorlink.edu'")
        taylor_id = cursor.fetchone()["id"]
        cursor.execute("SELECT id FROM users WHERE email = 'sarah.johnson@mentorlink.edu'")
        sarah_id = cursor.fetchone()["id"]
        cursor.execute("SELECT id FROM users WHERE email = 'elena.rostova@mentorlink.edu'")
        elena_id = cursor.fetchone()["id"]

    # 1a: Assign Taylor to Elena
    res_assign = admin_client.post(
        "/api/admin/assignments",
        headers={"X-CSRF-Token": admin_csrf},
        data=json.dumps({"mentee_id": taylor_id, "mentor_id": elena_id}),
        content_type="application/json"
    )
    assert res_assign.status_code == 200, f"Assignment failed: {res_assign.get_json()}"
    print("  -> Admin assigned mentee (Taylor Kim) to mentor (Elena Rostova): SUCCESS")

    # 1b: Verify capacity limit (Max 5 mentees)
    with get_db() as conn:
        cursor = conn.cursor()
        # Seed 4 more dummy mentees assigned to Elena to reach capacity 5
        for i in range(1, 5):
            cursor.execute("""
                INSERT OR IGNORE INTO users (name, email, password_hash, role)
                VALUES (?, ?, 'hash', 'mentee')
            """, (f"Capacity Student {i}", f"cap{i}@test.edu"))
            dummy_id = cursor.lastrowid
            cursor.execute("""
                INSERT OR IGNORE INTO mentor_mentee_assignments (mentor_id, mentee_id)
                VALUES (?, ?)
            """, (elena_id, dummy_id))

        elena_count = count_mentees_for_mentor(conn, elena_id)
        assert elena_count >= MAX_MENTEES_PER_MENTOR, f"Expected Elena to have {MAX_MENTEES_PER_MENTOR} mentees, found {elena_count}"

        # Insert 6th student
        cursor.execute("""
            INSERT OR IGNORE INTO users (name, email, password_hash, role)
            VALUES ('Overflow Student', 'overflow@test.edu', 'hash', 'mentee')
        """,)
        overflow_id = cursor.lastrowid

    # Try assigning 6th student to Elena -> Must be blocked!
    res_overflow = admin_client.post(
        "/api/admin/assignments",
        headers={"X-CSRF-Token": admin_csrf},
        data=json.dumps({"mentee_id": overflow_id, "mentor_id": elena_id}),
        content_type="application/json"
    )
    assert res_overflow.status_code == 400, "Capacity limit was not enforced!"
    assert "maximum capacity" in res_overflow.get_json().get("error", "").lower()
    print(f"  -> Capacity enforcement prevented exceeding {MAX_MENTEES_PER_MENTOR} mentees: SUCCESS")

    # -------------------------------------------------------------
    # Workflow 2: Mentee requests a meeting; mentor confirms or rejects it
    # -------------------------------------------------------------
    print("\n[Workflow 2] Testing Meeting Request & Mentor Confirmation/Rejection...")
    alex_client, alex_csrf = login_user("alex.rivera@mentorlink.edu", "Password@123")
    sarah_client, sarah_csrf = login_user("sarah.johnson@mentorlink.edu", "Password@123")

    # 2a: Mentee requests meeting
    res_req = alex_client.post(
        "/api/meetings",
        headers={"X-CSRF-Token": alex_csrf},
        data=json.dumps({
            "agenda": "Sprint 2 Code Review",
            "meeting_date": "2026-10-28",
            "meeting_time": "14:30",
            "mode": "online",
            "location_or_link": "https://meet.google.com/test-sprint",
            "notes": "Review database indexes"
        }),
        content_type="application/json"
    )
    assert res_req.status_code == 201, f"Meeting request failed: {res_req.get_json()}"
    meeting_id = res_req.get_json()["meeting_id"]
    print("  -> Mentee requested meeting: SUCCESS (Status: Requested)")

    # 2b: Mentor confirms meeting
    res_conf = sarah_client.put(
        f"/api/meetings/{meeting_id}/status",
        headers={"X-CSRF-Token": sarah_csrf},
        data=json.dumps({"status": "Scheduled"}),
        content_type="application/json"
    )
    assert res_conf.status_code == 200, f"Mentor confirmation failed: {res_conf.get_json()}"
    print("  -> Mentor confirmed meeting: SUCCESS (Status: Scheduled)")

    # 2c: Mentor rejects/cancels meeting
    res_cancel = sarah_client.put(
        f"/api/meetings/{meeting_id}/status",
        headers={"X-CSRF-Token": sarah_csrf},
        data=json.dumps({"status": "Cancelled"}),
        content_type="application/json"
    )
    assert res_cancel.status_code == 200
    print("  -> Mentor rejected/cancelled meeting: SUCCESS (Status: Cancelled)")

    # -------------------------------------------------------------
    # Workflow 3: Mentor creates a task; mentee updates its status
    # -------------------------------------------------------------
    print("\n[Workflow 3] Testing Task Creation & Mentee Status Updates...")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = 'alex.rivera@mentorlink.edu'")
        alex_id = cursor.fetchone()["id"]

    # 3a: Mentor creates task
    res_task = sarah_client.post(
        "/api/tasks",
        headers={"X-CSRF-Token": sarah_csrf},
        data=json.dumps({
            "mentee_id": alex_id,
            "title": "Complete Database Migration Script",
            "description": "Write migration script for SQLite schema update",
            "due_date": "2026-10-31"
        }),
        content_type="application/json"
    )
    assert res_task.status_code == 201, f"Task creation failed: {res_task.get_json()}"
    task_id = res_task.get_json()["task_id"]
    print("  -> Mentor created task for mentee: SUCCESS (Status: Pending)")

    # 3b: Mentee updates to 'In Progress'
    res_task_prog = alex_client.put(
        f"/api/tasks/{task_id}/status",
        headers={"X-CSRF-Token": alex_csrf},
        data=json.dumps({"status": "In Progress"}),
        content_type="application/json"
    )
    assert res_task_prog.status_code == 200
    print("  -> Mentee updated task status to 'In Progress': SUCCESS")

    # 3c: Mentee marks 'Completed'
    res_task_done = alex_client.put(
        f"/api/tasks/{task_id}/status",
        headers={"X-CSRF-Token": alex_csrf},
        data=json.dumps({"status": "Completed"}),
        content_type="application/json"
    )
    assert res_task_done.status_code == 200
    print("  -> Mentee updated task status to 'Completed': SUCCESS")

    # -------------------------------------------------------------
    # Workflow 4: Mentor and mentee send and receive persistent messages
    # -------------------------------------------------------------
    print("\n[Workflow 4] Testing Direct Persistent Messaging...")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = 'sarah.johnson@mentorlink.edu'")
        sarah_id = cursor.fetchone()["id"]

    # 4a: Mentee sends message to Mentor
    msg_text_1 = "Hello Dr. Sarah, I've just finished the database migration!"
    res_msg1 = alex_client.post(
        "/api/messages",
        headers={"X-CSRF-Token": alex_csrf},
        data=json.dumps({"receiver_id": sarah_id, "message": msg_text_1}),
        content_type="application/json"
    )
    assert res_msg1.status_code == 201
    print("  -> Mentee sent persistent message: SUCCESS")

    # 4b: Mentor retrieves conversation and verifies persistence
    res_get_msgs = sarah_client.get(f"/api/messages?partner_id={alex_id}")
    assert res_get_msgs.status_code == 200
    msgs = res_get_msgs.get_json()["messages"]
    assert any(m["message"] == msg_text_1 for m in msgs), "Sent message was not persisted in database!"
    print("  -> Mentor received and read message from SQLite: SUCCESS")

    # 4c: Mentor replies
    msg_text_2 = "Excellent work Alex, reviewed and looks clean!"
    res_msg2 = sarah_client.post(
        "/api/messages",
        headers={"X-CSRF-Token": sarah_csrf},
        data=json.dumps({"receiver_id": alex_id, "message": msg_text_2}),
        content_type="application/json"
    )
    assert res_msg2.status_code == 201
    print("  -> Mentor sent persistent reply: SUCCESS")

    # -------------------------------------------------------------
    # Workflow 5: Users submit and view real star ratings and feedback
    # -------------------------------------------------------------
    print("\n[Workflow 5] Testing Ratings & Feedback Submission...")
    # 5a: Mentee submits 5-star review
    res_fb = alex_client.post(
        "/api/feedback",
        headers={"X-CSRF-Token": alex_csrf},
        data=json.dumps({
            "recipient_id": sarah_id,
            "rating": 5,
            "comments": "Dr. Sarah's guidance on system design was transformative for my technical skills."
        }),
        content_type="application/json"
    )
    assert res_fb.status_code == 201
    print("  -> Mentee submitted 5-star rating and written review: SUCCESS")

    # 5b: Mentor views feedback history
    res_get_fb = sarah_client.get("/api/feedback")
    assert res_get_fb.status_code == 200
    feedbacks = res_get_fb.get_json()["feedback"]
    assert any(f["rating"] == 5 and "transformative" in f["comments"] for f in feedbacks)
    print("  -> Mentor retrieved feedback list with verified star rating: SUCCESS")

    # -------------------------------------------------------------
    # Workflow 6: Separate permissions and working dashboards
    # -------------------------------------------------------------
    print("\n[Workflow 6] Testing Role Permissions & Dashboard Isolation...")
    # 6a: Mentee is blocked from admin endpoints
    res_blocked = alex_client.get("/api/admin/users")
    assert res_blocked.status_code == 403, "Permission leak! Mentee accessed admin endpoint."

    res_blocked_assign = alex_client.post(
        "/api/admin/assignments",
        headers={"X-CSRF-Token": alex_csrf},
        data=json.dumps({"mentee_id": alex_id, "mentor_id": sarah_id}),
        content_type="application/json"
    )
    assert res_blocked_assign.status_code == 403, "Permission leak! Mentee accessed assignment endpoint."
    print("  -> Role-based access control blocked unauthorized mentee actions: SUCCESS")

    # 6b: Admin dashboard returns admin stats
    res_admin_dash = admin_client.get("/api/dashboard/stats")
    assert res_admin_dash.status_code == 200
    assert res_admin_dash.get_json()["role"] == "admin"
    print("  -> Admin dashboard data verified: SUCCESS")

    # 6c: Mentor dashboard returns mentor stats
    res_mentor_dash = sarah_client.get("/api/dashboard/stats")
    assert res_mentor_dash.status_code == 200
    assert res_mentor_dash.get_json()["role"] == "mentor"
    assert "mentees" in res_mentor_dash.get_json()
    print("  -> Mentor dashboard data verified: SUCCESS")

    # 6d: Mentee dashboard returns mentee stats
    res_mentee_dash = alex_client.get("/api/dashboard/stats")
    assert res_mentee_dash.status_code == 200
    assert res_mentee_dash.get_json()["role"] == "mentee"
    assert "mentor" in res_mentee_dash.get_json()
    print("  -> Mentee dashboard data verified: SUCCESS")

    print("\n" + "=" * 65)
    print("ALL SIX WORKFLOWS ARE FULLY IMPLEMENTED, VERIFIED, AND FUNCTIONAL!")
    print("=" * 65)


if __name__ == "__main__":
    run_verification()
