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
    admin_email = "admin@flymycart.com"
    admin_name = "Fly My Cart"
    admin_pass = "flymycart@2190"
    pass_hash = hash_password(admin_pass)

    # 1. Update Supabase profiles table if it exists
    is_postgres = "postgres" in (engine.url.drivername or "")
    if is_postgres:
        try:
            with engine.begin() as conn:
                conn.execute(text("""
                    UPDATE public.profiles
                    SET role = 'manager'
                    WHERE role = 'super_admin' AND email != :email
                """), {"email": admin_email})

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
        except Exception as e:
            print(f"Supabase profiles sync skipped/failed: {e}")

    # 2. Master sync in UserProfile and legacy User tables
    db = SessionLocal()
    try:
        from app.seed import seed_super_admin
        seed_super_admin(db)
        print(f"Verified Super Admin: '{admin_name}' <{admin_email}>.")
    finally:
        db.close()

if __name__ == "__main__":
    sync_superadmin()
