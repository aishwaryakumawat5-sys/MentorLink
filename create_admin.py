"""
MentorLink - Create / Provision Admin Account
Run from the command line:
    python create_admin.py
or with arguments:
    python create_admin.py --name "System Admin" --email "admin@mentorlink.edu" --password "Admin@123"
"""

import sys
import argparse
from werkzeug.security import generate_password_hash
from database import get_db, init_db


def create_or_update_admin(name, email, password):
    init_db(reset=False)
    email = email.strip().lower()
    hashed = generate_password_hash(password)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, role FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE users
                SET name = ?, password_hash = ?, role = 'admin'
                WHERE id = ?
            """, (name, hashed, existing["id"]))
            print(f"[SUCCESS] Admin account for '{email}' updated successfully (ID: {existing['id']}).")
        else:
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, department, bio)
                VALUES (?, ?, ?, 'admin', 'Administration', 'MentorLink System Administrator')
            """, (name, email, hashed))
            print(f"[SUCCESS] Admin account for '{email}' created successfully (ID: {cursor.lastrowid}).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or update a MentorLink administrator account.")
    parser.add_argument("--name", default="System Administrator", help="Admin's display name")
    parser.add_argument("--email", default="admin@mentorlink.edu", help="Admin's login email")
    parser.add_argument("--password", default="Admin@123", help="Admin's secure password")

    args = parser.parse_args()

    # If running interactively without args, prompt user or use defaults
    create_or_update_admin(args.name, args.email, args.password)
