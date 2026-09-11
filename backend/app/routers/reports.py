# ================================================================
# FLY MY CART CRM - REPORTS & P&L ANALYTICS ROUTER (routers/reports.py)
# ================================================================

import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_

from app.database import get_db
from app.models import Shipment, Refund, Invoice, AccountingEntry, PaymentCollection
from app.collections import collection_totals
from app.auth import mask_shipment_financials
from app.schemas import ShipmentOut
from app.dependencies import require_permission
from app.permissions import PermissionCode

reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])


def estimated_count(db, start, end):
    return db.query(func.count(Shipment.id)).filter(Shipment.date.between(start, end),
        or_(Shipment.cost_reconciled.is_(False), Shipment.actual_provider_cost.is_(None))).scalar()


@reports_router.get("/range")
def get_range_report(date_from: datetime.date, date_to: datetime.date,
                     ctx=Depends(require_permission(PermissionCode.REPORTS_VIEW)), db: Session = Depends(get_db)):
    if date_from > date_to or (date_to - date_from).days > 365:
        raise HTTPException(400, "Choose a date range from 1 to 366 days, with the start on or before the end.")
    return get_weekly_operations_report(date_to.isoformat(), ctx, db, date_from.isoformat())


@reports_router.get("/weekly")
def get_weekly_operations_report(
    end_date: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
):
    """Seven-day operational report available to all staff with Reports access.

    Financial margins remain exclusive to users with the financial-report permission.
    The aggregates are calculated in SQL so the endpoint remains efficient as shipment
    volume grows.
    """
    try:
        period_end = datetime.date.fromisoformat(end_date) if end_date else datetime.date.today()
    except ValueError:
        period_end = datetime.date.today()
    try:
        period_start = datetime.date.fromisoformat(start_date) if start_date else period_end - datetime.timedelta(days=6)
    except ValueError:
        raise HTTPException(400, "Invalid start date")
    period_days = (period_end - period_start).days + 1
    if not 1 <= period_days <= 366:
        raise HTTPException(400, "Choose a date range from 1 to 366 days")
    start_text, end_text = period_start.isoformat(), period_end.isoformat()

    daily_rows = db.query(
        Shipment.date,
        func.count(Shipment.id),
        func.sum(Shipment.price),
        func.sum(case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost)),
    ).filter(Shipment.date.between(start_text, end_text)).group_by(Shipment.date).all()
    status_rows = db.query(Shipment.status, func.count(Shipment.id)).filter(
        Shipment.date.between(start_text, end_text)
    ).group_by(Shipment.status).all()
    courier_rows = db.query(Shipment.courier, func.count(Shipment.id)).filter(
        Shipment.date.between(start_text, end_text)
    ).group_by(Shipment.courier).all()

    by_date = {row[0]: row for row in daily_rows}
    can_view_fin = bool(
        ctx.get("is_super_admin")
        or ctx.get("permissions", {}).get("*")
        or ctx.get("permissions", {}).get(PermissionCode.REPORTS_VIEW_FINANCIAL)
    )
    daily_collections = dict(db.query(PaymentCollection.date, func.sum(PaymentCollection.amount)).filter(
        PaymentCollection.date.between(start_text, end_text)).group_by(PaymentCollection.date).all())
    days = []
    for offset in range(period_days):
        day = (period_start + datetime.timedelta(days=offset)).isoformat()
        row = by_date.get(day)
        revenue = float(row[2] or 0) if row else 0.0
        cost = float(row[3] or 0) if row else 0.0
        days.append({
            "date": day,
            "shipments_count": int(row[1]) if row else 0,
            "revenue": revenue if can_view_fin else None,
            "collections": round(float(daily_collections.get(day, 0)), 2),
            "provider_cost": cost if can_view_fin else None,
            "gross_profit": (revenue - cost) if can_view_fin else None,
        })

    return {
        "period_start": start_text,
        "period_end": end_text,
        "period_days": period_days,
        "estimated_cost_shipments": estimated_count(db, start_text, end_text) if can_view_fin else None,
        "shipments_count": sum(day["shipments_count"] for day in days),
        "active_days": sum(1 for day in days if day["shipments_count"] > 0),
        "daily": days,
        "status_counts": {status or "Unknown": count for status, count in status_rows},
        "courier_counts": {courier or "Unknown": count for courier, count in courier_rows},
        "financials_visible": can_view_fin,
    }

