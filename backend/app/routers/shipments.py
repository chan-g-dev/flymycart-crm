# ================================================================
# FLY MY CART CRM - SHIPMENTS ROUTER (routers/shipments.py)
# ================================================================

from decimal import Decimal, ROUND_HALF_UP
import uuid
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import (
    Customer, Shipment, Invoice, WalletTransaction,
    Refund, AuditLog, SystemSettings
)
from app.schemas import ShipmentCreate, ShipmentOut
from app.finance_engine import (
    calculate_volumetric_and_chargeable_weight,
    calculate_gross_profit
)
from app.auth import create_audit_log, mask_shipment_financials
from app.dependencies import require_permission
from app.permissions import PermissionCode
from app.cache import cache_engine

shipments_router = APIRouter(prefix="/api/shipments", tags=["Shipments"])

def validate_shipment_status(status, delay_reason):
    if status not in {"Booked", "Picked Up", "In Transit", "Delivered", "Delayed", "Cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid shipment status")
    if status == "Delayed" and not (delay_reason or "").strip():
        raise HTTPException(status_code=400, detail="A delay reason is required")

@shipments_router.get("/", response_model=List[ShipmentOut])
def get_shipments(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    center: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    courier: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.SHIPMENTS_VIEW)),
    db: Session = Depends(get_db)
):
    can_view_margins = bool(
        ctx.get("is_super_admin")
        or "*" in ctx.get("permissions", {})
        or ctx.get("permissions", {}).get("viewCostMargins")
        or ctx.get("permissions", {}).get("reports.view_financial")
    )
    query = db.query(Shipment)
    if center and center != "All Centers":
        query = query.filter(Shipment.center == center)
    if status:
        query = query.filter(Shipment.status == status)
    if courier:
        query = query.filter(Shipment.courier == courier)
    if search:
        s = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Shipment.awb).like(s),
                func.lower(Shipment.customer_name).like(s),
                func.lower(Shipment.receiver_name).like(s),
                Shipment.receiver_phone.like(s),
                Shipment.sender_phone.like(s),
                Shipment.id.in_(db.query(Invoice.shipment_id).filter(func.lower(Invoice.invoice_no).like(s)))
            )
        )
    query = query.order_by(desc(Shipment.created_at), Shipment.id)
    response.headers["X-Total-Count"] = str(query.count())
    query = query.limit(limit).offset(offset)
    shipments = query.all()

    out = [ShipmentOut.model_validate(s) for s in shipments]
    if not can_view_margins:
        for s_out in out:
            s_out.provider_cost = None
            s_out.actual_provider_cost = None
            s_out.gross_profit = None


    return out

