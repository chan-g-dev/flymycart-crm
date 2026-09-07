import os
import sys
import pytest

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.seed import seed_database
from app.models import User
from app.routers.auth import normalize_profile_status

client = TestClient(app)

def setup_module():
    db = SessionLocal()
    seed_database(db)
    db.query(User).filter(User.email.in_(["new.applicant@flymycart.com", "declined.staff@flymycart.com", "test.pending@flymycart.com"])).delete(synchronize_session=False)
    
    # Create one test pending user for count assertion
    pending_user = User(
        id="u_test_pending_setup",
        username="test.pending@flymycart.com",
        name="Test Pending User",
        email="test.pending@flymycart.com",
        role="staff",
        center="Main Hub (Bangalore)",
        status="Pending Approval",
        is_active=False
    )
    db.add(pending_user)
    db.commit()
    db.close()


def test_pending_staff_count():
    res = client.get("/api/users/pending-count", headers={"X-User-Role": "super_admin"})
    assert res.status_code == 200
    data = res.json()
    assert "pending_count" in data
    assert data["pending_count"] >= 1

def test_approved_legacy_status_is_normalized_for_login():
    assert normalize_profile_status("Active") == "approved"
    assert normalize_profile_status("approved") == "approved"
    assert normalize_profile_status("Pending Approval") == "pending"

def test_get_all_users():
    res = client.get("/api/users/", headers={"X-User-Role": "super_admin"})
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 1
    emails = [u["email"] for u in users]
    assert "chanakyagangabathina77@gmail.com" in emails

def test_new_staff_self_registration_is_pending():
    # Registering a new staff member
    payload = {
        "email": "new.applicant@flymycart.com",
        "name": "New Applicant",
        "role": "operations_staff",
        "phone": "+91 9988776655",
        "center": "Hyderabad Hub"
    }
    res = client.post("/api/users/sync-profile", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "new.applicant@flymycart.com"
    assert data["status"] == "Pending Approval"
    assert data["is_active"] is False

def test_super_admin_approve_staff():
    # Find the pending user
    db = SessionLocal()
    pending_user = db.query(User).filter(User.email == "new.applicant@flymycart.com").first()
    user_id = pending_user.id
    db.close()

    # Super Admin approves staff
    res = client.patch(
        f"/api/users/{user_id}/approve",
        json={"action": "approve", "role": "operations_staff"},
        headers={"X-User-Role": "super_admin", "X-User-Name": "Nawaz (Super Admin)"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Active"
    assert data["is_active"] is True
    assert data["approved_by"] == "Nawaz (Super Admin)"

def test_unauthorized_staff_cannot_approve():
    db = SessionLocal()
    user = db.query(User).filter(User.status == "Active").first()
    user_id = user.id
    db.close()

    # Operations staff tries to approve another user -> Should be 403 Forbidden
    res = client.patch(
        f"/api/users/{user_id}/approve",
        json={"action": "approve"},
        headers={"X-User-Role": "operations_staff", "X-User-Name": "Lata"}
    )
    assert res.status_code == 403

def test_super_admin_reject_staff():
    # Create another applicant
    res_reg = client.post("/api/users/sync-profile", json={
        "email": "declined.staff@flymycart.com",
        "name": "Declined Staff",
        "role": "counter_staff"
    })
    user_id = res_reg.json()["id"]

    # Reject
    res = client.patch(
        f"/api/users/{user_id}/reject",
        json={"action": "reject", "notes": "Incomplete documentation"},
        headers={"X-User-Role": "super_admin", "X-User-Name": "Nawaz (Super Admin)"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Rejected"
    assert data["is_active"] is False

if __name__ == "__main__":
    setup_module()
    test_pending_staff_count()
    test_get_all_users()
    test_new_staff_self_registration_is_pending()
    test_super_admin_approve_staff()
    test_unauthorized_staff_cannot_approve()
    test_super_admin_reject_staff()
    print("All Staff Approval Workflow backend tests passed successfully!")
