from app.access_policy import can_view_costs
"""Accounts workspace reporting and private expense-bill attachments."""
import datetime as dt
import uuid
from collections import defaultdict
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Shipment, Invoice, PaymentCollection, AccountingEntry, WalletTransaction, Refund, SystemSettings
from app.dependencies import require_permission, require_super_admin
from app.storage import storage_manager
from app.auth import create_audit_log

workspace_router = APIRouter()

from pydantic import BaseModel, Field, field_validator
from app.cache import cache_engine

DEFAULT_EXPENSE_CATEGORIES = ['Rent', 'Employee Salary', 'Courier Partner Bill (Monthly)', 'Porter / Local Transport', 'Purchase of Boxes', 'Packing Material', 'Office / Stationery', 'Fuel / Travel', 'Other Small Expenses']

class ExpenseCategoriesUpdate(BaseModel):
    categories: list[str] = Field(max_length=100)

    @field_validator('categories')
    @classmethod
    def validate_categories(cls, values):
        cleaned = [value.strip() for value in values]
        if any(not value or len(value) > 100 for value in cleaned):
            raise ValueError('Each category must contain 1 to 100 characters')
        if len({value.casefold() for value in cleaned}) != len(cleaned):
            raise ValueError('Category names must be unique')
        return cleaned

@workspace_router.get('/expense-categories')
def get_expense_categories(ctx=Depends(require_permission('accounts.view')), db: Session = Depends(get_db)):
    rec = db.query(SystemSettings).first()
    return {'categories': (rec.config_json or {}).get('expenseCategories', DEFAULT_EXPENSE_CATEGORIES) if rec else DEFAULT_EXPENSE_CATEGORIES}

@workspace_router.put('/expense-categories')
def update_expense_categories(payload: ExpenseCategoriesUpdate, ctx=Depends(require_super_admin), db: Session = Depends(get_db)):
    rec = db.query(SystemSettings).with_for_update().first()
    if not rec:
        rec = SystemSettings(id=1, config_json={})
        db.add(rec)
    config = dict(rec.config_json or {})
    before = config.get('expenseCategories', DEFAULT_EXPENSE_CATEGORIES)
    rec.config_json = {**config, 'expenseCategories': payload.categories}
    create_audit_log(db, ctx['user_id'], ctx['display_name'], 'accounts.categories', 'settings', 'update_expense_categories',
                     resource_id='system_settings', before_data={'categories': before}, after_data={'categories': payload.categories}, auto_commit=False)
    db.commit()
    cache_engine.delete('global_system_settings')
    return {'categories': payload.categories}


def financial_access(ctx):
    return bool(ctx.get('is_super_admin') or ctx.get('permissions', {}).get('*') or ctx.get('permissions', {}).get('reports.view_financial'))

def money(value):
    return round(float(value or 0), 2)

def dates(date_from, date_to):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(400, 'From date must be on or before to date')

def window(query, column, date_from, date_to):
    if date_from:
        query = query.filter(column >= date_from.isoformat())
    if date_to:
        query = query.filter(column <= date_to.isoformat())
    return query

def shipment_query(db, center=None):
    query = db.query(Shipment)
    return query.filter(Shipment.center == center) if center else query

def entry_query(db, center=None):
    query = db.query(AccountingEntry)
    return query.filter(AccountingEntry.center == center) if center else query

def receipt_query(db, center=None):
    query = db.query(PaymentCollection)
    if center:
        query = query.filter(PaymentCollection.shipment_id.in_(shipment_query(db, center).with_entities(Shipment.id)))
    return query

def refund_query(db, center=None):
    return db.query(Refund).filter(Refund.awb.in_(shipment_query(db, center).with_entities(Shipment.awb)))


