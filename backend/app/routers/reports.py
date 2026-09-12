# ================================================================
# FLY MY CART CRM - REPORTS & P&L ANALYTICS ROUTER (routers/reports.py)
# ================================================================

import datetime
from app.business_dates import business_today
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_

from app.database import get_db
from app.expense_reports import expense_summary
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
        period_end = datetime.date.fromisoformat(end_date) if end_date else business_today()
    except ValueError:
        period_end = business_today()
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

    inv_rows = db.query(
        Invoice.date,
        func.sum(Invoice.total),
        func.sum(Invoice.gst)
    ).filter(Invoice.date.between(start_text, end_text)).group_by(Invoice.date).all()
    inv_by_date = {row[0]: row for row in inv_rows}

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
        inv_row = inv_by_date.get(day)
        rev_with_gst = float(inv_row[1] or 0) if inv_row else round(revenue * 1.18, 2)
        gst_val = float(inv_row[2] or 0) if inv_row else round(revenue * 0.18, 2)
        days.append({
            "date": day,
            "shipments_count": int(row[1]) if row else 0,
            "revenue": revenue if can_view_fin else None,
            "revenue_with_gst": rev_with_gst if can_view_fin else None,
            "gst_total": gst_val if can_view_fin else None,
            "collections": round(float(daily_collections.get(day, 0) or 0), 2),
            "provider_cost": cost if can_view_fin else None,
            "gross_profit": round(revenue - cost, 2) if can_view_fin else None,
        })

    expenses, expense_breakdown = expense_summary(db, start_text, end_text)
    return {
        "operational_expenses": expenses if can_view_fin else None,
        "expense_breakdown": expense_breakdown if can_view_fin else {},
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


@reports_router.get("/range")
def get_range_report(
    date_from: datetime.date,
    date_to: datetime.date,
    ctx=Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db)
):
    if date_from > date_to or (date_to - date_from).days > 365:
        raise HTTPException(400, "Choose a date range from 1 to 366 days, with the start on or before the end.")
    return get_weekly_operations_report(date_to.isoformat(), ctx, db, date_from.isoformat())

@reports_router.get("/eod")
def get_eod_report(
    date: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db)
):
    target_date = date or business_today().isoformat()
    shipments = db.query(Shipment).filter(Shipment.date == target_date).all()

    courier_counts = {}
    sales_total = 0.0
    collected_total = 0.0
    credit_total = 0.0
    total_cost = 0.0

    for s in shipments:
        c_name = s.courier or "Unknown"
        courier_counts[c_name] = courier_counts.get(c_name, 0) + 1
        s_price = float(s.price or 0)
        sales_total += s_price
        cost = float(s.actual_provider_cost) if s.actual_provider_cost is not None and s.cost_reconciled else float(s.provider_cost or 0)
        total_cost += cost

        if s.payment_status == "B2B Credit":
            credit_total += s_price

    sales_total = round(sales_total, 2)
    total_cost = round(total_cost, 2)

    try:
        collections = collection_totals(db, target_date)
        collected_total = collections.get("total", 0.0)
        by_method = collections.get("by_method", {})
        by_employee = collections.get("by_employee", {})
    except Exception:
        collected_total = round(float(sum(float(s.amount_received or s.price or 0) for s in shipments if s.payment_status in ("Paid", "Partial"))), 2)
        by_method = {}
        by_employee = {}

    invoices = db.query(Invoice).filter(Invoice.date == target_date).all()
    pending = round(float(sum(float(inv.balance or 0) for inv in invoices)), 2)
    gst_total = round(float(sum(float(inv.gst or 0) for inv in invoices)), 2) if invoices else round(sales_total * 0.18, 2)
    billed_total = round(float(sum(float(inv.total or 0) for inv in invoices)), 2) if invoices else round(sales_total * 1.18, 2)
    credit_ids = {ship.id for ship in shipments if ship.payment_status == "B2B Credit"}
    credit_total = round(float(sum(float(inv.balance or 0) for inv in invoices if inv.shipment_id in credit_ids)), 2)

    refunds_amt = 0.0
    try:
        refunds = db.query(Refund).filter(
            Refund.approval_date == target_date,
            Refund.status.in_(["Approved", "Refunded"])
        ).all()
        refunds_amt = round(float(sum(float(r.amount or 0) for r in refunds)), 2)
    except Exception:
        refunds_amt = 0.0

    gross_profit = round(sales_total - total_cost, 2)
    expenses, expense_breakdown = expense_summary(db, target_date, target_date)
    net_profit = round(gross_profit - refunds_amt - expenses, 2)
    can_view_fin = bool(ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get(PermissionCode.REPORTS_VIEW_FINANCIAL))

    formatted_shipments = []
    for s in shipments:
        try:
            formatted_shipments.append(mask_shipment_financials(ShipmentOut.model_validate(s).model_dump(), ctx))
        except Exception:
            pass

    return {
        "operational_expenses": expenses if can_view_fin else None,
        "expense_breakdown": expense_breakdown if can_view_fin else {},
        "date": target_date,
        "estimated_cost_shipments": estimated_count(db, target_date, target_date) if can_view_fin else None,
        "shipments_count": len(shipments),
        "courier_counts": courier_counts,
        "total_sales": sales_total,
        "total_sales_with_gst": billed_total,
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
        "shipments": formatted_shipments
    }

