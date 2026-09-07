# ================================================================
# FLY MY CART CRM - STAFF ROUTER (app/routers/staff.py)
# ================================================================

from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Profile, Shipment, Invoice
from app.schemas import ProfileOut
from app.dependencies import get_current_user_profile

staff_router = APIRouter(prefix="/staff", tags=["Approved Staff Operations"])


@staff_router.get("/me", response_model=ProfileOut)
def get_my_profile(profile: Profile = Depends(get_current_user_profile)):
    """
    Returns the authenticated staff user's profile and role.
    Rejects any unapproved or suspended user with 403 Forbidden.
    """
    return profile


@staff_router.get("/dashboard")
def get_staff_dashboard(
    profile: Profile = Depends(get_current_user_profile),
    db: Session = Depends(get_db)
):
    """
    Returns personalized operational metrics and status for the approved staff member.
    """
    total_shipments = db.query(Shipment).count()
    active_invoices = db.query(Invoice).filter(Invoice.status != "Paid").count()

    return {
        "status": "active",
        "staff": {
            "id": profile.id,
            "name": profile.full_name,
            "email": profile.email,
            "role": profile.role,
            "status": profile.status,
            "approved_at": profile.approved_at
        },
        "metrics": {
            "total_system_shipments": total_shipments,
            "pending_invoices": active_invoices
        }
    }
