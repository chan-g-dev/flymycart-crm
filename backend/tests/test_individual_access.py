import os
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.models import UserProfile, Role, UserCenterAccess, Shipment
from app.seed import seed_permissions_and_roles
from app.auth import create_app_session
from app.access_policy import ROLE_NAMES, resolve_permissions
from app.routers.users import users_router
from app.routers.shipments import shipments_router
from app.routers.account_workspace import workspace_router


class IndividualAccessTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        app = FastAPI()
        app.include_router(users_router)
        app.include_router(shipments_router)
        app.include_router(workspace_router, prefix='/workspace')
        from app.routers.attendance import attendance_router
        from app.routers.customers import customers_router
        from app.routers.dashboard import dashboard_router
        from app.routers.accounts import accounts_router
        app.include_router(attendance_router)
        app.include_router(customers_router)
        app.include_router(dashboard_router)
        app.include_router(accounts_router)
        from app.routers.reports import reports_router
        from app.routers.b2b import b2b_router
        app.include_router(reports_router)
        app.include_router(b2b_router)
        from app.routers.reconciliation import reconciliation_router
        app.include_router(reconciliation_router)
        def database():
            with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)
        with self.sessions() as db:
            seed_permissions_and_roles(db)
            for user_id, role in [('admin', 'super_admin'), ('a', 'manager'), ('b', 'manager'),
                                  ('team', 'team_leader'), ('counter', 'counter_staff'), ('ops', 'operations_executive')]:
                user = UserProfile(id=user_id, email=user_id+'@example.com', display_name=user_id, role=role, status='active')
                user.roles.append(db.query(Role).filter_by(name=ROLE_NAMES[role]).one())
                db.add(user)
                db.add(UserCenterAccess(user_id=user_id, center_id='Main'))
            for center in ['Main', 'Other']:
                db.add(Shipment(id=center, awb=center, center=center, date='2026-09-21', customer_name='Customer',
                    receiver_name='Receiver', receiver_city='London', receiver_country='UK', courier='FedEx',
                    provider_name='FedEx', price=100, provider_cost=60, actual_provider_cost=60))
            db.commit()
        self.admin = self.token('admin')

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def token(self, user):
        with self.sessions() as db:
            _, token = create_app_session(db, user, mfa_verified=True)
            return {'Authorization': 'Bearer '+token}

    def save(self, overrides, version=1, user='a', headers=None):
        return self.client.put('/users/'+user+'/access', headers=headers or self.admin,
            json={'version': version, 'overrides': overrides})

    def test_role_defaults_mask_costs_and_enforce_centers(self):
        for user in ['a', 'b', 'team', 'counter', 'ops']:
            response = self.client.get('/api/shipments', headers=self.token(user))
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual([x['id'] for x in response.json()], ['Main'])
            for key in ['provider_cost', 'actual_provider_cost', 'gross_profit']:
                self.assertIsNone(response.json()[0][key])

    def test_personal_grant_isolated_and_revokes_session(self):
        old = self.token('a')
        response = self.save({'costs.view': 'allow'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/api/shipments', headers=old).status_code, 401)
        a = self.client.get('/api/shipments', headers=self.token('a')).json()[0]
        b = self.client.get('/api/shipments', headers=self.token('b')).json()[0]
        self.assertEqual(a['provider_cost'], 60)
        self.assertIsNone(a['gross_profit'])
        self.assertIsNone(b['provider_cost'])

    def test_deny_precedence_reset_and_seed_persistence(self):
        self.assertEqual(self.save({'reports.view_financial': 'allow', 'costs.view': 'deny', 'shipments.view': 'deny'}).status_code, 200)
        with self.sessions() as db:
            seed_permissions_and_roles(db)
            permissions = resolve_permissions(db, db.get(UserProfile, 'a'))
            self.assertNotIn('reports.view_financial', permissions)
            self.assertNotIn('shipments.view', permissions)
        self.assertEqual(self.client.get('/api/shipments', headers=self.token('a')).status_code, 403)
        self.assertEqual(self.save({}, version=2).status_code, 200)
        self.assertEqual(self.client.get('/api/shipments', headers=self.token('a')).status_code, 200)

    def test_editor_authorization_validation_and_conflicts(self):
        self.assertEqual(self.save({}, headers=self.token('a')).status_code, 403)
        self.assertEqual(self.save({}, user='admin').status_code, 400)
        self.assertEqual(self.save({'unknown.permission': 'allow'}).status_code, 422)
        self.assertEqual(self.save({'users.manage_permissions': 'allow'}).status_code, 200)
        self.assertEqual(self.save({}).status_code, 409)

    def test_editor_catalog_covers_permissions_and_marks_protected(self):
        from app.permissions import PermissionCode
        response = self.client.get('/users/a/access', headers=self.admin)
        self.assertEqual(response.status_code, 200)
        catalog = {p['code']: p for p in response.json()['permissions']}
        self.assertTrue({p.value for p in PermissionCode}.issubset(catalog))
        self.assertIn('costs.view', catalog)
        self.assertFalse(any(p['protected'] for p in catalog.values()))

    def test_delete_permissions_are_individual_opt_in(self):
        with self.sessions() as db:
            self.assertNotIn('customers.delete', resolve_permissions(db, db.get(UserProfile, 'counter')))
        response = self.save({'customers.delete': 'allow', 'shipments.delete': 'allow'}, user='counter')
        self.assertEqual(response.status_code, 200, response.text)
        with self.sessions() as db:
            self.assertIn('customers.delete', resolve_permissions(db, db.get(UserProfile, 'counter')))
            self.assertIn('shipments.delete', resolve_permissions(db, db.get(UserProfile, 'counter')))
            self.assertNotIn('customers.delete', resolve_permissions(db, db.get(UserProfile, 'ops')))

    def test_member_activity_is_filtered_paginated_redacted_and_protected(self):
        from app.models import AuditLog
        with self.sessions() as db:
            for index, actor in enumerate(['a', 'a', 'b']):
                db.add(AuditLog(id='log-'+str(index), user_id=actor, user_name=actor,
                    entity_type='customer', entity_id='customer-1', action='UPDATE',
                    after_value={'name': 'Updated', 'password': 'must-not-appear'}))
            db.commit()
        self.assertEqual(self.client.get('/users/audit-logs', headers=self.token('a')).status_code, 403)
        first = self.client.get('/users/audit-logs', headers=self.admin,
            params={'actor_id': 'a', 'limit': 1}).json()
        second = self.client.get('/users/audit-logs', headers=self.admin,
            params={'actor_id': 'a', 'limit': 1, 'offset': 1}).json()
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0]['actor_id'], 'a')
        self.assertEqual(second[0]['actor_id'], 'a')
        self.assertNotEqual(first[0]['id'], second[0]['id'])
        self.assertEqual(first[0]['after_data']['password'], '[REDACTED]')

    def test_role_update_preserves_personal_override_and_revokes_sessions(self):
        from app.models import Permission
        self.assertEqual(self.save({'shipments.view': 'deny'}).status_code, 200)
        token = self.token('b')
        with self.sessions() as db:
            role_id = db.query(Role).filter_by(name='Manager').one().id
            permission_id = db.query(Permission).filter_by(code='shipments.view').one().id
        url = '/users/roles/'+role_id+'/permissions'
        payload = {'permissions': [{'permission_id': permission_id, 'scope': 'center'}]}
        self.assertEqual(self.client.put(url, headers=token, json=payload).status_code, 403)
        response = self.client.put(url, headers=self.admin, json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/api/shipments', headers=token).status_code, 401)
        with self.sessions() as db:
            self.assertNotIn('shipments.view', resolve_permissions(db, db.get(UserProfile, 'a')))
            self.assertIn('shipments.view', resolve_permissions(db, db.get(UserProfile, 'b')))

    def test_no_assigned_centers_means_no_shipments(self):
        with self.sessions() as db:
            db.query(UserCenterAccess).filter_by(user_id='a').delete()
            db.commit()
        response = self.client.get('/api/shipments', headers=self.token('a'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_manager_ledger_hides_amounts_and_values(self):
        response = self.client.get('/workspace/shipment-ledger', headers=self.token('a'))
        self.assertEqual(response.status_code, 200, response.text)
        rows = response.json()['items']
        self.assertEqual(len(rows), 1)
        for key in ['cost', 'expense', 'value', 'value_with_gst']:
            self.assertIsNone(rows[0][key])
        self.assertIn(rows[0]['courier_status'], ['Paid', 'Pending', 'Processing'])

    def test_removed_role_permission_is_not_silently_restored(self):
        with self.sessions() as db:
            role_id = db.query(Role).filter_by(name='Manager').one().id
        response = self.client.put('/users/roles/'+role_id+'/permissions', headers=self.admin,
                                   json={'permissions': []})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/api/shipments', headers=self.token('a')).status_code, 403)
        with self.sessions() as db:
            seed_permissions_and_roles(db)
        self.assertEqual(self.client.get('/api/shipments', headers=self.token('a')).status_code, 403)

    def test_attendance_deny_and_pending_account_are_enforced(self):
        self.assertEqual(self.save({'attendance.view': 'deny', 'attendance.punch': 'deny'}).status_code, 200)
        headers = self.token('a')
        for path in ('staff-list', 'summary', 'events', 'daily-breakdown'):
            response = self.client.get('/api/attendance/'+path, headers=headers)
            self.assertEqual(response.status_code, 403, (path, response.text))
        response = self.client.post('/api/attendance/punch', headers=headers,
                                   json={'staff_name': 'a', 'event': 'LOGIN'})
        self.assertEqual(response.status_code, 403, response.text)
        with self.sessions() as db:
            db.get(UserProfile, 'b').status = 'pending'
            db.commit()
        self.assertEqual(self.client.get('/api/attendance/staff-list', headers=self.token('b')).status_code, 403)

    def test_alias_denials_win_in_both_orders(self):
        for overrides in ({'costs.view': 'deny', 'costs.carrier_cost': 'allow'},
                          {'costs.carrier_cost': 'allow', 'costs.view': 'deny'}):
            self.assertEqual(self.save(overrides, version=1 if list(overrides)[0] == 'costs.view' else 2).status_code, 200)
            with self.sessions() as db:
                permissions = resolve_permissions(db, db.get(UserProfile, 'a'))
                self.assertNotIn('costs.view', permissions)
                self.assertNotIn('costs.carrier_cost', permissions)

    def test_report_selection_and_center_escalation(self):
        counter = self.token('counter')
        self.assertEqual(self.client.get('/api/reports/eod', headers=counter).status_code, 200)
        self.assertEqual(self.client.get('/api/reports/weekly', headers=counter).status_code, 403)
        self.assertEqual(self.client.get('/api/reports/monthly', headers=self.token('a')).status_code, 403)
        self.assertEqual(self.save({'reports.weekly': 'allow'}, user='counter').status_code, 200)
        self.assertEqual(self.client.get('/api/reports/weekly', headers=self.token('counter')).status_code, 200)
        response = self.client.put('/users/a/centers', headers=self.token('a'), json={'center_ids': ['Other']})
        self.assertEqual(response.status_code, 403, response.text)
        old = self.token('a')
        response = self.client.put('/users/a/centers', headers=self.admin, json={'center_ids': ['Other']})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/api/shipments', headers=old).status_code, 401)
        self.assertEqual([s['id'] for s in self.client.get('/api/shipments', headers=self.token('a')).json()], ['Other'])

    def test_reconciliation_requires_cost_access_and_filters_whole_batches(self):
        from app.models import ReconciliationBatch, ReconciliationItem
        with self.sessions() as db:
            for name, awbs in [('main', ['Main']), ('other', ['Other']), ('mixed', ['Main', 'Other'])]:
                db.add(ReconciliationBatch(id=name, batch_no=name, date='2026-09-23', provider='FedEx'))
                for awb in awbs:
                    db.add(ReconciliationItem(batch_id=name, awb=awb, status='MATCHED'))
            db.commit()
        self.assertEqual(self.client.get('/api/reconciliation/batches', headers=self.token('a')).status_code, 403)
        self.assertEqual(self.save({'costs.carrier_cost': 'allow'}).status_code, 200)
        headers = self.token('a')
        response = self.client.get('/api/reconciliation/batches', headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([batch['id'] for batch in response.json()], ['main'])
        self.assertEqual(self.client.get('/api/reconciliation/batches/mixed', headers=headers).status_code, 404)

    def test_amounts_hidden_across_customer_dashboard_and_accounts(self):
        from app.models import Customer, Invoice
        with self.sessions() as db:
            db.add(Customer(id='main-customer', name='Main Customer', mobile='9000000011', center='Main'))
            db.get(Shipment, 'Main').customer_id = 'main-customer'
            db.add(Invoice(id='invoice-main', invoice_no='QA-1', customer_id='main-customer',
                shipment_id='Main', customer_name='Main Customer', date='2026-09-21',
                amount=100, gst=18, total=118, paid=20, balance=98))
            db.commit()
        headers = self.token('a')
        customers = self.client.get('/api/customers', headers=headers).json()
        self.assertIsNone(customers[0]['total_spend'])
        self.assertIsNone(customers[0]['outstanding_balance'])
        profile = self.client.get('/api/customers/main-customer/360', headers=headers).json()
        self.assertIsNone(profile['total_spent'])
        self.assertIsNone(profile['invoices'][0]['total'])
        dashboard = self.client.get('/api/dashboard/summary', headers=headers).json()
        self.assertIsNone(dashboard['center_summaries']['Main']['total_sales_with_gst'])
        overview = self.client.get('/workspace/overview', headers=headers).json()
        for key in ('sales', 'gross_sales', 'collected', 'pending', 'b2b', 'net'):
            self.assertIsNone(overview['totals'][key], key)
        response = self.client.get('/api/accounts/receipts?date_from=2026-09-01&date_to=2026-09-30', headers=headers)
        self.assertEqual(response.status_code, 403)
        b2b = self.client.get('/api/b2b/summary', headers=headers).json()
        self.assertIsNone(b2b['outstanding'])
        self.assertEqual(self.save({'costs.customer_price': 'allow'}).status_code, 200)
        headers = self.token('a')
        overview = self.client.get('/workspace/overview', headers=headers).json()
        self.assertEqual(overview['totals']['sales'], 100)
        self.assertIsNone(overview['totals']['cost'])
        self.assertIsNone(overview['totals']['net'])
