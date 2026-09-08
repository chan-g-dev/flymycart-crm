# ================================================================
# FLY MY CART CRM - BOOKING & CUSTOMER PORTAL TEST SUITE
# (backend/tests/test_booking_lifecycle.py)
# ================================================================

import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models import UserProfile, Customer, Shipment, Invoice, BookingRequest, WalletTransaction
from app.auth import create_app_session, hash_password
from app.finance_engine import calculate_volumetric_and_chargeable_weight

client = TestClient(app)


def test_volumetric_and_chargeable_weight_formulas():
    """Validates authoritative volumetric math: (L*W*H)/divisor and chargeable = max(actual, volumetric)."""
    # 50 x 40 x 30 cm box, actual 15 kg:
    # Volumetric = 60,000 / 5000 = 12.0 kg. Chargeable = max(15, 12) = 15.0 kg
    vol_wt, chg_wt = calculate_volumetric_and_chargeable_weight(50, 40, 30, 15.0, divisor=5000.0)
    assert vol_wt == 12.0
    assert chg_wt == 15.0

    # 60 x 50 x 40 cm light box, actual 5 kg:
    # Volumetric = 120,000 / 5000 = 24.0 kg. Chargeable = max(5, 24) = 24.0 kg
    vol_wt2, chg_wt2 = calculate_volumetric_and_chargeable_weight(60, 50, 40, 5.0, divisor=5000.0)
    assert vol_wt2 == 24.0
    assert chg_wt2 == 24.0

    # Cargo divisor 4000
    vol_wt3, chg_wt3 = calculate_volumetric_and_chargeable_weight(60, 50, 40, 5.0, divisor=4000.0)
    assert vol_wt3 == 30.0
    assert chg_wt3 == 30.0