def period_totals(db, start, end, center, financial):
    ships = window(shipment_query(db, center), Shipment.date, start, end)
    sales, gross, cost = ships.with_entities(
        func.coalesce(func.sum(Shipment.price), 0),
        func.coalesce(func.sum(func.coalesce(Shipment.total_amount, Shipment.price + func.coalesce(Shipment.gst_amount, 0))), 0),
        func.coalesce(func.sum(case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost)), 0)
    ).one()
    expenses = window(entry_query(db, center), AccountingEntry.date, start, end).filter(AccountingEntry.kind == 'expense').with_entities(func.coalesce(func.sum(AccountingEntry.amount), 0)).scalar()
    received = window(receipt_query(db, center), PaymentCollection.date, start, end).with_entities(func.coalesce(func.sum(PaymentCollection.amount), 0)).scalar()
    refunds = window(refund_query(db, center), Refund.approval_date, start, end).filter(
        Refund.status.in_(['Approved', 'Refunded'])
    ).with_entities(func.coalesce(func.sum(Refund.amount), 0)).scalar()
    # Older PostgreSQL schemas can return Decimal aggregates alongside floats.
    sales, gross, cost, expenses, refunds = map(money, (sales, gross, cost, expenses, refunds))
    return {'sales': money(sales), 'gross_sales': money(gross), 'cost': money(cost) if financial else None,
            'expenses': money(expenses) if financial else None, 'refunds': refunds if financial else None, 'net': money(sales - cost - expenses - refunds) if financial else None,
            'net_with_gst': money(gross - cost - expenses - refunds) if financial else None,
            'collected': money(received)}

@workspace_router.get('/overview')
def get_workspace_overview(date_from: dt.date | None = None, date_to: dt.date | None = None,
                           center: str | None = None,
                           ctx=Depends(require_permission('accounts.view')), db: Session = Depends(get_db)):
    dates(date_from, date_to)
    financial = financial_access(ctx)
    totals = period_totals(db, date_from, date_to, center, financial)
    previous = None
    if date_from and date_to:
        duration = date_to - date_from + dt.timedelta(days=1)
        previous = period_totals(db, date_from - duration, date_from - dt.timedelta(days=1), center, financial)
    ships = window(shipment_query(db, center), Shipment.date, date_from, date_to)
    entries = window(entry_query(db, center), AccountingEntry.date, date_from, date_to)
    receipts = window(receipt_query(db, center), PaymentCollection.date, date_from, date_to)
    by_mode = {name or 'Other': money(value) for name, value in receipts.with_entities(PaymentCollection.payment_method, func.sum(PaymentCollection.amount)).group_by(PaymentCollection.payment_method)}
    by_category = {name or 'General': money(value) for name, value in entries.filter(AccountingEntry.kind == 'expense').with_entities(AccountingEntry.category, func.sum(AccountingEntry.amount)).group_by(AccountingEntry.category)} if financial else None
    by_partner = {name or 'Other': money(value) for name, value in ships.with_entities(Shipment.provider_name, func.sum(case((Shipment.cost_reconciled.is_(True), func.coalesce(Shipment.actual_provider_cost, Shipment.provider_cost)), else_=Shipment.provider_cost))).group_by(Shipment.provider_name)} if financial else None
    # Receivables belong to shipments booked in the selected period; balances are current.
    invoices = db.query(Invoice).filter(Invoice.shipment_id.in_(ships.with_entities(Shipment.id)))
    pending, b2b = 0, 0
    b2b_ids = ships.filter(Shipment.customer_type == 'B2B').with_entities(Shipment.id)
    pending = money(invoices.with_entities(func.coalesce(func.sum(Invoice.balance), 0)).scalar())
    b2b = money(invoices.filter(Invoice.shipment_id.in_(b2b_ids)).with_entities(func.coalesce(func.sum(Invoice.balance), 0)).scalar())
    config_row = db.query(SystemSettings).first()
    config = config_row.config_json if config_row else {}
    accounts = set(config.get('paidToAccounts', []))
    accounts.update(name for (name,) in receipt_query(db, center).with_entities(PaymentCollection.paid_to).distinct() if name)
    for source, target in entry_query(db, center).with_entities(AccountingEntry.account, AccountingEntry.transfer_to):
        if source: accounts.add(source)
        if target: accounts.add(target)
    # These are recorded net movements, not a claim about reconciled bank balances.
    bank = defaultdict(float)
    for name, value in window(receipt_query(db, center), PaymentCollection.date, None, date_to).with_entities(PaymentCollection.paid_to, func.sum(PaymentCollection.amount)).group_by(PaymentCollection.paid_to):
        bank[name] += float(value or 0)
    if financial:
        for entry in window(entry_query(db, center), AccountingEntry.date, None, date_to):
            bank[entry.account] -= float(entry.amount)
            if entry.kind == 'transfer' and entry.transfer_to:
                bank[entry.transfer_to] += float(entry.amount)
        # Wallet recharges have no center field; only include them in organization-wide balances.
        if not center and db.info.get('allowed_centers') is None:
            for name, value in window(db.query(WalletTransaction), WalletTransaction.date, None, date_to).filter(WalletTransaction.type == 'recharge').with_entities(WalletTransaction.paid_from, func.sum(WalletTransaction.amount)).group_by(WalletTransaction.paid_from):
                if name:
                    accounts.add(name)
                    bank[name] -= float(value or 0)
    if financial:
        for refund in window(refund_query(db, center), Refund.refund_date, None, date_to).filter(Refund.status == 'Refunded'):
            account = (refund.payment_details or {}).get('account')
            if account:
                accounts.add(account)
                bank[account] -= float(refund.amount or 0)
    refunds = refund_query(db, center)
    refunds = window(refunds, Refund.request_date, date_from, date_to)
    return {
        'totals': {**totals, 'pending': pending, 'b2b': b2b}, 'previous': previous,
        'financial_access': financial, 'by_mode': by_mode, 'by_category': by_category, 'by_partner': by_partner,
        'accounts': sorted(accounts),
        'bank_accounts': [{'name': name, 'recorded_balance': money(bank[name])} for name in sorted(accounts)] if financial else [],
        'expense_categories': sorted(set(config.get('expenseCategories', [])) | {name or 'General' for (name,) in entry_query(db, center).filter(AccountingEntry.kind == 'expense').with_entities(AccountingEntry.category).distinct()}),
        'couriers': sorted(name for (name,) in ships.with_entities(Shipment.courier).distinct() if name),
        'transfer_count': entries.filter(AccountingEntry.kind == 'transfer').count() if financial else None,
        'refund_count': refunds.filter(Refund.status != 'Rejected').count(),
        'refund_amount': money(refunds.filter(Refund.status == 'Refunded').with_entities(func.coalesce(func.sum(Refund.amount), 0)).scalar()),
        'shipment_count': ships.count(),
    }

