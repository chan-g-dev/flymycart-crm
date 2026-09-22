import os
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import inspect
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.models import Shipment
from app.routers.shipments import shipments_router, get_shipments


class RecentBookingsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        sessions = sessionmaker(bind=self.engine)
        app = FastAPI()
        app.include_router(shipments_router)
        def database():
            with sessions() as db:
                yield db
        app.dependency_overrides[get_db] = database
        permission = inspect.signature(get_shipments).parameters['ctx'].default.dependency
        app.dependency_overrides[permission] = lambda: {'permissions': {}}
        self.client = TestClient(app)
        with sessions() as db:
            for index in range(27):
                db.add(Shipment(id=f'ship-{index:03}', awb=f'AWB-{index:03}',
                    date='2026-09-12' if index < 26 else '2026-09-11',
                    center='Main' if index < 25 else 'Branch', customer_name='Customer',
                    receiver_name='Receiver', receiver_city='London', receiver_country='UK',
                    courier='FedEx', provider_name='FedEx', price=100,
                    provider_cost=50, actual_provider_cost=50))
            db.commit()

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_date_center_pagination_totals_and_masking(self):
        ids = []
        for offset, expected in [(0, 10), (10, 10), (20, 5)]:
            response = self.client.get('/api/shipments', params={
                'booking_date': '2026-09-12', 'center': 'Main', 'limit': 10, 'offset': offset})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.headers['x-total-count'], '25')
            self.assertEqual(len(response.json()), expected)
            for item in response.json():
                self.assertEqual(item['date'], '2026-09-12')
                self.assertEqual(item['center'], 'Main')
                self.assertIsNone(item['provider_cost'])
                ids.append(item['id'])
        self.assertEqual(len(set(ids)), 25)
        all_centers = self.client.get('/api/shipments', params={'booking_date': '2026-09-12'})
        self.assertEqual(all_centers.headers['x-total-count'], '26')
        all_dates = self.client.get('/api/shipments')
        self.assertEqual(all_dates.headers['x-total-count'], '27')

    def test_empty_and_invalid_dates(self):
        response = self.client.get('/api/shipments', params={'booking_date': '2026-09-01'})
        self.assertEqual(response.json(), [])
        self.assertEqual(response.headers['x-total-count'], '0')
        self.assertEqual(self.client.get('/api/shipments', params={'booking_date': 'invalid'}).status_code, 422)
