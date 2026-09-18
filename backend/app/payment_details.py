"""Shared validation for newly recorded money movements; legacy records stay readable."""
import re
from decimal import Decimal, InvalidOperation
from fastapi import HTTPException


def payment_kind(method):
    if not isinstance(method, str):
        raise HTTPException(400, 'Payment mode is required')
    value = (method or '').strip().lower()
    aliases = {
        'upi': 'UPI', 'phonepe': 'UPI', 'google pay': 'UPI', 'gpay': 'UPI',
        'paytm': 'UPI', 'office qr': 'UPI', 'qr': 'UPI',
        'bank transfer': 'Bank Transfer', 'bank': 'Bank Transfer',
        'neft': 'Bank Transfer', 'rtgs': 'Bank Transfer', 'imps': 'Bank Transfer',
        'cash': 'Cash', 'cheque': 'Cheque', 'card': 'Card', 'other': 'Other',
    }
    if value not in aliases:
        raise HTTPException(400, 'Select a supported payment mode')
    return aliases[value]


def validate_amount(amount):
    try:
        value = Decimal(str(amount))
        if not value.is_finite() or value <= 0 or value > Decimal('1000000000000') or value != value.quantize(Decimal('0.01')):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise HTTPException(400, 'Payment amount must be positive, at most 1 trillion, and have at most two decimal places')
    return float(value)


def validate_payment(method, account, reference, details, *, profile=False, db=None, resolve_account=False):
    kind = payment_kind(method)
    if not isinstance(account, str) or not account.strip() or len(account) > 100:
        raise HTTPException(400, 'Payment account is required')
    # Selected account setup belongs in Settings, not each transaction.
    require_details = True
    if resolve_account:
        from app.models import SystemSettings
        config = db.query(SystemSettings).first() if db is not None else None
        profiles = (config.config_json or {}).get('paymentAccounts', []) if config else []
        saved = next((p for p in profiles if p['name'].strip().casefold() == account.strip().casefold()), None)
        remarks = details.get('remarks', '') if isinstance(details, dict) else ''
        details = {**(saved['details'] if saved else {}), 'remarks': remarks}
        require_details = saved is not None
    if not isinstance(details, dict):
        raise HTTPException(400, 'Payment details are required')
    allowed = {'owner_type', 'account_holder', 'upi_id', 'bank_name', 'account_number', 'ifsc', 'card_last4', 'other_details', 'remarks'}
    clean = {}
    for key in allowed:
        value = details.get(key, '')
        if not isinstance(value, str) or len(value) > 150:
            raise HTTPException(400, f'Invalid payment detail: {key}')
        clean[key] = value.strip()
    if require_details:
        if clean['owner_type'] not in ('Business', 'Proprietor', 'Individual'):
            raise HTTPException(400, 'Select Business, Proprietor or Individual account ownership')
        if not clean['account_holder']:
            raise HTTPException(400, 'Account holder / cash custodian name is required')
        if kind == 'UPI' and not re.fullmatch(r'[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}', clean['upi_id']):
            raise HTTPException(400, 'Enter a valid UPI ID, such as name@bank')
        if kind in ('Bank Transfer', 'Cheque'):
            if not clean['bank_name'] or not re.fullmatch(r'[0-9]{6,34}', clean['account_number']):
                raise HTTPException(400, 'Bank name and a valid bank account number are required')
            clean['ifsc'] = clean['ifsc'].upper()
            if not re.fullmatch(r'[A-Z]{4}0[A-Z0-9]{6}', clean['ifsc']):
                raise HTTPException(400, 'Enter a valid 11-character IFSC')
        if kind == 'Card' and not re.fullmatch(r'[0-9]{4}', clean['card_last4']):
            raise HTTPException(400, 'Enter only the last four digits of the card')
        if kind == 'Other' and not clean['other_details']:
            raise HTTPException(400, 'Describe the payment method and destination')
    if not profile and reference is not None and (not isinstance(reference, str) or len(reference) > 100):
        raise HTTPException(400, 'Payment reference must be text of at most 100 characters')
    if not profile and kind != 'Cash':
        if not isinstance(reference, str):
            raise HTTPException(400, 'Transaction reference is required')
        ref = (reference or '').strip()
        if len(ref) < 4 or len(ref) > 100 or ref.lower() in ('bank transfer', 'none', 'test', 'paid', 'n/a'):
            raise HTTPException(400, 'A valid transaction reference / UTR / cheque number is required')
        if kind == 'Cheque' and not re.fullmatch(r'[0-9]{6}', ref):
            raise HTTPException(400, 'Enter the six-digit cheque number')
    relevant = {'owner_type', 'account_holder', 'remarks'} | {
        'UPI': {'upi_id'}, 'Bank Transfer': {'bank_name', 'account_number', 'ifsc'},
        'Cheque': {'bank_name', 'account_number', 'ifsc'}, 'Card': {'card_last4'},
        'Other': {'other_details'}, 'Cash': set(),
    }[kind]
    result = {key: value for key, value in clean.items() if key in relevant}
    if db is not None and not profile:
        from app.models import SystemSettings
        config = db.query(SystemSettings).first()
        profiles = (config.config_json or {}).get('paymentAccounts', []) if config else []
        saved = next((p for p in profiles if p['name'].strip().casefold() == account.strip().casefold()), None)
        if saved:
            saved_kind = payment_kind(saved['method'])
            compatible = kind == saved_kind or {kind, saved_kind} <= {'Bank Transfer', 'Cheque'}
            expected = saved['details']
            if not compatible or any(result.get(k, '').casefold() != expected.get(k, '').strip().casefold() for k in relevant - {'remarks'}):
                raise HTTPException(409, 'Payment details do not match the saved account. Reload and select its current details.')
    return result if require_details else ({'remarks': clean['remarks']} if clean['remarks'] else {})
