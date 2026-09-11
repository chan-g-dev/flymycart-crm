"""Customer booking requests, staff quotes and single-entry conversion."""
import datetime
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_session_context, require_permission
from app.models import BookingRequest, BookingParcel, Customer, Shipment
from app.schemas import (BookingRequestCreate, BookingRequestOut, BookingQuoteCreate,
    BookingQuoteResponse, BookingConvertToShipmentRequest, ShipmentCreate, CustomerPortalShipmentOut)
from app.finance_engine import calculate_volumetric_and_chargeable_weight
from app.routers.shipments import create_shipment

bookings_router = APIRouter(prefix="/api", tags=["Customer Bookings"])


def customer_context(ctx=Depends(get_current_session_context)):
    if ctx.get("role_id") != "customer" or not ctx.get("customer_id") or ctx.get("status") not in {"active", "approved"}:
        raise HTTPException(status_code=403, detail="An active customer account is required")
    return ctx


def own_booking(db, booking_id, ctx):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.customer_id != ctx["customer_id"]:
        raise HTTPException(status_code=403, detail="This booking belongs to another customer")
    return booking


@bookings_router.post("/booking-requests", response_model=BookingRequestOut, status_code=201)
def submit_booking(payload: BookingRequestCreate, ctx=Depends(customer_context), db: Session = Depends(get_db)):
    customer = db.get(Customer, ctx["customer_id"])
    values = payload.model_dump(exclude={"parcels"})
    divisor = 4000 if any(t in (payload.preferred_service or "").lower() for t in ("cargo",)) else 5000
    vol, chargeable = calculate_volumetric_and_chargeable_weight(payload.length, payload.width, payload.height, payload.actual_weight, divisor)
    booking = BookingRequest(**values, request_no=f"REQ-{uuid.uuid4().hex[:12].upper()}",
        customer_id=customer.id, customer_name=customer.name, customer_phone=customer.mobile,
        customer_email=customer.email, customer_type=customer.customer_type,
        b2b_company_id=customer.b2b_company_id, volumetric_weight=vol, chargeable_weight=chargeable, status="Submitted")
    for parcel in payload.parcels or []:
        data = parcel.model_dump()
        data["volumetric_weight"], data["chargeable_weight"] = calculate_volumetric_and_chargeable_weight(
            parcel.length, parcel.width, parcel.height, parcel.actual_weight, divisor)
        booking.parcels.append(BookingParcel(**data))
    if booking.parcels:
        booking.packages_count = len(booking.parcels)
        booking.actual_weight = sum(p.actual_weight for p in booking.parcels)
        booking.volumetric_weight = sum(p.volumetric_weight for p in booking.parcels)
        booking.chargeable_weight = max(booking.actual_weight, booking.volumetric_weight)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@bookings_router.get("/booking-requests/my", response_model=List[BookingRequestOut])
def my_bookings(ctx=Depends(customer_context), db: Session = Depends(get_db)):
    return db.query(BookingRequest).filter(BookingRequest.customer_id == ctx["customer_id"]).all()


@bookings_router.get("/booking-requests", response_model=List[BookingRequestOut])
def all_bookings(ctx=Depends(require_permission("shipments.view")), db: Session = Depends(get_db)):
    return db.query(BookingRequest).order_by(BookingRequest.created_at.desc()).all()


@bookings_router.get("/booking-requests/{booking_id}", response_model=BookingRequestOut)
def get_booking(booking_id: str, ctx=Depends(customer_context), db: Session = Depends(get_db)):
    return own_booking(db, booking_id, ctx)


