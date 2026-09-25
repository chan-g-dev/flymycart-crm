from app.customer_types import resolve_customer_type
from app.finance_engine import calculate_gross_profit
# ================================================================
# FLY MY CART CRM - CUSTOMERS ROUTER (routers/customers.py)
# ================================================================

import uuid
from pathlib import PurePosixPath
from urllib.parse import quote
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, File, UploadFile, Form, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, func, or_, case

from app.database import get_db
from app.models import (
    Customer, B2BCompany, Shipment, Invoice, Refund,
    Followup, CommunicationLog, AuditLog
)
from app.collections import shipment_total_map, shipment_paid_map, shipment_payments_query
from app.schemas import CustomerCreate, CustomerOut
from app.auth import get_current_user_context, create_audit_log, mask_shipment_financials
from app.dependencies import require_permission, get_current_session_context
from app.permissions import PermissionCode
from app.cache import cache_engine
from app.storage import storage_manager
from app.access_policy import can_view_customer_price

customers_router = APIRouter(prefix="/api/customers", tags=["Customers"])

def log_customer_audit(db: Session, user_name: str, cust_id: str, action: str, before_val=None, after_val=None):
    try:
        entry = AuditLog(
            id=f"aud_{uuid.uuid4().hex[:8]}",
            user_name=user_name,
            entity_type="Customer",
            entity_id=cust_id,
            action=action,
            before_value=before_val,
            after_value=after_val,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"Customer audit logging error: {e}")

@customers_router.get("", response_model=List[CustomerOut])
@customers_router.get("/", response_model=List[CustomerOut])
def get_customers(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    center: Optional[str] = None,
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(Customer)
    if center and center != "All Centers":
        query = query.filter(Customer.center == center)
    if customer_type:
        query = query.filter(Customer.customer_type == customer_type)
    if search:
        s = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Customer.name).like(s),
                Customer.mobile.like(s),
                func.lower(Customer.company).like(s),
                func.lower(Customer.email).like(s)
            )
        )
    query = query.order_by(desc(Customer.created_at), Customer.id)
    response.headers["X-Total-Count"] = str(query.count())
    query = query.limit(limit).offset(offset)
    customer_rows = query.all()
    ids = [customer.id for customer in customer_rows]
    paid = shipment_payments_query(db).subquery()
    billed_total = func.coalesce(Shipment.total_amount, Shipment.price + func.coalesce(Shipment.gst_amount, 0))
    balance = case((func.coalesce(paid.c.total, billed_total) > func.coalesce(paid.c.paid, 0), func.coalesce(paid.c.total, billed_total) - func.coalesce(paid.c.paid, 0)), else_=0)
    stats = db.query(Shipment.customer_id, func.count(Shipment.id), func.sum(billed_total), func.sum(balance)).outerjoin(
        paid, paid.c.shipment_id == Shipment.id).filter(Shipment.customer_id.in_(ids)).group_by(Shipment.customer_id).all() if ids else []
    by_customer = {row[0]: row[1:] for row in stats}
    result = []
    for customer in customer_rows:
        output = CustomerOut.model_validate(customer)
        count, spend, outstanding = by_customer.get(customer.id, (0, 0, 0))
        output.total_bookings = count
        output.total_spend = spend or 0
        output.outstanding_balance = outstanding or 0
        if not can_view_customer_price(ctx):
            output.total_spend = output.outstanding_balance = None
        result.append(output)
    return result

