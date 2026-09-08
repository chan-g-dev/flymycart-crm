# ================================================================
# FLY MY CART CRM - ACCOUNTS & WALLETS ROUTER (routers/accounts.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, case

from app.database import get_db
from app.models import Shipment, WalletTransaction, SystemSettings, AuditLog
from app.collections import collection_totals, shipment_payments_query
from app.schemas import WalletRechargeCreate, WalletTransactionOut
from app.auth import get_current_user_context, create_audit_log
from app.dependencies import require_permission
from app.permissions import PermissionCode

accounts_router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

def log_accounts_audit(db: Session, user_name: str, entity_id: str, action: str, before_val=None, after_val=None):
    try:
        entry = AuditLog(
            id=f"aud_{uuid.uuid4().hex[:8]}",
            user_name=user_name,
            entity_type="Wallet",
            entity_id=entity_id,
            action=action,
            before_value=before_val,
            after_value=after_val,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"Accounts audit error: {e}")

@accounts_router.get("/summary")
def get_accounts_summary(
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.ACCOUNTS_VIEW)),
    db: Session = Depends(get_db)
):
    paid = shipment_payments_query(db).subquery()
    balance = case((Shipment.price > func.coalesce(paid.c.paid, 0), Shipment.price - func.coalesce(paid.c.paid, 0)), else_=0)
    total_sales, total_collected, b2b_credit = db.query(
        func.coalesce(func.sum(Shipment.price), 0), func.coalesce(func.sum(func.coalesce(paid.c.paid, 0)), 0),
        func.coalesce(func.sum(case((Shipment.customer_type == "B2B", balance), else_=0)), 0)
    ).outerjoin(paid, paid.c.shipment_id == Shipment.id).one()
    collections = collection_totals(db)
    by_account = collections["by_account"]
    cash = upi = bank = 0.0
    for method, amount in collections["by_method"].items():
        method = method.lower()
        if "cash" in method:
            cash += amount
        elif any(term in method for term in ("bank", "transfer", "neft", "rtgs")):
            bank += amount
        elif any(term in method for term in ("upi", "phonepe", "gpay", "google", "qr")):
            upi += amount
    can_view_financials = bool(ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get("reports.view_financial"))

    # Prepaid Wallets
    wallets_data = []
    settings_rec = db.query(SystemSettings).first()
    prepaid_configs = settings_rec.config_json.get("prepaidWallets", []) if settings_rec else [
        {"name": "ICL", "openingBalance": 50000},
        {"name": "BRV", "openingBalance": 30000}
    ]

    wallet_totals = {(name, kind): (amount, count) for name, kind, amount, count in db.query(
        WalletTransaction.wallet, WalletTransaction.type, func.sum(WalletTransaction.amount), func.count(WalletTransaction.id)
    ).group_by(WalletTransaction.wallet, WalletTransaction.type).all()}
    for w in prepaid_configs:
        w_name = w["name"]
        opening = float(w.get("openingBalance", 0))
        recharges, recharge_count = wallet_totals.get((w_name, "recharge"), (0, 0))
        usage, usage_count = wallet_totals.get((w_name, "usage"), (0, 0))
        current_balance = opening + recharges - usage

        wallets_data.append({
            "name": w_name,
            "opening_balance": opening,
            "total_recharges": recharges,
            "total_usage": usage,
            "current_balance": current_balance,
            "transactions_count": recharge_count + usage_count
        })

    # Postpaid Accounts
    postpaid_data = []
    postpaid_configs = settings_rec.config_json.get("postpaidProviders", []) if settings_rec else [
        {"name": "Aramex", "deposit": 200000, "paymentTerms": "15 Days"},
        {"name": "Blue Dart", "deposit": 150000, "paymentTerms": "30 Days"}
    ]

    provider_totals = db.query(Shipment.provider_name, Shipment.courier, func.count(Shipment.id),
        func.sum(Shipment.provider_cost), func.sum(case((Shipment.cost_reconciled.is_(True), Shipment.actual_provider_cost), else_=0))
    ).group_by(Shipment.provider_name, Shipment.courier).all()
    for p in postpaid_configs:
        p_name = p["name"]
        matched = [row for row in provider_totals if row[0] == p_name or row[1] == p_name]
        count = sum(row[2] for row in matched)
        predicted_cost = sum(row[3] or 0 for row in matched)
        actual_billed = sum(row[4] or 0 for row in matched)

        postpaid_data.append({
            "name": p_name,
            "deposit": p.get("deposit", 0),
            "payment_terms": p.get("paymentTerms", "30 Days"),
            "shipments_count": count,
            "predicted_cost": predicted_cost,
            "actual_billed": actual_billed
        })

    return {
        "total_sales": total_sales,
        "total_collected": total_collected,
        "pending_collection": max(0.0, total_sales - total_collected - b2b_credit),
        "cash_collected": cash,
        "upi_collected": upi,
        "bank_collected": bank,
        "b2b_credit_sales": b2b_credit,
        "collections_by_account": by_account,
        "prepaid_wallets": wallets_data if can_view_financials else [],
        "postpaid_accounts": postpaid_data if can_view_financials else []
    }

@accounts_router.get("/wallets/{wallet_name}/transactions", response_model=List[WalletTransactionOut])
def get_wallet_transactions(
    wallet_name: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.ACCOUNTS_VIEW)),
    db: Session = Depends(get_db)
):
    if not (ctx.get("is_super_admin") or ctx.get("permissions", {}).get("*") or ctx.get("permissions", {}).get("reports.view_financial")):
        raise HTTPException(status_code=403, detail="Financial clearance is required to view provider wallet transactions")
    return db.query(WalletTransaction).filter(
        func.lower(WalletTransaction.wallet) == wallet_name.lower().strip()
    ).order_by(desc(WalletTransaction.created_at)).all()

@accounts_router.post("/wallets/recharge", response_model=WalletTransactionOut)
def record_wallet_recharge(
    payload: WalletRechargeCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.ACCOUNTS_EDIT)),
    db: Session = Depends(get_db)
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Recharge amount must be greater than 0")

    tx = WalletTransaction(
        id=f"tx_{uuid.uuid4().hex[:8]}",
        date=payload.date,
        wallet=payload.wallet.strip(),
        type="recharge",
        amount=payload.amount,
        paid_from=payload.paid_from,
        reference=payload.reference or "Bank Transfer",
        awb="-",
        notes=f"Bank Transfer ({payload.paid_from} -> {payload.wallet} Provider Wallet)",
        balance_after=0.0
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="accounts.wallet_recharge",
        resource_type="wallet_transaction",
        resource_id=tx.id,
        action="wallet_recharge",
        after_data={"wallet": payload.wallet, "amount": payload.amount, "paid_from": payload.paid_from},
        ip_address=request.client.host if request.client else None
    )

    return tx