@bookings_router.post("/booking-requests/{booking_id}/quote", response_model=BookingRequestOut)
def quote_booking(booking_id: str, payload: BookingQuoteCreate, ctx=Depends(require_permission("shipments.edit")), db: Session = Depends(get_db)):
    booking = db.get(BookingRequest, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in {"Submitted", "Under Review", "Quote Sent", "Rejected"}:
        raise HTTPException(status_code=400, detail="Booking cannot be quoted in its current state")
    for key, value in payload.model_dump().items():
        setattr(booking, key, value)
    booking.quoted_by = ctx["display_name"]
    booking.quoted_at = datetime.datetime.utcnow()
    booking.status = "Quote Sent"
    db.commit()
    return booking


@bookings_router.post("/booking-requests/{booking_id}/quote-response", response_model=BookingRequestOut)
def respond_to_quote(booking_id: str, payload: BookingQuoteResponse, ctx=Depends(customer_context), db: Session = Depends(get_db)):
    booking = own_booking(db, booking_id, ctx)
    if booking.status != "Quote Sent" or payload.action not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="A pending quote and accept or reject action are required")
    booking.status = "Accepted" if payload.action == "accept" else "Rejected"
    booking.quote_accepted_at = datetime.datetime.utcnow() if payload.action == "accept" else None
    booking.quote_rejected_reason = payload.rejection_reason
    db.commit()
    return booking


@bookings_router.post("/booking-requests/{booking_id}/convert-to-shipment")
def convert_booking(booking_id: str, payload: BookingConvertToShipmentRequest, request: Request,
                    ctx=Depends(require_permission("shipments.add")), db: Session = Depends(get_db)):
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "Accepted" or booking.converted_shipment_id:
        raise HTTPException(status_code=400, detail="Only an accepted, unconverted booking can be converted")
    if payload.price != booking.quoted_amount:
        raise HTTPException(status_code=400, detail="Selling price must match the accepted quote")
    shipment_payload = ShipmentCreate(**payload.model_dump(), date=datetime.date.today().isoformat(),
        customer_id=booking.customer_id, customer_name=booking.customer_name, customer_type=booking.customer_type,
        b2b_company_id=booking.b2b_company_id, pickup_date=booking.pickup_date,
        domestic_international=booking.shipment_type, status="Booked",
        sender={"name": booking.sender_name, "phone": booking.sender_phone, "address": booking.sender_address, "email": booking.sender_email},
        receiver={"name": booking.receiver_name, "phone": booking.receiver_phone, "address": booking.receiver_address,
            "city": booking.receiver_city, "country": booking.receiver_country, "zip": booking.receiver_zip, "email": booking.receiver_email, "state": booking.receiver_state},
        parcel={"description": booking.parcel_description, "packages_count": booking.packages_count,
            "actual_weight": booking.actual_weight, "length": booking.length, "width": booking.width, "height": booking.height,
            "boxes": [{"length": p.length, "width": p.width, "height": p.height, "actual_weight": p.actual_weight} for p in booking.parcels]})
    # Mark conversion in the same transaction committed by the shared booking engine.
    booking.status = "Converted to Shipment"
    booking.converted_awb = payload.awb.strip()
    booking.converted_by = ctx["display_name"]
    booking.converted_at = datetime.datetime.utcnow()
    shipment = create_shipment(shipment_payload, request, ctx, db)
    booking.converted_shipment_id = shipment.id
    db.get(Shipment, shipment.id).booking_request_id = booking.id
    db.commit()
    return {"status": "success", "awb": shipment.awb, "shipment_id": shipment.id}


@bookings_router.get("/customer/shipments", response_model=List[CustomerPortalShipmentOut])
def customer_shipments(ctx=Depends(customer_context), db: Session = Depends(get_db)):
    return db.query(Shipment).filter(Shipment.customer_id == ctx["customer_id"]).all()


@bookings_router.get("/customer/dashboard")
def customer_dashboard(ctx=Depends(customer_context), db: Session = Depends(get_db)):
    shipments = db.query(Shipment).filter(Shipment.customer_id == ctx["customer_id"]).all()
    return {"shipments_count": len(shipments), "active_shipments_count": sum(s.status not in {"Delivered", "Cancelled"} for s in shipments)}
