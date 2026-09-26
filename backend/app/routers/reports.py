# ================================================================
# FLY MY CART CRM - REPORTS & P&L ANALYTICS ROUTER (routers/reports.py)
# ================================================================

import datetime
from app.business_dates import business_today
from app.finance_engine import shipment_billed_total, calculate_gross_profit
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
from app.access_policy import can_view_costs, can_view_values, can_view_customer_price

reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])


def apply_report_filters(query, scope: Optional[str] = None, entity: Optional[str] = None, center: Optional[str] = None):
    if center and center != "All Centers":
        query = query.filter(Shipment.center == center)
    if entity and entity not in ("all", "All Entities", ""):
        query = query.filter(Shipment.entity == entity)
    if scope:
        scope_clean = scope.strip().lower()
        if scope_clean == "international":
            query = query.filter(func.lower(Shipment.domestic_international) == "international")
        elif scope_clean == "domestic":
            query = query.filter(func.lower(Shipment.domestic_international) == "domestic")
    return query


def estimated_count(db, start, end, scope: Optional[str] = None, entity: Optional[str] = None, center: Optional[str] = None):
    q = db.query(func.count(Shipment.id)).filter(
        Shipment.date.between(start, end),
        or_(Shipment.cost_reconciled.is_(False), Shipment.actual_provider_cost.is_(None))
    )
    return apply_report_filters(q, scope, entity, center).scalar()


@reports_router.get("/weekly")
def get_weekly_operations_report(
    end_date: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission("reports.weekly")),
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
    date: Optional[str] = None,
    scope: Optional[str] = None,
    entity: Optional[str] = None,
    center: Optional[str] = None
):
    target_end = end_date or date
    try:
        period_end = datetime.date.fromisoformat(target_end) if target_end else business_today()
    except ValueError:
        raise HTTPException(400, "Invalid end date")
    try:
        if start_date:
            period_start = datetime.date.fromisoformat(start_date)
        else:
            period_start = period_end - datetime.timedelta(days=period_end.weekday())
            period_end = period_start + datetime.timedelta(days=6)
    except ValueError:
        raise HTTPException(400, "Invalid start date")
    period_days = (period_end - period_start).days + 1
    if not 1 <= period_days <= 366:
        raise HTTPException(400, "Choose a date range from 1 to 366 days")
    start_text, end_text = period_start.isoformat(), period_end.isoformat()

    billed = func.coalesce(Shipment.total_amount, Shipment.price + func.coalesce(Shipment.gst_amount, 0))
    daily_q = db.query(
        Shipment.date,
        func.count(Shipment.id),
        func.sum(Shipment.price),
        func.sum(billed),
        func.sum(case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost)),
    ).filter(Shipment.date.between(start_text, end_text))
    daily_rows = apply_report_filters(daily_q, scope, entity, center).group_by(Shipment.date).all()

    status_q = db.query(Shipment.status, func.count(Shipment.id)).filter(
        Shipment.date.between(start_text, end_text)
    )
    status_rows = apply_report_filters(status_q, scope, entity, center).group_by(Shipment.status).all()

    courier_q = db.query(Shipment.courier, func.count(Shipment.id)).filter(
        Shipment.date.between(start_text, end_text)
    )
    courier_rows = apply_report_filters(courier_q, scope, entity, center).group_by(Shipment.courier).all()

    by_date = {row[0]: row for row in daily_rows}
    can_view_price = can_view_customer_price(ctx)
    can_view_cost = can_view_costs(ctx)
    can_view_profit = can_view_values(ctx) and can_view_cost and can_view_price

    receipt_q = db.query(PaymentCollection.date, func.sum(PaymentCollection.amount)).filter(
        PaymentCollection.date.between(start_text, end_text)
    )
    if center and center != "All Centers":
        receipt_q = receipt_q.filter(PaymentCollection.shipment_id.in_(
            db.query(Shipment.id).filter(Shipment.center == center)
        ))
    daily_collections = dict(receipt_q.group_by(PaymentCollection.date).all())

    ref_q = db.query(
        func.coalesce(Refund.approval_date, Refund.request_date).label("ref_date"),
        func.sum(Refund.amount).label("ref_amt")
    ).filter(
        Refund.status.in_(["Approved", "Refunded"]),
        func.coalesce(Refund.approval_date, Refund.request_date).between(start_text, end_text)
    )
    filtered_awbs = apply_report_filters(db.query(Shipment.awb), scope, entity, center)
    ref_q = ref_q.filter(Refund.awb.in_(filtered_awbs))
    daily_refunds = dict(ref_q.group_by(func.coalesce(Refund.approval_date, Refund.request_date)).all())
    total_refunds = round(float(sum(daily_refunds.values())), 2)

    days = []
    for offset in range(period_days):
        day = (period_start + datetime.timedelta(days=offset)).isoformat()
        row = by_date.get(day)
        revenue = float(row[2] or 0) if row else 0.0
        cost = float(row[4] or 0) if row else 0.0
        rev_with_gst = float(row[3] or 0) if row else 0.0
        refund = round(float(daily_refunds.get(day, 0) or 0), 2)
        gst_val = round(rev_with_gst - revenue, 2)
        days.append({
            "date": day,
            "shipments_count": int(row[1]) if row else 0,
            "revenue": revenue if can_view_price else None,
            "revenue_with_gst": rev_with_gst if can_view_price else None,
            "gst_total": gst_val if can_view_price else None,
            "collections": round(float(daily_collections.get(day, 0) or 0), 2) if can_view_price else None,
            "provider_cost": cost if can_view_cost else None,
            "refunds_total": refund if can_view_profit else None,
            "gross_profit": round(rev_with_gst - cost - refund, 2) if can_view_profit else None,
            "gross_profit_with_gst": round(rev_with_gst - cost - refund, 2) if can_view_profit else None,
        })

    expenses, expense_breakdown = expense_summary(db, start_text, end_text)
    total_sales = round(sum(d["revenue"] for d in days if d["revenue"] is not None), 2)
    total_sales_with_gst = round(sum(d["revenue_with_gst"] for d in days if d["revenue_with_gst"] is not None), 2)
    total_cost = round(sum(d["provider_cost"] for d in days if d["provider_cost"] is not None), 2)
    total_col = round(sum(d["collections"] for d in days if d["collections"] is not None), 2)
    exp_val = expenses if expenses is not None else 0.0
    net_profit = round(total_sales - total_cost - total_refunds - exp_val, 2)
    net_profit_with_gst = round(total_sales_with_gst - total_cost - total_refunds - exp_val, 2)

    return {
        "operational_expenses": expenses if can_view_cost else None,
        "expense_breakdown": expense_breakdown if can_view_cost else {},
        "period_start": start_text,
        "period_end": end_text,
        "period_days": period_days,
        "estimated_cost_shipments": estimated_count(db, start_text, end_text, scope, entity, center) if can_view_cost else None,
        "shipments_count": sum(day["shipments_count"] for day in days),
        "active_days": sum(1 for day in days if day["shipments_count"] > 0),
        "total_sales": total_sales if can_view_price else None,
        "total_sales_with_gst": total_sales_with_gst if can_view_price else None,
        "gst_total": round(total_sales_with_gst - total_sales, 2) if can_view_price else None,
        "invoice_total": total_sales_with_gst if can_view_price else None,
        "total_collected": total_col if can_view_price else None,
        "total_provider_cost": total_cost if can_view_cost else None,
        "gross_profit": round(total_sales_with_gst - total_cost - total_refunds, 2) if can_view_profit else None,
        "gross_profit_with_gst": round(total_sales_with_gst - total_cost - total_refunds, 2) if can_view_profit else None,
        "refunds_total": total_refunds if can_view_profit else None,
        "net_profit": net_profit if can_view_profit else None,
        "net_profit_with_gst": net_profit_with_gst if can_view_profit else None,
        "daily": days,
        "status_counts": {status or "Unknown": count for status, count in status_rows},
        "courier_counts": {courier or "Unknown": count for courier, count in courier_rows},
        "financials_visible": can_view_profit,
    }