@reports_router.get("/monthly")
def get_monthly_pl_report(
    month: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db)
):
    target_month = month or business_today().strftime("%Y-%m")
    shipments = db.query(Shipment).filter(Shipment.date.startswith(target_month)).all()

    tax_invoices = db.query(Invoice).filter(Invoice.date.startswith(target_month)).all()
    revenue = round(float(sum(float(s.price or 0) for s in shipments)), 2)
    predicted_cost = round(float(sum(float(s.provider_cost or 0) for s in shipments)), 2)
    actual_cost = round(float(sum(
        float(s.actual_provider_cost) if s.actual_provider_cost is not None and s.cost_reconciled else float(s.provider_cost or 0)
        for s in shipments
    )), 2)

    provider_breakdown = {}
    for s in shipments:
        p_type = (s.provider_type or '').capitalize()
        p_name = s.provider_name or s.courier or "Courier"
        key = f"{p_name} ({p_type})" if p_type else p_name
        cost = float(s.actual_provider_cost) if s.actual_provider_cost is not None and s.cost_reconciled else float(s.provider_cost or 0)
        provider_breakdown[key] = round(provider_breakdown.get(key, 0.0) + cost, 2)

    refunds_total = 0.0
    try:
        refunds = db.query(Refund).filter(
            Refund.approval_date.isnot(None),
            Refund.approval_date.startswith(target_month),
            Refund.status.in_(["Approved", "Refunded"])
        ).all()
        refunds_total = round(float(sum(float(r.amount or 0) for r in refunds)), 2)
    except Exception:
        refunds_total = 0.0

    gross_profit = round(revenue - actual_cost, 2)
    expenses, expense_breakdown = expense_summary(db, target_month + "-01", target_month + "-31")

    postpaid_carrier_payments = 0.0
    postpaid_payments_breakdown = {}
    try:
        postpaid_entries = db.query(
            AccountingEntry.provider,
            func.sum(AccountingEntry.amount)
        ).filter(
            AccountingEntry.kind.in_(["provider_payment", "provider_deposit"]),
            AccountingEntry.date.isnot(None),
            AccountingEntry.date.startswith(target_month)
        ).group_by(AccountingEntry.provider).all()

        for prov, amt in postpaid_entries:
            p_name = prov or "Postpaid Carrier"
            a_val = round(float(amt or 0), 2)
            postpaid_payments_breakdown[p_name] = a_val
            postpaid_carrier_payments += a_val
        postpaid_carrier_payments = round(postpaid_carrier_payments, 2)
    except Exception:
        postpaid_carrier_payments = 0.0
        postpaid_payments_breakdown = {}

    net_profit = round(gross_profit - refunds_total - expenses, 2)
    can_view_fin = bool(ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get(PermissionCode.REPORTS_VIEW_FINANCIAL))

    gst_total = round(float(sum(float(inv.gst or 0) for inv in tax_invoices)), 2) if tax_invoices else round(revenue * 0.18, 2)
    invoice_total = round(float(sum(float(inv.total or 0) for inv in tax_invoices)), 2) if tax_invoices else round(revenue * 1.18, 2)

    return {
        "month": target_month,
        "estimated_cost_shipments": sum(not s.cost_reconciled or s.actual_provider_cost is None for s in shipments) if can_view_fin else None,
        "shipments_count": len(shipments),
        "revenue": revenue,
        "total_revenue": revenue,
        "revenue_with_gst": invoice_total,
        "gst_total": gst_total,
        "invoice_total": invoice_total,
        "provider_cost_breakdown": provider_breakdown if can_view_fin else {},
        "postpaid_carrier_payments": postpaid_carrier_payments if can_view_fin else None,
        "postpaid_payments_breakdown": postpaid_payments_breakdown if can_view_fin else {},
        "total_predicted_cost": predicted_cost if can_view_fin else None,
        "total_actual_cost": actual_cost if can_view_fin else None,
        "cost_variance": round(actual_cost - predicted_cost, 2) if can_view_fin else None,
        "gross_profit": gross_profit if can_view_fin else None,
        "refunds_total": refunds_total if can_view_fin else None,
        "operational_expenses": expenses if can_view_fin else None,
        "expense_breakdown": expense_breakdown if can_view_fin else {},
        "net_profit": net_profit if can_view_fin else None,
        "net_profit_margin": (round((net_profit / revenue) * 100, 1) if revenue > 0 else 0.0) if can_view_fin else None
    }
