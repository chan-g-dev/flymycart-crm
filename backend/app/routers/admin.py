# ================================================================
# FLY MY CART CRM - SUPER ADMIN ROUTER (app/routers/admin.py)
# ================================================================

import math
import datetime
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, text

from app.database import get_db
from app.models import Profile, ProfileAuditLog
from app.schemas import (
    ProfileOut,
    ApproveUserRequest,
    RejectUserRequest,
    SuspendUserRequest,
    ReactivateUserRequest,
    ChangeRoleRequest,
    ProfileAuditLogOut,
    PaginatedAuditLogs
)
from app.dependencies import require_super_admin

admin_router = APIRouter(prefix="/admin", tags=["Super Admin Staff Management & Audit"])


def get_admin_id(admin: Any) -> str:
    if isinstance(admin, dict):
        return str(admin.get("user_id") or admin.get("id") or "")
    return str(getattr(admin, "id", ""))


def record_audit(
    db: Session,
    admin_id: str,
    reason: str,
    target_profile_id: str,
    action: str,
    old_role: Optional[str] = None,
    new_role: Optional[str] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None
):
    if db.bind and db.bind.dialect.name == "postgresql":
        try:
            db.execute(text("SELECT set_config('app.audit_changed_by', :admin_id, true)"), {"admin_id": str(admin_id)})
            db.execute(text("SELECT set_config('app.audit_reason', :reason, true)"), {"reason": reason})
        except Exception:
            pass
    # Explicit audit entry to ensure audit history is preserved across all database types
    log_entry = ProfileAuditLog(
        profile_id=target_profile_id,
        changed_by=admin_id,
        action=action,
        old_role=old_role,
        new_role=new_role,
        old_status=old_status,
        new_status=new_status,
        reason=reason
    )
    db.add(log_entry)


