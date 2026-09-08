import datetime
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import UserProfile, Invoice, Shipment, PaymentCollection, Refund, ReconciliationBatch
from app.auth import create_app_session
from app.auth import hash_password, verify_password
from app.cache import cache_engine
from app.finance_engine import calculate_b2b_aging_buckets


@pytest.fixture
def admin_client():
    with SessionLocal() as db:
        admin = db.query(UserProfile).filter(UserProfile.role == "super_admin").first()
        _, token = create_app_session(db, admin.id, mfa_verified=True)
    cache_engine.invalidate_prefix("dashboard_summary")
    cache_engine.invalidate_prefix("shipments:")
    with TestClient(app) as client:
        client.headers["Authorization"] = f"Bearer {token}"
        yield client


def shipment_payload(**changes):
    value = {
        "awb": "AUDIT" + uuid.uuid4().hex[:12], "date": "2026-01-01",
        "customer_name": "Same Customer Name", "customer_type": "B2B",
        "sender": {"phone": uuid.uuid4().hex[:12], "address": "Bangalore"},
        "receiver": {"name": "Receiver", "city": "Delhi", "country": "India"},
        "parcel": {"length": 50, "width": 40, "height": 30, "actual_weight": 2},
        "courier": "LTL Cargo", "service_type": "Cargo", "provider_name": "BRV",
        "provider_type": "prepaid", "price": 1000, "provider_cost": 600,
        "payment_status": "Partial", "amount_received": 120,
        "payment_method": "Cash", "paid_to": "Cash Drawer", "collected_by": "Staff A", "status": "Booked"
    }
    value.update(changes)
    return value


def test_unauthenticated_and_forged_headers_cannot_access_crm():
    with TestClient(app) as client:
        for headers in ({}, {"X-User-Role": "super_admin"}, {"X-User-Email": "chanakyagangabathina77@gmail.com"}, {"Authorization": "Bearer invalid"}):
            assert client.get("/api/shipments/", headers=headers).status_code == 401


def test_password_verification_has_no_universal_fallback():
    password_hash = hash_password("Unique customer password!")
    assert verify_password("Unique customer password!", password_hash)
    assert not verify_password("Chanu@1234", password_hash)
    assert not verify_password("Admin@FlyMyCart2026", password_hash)


def test_first_login_registers_and_returning_login_requires_same_password():
    with TestClient(app) as client:
        email = f"audit_{uuid.uuid4().hex}@example.com"
        password = "Pass!12345"

        first = client.post("/auth/login", json={
            "full_name": "First Login User",
            "email": email,
            "password": password,
        })
        assert first.status_code == 200
        assert first.json()["user"]["status"] == "approved"
        assert client.get("/api/shipments/").status_code == 200

        # Operations staff are explicitly allowed to book shipments and view
        # weekly operational trends without receiving financial margin data.
        booking = client.post("/api/shipments/", json=shipment_payload())
        assert booking.status_code == 200, booking.text
        weekly = client.get("/api/reports/weekly", params={"end_date": "2026-01-01"})
        assert weekly.status_code == 200, weekly.text
        assert weekly.json()["shipments_count"] >= 1
        assert weekly.json()["financials_visible"] is False
        assert all(day["gross_profit"] is None for day in weekly.json()["daily"])

        assert client.post("/auth/login", json={
            "email": email,
            "password": "WrongPassword!",
        }).status_code == 401
        returning = client.post("/auth/login", json={"email": email, "password": password})
        assert returning.status_code == 200
        assert returning.json()["user"]["email"] == email


def test_booking_collections_reports_and_customer_identity(admin_client):
    payload = shipment_payload()
    result = admin_client.post("/api/shipments/", json=payload)
    assert result.status_code == 200, result.text
    ship = result.json()
    assert ship["volumetric_weight"] == 15
    assert ship["chargeable_weight"] == 15
    invoices = admin_client.get("/api/invoices/", params={"search": payload["awb"]}).json()
    inv = invoices[0]
    assert (inv["paid"], inv["balance"]) == (120, 880)
    eod_before = admin_client.get("/api/reports/eod").json()
    pay = {"amount": 80, "payment_method": "Bank Transfer", "paid_to": "Current Account", "collected_by": "Staff B"}
    assert admin_client.post(f'/api/invoices/{inv["id"]}/payments', json=pay).status_code == 200
    eod_after = admin_client.get("/api/reports/eod").json()
    assert eod_after["total_collected"] - eod_before["total_collected"] == 80
    assert eod_after["collections_by_employee"]["Staff B"] >= 80
    assert eod_after["net_profit"] is not None  # Super Admin wildcard financial clearance
    assert admin_client.post(f'/api/invoices/{inv["id"]}/payments', json={**pay, "amount": 801}).status_code == 400
    customer = admin_client.get(f'/api/customers/{ship["customer_id"]}/360').json()
    assert customer["outstanding_balance"] == 800
    second = admin_client.post("/api/shipments/", json=shipment_payload()).json()
    assert second["customer_id"] != ship["customer_id"]
    assert len(admin_client.get(f'/api/customers/{ship["customer_id"]}/360').json()["shipments"]) == 1
    assert admin_client.get("/api/shipments/", params={"search": inv["invoice_no"]}).json()[0]["id"] == ship["id"]