@reports_router.get("/eod")
def get_eod_report(
    date: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db)
):
    target_date = date or datetime.date.today().isoformat()
    shipments = db.query(Shipment).filter(Shipment.date == target_date).all()

    courier_counts = {}
    sales_total = 0.0
    collected_total = 0.0
    credit_total = 0.0
    total_cost = 0.0

    by_method = {}
    by_employee = {}

    for s in shipments:
        courier_counts[s.courier] = courier_counts.get(s.courier, 0) + 1
        sales_total += s.price
        cost = s.actual_provider_cost if s.actual_provider_cost is not None and s.cost_reconciled else (s.provider_cost or 0)
        total_cost += cost

        if s.payment_status == "B2B Credit":
            credit_total += s.price

    collections = collection_totals(db, target_date)
    collected_total = collections["total"]
    by_method = collections["by_method"]
    by_employee = collections["by_employee"]
    invoices = db.query(Invoice).filter(Invoice.date == target_date).all()
    pending = sum(inv.balance for inv in invoices)
    gst_total = round(sum(inv.gst or 0 for inv in invoices), 2)
    billed_total = round(sum(inv.total for inv in invoices), 2)
    credit_ids = {ship.id for ship in shipments if ship.payment_status == "B2B Credit"}
    credit_total = round(sum(inv.balance for inv in invoices if inv.shipment_id in credit_ids), 2)

    refunds = db.query(Refund).filter(
        Refund.approval_date == target_date,
        Refund.status.in_(["Approved", "Refunded"])
    ).all()
    refunds_amt = sum(r.amount for r in refunds)

    gross_profit = sales_total - total_cost
    net_profit = gross_profit - refunds_amt
    can_view_fin = bool(ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get(PermissionCode.REPORTS_VIEW_FINANCIAL))

    return {
        "date": target_date,
        "estimated_cost_shipments": estimated_count(db, target_date, target_date) if can_view_fin else None,
        "shipments_count": len(shipments),
        "courier_counts": courier_counts,
        "total_sales": sales_total,
        "gst_total": gst_total,
        "invoice_total": billed_total,
        "total_collected": collected_total,
        "credit_sales": credit_total,
        "pending_collection": max(0.0, pending),
        "gross_profit": gross_profit if can_view_fin else None,
        "refunds_amount": refunds_amt if can_view_fin else None,
        "net_profit": net_profit if can_view_fin else None,
        "collections_by_method": by_method,
        "collections_by_employee": by_employee,
        "shipments": [mask_shipment_financials(ShipmentOut.model_validate(s).model_dump(), ctx) for s in shipments]
    }

@reports_router.get("/monthly")
def get_monthly_pl_report(
    month: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db)
):
    target_month = month or datetime.date.today().strftime("%Y-%m")
    shipments = db.query(Shipment).filter(Shipment.date.startswith(target_month)).all()

    tax_invoices = db.query(Invoice).filter(Invoice.date.startswith(target_month)).all()
    revenue = sum(s.price for s in shipments)
    predicted_cost = sum(s.provider_cost for s in shipments)
    actual_cost = sum(s.actual_provider_cost if s.actual_provider_cost is not None and s.cost_reconciled else (s.provider_cost or 0) for s in shipments)

    provider_breakdown = {}
    for s in shipments:
        key = f"{s.provider_name} ({s.provider_type.capitalize()})"
        cost = s.actual_provider_cost if s.actual_provider_cost is not None and s.cost_reconciled else (s.provider_cost or 0)
        provider_breakdown[key] = provider_breakdown.get(key, 0.0) + cost

    refunds = db.query(Refund).filter(
        Refund.approval_date.startswith(target_month),
        Refund.status.in_(["Approved", "Refunded"])
    ).all()
    refunds_total = sum(r.amount for r in refunds)

    gross_profit = revenue - actual_cost
    expenses = float(db.query(func.coalesce(func.sum(AccountingEntry.amount), 0)).filter(AccountingEntry.kind == "expense", AccountingEntry.date.startswith(target_month)).scalar())
    net_profit = gross_profit - refunds_total - expenses
    can_view_fin = bool(ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get(PermissionCode.REPORTS_VIEW_FINANCIAL))

    return {
        "month": target_month,
        "estimated_cost_shipments": sum(not s.cost_reconciled or s.actual_provider_cost is None for s in shipments) if can_view_fin else None,
        "shipments_count": len(shipments),
        "revenue": revenue,
        "gst_total": round(sum(inv.gst or 0 for inv in tax_invoices), 2),
        "invoice_total": round(sum(inv.total for inv in tax_invoices), 2),
        "provider_cost_breakdown": provider_breakdown if can_view_fin else {},
        "total_predicted_cost": predicted_cost if can_view_fin else None,
        "total_actual_cost": actual_cost if can_view_fin else None,
        "cost_variance": (actual_cost - predicted_cost) if can_view_fin else None,
        "gross_profit": gross_profit if can_view_fin else None,
        "refunds_total": refunds_total if can_view_fin else None,
        "operational_expenses": expenses if can_view_fin else None,
        "net_profit": net_profit if can_view_fin else None,
        "net_profit_margin": (round((net_profit / revenue) * 100, 1) if revenue > 0 else 0.0) if can_view_fin else None
    }
