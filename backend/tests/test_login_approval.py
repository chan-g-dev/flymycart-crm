import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.dependencies import get_supabase_anon_client
from app.models import User, UserProfile
from app.routers.auth import auth_router
from app.routers.shipments import shipments_router
from app.seed import seed_permissions_and_roles
from app.rate_limiter import login_limiter


class LoginApprovalTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        with self.sessions() as db:
            seed_permissions_and_roles(db)
        self.app = FastAPI()
        self.app.include_router(auth_router, prefix='/api')
        self.app.include_router(shipments_router)
        def database():
            with self.sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = database
        self.app.dependency_overrides[get_supabase_anon_client] = lambda: None
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_new_staff_waits_for_approval_and_cannot_read_shipments(self):
        response = self.client.post('/api/auth/login', json={
            'full_name': 'Pending QA Staff', 'email': 'pending-qa@example.test', 'password': 'Only-for-local-tests!'
        })
        self.assertEqual(response.status_code, 200, response.text)
        with self.sessions() as db:
            profile = db.query(UserProfile).filter_by(email='pending-qa@example.test').one()
            self.assertEqual(profile.status, 'pending')
            self.assertIsNone(profile.approved_at)
            legacy = db.query(User).filter_by(email=profile.email).one()
            self.assertFalse(legacy.is_active)
        response = self.client.get('/api/shipments', headers={'Authorization': 'Bearer ' + response.json()['session_token']})
        self.assertEqual(response.status_code, 403, response.text)

    def test_legacy_user_without_password_cannot_be_claimed(self):
        with self.sessions() as db:
            db.add(User(id='legacy-qa', username='legacy-qa', email='legacy-qa@example.test', name='Legacy QA', status='Active', role='super_admin', password_hash=None))
            db.commit()
        response = self.client.post('/api/auth/login', json={'email': 'legacy-qa@example.test', 'password': 'attacker-selected-password'})
        self.assertEqual(response.status_code, 401, response.text)
