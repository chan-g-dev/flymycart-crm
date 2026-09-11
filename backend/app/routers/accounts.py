# ================================================================
# FLY MY CART CRM - ACCOUNTS & WALLETS ROUTER (routers/accounts.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, case

from app.database import get_db
from app.models import (
    Shipment, WalletTransaction, SystemSettings, AuditLog,
    AccountingEntry, PaymentCollection, AccountCheck, Invoice
)
from decimal import Decimal, ROUND_HALF_UP
from pydantic import BaseModel, Field
from typing import Literal, Optional
from app.collections import collection_totals, shipment_payments_query
from app.schemas import WalletRechargeCreate, WalletTransactionOut
from app.auth import create_audit_log
from app.dependencies import require_permission, require_super_admin
from app.permissions import PermissionCode
from app.wallets import rebuild_wallet_balances

accounts_router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


def money(value):
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def receipt_query(db, start, end, account=None, center=None):
    if start > end:
        raise HTTPException(400, "Start date must not be after end date")
    query = db.query(PaymentCollection).outerjoin(Shipment, PaymentCollection.shipment_id == Shipment.id).filter(
        PaymentCollection.date.between(start.isoformat(), end.isoformat()))
    if account:
        query = query.filter(PaymentCollection.paid_to == account.strip())
    if center:
        query = query.filter(Shipment.center == center)
    return query


@accounts_router.get("/receipts")
def get_receipts(date_from: datetime.date, date_to: datetime.date, account: Optional[str] = None,
                 center: Optional[str] = None, limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
                 ctx=Depends(require_permission(PermissionCode.ACCOUNTS_VIEW)), db: Session = Depends(get_db)):
    query = receipt_query(db, date_from, date_to, account, center)
    count, total = query.with_entities(func.count(PaymentCollection.id), func.coalesce(func.sum(PaymentCollection.amount), 0)).one()
    rows = query.add_columns(Shipment.awb, Shipment.customer_name, Shipment.center).order_by(
        PaymentCollection.date.desc(), PaymentCollection.created_at.desc(), PaymentCollection.id).limit(limit).offset(offset).all()
    return {"total_count": count, "total_amount": money(total), "items": [
        {"id": receipt.id, "date": receipt.date, "awb": awb, "customer": customer, "center": hub,
         "amount": receipt.amount, "payment_method": receipt.payment_method, "paid_to": receipt.paid_to,
         "collected_by": receipt.collected_by, "reference": receipt.reference}
        for receipt, awb, customer, hub in rows]}


@accounts_router.get("/check-options")
def get_check_options(ctx=Depends(require_permission(PermissionCode.ACCOUNTS_VIEW)), db: Session = Depends(get_db)):
    config = db.query(SystemSettings).first()
    config = config.config_json if config else {}
    centers = db.info.get("allowed_centers")
    if centers is None:
        centers = sorted(set(config.get("centers", []) + [r[0] for r in db.query(Shipment.center).distinct() if r[0]]))
    accounts = sorted(set(config.get("paidToAccounts", []) + [r[0] for r in db.query(PaymentCollection.paid_to).distinct() if r[0]]))
    return {"accounts": accounts, "centers": centers, "all_centers_allowed": db.info.get("allowed_centers") is None}


class AccountCheckCreate(BaseModel):
    date: datetime.date
    account: str = Field(min_length=1, max_length=100)
    center: Optional[str] = Field(default=None, max_length=100)
    counted_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)
    notes: Optional[str] = Field(default=None, max_length=1000)


@accounts_router.post("/checks", status_code=201)
def record_account_check(payload: AccountCheckCreate, ctx=Depends(require_permission(PermissionCode.ACCOUNTS_EDIT)), db: Session = Depends(get_db)):
    account = payload.account.strip()
    center = payload.center.strip() if payload.center else None
    if not account:
        raise HTTPException(400, "Payment account is required")
    allowed = db.info.get("allowed_centers")
    if allowed is not None and center not in allowed:
        raise HTTPException(403, "Select a center within your assigned access")
    if center and center not in get_check_options(ctx, db)["centers"]:
        raise HTTPException(400, "Select a configured or existing shipment center")
    query = receipt_query(db, payload.date, payload.date, account, center)
    count, total = query.with_entities(func.count(PaymentCollection.id), func.coalesce(func.sum(PaymentCollection.amount), 0)).one()
    check = AccountCheck(date=payload.date.isoformat(), account=account, center=center,
        expected_amount=money(total), counted_amount=float(payload.counted_amount),
        difference=money(payload.counted_amount - Decimal(str(money(total)))), receipt_count=count,
        notes=payload.notes, checked_by=ctx["display_name"], created_by=ctx["user_id"])
    db.add(check)
    db.flush()
    create_audit_log(db, ctx["user_id"], ctx["display_name"], "accounts.check", "account_check", "create",
        resource_id=check.id, after_data={"account": account, "date": check.date, "center": center,
        "expected_amount": check.expected_amount, "counted_amount": check.counted_amount, "difference": check.difference}, auto_commit=False)
    db.commit()
    db.refresh(check)
    return check


