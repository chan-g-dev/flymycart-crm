# ================================================================
# FLY MY CART CRM - AUTH & RBAC AUTOMATED TEST SUITE (tests/test_auth_rbac.py)
# ================================================================

import os
import sys
# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.seed import seed_database
from app.models import UserProfile, Role, Permission, UserRole, AppSession
from app.auth import (
    generate_totp_secret, generate_totp_code, verify_totp_code,
    hash_password, create_app_session
)

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    yield


def test_super_admin_seeded_with_all_permissions():
    """Verifies that Super Admin is seeded with active status and SUPER_ADMIN role."""
    db = SessionLocal()
    admin = db.query(UserProfile).filter(UserProfile.email == "chanakyagangabathina77@gmail.com").first()
    assert admin is not None
    assert admin.status == "active"
    assert admin.mfa_required is True

    # Check roles
    role_names = [r.name for r in admin.roles]
    assert "SUPER_ADMIN" in role_names

    # Check permissions catalogue
    perms_count = db.query(Permission).count()
    assert perms_count >= 25
    db.close()


def test_totp_pure_python_rfc6238():
    """Tests RFC 6238 TOTP generation and verification."""
    secret = generate_totp_secret()
    assert len(secret) >= 32

    # Generate current code
    code = generate_totp_code(secret)
    assert len(code) == 6
    assert code.isdigit()

    # Verify code
    assert verify_totp_code(secret, code) is True
    assert verify_totp_code(secret, "000000") is False


def test_login_flow_and_cookie():
    """Tests POST /api/auth/login and session cookie issuance."""
    response = client.post("/api/auth/login", json={
        "email": "chanakyagangabathina77@gmail.com",
        "password": "Chanu@1234"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["authenticated", "mfa_challenge_required", "mfa_setup_required"]

    # If MFA challenge is returned, test MFA verify
    if data["status"] == "mfa_challenge_required":
        verify_res = client.post("/api/auth/mfa/verify", json={"code": "123456"})
        assert verify_res.status_code == 200
        assert verify_res.json()["user"]["email"] == "chanakyagangabathina77@gmail.com"


def test_get_current_user_me():
    """Tests GET /api/auth/me returns roles, permissions, and center scopes."""
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "authenticated"
    assert data["user"]["email"] == "chanakyagangabathina77@gmail.com"
    assert "SUPER_ADMIN" in data["roles"] or data["is_super_admin"] is True


def test_step_up_mfa_endpoint():
    """Tests POST /api/auth/step-up re-authentication."""
    response = client.post("/api/auth/step-up", json={"code": "123456"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_staff_action_approval_and_delete_routes():
    """Covers the staff approval, rejection, and delete operations expected by the UI."""
    admin_session = client.post("/api/auth/login", json={
        "email": "chanakyagangabathina77@gmail.com",
        "password": "Chanu@1234"
    })
    assert admin_session.status_code == 200

    created = client.post("/api/users/invitations", json={
        "email": f"ui_staff_{uuid.uuid4().hex[:6]}@flymycart.com",
        "display_name": "UI Action User",
        "role_ids": ["operations_staff"],
        "center_ids": ["Main Hub (Bangalore)"]
    })
    assert created.status_code == 200

    user = client.get("/api/users/").json()
    target = next(u for u in user if u["email"].startswith("ui_staff_"))

    approve = client.post(f"/api/users/{target['id']}/approve", json={
        "action": "approve",
        "role": "operations_staff",
        "center": "Main Hub (Bangalore)"
    })
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] in ["active", "Active"]

    reject = client.post(f"/api/users/{target['id']}/reject", json={
        "action": "reject"
    })
    assert reject.status_code == 200, reject.text

    delete_res = client.delete(f"/api/users/{target['id']}")
    assert delete_res.status_code == 200, delete_res.text
    assert delete_res.json()["status"] == "deleted"


import uuid

def test_user_invitation_lifecycle():
    """Tests inviting a staff user, receiving token, and accepting invite."""
    invite_email = f"staff_{uuid.uuid4().hex[:6]}@flymycart.com"

    # 1. Super Admin invites user
    res = client.post("/api/users/invitations", json={
        "email": invite_email,
        "display_name": "Test Operations Officer",
        "role_ids": [],
        "center_ids": ["Main Hub (Bangalore)"]
    })
    assert res.status_code == 200
    invite_data = res.json()
    token = invite_data["token"]
    assert token is not None

    # 2. Staff accepts invitation and sets password
    accept_res = client.post("/api/auth/accept-invite", json={
        "token": token,
        "password": "SecurePassword2026!",
        "display_name": "Test Operations Officer"
    })
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "invitation_accepted"

    # 3. Staff logs in
    login_res = client.post("/api/auth/login", json={
        "email": invite_email,
        "password": "SecurePassword2026!"
    })
    assert login_res.status_code == 200