def test_delay_partial_and_multiple_boxes(admin_client):
    assert admin_client.post("/api/shipments/", json=shipment_payload(status="Delayed")).status_code == 400
    assert admin_client.post("/api/shipments/", json=shipment_payload(amount_received=None)).status_code == 400
    result = admin_client.post("/api/shipments/", json=shipment_payload(parcel={"boxes": [
        {"length": 50, "width": 40, "height": 30, "actual_weight": 2},
        {"length": 20, "width": 20, "height": 20, "actual_weight": 5}]}))
    assert result.status_code == 200, result.text
    ship = result.json()
    assert (ship["packages_count"], ship["actual_weight"], ship["chargeable_weight"]) == (2, 7, 17)
    assert admin_client.patch(f'/api/shipments/{ship["id"]}/status', json={"status": "Delayed"}).status_code == 400
    assert admin_client.patch(f'/api/shipments/{ship["id"]}/status', json={"status": "Delayed", "delay_reason": "Weather"}).status_code == 200
    assert admin_client.delete(f'/api/shipments/{ship["id"]}').status_code == 200


def test_reconciliation_validates_provider_and_computes_totals(admin_client):
    ship = admin_client.post("/api/shipments/", json=shipment_payload(provider_type="postpaid", provider_name="Aramex")).json()
    payload = {"provider": "Wrong Carrier", "matched": [{"awb": ship["awb"], "actual_cost": 750}], "total_actual": 1, "variance": 999}
    assert admin_client.post("/api/reconciliation/apply", json=payload).status_code == 400
    payload["provider"] = "Aramex"
    assert admin_client.post("/api/reconciliation/apply", json={**payload, "matched": payload["matched"] * 2}).status_code == 400
    result = admin_client.post("/api/reconciliation/apply", json=payload)
    assert result.status_code == 200, result.text
    with SessionLocal() as db:
        batch = db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_no == result.json()["batch_no"]).one()
        assert (batch.predicted_total, batch.actual_bill, batch.variance) == (600, 750, 150)
        assert db.get(Shipment, ship["id"]).gross_profit == 250


def test_refund_cannot_skip_approval_or_reverse_payout(admin_client):
    ship = admin_client.post("/api/shipments/", json=shipment_payload()).json()
    refund = admin_client.post("/api/refunds/", json={"customer": ship["customer_name"], "awb": ship["awb"], "amount": 10, "reason": "Service issue"}).json()
    endpoint = f'/api/refunds/{refund["id"]}/status'
    assert admin_client.patch(endpoint, json={"status": "Refunded"}).status_code == 400
    assert admin_client.patch(endpoint, json={"status": "Under Review"}).status_code == 200
    assert admin_client.patch(endpoint, json={"status": "Approved"}).status_code == 200
    assert admin_client.patch(endpoint, json={"status": "Refunded", "refund_method": "Bank Transfer"}).status_code == 200
    assert admin_client.patch(endpoint, json={"status": "Requested"}).status_code == 400


@pytest.mark.parametrize("days_overdue,bucket", [(0,"not_due"),(1,"days1_30"),(30,"days1_30"),(31,"days31_60"),(60,"days31_60"),(61,"days61_90"),(90,"days61_90"),(91,"days90_plus")])
def test_aging_uses_due_date_boundaries(days_overdue, bucket):
    today = datetime.date(2026, 9, 8)
    result = calculate_b2b_aging_buckets([{"date": (today - datetime.timedelta(days=60 + days_overdue)).isoformat(), "credit_period_days": 60, "balance": 100}], today)
    assert result[bucket] == 100
