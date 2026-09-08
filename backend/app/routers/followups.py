# ================================================================
# FLY MY CART CRM - FOLLOWUPS & COMMUNICATIONS ROUTER (routers/followups.py)
# ================================================================

import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Followup, CommunicationLog
from app.schemas import FollowupCreate, FollowupOut, CommunicationCreate, CommunicationOut
from app.auth import create_audit_log
from app.dependencies import require_permission
from app.permissions import PermissionCode

followups_router = APIRouter(prefix="/api/followups", tags=["Follow-ups"])

@followups_router.get("/", response_model=List[FollowupOut])
def get_followups(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.FOLLOWUPS_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(Followup).order_by(Followup.due_date, Followup.id)
    response.headers["X-Total-Count"] = str(query.count())
    return query.limit(limit).offset(offset).all()

@followups_router.post("/", response_model=FollowupOut)
def create_followup(
    payload: FollowupCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.FOLLOWUPS_ADD)),
    db: Session = Depends(get_db)
):
    fu = Followup(
        id=f"fu_{uuid.uuid4().hex[:16]}",
        customer_id=payload.customer_id,
        customer=payload.customer.strip(),
        category=payload.category,
        due_date=payload.due_date,
        priority=payload.priority,
        status="Pending",
        channel_action=payload.channel_action,
        notes=payload.notes
    )
    db.add(fu)
    db.commit()
    db.refresh(fu)
    
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="followups.create",
        resource_type="followup",
        resource_id=fu.id,
        action="create",
        after_data={"customer": payload.customer, "due_date": payload.due_date},
        ip_address=request.client.host if request.client else None
    )
    return fu

@followups_router.patch("/{followup_id}/complete")
def complete_followup(
    followup_id: str,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.FOLLOWUPS_EDIT)),
    db: Session = Depends(get_db)
):
    fu = db.query(Followup).filter(Followup.id == followup_id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    before_status = fu.status
    fu.status = "Done"
    db.commit()
    
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="followups.complete",
        resource_type="followup",
        resource_id=followup_id,
        action="complete",
        before_data={"status": before_status},
        after_data={"status": "Done"},
        ip_address=request.client.host if request.client else None
    )
    return {"message": "Follow-up marked as completed"}

@followups_router.post("/communications", response_model=CommunicationOut)
def log_communication(
    payload: CommunicationCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.FOLLOWUPS_EDIT)),
    db: Session = Depends(get_db)
):
    comm = CommunicationLog(
        id=f"comm_{uuid.uuid4().hex[:16]}",
        customer_id=payload.customer_id,
        customer=payload.customer.strip(),
        date=payload.date,
        channel=payload.channel,
        staff=ctx["display_name"],
        message=payload.message.strip(),
        status="Delivered"
    )
    db.add(comm)
    db.commit()
    db.refresh(comm)
    
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="followups.communication",
        resource_type="communication",
        resource_id=comm.id,
        action="create",
        after_data={"customer": payload.customer, "channel": payload.channel},
        ip_address=request.client.host if request.client else None
    )
    return comm
