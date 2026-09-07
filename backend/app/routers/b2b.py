# ================================================================
# FLY MY CART CRM - B2B & CREDIT RECEIVABLES ROUTER (routers/b2b.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, Shipment, B2BCompany, AuditLog
from app.schemas import B2BCompanyCreate, B2BCompanyOut
from app.finance_engine import calculate_b2b_aging_buckets
from app.auth import create_audit_log
from app.dependencies import require_permission
from app.permissions import PermissionCode

b2b_router = APIRouter(prefix="/api/b2b", tags=["B2B / Credit"])

@b2b_router.get("/summary")
def get_b2b_summary(
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.B2B_VIEW)),
    db: Session = Depends(get_db)
):
    b2b_customers = db.query(Customer).filter(Customer.customer_type == "B2B").all()
    b2b_shipments = db.query(Shipment).filter(Shipment.customer_type == "B2B").all()

    total_credit_sales = sum(s.price for s in b2b_shipments)
    collected = sum(s.price for s in b2b_shipments if s.payment_status == "Paid")
    outstanding = total_credit_sales - collected

    # B2B Aging Buckets calculation
    aging_items = []
    for s in b2b_shipments:
        if s.payment_status != "Paid":
            cust = next((c for c in b2b_customers if c.id == s.customer_id or c.name == s.customer_name), None)
            credit_period = cust.credit_period_days if cust else 30
            aging_items.append({
                "balance": s.price,
                "date": s.date,
                "credit_period_days": credit_period
            })

    aging = calculate_b2b_aging_buckets(aging_items)
    due_this_week = round(aging["days1_30"] * 0.4, 2)
    overdue = aging["overdue_total"]

    companies_table = []
    for c in b2b_customers:
        ships = [s for s in b2b_shipments if s.customer_id == c.id or s.customer_name == c.name]
        c_billed = sum(s.price for s in ships)
        c_paid = sum(s.price for s in ships if s.payment_status == "Paid")
        c_out = c_billed - c_paid
        limit = c.credit_limit or 100000.0
        util_pct = round((c_out / limit) * 100, 1) if limit > 0 else 0.0

        companies_table.append({
            "id": c.id,
            "company": c.company or c.name,
            "contact_name": c.name,
            "mobile": c.mobile,
            "credit_limit": limit,
            "credit_period_days": c.credit_period_days,
            "total_billed": c_billed,
            "total_paid": c_paid,
            "outstanding": c_out,
            "credit_utilized_percent": min(100.0, util_pct),
            "status": "Limit Exceeded" if c_out > limit else ("Payment Due" if c_out > 0 else "Good Standing")
        })

    return {
        "total_credit_sales": total_credit_sales,
        "collected": collected,
        "outstanding": outstanding,
        "due_this_week": due_this_week,
        "overdue": overdue,
        "aging": aging,
        "companies": companies_table
    }

@b2b_router.get("/companies", response_model=List[B2BCompanyOut])
def get_b2b_companies(
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.B2B_VIEW)),
    db: Session = Depends(get_db)
):
    return db.query(B2BCompany).order_by(B2BCompany.company_name).all()

@b2b_router.post("/companies", response_model=B2BCompanyOut)
def create_b2b_company(
    payload: B2BCompanyCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.B2B_ADD)),
    db: Session = Depends(get_db)
):
    existing = db.query(B2BCompany).filter(B2BCompany.company_name == payload.company_name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Company '{payload.company_name}' already registered.")

    comp = B2BCompany(
        company_name=payload.company_name.strip(),
        contact_person=payload.contact_person.strip(),
        mobile=payload.mobile.strip(),
        email=payload.email.strip() if payload.email else None,
        gst_number=payload.gst_number.strip() if payload.gst_number else None,
        billing_address=payload.billing_address.strip() if payload.billing_address else None,
        credit_limit=payload.credit_limit or 100000.0,
        credit_period_days=payload.credit_period_days or 30,
        payment_terms=payload.payment_terms or f"Net {payload.credit_period_days or 30} Days"
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="b2b.create",
        resource_type="b2b_company",
        resource_id=comp.id,
        action="create",
        after_data={"name": comp.company_name},
        ip_address=request.client.host if request.client else None
    )
    return comp
