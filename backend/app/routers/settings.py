# ================================================================
# FLY MY CART CRM - SYSTEM SETTINGS & AUDIT ROUTER (app/routers/settings.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import SystemSettings, AuditLog
from app.schemas import AuditLogOut
from app.dependencies import (
    require_permission
)
from app.auth import create_audit_log
from app.cache import cache_engine

settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.get("")
@settings_router.get("/")
def get_settings(
    ctx: Dict[str, Any] = Depends(require_permission("settings.view")),
    db: Session = Depends(get_db)
):
    """Returns system configuration parameters and banking settings."""
    cached_cfg = cache_engine.get("global_system_settings")
    if cached_cfg is not None:
        return cached_cfg
    rec = db.query(SystemSettings).first()
    res = rec.config_json if rec else {}
    cache_engine.set("global_system_settings", res, ttl=60)
    return res


@settings_router.put("")
@settings_router.put("/")
def update_settings(
    payload: Dict[str, Any],
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("settings.manage")),
    db: Session = Depends(get_db)
):
    """
    Updates global system configuration, carrier accounts, or collection banks.
    Protected by Step-Up MFA (<10 min).
    """
    rec = db.query(SystemSettings).first()
    before_cfg = rec.config_json if rec else {}
    if not rec:
        rec = SystemSettings(id=1, config_json=payload)
        db.add(rec)
    else:
        rec.config_json = payload

    db.commit()
    cache_engine.delete("global_system_settings")

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="settings.update",
        resource_type="settings",
        resource_id="system_settings",
        action="updated_system_settings",
        before_data=before_cfg,
        after_data=payload,
        ip_address=request.client.host if request.client else None
    )

    return rec.config_json


@settings_router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    limit: int = 50,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Returns audit trail."""
    return db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
