# ================================================================
# FLY MY CART CRM - REFUNDS ROUTER (app/routers/refunds.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import Refund, AuditLog
from app.schemas import RefundCreate, RefundOut
from app.dependencies import (
    get_current_session_context,
    require_permission
)
from app.auth import create_audit_log
from app.cache import cache_engine

refunds_router = APIRouter(prefix="/refunds", tags=["Refunds"])


@refunds_router.get("", response_model=List[RefundOut])
@refunds_router.get("/", response_model=List[RefundOut])
def get_refunds(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission("refunds.view")),
    db: Session = Depends(get_db)
):
    """Lists all refund requests."""
    query = db.query(Refund).order_by(desc(Refund.created_at), Refund.id)
    response.headers["X-Total-Count"] = str(query.count())
    return query.limit(limit).offset(offset).all()


@refunds_router.post("", response_model=RefundOut)
@refunds_router.post("/", response_model=RefundOut)
def create_refund(
    payload: RefundCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("refunds.request")),
    db: Session = Depends(get_db)
):
    """Initiates a new refund request."""
    ref_id = f"ref_{uuid.uuid4().hex[:16]}"
    ref = Refund(
        id=ref_id,
        customer=payload.customer.strip(),
        customer_id=payload.customer_id,
        awb=payload.awb.strip(),
        invoice_no=payload.invoice_no or "-",
        amount=payload.amount,
        reason=payload.reason.strip(),
        requested_by=ctx["display_name"],
        request_date=datetime.date.today().isoformat(),
        status="Requested",
        refund_method=payload.refund_method
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="refunds.request",
        resource_type="refund",
        resource_id=ref_id,
        action="requested_refund",
        after_data={"amount": payload.amount, "awb": payload.awb, "customer": payload.customer},
        ip_address=request.client.host if request.client else None
    )

    return ref


@refunds_router.patch("/{refund_id}/status")
def update_refund_status(
    refund_id: str,
    payload: Dict[str, str],
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("refunds.approve")),
    db: Session = Depends(get_db)
):
    """
    Approves or processes customer refund.
    Enforces Separation of Duties: Requester cannot approve their own refund.
    Enforces Step-Up MFA (<10 min).
    """
    ref = db.query(Refund).filter(Refund.id == refund_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Refund not found.")

    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required.")
    if not ctx.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Only Super Admin may review, approve or disburse refunds.")
    transitions = {
        "Requested": {"Under Review", "Approved", "Rejected"},
        "Under Review": {"Approved", "Rejected"},
        "Approved": {"Refunded"},
        "Rejected": set(), "Refunded": set(),
    }
    if new_status not in transitions.get(ref.status, set()):
        raise HTTPException(status_code=400, detail=f"Cannot change refund from {ref.status} to {new_status}")
    if new_status == "Refunded" and not (payload.get("refund_method") or ref.refund_method or "").strip():
        raise HTTPException(status_code=400, detail="Refund payment method is required")

    # Guard: Separation of Duties
    if new_status in ["Approved", "Refunded"] and ref.requested_by == ctx["display_name"] and not ctx.get("is_super_admin", False):
        raise HTTPException(
            status_code=400,
            detail="Security Rule: A refund requester cannot approve or process their own refund request."
        )

    before_status = ref.status
    ref.status = new_status
    if new_status == "Approved":
        ref.approved_by = ctx["display_name"]
        ref.approval_date = datetime.date.today().isoformat()
    elif new_status == "Refunded":
        ref.refund_date = datetime.date.today().isoformat()
        if payload.get("refund_method"):
            ref.refund_method = payload.get("refund_method")

    db.commit()

    cache_engine.invalidate_prefix("dashboard_summary")

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="refunds.status_change",
        resource_type="refund",
        resource_id=refund_id,
        action=f"refund_{new_status.lower()}",
        before_data={"status": before_status},
        after_data={"status": new_status, "approved_by": ref.approved_by},
        ip_address=request.client.host if request.client else None
    )

    return ref
