# ================================================================
# FLY MY CART CRM - REPORTS & P&L ANALYTICS ROUTER (routers/reports.py)
# ================================================================

import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Shipment, Refund
from app.dependencies import require_permission
from app.permissions import PermissionCode

reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])

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
        cost = s.actual_provider_cost if s.cost_reconciled else s.provider_cost
        total_cost += cost

        if s.payment_status == "Paid":
            collected_total += s.price
            by_method[s.payment_method] = by_method.get(s.payment_method, 0.0) + s.price
            by_employee[s.collected_by] = by_employee.get(s.collected_by, 0.0) + s.price
        elif s.payment_status == "Partial":
            partial = round(s.price * 0.5)
            collected_total += partial
            by_method[s.payment_method] = by_method.get(s.payment_method, 0.0) + partial
            by_employee[s.collected_by] = by_employee.get(s.collected_by, 0.0) + partial
        elif s.payment_status == "B2B Credit":
            credit_total += s.price

    refunds = db.query(Refund).filter(
        or_(Refund.request_date == target_date, Refund.approval_date == target_date),
        Refund.status.in_(["Approved", "Refunded"])
    ).all()
    refunds_amt = sum(r.amount for r in refunds)

    gross_profit = sales_total - total_cost
    net_profit = gross_profit - refunds_amt
    can_view_fin = PermissionCode.REPORTS_VIEW_FINANCIAL in ctx.get("permissions", {})

    return {
        "date": target_date,
        "shipments_count": len(shipments),
        "courier_counts": courier_counts,
        "total_sales": sales_total,
        "total_collected": collected_total,
        "credit_sales": credit_total,
        "pending_collection": max(0.0, sales_total - collected_total - credit_total),
        "gross_profit": gross_profit if can_view_fin else None,
        "refunds_amount": refunds_amt if can_view_fin else None,
        "net_profit": net_profit if can_view_fin else None,
        "collections_by_method": by_method,
        "collections_by_employee": by_employee,
        "shipments": shipments
    }

@reports_router.get("/monthly")
def get_monthly_pl_report(
    month: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.REPORTS_VIEW)),
    db: Session = Depends(get_db)
):
    target_month = month or datetime.date.today().strftime("%Y-%m")
    shipments = db.query(Shipment).filter(Shipment.date.startswith(target_month)).all()

    revenue = sum(s.price for s in shipments)
    predicted_cost = sum(s.provider_cost for s in shipments)
    actual_cost = sum(s.actual_provider_cost if s.cost_reconciled else s.provider_cost for s in shipments)

    provider_breakdown = {}
    for s in shipments:
        key = f"{s.provider_name} ({s.provider_type.capitalize()})"
        cost = s.actual_provider_cost if s.cost_reconciled else s.provider_cost
        provider_breakdown[key] = provider_breakdown.get(key, 0.0) + cost

    refunds = db.query(Refund).filter(
        Refund.request_date.startswith(target_month),
        Refund.status.in_(["Approved", "Refunded"])
    ).all()
    refunds_total = sum(r.amount for r in refunds)

    gross_profit = revenue - actual_cost
    net_profit = gross_profit - refunds_total
    can_view_fin = PermissionCode.REPORTS_VIEW_FINANCIAL in ctx.get("permissions", {})

    return {
        "month": target_month,
        "shipments_count": len(shipments),
        "revenue": revenue,
        "provider_cost_breakdown": provider_breakdown if can_view_fin else {},
        "total_predicted_cost": predicted_cost if can_view_fin else None,
        "total_actual_cost": actual_cost if can_view_fin else None,
        "cost_variance": (actual_cost - predicted_cost) if can_view_fin else None,
        "gross_profit": gross_profit if can_view_fin else None,
        "refunds_total": refunds_total if can_view_fin else None,
        "net_profit": net_profit if can_view_fin else None,
        "net_profit_margin": (round((net_profit / revenue) * 100, 1) if revenue > 0 else 0.0) if can_view_fin else None
    }
