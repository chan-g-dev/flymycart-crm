# ================================================================
# FLY MY CART CRM - CUSTOMERS ROUTER (routers/customers.py)
# ================================================================

import uuid
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, File, UploadFile, Form
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import (
    Customer, Shipment, Invoice, Refund,
    Followup, CommunicationLog, AuditLog
)
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
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(Customer).options(selectinload(Customer.shipments))
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
    customers = query.order_by(desc(Customer.created_at)).all()

    res = []
    for c in customers:
        c_dict = CustomerOut.model_validate(c)
        c_dict.total_bookings = len(c.shipments)
        c_dict.total_spend = sum(s.price for s in c.shipments)
        c_dict.outstanding_balance = sum(
            s.price for s in c.shipments if s.payment_status in ["B2B Credit", "Unpaid", "Due"]
        )
        res.append(c_dict)
    return res

@customers_router.get("/lookup")
def lookup_customer_by_mobile(
    mobile: str = Query(..., min_length=4),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.CUSTOMERS_VIEW)),
    db: Session = Depends(get_db)
):
    term = f"%{mobile.strip()}%"
    customer = db.query(Customer).filter(Customer.mobile.like(term)).first()
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
    if not customer:
        raise HTTPException(status_code=404, detail="Customer profile not found")

    shipments_raw = db.query(Shipment).filter(
        or_(Shipment.customer_id == customer.id, Shipment.customer_name == customer.name)
    ).order_by(desc(Shipment.created_at)).all()

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
        or_(Invoice.customer_id == customer.id, Invoice.customer_name == customer.name)
    ).order_by(desc(Invoice.created_at)).all()

    followups = db.query(Followup).filter(
        or_(Followup.customer_id == customer.id, Followup.customer == customer.name)
    ).order_by(desc(Followup.created_at)).all()

    comms = db.query(CommunicationLog).filter(
        or_(CommunicationLog.customer_id == customer.id, CommunicationLog.customer == customer.name)
    ).order_by(desc(CommunicationLog.created_at)).all()

    refunds = db.query(Refund).filter(
        or_(Refund.customer_id == customer.id, Refund.customer == customer.name)
    ).order_by(desc(Refund.created_at)).all()

    total_spent = sum(s.price for s in shipments_raw)
    total_outstanding = sum(s.price for s in shipments_raw if s.payment_status in ["B2B Credit", "Unpaid", "Due"])

    return {
        "customer": customer,
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

    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
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
        or_(CommunicationLog.customer_id == customer.id, CommunicationLog.customer == customer.name)
    ).delete(synchronize_session=False)
    db.query(Refund).filter(
        or_(Refund.customer_id == customer.id, Refund.customer == customer.name)
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
    ctx: Dict[str, Any] = Depends(get_current_session_context),
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
        file_bytes = await file.read()
        clean_fname = file.filename.replace(" ", "_") if file.filename else f"doc_{uuid.uuid4().hex[:6]}.pdf"
        file_name = clean_fname
        content_type = file.content_type or "application/pdf"
        doc_url = storage_manager.upload_file(file_bytes, f"kyc/{customer.id}_{clean_fname}", content_type)

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
    ctx: Dict[str, Any] = Depends(get_current_session_context),
    db: Session = Depends(get_db)
):
    """Returns all compliance and KYC documents attached to the customer."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return customer.documents or []