@workspace_router.get('/shipment-ledger')
def get_shipment_ledger(date_from: dt.date | None = None, date_to: dt.date | None = None,
                        center: str | None = None, courier: str | None = None, account: str | None = None,
                        status: str | None = None, search: str | None = None,
                        limit: int = Query(5, ge=1, le=500), offset: int = Query(0, ge=0),
                        ctx=Depends(require_permission('accounts.view')), db: Session = Depends(get_db)):
    dates(date_from, date_to)
    financial = financial_access(ctx)
    query = window(shipment_query(db, center), Shipment.date, date_from, date_to)
    if courier: query = query.filter(Shipment.courier == courier)
    if account: query = query.filter(Shipment.paid_to == account)
    if status: query = query.filter(Shipment.payment_status == status)
    if search:
        query = query.filter((Shipment.awb.ilike(f'%{search}%')) | (Shipment.customer_name.ilike(f'%{search}%')))
    count = query.count()
    rows = query.order_by(Shipment.date.desc(), Shipment.created_at.desc(), Shipment.id).offset(offset).limit(limit).all()
    ids = [s.id for s in rows]
    expenses = dict(db.query(AccountingEntry.shipment_id, func.sum(AccountingEntry.amount)).filter(AccountingEntry.kind == 'expense', AccountingEntry.shipment_id.in_(ids)).group_by(AccountingEntry.shipment_id)) if financial and ids else {}
    result = []
    for s in rows:
        cost = s.actual_provider_cost if s.cost_reconciled and s.actual_provider_cost is not None else s.provider_cost
        expense = money(expenses.get(s.id, 0))
        gross_sale = money(s.total_amount if s.total_amount is not None else money(s.price) + money(s.gst_amount))
        result.append({'id': s.id, 'date': s.date, 'awb': s.awb, 'courier': s.courier, 'customer_name': s.customer_name,
            'customer_id': s.customer_id, 'destination': s.receiver_country or s.receiver_city,
            'sale': money(s.price), 'gross_sale': gross_sale, 'cost': money(cost) if can_view_costs(ctx) else None, 'expense': expense if financial else None,
            'value': money(money(s.price) - money(cost) - expense) if financial else None,
            'value_with_gst': money(gross_sale - money(cost) - expense) if financial else None,
            'payment_mode': s.payment_method, 'collection_status': s.payment_status,
            # Payouts are provider-level; do not pretend they are allocated to individual AWBs.
            'courier_status': ('Paid' if s.provider_type == 'prepaid' else 'Pending')})
    return {'items': result, 'total_count': count}

