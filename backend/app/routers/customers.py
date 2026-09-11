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
    balance = case((func.coalesce(paid.c.total, Shipment.price) > func.coalesce(paid.c.paid, 0), func.coalesce(paid.c.total, Shipment.price) - func.coalesce(paid.c.paid, 0)), else_=0)
    stats = db.query(Shipment.customer_id, func.count(Shipment.id), func.sum(Shipment.price), func.sum(balance)).outerjoin(
        paid, paid.c.shipment_id == Shipment.id).filter(Shipment.customer_id.in_(ids)).group_by(Shipment.customer_id).all() if ids else []
    by_customer = {row[0]: row[1:] for row in stats}
    result = []
    for customer in customer_rows:
        output = CustomerOut.model_validate(customer)
        count, spend, outstanding = by_customer.get(customer.id, (0, 0, 0))
        output.total_bookings = count
        output.total_spend = spend or 0
        output.outstanding_balance = outstanding or 0
        result.append(output)
    return result

@customers_router.get("/lookup")
def lookup_customer_by_mobile(
    mobile: str = Query(..., min_length=4),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    term = f"%{mobile.strip()}%"
    customer = db.query(Customer).filter(Customer.mobile == mobile.strip()).first()
    if not customer:
        return {"found": False, "customer": None}
    return {
        "found": True,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "company": customer.company or "",
            "mobile": customer.mobile,
            "whatsapp": customer.whatsapp or customer.mobile,
            "email": customer.email or "",
            "address": customer.address or "",
            "customer_type": customer.customer_type,
            "center": customer.center,
            "credit_limit": customer.credit_limit,
            "credit_period_days": customer.credit_period_days
        }
    }

@customers_router.get("/{customer_id}/360")
def get_customer_360(
    customer_id: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        customer = db.query(Customer).filter(Customer.name == customer_id).first()
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
    customer_profile = customer if customer else {
        "id": company.id, "name": company.company_name, "company": company.company_name,
        "mobile": company.mobile, "customer_type": "B2B",
        "credit_limit": company.credit_limit, "credit_period_days": company.credit_period_days,
        "documents": [],
    }

    shipments = []
    for s in shipments_raw:
        s_dict = {
            "id": s.id,
            "awb": s.awb,
            "date": s.date,
            "customer_id": s.customer_id,
            "customer_name": s.customer_name,
            "courier": s.courier,
            "service_type": s.service_type,
            "receiver_name": s.receiver_name,
            "receiver_city": s.receiver_city,
            "receiver_country": s.receiver_country,
            "chargeable_weight": s.chargeable_weight,
            "actual_weight": s.actual_weight,
            "price": s.price,
            "provider_cost": s.provider_cost,
            "actual_provider_cost": s.actual_provider_cost,
            "cost_reconciled": s.cost_reconciled,
            "gross_profit": s.gross_profit,
            "payment_status": s.payment_status,
            "payment_method": s.payment_method,
            "status": s.status
        }
        shipments.append(mask_shipment_financials(s_dict, ctx))

    invoices = db.query(Invoice).filter(
        or_(Invoice.customer_id.in_(customer_ids), Invoice.b2b_company_id == company.id) if company else Invoice.customer_id.in_(customer_ids)
    ).order_by(desc(Invoice.created_at)).all()

    followups = db.query(Followup).filter(
        Followup.customer_id.in_(customer_ids)
    ).order_by(desc(Followup.created_at)).all()

    comms = db.query(CommunicationLog).filter(
        CommunicationLog.customer_id.in_(customer_ids)
    ).order_by(desc(CommunicationLog.created_at)).all()

    refunds = db.query(Refund).filter(
        Refund.customer_id.in_(customer_ids)
    ).order_by(desc(Refund.created_at)).all()

    total_spent = sum(s.price for s in shipments_raw)
    paid = shipment_paid_map(db)
    billed = shipment_total_map(db, [s.id for s in shipments_raw])
    total_outstanding = sum(max(0, billed.get(s.id, s.price) - paid.get(s.id, 0)) for s in shipments_raw)

    return {
        "customer": customer_profile,
        "total_bookings": len(shipments_raw),
        "total_spent": total_spent,
        "outstanding_balance": total_outstanding,
        "shipments": shipments,
        "invoices": invoices,
        "followups": followups,
        "communications": comms,
        "refunds": refunds
    }

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
