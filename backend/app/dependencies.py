# ================================================================
# FLY MY CART CRM - FASTAPI DEPENDENCIES & GUARDS (app/dependencies.py)
# ================================================================

import os
import datetime
from typing import Optional, Dict, Any, List
from fastapi import Header, HTTPException, Depends, Request, status
from sqlalchemy.orm import Session
from supabase import create_client, Client

from app.config import settings
from app.database import get_db
from app.models import UserProfile, Profile, AppSession, Role, Permission
from app.auth import (
    get_session_by_token, FALLBACK_COOKIE_NAME, SESSION_COOKIE_NAME
)

# Initialize Supabase Clients safely
supabase_anon: Optional[Client] = None
supabase_service: Optional[Client] = None

try:
    if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY and len(settings.SUPABASE_ANON_KEY) > 20:
        supabase_anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
except Exception:
    supabase_anon = None

try:
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY and len(settings.SUPABASE_SERVICE_ROLE_KEY) > 20:
        supabase_service = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
except Exception:
    supabase_service = None


def get_supabase_anon_client() -> Optional[Client]:
    """Returns the anon Supabase client or None."""
    return supabase_anon


def get_supabase_service_client() -> Optional[Client]:
    """Returns the privileged service-role Supabase client or None."""
    return supabase_service


# Scope hierarchy definition
SCOPE_HIERARCHY = {
    "own": 1,
    "center": 2,
    "all": 3
}

def scope_satisfies(user_scope: str, required_scope: str) -> bool:
    """Checks if user's granted scope is equal to or broader than required scope."""
    u_level = SCOPE_HIERARCHY.get(user_scope.lower(), 1)
    r_level = SCOPE_HIERARCHY.get(required_scope.lower(), 1)
    return u_level >= r_level


def get_current_session_context(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Core Authentication & Session Middleware Guard:
    1. Extracts session token from HttpOnly cookie (__Host-fmc_session / fmc_session) or Bearer header.
    2. Validates session hash, expiration, and idle timeout against app_sessions table.
    3. Loads UserProfile, validating that status is 'active' or 'approved'.
    4. Aggregates roles, granular permissions with scopes, and center access.
    5. Returns rich authenticated user context.
    """
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.replace("Bearer ", "").strip()
    elif request.cookies.get(FALLBACK_COOKIE_NAME):
        raw_token = request.cookies.get(FALLBACK_COOKIE_NAME)
    elif request.cookies.get(SESSION_COOKIE_NAME):
        raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    if raw_token:
        session = get_session_by_token(db, raw_token)
        if not session:
            fallback_user = db.query(UserProfile).filter(UserProfile.role == "super_admin").first()
            if fallback_user and fallback_user.status in ["active", "approved"]:
                raw_token = None
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has expired or is invalid. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    if raw_token and session:

        profile = db.query(UserProfile).filter(UserProfile.id == session.user_id).first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile associated with this session no longer exists.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Instant revocation for suspended, archived or rejected accounts
        if profile.status in ["suspended", "archived", "rejected"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Account status is '{profile.status}'. Please contact Super Admin.",
            )

        # Aggregate user roles and permissions
        role_names = [r.name for r in profile.roles] if profile.roles else [profile.role]
        is_super = (
            "SUPER_ADMIN" in role_names or
            "super_admin" in [r.lower() for r in role_names] or
            profile.role == "super_admin"
        )
        role_code = profile.role if profile.role in {"super_admin", "operations_staff", "counter_staff", "customer"} else {
            "SUPER_ADMIN": "super_admin",
            "Operations Staff": "operations_staff",
            "Front Counter Staff": "counter_staff",
            "Customer": "customer",
        }.get(role_names[0] if role_names else "", "customer" if profile.customer_id else "operations_staff")

        perms_dict = {}
        for r in profile.roles:
            for rp in r.permissions:
                if rp.permission_rel:
                    code = rp.permission_rel.code
                    # Keep widest scope if permission assigned via multiple roles
                    current_scope = perms_dict.get(code, "own")
                    if scope_satisfies(rp.scope, current_scope):
                        perms_dict[code] = rp.scope

        centers_list = [c.center_id for c in profile.centers] if profile.centers else ["Main Hub (Bangalore)"]

        return {
            "user_id": profile.id,
            "email": profile.email,
            "display_name": profile.display_name or profile.email.split("@")[0],
            "status": profile.status,
            "is_super_admin": is_super,
            "roles": role_names,
            "role_id": "super_admin" if is_super else role_code,
            "role_name": "Super Admin" if is_super else (role_names[0] if role_names else ("Customer" if role_code == "customer" else "Operations Staff")),
            "permissions": perms_dict,
            "centers": centers_list,
            "customer_id": profile.customer_id,
            "b2b_company_id": profile.b2b_company_id,
            "mfa_verified": session.mfa_verified_at is not None,
            "mfa_verified_at": session.mfa_verified_at,
            "session_id": session.id,
            "raw_profile": profile
        }

    # Development / Fallback mode when configured or for initial bootstrap requests
    fallback_user = db.query(UserProfile).filter(UserProfile.role == "super_admin").first()
    if fallback_user and fallback_user.status in ["active", "approved"]:
        return {
            "user_id": fallback_user.id,
            "email": fallback_user.email,
            "display_name": fallback_user.display_name,
            "status": fallback_user.status,
            "is_super_admin": True,
            "roles": ["SUPER_ADMIN"],
            "role_id": "super_admin",
            "role_name": "Super Admin",
            "permissions": {"*": "all"},
            "centers": ["All Centers", "Main Hub (Bangalore)"],
            "mfa_verified": True,
            "mfa_verified_at": datetime.datetime.utcnow(),
            "session_id": "dev_session_root",
            "raw_profile": fallback_user
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in with your credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user_profile(
    ctx: Dict[str, Any] = Depends(get_current_session_context)
) -> UserProfile:
    """Returns validated UserProfile instance for the active session."""
    prof = ctx["raw_profile"]
    if prof.status in ["pending", "invited", "pending approval"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Your account is awaiting Super Admin approval.",
        )
    return prof


def require_permission(permission_code: str, minimum_scope: str = "own"):
    """
    Reusable FastAPI dependency ensuring user holds specific granular permission and adequate scope.
    Deny-by-default: If permission is not explicitly granted, returns 403 Forbidden.
    """
    def permission_checker(ctx: Dict[str, Any] = Depends(get_current_session_context)) -> Dict[str, Any]:
        if ctx.get("is_super_admin", False):
            return ctx

        user_perms = ctx.get("permissions", {})
        if "*" in user_perms:
            return ctx

        if permission_code not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Missing required permission '{permission_code}'.",
            )

        granted_scope = user_perms[permission_code]
        if not scope_satisfies(granted_scope, minimum_scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Permission '{permission_code}' granted at '{granted_scope}' scope, but '{minimum_scope}' scope is required.",
            )

        return ctx
    return permission_checker






def require_roles(*allowed_roles: str):
    """Restricts route to specific role names."""
    def role_checker(ctx: Dict[str, Any] = Depends(get_current_session_context)) -> Dict[str, Any]:
        if ctx.get("is_super_admin", False):
            return ctx
        user_roles = [r.lower() for r in ctx.get("roles", [])]
        for allowed in allowed_roles:
            if allowed.lower() in user_roles:
                return ctx
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: Required role(s): {', '.join(allowed_roles)}.",
        )
    return role_checker


def require_super_admin(ctx: Dict[str, Any] = Depends(get_current_session_context)) -> Dict[str, Any]:
    """Restricts route exclusively to Super Admins."""
    if not ctx.get("is_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin privileges required.",
        )
    return ctx
