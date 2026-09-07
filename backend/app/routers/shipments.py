# ================================================================
# FLY MY CART CRM - SHIPMENTS ROUTER (routers/shipments.py)
# ================================================================

import uuid
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import (
    Customer, Shipment, Invoice, WalletTransaction,
    Refund, AuditLog
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

@shipments_router.get("/", response_model=List[ShipmentOut])
def get_shipments(
    search: Optional[str] = None,
    status: Optional[str] = None,
    courier: Optional[str] = None,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.SHIPMENTS_VIEW)),
    db: Session = Depends(get_db)
):
    is_default = not search and not status and not courier
    can_view_margins = "viewCostMargins" in ctx.get("permissions", {})
    cache_key = f"shipments:default:{can_view_margins}"

    if is_default:
        cached_res = cache_engine.get(cache_key)
        if cached_res:
            return cached_res

    query = db.query(Shipment)
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
                Shipment.sender_phone.like(s)
            )
        )
    shipments = query.order_by(desc(Shipment.created_at)).all()

    out = [ShipmentOut.model_validate(s) for s in shipments]
    if not can_view_margins:
        for s_out in out:
            s_out.provider_cost = None
            s_out.actual_provider_cost = None
            s_out.gross_profit = None

    if is_default:
        cache_engine.set(cache_key, out, ttl=20)

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
    if db.query(Shipment).filter(func.lower(Shipment.awb) == awb_clean.lower()).first():
        raise HTTPException(status_code=400, detail=f"AWB tracking number '{awb_clean}' already exists!")

    # 2. Auto-find or create customer (Single Entry)
    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer and payload.sender and payload.sender.phone:
        customer = db.query(Customer).filter(Customer.mobile == payload.sender.phone.strip()).first()
    if not customer:
        customer = db.query(Customer).filter(func.lower(Customer.name) == payload.customer_name.strip().lower()).first()

    if not customer:
        cust_id = f"cust_{uuid.uuid4().hex[:8]}"
        customer = Customer(
            id=cust_id,
            name=payload.customer_name.strip(),
            company=payload.customer_name.strip() if payload.customer_type == "B2B" else None,
            mobile=payload.sender.phone.strip() if payload.sender and payload.sender.phone else "9800000000",
            whatsapp=payload.sender.phone.strip() if payload.sender and payload.sender.phone else "9800000000",
            customer_type=payload.customer_type,
            center=payload.center,
            assigned_employee=payload.employee,
            address=payload.sender.address.strip() if payload.sender and payload.sender.address else ""
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    # 3. Authoritative Volumetric & Chargeable weight calculation
    vol_wt, chargeable_wt = calculate_volumetric_and_chargeable_weight(
        payload.parcel.length,
        payload.parcel.width,
        payload.parcel.height,
        payload.parcel.actual_weight
    )

    # 4. Authoritative Gross Profit calculation
    cost_reconciled = (payload.provider_type == "prepaid")
    gross_profit = calculate_gross_profit(
        selling_price=payload.price,
        provider_cost=payload.provider_cost,
        actual_provider_cost=payload.provider_cost,
        cost_reconciled=cost_reconciled
    )

    ship_id = f"ship_{uuid.uuid4().hex[:8]}"

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
            id=f"tx_{uuid.uuid4().hex[:8]}",
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
    inv_no = f"FMC-{datetime.date.today().strftime('%Y%m')}-{uuid.uuid4().hex[:3].upper()}"
    paid_amt = payload.price if payload.payment_status == "Paid" else (round(payload.price * 0.5) if payload.payment_status == "Partial" else 0.0)
    bal_amt = payload.price - paid_amt

    new_invoice = Invoice(
        id=f"inv_{uuid.uuid4().hex[:8]}",
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
        gst=0.0,
        total=payload.price,
        paid=paid_amt,
        balance=bal_amt,
        status="Paid" if bal_amt == 0 else ("Partial" if paid_amt > 0 else "Due")
    )
    db.add(new_invoice)

    db.commit()
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

    s_out = ShipmentOut.model_validate(new_shipment)
    if not "viewCostMargins" in ctx.get("permissions", {}):
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
    db.query(Invoice).filter(or_(Invoice.shipment_id == shipment.id, Invoice.awb == awb)).delete(synchronize_session=False)
    db.query(Refund).filter(or_(Refund.shipment_id == shipment.id, Refund.awb == awb)).delete(synchronize_session=False)
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
