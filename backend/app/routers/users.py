from app.access_policy import ROLE_NAMES, ROLE_ALIASES, role_code
# ================================================================
# FLY MY CART CRM - USERS, ROLES & PERMISSIONS ROUTER (app/routers/users.py)
# ================================================================

import uuid
import secrets
import hashlib
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import (
    UserProfile, User, Role, Permission, UserRole, RolePermission,
    UserCenterAccess, AppSession, AuditLog, UserInvitation
)
from app.schemas import (
    InviteUserRequest, RoleCreateRequest, RoleUpdateRequest,
    RolePermissionsUpdateRequest, UserRolesUpdateRequest,
    UserCentersUpdateRequest, PermissionOut, RoleOut
)
from app.dependencies import (
    get_current_session_context,
    require_permission,
    require_super_admin
)
from app.auth import (
    create_audit_log, revoke_all_user_sessions
)

users_router = APIRouter(prefix="/users", tags=["Users, Roles & Access Control"])


ROLE_NAME_ALIASES = {
    **ROLE_NAMES,
    "operations_staff": "Operations Executive",
    "super_admin": "SUPER_ADMIN",
    "operations_staff": "Operations Executive",
    "counter_staff": "Counter Staff",
}

ROLE_CODES_BY_NAME = {
    "super_admin": "super_admin",
    "operations staff": "operations_staff",
    "front counter staff": "counter_staff",
}


def resolve_role(db: Session, identifier: Optional[str]) -> Optional[Role]:
    """Resolve frontend role codes and stored role names to one role record."""
    if not identifier:
        return None
    role_key = str(identifier).strip().lower().replace(" ", "_")
    role_name = ROLE_NAME_ALIASES.get(role_key, identifier)
    return db.query(Role).filter(
        (Role.id == identifier) | (Role.name.ilike(role_name))
    ).first()


def normalize_user_status_for_response(status_value: Optional[str]) -> str:
    """Keeps UI-facing user statuses stable across legacy/db variations."""
    if status_value is None:
        return "Pending Approval"

    normalized = str(status_value).strip().lower()
    if normalized in {"active", "approved"}:
        return "Active"
    if normalized in {"pending", "invited", "pending approval"}:
        return "Pending Approval"
    if normalized == "rejected":
        return "Rejected"
    if normalized == "suspended":
        return "Suspended"
    return status_value.strip()


@users_router.get("")
@users_router.get("/")
def get_all_users(
    status: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission("users.view")),
    db: Session = Depends(get_db)
):
    """
    Returns list of all staff accounts with their assigned roles, centers, and MFA enrollment status.
    """
    query = db.query(UserProfile)
    if not ctx.get("is_super_admin"):
        query = query.filter(UserProfile.centers.any(UserCenterAccess.center_id.in_(ctx.get("centers", []))))
    if status:
        query = query.filter(UserProfile.status == status)
    if search:
        p = f"%{search}%"
        query = query.filter((UserProfile.display_name.ilike(p)) | (UserProfile.email.ilike(p)))

    users = query.order_by(desc(UserProfile.created_at)).all()

    result = []
    for u in users:
        role_list = [
            {"id": r.id, "name": r.name, "is_system": r.is_system}
            for r in u.roles
        ]
        center_list = [
            {"center_id": c.center_id, "scope": c.scope}
            for c in u.centers
        ]
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.display_name,
            "phone": u.phone,
            "status": normalize_user_status_for_response(u.status),
            "is_active": (u.status or "").lower() in {"active", "approved"},
            "role": u.role,
            "roles": role_list,
            "centers": center_list,
            "mfa_enabled": u.mfa_enabled,
            "mfa_required": u.mfa_required,
            "approved_by": u.approved_by,
            "approval_date": u.approved_at,
            "last_login_at": u.last_login_at,
            "created_at": u.created_at
        })

    return result