@customers_router.get("/lookup")
def lookup_customer_by_mobile(
    mobile: str = Query("", max_length=150),
    customer_type: Optional[str] = Query(None),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    raw_query = mobile.strip()
    digits_only = "".join(filter(str.isdigit, raw_query))
    if len(raw_query) < 2 and not (not raw_query and customer_type == "B2B"):
        return {"found": False, "customer": None, "matches": []}
    matches = []
    seen_ids = set()
    seen_companies = set()

    def add_customer(c, is_b2b_entity=False):
        cid = f"b2b_{c.id}" if is_b2b_entity else c.id
        if cid in seen_ids:
            return
        seen_ids.add(cid)
        if is_b2b_entity:
            if c.id in seen_companies:
                return
            matches.append({
                "id": c.id,
                "customer_id": None,
                "b2b_company_id": c.id,
                "name": c.contact_person or c.company_name,
                "company": c.company_name,
                "mobile": c.mobile,
                "whatsapp": c.mobile,
                "email": c.email or "",
                "address": c.billing_address or "",
                "id_proof": c.gst_number or "",
                "id_proof_front": "",
                "id_proof_back": "",
                "customer_type": "B2B",
                "center": "Main Hub (Bangalore)",
                "credit_limit": c.credit_limit,
                "credit_period_days": c.credit_period_days,
                "is_b2b_corporate": True
            })
        else:
            if c.b2b_company_id:
                seen_companies.add(c.b2b_company_id)
            matches.append({
                "id": c.id,
                "customer_id": c.id,
                "b2b_company_id": c.b2b_company_id,
                "name": c.name,
                "company": c.company or "",
                "mobile": c.mobile,
                "whatsapp": c.whatsapp or c.mobile,
                "email": c.email or "",
                "address": c.address or "",
                "id_proof": c.id_proof or "",
                "id_proof_front": getattr(c, "id_proof_front", None) or "",
                "id_proof_back": getattr(c, "id_proof_back", None) or "",
                "customer_type": c.customer_type or "C2C",
                "center": c.center,
                "credit_limit": c.credit_limit,
                "credit_period_days": c.credit_period_days,
                "is_b2b_corporate": False
            })

    # 1. Search Customer table
    cust_conditions = []
    if digits_only and len(digits_only) >= 4:
        last10 = digits_only[-10:] if len(digits_only) >= 10 else digits_only
        cust_conditions.extend([
            Customer.mobile.like(f"%{digits_only}%"),
            Customer.mobile.like(f"%{last10}%"),
            Customer.whatsapp.like(f"%{digits_only}%")
        ])
    if len(raw_query) >= 2:
        q_like = f"%{raw_query.lower()}%"
        cust_conditions.extend([
            func.lower(Customer.name).like(q_like),
            func.lower(Customer.company).like(q_like),
            func.lower(Customer.email).like(q_like)
        ])

    cust_q = db.query(Customer)
    if customer_type and customer_type != 'All':
        cust_q = cust_q.filter(Customer.customer_type == customer_type)
    if cust_conditions:
        cust_q = cust_q.filter(or_(*cust_conditions))
    
    for c in cust_q.order_by(desc(Customer.created_at)).limit(15).all():
        add_customer(c, is_b2b_entity=False)

    # 2. Search B2BCompany table
    b2b_conditions = []
    if digits_only and len(digits_only) >= 4:
        last10 = digits_only[-10:] if len(digits_only) >= 10 else digits_only
        b2b_conditions.extend([
            B2BCompany.mobile.like(f"%{digits_only}%"),
            B2BCompany.mobile.like(f"%{last10}%")
        ])
    if len(raw_query) >= 2:
        q_like = f"%{raw_query.lower()}%"
        b2b_conditions.extend([
            func.lower(B2BCompany.company_name).like(q_like),
            func.lower(B2BCompany.contact_person).like(q_like),
            func.lower(B2BCompany.email).like(q_like),
            func.lower(B2BCompany.gst_number).like(q_like)
        ])

    if customer_type in (None, "All", "B2B"):
        b2b_query = db.query(B2BCompany)
        if b2b_conditions:
            b2b_query = b2b_query.filter(or_(*b2b_conditions))
        for b in b2b_query.order_by(desc(B2BCompany.created_at)).limit(10).all():
            add_customer(b, is_b2b_entity=True)

    primary = matches[0] if matches else None
    return {
        "found": bool(primary),
        "customer": primary,
        "matches": matches
    }

@customers_router.get("/{customer_id}/360")
def get_customer_360(
    customer_id: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        customer = db.query(Customer).filter(func.lower(Customer.name) == customer_id.strip().lower()).first()
    company = None
    if not customer:
        company = db.query(B2BCompany).filter(B2BCompany.id == customer_id).first()
    if not customer and not company:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    customer_ids = [customer.id] if customer else [row.id for row in db.query(Customer).filter(
        or_(Customer.b2b_company_id == company.id,
            func.lower(Customer.company) == company.company_name.strip().lower(),
            func.lower(Customer.name) == company.company_name.strip().lower())
    ).all()]
    shipment_filter = Shipment.customer_id.in_(customer_ids)
    if company:
        shipment_filter = or_(shipment_filter, Shipment.b2b_company_id == company.id)
    shipments_raw = db.query(Shipment).filter(shipment_filter).order_by(desc(Shipment.created_at)).all()

    cust_dict = {
        "id": customer.id if customer else company.id,
        "name": customer.name if customer else company.company_name,
        "company": customer.company if customer else company.company_name,
        "mobile": customer.mobile if customer else company.mobile,
        "whatsapp": (customer.whatsapp or customer.mobile) if customer else company.mobile,
        "email": (customer.email if customer else company.email) or "",
        "address": (customer.address if customer else company.billing_address) or "",
        "id_proof": (customer.id_proof if customer else None) or "",
        "customer_type": customer.customer_type if customer else "B2B",
        "center": customer.center if customer else "Main Hub (Bangalore)",
        "assigned_employee": customer.assigned_employee if customer else "Nawaz",
        "credit_limit": float(customer.credit_limit if customer else company.credit_limit or 0),
        "credit_period_days": int(customer.credit_period_days if customer else company.credit_period_days or 30),
        "documents": customer.documents if customer and customer.documents else [],
        "created_at": customer.created_at.isoformat() if customer and customer.created_at else None
    }

    refunds_by_awb = dict(
        db.query(func.lower(Refund.awb), func.sum(Refund.amount))
        .filter(Refund.status.in_(["Approved", "Refunded"]))
        .group_by(func.lower(Refund.awb))
        .all()
    )

    shipments = []
    for s in shipments_raw:
        s_awb = (s.awb or "").lower().strip()
        s_refund = float(refunds_by_awb.get(s_awb, 0) or 0)
        billed_val = getattr(s, "total_amount", None)
        if billed_val is None:
            billed_val = (s.price or 0.0) + (getattr(s, "gst_amount", 0.0) or 0.0)
        base_gp = calculate_gross_profit(s.price or 0, s.provider_cost, s.actual_provider_cost, s.cost_reconciled)
        s_dict = {
            "id": s.id,
            "awb": s.awb,
            "date": s.date,
            "pickup_date": s.pickup_date,
            "delivery_date": s.delivery_date,
            "customer_id": s.customer_id,
            "customer_name": s.customer_name,
            "courier": s.courier,
            "service_type": s.service_type,
            "receiver_name": s.receiver_name,
            "receiver_city": s.receiver_city,
            "receiver_country": s.receiver_country,
            "chargeable_weight": s.chargeable_weight,
            "actual_weight": s.actual_weight,
            "volumetric_weight": s.volumetric_weight,
            "price": s.price,
            "is_gst_applicable": getattr(s, "is_gst_applicable", True),
            "gst_rate": getattr(s, "gst_rate", 18.0) or 0.0,
            "gst_amount": getattr(s, "gst_amount", 0.0) or 0.0,
            "total_amount": billed_val,
            "provider_cost": s.provider_cost,
            "actual_provider_cost": s.actual_provider_cost,
            "cost_reconciled": s.cost_reconciled,
            "gross_profit": round(base_gp - s_refund, 2),
            "refund_amount": s_refund,
            "payment_status": s.payment_status,
            "payment_method": s.payment_method,
            "paid_to": getattr(s, "paid_to", None),
            "collected_by": getattr(s, "collected_by", None),
            "domestic_international": s.domestic_international,
            "is_ddp": bool(getattr(s, "is_ddp", False)),
            "status": s.status,
            "entity": getattr(s, "entity", "Globe Courier") or "Globe Courier"
        }
        shipments.append(mask_shipment_financials(s_dict, ctx))

    invoices = []
    try:
        inv_filter = or_(Invoice.customer_id.in_(customer_ids), Invoice.b2b_company_id == company.id) if company else Invoice.customer_id.in_(customer_ids)
        inv_rows = db.query(Invoice).options(selectinload(Invoice.shipment_rel), selectinload(Invoice.customer_rel)).filter(inv_filter).order_by(desc(Invoice.created_at)).all()
        for inv in inv_rows:
            is_ddp = bool(getattr(inv.shipment_rel, 'is_ddp', False)) if inv.shipment_rel else False
            invoices.append({
                "id": inv.id,
                "invoice_no": inv.invoice_no,
                "date": inv.date,
                "amount": float(inv.amount or 0),
                "gst": float(inv.gst or 0),
                "total": float(inv.total or 0),
                "paid": float(inv.paid or 0),
                "balance": float(inv.balance or 0),
                "status": inv.status or "Due",
                "awb": inv.awb,
                "courier": inv.courier,
                "service": inv.service,
                "customer_name": inv.customer_name or (customer.name if customer else ""),
                "customer_phone": getattr(inv, 'customer_phone', None) or (getattr(customer, 'whatsapp', None) or getattr(customer, 'mobile', None) or ""),
                "customer_id": inv.customer_id,
                "is_gst_invoice": bool(inv.is_gst_invoice) if inv.is_gst_invoice is not None else True,
                "tax_rate": float(inv.tax_rate or 18.0),
                "cgst": float(inv.cgst or 0),
                "sgst": float(inv.sgst or 0),
                "igst": float(inv.igst or 0),
                "description": inv.description or "",
                "is_ddp": is_ddp
            })
    except Exception as e:
        import traceback
        traceback.print_exc()
        invoices = []

    followups = []
    try:
        fu_rows = db.query(Followup).filter(Followup.customer_id.in_(customer_ids)).order_by(desc(Followup.created_at)).all()
        for fu in fu_rows:
            followups.append({
                "id": fu.id, "customer": fu.customer, "category": fu.category,
                "due_date": fu.due_date, "priority": fu.priority, "status": fu.status,
                "channel_action": fu.channel_action, "notes": fu.notes
            })
    except Exception:
        followups = []

    comms = []
    try:
        comm_rows = db.query(CommunicationLog).filter(CommunicationLog.customer_id.in_(customer_ids)).order_by(desc(CommunicationLog.created_at)).all()
        for c_log in comm_rows:
            comms.append({
                "id": c_log.id, "customer": c_log.customer, "date": c_log.date,
                "channel": c_log.channel, "staff": c_log.staff, "message": c_log.message, "status": c_log.status
            })
    except Exception:
        comms = []

    refunds = []
    try:
        ref_rows = db.query(Refund).filter(Refund.customer_id.in_(customer_ids)).order_by(desc(Refund.created_at)).all()
        for ref in ref_rows:
            refunds.append({
                "id": ref.id, "customer": ref.customer, "awb": ref.awb,
                "amount": float(ref.amount or 0), "reason": ref.reason,
                "status": ref.status, "request_date": ref.request_date
            })
    except Exception:
        refunds = []

    try:
        paid = shipment_paid_map(db)
        billed = shipment_total_map(db, [s.id for s in shipments_raw])
        total_spent = sum(billed.get(s.id, float(s.total_amount or s.price or 0)) for s in shipments_raw)
        total_outstanding = sum(max(0, billed.get(s.id, float(s.total_amount or s.price or 0)) - paid.get(s.id, 0)) for s in shipments_raw)
    except Exception:
        total_spent = sum(float(s.total_amount or s.price or 0) for s in shipments_raw)
        total_outstanding = 0.0

    if not can_view_customer_price(ctx):
        for invoice in invoices:
            for key in ('amount', 'gst', 'total', 'paid', 'balance'):
                invoice[key] = None
        for refund in refunds:
            refund['amount'] = None
        total_spent = total_outstanding = None

    return {
        "customer": cust_dict,
        "total_bookings": len(shipments_raw),
        "total_spent": total_spent,
        "outstanding_balance": total_outstanding,
        "shipments": shipments,
        "invoices": invoices,
        "followups": followups,
        "communications": comms,
        "refunds": refunds
    }

@customers_router.post("", response_model=CustomerOut)
@customers_router.post("/", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_ADD)),
    db: Session = Depends(get_db)
):
    existing = db.query(Customer).filter(Customer.mobile == payload.mobile.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with mobile {payload.mobile} already exists: {existing.name}")

    payload.customer_type = resolve_customer_type(db, payload.customer_type)
    cust_id = f"cust_{uuid.uuid4().hex[:16]}"
    new_customer = Customer(
        id=cust_id,
        name=payload.name.strip(),
        company=payload.company.strip() if payload.company else None,
        mobile=payload.mobile.strip(),
        whatsapp=payload.whatsapp.strip() if payload.whatsapp else payload.mobile.strip(),
        email=payload.email.strip() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        id_proof=payload.id_proof.strip() if payload.id_proof else None,
        customer_type=payload.customer_type,
        source=payload.source or "Walk-in",
        center=payload.center or "Main Hub (Bangalore)",
        assigned_employee=payload.assigned_employee or "Nawaz",
        credit_limit=payload.credit_limit or 0.0,
        credit_period_days=payload.credit_period_days or 30
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)

    cache_engine.invalidate_prefix("dashboard_summary")
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="customers.create",
        resource_type="customer",
        resource_id=cust_id,
        action="create",
        after_data={"name": new_customer.name, "mobile": new_customer.mobile},
        ip_address=request.client.host if request.client else None
    )
    return new_customer

