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
from app.models import Customer, Shipment, SystemSettings, B2BCompany, Invoice
from app.business_options import validate_business_options
from app.customer_types import normalize_customer_types, resolve_customer_type
from app.routers.customers import customers_router, create_customer, lookup_customer_by_mobile
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
        for endpoint in [create_customer, create_shipment, lookup_customer_by_mobile]:
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

    def corporate(self):
        company = B2BCompany(id='b2b_test', company_name='QA Corporate', contact_person='QA Contact',
            mobile='9000000999', credit_limit=25000, credit_period_days=45)
        self.db.add(company)
        self.db.add(Customer(id='b2c_test', name='QA Retail', mobile='9000000999', customer_type='B2C'))
        self.db.commit()
        return company

    def shipment_payload(self, **changes):
        return {'awb': 'CATEGORY-TEST', 'date': '2026-09-25', 'customer_name': 'QA Corporate',
            'customer_type': 'B2B', 'customer_mobile': '9000000999',
            'receiver': {'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
            'parcel': {'actual_weight': 1}, 'courier': 'Aramex', 'provider_type': 'postpaid',
            'provider_name': 'Aramex', 'price': 1000, 'provider_cost': 600,
            'payment_status': 'B2B Credit', 'collected_by': '', **changes}

    def test_empty_b2b_lookup_and_b2c_isolation(self):
        self.corporate()
        result = self.client.get('/api/customers/lookup', params={'mobile': '', 'customer_type': 'B2B'})
        self.assertEqual(result.status_code, 200, result.text)
        corporate = result.json()['matches'][0]
        self.assertIsNone(corporate['customer_id'])
        self.assertEqual(corporate['b2b_company_id'], 'b2b_test')
        result = self.client.get('/api/customers/lookup', params={'mobile': '9000000999', 'customer_type': 'B2C'})
        self.assertEqual([c['id'] for c in result.json()['matches']], ['b2c_test'])
        self.assertEqual(self.client.get('/api/customers/lookup', params={'mobile': '', 'customer_type': 'B2C'}).json()['matches'], [])

    def test_corporate_booking_links_invoice_and_reuses_customer_without_collector(self):
        self.corporate()
        customer_ids = []
        for index in range(2):
            result = self.client.post('/api/shipments', json=self.shipment_payload(awb=f'CORP-{index}', b2b_company_id='b2b_test'))
            self.assertEqual(result.status_code, 200, result.text)
            customer_ids.append(result.json()['customer_id'])
        self.assertEqual(customer_ids[0], customer_ids[1])
        self.assertNotEqual(customer_ids[0], 'b2c_test')
        customer = self.db.get(Customer, customer_ids[0])
        self.assertEqual(customer.b2b_company_id, 'b2b_test')
        self.assertEqual(customer.credit_period_days, 45)
        self.assertEqual(customer.credit_limit, 25000)
        for invoice in self.db.query(Invoice).all():
            self.assertEqual(invoice.b2b_company_id, 'b2b_test')
            self.assertEqual(invoice.balance, 1180)
        result = self.client.get('/api/customers/lookup', params={'mobile': '', 'customer_type': 'B2B'})
        self.assertEqual(len(result.json()['matches']), 1)
        self.assertEqual(result.json()['matches'][0]['customer_id'], customer_ids[0])

    def test_b2c_unpaid_and_paid_bookings(self):
        self.corporate()
        unpaid = self.client.post('/api/shipments', json=self.shipment_payload(customer_type='B2C', payment_status='Unpaid'))
        self.assertEqual(unpaid.status_code, 200, unpaid.text)
        self.assertEqual(unpaid.json()['customer_id'], 'b2c_test')
        self.assertIsNone(unpaid.json()['b2b_company_id'])
        paid = self.shipment_payload(awb='B2C-PAID', customer_type='B2C', payment_status='Paid', payment_method='Cash',
            paid_to='Cash in Hand', payment_details={'owner_type': 'Business', 'account_holder': 'QA Cashier'})
        denied = self.client.post('/api/shipments', json=paid)
        self.assertEqual(denied.status_code, 400, denied.text)
        self.assertIn('Collector', denied.json()['detail'])
        paid['collected_by'] = 'QA Cashier'
        result = self.client.post('/api/shipments', json=paid)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.db.query(Invoice).filter_by(awb='B2C-PAID').one().balance, 0)

    def test_invalid_or_cross_category_selection_does_not_fall_back_to_phone(self):
        self.corporate()
        cases = [({'customer_id': 'missing'}, 404),
                 ({'b2b_company_id': 'missing'}, 404),
                 ({'customer_type': 'B2C', 'b2b_company_id': 'b2b_test'}, 400)]
        for changes, expected in cases:
            response = self.client.post('/api/shipments', json=self.shipment_payload(**changes))
            self.assertEqual(response.status_code, expected, response.text)
        self.assertEqual(self.db.query(Shipment).count(), 0)
