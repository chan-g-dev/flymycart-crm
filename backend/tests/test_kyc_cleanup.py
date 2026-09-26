"""KYC administration must reject broadening or unauthorized requests."""
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.dependencies import get_current_session_context
from app.models import Customer, Shipment
from app.routers.settings import settings_router


class KycCleanupTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.app = FastAPI()
        self.app.include_router(settings_router)
        self.ctx = {'user_id': 'review-admin', 'display_name': 'Review Admin',
                    'is_super_admin': True, 'status': 'active', 'permissions': {'settings.view': True}}
        def database():
            with self.sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = database
        self.app.dependency_overrides[get_current_session_context] = lambda: self.ctx
        self.client = TestClient(self.app)
        with self.sessions() as db:
            db.add(Customer(id='cust_review', name='Review', mobile='9000000000', id_proof_front='test-image'))
            db.commit()

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_settings_view_does_not_grant_kyc_access(self):
        self.ctx['is_super_admin'] = False
        for method, path, kwargs in [
            ('get', '/settings/kyc-storage', {}),
            ('post', '/settings/kyc-storage/cleanup', {'json': {'record_ids': ['cust_review']}}),
            ('delete', '/settings/kyc-storage/cust_review', {}),
        ]:
            response = getattr(self.client, method)(path, **kwargs)
            self.assertEqual(response.status_code, 403, response.text)

    def test_invalid_selectors_never_remove_documents(self):
        for payload in [{}, {'record_ids': []}, {'record_ids': 'cust_review'},
                        {'from_date': 'invalid'}, {'to_date': '2026-02-30'},
                        {'from_date': '2026-09-01', 'to_date': '2026-08-01'},
                        {'older_than_months': -1}, {'older_than_days': True},
                        {'custom_cutoff': 'bad'},
                        {'record_ids': ['cust_review'], 'older_than_days': 1}]:
            with self.subTest(payload=payload):
                response = self.client.post('/settings/kyc-storage/cleanup', json=payload)
                self.assertEqual(response.status_code, 422, response.text)
                with self.sessions() as db:
                    self.assertEqual(db.get(Customer, 'cust_review').id_proof_front, 'test-image')

    def test_selected_cleanup_preserves_customer(self):
        response = self.client.post('/settings/kyc-storage/cleanup', json={'record_ids': ['cust_review']})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['cleaned_count'], 1)
        with self.sessions() as db:
            customer = db.get(Customer, 'cust_review')
            self.assertIsNone(customer.id_proof_front)
            self.assertEqual(customer.name, 'Review')

    def test_paginated_search_reaches_records_beyond_first_hundred(self):
        with self.sessions() as db:
            for index in range(120):
                db.add(Shipment(
                    id=f'ship_page_{index:03}', awb=f'PAGE{index:03}', date='2026-09-25',
                    customer_name=f'Paged customer {index:03}', sender_name=f'Paged customer {index:03}',
                    receiver_name='Receiver', receiver_city='Bengaluru', receiver_country='India',
                    courier='Test', provider_name='Test', price=100, provider_cost=50,
                    actual_provider_cost=50, id_proof_front='front-image', id_proof_back='back-image'
                ))
            db.commit()
        seen = set()
        for offset in (0, 50, 100):
            response = self.client.get('/settings/kyc-storage', params={'limit': 50, 'offset': offset})
            self.assertEqual(response.status_code, 200, response.text)
            data = response.json()
            self.assertEqual(data['filtered_total'], 120)
            self.assertLessEqual(len(data['records']), 50)
            ids = {r['id'] for r in data['records']}
            self.assertFalse(seen & ids)
            seen.update(ids)
        self.assertEqual(len(seen), 120)
        data = self.client.get('/settings/kyc-storage', params={'search': 'Paged customer 119'}).json()
        self.assertEqual(data['filtered_total'], 1)
        self.assertEqual(data['records'][0]['id'], 'ship_page_119')
        self.assertEqual(data['records'][0]['sender_front'], 'front-image')
        self.assertEqual(data['records'][0]['sender_back'], 'back-image')
        self.assertNotIn('sender_image', data['records'][0])
        self.assertEqual(self.client.get('/settings/kyc-storage', params={'date_from': 'bad'}).status_code, 422)