@customers_router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: str,
    payload: CustomerCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_EDIT)),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    payload.customer_type = resolve_customer_type(db, payload.customer_type, customer.customer_type)
    before_val = {"name": customer.name, "mobile": customer.mobile, "company": customer.company}

    customer.name = payload.name.strip()
    customer.company = payload.company.strip() if payload.company else None
    customer.mobile = payload.mobile.strip()
    customer.whatsapp = payload.whatsapp.strip() if payload.whatsapp else payload.mobile.strip()
    customer.email = payload.email.strip() if payload.email else None
    customer.address = payload.address.strip() if payload.address else None
    customer.id_proof = payload.id_proof.strip() if payload.id_proof else None
    customer.customer_type = payload.customer_type
    customer.center = payload.center or customer.center
    customer.assigned_employee = payload.assigned_employee or customer.assigned_employee
    customer.credit_limit = payload.credit_limit or 0.0
    customer.credit_period_days = payload.credit_period_days or 30

    db.commit()
    db.refresh(customer)

    cache_engine.invalidate_prefix("dashboard_summary")
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="customers.update",
        resource_type="customer",
        resource_id=customer_id,
        action="update",
        before_data=before_val,
        after_data={"name": customer.name, "mobile": customer.mobile},
        ip_address=request.client.host if request.client else None
    )
    return customer