@shipments_router.post("/", response_model=ShipmentOut)
def create_shipment(
    payload: ShipmentCreate,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.SHIPMENTS_ADD)),
    db: Session = Depends(get_db)
):
    # 1. Check duplicate AWB
    awb_clean = payload.awb.strip()
    if not awb_clean:
        raise HTTPException(status_code=400, detail="AWB is required")
    validate_shipment_status(payload.status, payload.delay_reason)
    # Direct postpaid bookings must use the selected courier's configured account.
    def courier_key(name):
        if not name:
            return ""
        key = ''.join(ch for ch in str(name).lower() if ch.isalnum())
        return {'dhlexpress': 'dhl'}.get(key, key)

    def get_account_name(acc):
        if isinstance(acc, dict):
            return acc.get('name', '')
        return str(acc) if acc else ''

    config = db.query(SystemSettings).first()
    settings = config.config_json if config else {}
    if payload.provider_type not in {'prepaid', 'postpaid'}:
        raise HTTPException(status_code=400, detail="Select prepaid or postpaid billing")

    default_postpaid_couriers = {"fedex", "aramex", "dhl", "dhlexpress", "bluedart", "delhivery", "ups", "sreemaruthi", "trackon", "dtdc", "speedpost", "icl", "brv"}
    default_prepaid_wallets = {"icl", "brv"}

    accounts = settings.get('prepaidWallets' if payload.provider_type == 'prepaid' else 'postpaidProviders', [])
    configured_account_keys = {courier_key(get_account_name(account)) for account in accounts if get_account_name(account)}
    fallback_keys = default_prepaid_wallets if payload.provider_type == 'prepaid' else default_postpaid_couriers

    provider_k = courier_key(payload.provider_name)
    courier_k = courier_key(payload.courier)

    # Valid if in configured accounts, in standard fallback lists, or matches the shipment courier
    is_valid_account = (
        provider_k in configured_account_keys
        or provider_k in fallback_keys
        or (payload.provider_type == 'postpaid' and (provider_k == courier_k or not accounts))
    )
    if not is_valid_account:
        raise HTTPException(status_code=400, detail="Select a configured billing account")

    if payload.provider_type == 'postpaid' and provider_k != courier_k and configured_account_keys:
        # If specific accounts are configured and user picked an account of another courier
        if provider_k in configured_account_keys and courier_k in configured_account_keys:
            raise HTTPException(status_code=400, detail=f"Direct postpaid billing for {payload.courier} must match its account ({payload.courier}) or use a prepaid wallet.")

    is_gst = bool(getattr(payload, 'is_gst_applicable', True))
    raw_rate = float(getattr(payload, 'gst_rate', 18.0) if getattr(payload, 'gst_rate', 18.0) is not None else 18.0) if is_gst else 0.0
    gst_rate_dec = Decimal(str(raw_rate))

    base_amount = Decimal(str(payload.price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if is_gst and raw_rate > 0:
        gst_amount = (base_amount * (gst_rate_dec / Decimal('100'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        cgst_amt = (gst_amount / Decimal('2')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        sgst_amt = gst_amount - cgst_amt
        igst_amt = Decimal('0.00')
    else:
        gst_amount = Decimal('0.00')
        cgst_amt = Decimal('0.00')
        sgst_amt = Decimal('0.00')
        igst_amt = Decimal('0.00')

    invoice_total = float(base_amount + gst_amount)
    payload.price = float(base_amount)
    paid_amt = invoice_total if payload.payment_status == "Paid" else (payload.amount_received or 0.0)
    if payload.payment_status == "Partial" and not 0 < paid_amt < invoice_total:
        raise HTTPException(status_code=400, detail="Partial payment must specify an amount between zero and the invoice total")
    if payload.payment_status not in ["Paid", "Partial"] and paid_amt:
        raise HTTPException(status_code=400, detail="Amount received requires Paid or Partial payment status")
    if db.query(Shipment).filter(func.lower(Shipment.awb) == awb_clean.lower()).first():
        raise HTTPException(status_code=400, detail=f"AWB tracking number '{awb_clean}' already exists!")

    # 2. Auto-find or create customer (Single Entry)
    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    customer_mobile = payload.customer_mobile or (payload.sender.phone if payload.sender else "") or ""
    if not customer and customer_mobile:
        customer = db.query(Customer).filter(Customer.mobile == customer_mobile.strip()).first()
    if payload.customer_id and not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if not customer:
        if not customer_mobile.strip():
            raise HTTPException(status_code=400, detail="A mobile number is required for a new customer")
        cust_id = f"cust_{uuid.uuid4().hex[:16]}"
        customer = Customer(
            id=cust_id,
            name=payload.customer_name.strip(),
            company=payload.customer_name.strip() if payload.customer_type == "B2B" else None,
            mobile=customer_mobile.strip(),
            whatsapp=customer_mobile.strip(),
            email=payload.sender.email.strip() if payload.sender and payload.sender.email else None,
            id_proof=payload.sender.id_proof.strip() if payload.sender and payload.sender.id_proof else None,
            b2b_company_id=payload.b2b_company_id,
            customer_type=payload.customer_type,
            center=payload.center,
            assigned_employee=payload.employee,
            address=payload.sender.address.strip() if payload.sender and payload.sender.address else ""
        )
        db.add(customer)
        db.flush()

    # 3. Authoritative Volumetric & Chargeable weight calculation
    vol_wt, chargeable_wt = calculate_volumetric_and_chargeable_weight(
        payload.parcel.length,
        payload.parcel.width,
        payload.parcel.height,
        payload.parcel.actual_weight,
        divisor=4000.0 if any(term in f"{payload.service_type} {payload.courier}".lower() for term in ("cargo",)) else 5000.0
    )

    # 4. Authoritative Gross Profit calculation
    if payload.parcel.boxes:
        divisor = 4000.0 if any(term in f"{payload.service_type} {payload.courier}".lower() for term in ("cargo",)) else 5000.0
        vol_wt = round(sum(box.length * box.width * box.height / divisor for box in payload.parcel.boxes), 2)
        payload.parcel.actual_weight = round(sum(box.actual_weight for box in payload.parcel.boxes), 2)
        payload.parcel.packages_count = len(payload.parcel.boxes)
        chargeable_wt = max(vol_wt, payload.parcel.actual_weight)
    cost_reconciled = (payload.provider_type == "prepaid")
    gross_profit = calculate_gross_profit(
        selling_price=payload.price,
        provider_cost=payload.provider_cost,
        actual_provider_cost=payload.provider_cost,
        cost_reconciled=cost_reconciled
    )

    ship_id = f"ship_{uuid.uuid4().hex[:16]}"

    new_shipment = Shipment(
        id=ship_id,
        awb=awb_clean,
        date=payload.date,
        pickup_date=payload.pickup_date or payload.date,
        delivery_date=payload.delivery_date,
        customer_id=customer.id,
        customer_name=customer.name,
        customer_type=payload.customer_type,
        b2b_company_id=payload.b2b_company_id,
        center=payload.center,
        employee=payload.employee,

        sender_name=payload.sender.name if payload.sender else customer.name,
        sender_email=payload.sender.email if payload.sender else customer.email,
        sender_id_proof=payload.sender.id_proof if payload.sender else customer.id_proof,
        receiver_email=payload.receiver.email,
        receiver_state=payload.receiver.state,
        boxes=[box.model_dump() for box in payload.parcel.boxes],
        sender_phone=payload.sender.phone if payload.sender else customer.mobile,
        sender_address=payload.sender.address if payload.sender else customer.address,

        receiver_name=payload.receiver.name.strip(),
        receiver_phone=payload.receiver.phone.strip() if payload.receiver.phone else None,
        receiver_address=payload.receiver.address.strip() if payload.receiver.address else None,
        receiver_city=payload.receiver.city.strip(),
        receiver_country=payload.receiver.country.strip(),
        receiver_zip=payload.receiver.zip.strip() if payload.receiver.zip else None,

        description=payload.parcel.description,
        packages_count=payload.parcel.packages_count,
        actual_weight=payload.parcel.actual_weight,
        length=payload.parcel.length,
        width=payload.parcel.width,
        height=payload.parcel.height,
        volumetric_weight=vol_wt,
        chargeable_weight=chargeable_wt,

        courier=payload.courier,
        domestic_international=payload.domestic_international,
        service_type=payload.service_type,
        provider_type=payload.provider_type,
        provider_name=payload.provider_name,
        price=payload.price,
        is_gst_applicable=is_gst,
        gst_rate=raw_rate,
        gst_amount=float(gst_amount),
        total_amount=invoice_total,
        provider_cost=payload.provider_cost,
        actual_provider_cost=payload.provider_cost,
        cost_reconciled=cost_reconciled,
        gross_profit=gross_profit,

        # Dual employee audit logging
        payment_status=payload.payment_status,
        payment_method=payload.payment_method,
        paid_to=payload.paid_to,
        collected_by=payload.collected_by,
        status=payload.status or "Booked",
        delay_reason=payload.delay_reason
    )
    db.add(new_shipment)

    # 5. Prepaid Partner Wallet Ledger Deduction
    if payload.provider_type == "prepaid":
        wallet_tx = WalletTransaction(
            id=f"tx_{uuid.uuid4().hex[:16]}",
            date=payload.date,
            wallet=payload.provider_name,
            type="usage",
            amount=payload.provider_cost,
            paid_from="-",
            reference=f"Shipment booking {awb_clean}",
            awb=awb_clean,
            notes=f"AWB {awb_clean} ({payload.courier}) provider cost deduction",
            balance_after=0.0
        )
        db.add(wallet_tx)

    # 6. Auto-generate Official Invoice
    inv_no = f"FMC-{datetime.date.today().strftime('%Y%m')}-{uuid.uuid4().hex[:12].upper()}"
    bal_amt = round(invoice_total - paid_amt, 2)

    new_invoice = Invoice(
        id=f"inv_{uuid.uuid4().hex[:16]}",
        invoice_no=inv_no,
        date=payload.date,
        customer_id=customer.id,
        customer_name=customer.name,
        b2b_company_id=payload.b2b_company_id,
        shipment_id=ship_id,
        awb=awb_clean,
        courier=payload.courier,
        service=payload.service_type,
        description=f"Logistics Courier Service - {payload.courier} ({chargeable_wt} kg)",
        amount=payload.price,
        is_gst_invoice=is_gst,
        tax_rate=raw_rate,
        cgst=float(cgst_amt),
        sgst=float(sgst_amt),
        igst=float(igst_amt),
        gst=float(gst_amount),
        total=invoice_total,
        paid=paid_amt,
        balance=bal_amt,
        status="Paid" if bal_amt == 0 else ("Partial" if paid_amt > 0 else "Due")
    )
    db.add(new_invoice)
    db.flush()
    if paid_amt:
        from app.models import PaymentCollection
        db.add(PaymentCollection(invoice_id=new_invoice.id, shipment_id=ship_id,
            date=payload.date, amount=paid_amt, payment_method=payload.payment_method,
            paid_to=payload.paid_to, collected_by=payload.collected_by, reference=payload.payment_reference))

    if payload.provider_type == "prepaid":
        from app.wallets import rebuild_wallet_balances
        rebuild_wallet_balances(db, payload.provider_name)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"AWB tracking number '{awb_clean}' already exists!") from exc
    db.refresh(new_shipment)

    cache_engine.invalidate_prefix("dashboard_summary")
    cache_engine.invalidate_prefix("shipments:")
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="shipments.create",
        resource_type="shipment",
        resource_id=ship_id,
        action="create",
        after_data={"awb": awb_clean, "customer": customer.name, "price": payload.price, "provider_cost": payload.provider_cost},
        ip_address=request.client.host if request.client else None
    )

    can_view_margins = bool(
        ctx.get("is_super_admin")
        or "*" in ctx.get("permissions", {})
        or ctx.get("permissions", {}).get("viewCostMargins")
        or ctx.get("permissions", {}).get("reports.view_financial")
    )
    s_out = ShipmentOut.model_validate(new_shipment)
    if not can_view_margins:
        s_out.provider_cost = None
        s_out.actual_provider_cost = None
        s_out.gross_profit = None
    return s_out

@shipments_router.patch("/{shipment_id}/status")
def update_shipment_status(
    shipment_id: str,
    payload: Dict[str, Any],
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.SHIPMENTS_EDIT)),
    db: Session = Depends(get_db)
):
    ship = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not ship:
        raise HTTPException(status_code=404, detail="Shipment not found")

    before_status = ship.status
    validate_shipment_status(payload.get("status", ship.status), payload.get("delay_reason", ship.delay_reason))
    if "status" in payload:
        ship.status = payload["status"]
        if payload["status"] == "Delivered" and not ship.delivery_date:
            ship.delivery_date = datetime.date.today().isoformat()
    if "delay_reason" in payload:
        ship.delay_reason = payload["delay_reason"]
    if "pickup_date" in payload:
        ship.pickup_date = payload["pickup_date"]
    if "delivery_date" in payload:
        ship.delivery_date = payload["delivery_date"]

    db.commit()
    cache_engine.invalidate_prefix("dashboard_summary")
    cache_engine.invalidate_prefix("shipments:")
    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="shipments.update",
        resource_type="shipment",
        resource_id=shipment_id,
        action="status_update",
        before_data={"status": before_status},
        after_data={"status": ship.status},
        ip_address=request.client.host if request.client else None
    )
    return {"message": "Status updated successfully", "status": ship.status}

@shipments_router.delete("/{shipment_id}")
def delete_shipment(
    shipment_id: str,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.SHIPMENTS_DELETE)),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    awb = shipment.awb
    from app.models import PaymentCollection
    db.query(PaymentCollection).filter(PaymentCollection.shipment_id == shipment.id).delete(synchronize_session=False)
    db.query(Invoice).filter(or_(Invoice.shipment_id == shipment.id, Invoice.awb == awb)).delete(synchronize_session=False)
    db.query(Refund).filter(Refund.awb == awb).delete(synchronize_session=False)
    db.query(WalletTransaction).filter(WalletTransaction.awb == awb).delete(synchronize_session=False)

    db.delete(shipment)
    db.commit()
    cache_engine.invalidate_prefix("dashboard_summary")
    cache_engine.invalidate_prefix("shipments:")

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="shipments.delete",
        resource_type="shipment",
        resource_id=shipment_id,
        action="delete",
        before_data={"awb": awb},
        ip_address=request.client.host if request.client else None
    )
    return {"message": "Shipment deleted successfully"}