@accounts_router.get("/checks")
def get_account_checks(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                       ctx=Depends(require_permission(PermissionCode.ACCOUNTS_VIEW)), db: Session = Depends(get_db)):
    query = db.query(AccountCheck)
    return {"total_count": query.count(), "items": query.order_by(AccountCheck.created_at.desc(), AccountCheck.id).limit(limit).offset(offset).all()}


class AccountingEntryCreate(BaseModel):
    date: datetime.date
    kind: Literal["provider_payment", "provider_deposit", "expense"]
    provider: Optional[str] = None
    amount: float = Field(gt=0, allow_inf_nan=False)
    reference: str = Field(min_length=1, max_length=200)
    account: str = Field(min_length=1, max_length=100)


@accounts_router.post("/entries", status_code=201)
def record_accounting_entry(payload: AccountingEntryCreate, ctx=Depends(require_super_admin), db: Session = Depends(get_db)):
    if not payload.reference.strip() or not payload.account.strip():
        raise HTTPException(status_code=400, detail="Reference and payment account are required")
    if payload.kind != "expense":
        config = db.query(SystemSettings).first()
        providers = (config.config_json if config else {}).get("postpaidProviders", [])
        if payload.provider not in [p["name"] for p in providers]:
            raise HTTPException(status_code=400, detail="Select a configured postpaid provider")
    entry = AccountingEntry(**{**payload.model_dump(), "date": payload.date.isoformat()}, created_by=ctx["user_id"])
    db.add(entry)
    db.flush()
    create_audit_log(db, ctx["user_id"], ctx["display_name"], "accounts.entry", "accounting_entry", "create", resource_id=entry.id, after_data={"kind": entry.kind, "amount": entry.amount, "reference": entry.reference}, auto_commit=False)
    db.commit()
    return {"id": entry.id, "status": "recorded"}

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
    balance = case((func.coalesce(paid.c.total, Shipment.price) > func.coalesce(paid.c.paid, 0), func.coalesce(paid.c.total, Shipment.price) - func.coalesce(paid.c.paid, 0)), else_=0)
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
    ).filter(Shipment.provider_type == "postpaid").group_by(Shipment.provider_name, Shipment.courier).all()
    for p in postpaid_configs:
        p_name = p["name"]
        matched = [row for row in provider_totals if row[0] == p_name]
        count = sum(row[2] for row in matched)
        predicted_cost = sum(row[3] or 0 for row in matched)
        actual_billed = sum(row[4] or 0 for row in matched)
        unbilled = float(db.query(func.coalesce(func.sum(Shipment.provider_cost), 0)).filter(Shipment.provider_name == p_name, Shipment.provider_type == "postpaid", Shipment.cost_reconciled.is_(False)).scalar())
        ledger = dict(db.query(AccountingEntry.kind, func.sum(AccountingEntry.amount)).filter(AccountingEntry.provider == p_name).group_by(AccountingEntry.kind).all())

        postpaid_data.append({
            "name": p_name,
            "deposit": float(p.get("deposit", 0)) + ledger.get("provider_deposit", 0),
            "unbilled_usage": unbilled,
            "payments_made": ledger.get("provider_payment", 0),
            "net_payable": max(0, actual_billed - ledger.get("provider_payment", 0)),
            "payment_terms": p.get("paymentTerms", "30 Days"),
            "shipments_count": count,
            "predicted_cost": predicted_cost,
            "actual_billed": actual_billed
        })

    tax_invoices = db.query(
        func.coalesce(func.sum(Invoice.total), 0),
        func.coalesce(func.sum(Invoice.gst), 0)
    ).one()
    total_sales_with_gst = float(tax_invoices[0]) if tax_invoices[0] else round(float(total_sales) * 1.18, 2)
    gst_total = float(tax_invoices[1]) if tax_invoices[1] else round(float(total_sales) * 0.18, 2)

    return {
        "total_sales": total_sales,
        "total_sales_with_gst": total_sales_with_gst,
        "gst_total": gst_total,
        "total_collected": total_collected,
        "pending_collection": max(0.0, total_sales_with_gst - total_collected - b2b_credit),
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
    rebuild_wallet_balances(db, tx.wallet)
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
