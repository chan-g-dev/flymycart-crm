# ================================================================
# FLY MY CART CRM - DASHBOARD & ANALYTICS ROUTER (routers/dashboard.py)
# ================================================================

import datetime
from typing import Dict, Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, case

from app.database import get_db
from app.models import Shipment, Followup, Refund, Invoice
from app.collections import collection_totals, shipment_payments_query
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
    Returns current analytics using SQL aggregates instead of materializing shipment history.
    Automatically masks financial data for unauthorized staff roles.
    """
    today_str = datetime.date.today().isoformat()
    paid = shipment_payments_query(db).subquery()
    balance = case((func.coalesce(paid.c.total, Shipment.price) > func.coalesce(paid.c.paid, 0), func.coalesce(paid.c.total, Shipment.price) - func.coalesce(paid.c.paid, 0)), else_=0)
    today = Shipment.date == today_str
    active = Shipment.status.in_(["In Transit", "Picked Up", "Booked"])
    rows = db.query(
        Shipment.center,
        func.sum(case((today, 1), else_=0)).label("today_shipments_count"),
        func.sum(case((today, Shipment.price), else_=0)).label("today_sales"),
        func.sum(case((today, balance), else_=0)).label("pending_collection"),
        func.sum(Shipment.price).label("total_sales"),
        func.sum(func.coalesce(paid.c.paid, 0)).label("total_collected"),
        func.sum(case((Shipment.customer_type == "B2B", balance), else_=0)).label("b2b_outstanding"),
        func.sum(case((active, 1), else_=0)).label("in_transit_count"),
        func.sum(case((Shipment.status == "Delivered", 1), else_=0)).label("delivered_count"),
        func.sum(case((active | (Shipment.status == "Delayed"), 1), else_=0)).label("active_volume"),
        func.sum(case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost)).label("total_provider_cost"),
        func.sum(Shipment.gross_profit).label("total_gross_profit"),
    ).outerjoin(paid, paid.c.shipment_id == Shipment.id).group_by(Shipment.center).all()
    centers = {row.center: dict(row._mapping) for row in rows}
    totals = {key: sum(float(row.get(key) or 0) for row in centers.values()) for key in (
        "today_shipments_count", "today_sales", "pending_collection", "total_sales", "total_collected",
        "b2b_outstanding", "in_transit_count", "delivered_count", "active_volume",
        "total_provider_cost", "total_gross_profit")}
    daily_collections = collection_totals(db, today_str)
    for center, values in centers.items():
        values["today_collected"] = daily_collections["by_center"].get(center, 0)
    today_collected = daily_collections["total"]
    today_count = int(totals["today_shipments_count"])
    today_sales = totals["today_sales"]
    total_sales = totals["total_sales"]
    total_collected = totals["total_collected"]
    b2b_outstanding = totals["b2b_outstanding"]
    in_transit_count = int(totals["in_transit_count"])
    delivered_count = int(totals["delivered_count"])
    active_volume = int(totals["active_volume"])
    can_view_financials = bool(ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get(PermissionCode.REPORTS_VIEW_FINANCIAL))
    courier_counts = dict(db.query(Shipment.courier, func.count(Shipment.id)).filter(today).group_by(Shipment.courier).all())
    active_courier_counts = dict(db.query(Shipment.courier, func.count(Shipment.id)).filter(Shipment.courier.isnot(None), active | (Shipment.status == "Delayed")).group_by(Shipment.courier).all())
    courier_breakdown = " | ".join(f"{courier} {count}" for courier, count in courier_counts.items()) or "No bookings today yet"

    # Pending follow-ups & refund requests
    followups_due = db.query(Followup).filter(Followup.status == "Pending", Followup.due_date <= today_str).count()
    refunds_pending = db.query(Refund).filter(Refund.status.in_(["Requested", "Under Review"])).count()

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

    if not can_view_financials:
        for values in centers.values():
            values["total_provider_cost"] = None
            values["total_gross_profit"] = None

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
        "total_provider_cost": totals["total_provider_cost"] if can_view_financials else None,
        "total_gross_profit": totals["total_gross_profit"] if can_view_financials else None,
        "today_sales": today_sales,
        "today_collected": today_collected,
        "collections_by_center": daily_collections["by_center"],
        "pending_collection": totals["pending_collection"],
        "center_summaries": centers,
        "b2b_outstanding": b2b_outstanding,
        "followups_due": followups_due,
        "refunds_pending": refunds_pending,
        "recent_shipments": recent_shipments
    }

    return summary_data
