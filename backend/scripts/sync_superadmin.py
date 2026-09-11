import os
import sys
import hashlib

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import Profile, User
from app.auth import hash_password

def execute_sql_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # Connect using raw psycopg2 connection to execute entire script with PL/pgSQL functions cleanly
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        cursor.execute(sql)
        raw_conn.commit()
        cursor.close()
        print(f"Successfully executed {os.path.basename(file_path)} with raw psycopg2 connection.")
    except Exception as e:
        print(f"Error executing SQL file: {e}")
        raw_conn.rollback()
    finally:
        raw_conn.close()

def sync_superadmin():
    admin_email = "chanakyagangabathina77@gmail.com"
    admin_name = "Gangabathina Chanakya"
    admin_pass = "Chanu@1234"
    pass_hash = hash_password(admin_pass)

    with engine.begin() as conn:
        # 1. Downgrade any other super_admin to manager or staff to avoid duplicate super_admin constraint violation
        conn.execute(text("""
            UPDATE public.profiles
            SET role = 'manager'
            WHERE role = 'super_admin' AND email != :email
        """), {"email": admin_email})

        # 2. Ensure Gangabathina Chanakya is super_admin in profiles
        row = conn.execute(text("SELECT id FROM public.profiles WHERE email = :email"), {"email": admin_email}).fetchone()
        if row:
            chanakya_id = str(row[0])
            conn.execute(text("""
                UPDATE public.profiles
                SET full_name = :name,
                    role = 'super_admin',
                    status = 'approved',
                    requested_role = 'super_admin',
                    password_hash = :hash,
                    updated_at = NOW()
                WHERE email = :email
            """), {"name": admin_name, "hash": pass_hash, "email": admin_email})
        else:
            chanakya_id = "055d37da-38d0-4fe9-9ca3-4b956dede81d"
            conn.execute(text("""
                INSERT INTO public.profiles (id, email, full_name, role, status, requested_role, password_hash, created_at, updated_at)
                VALUES (:id, :email, :name, 'super_admin', 'approved', 'super_admin', :hash, NOW(), NOW())
            """), {"id": chanakya_id, "email": admin_email, "name": admin_name, "hash": pass_hash})

    # 3. Now execute schema.sql cleanly
    schema_path = os.path.join(os.path.dirname(__file__), "..", "..", "supabase", "schema.sql")
    execute_sql_file(schema_path)

    # 4. Sync in SQLite/PostgreSQL users table
    db = SessionLocal()
    try:
        user = db.query(User).filter((User.email == admin_email) | (User.username == admin_email)).first()
        if not user:
            user = User(
                id=f"u_{chanakya_id[:8]}",
                username=admin_email,
                name=admin_name,
                email=admin_email,
                password_hash=pass_hash,
                phone="+91 98765 43210",
                role="super_admin",
                center="Main Hub (Bangalore)",
                status="Active",
                is_active=True,
                approved_by="System Root"
            )
            db.add(user)
        else:
            user.name = admin_name
            user.role = "super_admin"
            user.status = "Active"
            user.is_active = True
            user.password_hash = pass_hash

        # Demote any other users with role super_admin in users table to manager
        other_superadmins = db.query(User).filter(User.role == "super_admin", User.email != admin_email).all()
        for osa in other_superadmins:
            osa.role = "manager"

        db.commit()
        print(f"Verified single Super Admin: '{admin_name}' <{admin_email}>.")
    finally:
        db.close()

if __name__ == "__main__":
    sync_superadmin()
