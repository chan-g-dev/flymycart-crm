from app.finance_engine import calculate_gross_profit
# ================================================================
# FLY MY CART CRM - DASHBOARD & ANALYTICS ROUTER (routers/dashboard.py)
# ================================================================

import datetime
from app.business_dates import business_today
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, case

from app.database import get_db
from app.models import Shipment, Followup, Refund, Invoice, B2BCompany, AccountingEntry
from app.collections import collection_totals, shipment_payments_query
from app.auth import mask_shipment_financials
from app.dependencies import require_permission
from app.permissions import PermissionCode
from app.reporting_scope import report_scope

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def booking_trend(db, day):
    """Two complete IST calendar weeks, aggregated across the full shipment table."""
    monday = day - datetime.timedelta(days=day.weekday())
    start = monday - datetime.timedelta(days=7)
    end = monday + datetime.timedelta(days=6)
    rows = db.query(Shipment.date, Shipment.center, func.count(Shipment.id)).filter(
        Shipment.date.between(start.isoformat(), end.isoformat())
    ).group_by(Shipment.date, Shipment.center).all()
    by_date = {}
    for date, center, count in rows:
        by_date.setdefault(date, {})[center or ""] = int(count)
    return [{"date": (start + datetime.timedelta(days=offset)).isoformat(),
             "centers": by_date.get((start + datetime.timedelta(days=offset)).isoformat(), {})}
            for offset in range(14)]

@dashboard_router.get("/summary")
def get_dashboard_summary(
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.DASHBOARDS_VIEW)),
    db: Session = Depends(get_db),
    center: str | None = None,
    scope: str | None = None,
    entity: str | None = None,
):
    if scope and scope not in {'Domestic', 'International'}:
        raise HTTPException(422, 'Scope must be Domestic or International.')
    with report_scope(db, center, scope, entity):
        result = _dashboard_summary(ctx, db)
    with report_scope(db, center, None, entity):
        domestic = (Shipment.domestic_international == 'Domestic') | (
            (func.coalesce(Shipment.domestic_international, '') != 'International') &
            (func.lower(func.coalesce(Shipment.receiver_country, '')) == 'india'))
        total, dom = db.query(func.count(Shipment.id), func.coalesce(func.sum(case((domestic, 1), else_=0)), 0)).one()
        result['scope_counts'] = {'all': total, 'dom': int(dom), 'intl': total - int(dom)}
    with report_scope(db, center, scope, None):
        result['entity_summaries'] = entity_totals(db, business_today().isoformat(), ctx)
    result['filters'] = {'center': center, 'scope': scope, 'entity': entity}
    return result


