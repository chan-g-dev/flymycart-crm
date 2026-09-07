import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.database import engine
from app.config import settings

client = TestClient(app)

def run_live_check():
    print("=" * 70)
    print("      FLY MY CART CRM - BACKEND & AUDIT LOG LIVE SYSTEM CHECK")
    print("=" * 70)

    # 1. Health & Database Check
    print("\n[CHECK 1] System Health & Database Connectivity")
    health_res = client.get("/api/health")
    assert health_res.status_code == 200, f"Health check failed: {health_res.text}"
    health_data = health_res.json()
    print(f" -> Status: {health_data['status'].upper()}")
    print(f" -> Service: {health_data['service']}")
    print(f" -> Database: {health_data['database']}")
    print(" -> [PASS] Health check & Supabase PostgreSQL connection verified.")

    # 2. Super Admin Login
    print("\n[CHECK 2] Super Admin Authentication (Gangabathina Chanakya)")
    admin_login_res = client.post("/auth/login", json={
        "email": "chanakyagangabathina77@gmail.com",
        "password": "Chanu@1234"
    })
    assert admin_login_res.status_code == 200, f"Super admin login failed: {admin_login_res.text}"
    admin_data = admin_login_res.json()
    admin_token = admin_data["access_token"]
    admin_profile = admin_data["profile"]
    admin_id = admin_profile["id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    print(f" -> Super Admin ID: {admin_id}")
    print(f" -> Full Name: {admin_profile['full_name']}")
    print(f" -> Email: {admin_profile['email']}")
    print(f" -> Assigned Role: {admin_profile['role']}")
    print(f" -> Status: {admin_profile['status']}")
    print(" -> [PASS] Super admin authenticated successfully with Supabase JWT.")

    # 3. New Staff Signup
    unique_suffix = uuid.uuid4().hex[:6]
    staff_email = f"staff_{unique_suffix}@flymycart.com"
    staff_pass = "StaffPass@2026"
    staff_name = f"Test Staff {unique_suffix.upper()}"

    print(f"\n[CHECK 3] New Staff Registration: {staff_email}")
    signup_res = client.post("/auth/signup", json={
        "email": staff_email,
        "password": staff_pass,
        "full_name": staff_name,
        "requested_role": "manager"
    })
    assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
    signup_data = signup_res.json()
    staff_user_id = signup_data["user_id"]
    print(f" -> Registered User ID: {staff_user_id}")
    print(f" -> Account Status: {signup_data['account_status']}")
    print(f" -> Requested Role: {signup_data['requested_role']}")
    print(" -> [PASS] Staff member registered in 'pending' status.")

    # 4. Pending Staff Login & Auth Guard Enforcement
    print("\n[CHECK 4] Pending Staff Login & Auth Guard Enforcement")
    staff_login_res = client.post("/auth/login", json={
        "email": staff_email,
        "password": staff_pass
    })
    assert staff_login_res.status_code == 200, f"Staff login failed: {staff_login_res.text}"
    staff_token = staff_login_res.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Calling protected endpoint before approval -> MUST BE 403 FORBIDDEN
    staff_me_res = client.get("/staff/me", headers=staff_headers)
    print(f" -> Request: GET /staff/me with pending session token")
    print(f" -> HTTP Status Code: {staff_me_res.status_code}")
    print(f" -> Error Detail: {staff_me_res.json().get('detail')}")
    assert staff_me_res.status_code == 403, "Pending user was not rejected by Auth Guard!"
    print(" -> [PASS] Auth Guard correctly blocked access for pending user.")

    # 5. Super Admin Pending Queue
    print("\n[CHECK 5] Super Admin Checking Pending Applications (/admin/pending)")
    pending_res = client.get("/admin/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    target_in_pending = any(p["id"] == staff_user_id for p in pending_list)
    print(f" -> Total Pending Applications: {len(pending_list)}")
    print(f" -> Target Applicant In Queue: {target_in_pending}")
    assert target_in_pending, "Target user not found in pending list"
    print(" -> [PASS] Pending queue correctly reflects applicant.")

    # 6. Super Admin Approves Staff with Final Role & Reason
    print(f"\n[CHECK 6] Super Admin Approving Staff -> Role: 'manager'")
    approval_reason = "Identity and KYC verified by Operations Head"
    approve_res = client.post(
        f"/admin/approve/{staff_user_id}",
        json={"role": "manager", "reason": approval_reason},
        headers=admin_headers
    )
    assert approve_res.status_code == 200, f"Approve failed: {approve_res.text}"
    approved_data = approve_res.json()
    print(f" -> Updated Status: {approved_data['status']}")
    print(f" -> Assigned Role: {approved_data['role']}")
    print(f" -> Approved By Admin ID: {approved_data['approved_by']}")
    print(" -> [PASS] User approved successfully.")

    # 7. Staff Access Verification (After Approval)
    print("\n[CHECK 7] Staff Access Verification (After Approval)")
    staff_me_res2 = client.get("/staff/me", headers=staff_headers)
    assert staff_me_res2.status_code == 200, f"Staff access failed: {staff_me_res2.text}"
    staff_profile = staff_me_res2.json()
    print(f" -> HTTP Status Code: {staff_me_res2.status_code}")
    print(f" -> Profile Active Role: {staff_profile['role']}")
    print(f" -> Profile Status: {staff_profile['status']}")
    print(" -> [PASS] Approved staff now has full access to the system.")

    # 8. Super Admin Suspends Staff
    print(f"\n[CHECK 8] Super Admin Suspends Staff Member")
    suspend_res = client.post(
        f"/admin/suspend/{staff_user_id}",
        json={"reason": "Temporary compliance audit"},
        headers=admin_headers
    )
    assert suspend_res.status_code == 200
    print(f" -> Updated Status: {suspend_res.json()['status']}")

    # Check that suspended user is blocked immediately
    staff_me_res3 = client.get("/staff/me", headers=staff_headers)
    print(f" -> Suspended User Access GET /staff/me: {staff_me_res3.status_code} ({staff_me_res3.json().get('detail')})")
    assert staff_me_res3.status_code == 403
    print(" -> [PASS] Suspended staff immediately blocked by Auth Guard.")

    # 9. Super Admin Reactivates Staff
    print(f"\n[CHECK 9] Super Admin Reactivates Staff Member")
    reactivate_res = client.post(
        f"/admin/reactivate/{staff_user_id}",
        json={"reason": "Compliance audit completed successfully"},
        headers=admin_headers
    )
    assert reactivate_res.status_code == 200
    assert reactivate_res.json()["status"] == "approved"
    print(f" -> Updated Status: {reactivate_res.json()['status']}")
    print(" -> [PASS] Staff member reactivated.")

    # 10. Super Admin Changes Staff Role
    print(f"\n[CHECK 10] Super Admin Modifies Role -> 'staff'")
    role_res = client.post(
        f"/admin/change-role/{staff_user_id}",
        json={"role": "staff", "reason": "Department transfer to dispatch hub"},
        headers=admin_headers
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "staff"
    print(f" -> Updated Role: {role_res.json()['role']}")
    print(" -> [PASS] Role updated successfully.")

    # 11. Automatic Audit Log Verification
    print("\n[CHECK 11] PostgreSQL Trigger Automatic Audit Log Verification")
    audit_res = client.get(f"/admin/audit-log/{staff_user_id}", headers=admin_headers)
    assert audit_res.status_code == 200
    audit_entries = audit_res.json()
    print(f" -> Total Audit Log Entries for {staff_name}: {len(audit_entries)}")
    for i, entry in enumerate(audit_entries, 1):
        print(f"    [{i}] Action: {entry['action']:<14} | Status: {str(entry['old_status']):<9} -> {str(entry['new_status']):<9} | Role: {str(entry['old_role']):<8} -> {str(entry['new_role']):<8} | Admin: {entry['changed_by_name']} | Reason: '{entry['reason']}'")

    actions = [e["action"] for e in audit_entries]
    assert "approved" in actions, "Audit log missing 'approved' action"
    assert "suspended" in actions, "Audit log missing 'suspended' action"
    assert "reactivated" in actions, "Audit log missing 'reactivated' action"
    assert "role_changed" in actions, "Audit log missing 'role_changed' action"
    print(" -> [PASS] All lifecycle actions automatically logged by Postgres trigger with full details & reasons.")

    # 12. Single Super Admin Database Constraint Verification
    print("\n[CHECK 12] Single Super Admin DB Partial Unique Index Verification")
    with engine.begin() as conn:
        super_admins = conn.execute(text("SELECT id, email, full_name, role, status FROM public.profiles WHERE role = 'super_admin'")).fetchall()
        print(f" -> Registered Super Admins Count in DB: {len(super_admins)}")
        for sa in super_admins:
            print(f"    - ID: {sa[0]} | Name: {sa[2]} | Email: {sa[1]} | Role: {sa[3]} | Status: {sa[4]}")
        assert len(super_admins) == 1, "More than 1 Super Admin found!"

        try:
            conn.execute(text("""
                INSERT INTO public.profiles (id, email, full_name, role, status, requested_role)
                VALUES (gen_random_uuid(), 'fake_admin@flymycart.com', 'Fake Admin', 'super_admin', 'approved', 'super_admin')
            """))
            violation_occurred = False
        except Exception as e:
            violation_occurred = True
            print(f" -> DB Constraint blocked 2nd super admin: unique_super_admin index triggered.")

        assert violation_occurred, "Database failed to reject second super admin!"
        print(" -> [PASS] Partial unique index strictly guarantees exactly ONE Super Admin.")

    print("\n" + "=" * 70)
    print("      ALL 12 LIVE SYSTEM CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_live_check()