@customers_router.delete("/{customer_id}")
def delete_customer(
    customer_id: str,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_DELETE)),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    c_name = customer.name
    db.query(CommunicationLog).filter(
        CommunicationLog.customer_id == customer.id
    ).delete(synchronize_session=False)
    db.query(Refund).filter(
        Refund.customer_id == customer.id
    ).delete(synchronize_session=False)

    db.delete(customer)
    db.commit()

    cache_engine.invalidate_prefix("dashboard_summary")
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="customers.delete",
        resource_type="customer",
        resource_id=customer_id,
        action="delete",
        before_data={"name": c_name},
        ip_address=request.client.host if request.client else None
    )
    return {"message": "Customer and associated records deleted successfully"}


@customers_router.post("/{customer_id}/documents")
async def upload_customer_document(
    customer_id: str,
    file: Optional[UploadFile] = File(None),
    doc_name: str = Form("Customs KYC Document"),
    doc_type: str = Form("KYC Verification"),
    notes: Optional[str] = Form(None),
    ctx: Dict[str, Any] = Depends(require_permission("customers.edit")),
    db: Session = Depends(get_db)
):
    """
    Accepts customer KYC and customs compliance documents, saves file to storage,
    and updates customer profile in CRM.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    doc_url = None
    file_name = None
    if file:
        file_bytes = await file.read(10 * 1024 * 1024 + 1)
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(413, "Documents must be at most 10 MB")
        clean_fname = PurePosixPath((file.filename or "document").replace("\\", "/")).name.replace(" ", "_")
        file_name = clean_fname
        content_type = file.content_type or "application/pdf"
        doc_url = storage_manager.upload_file(file_bytes, f"kyc/{customer.id}/{uuid.uuid4().hex}/{clean_fname}", content_type)

    doc_record = {
        "id": f"doc_{uuid.uuid4().hex[:8]}",
        "name": doc_name,
        "type": doc_type,
        "url": doc_url,
        "file_name": file_name,
        "status": "Under Review",
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
        "uploaded_by": ctx.get("display_name", "Customer"),
        "notes": notes or "Submitted for KYC and export compliance verification."
    }

    current_docs = list(customer.documents or [])
    current_docs.insert(0, doc_record)
    customer.documents = current_docs
    db.commit()
    db.refresh(customer)

    cache_engine.invalidate_prefix("dashboard_summary")

    log_customer_audit(
        db=db,
        user_name=ctx.get("display_name", "User"),
        cust_id=customer.id,
        action="DOCUMENT_UPLOAD",
        after_val=doc_record
    )

    return {"status": "success", "document": doc_record, "documents": customer.documents}


@customers_router.get("/{customer_id}/documents")
def get_customer_documents(
    customer_id: str,
    ctx: Dict[str, Any] = Depends(require_permission("customers.view")),
    db: Session = Depends(get_db)
):
    """Returns all compliance and KYC documents attached to the customer."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return customer.documents or []



@customers_router.get("/{customer_id}/documents/{document_id}/download")
def download_customer_document(customer_id: str, document_id: str,
    ctx: Dict[str, Any] = Depends(require_permission("customers.view")),
    db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    document = next((d for d in (customer.documents or []) if d.get('id') == document_id), None)
    if not document or not (document.get('url') or document.get('file_url')):
        raise HTTPException(404, "Document not found")
    content = storage_manager.download_file(document.get('url') or document.get('file_url'))
    name = quote(document.get('file_name') or document.get('filename') or 'document', safe='')
    return Response(content, media_type='application/octet-stream', headers={
        'Content-Disposition': "attachment; filename*=UTF-8''" + name,
        'Cache-Control': 'no-store'})
