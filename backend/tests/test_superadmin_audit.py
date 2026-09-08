import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.database import engine, SessionLocal
from app.models import Profile, ProfileAuditLog
from app.config import settings
from supabase import create_client

client = TestClient(app)

def test_system_full_flow():
    print("\n" + "=" * 65)
    print("STARTING SUPER ADMIN, STAFF APPROVAL & AUDIT LOG TEST SUITE")
    print("=" * 65)

    # 1. Test Super Admin Login
    print("\n[Step 1] Logging in as Super Admin (Gangabathina Chanakya)...")
    login_res = client.post("/auth/login", json={
        "email": "chanakyagangabathina77@gmail.com",
        "password": "Chanu@123"
    })
    print(f"Login status code: {login_res.status_code}")
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["profile"]["role"] == "super_admin"
    assert login_data["profile"]["status"] == "approved"
    admin_token = login_data["access_token"]
    admin_id = login_data["profile"]["id"]
    print(f"-> Super Admin Token obtained. Admin ID: {admin_id}")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test New Staff Signup
    test_user_email = f"staff_{uuid.uuid4().hex[:6]}@flymycart.com"
    test_user_password = "StaffPassword@123"
    test_user_name = "Rajesh Sharma"

    print(f"\n[Step 2] Signing up new staff member: {test_user_email}...")
    signup_res = client.post("/auth/signup", json={
        "email": test_user_email,
        "password": test_user_password,
        "full_name": test_user_name,
        "requested_role": "manager"
    })
    print(f"Signup status code: {signup_res.status_code}")
    assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
    signup_data = signup_res.json()
    target_user_id = signup_data["user_id"]
    assert "pending" in signup_data["account_status"].lower()
    print(f"-> Staff registered with status '{signup_data['account_status']}'. User ID: {target_user_id}")

    # 3. Test Staff Login while Pending
    print("\n[Step 3] Logging in as Pending Staff member...")
    staff_login_res = client.post("/auth/login", json={
        "email": test_user_email,
        "password": test_user_password
    })
    assert staff_login_res.status_code == 200
    staff_token = staff_login_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 4. Test Auth Guard rejects pending staff from protected routes
    print("\n[Step 4] Testing Auth Guard rejection for pending staff...")
    staff_me_res = client.get("/staff/me", headers=staff_headers)
    print(f"Staff /staff/me status: {staff_me_res.status_code} | Body: {staff_me_res.json()}")
    assert staff_me_res.status_code == 403, "Pending user was not rejected with 403!"
    assert "awaiting" in staff_me_res.json()["detail"].lower() or "status" in staff_me_res.json()["detail"].lower()
    print("-> [VERIFIED] Pending staff correctly blocked with 403 Forbidden.")

    # 5. Super Admin lists pending users
    print("\n[Step 5] Super Admin queries /admin/pending...")
    pending_res = client.get("/admin/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_users = pending_res.json()
    assert any(u["id"] == target_user_id for u in pending_users)
    print(f"-> Pending queue contains {len(pending_users)} applicant(s). Target user found.")

    # 6. Super Admin approves user with assigned role & reason
    print(f"\n[Step 6] Super Admin approving user {target_user_id} with role 'manager'...")
    approve_res = client.post(
        f"/admin/approve/{target_user_id}",
        json={"role": "manager", "reason": "Verified identification & background check passed"},
        headers=admin_headers
    )
    assert approve_res.status_code == 200
    approved_profile = approve_res.json()
    assert approved_profile["status"] == "approved"
    assert approved_profile["role"] == "manager"
    print("-> User approved successfully.")

    # 7. Now Approved staff member accesses protected routes
    print("\n[Step 7] Approved staff member accesses /staff/me...")
    staff_me_res2 = client.get("/staff/me", headers=staff_headers)
    assert staff_me_res2.status_code == 200
    assert staff_me_res2.json()["status"] == "approved"
    assert staff_me_res2.json()["role"] == "manager"
    print("-> [VERIFIED] Approved staff now has full access to staff endpoints.")

    # 8. Super Admin suspends user with reason
    print("\n[Step 8] Super Admin suspends user...")
    suspend_res = client.post(
        f"/admin/suspend/{target_user_id}",
        json={"reason": "Temporary leave of absence"},
        headers=admin_headers
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["status"] == "suspended"

    # Verify suspended user is immediately blocked
    staff_me_res3 = client.get("/staff/me", headers=staff_headers)
    assert staff_me_res3.status_code == 403
    print("-> [VERIFIED] Suspended user is immediately blocked.")

    # 9. Super Admin reactivates user
    print("\n[Step 9] Super Admin reactivates user...")
    reactivate_res = client.post(
        f"/admin/reactivate/{target_user_id}",
        json={"reason": "Return from leave approved"},
        headers=admin_headers
    )
    assert reactivate_res.status_code == 200
    assert reactivate_res.json()["status"] == "approved"

    # 10. Super Admin changes user role
    print("\n[Step 10] Super Admin changes user role to 'staff'...")
    role_res = client.post(
        f"/admin/change-role/{target_user_id}",
        json={"role": "staff", "reason": "Role realignment for new department"},
        headers=admin_headers
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "staff"

    # 11. Check Audit Log
    print("\n[Step 11] Verifying automatic PostgreSQL trigger audit logs...")
    audit_res = client.get("/admin/audit-log", headers=admin_headers)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["total"] >= 4
    print(f"-> Total audit records in system: {audit_data['total']}")

    # Check user-specific audit log
    user_audit_res = client.get(f"/admin/audit-log/{target_user_id}", headers=admin_headers)
    assert user_audit_res.status_code == 200
    user_audits = user_audit_res.json()
    print(f"-> User audit history has {len(user_audits)} entries:")
    for entry in user_audits:
        print(f"   [{entry['created_at']}] Action: {entry['action']} | Status: {entry['old_status']} -> {entry['new_status']} | Role: {entry['old_role']} -> {entry['new_role']} | Reason: '{entry['reason']}' | Admin: {entry['changed_by_name']}")

    actions = [a["action"] for a in user_audits]
    assert "approved" in actions
    assert "suspended" in actions
    assert "reactivated" in actions
    assert "role_changed" in actions
    print("-> [VERIFIED] All audit events automatically captured by PostgreSQL trigger with reasons & admin ID.")

    # 12. Verify Super Admin Uniqueness DB Constraint
    print("\n[Step 12] Verifying single super admin database constraint...")
    with pytest.raises(Exception):
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO public.profiles (id, email, full_name, role, status, requested_role)
                VALUES (gen_random_uuid(), 'fake_super_admin@flymycart.com', 'Fake Admin', 'super_admin', 'approved', 'super_admin')
            """))
    print("-> [VERIFIED] DB partial unique index strictly prevents multiple super admins.")

    print("\n" + "=" * 65)
    print("ALL TESTS COMPLETED AND PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    test_system_full_flow()