def _dashboard_summary(ctx, db):
    """
    Returns current analytics using SQL aggregates instead of materializing shipment history.
    Automatically masks financial data for unauthorized staff roles.
    """
    today_str = business_today().isoformat()
    paid = shipment_payments_query(db).subquery()
    balance = case((func.coalesce(paid.c.total, Shipment.price) > func.coalesce(paid.c.paid, 0), func.coalesce(paid.c.total, Shipment.price) - func.coalesce(paid.c.paid, 0)), else_=0)
    billed = func.coalesce(Shipment.total_amount, Shipment.price + func.coalesce(Shipment.gst_amount, 0))
    today = Shipment.date == today_str
    active = Shipment.status.in_(["In Transit", "Picked Up", "Booked"])
    rows = db.query(
        Shipment.center,
        func.sum(case((active | (Shipment.status == "Delayed"), 1), else_=0)).label("active_volume"),
        func.sum(case((today, 1), else_=0)).label("today_shipments_count"),
        func.sum(case((today, Shipment.price), else_=0)).label("today_sales"),
        func.sum(balance).label("pending_collection"),
        func.sum(Shipment.price).label("total_sales"),
        func.sum(billed).label("total_sales_with_gst"),
        func.sum(case((today, billed), else_=0)).label("today_sales_with_gst"),
        func.sum(func.coalesce(paid.c.paid, 0)).label("total_collected"),
        func.sum(case((Shipment.customer_type == "B2B", balance), else_=0)).label("b2b_outstanding"),
        func.sum(case((active, 1), else_=0)).label("in_transit_count"),
        func.sum(case((Shipment.status == "Delivered", 1), else_=0)).label("delivered_count"),
        func.sum(case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost)).label("total_provider_cost"),
        func.sum(billed - case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost)).label("total_gross_profit"),
    ).outerjoin(paid, paid.c.shipment_id == Shipment.id).group_by(Shipment.center).all()
    centers = {row.center: dict(row._mapping) for row in rows}
    totals = {key: sum(float(row.get(key) or 0) for row in centers.values()) for key in (
        "today_shipments_count", "today_sales", "today_sales_with_gst", "pending_collection", 
        "total_sales", "total_sales_with_gst", "total_collected",
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
    from app.access_policy import can_view_costs, can_view_values, can_view_customer_price

    can_view_price = can_view_customer_price(ctx)
    can_view_cost = can_view_costs(ctx)
    can_view_profit = can_view_values(ctx) and can_view_cost and can_view_price

    courier_counts = dict(db.query(Shipment.courier, func.count(Shipment.id)).filter(today).group_by(Shipment.courier).all())
    active_courier_counts = dict(db.query(Shipment.courier, func.count(Shipment.id)).filter(Shipment.courier.isnot(None), active | (Shipment.status == "Delayed")).group_by(Shipment.courier).all())
    courier_breakdown = " | ".join(f"{courier} {count}" for courier, count in courier_counts.items()) or "No bookings today yet"

    # Pending follow-ups, refund requests & overdue B2B accounts
    followups_due = db.query(Followup).filter(Followup.status == "Pending", Followup.due_date <= today_str).count()
    followups_pending = db.query(Followup).filter(Followup.status == "Pending").count()
    followups_upcoming = db.query(Followup).filter(Followup.status == "Pending", Followup.due_date > today_str).count()
    refunds_pending = db.query(Refund).filter(Refund.status.in_(["Requested", "Under Review"])).count()
    b2b_overdue_count = db.query(Invoice).filter(
        Invoice.balance > 0,
        Invoice.shipment_id.in_(db.query(Shipment.id).filter((Shipment.customer_type == "B2B") | Shipment.b2b_company_id.isnot(None))),
        (Invoice.status == "Overdue") | ((Invoice.due_date.isnot(None)) & (Invoice.due_date < today_str))
    ).count()

    # Recent shipments with RBAC financial masking
    refunds_by_awb = dict(
        db.query(func.lower(Refund.awb), func.sum(Refund.amount))
        .filter(Refund.status.in_(["Approved", "Refunded"]))
        .group_by(func.lower(Refund.awb))
        .all()
    )
    shipment_refunds_total = float(
        db.query(func.coalesce(func.sum(Refund.amount), 0))
        .join(Shipment, func.lower(Refund.awb) == func.lower(Shipment.awb))
        .filter(Refund.status.in_(["Approved", "Refunded"]))
        .scalar() or 0
    )
    totals["total_gross_profit"] = round(totals["total_gross_profit"] - shipment_refunds_total, 2)
    refunds_by_center = dict(
        db.query(Shipment.center, func.sum(Refund.amount))
        .join(Refund, func.lower(Refund.awb) == func.lower(Shipment.awb))
        .filter(Refund.status.in_(["Approved", "Refunded"]))
        .group_by(Shipment.center).all()
    )
    for center_name, values in centers.items():
        values["total_gross_profit"] = round(float(values.get("total_gross_profit") or 0) - float(refunds_by_center.get(center_name, 0) or 0), 2)
    recent_shipments_raw = db.query(Shipment).order_by(desc(Shipment.created_at)).limit(10).all()
    recent_shipments = []
    for s in recent_shipments_raw:
        s_awb = (s.awb or "").lower().strip()
        s_refund = float(refunds_by_awb.get(s_awb, 0) or 0)
        billed_val = getattr(s, "total_amount", None) or ((s.price or 0.0) + (getattr(s, "gst_amount", 0.0) or 0.0))
        base_gp = calculate_gross_profit(billed_val, s.provider_cost, s.actual_provider_cost, s.cost_reconciled)
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
            "paid_to": s.paid_to,
            "collected_by": s.collected_by,
            "status": s.status,
            "delay_reason": s.delay_reason,
            "is_ddp": bool(getattr(s, "is_ddp", False)),
            "entity": getattr(s, "entity", "Globe Courier") or "Globe Courier"
        }
        recent_shipments.append(mask_shipment_financials(s_dict, ctx))

    entity_summaries = entity_totals(db, today_str, ctx)

    for values in centers.values():
        if not can_view_cost:
            values["total_provider_cost"] = None
        if not can_view_profit:
            values["total_gross_profit"] = None
        if not can_view_price:
            values["total_sales"] = None
            values["today_sales"] = None
            for key in ('total_sales_with_gst', 'today_sales_with_gst', 'pending_collection', 'total_collected', 'today_collected', 'b2b_outstanding'):
                values[key] = None

    if not can_view_price:
        for values in entity_summaries.values():
            for key in ('today_sales', 'today_sales_with_gst', 'today_gst', 'total_sales', 'total_sales_with_gst', 'total_gst'):
                values[key] = None

    billed = func.coalesce(Shipment.total_amount, Shipment.price + func.coalesce(Shipment.gst_amount, 0))
    today_sales_with_gst, total_sales_with_gst = db.query(
        func.coalesce(func.sum(case((today, billed), else_=0)), 0),
        func.coalesce(func.sum(billed), 0)).one()
    today_sales_with_gst, total_sales_with_gst = float(today_sales_with_gst), float(total_sales_with_gst)
    today_gst = round(today_sales_with_gst - today_sales, 2)
    total_gst = round(total_sales_with_gst - total_sales, 2)

    total_expenses = float(db.query(func.coalesce(func.sum(AccountingEntry.amount), 0)).filter(AccountingEntry.kind == 'expense').scalar() or 0)
    total_refunds = float(db.query(func.coalesce(func.sum(Refund.amount), 0)).filter(Refund.status.in_(['Approved', 'Refunded'])).scalar() or 0)
    total_cost = totals["total_provider_cost"] or 0
    total_net_value = float(total_sales - total_cost - total_expenses - total_refunds)
    total_net_value_with_gst = float(total_sales_with_gst - total_cost - total_expenses - total_refunds)

    summary_data = {
        "booking_trend": booking_trend(db, datetime.date.fromisoformat(today_str)),
        "today_shipments_count": today_count,
        "courier_breakdown": courier_breakdown,
        "courier_counts": courier_counts,
        "active_courier_counts": active_courier_counts,
        "in_transit_count": in_transit_count,
        "delivered_count": delivered_count,
        "active_volume": active_volume,
        "total_sales": total_sales if can_view_price else None,
        "total_sales_with_gst": total_sales_with_gst if can_view_price else None,
        "total_gst": total_gst if can_view_price else None,
        "total_collected": total_collected if can_view_price else None,
        "total_provider_cost": totals["total_provider_cost"] if can_view_cost else None,
        "total_gross_profit": totals["total_gross_profit"] if can_view_profit else None,
        "total_expenses": total_expenses if can_view_cost else None,
        "total_refunds": total_refunds if can_view_cost else None,
        "total_net_value": total_net_value if can_view_profit else None,
        "total_net_value_with_gst": total_net_value_with_gst if can_view_profit else None,
        "today_sales": today_sales if can_view_price else None,
        "today_sales_with_gst": today_sales_with_gst if can_view_price else None,
        "today_gst": today_gst if can_view_price else None,
        "today_collected": today_collected if can_view_price else None,
        "collections_by_center": daily_collections["by_center"] if can_view_price else {},
        "pending_collection": totals["pending_collection"] if can_view_price else None,
        "center_summaries": centers,
        "entity_summaries": entity_summaries,
        "b2b_outstanding": b2b_outstanding if can_view_price else None,
        "b2b_overdue_count": b2b_overdue_count,
        "followups_due": followups_due,
        "followups_pending": followups_pending,
        "followups_upcoming": followups_upcoming,
        "refunds_pending": refunds_pending,
        "recent_shipments": recent_shipments
    }

    return summary_data


def entity_totals(db, today_str, ctx):
    from app.access_policy import can_view_customer_price
    today = Shipment.date == today_str
    billed = func.coalesce(Shipment.total_amount, Shipment.price + func.coalesce(Shipment.gst_amount, 0))
    entity_rows = db.query(
        func.coalesce(Shipment.entity, "Globe Courier").label("entity"),
        func.sum(case((today, 1), else_=0)).label("today_shipments_count"),
        func.sum(case((today, Shipment.price), else_=0)).label("today_sales"),
        func.sum(case((today, billed), else_=0)).label("today_sales_with_gst"),
        func.sum(case((today, func.coalesce(Shipment.gst_amount, billed - Shipment.price)), else_=0)).label("today_gst"),
        func.sum(Shipment.price).label("total_sales"),
        func.sum(billed).label("total_sales_with_gst"),
        func.sum(func.coalesce(Shipment.gst_amount, billed - Shipment.price)).label("total_gst"),
        func.count(Shipment.id).label("total_count"),
    ).group_by(func.coalesce(Shipment.entity, "Globe Courier")).all()
    entity_summaries = {row.entity: dict(row._mapping) for row in entity_rows}

    if not can_view_customer_price(ctx):
        for values in entity_summaries.values():
            for key in ('today_sales', 'today_sales_with_gst', 'today_gst', 'total_sales', 'total_sales_with_gst', 'total_gst'):
                values[key] = None
    return entity_summaries