@reports_router.get("/range")
def get_range_report(
    date_from: datetime.date,
    date_to: datetime.date,
    ctx=Depends(require_permission("reports.custom_range")),
    db: Session = Depends(get_db),
    scope: Optional[str] = None,
    entity: Optional[str] = None,
    center: Optional[str] = None
):
    if date_from > date_to or (date_to - date_from).days > 365:
        raise HTTPException(400, "Choose a date range from 1 to 366 days, with the start on or before the end.")
    return get_weekly_operations_report(date_to.isoformat(), ctx, db, date_from.isoformat(), scope=scope, entity=entity, center=center)

@reports_router.get("/eod")
def get_eod_report(
    date: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission("reports.eod")),
    db: Session = Depends(get_db),
    scope: Optional[str] = None,
    entity: Optional[str] = None,
    center: Optional[str] = None
):
    target_date = date or business_today().isoformat()
    q = db.query(Shipment).filter(Shipment.date == target_date)
    shipments = apply_report_filters(q, scope, entity, center).all()

    courier_counts = {}
    sales_total = 0.0
    total_cost = 0.0

    for s in shipments:
        c_name = s.courier or "Unknown"
        courier_counts[c_name] = courier_counts.get(c_name, 0) + 1
        s_price = float(s.price or 0)
        sales_total += s_price
        cost = float(s.actual_provider_cost) if s.actual_provider_cost is not None and s.cost_reconciled else float(s.provider_cost or 0)
        total_cost += cost

    sales_total = round(sales_total, 2)
    total_cost = round(total_cost, 2)
    billed_total = round(sum(shipment_billed_total(s) for s in shipments), 2)
    gst_total = round(billed_total - sales_total, 2)

    try:
        collections = collection_totals(db, target_date)
        if center and center != "All Centers":
            collected_total = float(collections.get("by_center", {}).get(center, 0.0))
        else:
            collected_total = collections.get("total", 0.0)
        by_method = collections.get("by_method", {})
        by_employee = collections.get("by_employee", {})
    except Exception:
        collected_total = round(float(sum(float(s.amount_received or s.price or 0) for s in shipments if s.payment_status in ("Paid", "Partial"))), 2)
        by_method = {}
        by_employee = {}

    shipment_ids = [s.id for s in shipments]
    invoices = db.query(Invoice).filter(Invoice.shipment_id.in_(shipment_ids)).all() if shipment_ids else []
    pending = round(float(sum(float(inv.balance or 0) for inv in invoices)), 2)
    credit_ids = {ship.id for ship in shipments if ship.payment_status == "B2B Credit"}
    credit_total = round(float(sum(float(inv.balance or 0) for inv in invoices if inv.shipment_id in credit_ids)), 2)

    refunds_amt = 0.0
    try:
        ref_q = db.query(Refund).filter(
            or_(
                Refund.approval_date == target_date,
                (Refund.approval_date.is_(None) & (Refund.request_date == target_date))
            ),
            Refund.status.in_(["Approved", "Refunded"])
        )
        ref_q = ref_q.filter(Refund.awb.in_([s.awb for s in shipments]))
        refunds_amt = round(float(sum(float(r.amount or 0) for r in ref_q.all())), 2)
    except Exception:
        refunds_amt = 0.0

    gross_profit = round(billed_total - total_cost - refunds_amt, 2)
    expenses, expense_breakdown = expense_summary(db, target_date, target_date)
    exp_val = expenses if expenses is not None else 0.0
    net_profit = round(gross_profit - exp_val, 2)
    can_view_price = can_view_customer_price(ctx)
    can_view_cost = can_view_costs(ctx)
    can_view_profit = can_view_values(ctx) and can_view_cost and can_view_price

    refunds_by_awb = dict(
        db.query(func.lower(Refund.awb), func.sum(Refund.amount))
        .filter(Refund.status.in_(["Approved", "Refunded"]))
        .group_by(func.lower(Refund.awb))
        .all()
    )

    formatted_shipments = []
    for s in shipments:
        try:
            s_awb = (s.awb or "").lower().strip()
            s_refund = float(refunds_by_awb.get(s_awb, 0) or 0)
            row = ShipmentOut.model_validate(s).model_dump()
            billed_val = getattr(s, "total_amount", None) or ((s.price or 0.0) + (getattr(s, "gst_amount", 0.0) or 0.0))
            row['gross_profit'] = round(calculate_gross_profit(billed_val, s.provider_cost, s.actual_provider_cost, s.cost_reconciled) - s_refund, 2)
            row['refund_amount'] = s_refund
            formatted_shipments.append(mask_shipment_financials(row, ctx))
        except Exception:
            pass

    return {
        "operational_expenses": expenses if can_view_cost else None,
        "expense_breakdown": expense_breakdown if can_view_cost else {},
        "date": target_date,
        "estimated_cost_shipments": estimated_count(db, target_date, target_date, scope, entity, center) if can_view_cost else None,
        "shipments_count": len(shipments),
        "courier_counts": courier_counts,
        "total_sales": sales_total if can_view_price else None,
        "total_sales_with_gst": billed_total if can_view_price else None,
        "gst_total": gst_total if can_view_price else None,
        "invoice_total": billed_total if can_view_price else None,
        "total_collected": collected_total if can_view_price else None,
        "credit_sales": credit_total if can_view_price else None,
        "pending_collection": max(0.0, pending) if can_view_price else None,
        "total_provider_cost": total_cost if can_view_cost else None,
        "gross_profit": gross_profit if can_view_profit else None,
        "gross_profit_with_gst": gross_profit if can_view_profit else None,
        "refunds_amount": refunds_amt if can_view_profit else None,
        "net_profit": net_profit if can_view_profit else None,
        "net_profit_with_gst": net_profit if can_view_profit else None,
        "collections_by_method": by_method if can_view_price else {},
        "collections_by_employee": by_employee if can_view_price else {},
        "shipments": formatted_shipments
    }

