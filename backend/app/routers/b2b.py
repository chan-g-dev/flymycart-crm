# ================================================================
# FLY MY CART CRM - B2B & CREDIT RECEIVABLES ROUTER (routers/b2b.py)
# ================================================================

import uuid
from collections import defaultdict
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, Shipment, B2BCompany, AuditLog
from app.schemas import B2BCompanyCreate, B2BCompanyOut
from app.collections import shipment_paid_map
from app.finance_engine import calculate_b2b_aging_buckets
from app.auth import create_audit_log
from app.dependencies import require_permission
from app.permissions import PermissionCode

b2b_router = APIRouter(prefix="/api/b2b", tags=["B2B / Credit"])

@b2b_router.get("/summary")
def get_b2b_summary(
    companies_limit: int = Query(100, ge=1, le=500),
    companies_offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.B2B_VIEW)),
    db: Session = Depends(get_db)
):
    try:
        b2b_customers = db.query(Customer).filter(Customer.customer_type == "B2B").all()
        b2b_companies = db.query(B2BCompany).all()
        b2b_shipments = db.query(Shipment.id, Shipment.customer_id, Shipment.customer_name, Shipment.b2b_company_id, Shipment.price, Shipment.date, Shipment.payment_status).filter(
            (Shipment.customer_type == "B2B") | (Shipment.b2b_company_id.isnot(None))
        ).all()

        paid = shipment_paid_map(db)
        total_credit_sales = round(sum(float(s.price or 0.0) for s in b2b_shipments), 2)
        collected = round(sum(paid.get(s.id, 0.0) for s in b2b_shipments), 2)
        outstanding = round(total_credit_sales - collected, 2)

        # Build corporate entity lookup for fast shipment matching
        comp_names_map = {c.company_name.strip().lower(): c for c in b2b_companies if c.company_name}
        comp_ids_map = {c.id: c for c in b2b_companies if c.id}

        customers_by_id = {c.id: c for c in b2b_customers}
        customers_by_name = {c.name.strip().lower(): c for c in b2b_customers if c.name}
        ships_by_customer = defaultdict(dict)
        ships_by_name = defaultdict(dict)
        ships_by_company = defaultdict(dict)
        for ship in b2b_shipments:
            ships_by_customer[ship.customer_id][ship.id] = ship
            ships_by_company[ship.b2b_company_id][ship.id] = ship
            ships_by_name[(ship.customer_name or "").strip().lower()][ship.id] = ship

        # B2B Aging Buckets calculation
        aging_items = []
        for s in b2b_shipments:
            if s.payment_status != "Paid":
                bal = max(0, float(s.price or 0.0) - paid.get(s.id, 0.0))
                if bal <= 0:
                    continue
                # Match to B2BCompany or Customer for credit period
                matching_comp = comp_ids_map.get(s.b2b_company_id) or (comp_names_map.get(s.customer_name.strip().lower()) if s.customer_name else None)
                if matching_comp:
                    credit_period = matching_comp.credit_period_days or 30
                else:
                    cust = customers_by_id.get(s.customer_id) or customers_by_name.get((s.customer_name or "").strip().lower())
                    credit_period = cust.credit_period_days if cust and cust.credit_period_days else 30

                aging_items.append({
                    "balance": bal,
                    "date": s.date,
                    "credit_period_days": credit_period
                })

        aging = calculate_b2b_aging_buckets(aging_items)
        today = datetime.date.today()
        due_this_week = round(sum(item["balance"] for item in aging_items if today <= datetime.date.fromisoformat(item["date"]) + datetime.timedelta(days=item["credit_period_days"]) <= today + datetime.timedelta(days=7)), 2)
        overdue = aging.get("overdue_total", 0.0)

        companies_table = []
        seen_identifiers = set()

        # 1. Add all registered B2B companies from b2b_companies table
        for comp in b2b_companies:
            c_ships = {**ships_by_company[comp.id], **ships_by_name[(comp.company_name or "").strip().lower()]}.values()
            c_billed = round(sum(float(s.price or 0.0) for s in c_ships), 2)
            c_paid = round(sum(paid.get(s.id, 0.0) for s in c_ships), 2)
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

            ships = {**ships_by_customer[c.id], **ships_by_name[(c.name or "").strip().lower()]}.values()
            c_billed = round(sum(float(s.price or 0.0) for s in ships), 2)
            c_paid = round(sum(paid.get(s.id, 0.0) for s in ships), 2)
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

        companies_table.sort(key=lambda item: (item["company"] or "").lower())
        companies_total = len(companies_table)
        return {
            "total_credit_sales": total_credit_sales,
            "collected": collected,
            "outstanding": outstanding,
            "due_this_week": due_this_week,
            "overdue": overdue,
            "aging": aging,
            "companies": companies_table[companies_offset:companies_offset + companies_limit],
            "companies_total": companies_total,
            "companies_limit": companies_limit,
            "companies_offset": companies_offset,
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
            "companies": [],
            "companies_total": 0,
            "companies_limit": companies_limit,
            "companies_offset": companies_offset,
        }

@b2b_router.get("/companies", response_model=List[B2BCompanyOut])
def get_b2b_companies(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.B2B_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(B2BCompany).order_by(B2BCompany.company_name, B2BCompany.id)
    response.headers["X-Total-Count"] = str(query.count())
    return query.limit(limit).offset(offset).all()

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
