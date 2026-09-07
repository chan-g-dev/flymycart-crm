# ================================================================
# FLY MY CART CRM - GLOBAL SEARCH ROUTER (routers/search.py)
# ================================================================

from typing import Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database import get_db
from app.models import Customer, Shipment, Invoice
from app.dependencies import require_permission
from app.permissions import PermissionCode

search_router = APIRouter(prefix="/api/search", tags=["Global Search"])

@search_router.get("/")
def global_search(
    q: str = Query(..., min_length=1, description="Search query for AWB, customer, mobile, or invoice"),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.SEARCH_GLOBAL)),
    db: Session = Depends(get_db)
):
    """
    Unified multi-entity global search across Shipments, Customers, and Invoices.
    """
    term = f"%{q.strip().lower()}%"

    # Search Shipments
    shipments = db.query(Shipment).filter(
        or_(
            func.lower(Shipment.awb).like(term),
            func.lower(Shipment.customer_name).like(term),
            func.lower(Shipment.receiver_name).like(term),
            func.lower(Shipment.receiver_city).like(term),
            Shipment.sender_phone.like(term),
            Shipment.receiver_phone.like(term)
        )
    ).limit(8).all()

    # Search Customers
    customers = db.query(Customer).filter(
        or_(
            func.lower(Customer.name).like(term),
            func.lower(Customer.company).like(term),
            Customer.mobile.like(term),
            func.lower(Customer.email).like(term)
        )
    ).limit(6).all()

    # Search Invoices
    invoices = db.query(Invoice).filter(
        or_(
            func.lower(Invoice.invoice_no).like(term),
            func.lower(Invoice.customer_name).like(term),
            func.lower(Invoice.awb).like(term)
        )
    ).limit(6).all()

    return {
        "query": q,
        "shipments": [
            {
                "id": s.id,
                "awb": s.awb,
                "date": s.date,
                "customer_name": s.customer_name,
                "courier": s.courier,
                "destination": f"{s.receiver_city}, {s.receiver_country}",
                "price": s.price,
                "status": s.status,
                "payment_status": s.payment_status
            } for s in shipments
        ],
        "customers": [
            {
                "id": c.id,
                "name": c.name,
                "company": c.company or "-",
                "mobile": c.mobile,
                "customer_type": c.customer_type,
                "center": c.center
            } for c in customers
        ],
        "invoices": [
            {
                "id": i.id,
                "invoice_no": i.invoice_no,
                "date": i.date,
                "customer_name": i.customer_name,
                "awb": i.awb,
                "total": i.total,
                "paid": i.paid,
                "balance": i.balance,
                "status": i.status
            } for i in invoices
        ]
    }