@users_router.post("/{user_id}/approve")
@users_router.patch("/{user_id}/approve")
def approve_staff_user(
    user_id: str,
    payload: Dict[str, Any] = None,
    request: Request = None,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Backwards-compatible staff approval endpoint used by the management UI."""
    if request:
        caller_role = request.headers.get("X-User-Role")
        if caller_role and caller_role.lower() != "super_admin":
            raise HTTPException(status_code=403, detail="Super Admin privileges required.")

    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    legacy_user = None
    if not profile:
        legacy_user = db.query(User).filter(User.id == user_id).first()
        if not legacy_user:
            raise HTTPException(status_code=404, detail="User not found.")

    if payload is None:
        payload = {}

    if legacy_user:
        approver = (request.headers.get("X-User-Name") if request else None) or ctx.get("display_name", "Super Admin")
        legacy_user.status = "Active"
        legacy_user.is_active = True
        legacy_user.approved_by = approver
        legacy_user.approval_date = datetime.datetime.utcnow()
        db.commit()
        return {
            "id": legacy_user.id,
            "status": "Active",
            "is_active": True,
            "approved_by": legacy_user.approved_by,
            "message": f"User '{legacy_user.name}' approved successfully."
        }

    assigned_role = (payload.get("role") or profile.requested_role or profile.role or "operations_staff").strip().lower()
    center = payload.get("center") or "Main Hub (Bangalore)"

    if assigned_role not in set(ROLE_NAMES) | {"operations_staff"}:
        assigned_role = "operations_staff"

    profile.status = "active"
    profile.role = assigned_role
    profile.requested_role = assigned_role
    profile.approved_by = ctx["user_id"]
    profile.approved_at = datetime.datetime.utcnow()
    profile.authorization_version += 1
    selected_role = resolve_role(db, assigned_role)
    if selected_role:
        db.query(UserRole).filter(UserRole.user_id == profile.id).delete(synchronize_session=False)
        db.add(UserRole(user_id=profile.id, role_id=selected_role.id, assigned_by=ctx["user_id"]))
    if not any(c.center_id == center for c in profile.centers):
        db.add(UserCenterAccess(user_id=profile.id, center_id=center, scope="operate", assigned_by=ctx["user_id"]))

    db.commit()
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx.get("display_name", "Super Admin"),
        event_type="users.approve",
        resource_type="user",
        resource_id=profile.id,
        action="approved_user",
        after_data={"status": "active", "role": assigned_role, "center": center},
        ip_address=request.client.host if request and request.client else None
    )
    return {"status": "Active", "is_active": True, "approved_by": ctx.get("display_name", "Super Admin"), "message": f"User '{profile.display_name}' approved successfully."}


@users_router.post("/{user_id}/reject")
@users_router.patch("/{user_id}/reject")
def reject_staff_user(
    user_id: str,
    payload: Dict[str, Any] = None,
    request: Request = None,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Backwards-compatible staff rejection endpoint used by the management UI."""
    if request:
        caller_role = request.headers.get("X-User-Role")
        if caller_role and caller_role.lower() != "super_admin":
            raise HTTPException(status_code=403, detail="Super Admin privileges required.")

    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    legacy_user = None
    if not profile:
        legacy_user = db.query(User).filter(User.id == user_id).first()
        if not legacy_user:
            raise HTTPException(status_code=404, detail="User not found.")

    if legacy_user:
        legacy_user.status = "Rejected"
        legacy_user.is_active = False
        db.commit()
        return {
            "id": legacy_user.id,
            "status": "Rejected",
            "is_active": False,
            "message": f"User '{legacy_user.name}' rejected."
        }

    profile.status = "rejected"
    profile.authorization_version += 1
    db.commit()
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx.get("display_name", "Super Admin"),
        event_type="users.reject",
        resource_type="user",
        resource_id=profile.id,
        action="rejected_user",
        after_data={"status": "rejected"},
        ip_address=request.client.host if request and request.client else None
    )
    return {"status": "Rejected", "is_active": False, "message": f"User '{profile.display_name}' rejected."}