@workspace_router.get('/entries')
def get_account_entries(kind: str | None = None, date_from: dt.date | None = None, date_to: dt.date | None = None,
                        center: str | None = None, limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
                        ctx=Depends(require_permission('accounts.view')), db: Session = Depends(get_db)):
    if not financial_access(ctx): raise HTTPException(403, 'Financial access required')
    dates(date_from, date_to)
    query = window(entry_query(db, center), AccountingEntry.date, date_from, date_to)
    if kind: query = query.filter(AccountingEntry.kind == kind)
    return {'total_count': query.count(), 'items': [{key: getattr(entry, key) for key in (
        'id', 'date', 'kind', 'category', 'vendor', 'payment_mode', 'account', 'transfer_to', 'amount', 'reference', 'payment_details', 'bill_name', 'shipment_id'
    )} for entry in query.order_by(AccountingEntry.date.desc(), AccountingEntry.created_at.desc(), AccountingEntry.id).offset(offset).limit(limit)]}

@workspace_router.post('/entries/{entry_id}/bill')
async def upload_expense_bill(entry_id: str, file: UploadFile = File(...),
                              ctx=Depends(require_super_admin), db: Session = Depends(get_db)):
    entry = db.query(AccountingEntry).filter(AccountingEntry.id == entry_id, AccountingEntry.kind == 'expense').first()
    if not entry: raise HTTPException(404, 'Expense not found')
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024: raise HTTPException(400, 'Bill must be 5 MB or smaller')
    if data.startswith(b'%PDF-'): extension, mime = 'pdf', 'application/pdf'
    elif data.startswith(b'\x89PNG\r\n\x1a\n'): extension, mime = 'png', 'image/png'
    elif data.startswith(b'\xff\xd8\xff'): extension, mime = 'jpg', 'image/jpeg'
    else: raise HTTPException(400, 'Upload a PDF, PNG or JPEG bill')
    key = storage_manager.upload_file(data, f'expense-bills/{entry.id}/{uuid.uuid4().hex}.{extension}', mime)
    entry.bill_key = key
    entry.bill_name = (file.filename or f'bill.{extension}')[:200]
    create_audit_log(db, ctx['user_id'], ctx['display_name'], 'accounts.bill', 'accounting_entry', 'attach_bill', resource_id=entry.id, after_data={'filename': entry.bill_name}, auto_commit=False)
    db.commit()
    return {'status': 'attached', 'bill_name': entry.bill_name}

@workspace_router.get('/entries/{entry_id}/bill')
def download_expense_bill(entry_id: str, ctx=Depends(require_permission('accounts.view')), db: Session = Depends(get_db)):
    if not financial_access(ctx): raise HTTPException(403, 'Financial access required')
    entry = db.query(AccountingEntry).filter(AccountingEntry.id == entry_id).first()
    if not entry or not entry.bill_key: raise HTTPException(404, 'No bill attached')
    return Response(storage_manager.download_file(entry.bill_key), media_type='application/octet-stream', headers={
        'Content-Disposition': "attachment; filename*=UTF-8''" + quote(entry.bill_name or 'bill', safe=''), 'Cache-Control': 'no-store'})