@reports_router.get("/monthly")
def get_monthly_pl_report(
    month: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission("reports.monthly_pnl")),
    db: Session = Depends(get_db),
    scope: Optional[str] = None,
    entity: Optional[str] = None,
    center: Optional[str] = None
):
    target_month = month or business_today().strftime("%Y-%m")
    q = db.query(Shipment).filter(Shipment.date.startswith(target_month))
    shipments = apply_report_filters(q, scope, entity, center).all()

    revenue = round(float(sum(float(s.price or 0) for s in shipments)), 2)
    predicted_cost = round(float(sum(float(s.provider_cost or 0) for s in shipments)), 2)
    actual_cost = round(float(sum(
        float(s.actual_provider_cost) if s.actual_provider_cost is not None and s.cost_reconciled else float(s.provider_cost or 0)
        for s in shipments
    )), 2)
    invoice_total = round(sum(shipment_billed_total(s) for s in shipments), 2)
    gst_total = round(invoice_total - revenue, 2)

    provider_breakdown = {}
    for s in shipments:
        p_name = s.courier or s.provider_name or "Courier"
        cost = float(s.actual_provider_cost) if s.actual_provider_cost is not None and s.cost_reconciled else float(s.provider_cost or 0)
        provider_breakdown[p_name] = round(provider_breakdown.get(p_name, 0.0) + cost, 2)

    refunds_total = 0.0
    try:
        ref_q = db.query(Refund).filter(
            or_(
                Refund.approval_date.startswith(target_month),
                (Refund.approval_date.is_(None) & Refund.request_date.startswith(target_month))
            ),
            Refund.status.in_(["Approved", "Refunded"])
        )
        ref_q = ref_q.filter(Refund.awb.in_([s.awb for s in shipments]))
        refunds_total = round(float(sum(float(r.amount or 0) for r in ref_q.all())), 2)
    except Exception:
        refunds_total = 0.0

    gross_profit = round(invoice_total - actual_cost - refunds_total, 2)
    gross_profit_with_gst = gross_profit
    expenses, expense_breakdown = expense_summary(db, target_month + "-01", target_month + "-31")

    postpaid_carrier_payments = 0.0
    postpaid_payments_breakdown = {}
    try:
        postpaid_q = db.query(
            AccountingEntry.provider,
            func.sum(AccountingEntry.amount)
        ).filter(
            AccountingEntry.kind.in_(["provider_payment", "provider_deposit"]),
            AccountingEntry.date.isnot(None),
            AccountingEntry.date.startswith(target_month)
        )
        if center and center != "All Centers":
            postpaid_q = postpaid_q.filter(AccountingEntry.center == center)
        postpaid_entries = postpaid_q.group_by(AccountingEntry.provider).all()

        for prov, amt in postpaid_entries:
            p_name = prov or "Postpaid Carrier"
            a_val = round(float(amt or 0), 2)
            postpaid_payments_breakdown[p_name] = a_val
            postpaid_carrier_payments += a_val
        postpaid_carrier_payments = round(postpaid_carrier_payments, 2)
    except Exception:
        postpaid_carrier_payments = 0.0
        postpaid_payments_breakdown = {}

    exp_val = expenses if expenses is not None else 0.0
    net_profit = round(gross_profit - exp_val, 2)
    net_profit_with_gst = net_profit

    can_view_price = can_view_customer_price(ctx)
    can_view_cost = can_view_costs(ctx)
    can_view_profit = can_view_values(ctx) and can_view_cost and can_view_price

    return {
        "month": target_month,
        "estimated_cost_shipments": sum(not s.cost_reconciled or s.actual_provider_cost is None for s in shipments) if can_view_cost else None,
        "shipments_count": len(shipments),
        "revenue": revenue if can_view_price else None,
        "total_revenue": revenue if can_view_price else None,
        "revenue_with_gst": invoice_total if can_view_price else None,
        "gst_total": gst_total if can_view_price else None,
        "invoice_total": invoice_total if can_view_price else None,
        "carrier_costs": provider_breakdown if can_view_cost else {},
        "provider_cost_breakdown": provider_breakdown if can_view_cost else {},
        "postpaid_carrier_payments": postpaid_carrier_payments if can_view_cost else None,
        "postpaid_payments_breakdown": postpaid_payments_breakdown if can_view_cost else {},
        "total_predicted_cost": predicted_cost if can_view_cost else None,
        "total_actual_cost": actual_cost if can_view_cost else None,
        "cost_variance": round(actual_cost - predicted_cost, 2) if can_view_profit else None,
        "gross_profit": gross_profit if can_view_profit else None,
        "gross_profit_with_gst": gross_profit_with_gst if can_view_profit else None,
        "refunds_total": refunds_total if can_view_profit else None,
        "operational_expenses": expenses if can_view_cost else None,
        "expense_breakdown": expense_breakdown if can_view_cost else {},
        "net_profit": net_profit if can_view_profit else None,
        "net_profit_with_gst": net_profit_with_gst if can_view_profit else None,
        "net_profit_margin": (round((net_profit_with_gst / invoice_total) * 100, 1) if invoice_total > 0 else 0.0) if (can_view_profit and invoice_total > 0) else None
    }
