from app.payment_details import validate_payment, payment_kind
# ================================================================
# FLY MY CART CRM - SYSTEM SETTINGS & AUDIT ROUTER (app/routers/settings.py)
# ================================================================

import uuid
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException, Query
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
            'customerTypes', 'centers', 'couriers', 'courierLogos', 'serviceTypes', 'paymentMethods', 'paidToAccounts', 'employees',
            'defaultGstRate', 'gstRates', 'weightRules', 'invoicePrefix', 'invoiceLogo', 'shipmentStatuses', 'attendanceSettings', 'messageTemplates'}
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
    for policy_key in ('companyRolePolicyV2', 'companyRolePolicyV3', 'companyRolePolicyV4'):
        payload[policy_key] = before_cfg.get(policy_key, False)
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


@settings_router.get("/kyc-storage")
def get_kyc_storage_stats(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    ctx: Dict[str, Any] = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Returns statistics and records for stored KYC / Aadhaar images."""
    from app.models import Shipment, Customer
    from sqlalchemy import or_, func, cast, String, literal, union_all, select
    from app.business_dates import business_today

    for value in (date_from, date_to):
        if value:
            try:
                datetime.date.fromisoformat(value)
            except ValueError:
                raise HTTPException(422, "Use valid YYYY-MM-DD dates")
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must not exceed end date")
    today = business_today()
    cutoff_3m = (today - datetime.timedelta(days=90)).isoformat()
    cutoff_6m = (today - datetime.timedelta(days=180)).isoformat()
    shipment_date = func.coalesce(func.nullif(Shipment.date, ''), func.substr(cast(Shipment.created_at, String), 1, 10))
    customer_date = func.substr(cast(Customer.created_at, String), 1, 10)
    sq = db.query(Shipment).filter(or_(*[
        column.isnot(None) & (column != '') for column in
        (Shipment.id_proof_front, Shipment.id_proof_back, Shipment.receiver_id_proof_front, Shipment.receiver_id_proof_back)
    ]))
    cq = db.query(Customer).filter(or_(*[
        column.isnot(None) & (column != '') for column in (Customer.id_proof_front, Customer.id_proof_back)
    ]))
    count_total = sq.count() + cq.count()
    count_3m = sq.filter(shipment_date < cutoff_3m).count() + cq.filter(customer_date < cutoff_3m).count()
    count_6m = sq.filter(shipment_date < cutoff_6m).count() + cq.filter(customer_date < cutoff_6m).count()
    if search.strip():
        pattern = search.strip()
        sq = sq.filter(or_(*[column.icontains(pattern, autoescape=True) for column in (
            Shipment.awb, Shipment.sender_name, Shipment.customer_name, Shipment.sender_phone,
            Shipment.sender_id_proof, Shipment.receiver_name, Shipment.receiver_phone, Shipment.receiver_id_proof)]))
        cq = cq.filter(or_(*[column.icontains(pattern, autoescape=True) for column in (Customer.name, Customer.mobile, Customer.id_proof)]))
    if date_from:
        sq, cq = sq.filter(shipment_date >= date_from), cq.filter(customer_date >= date_from)
    if date_to:
        sq, cq = sq.filter(shipment_date <= date_to), cq.filter(customer_date <= date_to)
    filtered_total = sq.count() + cq.count()
    references = union_all(
        sq.with_entities(Shipment.id.label('id'), literal('shipment').label('kind'), shipment_date.label('date')).statement,
        cq.with_entities(Customer.id.label('id'), literal('customer').label('kind'), customer_date.label('date')).statement,
    ).subquery()
    page = db.execute(select(references).order_by(references.c.date.desc(), references.c.kind, references.c.id).offset(offset).limit(limit)).all()
    shipments_with_kyc = db.query(Shipment).filter(Shipment.id.in_([r.id for r in page if r.kind == 'shipment'])).all()
    customers_with_kyc = db.query(Customer).filter(Customer.id.in_([r.id for r in page if r.kind == 'customer'])).all()
    records = []

    for s in shipments_with_kyc:
        s_date = str(s.date or "")[:10]
        sender_img = s.id_proof_front or s.id_proof_back
        receiver_img = s.receiver_id_proof_front or s.receiver_id_proof_back

        records.append({
            "id": s.id,
            "raw_id": s.id,
            "type": "shipment",
            "awb": s.awb,
            "sender_name": s.sender_name or s.customer_name,
            "sender_phone": s.sender_phone,
            "sender_email": s.sender_email,
            "sender_id_proof": s.sender_id_proof,
            "receiver_name": s.receiver_name,
            "receiver_phone": s.receiver_phone,
            "receiver_email": s.receiver_email,
            "receiver_id_proof": s.receiver_id_proof,
            "sender_image": sender_img,
            "receiver_image": receiver_img,
            "has_sender_image": bool(sender_img),
            "has_receiver_image": bool(receiver_img),
            "date": s_date or str(s.created_at or "")[:10],
            "center": s.center
        })

    for c in customers_with_kyc:
        c_date = str(c.created_at or "")[:10]
        cust_img = c.id_proof_front or c.id_proof_back

        records.append({
            "id": c.id,
            "raw_id": c.id,
            "type": "customer",
            "awb": f"Customer: {c.name}",
            "sender_name": c.name,
            "sender_phone": c.mobile,
            "sender_email": c.email,
            "sender_id_proof": c.id_proof,
            "receiver_name": "—",
            "receiver_phone": "—",
            "receiver_email": None,
            "receiver_id_proof": "—",
            "sender_image": cust_img,
            "receiver_image": None,
            "has_sender_image": bool(cust_img),
            "has_receiver_image": False,
            "date": c_date,
            "center": c.center
        })

    ordering = {(r.kind, r.id): index for index, r in enumerate(page)}
    records.sort(key=lambda record: ordering[(record["type"], record["id"])])

    return {
        "total_documents": count_total,
        "older_than_3_months": count_3m,
        "older_than_6_months": count_6m,
        "filtered_total": filtered_total,
        "limit": limit,
        "offset": offset,
        "records": records
    }


@settings_router.post("/kyc-storage/cleanup")
def cleanup_kyc_storage(
    payload: Dict[str, Any],
    request: Request,
    ctx: Dict[str, Any] = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Purges KYC / ID front & back images by custom date range, specific record IDs, or age duration.
    Preserves text reference numbers and all customer/shipment operational metadata.
    """
    from app.models import Shipment, Customer
    from sqlalchemy import or_

    months = payload.get("older_than_months")
    days = payload.get("older_than_days")
    custom_cutoff = payload.get("custom_cutoff")
    from_date = payload.get("from_date")
    to_date = payload.get("to_date")
    record_ids = payload.get("record_ids")

    # Fail closed: an invalid selector must never turn into a broader purge.
    selectors = [record_ids is not None, bool(from_date or to_date),
                 custom_cutoff is not None, months is not None, days is not None]
    if sum(selectors) != 1:
        raise HTTPException(422, "Provide exactly one cleanup selector")
    if record_ids is not None and (
        not isinstance(record_ids, list) or not record_ids
        or any(not isinstance(value, str) or not value.strip() for value in record_ids)
    ):
        raise HTTPException(422, "record_ids must be a non-empty list of IDs")
    for value in (from_date, to_date, custom_cutoff):
        if value is not None:
            try:
                parsed = datetime.date.fromisoformat(value)
                if parsed.isoformat() != value:
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(422, "Cleanup dates must use YYYY-MM-DD")
    if from_date and to_date and from_date > to_date:
        raise HTTPException(422, "from_date must not be after to_date")
    if to_date == datetime.date.max.isoformat():
        raise HTTPException(422, "to_date must be before 9999-12-31")
    for value in (months, days):
        if value is not None and (type(value) is not int or not 1 <= value <= 1200):
            raise HTTPException(422, "Cleanup age must be an integer between 1 and 1200")

    shipment_query = db.query(Shipment).filter(
        or_(
            Shipment.id_proof_front.isnot(None),
            Shipment.id_proof_back.isnot(None),
            Shipment.receiver_id_proof_front.isnot(None),
            Shipment.receiver_id_proof_back.isnot(None)
        )
    )

    customer_query = db.query(Customer).filter(
        or_(
            Customer.id_proof_front.isnot(None),
            Customer.id_proof_back.isnot(None)
        )
    )

    if record_ids and isinstance(record_ids, list):
        shipment_query = shipment_query.filter(Shipment.id.in_(record_ids))
        customer_query = customer_query.filter(Customer.id.in_(record_ids))
    elif from_date or to_date:
        if from_date:
            shipment_query = shipment_query.filter(Shipment.date >= from_date)
            from_dt = datetime.datetime.fromisoformat(from_date)
            customer_query = customer_query.filter(Customer.created_at >= from_dt)
        if to_date:
            shipment_query = shipment_query.filter(Shipment.date <= to_date)
            to_dt = datetime.datetime.fromisoformat(to_date) + datetime.timedelta(days=1)
            customer_query = customer_query.filter(Customer.created_at < to_dt)
    else:
        today = datetime.date.today()
        if custom_cutoff:
            cutoff_date = custom_cutoff
        elif months:
            cutoff_date = (today - datetime.timedelta(days=int(months) * 30)).isoformat()
        elif days:
            cutoff_date = (today - datetime.timedelta(days=int(days))).isoformat()
        else:
            cutoff_date = (today - datetime.timedelta(days=90)).isoformat()

        shipment_query = shipment_query.filter(Shipment.date < cutoff_date)
        cutoff_dt = datetime.datetime.fromisoformat(cutoff_date) if len(cutoff_date) == 10 else datetime.datetime.utcnow()
        customer_query = customer_query.filter(Customer.created_at < cutoff_dt)

    shipments = shipment_query.all()
    customers = customer_query.all()

    shipment_count = len(shipments)
    for s in shipments:
        s.id_proof_front = None
        s.id_proof_back = None
        s.receiver_id_proof_front = None
        s.receiver_id_proof_back = None

    customer_count = len(customers)
    for c in customers:
        c.id_proof_front = None
        c.id_proof_back = None

    total_cleaned = shipment_count + customer_count
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="kyc.cleanup",
        resource_type="kyc_storage",
        resource_id="bulk_cleanup",
        action=f"cleaned_{total_cleaned}_kyc_images",
        before_data={"from_date": from_date, "to_date": to_date, "months": months, "record_ids_count": len(record_ids) if record_ids else 0},
        after_data={"cleaned_records": total_cleaned, "shipments": shipment_count, "customers": customer_count},
        ip_address=request.client.host if request.client else None
    )

    return {
        "success": True,
        "cleaned_count": total_cleaned,
        "shipment_count": shipment_count,
        "customer_count": customer_count
    }


