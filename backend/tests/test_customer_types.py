import os
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import inspect
import unittest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.models import Customer, Shipment, SystemSettings
from app.business_options import validate_business_options
from app.customer_types import normalize_customer_types, resolve_customer_type
from app.routers.customers import customers_router, create_customer
from app.routers.shipments import shipments_router, create_shipment
from app.routers.settings import get_settings


class CustomerTypesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.db = self.sessions()
        self.db.add(SystemSettings(id=1, config_json=validate_business_options({'customerTypes': ['Distributor', 'Marketplace']})))
        self.db.commit()
        app = FastAPI()
        app.include_router(customers_router)
        app.include_router(shipments_router)
        app.dependency_overrides[get_db] = lambda: self.db
        for endpoint in [create_customer, create_shipment]:
            dependency = inspect.signature(endpoint).parameters['ctx'].default.dependency
            app.dependency_overrides[dependency] = lambda: {'user_id': 'test-admin', 'display_name': 'Test Admin', 'is_super_admin': True, 'permissions': {'*': True}}
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def test_settings_validation_and_staff_visibility(self):
        self.assertEqual(normalize_customer_types(['b2b', ' Distributor ', 'distributor']), ['C2C', 'B2C', 'B2B', 'Distributor'])
        for values in ['Retail', [''], ['x' * 51], [None], ['bad\nlabel'], [str(i) for i in range(101)]]:
            with self.assertRaises(HTTPException):
                validate_business_options({'customerTypes': values})
        self.assertIn('Distributor', get_settings(ctx={'is_super_admin': False}, db=self.db)['customerTypes'])

    def test_custom_type_customer_and_shipment_roundtrip(self):
        response = self.client.post('/api/customers', json={'name': 'Type Test', 'mobile': '9000000001', 'customer_type': 'distributor'})
        self.assertEqual(response.status_code, 200, response.text)
        customer = response.json()
        self.assertEqual(customer['customer_type'], 'Distributor')
        response = self.client.post('/api/shipments', headers={'Idempotency-Key': 'custom-customer-type-booking'}, json={
            'awb': 'CUSTOM-TYPE-1', 'date': '2026-09-23', 'customer_id': customer['id'],
            'customer_name': 'Type Test', 'customer_type': 'Distributor',
            'receiver': {'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
            'parcel': {'actual_weight': 1}, 'courier': 'Aramex', 'provider_type': 'postpaid',
            'provider_name': 'Aramex', 'price': 1000, 'provider_cost': 600, 'payment_status': 'Unpaid',
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['customer_type'], 'Distributor')
        self.assertEqual(self.db.query(Shipment).one().customer_type, 'Distributor')

    def test_unknown_type_rejected_and_historical_type_retained(self):
        response = self.client.post('/api/customers', json={'name': 'Invalid', 'mobile': '9000000002', 'customer_type': 'Not Configured'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.db.query(Customer).count(), 0)
        self.assertEqual(resolve_customer_type(self.db, 'Legacy', existing='Legacy'), 'Legacy')
