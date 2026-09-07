# ================================================================
# FLY MY CART CRM - DASHBOARD & ANALYTICS ROUTER (routers/dashboard.py)
# ================================================================

import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import Shipment, Followup, Refund
from app.auth import mask_shipment_financials
from app.dependencies import require_permission
from app.permissions import PermissionCode
from app.cache import cache_engine

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@dashboard_router.get("/summary")
def get_dashboard_summary(
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.DASHBOARDS_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Returns real-time dashboard analytics with 15-second TTL caching.
    Automatically masks financial data for unauthorized staff roles.
    """
    cache_key = f"dashboard_summary:{ctx.get('user_id', 'super_admin')}"
    cached_summary = cache_engine.get(cache_key)
    if cached_summary:
        return cached_summary

    today_str = datetime.date.today().isoformat()

    all_shipments = db.query(Shipment).all()
    today_shipments = [s for s in all_shipments if s.date == today_str]
    today_count = len(today_shipments)

    # Today's courier breakdown & daily sales totals
    courier_counts = {}
    today_sales = 0.0
    today_collected = 0.0

    for s in today_shipments:
        courier_counts[s.courier] = courier_counts.get(s.courier, 0) + 1
        today_sales += (s.price or 0.0)
        if s.payment_status == "Paid":
            today_collected += (s.price or 0.0)
        elif s.payment_status == "Partial":
            today_collected += round((s.price or 0.0) * 0.5)

    courier_breakdown = " | ".join([f"{c} {cnt}" for c, cnt in courier_counts.items()]) if courier_counts else "No bookings today yet"

    # Operational status aggregations
    in_transit_count = sum(1 for s in all_shipments if s.status in ["In Transit", "Picked Up", "Booked"])
    delivered_count = sum(1 for s in all_shipments if s.status == "Delivered")
    active_volume = in_transit_count + sum(1 for s in all_shipments if s.status == "Delayed")

    # Active operational courier distribution across active fleet
    active_courier_counts = {}
    for s in all_shipments:
        if s.courier:
            active_courier_counts[s.courier] = active_courier_counts.get(s.courier, 0) + 1

    total_sales = sum(s.price or 0.0 for s in all_shipments)
    total_collected = sum(
        (s.price or 0.0) if s.payment_status == "Paid"
        else (round((s.price or 0.0) * 0.5) if s.payment_status == "Partial" else 0.0)
        for s in all_shipments
    )

    # B2B Outstanding receivables
    b2b_shipments = [s for s in all_shipments if s.customer_type == "B2B"]
    b2b_outstanding = sum(s.price for s in b2b_shipments if s.payment_status in ["B2B Credit", "Unpaid", "Due"])

    # Pending follow-ups & refund requests
    followups_due = db.query(Followup).filter(Followup.status == "Pending", Followup.due_date <= today_str).count()
    refunds_pending = db.query(Refund).filter(Refund.status.in_(["Requested", "Approved"])).count()

    # Recent shipments with RBAC financial masking
    recent_shipments_raw = db.query(Shipment).order_by(desc(Shipment.created_at)).limit(10).all()
    recent_shipments = []
    for s in recent_shipments_raw:
        s_dict = {
            "id": s.id,
            "awb": s.awb,
            "date": s.date,
            "pickup_date": s.pickup_date,
            "delivery_date": s.delivery_date,
            "customer_id": s.customer_id,
            "customer_name": s.customer_name,
            "customer_type": s.customer_type,
            "center": s.center,
            "employee": s.employee,
            "courier": s.courier,
            "domestic_international": s.domestic_international,
            "service_type": s.service_type,
            "receiver_name": s.receiver_name,
            "receiver_city": s.receiver_city,
            "receiver_country": s.receiver_country,
            "actual_weight": s.actual_weight,
            "volumetric_weight": s.volumetric_weight,
            "chargeable_weight": s.chargeable_weight,
            "price": s.price,
            "provider_cost": s.provider_cost,
            "actual_provider_cost": s.actual_provider_cost,
            "cost_reconciled": s.cost_reconciled,
            "gross_profit": s.gross_profit,
            "payment_status": s.payment_status,
            "payment_method": s.payment_method,
            "paid_to": s.paid_to,
            "collected_by": s.collected_by,
            "status": s.status,
            "delay_reason": s.delay_reason
        }
        recent_shipments.append(mask_shipment_financials(s_dict, ctx))

    summary_data = {
        "today_shipments_count": today_count,
        "courier_breakdown": courier_breakdown,
        "courier_counts": courier_counts,
        "active_courier_counts": active_courier_counts,
        "in_transit_count": in_transit_count,
        "delivered_count": delivered_count,
        "active_volume": active_volume,
        "total_sales": total_sales,
        "total_collected": total_collected,
        "today_sales": today_sales,
        "today_collected": today_collected,
        "pending_collection": today_sales - today_collected,
        "b2b_outstanding": b2b_outstanding,
        "followups_due": followups_due,
        "refunds_pending": refunds_pending,
        "recent_shipments": recent_shipments
    }

    # Store in cache for 15s
    cache_engine.set(cache_key, summary_data, ttl=15)
    return summary_data
