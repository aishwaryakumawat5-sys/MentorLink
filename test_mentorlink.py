"""
MentorLink — Automated Integration and Unit Test Suite
Tests authentication, CSRF security, role permissions, matching logic,
meeting workflows, task tracking, messaging, and feedback.
"""

import os
import unittest
import json
from app import app
from database import init_db, get_db, MAX_MENTEES_PER_MENTOR
from seed import seed_database


class MentorLinkTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = True

    def setUp(self):
        self.client = app.test_client()
        # Seed test database with clean data without spamming logs
        seed_database(verbose=False)

    def get_csrf_token(self):
        """Fetch index page to initialize session and extract CSRF token."""
        response = self.client.get("/")
        with self.client.session_transaction() as sess:
            return sess.get("csrf_token")

    def login(self, email, password):
        """Helper to login a user and return response."""
        csrf_token = self.get_csrf_token()
        return self.client.post(
            "/api/auth/login",
            headers={"X-CSRF-Token": csrf_token},
            data=json.dumps({"email": email, "password": password}),
            content_type="application/json"
        )

    # ==========================================
    # 1. Authentication Tests
    # ==========================================

    def test_login_success_and_session(self):
        res = self.login("admin@mentorlink.edu", "Admin@123")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["user"]["role"], "admin")
        self.assertIn("csrf_token", data)

        with self.client.session_transaction() as sess:
            self.assertEqual(sess["role"], "admin")

    def test_login_invalid_password(self):
        res = self.login("admin@mentorlink.edu", "WrongPassword")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIn("error", data)

    def test_registration_success(self):
        csrf = self.get_csrf_token()
        res = self.client.post(
            "/api/auth/register",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({
                "name": "New Student",
                "email": "new.student@mentorlink.edu",
                "password": "Password@123",
                "role": "mentee",
                "department": "Computer Science",
                "skills": "Python, Flask",
                "interests": "Web Development",
                "bio": "Excited to learn!"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["user"]["email"], "new.student@mentorlink.edu")

    def test_registration_duplicate_email(self):
        csrf = self.get_csrf_token()
        res = self.client.post(
            "/api/auth/register",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({
                "name": "Duplicate Student",
                "email": "alex.rivera@mentorlink.edu",  # already in seed
                "password": "Password@123",
                "role": "mentee"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 409)

    def test_registration_prevents_admin_role(self):
        csrf = self.get_csrf_token()
        res = self.client.post(
            "/api/auth/register",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({
                "name": "Hacker Admin",
                "email": "hacker@test.edu",
                "password": "Password@123",
                "role": "admin"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)

    # ==========================================
    # 2. CSRF Security Enforcement
    # ==========================================

    def test_csrf_token_missing_blocked(self):
        # State-changing request without X-CSRF-Token header
        res = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": "admin@mentorlink.edu", "password": "Admin@123"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("CSRF", res.get_json().get("error", ""))

    def test_csrf_token_invalid_blocked(self):
        res = self.client.post(
            "/api/auth/login",
            headers={"X-CSRF-Token": "invalid_fake_token"},
            data=json.dumps({"email": "admin@mentorlink.edu", "password": "Admin@123"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 403)

    # ==========================================
    # 3. Role-Based Permissions
    # ==========================================

    def test_admin_endpoints_blocked_for_mentee(self):
        self.login("alex.rivera@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        res = self.client.get("/api/admin/users")
        self.assertEqual(res.status_code, 403)

        res = self.client.post(
            "/api/admin/assignments",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"mentor_id": 1, "mentee_id": 2}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 403)

    # ==========================================
    # 4. Matching & Capacity Control
    # ==========================================

    def test_admin_matching_and_unassign(self):
        self.login("admin@mentorlink.edu", "Admin@123")
        csrf = self.get_csrf_token()

        # Find Taylor Kim's ID and Elena's ID
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'taylor.kim@mentorlink.edu'")
            taylor_id = cursor.fetchone()["id"]
            cursor.execute("SELECT id FROM users WHERE email = 'elena.rostova@mentorlink.edu'")
            elena_id = cursor.fetchone()["id"]

        # Assign Taylor to Elena
        res = self.client.post(
            "/api/admin/assignments",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"mentee_id": taylor_id, "mentor_id": elena_id}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)

        # Check assignment exists
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM mentor_mentee_assignments WHERE mentee_id = ?", (taylor_id,))
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            assign_id = row["id"]

        # Unassign
        res_del = self.client.delete(
            f"/api/admin/assignments/{assign_id}",
            headers={"X-CSRF-Token": csrf}
        )
        self.assertEqual(res_del.status_code, 200)

    # ==========================================
    # 5. Meeting Workflow
    # ==========================================

    def test_meeting_workflow(self):
        # Mentee requests meeting
        self.login("alex.rivera@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        res = self.client.post(
            "/api/meetings",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({
                "agenda": "Weekly Sync on Python Tasks",
                "meeting_date": "2026-10-25",
                "meeting_time": "15:00",
                "mode": "online",
                "location_or_link": "https://meet.google.com/test",
                "notes": "Discussing module 2"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        meeting_id = res.get_json()["meeting_id"]

        # Mentor confirms meeting
        self.login("sarah.johnson@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        res_confirm = self.client.put(
            f"/api/meetings/{meeting_id}/status",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"status": "Scheduled"}),
            content_type="application/json"
        )
        self.assertEqual(res_confirm.status_code, 200)

        # Mentor marks complete
        res_complete = self.client.put(
            f"/api/meetings/{meeting_id}/status",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"status": "Completed"}),
            content_type="application/json"
        )
        self.assertEqual(res_complete.status_code, 200)

    # ==========================================
    # 6. Task Management Workflow
    # ==========================================

    def test_task_lifecycle(self):
        # Mentor creates task for Alex
        self.login("sarah.johnson@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'alex.rivera@mentorlink.edu'")
            alex_id = cursor.fetchone()["id"]

        res = self.client.post(
            "/api/tasks",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({
                "mentee_id": alex_id,
                "title": "Build Unit Tests for Modules",
                "description": "Write pytest test cases",
                "due_date": "2026-10-30"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        task_id = res.get_json()["task_id"]

        # Mentee updates status to 'In Progress'
        self.login("alex.rivera@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        res_prog = self.client.put(
            f"/api/tasks/{task_id}/status",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"status": "In Progress"}),
            content_type="application/json"
        )
        self.assertEqual(res_prog.status_code, 200)

        # Mentee marks 'Completed'
        res_done = self.client.put(
            f"/api/tasks/{task_id}/status",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"status": "Completed"}),
            content_type="application/json"
        )
        self.assertEqual(res_done.status_code, 200)

    # ==========================================
    # 7. Direct Messaging & Notifications
    # ==========================================

    def test_messaging_between_paired_users(self):
        self.login("alex.rivera@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'sarah.johnson@mentorlink.edu'")
            sarah_id = cursor.fetchone()["id"]

        # Send message
        res = self.client.post(
            "/api/messages",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"receiver_id": sarah_id, "message": "Hello Dr. Sarah, progress is going great!"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)

        # Mentor reads message
        self.login("sarah.johnson@mentorlink.edu", "Password@123")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'alex.rivera@mentorlink.edu'")
            alex_id = cursor.fetchone()["id"]

        res_get = self.client.get(f"/api/messages?partner_id={alex_id}")
        self.assertEqual(res_get.status_code, 200)
        data = res_get.get_json()
        self.assertGreater(len(data["messages"]), 0)

    def test_messaging_unpaired_users_blocked(self):
        # Alex and Prof. David Chen are not paired
        self.login("alex.rivera@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'david.chen@mentorlink.edu'")
            david_id = cursor.fetchone()["id"]

        res = self.client.post(
            "/api/messages",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({"receiver_id": david_id, "message": "Hi, can you mentor me?"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 403)

    # ==========================================
    # 8. Feedback & Ratings
    # ==========================================

    def test_feedback_submission(self):
        self.login("alex.rivera@mentorlink.edu", "Password@123")
        csrf = self.get_csrf_token()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = 'sarah.johnson@mentorlink.edu'")
            sarah_id = cursor.fetchone()["id"]

        res = self.client.post(
            "/api/feedback",
            headers={"X-CSRF-Token": csrf},
            data=json.dumps({
                "recipient_id": sarah_id,
                "rating": 5,
                "comments": "Dr. Sarah provides incredible, actionable guidance on software development."
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)

    # ==========================================
    # 9. Dashboard Statistics
    # ==========================================

    def test_dashboard_stats(self):
        self.login("admin@mentorlink.edu", "Admin@123")
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["role"], "admin")
        self.assertGreater(data["stats"]["total_users"], 0)


if __name__ == "__main__":
    unittest.main()
