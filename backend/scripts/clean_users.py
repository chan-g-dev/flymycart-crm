import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import User, Profile, ProfileAuditLog
from app.dependencies import get_supabase_service_client

def clean_all_users_except_chanakya():
    target_email = "chanakyagangabathina77@gmail.com"
    print("=" * 60)
    print(f"CLEANING ALL USERS EXCEPT SUPER ADMIN ({target_email})")
    print("=" * 60)

    # 1. Clean PostgreSQL public.profiles & profile_audit_log
    with engine.begin() as conn:
        # Find Chanakya ID
        row = conn.execute(text("SELECT id FROM public.profiles WHERE email = :email"), {"email": target_email}).fetchone()
        chanakya_id = str(row[0]) if row else "055d37da-38d0-4fe9-9ca3-4b956dede81d"

        # Delete audit logs for other profiles
        conn.execute(text("DELETE FROM public.profile_audit_log WHERE profile_id != :id"), {"id": chanakya_id})
        
        # Delete all other profiles
        deleted_profiles = conn.execute(text("DELETE FROM public.profiles WHERE email != :email RETURNING email"), {"email": target_email}).fetchall()
        print(f"Deleted {len(deleted_profiles)} profiles from Supabase PostgreSQL public.profiles:")
        for dp in deleted_profiles:
            print(f"  - Deleted profile: {dp[0]}")

        # Ensure Chanakya is clean and approved
        conn.execute(text("""
            UPDATE public.profiles
            SET full_name = 'Gangabathina Chanakya',
                role = 'super_admin',
                status = 'approved',
                requested_role = 'super_admin',
                password_hash = '744eeb1d1c3a61c3fb0ad9ef601a4e21a2249c566738221b239b56f8fba3d526',
                approved_by = NULL,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE email = :email
        """), {"email": target_email})

    # 2. Clean users table in local / backend DB
    db = SessionLocal()
    try:
        deleted_users = db.query(User).filter(User.email != target_email).delete(synchronize_session=False)
        
        # Ensure Chanakya user is Active and super_admin
        chanakya_user = db.query(User).filter(User.email == target_email).first()
        if not chanakya_user:
            chanakya_user = User(
                id=f"u_{chanakya_id[:8]}",
                username=target_email,
                name="Gangabathina Chanakya",
                email=target_email,
                password_hash="744eeb1d1c3a61c3fb0ad9ef601a4e21a2249c566738221b239b56f8fba3d526",
                phone="+91 98765 43210",
                role="super_admin",
                center="Main Hub (Bangalore)",
                status="Active",
                is_active=True,
                approved_by="System Root"
            )
            db.add(chanakya_user)
        else:
            chanakya_user.name = "Gangabathina Chanakya"
            chanakya_user.role = "super_admin"
            chanakya_user.status = "Active"
            chanakya_user.is_active = True
            chanakya_user.password_hash = "744eeb1d1c3a61c3fb0ad9ef601a4e21a2249c566738221b239b56f8fba3d526"

        db.commit()
        print(f"Deleted {deleted_users} users from backend users table. Retained only Gangabathina Chanakya.")
    finally:
        db.close()

    # 3. Clean Supabase Auth Users if possible
    try:
        service_client = get_supabase_service_client()
        auth_users = service_client.auth.admin.list_users()
        for u in auth_users:
            if u.email != target_email:
                try:
                    service_client.auth.admin.delete_user(u.id)
                    print(f"Deleted Supabase Auth User: {u.email} ({u.id})")
                except Exception as e:
                    print(f"Notice on deleting auth user {u.email}: {e}")
    except Exception as e:
        print(f"Notice on listing auth users: {e}")

    # 4. Verify DB state
    with engine.begin() as conn:
        active_profiles = conn.execute(text("SELECT id, email, full_name, role, status FROM public.profiles")).fetchall()
        print("\nCURRENT ACTIVE PROFILES IN DB:")
        for p in active_profiles:
            print(f" -> ID: {p[0]} | Email: {p[1]} | Name: {p[2]} | Role: {p[3]} | Status: {p[4]}")
        assert len(active_profiles) == 1, f"Expected exactly 1 profile, found {len(active_profiles)}"
        assert active_profiles[0][1] == target_email

    print("\n" + "=" * 60)
    print("CLEANUP SUCCESSFUL! All users cleaned. From now on, every new registrant enters 'Pending Approval' queue for Gangabathina Chanakya.")
    print("=" * 60)

if __name__ == "__main__":
    clean_all_users_except_chanakya()
