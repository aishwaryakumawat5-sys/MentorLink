# MentorLink — Modern Mentorship Platform

MentorLink is a complete, full-stack web application built from scratch to connect mentors with mentees. Users can manage profiles, arrange online/offline meetings, assign and track tasks, exchange direct messages, give star ratings and written reviews, and receive in-app notifications.

---

## 🚀 Technology Stack

- **Backend:** Python 3 with **Flask**
- **Database:** **SQLite** using Python's built-in `sqlite3` module (with `PRAGMA foreign_keys = ON;`)
- **Frontend:** HTML5, modern CSS3 (custom variables, responsive grid, flexbox), and vanilla JavaScript
- **Authentication:** Flask sessions with **Werkzeug** secure password hashing
- **Security:** Built-in session-based CSRF protection, input validation, role-based access control, parameterized queries
- **API Communication:** JavaScript Fetch API with JSON payloads
- **Environment:** Antigravity / Windows compatible

---

## 📁 Project Structure

```text
MentorLink/
├── app.py               # Flask application routes, APIs, CSRF, and security logic
├── database.py          # SQLite connection, schema tables, indexes, and queries
├── seed.py              # Realistic sample data seed script (Admin, Mentors, Mentees)
├── create_admin.py      # CLI utility to provision or update administrator accounts
├── requirements.txt     # Python dependencies (Flask, Werkzeug)
├── README.md            # Documentation and setup instructions
├── .gitignore           # Ignored files (database, cache, virtual environment)
├── instance/
│   └── mentorlink.db    # SQLite database file (created automatically)
├── templates/
│   ├── base.html        # Main Jinja layout with responsive navbar & notifications
│   ├── index.html       # Landing page with feature showcase & demo account quick fills
│   ├── login.html       # Sign-in page with instant one-click demo credentials
│   ├── register.html    # Registration page for Mentors and Mentees
│   └── dashboard.html   # Modular, tabbed dashboard for Admin, Mentor, and Mentee
└── static/
    ├── css/
    │   └── style.css    # Modern UI design system (Indigo/Purple palette, responsive cards)
    └── js/
        └── app.js       # Fetch API client, modal dialogs, toasts, live chat, and tabs
```

---

## ⚡ Quick Start Guide (Windows)

Follow these simple steps in PowerShell or Command Prompt:

### 1. Open Terminal and Navigate to Project Directory
```powershell
cd C:\Users\ASUS\.gemini\antigravity\scratch\MentorLink
```

### 2. Install Required Dependencies
MentorLink only requires `Flask` and `Werkzeug`:
```powershell
python -m pip install -r requirements.txt
```

### 3. Initialize & Seed the Database
Populate the database with ready-to-test demo users, meetings, tasks, and messages:
```powershell
python seed.py
```
*(Alternatively, initialize an empty database using `python database.py`)*

### 4. Run the Web Application
```powershell
python app.py
```
Open your browser and visit: **`http://127.0.0.1:5000`**

---

## 🔑 Pre-Configured Demo Accounts

For testing and grading demonstrations, the following accounts are pre-seeded:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `admin@mentorlink.edu` | `Admin@123` | Full administrative governance & matching control |
| **🧑‍🏫 Mentor** | `sarah.johnson@mentorlink.edu` | `Password@123` | Dr. Sarah Johnson (Computer Science) |
| **🧑‍🏫 Mentor** | `david.chen@mentorlink.edu` | `Password@123` | Prof. David Chen (Software Engineering) |
| **🧑‍🏫 Mentor** | `elena.rostova@mentorlink.edu` | `Password@123` | Elena Rostova (Product & UX Design) |
| **🎓 Mentee** | `alex.rivera@mentorlink.edu` | `Password@123` | Assigned to Dr. Sarah Johnson |
| **🎓 Mentee** | `maya.patel@mentorlink.edu` | `Password@123` | Assigned to Prof. David Chen |
| **🎓 Mentee** | `jordan.lee@mentorlink.edu` | `Password@123` | Assigned to Elena Rostova |
| **🎓 Mentee** | `taylor.kim@mentorlink.edu` | `Password@123` | **Unassigned** (Ready for Admin to match) |

> 💡 **Tip:** On the Sign In page (`/login`), click the quick demo buttons (e.g. **Admin**, **Mentor**, or **Mentee**) to automatically populate credentials!

---

## 🛠️ Key Features by Role

### 1. Administrator
- **KPI Overview:** Live platform statistics (Total Users, Mentors, Mentees, Active Pairings, Meetings, Tasks).
- **Users Directory:** Search, view, and filter users by role (`Admin`, `Mentor`, `Mentee`).
- **Matching Center:** Pair mentees with mentors. Enforces a **maximum limit of 5 mentees per mentor**. Reassign or unassign with automatic notifications.
- **Global Overview:** Inspect all meetings and tasks across the platform.

### 2. Mentor
- **Assigned Mentees:** View student profiles, field of study, skills, interests, and biographies.
- **Meeting Management:** Schedule meetings directly or confirm/decline requests from mentees. Mark completed sessions.
- **Task Management:** Create action items with titles, guidelines, and due dates. Inspect progress in real time.
- **Direct Messaging:** Authenticated chat with assigned mentees.
- **Ratings & Reviews:** View average star rating and written feedback received.

### 3. Mentee
- **Mentor Profile:** View assigned mentor's background, expertise, and contact information.
- **Request Meetings:** Request sessions by providing an agenda, date, time, and mode (Online with URL or In-Person campus room).
- **Update Tasks:** Change task status dynamically (`Pending` ➔ `In Progress` ➔ `Completed`).
- **Direct Messaging:** Chat directly with your assigned faculty mentor.
- **Submit Feedback:** Rate mentor on a 1–5 scale with written comments.

---

## 🛡️ Security & Architecture Best Practices

- **Password Hashing:** Passwords are never stored in plaintext; hashed using Werkzeug's secure hashing algorithm (`generate_password_hash`).
- **Session-Based CSRF Protection:** Every session receives a cryptographically secure token (`secrets.token_hex(32)`). All state-changing requests (`POST`, `PUT`, `DELETE`) require the `X-CSRF-Token` header.
- **Cookie Hardening:** Session cookies are configured with `HttpOnly=True` and `SameSite=Lax`.
- **Parameterized SQL Queries:** Prevents SQL injection by passing query parameters as tuples (`?` placeholders) throughout `database.py` and `app.py`.
- **Role-Based Authorization:** Server-side decorators (`@login_required`, `@role_required`) protect every API endpoint.
- **Relationship Integrity:** Foreign keys are enforced (`PRAGMA foreign_keys = ON;`). Messaging, meeting scheduling, and feedback are strictly restricted to authorized pairings.

---

## ⚙️ Administration & Database CLI Commands

### Create a Custom Administrator
```powershell
python create_admin.py --name "Platform Admin" --email "superadmin@mentorlink.edu" --password "SecurePass@2026"
```

### Reset Database Cleanly
To drop all tables and recreate an empty database:
```powershell
python database.py --reset
```

### Re-seed Demo Data
To re-initialize with complete demo records:
```powershell
python seed.py
```
