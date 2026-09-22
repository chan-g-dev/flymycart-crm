"""Isolated regression coverage. Run from backend with unittest discovery."""
import os
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import datetime as dt
import inspect
import unittest
from unittest.mock import Mock, patch
from decimal import Decimal
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.models import Shipment, Customer, Refund, AccountingEntry, SystemSettings, Invoice, PaymentCollection
from app.routers.accounts import accounts_router, record_accounting_entry
from app.routers.shipments import shipments_router, create_shipment
from app.routers.account_workspace import get_workspace_overview, period_totals, get_shipment_ledger
from app.routers.reports import get_eod_report, get_monthly_pl_report, get_weekly_operations_report
from app.routers.dashboard import get_dashboard_summary
from app.finance_engine import calculate_gross_profit
from app.seed import migrate_database_schema
from app.config import settings

CTX = {'user_id': 'test-admin', 'display_name': 'Test Admin', 'is_super_admin': True, 'permissions': {'*': True}}

class ProductionReviewTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        # Simulate older deployments where actual provider cost is nullable.
        column = Shipment.__table__.c.actual_provider_cost
        original_nullable = column.nullable
        try:
            column.nullable = True
            Base.metadata.create_all(self.engine)
        finally:
            column.nullable = original_nullable
        self.sessions = sessionmaker(bind=self.engine)
        self.app = FastAPI()
        self.app.include_router(accounts_router)
        self.app.include_router(shipments_router)
        def db_override():
            with self.sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = db_override
        for endpoint in (record_accounting_entry, create_shipment):
            dep = inspect.signature(endpoint).parameters['ctx'].default.dependency
            self.app.dependency_overrides[dep] = lambda: CTX
        self.client = TestClient(self.app, follow_redirects=False)
        with self.sessions() as db:
            db.add(SystemSettings(id=1, config_json={'invoicePrefix': 'CUSTOM-', 'postpaidProviders': [{'name': 'Aramex', 'deposit': 0}]}))
            db.commit()

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_payment_retry_only_records_once(self):
        payload = {'kind': 'expense', 'category': 'Packing', 'vendor': 'Test Vendor',
                   'date': '2026-09-16', 'amount': 100, 'account': 'Cash', 'payment_mode': 'Cash',
                   'payment_details': {'owner_type': 'Business', 'account_holder': 'Test Office'}}
        headers = {'Idempotency-Key': 'test-payment-key-12345'}
        first = self.client.post('/api/accounts/entries', json=payload, headers=headers)
        second = self.client.post('/api/accounts/entries', json=payload, headers=headers)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(second.json(), first.json())
        conflict = self.client.post('/api/accounts/entries', json={**payload, 'amount': 200}, headers=headers)
        self.assertEqual(conflict.status_code, 409)
        with self.sessions() as db:
            self.assertEqual(db.query(AccountingEntry).count(), 1)

    def test_carrier_bill_cannot_be_misclassified_as_operating_expense(self):
        payload = {'kind': 'expense', 'category': 'Courier Partner Bill (Monthly)', 'vendor': 'Aramex',
                   'date': '2026-09-22', 'amount': 34600, 'account': 'Cash', 'payment_mode': 'Cash',
                   'payment_details': {'owner_type': 'Business', 'account_holder': 'Test Office'}}
        response = self.client.post('/api/accounts/entries', json=payload)
        self.assertEqual(response.status_code, 400, response.text)
        with self.sessions() as db:
            self.assertEqual(db.query(AccountingEntry).count(), 0)
        response = self.client.post('/api/accounts/entries', json={**payload, 'kind': 'provider_payment', 'provider': 'Aramex'})
        self.assertEqual(response.status_code, 201, response.text)
        with self.sessions() as db:
            entry = db.query(AccountingEntry).one()
            self.assertEqual(entry.kind, 'provider_payment')
            self.assertIsNone(entry.category)

    def test_booking_retry_and_invoice(self):
        payload = {'awb': 'TEST-PRODUCTION', 'date': '2026-09-16', 'customer_name': 'Test Customer',
                   'customer_mobile': '9000000001', 'receiver': {'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
                   'parcel': {'actual_weight': 2}, 'courier': 'Aramex', 'provider_type': 'postpaid',
                   'provider_name': 'Aramex', 'price': 1000, 'provider_cost': 600, 'payment_status': 'Unpaid'}
        headers = {'Idempotency-Key': 'test-booking-key-12345'}
        first = self.client.post('/api/shipments', json=payload, headers=headers)
        self.assertEqual(first.status_code, 200, first.text)
        second = self.client.post('/api/shipments', json=payload, headers=headers)
        self.assertEqual(second.json()['id'], first.json()['id'])
        with self.sessions() as db:
            self.assertEqual(db.query(Shipment).count(), 1)
            self.assertEqual(db.query(Invoice).one().total, 1180)
            self.assertTrue(db.query(Invoice).one().invoice_no.startswith('CUSTOM-'))

    def test_refund_profit_and_cash_dates_and_missing_actual_cost(self):
        with self.sessions() as db:
            db.add(Customer(id='c', name='Test', mobile='9000000001'))
            db.flush()
            db.add(Shipment(id='s', customer_id='c', customer_name='Test', awb='TEST', date='2026-09-16',
                            receiver_name='Receiver', receiver_city='Delhi', receiver_country='India', courier='Aramex',
                            price=1000, provider_cost=600, actual_provider_cost=None, cost_reconciled=True, provider_name='Aramex'))
            db.add(Refund(customer='Test', customer_id='c', awb='TEST', amount=100, reason='Test',
                          request_date='2026-09-15', approval_date='2026-09-16', refund_date='2026-09-17',
                          status='Refunded', payment_details={'account': 'Refund Cash'}))
            db.commit()
            # ORM defaults can fill an explicit None; preserve a legacy NULL for regression coverage.
            db.execute(text("UPDATE shipments SET actual_provider_cost=NULL WHERE id='s'")); db.commit()
            report = get_workspace_overview(dt.date(2026,9,16), dt.date(2026,9,16), ctx=CTX, db=db)
            self.assertEqual(report['totals']['cost'], 600)
            self.assertEqual(report['totals']['net'], 300)
            self.assertEqual(report['by_partner']['Aramex'], 600)
            self.assertNotIn('Refund Cash', {r['name'] for r in report['bank_accounts']})
            later = get_workspace_overview(date_to=dt.date(2026,9,17), ctx=CTX, db=db)
            self.assertEqual(next(r['recorded_balance'] for r in later['bank_accounts'] if r['name']=='Refund Cash'), -100)

    def test_profit_excludes_sales_gst_and_retains_gst_in_billed_totals(self):
        with self.sessions() as db:
            for index, (gst, total) in enumerate([(180, 1180), (140, None), (0, 1000)]):
                db.add(Shipment(id=f'gst-{index}', customer_name='Test', awb=f'GST-{index}',
                    date='2026-09-16', center='Main', receiver_name='Receiver',
                    receiver_city='Delhi', receiver_country='India', courier='Aramex',
                    provider_name='Aramex', price=1000, gst_amount=gst, total_amount=total,
                    is_gst_applicable=gst > 0, provider_cost=600, actual_provider_cost=900,
                    cost_reconciled=False))
            db.add(AccountingEntry(id='gst-expense', date='2026-09-16', kind='expense',
                amount=50, account='Cash', reference='Packing', created_by='Test Admin', center='Main', shipment_id='gst-0'))
            db.add(Refund(id='gst-refund', awb='GST-0', customer='Test', reason='Adjustment', amount=25, status='Approved',
                request_date='2026-09-16', approval_date='2026-09-16'))
            db.commit()
            result = period_totals(db, dt.date(2026, 9, 16), dt.date(2026, 9, 16), 'Main', True)
            self.assertEqual(result['sales'], 3000)
            self.assertEqual(result['gross_sales'], 3320)
            self.assertEqual(result['net'], 1125)
            self.assertEqual(result['net_with_gst'], 1445)
            ledger = get_shipment_ledger(center='Main', limit=10, offset=0, ctx=CTX, db=db)
            rows = {row['id']: row for row in ledger['items']}
            self.assertEqual([rows[f'gst-{i}']['value'] for i in range(3)], [350, 400, 400])
            self.assertEqual([rows[f'gst-{i}']['value_with_gst'] for i in range(3)], [530, 540, 400])
            self.assertEqual(rows['gst-1']['gross_sale'], 1140)
            self.assertEqual(rows['gst-2']['gross_sale'], 1000)
            hidden = get_shipment_ledger(center='Main', limit=10, offset=0, ctx={'permissions': {}}, db=db)
            self.assertTrue(all(row['value'] is None for row in hidden['items']))
            self.assertTrue(all(row['value_with_gst'] is None for row in hidden['items']))
            self.assertIsNone(period_totals(db, None, None, 'Main', False)['net'])
            self.assertIsNone(period_totals(db, None, None, 'Main', False)['net_with_gst'])
            for report in [get_eod_report('2026-09-16', CTX, db), get_monthly_pl_report('2026-09', CTX, db)]:
                self.assertEqual(report['invoice_total'], 3320)
                self.assertEqual(report['gst_total'], 320)
                self.assertEqual(report['gross_profit'], 1200)
                self.assertEqual(report['net_profit'], 1125)
                self.assertEqual(report['net_profit_with_gst'], 1445)
                self.assertEqual(report['gross_profit_with_gst'], 1520)
            weekly = get_weekly_operations_report('2026-09-16', CTX, db)
            day = next(row for row in weekly['daily'] if row['date'] == '2026-09-16')
            self.assertEqual(day['revenue_with_gst'], 3320)
            self.assertEqual(day['gross_profit'], 1200)
            self.assertEqual(day['gross_profit_with_gst'], 1520)
            dashboard = get_dashboard_summary(CTX, db)
            self.assertEqual(dashboard['total_sales_with_gst'], 3320)
            self.assertEqual(dashboard['total_gross_profit'], 1200)
            self.assertEqual(dashboard['center_summaries']['Main']['total_sales_with_gst'], 3320)

    def test_profit_respects_reconciliation_and_zero_actual_cost(self):
        self.assertEqual(calculate_gross_profit(1000, 600, 900, False), 400)
        self.assertEqual(calculate_gross_profit(1000, 600, 900, True), 100)
        self.assertEqual(calculate_gross_profit(1000, 600, 0, True), 1000)
        self.assertEqual(calculate_gross_profit(1000, 600, None, True), 400)

    def test_mixed_postgres_numeric_aggregates(self):
        db = Mock()
        ship, entry, receipt, refund = [Mock() for _ in range(4)]
        for query in (ship, entry, receipt, refund):
            query.filter.return_value = query
            query.with_entities.return_value = query
        db.query.side_effect = [ship, entry, receipt, refund, ship]
        ship.one.return_value = (Decimal('1000'), Decimal('1180'), Decimal('600'))
        entry.scalar.return_value = 50.0
        receipt.scalar.return_value = Decimal('100')
        refund.scalar.return_value = 25.0
        with patch('app.routers.account_workspace.refund_query', return_value=refund):
            result = period_totals(db, None, None, None, True)
        self.assertEqual(result['net'], 325)

    def test_schema_upgrade_is_repeatable(self):
        with self.sessions() as db:
            for table in ('accounting_entries', 'payment_collections', 'wallet_transactions', 'refunds'):
                db.execute(text(f'ALTER TABLE {table} DROP COLUMN payment_details'))
            db.commit()
            migrate_database_schema(db)
            migrate_database_schema(db)
            for table in ('accounting_entries', 'payment_collections', 'wallet_transactions', 'refunds'):
                db.execute(text(f'SELECT payment_details FROM {table} LIMIT 1'))

    def test_special_password_cannot_override_account_password(self):
        from app.routers.auth import auth_router
        from app.dependencies import get_supabase_anon_client
        from app.models import UserProfile
        from app.auth import hash_password
        self.app.include_router(auth_router)
        self.app.dependency_overrides[get_supabase_anon_client] = lambda: None
        with self.sessions() as db:
            db.add(UserProfile(id='normal-user', email='test@example.com', display_name='Test User',
                               role='operations_staff', status='active', password_hash=hash_password('saved-user-password')))
            db.commit()
        with patch.dict(os.environ, {'BOOTSTRAP_ADMIN_PASSWORD': 'bootstrap-test-password'}):
            response = self.client.post('/auth/login', json={'email': 'test@example.com', 'password': 'bootstrap-test-password'})
        self.assertEqual(response.status_code, 401, response.text)
        with self.sessions() as db:
            self.assertEqual(db.get(UserProfile, 'normal-user').role, 'operations_staff')

    def test_admin_password_survives_restart(self):
        from app.seed import seed_super_admin, SUPERADMIN_EMAIL
        from app.auth import hash_password, verify_password
        from app.models import UserProfile
        with self.sessions() as db:
            db.add(UserProfile(id='existing-admin-id', email=SUPERADMIN_EMAIL, display_name='Admin',
                               role='super_admin', status='active', password_hash=hash_password('changed-admin-password')))
            db.commit()
            with patch.dict(os.environ, {'BOOTSTRAP_ADMIN_PASSWORD': 'obsolete-bootstrap-password'}):
                seed_super_admin(db)
            profile = db.query(UserProfile).filter_by(email=SUPERADMIN_EMAIL).one()
            self.assertEqual(profile.id, 'existing-admin-id')
            self.assertTrue(verify_password('changed-admin-password', profile.password_hash))
            self.assertFalse(verify_password('obsolete-bootstrap-password', profile.password_hash))

    def test_saved_defaults_apply_only_when_not_explicit(self):
        from app.routers.b2b import b2b_router, create_b2b_company
        self.app.include_router(b2b_router)
        dependency = inspect.signature(create_b2b_company).parameters['ctx'].default.dependency
        self.app.dependency_overrides[dependency] = lambda: CTX
        with self.sessions() as db:
            row = db.get(SystemSettings, 1)
            row.config_json = {**row.config_json, 'defaultGstRate': 12, 'serviceTypes': ['Custom Express'],
                               'defaultB2BCreditLimit': 25000, 'defaultB2BCreditDays': 45}
            db.commit()
        company = {'company_name': 'Default Company', 'contact_person': 'Test', 'mobile': '9000000001'}
        result = self.client.post('/api/b2b/companies', json=company)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['credit_limit'], 25000)
        self.assertEqual(result.json()['credit_period_days'], 45)
        self.assertEqual(result.json()['payment_terms'], 'Net 45 Days')
        explicit = self.client.post('/api/b2b/companies', json={**company, 'company_name': 'Explicit Company',
                                    'credit_limit': 0, 'credit_period_days': 7, 'payment_terms': 'Weekly'})
        self.assertEqual(explicit.json()['credit_limit'], 0)
        self.assertEqual(explicit.json()['credit_period_days'], 7)
        payload = {'awb': 'CUSTOM-DEFAULT', 'date': '2026-09-16', 'customer_name': 'Test', 'customer_mobile': '9000000001',
                   'receiver': {'name': 'Receiver', 'city': 'Delhi', 'country': 'India'}, 'parcel': {'actual_weight': 2},
                   'courier': 'Aramex', 'provider_type': 'postpaid', 'provider_name': 'Aramex', 'price': 1000,
                   'provider_cost': 600, 'payment_status': 'Unpaid'}
        result = self.client.post('/api/shipments', json=payload, headers={'Idempotency-Key': 'custom-default-test-001'})
        self.assertEqual(result.status_code, 200, result.text)
        with self.sessions() as db:
            shipment = db.query(Shipment).filter_by(awb='CUSTOM-DEFAULT').one()
            self.assertEqual(shipment.gst_rate, 12)
            self.assertEqual(shipment.service_type, 'Custom Express')
            self.assertEqual(db.query(Invoice).filter_by(shipment_id=shipment.id).one().total, 1120)

    def test_custom_weight_policy_is_applied_and_preserved(self):
        with self.sessions() as db:
            cfg = db.get(SystemSettings, 1)
            cfg.config_json = {**cfg.config_json, 'weightRules': {'express': {'divisor': 6000, 'aggregation': 'box', 'rounding': .5}}}
            db.commit()
        payload = {'awb': 'WEIGHT-POLICY', 'date': '2026-09-16', 'customer_name': 'Test Customer',
                   'customer_mobile': '9000000001', 'receiver': {'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
                   'parcel': {'boxes': [{'length': 40, 'width': 30, 'height': 20, 'actual_weight': 3},
                                        {'length': 10, 'width': 10, 'height': 10, 'actual_weight': 5.1}]},
                   'courier': 'Aramex', 'provider_type': 'postpaid', 'provider_name': 'Aramex',
                   'price': 1000, 'provider_cost': 600, 'payment_status': 'Unpaid'}
        result = self.client.post('/api/shipments', json=payload, headers={'Idempotency-Key': 'weight-policy-test-001'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['chargeable_weight'], 9.5)
        self.assertEqual(result.json()['weight_rule']['divisor'], 6000)
        with self.sessions() as db:
            cfg = db.get(SystemSettings, 1)
            cfg.config_json = {**cfg.config_json, 'weightRules': {'express': {'divisor': 3000}}}
            db.commit()
            shipment = db.query(Shipment).filter_by(awb='WEIGHT-POLICY').one()
            self.assertEqual(shipment.weight_rule['divisor'], 6000)
            self.assertEqual(shipment.chargeable_weight, 9.5)
