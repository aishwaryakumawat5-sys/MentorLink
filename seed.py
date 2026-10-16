"""
MentorLink - Database Seeding Script
Seeds realistic demo data with Admin, Mentors, Mentees, Assignments,
Meetings, Tasks, Messages, Notifications, and Feedback.
"""

from werkzeug.security import generate_password_hash
from database import get_db, init_db, create_notification


def seed_database(verbose=True):
    if verbose:
        print("Resetting and initializing database...")
    init_db(reset=True)

    default_pw_hash = generate_password_hash("Password@123")
    admin_pw_hash = generate_password_hash("Admin@123")

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Insert Users
        users = [
            # Admin
            ("System Admin", "admin@mentorlink.edu", admin_pw_hash, "admin", "Platform Administration", "System, Security, Governance", "EdTech, Mentorship Analytics", "Lead platform administrator for MentorLink."),
            # Mentors
            ("Dr. Sarah Johnson", "sarah.johnson@mentorlink.edu", default_pw_hash, "mentor", "Computer Science", "Python, Machine Learning, Web Dev, Algorithms", "AI Research, Open Source, Career Mentoring", "Associate Professor of CS with 12+ years mentoring students into software engineering roles."),
            ("Prof. David Chen", "david.chen@mentorlink.edu", default_pw_hash, "mentor", "Software Engineering", "Cloud Computing, DevOps, Go, System Design", "Distributed Systems, Microservices, Kubernetes", "Staff Cloud Architect and adjunct faculty specializing in high-scale infrastructure."),
            ("Elena Rostova", "elena.rostova@mentorlink.edu", default_pw_hash, "mentor", "Product & UX Design", "UI/UX, Figma, User Research, Accessibility", "Design Systems, Inclusive Tech, Interaction Design", "Senior Product Designer passionate about helping early-career designers create stellar portfolios."),
            # Mentees
            ("Alex Rivera", "alex.rivera@mentorlink.edu", default_pw_hash, "mentee", "Computer Science", "Python, HTML/CSS, Git", "Full-Stack Development, Machine Learning", "Junior CS student building full-stack web applications and preparing for tech internships."),
            ("Maya Patel", "maya.patel@mentorlink.edu", default_pw_hash, "mentee", "Software Engineering", "Java, Docker, Linux", "Cloud Engineering, DevOps pipelines", "Sophomore software engineering student eager to master cloud infrastructure."),
            ("Jordan Lee", "jordan.lee@mentorlink.edu", default_pw_hash, "mentee", "Product & UX Design", "Figma, Wireframing, CSS", "Product Strategy, Mobile App UI", "First-year design student building design portfolio projects."),
            ("Taylor Kim", "taylor.kim@mentorlink.edu", default_pw_hash, "mentee", "Data Science", "Python, SQL, Statistics", "Data Visualization, Predictive Analytics", "Transfer student seeking mentorship to kickstart data science research projects.")
        ]

        user_ids = {}
        for name, email, pw, role, dept, skills, interests, bio in users:
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, department, skills, interests, bio)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, email, pw, role, dept, skills, interests, bio))
            user_ids[email] = cursor.lastrowid

        admin_id = user_ids["admin@mentorlink.edu"]
        sarah_id = user_ids["sarah.johnson@mentorlink.edu"]
        david_id = user_ids["david.chen@mentorlink.edu"]
        elena_id = user_ids["elena.rostova@mentorlink.edu"]
        alex_id = user_ids["alex.rivera@mentorlink.edu"]
        maya_id = user_ids["maya.patel@mentorlink.edu"]
        jordan_id = user_ids["jordan.lee@mentorlink.edu"]
        taylor_id = user_ids["taylor.kim@mentorlink.edu"]

        # 2. Mentor-Mentee Assignments
        # Alex -> Sarah
        cursor.execute("INSERT INTO mentor_mentee_assignments (mentor_id, mentee_id) VALUES (?, ?)", (sarah_id, alex_id))
        # Maya -> David
        cursor.execute("INSERT INTO mentor_mentee_assignments (mentor_id, mentee_id) VALUES (?, ?)", (david_id, maya_id))
        # Jordan -> Elena
        cursor.execute("INSERT INTO mentor_mentee_assignments (mentor_id, mentee_id) VALUES (?, ?)", (elena_id, jordan_id))
        # Taylor remains unassigned for admin demonstration!

        # 3. Meetings
        # Meeting 1: Sarah & Alex (Scheduled, Online)
        cursor.execute("""
            INSERT INTO meetings (mentor_id, mentee_id, agenda, meeting_date, meeting_time, mode, location_or_link, status, notes)
            VALUES (?, ?, ?, '2026-10-18', '14:00', 'online', 'https://meet.google.com/abc-mentor-link', 'Scheduled', 'Review project wireframes and database schema design.')
        """, (sarah_id, alex_id, "Sprint 1 Architecture Review & API Design"))

        # Meeting 2: David & Maya (Requested, Offline)
        cursor.execute("""
            INSERT INTO meetings (mentor_id, mentee_id, agenda, meeting_date, meeting_time, mode, location_or_link, status, notes)
            VALUES (?, ?, ?, '2026-10-20', '11:00', 'offline', 'Science Hall, Room 304', 'Requested', 'Discuss Docker containerization setup and CI/CD basics.')
        """, (david_id, maya_id, "DevOps Intro and Container Setup"))

        # Meeting 3: Elena & Jordan (Completed, Online)
        cursor.execute("""
            INSERT INTO meetings (mentor_id, mentee_id, agenda, meeting_date, meeting_time, mode, location_or_link, status, notes)
            VALUES (?, ?, ?, '2026-10-05', '16:00', 'online', 'https://meet.google.com/xyz-mentor-link', 'Completed', 'Completed resume critique and reviewed color palette.')
        """, (elena_id, jordan_id, "Design Portfolio & Typography Critique"))

        # 4. Tasks
        # Sarah for Alex
        cursor.execute("""
            INSERT INTO tasks (mentor_id, mentee_id, title, description, due_date, status)
            VALUES (?, ?, ?, ?, '2026-10-17', 'In Progress')
        """, (sarah_id, alex_id, "Implement User Authentication Endpoints", "Build Flask session login, registration, and password hashing using Werkzeug."))

        cursor.execute("""
            INSERT INTO tasks (mentor_id, mentee_id, title, description, due_date, status)
            VALUES (?, ?, ?, ?, '2026-10-24', 'Pending')
        """, (sarah_id, alex_id, "Set Up SQLite Parameterized Queries", "Connect the database module and write unit tests for mentor assignment."))

        # David for Maya
        cursor.execute("""
            INSERT INTO tasks (mentor_id, mentee_id, title, description, due_date, status)
            VALUES (?, ?, ?, ?, '2026-10-19', 'Pending')
        """, (david_id, maya_id, "Write Dockerfile for Multi-Stage Build", "Create an optimized production container image with minimal layer caching."))

        # Elena for Jordan
        cursor.execute("""
            INSERT INTO tasks (mentor_id, mentee_id, title, description, due_date, status)
            VALUES (?, ?, ?, ?, '2026-10-08', 'Completed')
        """, (elena_id, jordan_id, "High-Fidelity Mobile Navigation Wireframes", "Design responsive navbar and mobile bottom sheet components in Figma."))

        # 5. Messages
        # Sarah & Alex
        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, message, is_read, created_at)
            VALUES (?, ?, 'Hi Alex! Welcome to the mentorship cycle. Take a look at the first assigned task on authentication.', 1, datetime('now', '-2 days'))
        """, (sarah_id, alex_id))

        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, message, is_read, created_at)
            VALUES (?, ?, 'Thank you Dr. Sarah! I have already started reading the Werkzeug docs and scheduled our review session.', 1, datetime('now', '-1 day'))
        """, (alex_id, sarah_id))

        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, message, is_read, created_at)
            VALUES (?, ?, 'Great job! Let me know if you run into any session security questions.', 0, datetime('now', '-2 hours'))
        """, (sarah_id, alex_id))

        # David & Maya
        cursor.execute("""
            INSERT INTO messages (sender_id, receiver_id, message, is_read, created_at)
            VALUES (?, ?, 'Hello Maya, looking forward to our in-person session in Science Hall Room 304!', 1, datetime('now', '-1 day'))
        """, (david_id, maya_id))

        # 6. Feedback
        cursor.execute("""
            INSERT INTO feedback (author_id, recipient_id, rating, comments, created_at)
            VALUES (?, ?, 5, 'Dr. Sarah has been an outstanding mentor. Her code review feedback on my database design was incredibly thorough and encouraging!', datetime('now', '-3 days'))
        """, (alex_id, sarah_id))

        cursor.execute("""
            INSERT INTO feedback (author_id, recipient_id, rating, comments, created_at)
            VALUES (?, ?, 5, 'Alex is proactive, asks insightful questions, and delivers code ahead of deadlines. Pleasure to mentor!', datetime('now', '-2 days'))
        """, (sarah_id, alex_id))

        cursor.execute("""
            INSERT INTO feedback (author_id, recipient_id, rating, comments, created_at)
            VALUES (?, ?, 5, 'Elena helped me build confidence in design tokens and typography hierarchy. Highly recommend!', datetime('now', '-4 days'))
        """, (jordan_id, elena_id))

        # 7. Notifications
        create_notification(conn, alex_id, "Mentor Assigned", "You were assigned to Dr. Sarah Johnson.", "assignment")
        create_notification(conn, sarah_id, "New Mentee Assigned", "Alex Rivera was assigned as your mentee.", "assignment")
        create_notification(conn, alex_id, "Meeting Scheduled", "Dr. Sarah Johnson scheduled 'Sprint 1 Architecture Review & API Design'.", "meeting")
        create_notification(conn, maya_id, "Task Assigned", "Prof. David Chen assigned a new task: Write Dockerfile for Multi-Stage Build.", "task")
        create_notification(conn, sarah_id, "Feedback Received", "Alex Rivera gave you a 5-star rating!", "feedback")

        # 8. AI Skill-Gap Detective Data
        cursor.execute("""
            INSERT INTO skill_assessments (user_id, skill_name, score, status, recommended_activity)
            VALUES 
            (?, 'Flask Session Security & CSRF', 54, 'gap_detected', 'Complete Flask-WTF CSRF Token Implementation Lab and review Werkzeug session cookies.'),
            (?, 'SQLite Parameterized Queries', 62, 'gap_detected', 'Practice parameterized SQL queries using ? placeholders to prevent SQL injection vulnerabilities.'),
            (?, 'Python Algorithms & Data Structures', 88, 'proficient', 'Advance to Graph Traversal, Binary Search Trees, and Dynamic Programming challenges.'),
            (?, 'Docker Multi-Stage Optimization', 58, 'gap_detected', 'Complete Docker layer caching and Alpine Linux image reduction exercise.'),
            (?, 'Linux Shell Scripting & Automation', 85, 'proficient', 'Build automated CI/CD deployment scripts with GitHub Actions and bash.')
        """, (alex_id, alex_id, alex_id, maya_id, maya_id))

        # 9. Adaptive Mentoring Roadmap Data
        cursor.execute("""
            INSERT INTO adaptive_roadmaps (mentee_id, mentor_id, week_number, goal_title, target_skill, adjusted_reason, status)
            VALUES
            (?, ?, 1, 'Master Password Hashing & Session Cookies', 'Web Security', 'Baseline diagnostic identified auth vulnerability gap; prioritized upfront.', 'Completed'),
            (?, ?, 2, 'Build Parameterized SQLite Transactions', 'Database Design', 'Adapted after code review: added contextmanager exception rollback exercises.', 'In Progress'),
            (?, ?, 3, 'Deploy CSRF Token Headers with Fetch API', 'API Integration', 'Adjusted weekly schedule to align with upcoming college project demo.', 'Pending'),
            (?, ?, 4, 'Comprehensive Unit Testing with unittest', 'Software Quality', 'Final milestone sprint for project verification and grading prep.', 'Pending'),
            (?, ?, 1, 'Docker Container Multi-Stage Builds', 'DevOps', 'Tailored based on student request for containerization foundations.', 'In Progress')
        """, (alex_id, sarah_id, alex_id, sarah_id, alex_id, sarah_id, alex_id, sarah_id, maya_id, david_id))

        # 10. Early Support Signal Engine Data
        cursor.execute("""
            INSERT INTO support_signals (mentee_id, mentor_id, signal_type, severity, title, details, is_resolved)
            VALUES
            (?, ?, 'missed_assignment', 'medium', 'Assignment Deadline Approaching', 'Alex has an active milestone "Set Up SQLite Parameterized Queries" due in 48 hours. Consider a quick check-in sync.', 0),
            (?, ?, 'skill_struggle', 'high', 'Skill Gap Detected in CSRF Protection', 'Diagnostic assessment showed 54% score in Flask Session Security. Mentee would benefit from focused 1-on-1 code review.', 0),
            (?, ?, 'low_activity', 'low', 'Check-in Cadence Recommended', 'Maya completed her Dockerfile milestone; schedule next weekly consultation to sustain momentum.', 0)
        """, (alex_id, sarah_id, alex_id, sarah_id, maya_id, david_id))

        # 11. Mentoring Impact Analyzer Data
        cursor.execute("""
            INSERT INTO impact_metrics (mentee_id, mentor_id, baseline_score, current_score, improvement_pct, sessions_attended, tasks_completed, impact_summary)
            VALUES
            (?, ?, 46, 88, 42, 4, 3, '+42% Overall Mastery. Exceptional acceleration in Web Security, SQLite ACID Transactions, and JavaScript Fetch API.'),
            (?, ?, 52, 86, 34, 3, 2, '+34% Cloud Engineering Growth. Successfully mastered multi-stage Docker builds and automated Linux deployment pipelines.'),
            (?, ?, 50, 92, 42, 4, 4, '+42% Product Design Excellence. Advanced from basic wireframes to high-fidelity design systems and responsive token hierarchy.')
        """, (alex_id, sarah_id, maya_id, david_id, jordan_id, elena_id))

    if verbose:
        print("[SUCCESS] Database seeded successfully with demo accounts and records!")
        print("\n--- Demo Login Credentials ---")
        print("Admin:   admin@mentorlink.edu / Admin@123")
        print("Mentor:  sarah.johnson@mentorlink.edu / Password@123")
        print("Mentor:  david.chen@mentorlink.edu / Password@123")
        print("Mentor:  elena.rostova@mentorlink.edu / Password@123")
        print("Mentee:  alex.rivera@mentorlink.edu / Password@123 (Assigned to Dr. Sarah)")
        print("Mentee:  maya.patel@mentorlink.edu / Password@123 (Assigned to Prof. David)")
        print("Mentee:  jordan.lee@mentorlink.edu / Password@123 (Assigned to Elena)")
        print("Mentee:  taylor.kim@mentorlink.edu / Password@123 (Unassigned - ready for Admin match)")


if __name__ == "__main__":
    seed_database()
