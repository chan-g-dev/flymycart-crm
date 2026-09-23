import os
import shutil
import sqlite3
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
db_path = backend_dir / "app.db"
workspace_dir = Path(__file__).resolve().parents[2]

# 1. Clean app.db sqlite vacuum and delete all leftover audit/test logs
conn = sqlite3.connect(db_path)
tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]

preserved_tables = {
    'users', 'user_profiles', 'roles', 'permissions', 'user_roles',
    'role_permissions', 'user_permission_overrides', 'user_center_access',
    'app_sessions', 'user_invitations', 'profile_audit_log', 'system_settings'
}

for table in tables:
    if table not in preserved_tables:
        conn.execute(f"DELETE FROM \"{table}\"")

# Clear audit log of any test actions as well
if 'audit_logs' in tables:
    conn.execute("DELETE FROM \"audit_logs\"")

conn.commit()
conn.execute("VACUUM")
conn.close()

# 2. Remove qa-results directory and all old .db backups
qa_dir = workspace_dir / "qa-results"
if qa_dir.exists():
    shutil.rmtree(qa_dir, ignore_errors=True)

print("Permanently wiped all testing data, cleared and VACUUMed app.db, and removed QA test backups.")
