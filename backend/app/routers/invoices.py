from app.payment_requests import claim_payment_request, finish_payment_request
from app.payment_details import validate_payment, validate_amount
# ================================================================
# FLY MY CART CRM - INVOICES ROUTER (routers/invoices.py)
# ================================================================

import uuid
import datetime
from app.business_dates import business_today
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import Invoice, Shipment, AuditLog, PaymentCollection, SystemSettings
from app.cache import cache_engine
from app.schemas import InvoiceOut, InvoicePaymentCreate
from app.auth import get_current_user_context, create_audit_log
from app.dependencies import require_permission, require_super_admin
from pydantic import BaseModel
from typing import Literal
from app.permissions import PermissionCode

invoices_router = APIRouter(prefix="/invoices", tags=["Invoices"])


class InvoiceBrandingUpdate(BaseModel):
    logo: Literal['original', 'express-wing', 'global-orbit', 'parcel-flight', 'swift-arrow', 'fmc-monogram']


@invoices_router.get('/branding')
def get_invoice_branding(ctx=Depends(require_permission('invoices.view')), db: Session = Depends(get_db)):
    rec = db.query(SystemSettings).first()
    return {'logo': (rec.config_json or {}).get('invoiceLogo', 'original') if rec else 'original'}


@invoices_router.put('/branding')
def update_invoice_branding(payload: InvoiceBrandingUpdate, ctx=Depends(require_super_admin), db: Session = Depends(get_db)):
    rec = db.query(SystemSettings).with_for_update().first()
    if not rec:
        rec = SystemSettings(id=1, config_json={})
        db.add(rec)
    config = dict(rec.config_json or {})
    previous = config.get('invoiceLogo', 'original')
    rec.config_json = {**config, 'invoiceLogo': payload.logo}
    create_audit_log(db, ctx['user_id'], ctx['display_name'], 'invoices.branding', 'settings', 'change_invoice_logo',
        resource_id='system_settings', before_data={'logo': previous}, after_data={'logo': payload.logo}, auto_commit=False)
    db.commit()
    cache_engine.delete('global_system_settings')
    return {'logo': payload.logo}

def log_invoice_audit(db: Session, user_name: str, inv_id: str, action: str, before_val=None, after_val=None):
    try:
        entry = AuditLog(
            id=f"aud_{uuid.uuid4().hex[:8]}",
            user_name=user_name,
            entity_type="Invoice",
            entity_id=inv_id,
            action=action,
            before_value=before_val,
            after_value=after_val,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"Invoice audit error: {e}")

from app.access_policy import can_view_customer_price

@invoices_router.get("", response_model=List[InvoiceOut])
@invoices_router.get("/", response_model=List[InvoiceOut])
def get_invoices(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.INVOICES_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(Invoice).options(selectinload(Invoice.customer_rel), selectinload(Invoice.shipment_rel))
    if status:
        query = query.filter(Invoice.status == status)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if search:
        s = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Invoice.invoice_no).like(s),
                func.lower(Invoice.customer_name).like(s),
                func.lower(Invoice.awb).like(s)
            )
        )
    query = query.order_by(desc(Invoice.created_at), Invoice.id)
    response.headers["X-Total-Count"] = str(query.count())
    invoices = query.limit(limit).offset(offset).all()
    out = [InvoiceOut.model_validate(inv) for inv in invoices]
    if not can_view_customer_price(ctx):
        for inv_out in out:
            inv_out.amount = inv_out.gst = inv_out.total = inv_out.paid = inv_out.balance = None
    return out

@invoices_router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.INVOICES_VIEW)),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter((Invoice.id == invoice_id) | (Invoice.invoice_no == invoice_id)).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv_out = InvoiceOut.model_validate(inv)
    if not can_view_customer_price(ctx):
        inv_out.amount = inv_out.gst = inv_out.total = inv_out.paid = inv_out.balance = None
    return inv_out

@invoices_router.post("/{invoice_id}/payments")
def record_invoice_payment(
    invoice_id: str,
    payload: InvoicePaymentCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.INVOICES_EDIT)),
    db: Session = Depends(get_db)
):
    claim = claim_payment_request(db, request, ctx, payload)
    if claim and claim.resource_id:
        inv = db.query(Invoice).filter(Invoice.id == claim.resource_id).first()
        if not inv:
            raise HTTPException(404, "Invoice not found")
        return {"message": "Payment already recorded", "invoice": inv}
    inv = db.query(Invoice).filter((Invoice.id == invoice_id) | (Invoice.invoice_no == invoice_id)).with_for_update().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pay_amt = validate_amount(payload.amount)
    if pay_amt <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")
    if pay_amt > round(inv.total - inv.paid, 2):
        raise HTTPException(status_code=400, detail="Payment exceeds the outstanding invoice balance")
    if not all(value.strip() for value in (payload.payment_method, payload.paid_to, payload.collected_by)):
        raise HTTPException(status_code=400, detail="Payment method, destination account and collector are required")

    payload.reference = (payload.reference or "").strip()
    payload.paid_to = payload.paid_to.strip()
    payload.collected_by = payload.collected_by.strip()
    details = validate_payment(payload.payment_method, payload.paid_to, payload.reference, payload.payment_details, db=db)
    before_paid = inv.paid
    inv.paid = round(inv.paid + pay_amt, 2)
    inv.balance = max(0.0, round(inv.total - inv.paid, 2))
    db.add(PaymentCollection(invoice_id=inv.id, shipment_id=inv.shipment_id,
        date=business_today().isoformat(), amount=pay_amt,
        payment_method=payload.payment_method, paid_to=payload.paid_to,
        collected_by=payload.collected_by, reference=payload.reference, payment_details=details))

    if inv.balance <= 0:
        inv.status = "Paid"
    elif inv.paid > 0:
        inv.status = "Partial"

    # Sync linked shipment payment status
    if inv.shipment_id:
        ship = db.query(Shipment).filter(Shipment.id == inv.shipment_id).first()
        if ship:
            ship.payment_status = inv.status
            ship.payment_method = payload.payment_method
            ship.paid_to = payload.paid_to
            ship.collected_by = payload.collected_by

    finish_payment_request(claim, inv.id)
    create_audit_log(db, ctx["user_id"], ctx["display_name"], "invoices.payment", "invoice", "record_payment",
                     resource_id=inv.id, before_data={"paid": before_paid},
                     after_data={"paid": inv.paid, "balance": inv.balance, "status": inv.status, "reference": payload.reference}, auto_commit=False)
    db.commit()
    db.refresh(inv)
    cache_engine.invalidate_prefix("dashboard_summary")
    cache_engine.invalidate_prefix("shipments:")
    return {"message": "Payment recorded successfully", "invoice": inv}