@users_router.delete("/{user_id}")
def delete_staff_user(
    user_id: str,
    request: Request = None,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Delete a staff user record from the CRM directory."""
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found.")

    if profile.id == ctx["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    # Clear association rows explicitly so deletion works consistently across
    # SQLite and production databases, including older schemas without cascades.
    db.query(UserRole).filter(UserRole.assigned_by == profile.id).update(
        {UserRole.assigned_by: None}, synchronize_session=False
    )
    db.query(UserCenterAccess).filter(UserCenterAccess.assigned_by == profile.id).update(
        {UserCenterAccess.assigned_by: None}, synchronize_session=False
    )
    db.query(UserRole).filter(UserRole.user_id == profile.id).delete(synchronize_session=False)
    db.query(UserCenterAccess).filter(UserCenterAccess.user_id == profile.id).delete(synchronize_session=False)
    db.query(UserInvitation).filter(UserInvitation.email == profile.email).delete(synchronize_session=False)

    db.delete(profile)
    db.commit()
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx.get("display_name", "Super Admin"),
        event_type="users.delete",
        resource_type="user",
        resource_id=user_id,
        action="deleted_user",
        ip_address=request.client.host if request and request.client else None
    )
    return {"status": "deleted", "message": "Staff record deleted."}


@users_router.post("/invitations")
def invite_user(
    payload: InviteUserRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.invite")),
    db: Session = Depends(get_db)
):
    """
    Invite-Only Enrollment:
    Super Admin invites new staff member. Generates a secure activation token.
    Assigning Super Admin still requires an authenticated Super Admin.
    """
    email = payload.email.strip().lower()

    # Check if email is already registered
    existing = db.query(UserProfile).filter(UserProfile.email == email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User with email '{email}' already exists with status '{existing.status}'."
        )

    # Check if assigning Super Admin role requires recent MFA
    super_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
    selected_roles = [resolve_role(db, role_id) for role_id in payload.role_ids]
    if super_role and any(role and role.id == super_role.id for role in selected_roles):
        if not ctx.get("is_super_admin"):
            raise HTTPException(
                status_code=403,
                detail="Only a Super Admin can invite another Super Admin."
            )

    # Generate cryptographic invitation token
    raw_invite_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_invite_token.encode("utf-8")).hexdigest()
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=3)

    # Remove any prior pending invites for this email
    db.query(UserInvitation).filter(UserInvitation.email == email).delete()

    requested_role = str((payload.role_ids or ["operations_staff"])[0]).strip().lower().replace(" ", "_")
    if requested_role not in set(ROLE_NAMES) | {"operations_staff"}:
        requested_role = "operations_staff"
    selected_roles = [resolve_role(db, role_id) for role_id in payload.role_ids]
    selected_roles = [role for role in selected_roles if role]
    if not selected_roles:
        fallback_role = resolve_role(db, requested_role)
        if fallback_role:
            selected_roles = [fallback_role]

    invitation = UserInvitation(
        email=email,
        token_hash=token_hash,
        role_ids=[role.id for role in selected_roles],
        center_ids=payload.center_ids or ["Main Hub (Bangalore)"],
        invited_by=ctx["user_id"],
        expires_at=expires_at
    )
    db.add(invitation)

    # Pre-create UserProfile in 'invited' status
    new_profile = UserProfile(
        email=email,
        display_name=payload.display_name or email.split("@")[0],
        phone=(payload.phone or "").strip() or None,
        status="invited",
        role=requested_role,
        requested_role=requested_role,
        mfa_required=False,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_profile)
    db.flush()

    # Link roles & centers
    for target_role in selected_roles:
        db.add(UserRole(user_id=new_profile.id, role_id=target_role.id, assigned_by=ctx["user_id"]))

    for c_id in (payload.center_ids or ["Main Hub (Bangalore)"]):
        db.add(UserCenterAccess(user_id=new_profile.id, center_id=c_id, scope="operate", assigned_by=ctx["user_id"]))

    db.commit()

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="users.invite",
        resource_type="user",
        resource_id=new_profile.id,
        action="invited_user",
        after_data={"email": email, "roles": payload.role_ids, "centers": payload.center_ids},
        ip_address=request.client.host if request.client else None
    )

    invite_url = f"/accept-invite?token={raw_invite_token}&email={email}"

    return {
        "status": "invited",
        "message": f"Invitation link generated for '{email}'.",
        "invite_url": invite_url,
        "token": raw_invite_token,
        "expires_at": expires_at.isoformat()
    }


@users_router.post("/{user_id}/suspend")
def suspend_user(
    user_id: str,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.suspend")),
    db: Session = Depends(get_db)
):
    """
    Suspends staff account and immediately revokes all active sessions.
    Protects against demoting/suspending the final active Super Admin.
    """
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found.")

    if profile.id == ctx["user_id"]:
        raise HTTPException(status_code=400, detail="Staff cannot suspend their own account.")

    # Guard: Cannot suspend the last active Super Admin
    super_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
    if super_role and super_role in profile.roles:
        active_super_admins = db.query(UserProfile).join(UserRole).filter(
            UserRole.role_id == super_role.id,
            UserProfile.status == "active"
        ).count()
        if active_super_admins <= 1:
            raise HTTPException(
                status_code=400,
                detail="Security Guard: The final active Super Admin cannot be suspended."
            )

    old_status = profile.status
    profile.status = "suspended"
    profile.authorization_version += 1
    db.commit()

    # Immediate session revocation
    revoke_all_user_sessions(db, profile.id, f"Account suspended by {ctx['display_name']}")

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="users.suspend",
        resource_type="user",
        resource_id=profile.id,
        action="suspended_user",
        before_data={"status": old_status},
        after_data={"status": "suspended"},
        ip_address=request.client.host if request.client else None
    )

    return {"status": "suspended", "message": f"User '{profile.display_name}' suspended and all active sessions revoked."}


@users_router.post("/{user_id}/reactivate")
def reactivate_user(
    user_id: str,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.suspend")),
    db: Session = Depends(get_db)
):
    """Reactivates suspended staff account."""
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found.")

    profile.status = "active"
    profile.authorization_version += 1
    db.commit()

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="users.reactivate",
        resource_type="user",
        resource_id=profile.id,
        action="reactivated_user",
        after_data={"status": "active"},
        ip_address=request.client.host if request.client else None
    )

    return {"status": "active", "message": f"User '{profile.display_name}' reactivated successfully."}


@users_router.put("/{user_id}/roles")
def update_user_roles(
    user_id: str,
    payload: UserRolesUpdateRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """
    Updates user assigned roles. Requires recent MFA (<10m).
    Takes effect immediately by bumping authorization_version and revoking existing sessions.
    """
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found.")

    if profile.id == ctx["user_id"] and not ctx.get("is_super_admin", False):
        raise HTTPException(status_code=400, detail="Staff cannot edit their own roles or permissions.")

    if role_code(profile) == 'super_admin':
        raise HTTPException(400, 'Super Admin role assignments are protected.')
    old_roles = [r.name for r in profile.roles]
    selected_roles = [resolve_role(db, role_id) for role_id in payload.role_ids]
    selected_roles = [role for role in selected_roles if role]
    if not selected_roles:
        raise HTTPException(status_code=400, detail="Select a valid staff role.")

    # Delete current user_roles
    db.query(UserRole).filter(UserRole.user_id == profile.id).delete(synchronize_session=False)

    # Assign new roles
    for role in selected_roles:
        db.add(UserRole(user_id=profile.id, role_id=role.id, assigned_by=ctx["user_id"]))

    profile.role = next((key for key, name in ROLE_NAMES.items() if name == selected_roles[0].name), "operations_executive")
    profile.requested_role = profile.role

    profile.authorization_version += 1
    db.commit()

    # Revoke sessions so new permissions take effect immediately
    revoke_all_user_sessions(db, profile.id, "Roles updated by administrator")

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="rbac.user_roles_update",
        resource_type="user",
        resource_id=profile.id,
        action="updated_user_roles",
        before_data={"roles": old_roles},
        after_data={"roles": [role.name for role in selected_roles], "role_code": profile.role},
        ip_address=request.client.host if request.client else None
    )

    return {"status": "success", "role": profile.role, "message": "User role updated and sessions refreshed."}


@users_router.put("/{user_id}/centers")
def update_user_centers(
    user_id: str,
    payload: UserCentersUpdateRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.edit")),
    db: Session = Depends(get_db)
):
    """Updates user assigned centers and operational scopes."""
    profile = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found.")

    db.query(UserCenterAccess).filter(UserCenterAccess.user_id == profile.id).delete()

    for c_id in payload.center_ids:
        db.add(UserCenterAccess(
            user_id=profile.id,
            center_id=c_id,
            scope=payload.scope or "operate",
            assigned_by=ctx["user_id"]
        ))

    profile.authorization_version += 1
    db.commit()

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="rbac.user_centers_update",
        resource_type="user",
        resource_id=profile.id,
        action="updated_user_centers",
        after_data={"centers": payload.center_ids, "scope": payload.scope},
        ip_address=request.client.host if request.client else None
    )

    return {"status": "success", "message": "User centers updated."}


# ----------------------------------------------------------------
# ROLES & PERMISSIONS MANAGEMENT
# ----------------------------------------------------------------

@users_router.get("/roles", response_model=List[RoleOut])
def list_roles(
    ctx: Dict[str, Any] = Depends(require_permission("users.view")),
    db: Session = Depends(get_db)
):
    """Lists all configurable and system roles along with mapped permissions and scopes."""
    roles = db.query(Role).all()
    result = []
    for r in roles:
        perms = []
        for rp in r.permissions:
            if rp.permission_rel:
                perms.append({
                    "id": rp.permission_rel.id,
                    "code": rp.permission_rel.code,
                    "resource": rp.permission_rel.resource,
                    "action": rp.permission_rel.action,
                    "module": rp.permission_rel.module,
                    "is_financial": rp.permission_rel.is_financial,
                    "scope": rp.scope
                })
        result.append(RoleOut(
            id=r.id,
            name=r.name,
            description=r.description,
            is_system=r.is_system,
            permissions=perms
        ))
    return result


@users_router.post("/roles")
def create_role(
    payload: RoleCreateRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Creates a new configurable role with permissions."""
    existing = db.query(Role).filter(Role.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{payload.name}' already exists.")

    role = Role(
        name=payload.name.strip(),
        description=payload.description,
        is_system=False
    )
    db.add(role)
    db.flush()

    for p_item in payload.permissions:
        p_id = p_item.get("permission_id")
        scope = p_item.get("scope", "center")
        if p_id:
            db.add(RolePermission(role_id=role.id, permission_id=p_id, scope=scope))

    db.commit()

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="rbac.create_role",
        resource_type="role",
        resource_id=role.id,
        action="created_role",
        after_data={"name": role.name, "permissions": payload.permissions},
        ip_address=request.client.host if request.client else None
    )

    return {"status": "created", "role_id": role.id, "name": role.name}


@users_router.put("/roles/{role_id}/permissions")
def update_role_permissions(
    role_id: str,
    payload: RolePermissionsUpdateRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """
    Updates permissions for a role.
    If role is protected SUPER_ADMIN, prevents removing core permissions.
    """
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    if role.is_system and role.name == "SUPER_ADMIN":
        raise HTTPException(
            status_code=400,
            detail="Protected System Role: SUPER_ADMIN must always retain all permissions."
        )

    from app.access_policy import SUPER_ONLY
    catalog = {p.id: p for p in db.query(Permission)}
    seen = set()
    for item in payload.permissions:
        permission_id = item.get('permission_id')
        if permission_id not in catalog or catalog[permission_id].code in SUPER_ONLY:
            raise HTTPException(422, 'Unknown or Super Admin-only permission')
        if item.get('scope', 'center') not in ('own', 'center', 'all') or permission_id in seen:
            raise HTTPException(422, 'Invalid scope or duplicate permission')
        seen.add(permission_id)
    before = [{'permission_id': p.permission_id, 'scope': p.scope} for p in role.permissions]
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    for item in payload.permissions:
        db.add(RolePermission(role_id=role.id, permission_id=item['permission_id'], scope=item.get('scope', 'center')))
    users_with_role = db.query(UserProfile).join(UserRole, UserRole.user_id == UserProfile.id).filter(UserRole.role_id == role.id).all()
    for user in users_with_role:
        user.authorization_version += 1
        revoke_all_user_sessions(db, user.id, f"Role '{role.name}' permissions updated", auto_commit=False)
    create_audit_log(db, ctx['user_id'], ctx['display_name'], 'rbac.update_role_permissions', 'role',
        'updated_role_permissions', resource_id=role.id, before_data=before,
        after_data={'role': role.name, 'permissions': payload.permissions}, auto_commit=False,
        ip_address=request.client.host if request.client else None)
    db.commit()

    return {"status": "success", "message": f"Permissions updated for role '{role.name}'."}


@users_router.get("/permissions", response_model=List[PermissionOut])
def list_permissions(
    ctx: Dict[str, Any] = Depends(require_permission("users.view")),
    db: Session = Depends(get_db)
):
    """Lists complete catalogue of available granular resource.action permissions."""
    return db.query(Permission).order_by(Permission.module, Permission.code).all()


@users_router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    actor_id: Optional[str] = None,
    event_type: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Returns append-only audit trail with sensitive credential redaction."""
    from app.auth import sanitize_audit_data
    query = db.query(AuditLog)
    if actor_id:
        query = query.filter(AuditLog.user_id == actor_id)
    if event_type:
        query = query.filter(AuditLog.event_type.ilike(f"%{event_type}%"))

    logs = query.order_by(desc(AuditLog.timestamp), desc(AuditLog.id)).offset(offset).limit(limit).all()

    return [
        {
            "id": l.id,
            "actor_id": l.user_id,
            "actor_name": l.user_name,
            "event_type": l.event_type,
            "resource_type": l.entity_type,
            "resource_id": l.entity_id,
            "action": l.action,
            "result": l.result,
            "before_data": sanitize_audit_data(l.before_value),
            "after_data": sanitize_audit_data(l.after_value),
            "timestamp": l.timestamp
        } for l in logs
    ]


# ----------------------------------------------------------------
# BACKWARD COMPATIBILITY / LEGACY STAFF APPROVAL SUITE ENDPOINTS
# ----------------------------------------------------------------

@users_router.get("/pending-count")
def get_pending_users_count(
    request: Request,
    db: Session = Depends(get_db)
):
    """Returns count of users awaiting approval."""
    count = db.query(User).filter(User.status == "Pending Approval").count()
    return {"pending_count": count}


@users_router.post("/sync-profile")
def sync_profile(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Legacy staff applicant synchronization."""
    email = payload.get("email")
    name = payload.get("name", "")
    role = payload.get("role", "operations_staff")
    phone = payload.get("phone")
    center = payload.get("center", "Main Hub (Bangalore)")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            username=email,
            email=email,
            name=name,
            role=role,
            phone=phone,
            center=center,
            status="Pending Approval",
            is_active=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "status": user.status,
        "is_active": user.is_active
    }


# Per-person overrides are separate from role permissions and center assignments.
from pydantic import BaseModel, Field
from typing import Literal
from app.models import UserPermissionOverride
from app.access_policy import resolve_permissions, SUPER_ONLY

class IndividualAccessUpdate(BaseModel):
    version: int = Field(ge=1)
    overrides: Dict[str, Literal['allow', 'deny']] = Field(default_factory=dict)

@users_router.get('/{user_id}/access')
def get_individual_access(user_id: str, ctx=Depends(require_super_admin), db: Session = Depends(get_db)):
    profile = db.get(UserProfile, user_id)
    if not profile:
        raise HTTPException(404, 'User not found')
    return {
        'version': profile.authorization_version,
        'role_defaults': resolve_permissions(db, profile, include_overrides=False),
        'effective_permissions': resolve_permissions(db, profile),
        'overrides': {row.permission_code: 'allow' if row.allowed else 'deny'
                      for row in db.query(UserPermissionOverride).filter_by(user_id=user_id)},
        'permissions': [{'code': p.code, 'module': p.module, 'description': p.description, 'protected': p.code in SUPER_ONLY}
                        for p in db.query(Permission).order_by(Permission.module, Permission.code)],
        'centers': [c.center_id for c in profile.centers],
        'protected': role_code(profile) == 'super_admin',
    }

@users_router.put('/{user_id}/access')
def update_individual_access(user_id: str, payload: IndividualAccessUpdate, request: Request,
                             ctx=Depends(require_super_admin), db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter_by(id=user_id).with_for_update().first()
    if not profile:
        raise HTTPException(404, 'User not found')
    if role_code(profile) == 'super_admin':
        raise HTTPException(400, 'Super Admin access is protected')
    if profile.authorization_version != payload.version:
        raise HTTPException(409, 'Access changed since this form opened. Reload before saving.')
    valid = {p.code for p in db.query(Permission)} - SUPER_ONLY
    if set(payload.overrides) - valid:
        raise HTTPException(422, 'Unknown or Super Admin-only permission')
    before = {p.permission_code: 'allow' if p.allowed else 'deny'
              for p in db.query(UserPermissionOverride).filter_by(user_id=user_id)}
    db.query(UserPermissionOverride).filter_by(user_id=user_id).delete()
    for code, effect in payload.overrides.items():
        db.add(UserPermissionOverride(user_id=user_id, permission_code=code, allowed=effect == 'allow', updated_by=ctx['user_id']))
    profile.authorization_version += 1
    # Remove active sessions so cached access cannot survive a downgrade.
    revoke_all_user_sessions(db, user_id, reason='Individual permissions changed', auto_commit=False)
    create_audit_log(db, ctx['user_id'], ctx['display_name'], 'rbac.user_overrides', 'user',
                     'updated_individual_access', resource_id=user_id, before_data=before,
                     after_data=payload.overrides, auto_commit=False,
                     ip_address=request.client.host if request.client else None)
    db.commit()
    return {'status': 'saved', 'version': profile.authorization_version}