def test_customer_booking_and_quote_conversion_flow():
    """Tests the complete end-to-end lifecycle:
    Customer registers -> Submits booking request -> Staff reviews & sends quote ->
    Customer accepts quote -> Staff converts to shipment with AWB & invoice.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    cust_email = f"customer_{unique_suffix}@example.com"
    cust_pass = "CustSecurePass@123"
    cust_phone = f"9876{unique_suffix[:6]}"

    # 1. Customer registration
    signup_res = client.post("/auth/customer-signup", json={
        "email": cust_email,
        "password": cust_pass,
        "name": f"Test Customer {unique_suffix}",
        "phone": cust_phone,
        "account_type": "C2C",
        "address": "123 Indiranagar, Bangalore"
    })
    assert signup_res.status_code == 201
    cust_data = signup_res.json()
    cust_token = cust_data["session_token"]
    cust_id = cust_data["profile"]["customer_id"]
    assert cust_id is not None
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # 2. Customer submits booking request
    book_payload = {
        "shipment_type": "International",
        "sender_name": f"Test Customer {unique_suffix}",
        "sender_phone": cust_phone,
        "sender_email": cust_email,
        "sender_address": "123 Indiranagar, Bangalore",
        "receiver_name": "John Doe London",
        "receiver_phone": "+447700900077",
        "receiver_email": "john.london@example.co.uk",
        "receiver_address": "10 Downing St, Westminster",
        "receiver_city": "London",
        "receiver_country": "United Kingdom",
        "receiver_zip": "SW1A 2AA",
        "parcel_description": "Documents & Indian Spices Gift Pack",
        "packages_count": 1,
        "actual_weight": 4.5,
        "length": 30.0,
        "width": 25.0,
        "height": 20.0,
        "preferred_service": "International Express",
        "pickup_date": "2026-09-10",
        "pickup_address": "123 Indiranagar, Bangalore"
    }
    create_res = client.post("/api/booking-requests", json=book_payload, headers=cust_headers)
    assert create_res.status_code == 201
    req_data = create_res.json()
    req_id = req_data["id"]
    assert req_data["status"] == "Submitted"
    assert req_data["volumetric_weight"] == 3.0  # (30*25*20)/5000 = 3.0
    assert req_data["chargeable_weight"] == 4.5  # max(4.5, 3.0)

    # 3. Customer lists own requests
    my_requests = client.get("/api/booking-requests/my", headers=cust_headers).json()
    assert any(r["id"] == req_id for r in my_requests)

    # 4. Super Admin logs in and lists requests
    admin_login = client.post("/auth/login", json={
        "email": "chanakyagangabathina77@gmail.com",
        "password": "Chanu@123"
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["session_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    all_reqs = client.get("/api/booking-requests", headers=admin_headers).json()
    assert any(r["id"] == req_id for r in all_reqs)

    # 5. Staff issues quote of ₹4,200
    quote_res = client.post(f"/api/booking-requests/{req_id}/quote", json={
        "quoted_amount": 4200.0,
        "quoted_courier": "DHL Express",
        "quoted_notes": "Estimated 3-4 business days delivery to London."
    }, headers=admin_headers)
    assert quote_res.status_code == 200
    assert quote_res.json()["status"] == "Quote Sent"
    assert quote_res.json()["quoted_amount"] == 4200.0

    # 6. Customer accepts the quote
    accept_res = client.post(f"/api/booking-requests/{req_id}/quote-response", json={
        "action": "accept"
    }, headers=cust_headers)
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "Accepted"

    # 7. Staff converts the accepted booking request into a finalized shipment with AWB
    test_awb = f"FMC{unique_suffix.upper()}99"
    convert_res = client.post(f"/api/booking-requests/{req_id}/convert-to-shipment", json={
        "awb": test_awb,
        "courier": "DHL Express",
        "service_type": "International Priority",
        "provider_name": "DHL Express",
        "provider_type": "postpaid",
        "price": 4200.0,
        "provider_cost": 2800.0,
        "payment_status": "Paid",
        "payment_method": "UPI",
        "paid_to": "Office QR",
        "collected_by": "Nawaz"
    }, headers=admin_headers)
    assert convert_res.status_code == 200
    conv_data = convert_res.json()
    assert conv_data["status"] == "success"
    assert conv_data["awb"] == test_awb

    # 8. Customer views own shipments - verify provider cost is STRICTLY MASKED
    cust_shipments_res = client.get("/api/customer/shipments", headers=cust_headers)
    assert cust_shipments_res.status_code == 200
    cust_shipments = cust_shipments_res.json()
    matching_shipment = next((s for s in cust_shipments if s["awb"] == test_awb), None)
    assert matching_shipment is not None
    assert matching_shipment["price"] == 4200.0
    assert "provider_cost" not in matching_shipment
    assert "actual_provider_cost" not in matching_shipment
    assert "gross_profit" not in matching_shipment
    assert "collected_by" not in matching_shipment

    # 9. Customer views dashboard - counts reflect active shipment
    dash_res = client.get("/api/customer/dashboard", headers=cust_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["active_shipments_count"] >= 1


def test_customer_idor_isolation():
    """Verifies that Customer B cannot access or accept quotes for Customer A's booking requests."""
    unique_a = uuid.uuid4().hex[:6]
    unique_b = uuid.uuid4().hex[:6]

    # Register Customer A
    signup_a = client.post("/auth/customer-signup", json={
        "email": f"cust_a_{unique_a}@example.com",
        "password": "PassA@123456",
        "name": "Customer A",
        "phone": f"9111{unique_a[:6]}"
    }).json()
    token_a = signup_a["session_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register Customer B
    signup_b = client.post("/auth/customer-signup", json={
        "email": f"cust_b_{unique_b}@example.com",
        "password": "PassB@123456",
        "name": "Customer B",
        "phone": f"9222{unique_b[:6]}"
    }).json()
    token_b = signup_b["session_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Customer A creates booking
    booking = client.post("/api/booking-requests", json={
        "shipment_type": "Domestic",
        "sender_name": "Customer A",
        "sender_phone": f"9111{unique_a[:6]}",
        "sender_address": "Mumbai",
        "receiver_name": "Receiver A",
        "receiver_phone": "9999999999",
        "receiver_address": "Delhi",
        "receiver_city": "Delhi",
        "receiver_country": "India",
        "packages_count": 1,
        "actual_weight": 2.0,
        "length": 20.0,
        "width": 15.0,
        "height": 10.0
    }, headers=headers_a).json()
    booking_id = booking["id"]

    # Customer B attempts to view Customer A's booking: MUST FAIL with 403
    forbidden_view = client.get(f"/api/booking-requests/{booking_id}", headers=headers_b)
    assert forbidden_view.status_code == 403

    # Customer B attempts to accept/reject Customer A's quote: MUST FAIL with 403
    forbidden_respond = client.post(f"/api/booking-requests/{booking_id}/quote-response", json={
        "action": "accept"
    }, headers=headers_b)
    assert forbidden_respond.status_code == 403
