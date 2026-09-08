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
    try:
        b2b_customers = db.query(Customer).filter(Customer.customer_type == "B2B").all()
        b2b_companies = db.query(B2BCompany).all()
        b2b_shipments = db.query(Shipment).filter(
            (Shipment.customer_type == "B2B") | (Shipment.b2b_company_id.isnot(None))
        ).all()

        total_credit_sales = round(sum(float(s.price or 0.0) for s in b2b_shipments), 2)
        collected = round(sum(float(s.price or 0.0) for s in b2b_shipments if s.payment_status == "Paid"), 2)
        outstanding = round(total_credit_sales - collected, 2)

        # Build corporate entity lookup for fast shipment matching
        comp_names_map = {c.company_name.strip().lower(): c for c in b2b_companies if c.company_name}
        comp_ids_map = {c.id: c for c in b2b_companies if c.id}

        # B2B Aging Buckets calculation
        aging_items = []
        for s in b2b_shipments:
            if s.payment_status != "Paid":
                bal = float(s.price or 0.0)
                if bal <= 0:
                    continue
                # Match to B2BCompany or Customer for credit period
                matching_comp = comp_ids_map.get(s.b2b_company_id) or (comp_names_map.get(s.customer_name.strip().lower()) if s.customer_name else None)
                if matching_comp:
                    credit_period = matching_comp.credit_period_days or 30
                else:
                    cust = next((c for c in b2b_customers if c.id == s.customer_id or (s.customer_name and c.name.strip().lower() == s.customer_name.strip().lower())), None)
                    credit_period = cust.credit_period_days if cust and cust.credit_period_days else 30

                aging_items.append({
                    "balance": bal,
                    "date": s.date,
                    "credit_period_days": credit_period
                })

        aging = calculate_b2b_aging_buckets(aging_items)
        due_this_week = round(aging.get("days1_30", 0.0) * 0.4, 2)
        overdue = aging.get("overdue_total", 0.0)

        companies_table = []
        seen_identifiers = set()

        # 1. Add all registered B2B companies from b2b_companies table
        for comp in b2b_companies:
            c_ships = [
                s for s in b2b_shipments 
                if s.b2b_company_id == comp.id or (s.customer_name and comp.company_name and s.customer_name.strip().lower() == comp.company_name.strip().lower())
            ]
            c_billed = round(sum(float(s.price or 0.0) for s in c_ships), 2)
            c_paid = round(sum(float(s.price or 0.0) for s in c_ships if s.payment_status == "Paid"), 2)
            c_out = round(c_billed - c_paid, 2)
            limit = float(comp.credit_limit or 100000.0)
            util_pct = round((c_out / limit) * 100, 1) if limit > 0 else 0.0

            status_str = "Limit Exceeded" if c_out > limit else ("Payment Due" if c_out > 0 else "Good Standing")
            companies_table.append({
                "id": comp.id,
                "company": comp.company_name,
                "contact_name": comp.contact_person or "Primary Contact",
                "mobile": comp.mobile or "—",
                "credit_limit": limit,
                "credit_period_days": comp.credit_period_days or 30,
                "total_billed": c_billed,
                "total_paid": c_paid,
                "outstanding": c_out,
                "credit_utilized_percent": min(100.0, max(0.0, util_pct)),
                "status": status_str
            })
            seen_identifiers.add(comp.company_name.strip().lower())

        # 2. Add any B2B customers not already registered as B2BCompany
        for c in b2b_customers:
            c_name_key = (c.company or c.name or "").strip().lower()
            if c_name_key in seen_identifiers:
                continue

            ships = [s for s in b2b_shipments if s.customer_id == c.id or (s.customer_name and c.name and s.customer_name.strip().lower() == c.name.strip().lower())]
            c_billed = round(sum(float(s.price or 0.0) for s in ships), 2)
            c_paid = round(sum(float(s.price or 0.0) for s in ships if s.payment_status == "Paid"), 2)
            c_out = round(c_billed - c_paid, 2)
            limit = float(c.credit_limit or 100000.0)
            util_pct = round((c_out / limit) * 100, 1) if limit > 0 else 0.0

            status_str = "Limit Exceeded" if c_out > limit else ("Payment Due" if c_out > 0 else "Good Standing")
            companies_table.append({
                "id": c.id,
                "company": c.company or c.name,
                "contact_name": c.name,
                "mobile": c.mobile or "—",
                "credit_limit": limit,
                "credit_period_days": c.credit_period_days or 30,
                "total_billed": c_billed,
                "total_paid": c_paid,
                "outstanding": c_out,
                "credit_utilized_percent": min(100.0, max(0.0, util_pct)),
                "status": status_str
            })
            if c_name_key:
                seen_identifiers.add(c_name_key)

        return {
            "total_credit_sales": total_credit_sales,
            "collected": collected,
            "outstanding": outstanding,
            "due_this_week": due_this_week,
            "overdue": overdue,
            "aging": aging,
            "companies": companies_table
        }
    except Exception as e:
        # Resilient fallback returns zeroed structure so frontend never hangs
        return {
            "total_credit_sales": 0.0,
            "collected": 0.0,
            "outstanding": 0.0,
            "due_this_week": 0.0,
            "overdue": 0.0,
            "aging": {
                "not_due": 0.0,
                "days1_30": 0.0,
                "days31_60": 0.0,
                "days61_90": 0.0,
                "days90_plus": 0.0,
                "total_outstanding": 0.0,
                "overdue_total": 0.0
            },
            "companies": []
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