@admin_router.get("/pending", response_model=List[ProfileOut])
def get_pending_users(
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    List all staff members awaiting Super Admin approval.
    """
    pending = db.query(Profile).filter(Profile.status == "pending").order_by(desc(Profile.created_at)).all()
    return pending


@admin_router.get("/users", response_model=List[ProfileOut])
def get_all_users(
    status_filter: Optional[str] = Query(None, alias="status"),
    role_filter: Optional[str] = Query(None, alias="role"),
    search: Optional[str] = None,
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    List all staff profiles with optional filters for status, role, or search keyword.
    """
    query = db.query(Profile)
    if status_filter:
        query = query.filter(Profile.status == status_filter)
    if role_filter:
        query = query.filter(Profile.role == role_filter)
    if search:
        pattern = f"%{search}%"
        query = query.filter((Profile.full_name.ilike(pattern)) | (Profile.email.ilike(pattern)))

    return query.order_by(desc(Profile.created_at)).all()


@admin_router.post("/approve/{user_id}", response_model=ProfileOut)
def approve_user(
    user_id: str,
    payload: ApproveUserRequest,
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin approves a staff user and assigns their final role.
    """
    assigned_role = payload.role.strip().lower()
    if assigned_role not in ["super_admin", "manager", "staff", "viewer", "operations_staff", "counter_staff"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{assigned_role}'. Allowed: manager, operations_staff, counter_staff, staff, viewer."
        )

    target_profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff profile not found.")

    admin_id = get_admin_id(admin)
    if assigned_role == "super_admin" and target_profile.id != admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign 'super_admin' role: Exactly one super admin is allowed in the system."
        )

    reason = payload.reason or "Staff application approved by Super Admin"
    old_role = target_profile.role
    old_status = target_profile.status

    target_profile.role = assigned_role
    target_profile.status = "approved"
    target_profile.approved_by = admin_id
    target_profile.approved_at = datetime.datetime.utcnow()
    target_profile.updated_at = datetime.datetime.utcnow()

    record_audit(
        db=db,
        admin_id=admin_id,
        reason=reason,
        target_profile_id=target_profile.id,
        action="approved",
        old_role=old_role,
        new_role=assigned_role,
        old_status=old_status,
        new_status="approved"
    )

    db.commit()
    db.refresh(target_profile)
    return target_profile


@admin_router.post("/reject/{user_id}", response_model=ProfileOut)
def reject_user(
    user_id: str,
    payload: Optional[RejectUserRequest] = None,
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin rejects a staff user application with an optional reason note.
    """
    target_profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff profile not found.")

    if target_profile.role == "super_admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reject the Super Admin.")

    admin_id = get_admin_id(admin)
    reason = (payload.reason if payload and payload.reason else "Staff application rejected by Super Admin")
    old_status = target_profile.status

    target_profile.status = "rejected"
    target_profile.approved_by = admin_id
    target_profile.updated_at = datetime.datetime.utcnow()

    record_audit(
        db=db,
        admin_id=admin_id,
        reason=reason,
        target_profile_id=target_profile.id,
        action="rejected",
        old_role=target_profile.role,
        new_role=target_profile.role,
        old_status=old_status,
        new_status="rejected"
    )

    db.commit()
    db.refresh(target_profile)
    return target_profile


@admin_router.post("/suspend/{user_id}", response_model=ProfileOut)
def suspend_user(
    user_id: str,
    payload: Optional[SuspendUserRequest] = None,
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin suspends access for a previously approved user with an optional reason note.
    """
    target_profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff profile not found.")

    if target_profile.role == "super_admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot suspend the Super Admin.")

    admin_id = get_admin_id(admin)
    reason = (payload.reason if payload and payload.reason else "Access suspended by Super Admin")
    old_status = target_profile.status

    target_profile.status = "suspended"
    target_profile.updated_at = datetime.datetime.utcnow()

    record_audit(
        db=db,
        admin_id=admin_id,
        reason=reason,
        target_profile_id=target_profile.id,
        action="suspended",
        old_role=target_profile.role,
        new_role=target_profile.role,
        old_status=old_status,
        new_status="suspended"
    )

    db.commit()
    db.refresh(target_profile)
    return target_profile


@admin_router.post("/reactivate/{user_id}", response_model=ProfileOut)
def reactivate_user(
    user_id: str,
    payload: Optional[ReactivateUserRequest] = None,
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin reactivates a suspended staff user.
    """
    target_profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff profile not found.")

    admin_id = get_admin_id(admin)
    reason = (payload.reason if payload and payload.reason else "Account reactivated by Super Admin")
    old_status = target_profile.status

    target_profile.status = "approved"
    target_profile.updated_at = datetime.datetime.utcnow()

    record_audit(
        db=db,
        admin_id=admin_id,
        reason=reason,
        target_profile_id=target_profile.id,
        action="reactivated",
        old_role=target_profile.role,
        new_role=target_profile.role,
        old_status=old_status,
        new_status="approved"
    )

    db.commit()
    db.refresh(target_profile)
    return target_profile


@admin_router.post("/change-role/{user_id}", response_model=ProfileOut)
def change_user_role(
    user_id: str,
    payload: ChangeRoleRequest,
    admin: Any = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin updates an approved staff member's role.
    """
    target_profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff profile not found.")

    new_role = payload.role.strip().lower()
    if new_role not in ["super_admin", "manager", "staff", "viewer", "operations_staff", "counter_staff"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{new_role}'. Allowed: manager, operations_staff, counter_staff, staff, viewer."
        )

    admin_id = get_admin_id(admin)
    if new_role == "super_admin" and target_profile.id != admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign 'super_admin' role: Exactly one super admin is allowed in the system."
        )

    reason = payload.reason or f"Role updated to '{new_role}' by Super Admin"
    old_role = target_profile.role

    target_profile.role = new_role
    target_profile.updated_at = datetime.datetime.utcnow()

    record_audit(
        db=db,
        admin_id=admin_id,
        reason=reason,
        target_profile_id=target_profile.id,
        action="role_changed",
        old_role=old_role,
        new_role=new_role,
        old_status=target_profile.status,
        new_status=target_profile.status
    )

    db.commit()
    db.refresh(target_profile)
    return target_profile


@admin_router.get("/audit-log", response_model=PaginatedAuditLogs)
def get_audit_log(
    profile_id: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime.datetime] = None,
    end_date: Optional[datetime.datetime] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Profile = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin: Get full audit history of all approvals, rejections, suspensions, and role changes.
    Supports filtering by profile_id, action, date range, and pagination.
    """
    query = db.query(ProfileAuditLog)

    if profile_id:
        query = query.filter(ProfileAuditLog.profile_id == profile_id)
    if action:
        query = query.filter(ProfileAuditLog.action == action)
    if start_date:
        query = query.filter(ProfileAuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(ProfileAuditLog.created_at <= end_date)

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit

    records = query.order_by(desc(ProfileAuditLog.created_at)).offset(offset).limit(limit).all()

    items = []
    for rec in records:
        target_p = db.query(Profile).filter(Profile.id == rec.profile_id).first()
        admin_p = db.query(Profile).filter(Profile.id == rec.changed_by).first() if rec.changed_by else None

        items.append(ProfileAuditLogOut(
            id=str(rec.id),
            profile_id=str(rec.profile_id),
            profile_email=target_p.email if target_p else None,
            profile_name=target_p.full_name if target_p else None,
            changed_by=str(rec.changed_by) if rec.changed_by else None,
            changed_by_name=admin_p.full_name if admin_p else ("Super Admin" if rec.changed_by else "System"),
            changed_by_email=admin_p.email if admin_p else None,
            action=rec.action,
            old_role=rec.old_role,
            new_role=rec.new_role,
            old_status=rec.old_status,
            new_status=rec.new_status,
            reason=rec.reason,
            created_at=rec.created_at
        ))

    return PaginatedAuditLogs(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        items=items
    )


@admin_router.get("/audit-log/{target_profile_id}", response_model=List[ProfileAuditLogOut])
def get_user_audit_history(
    target_profile_id: str,
    admin: Profile = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin: Get complete chronological audit history for a single user
    (e.g., approved by X on date, later suspended by X on date).
    """
    records = db.query(ProfileAuditLog).filter(
        ProfileAuditLog.profile_id == target_profile_id
    ).order_by(desc(ProfileAuditLog.created_at)).all()

    target_p = db.query(Profile).filter(Profile.id == target_profile_id).first()

    items = []
    for rec in records:
        admin_p = db.query(Profile).filter(Profile.id == rec.changed_by).first() if rec.changed_by else None
        items.append(ProfileAuditLogOut(
            id=str(rec.id),
            profile_id=str(rec.profile_id),
            profile_email=target_p.email if target_p else None,
            profile_name=target_p.full_name if target_p else None,
            changed_by=str(rec.changed_by) if rec.changed_by else None,
            changed_by_name=admin_p.full_name if admin_p else ("Super Admin" if rec.changed_by else "System"),
            changed_by_email=admin_p.email if admin_p else None,
            action=rec.action,
            old_role=rec.old_role,
            new_role=rec.new_role,
            old_status=rec.old_status,
            new_status=rec.new_status,
            reason=rec.reason,
            created_at=rec.created_at
        ))

    return items
