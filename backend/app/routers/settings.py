from app.payment_details import validate_payment, payment_kind
# ================================================================
# FLY MY CART CRM - SYSTEM SETTINGS & AUDIT ROUTER (app/routers/settings.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import SystemSettings, AuditLog
from app.schemas import AuditLogOut
from app.dependencies import (
    require_permission,
    require_super_admin,
)
from app.auth import create_audit_log
from app.cache import cache_engine
from app.carrier_accounts import ensure_carrier_accounts

settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.get("")
@settings_router.get("/")
def get_settings(
    ctx: Dict[str, Any] = Depends(require_permission("settings.view")),
    db: Session = Depends(get_db)
):
    """Returns system configuration parameters and banking settings."""
    # Account revisions must be current across every API worker.
    rec = db.query(SystemSettings).first()
    res = rec.config_json if rec else {}
    if not ctx.get('is_super_admin'):
        safe_keys = {'companyName', 'companyPhone', 'companyEmail', 'gstin', 'centerName', 'centerAddress',
            'centers', 'couriers', 'serviceTypes', 'paymentMethods', 'paidToAccounts', 'employees',
            'defaultGstRate', 'gstRates', 'weightRules', 'invoicePrefix', 'invoiceLogo', 'shipmentStatuses'}
        res = {key: value for key, value in res.items() if key in safe_keys}
    return res


@settings_router.put("")
@settings_router.put("/")
def update_settings(
    payload: Dict[str, Any],
    request: Request,
    ctx: Dict[str, Any] = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Updates global system configuration, carrier accounts, or collection banks.
    Protected by Step-Up MFA (<10 min).
    """
    from app.business_options import validate_business_options
    payload = validate_business_options(payload)
    if 'weightRules' in payload:
        from app.weight_rules import WeightSettings
        from pydantic import ValidationError
        try:
            payload['weightRules'] = WeightSettings.model_validate(payload['weightRules']).model_dump()
        except ValidationError as exc:
            raise HTTPException(400, 'Invalid shipment weight rules: ' + str(exc)) from exc
    if 'paymentAccounts' in payload:
        profiles = payload['paymentAccounts']
        if not isinstance(profiles, list) or len(profiles) > 200:
            raise HTTPException(400, 'Payment accounts must be a list of at most 200 accounts')
        names = set()
        validated = []
        for profile in profiles:
            if not isinstance(profile, dict):
                raise HTTPException(400, 'Invalid payment account')
            name = profile.get('name', '')
            if not isinstance(name, str) or not name.strip() or len(name) > 100 or name.strip().lower() in names:
                raise HTTPException(400, 'Payment account names must be unique and at most 100 characters')
            names.add(name.strip().lower())
            details = validate_payment(profile.get('method'), name, None, profile.get('details'), profile=True)
            validated.append({'name': name.strip(), 'method': payment_kind(profile['method']), 'details': details})
        payload['paymentAccounts'] = validated
    payload = ensure_carrier_accounts(payload)
    rec = db.query(SystemSettings).with_for_update().first()
    before_cfg = rec.config_json if rec else {}
    version = before_cfg.get('paymentAccountsVersion', 0)
    if 'paymentAccounts' in payload and payload['paymentAccounts'] != before_cfg.get('paymentAccounts', []):
        if payload.get('paymentAccountsVersion', 0) != version:
            raise HTTPException(409, 'Payment accounts changed in another session. Reload Settings before saving.')
        version += 1
    payload['paymentAccountsVersion'] = version
    if 'paymentAccounts' in payload:
        names = payload.get('paidToAccounts', before_cfg.get('paidToAccounts', []))
        if not isinstance(names, list) or any(not isinstance(n, str) for n in names):
            raise HTTPException(400, 'Payment account names must be a list of text values')
        payload['paidToAccounts'] = list(dict.fromkeys(names + [p['name'] for p in payload['paymentAccounts']]))
    if "paymentAccounts" not in payload and "paymentAccounts" in before_cfg:
        payload["paymentAccounts"] = before_cfg["paymentAccounts"]
    if 'weightRules' not in payload and 'weightRules' in before_cfg:
        payload['weightRules'] = before_cfg['weightRules']
    # Invoice branding is edited in the invoice preview. A stale settings form
    # must not overwrite the independently saved logo selection.
    payload['companyRolePolicyV1'] = before_cfg.get('companyRolePolicyV1', False)
    payload.pop('expenseCategories', None)
    if 'expenseCategories' in before_cfg:
        payload['expenseCategories'] = before_cfg['expenseCategories']
    payload.pop('invoiceLogo', None)
    if 'invoiceLogo' in before_cfg:
        payload['invoiceLogo'] = before_cfg['invoiceLogo']
    if not rec:
        rec = SystemSettings(id=1, config_json=payload)
        db.add(rec)
    else:
        rec.config_json = payload

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="settings.update",
        resource_type="settings",
        resource_id="system_settings",
        action="updated_system_settings",
        before_data=before_cfg,
        after_data=payload,
        ip_address=request.client.host if request.client else None, auto_commit=False
    )
    db.commit()
    cache_engine.delete("global_system_settings")
    return rec.config_json


@settings_router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    limit: int = 50,
    ctx: Dict[str, Any] = Depends(require_permission("users.manage_permissions")),
    db: Session = Depends(get_db)
):
    """Returns audit trail."""
    return db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
