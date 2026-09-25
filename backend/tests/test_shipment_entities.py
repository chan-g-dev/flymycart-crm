import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Shipment, Customer, User, Role, UserRole, BookingRequest
from app.auth import get_current_user_context, hash_password
from app.dependencies import get_current_session_context
from app.business_dates import business_today

# Setup in-memory sqlite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    return {
        "user_id": "usr_test_admin",
        "username": "admin",
        "display_name": "Test SuperAdmin",
        "is_super_admin": True,
        "status": "active",
        "role": "Super Admin",
        "permissions": {"*": True, "shipments.view": True, "shipments.add": True, "costs.view": True, "costs.customer_price": True, "costs.carrier_cost": True, "costs.net_value": True}
    }

class ShipmentEntityTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(bind=engine)
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user_context] = override_get_current_user
        app.dependency_overrides[get_current_session_context] = override_get_current_user
        db = TestingSessionLocal()
    
        # Create test shipments under each entity
        cust = Customer(id="c1", name="Test Customer", mobile="9876543210")
        db.add(cust)
        db.commit()

        s1 = Shipment(
            id="ship_gc_1",
            awb="GC-1001",
            date="2026-09-24",
            customer_id="c1",
            customer_name="Test Customer",
            courier="FedEx",
            provider_name="FedEx",
            provider_type="postpaid",
            price=1000.0,
            provider_cost=700.0,
            actual_provider_cost=700.0,
            receiver_name="John Doe",
            receiver_city="New York",
            receiver_country="USA",
            entity="Globe Courier",
            status="In Transit"
        )
        s2 = Shipment(
            id="ship_usu_1",
            awb="USU-2001",
            date="2026-09-24",
            customer_id="c1",
            customer_name="Test Customer",
            courier="DHL",
            provider_name="DHL",
            provider_type="postpaid",
            price=2000.0,
            provider_cost=1400.0,
            actual_provider_cost=1400.0,
            receiver_name="Jane Smith",
            receiver_city="London",
            receiver_country="UK",
            entity="USU Enterprises",
            status="In Transit"
        )
        s3 = Shipment(
            id="ship_via_1",
            awb="VIA-3001",
            date="2026-09-24",
            customer_id="c1",
            customer_name="Test Customer",
            courier="Aramex",
            provider_name="Aramex",
            provider_type="postpaid",
            price=1500.0,
            provider_cost=1000.0,
            actual_provider_cost=1000.0,
            receiver_name="Ali Hassan",
            receiver_city="Dubai",
            receiver_country="UAE",
            entity="VIA Fly Logistics",
            status="In Transit"
        )
        db.add_all([s1, s2, s3])
        db.commit()
        db.close()

    def tearDown(self):
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.clear()

    def test_get_all_shipments(self):
        client = TestClient(app)
        res = client.get("/api/shipments")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 3
        entities = {s["entity"] for s in data}
        assert entities == {"Globe Courier", "USU Enterprises", "VIA Fly Logistics"}

    def test_filter_shipments_by_single_entity(self):
        client = TestClient(app)
    
        # Globe Courier only
        res_gc = client.get("/api/shipments?entity=Globe%20Courier")
        assert res_gc.status_code == 200
        data_gc = res_gc.json()
        assert len(data_gc) == 1
        assert data_gc[0]["awb"] == "GC-1001"
        assert data_gc[0]["entity"] == "Globe Courier"

        # USU Enterprises only
        res_usu = client.get("/api/shipments?entity=USU%20Enterprises")
        assert res_usu.status_code == 200
        data_usu = res_usu.json()
        assert len(data_usu) == 1
        assert data_usu[0]["awb"] == "USU-2001"
        assert data_usu[0]["entity"] == "USU Enterprises"

        # VIA Fly Logistics only
        res_via = client.get("/api/shipments?entity=VIA%20Fly%20Logistics")
        assert res_via.status_code == 200
        data_via = res_via.json()
        assert len(data_via) == 1
        assert data_via[0]["awb"] == "VIA-3001"
        assert data_via[0]["entity"] == "VIA Fly Logistics"

    def test_create_shipment_with_entity(self):
        client = TestClient(app)
        payload = {
            "awb": "USU-BOOK-999",
            "date": "2026-09-24",
            "customer_name": "Test Customer",
            "customer_mobile": "9876543210",
            "customer_type": "B2B",
            "entity": "USU Enterprises",
            "courier": "FedEx",
            "domestic_international": "International",
            "service_type": "International Priority",
            "provider_type": "postpaid",
            "provider_name": "FedEx",
            "price": 2500.0,
            "provider_cost": 1800.0,
            "payment_status": "Paid",
            "payment_reference": "UPI-REF-998877",
            "payment_method": "PhonePe",
            "paid_to": "Office QR",
            "collected_by": "Staff Nawaz",
            "sender": {
                "name": "Test Customer",
                "phone": "9876543210",
                "address": "Bangalore, Karnataka, India",
                "email": "test@example.com"
            },
            "receiver": {
                "name": "Corporate Receiver",
                "phone": "+1 555-0199",
                "address": "450 5th Ave",
                "city": "New York",
                "country": "USA",
                "state": "NY",
                "zip": "10018"
            },
            "parcel": {
                "description": "Enterprise Documents",
                "packages_count": 1,
                "actual_weight": 1.5,
                "length": 10,
                "width": 10,
                "height": 5,
                "boxes": []
            }
        }

        res = client.post("/api/shipments", json=payload)
        assert res.status_code == 200, res.text
        created = res.json()
        assert created["awb"] == "USU-BOOK-999"
        assert created["entity"] == "USU Enterprises"

        # Verify query by USU Enterprises now returns 2
        res_filter = client.get("/api/shipments?entity=USU%20Enterprises")
        assert res_filter.status_code == 200
        assert len(res_filter.json()) == 2

    def test_booking_conversion_preserves_entity_and_ddp_unless_overridden(self):
        client = TestClient(app)
        for index, overrides in enumerate([{}, {"entity": "Globe Courier", "is_ddp": False}]):
            booking_id = f"convert-{index}"
            with TestingSessionLocal() as db:
                db.add(BookingRequest(id=booking_id, request_no=booking_id, customer_id="c1",
                    customer_name="Test Customer", customer_type="C2C", entity="USU Enterprises", is_ddp=True,
                    sender_name="Test Customer", sender_phone="9876543210", sender_address="Bangalore",
                    receiver_name="Receiver", receiver_phone="1234567890", receiver_address="London",
                    receiver_city="London", receiver_country="UK", actual_weight=1,
                    status="Accepted", quoted_amount=1000))
                db.commit()
            response = client.post(f"/api/booking-requests/{booking_id}/convert-to-shipment", json={
                "awb": f"CONVERT-{index}", "courier": "FedEx", "provider_name": "FedEx",
                "provider_type": "postpaid", "price": 1000, "provider_cost": 600, **overrides})
            self.assertEqual(response.status_code, 200, response.text)
            with TestingSessionLocal() as db:
                shipment = db.get(Shipment, response.json()["shipment_id"])
                self.assertEqual(shipment.entity, overrides.get("entity", "USU Enterprises"))
                self.assertEqual(shipment.is_ddp, overrides.get("is_ddp", True))