@settings_router.delete("/kyc-storage/{record_id}")
def delete_single_kyc_document(
    record_id: str,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Purges KYC images for a single record."""
    from app.models import Shipment, Customer

    cleaned = False
    if record_id.endswith("_sender"):
        base_id = record_id[:-7]
        s = db.query(Shipment).filter(Shipment.id == base_id).first()
        if s:
            s.id_proof_front = None
            s.id_proof_back = None
            cleaned = True
    elif record_id.endswith("_receiver"):
        base_id = record_id[:-9]
        s = db.query(Shipment).filter(Shipment.id == base_id).first()
        if s:
            s.receiver_id_proof_front = None
            s.receiver_id_proof_back = None
            cleaned = True
    elif record_id.startswith("ship_"):
        s = db.query(Shipment).filter(Shipment.id == record_id).first()
        if s:
            s.id_proof_front = None
            s.id_proof_back = None
            s.receiver_id_proof_front = None
            s.receiver_id_proof_back = None
            cleaned = True
    elif record_id.startswith("cust_"):
        c = db.query(Customer).filter(Customer.id == record_id).first()
        if c:
            c.id_proof_front = None
            c.id_proof_back = None
            cleaned = True

    if not cleaned:
        # Check by ID in shipment first
        s = db.query(Shipment).filter(Shipment.id == record_id).first()
        if s:
            s.id_proof_front = None
            s.id_proof_back = None
            s.receiver_id_proof_front = None
            s.receiver_id_proof_back = None
            cleaned = True
        else:
            c = db.query(Customer).filter(Customer.id == record_id).first()
            if c:
                c.id_proof_front = None
                c.id_proof_back = None
                cleaned = True

    if not cleaned:
        raise HTTPException(status_code=404, detail="KYC record not found")

    create_audit_log(
        db=db, actor_user_id=ctx["user_id"], actor_name=ctx["display_name"],
        event_type="kyc.cleanup", resource_type="kyc_storage", resource_id=record_id,
        action="cleaned_kyc_images", ip_address=request.client.host if request.client else None
    )
    return {"success": True, "record_id": record_id}
