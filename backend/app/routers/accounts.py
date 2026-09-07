# ================================================================
# FLY MY CART CRM - ACCOUNTS & WALLETS ROUTER (routers/accounts.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import Shipment, WalletTransaction, SystemSettings, AuditLog
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
    shipments = db.query(Shipment).all()

    total_sales = sum(s.price for s in shipments)
    total_collected = 0.0
    cash = 0.0
    upi = 0.0
    bank = 0.0
    b2b_credit = 0.0
    by_account = {}

    for s in shipments:
        if s.payment_status == "Paid":
            total_collected += s.price
            method = (s.payment_method or "").lower()
            if "cash" in method:
                cash += s.price
            elif any(x in method for x in ["upi", "phonepe", "gpay", "google", "qr"]):
                upi += s.price
            elif any(x in method for x in ["bank", "transfer", "neft", "rtgs"]):
                bank += s.price
            else:
                upi += s.price

            acc = s.paid_to or "Office QR"
            by_account[acc] = by_account.get(acc, 0.0) + s.price
        elif s.payment_status == "Partial":
            partial = round(s.price * 0.5)
            total_collected += partial
            upi += partial
            acc = s.paid_to or "Office QR"
            by_account[acc] = by_account.get(acc, 0.0) + partial
        elif s.payment_status == "B2B Credit":
            b2b_credit += s.price

    # Prepaid Wallets
    wallets_data = []
    settings_rec = db.query(SystemSettings).first()
    prepaid_configs = settings_rec.config_json.get("prepaidWallets", []) if settings_rec else [
        {"name": "ICL", "openingBalance": 50000},
        {"name": "BRV", "openingBalance": 30000}
    ]

    for w in prepaid_configs:
        w_name = w["name"]
        opening = float(w.get("openingBalance", 0))
        txs = db.query(WalletTransaction).filter(WalletTransaction.wallet == w_name).all()
        recharges = sum(tx.amount for tx in txs if tx.type == "recharge")
        usage = sum(tx.amount for tx in txs if tx.type == "usage")
        current_balance = opening + recharges - usage

        wallets_data.append({
            "name": w_name,
            "opening_balance": opening,
            "total_recharges": recharges,
            "total_usage": usage,
            "current_balance": current_balance,
            "transactions_count": len(txs)
        })

    # Postpaid Accounts
    postpaid_data = []
    postpaid_configs = settings_rec.config_json.get("postpaidProviders", []) if settings_rec else [
        {"name": "Aramex", "deposit": 200000, "paymentTerms": "15 Days"},
        {"name": "Blue Dart", "deposit": 150000, "paymentTerms": "30 Days"}
    ]

    for p in postpaid_configs:
        p_name = p["name"]
        prov_shipments = db.query(Shipment).filter(
            or_(Shipment.courier == p_name, Shipment.provider_name == p_name)
        ).all()
        predicted_cost = sum(s.provider_cost for s in prov_shipments)
        actual_billed = sum(s.actual_provider_cost for s in prov_shipments)

        postpaid_data.append({
            "name": p_name,
            "deposit": p.get("deposit", 0),
            "payment_terms": p.get("paymentTerms", "30 Days"),
            "shipments_count": len(prov_shipments),
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
        "prepaid_wallets": wallets_data,
        "postpaid_accounts": postpaid_data
    }

@accounts_router.get("/wallets/{wallet_name}/transactions", response_model=List[WalletTransactionOut])
def get_wallet_transactions(
    wallet_name: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.ACCOUNTS_VIEW)),
    db: Session = Depends(get_db)
):
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
