"""Cross-module money checks against a fresh, isolated database."""
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
from app.models import SystemSettings
from app.business_dates import business_today
from app.routers.customers import customers_router
from app.routers.shipments import shipments_router
from app.routers.invoices import invoices_router
from app.routers.accounts import accounts_router
from app.routers.dashboard import dashboard_router
from app.routers.reports import reports_router
from app.routers.reconciliation import reconciliation_router
from app.routers.refunds import refunds_router
from app.routers.b2b import b2b_router


class FinancialLinkageTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        sessions = sessionmaker(bind=self.engine)
        self.app = FastAPI()
        for router in (customers_router, shipments_router, accounts_router, dashboard_router,
                       reports_router, reconciliation_router, b2b_router):
            self.app.include_router(router)
        for router in (invoices_router, refunds_router):
            self.app.include_router(router, prefix='/api')
        ctx = {'user_id': 'qa-admin', 'display_name': 'QA Admin', 'status': 'active', 'is_super_admin': True, 'permissions': {'*': True}}
        from app.dependencies import get_current_session_context
        self.app.dependency_overrides[get_current_session_context] = lambda: ctx
        for route in self.app.routes:
            if not hasattr(route, 'endpoint'):
                continue
            param = inspect.signature(route.endpoint).parameters.get('ctx')
            if param and hasattr(param.default, 'dependency'):
                self.app.dependency_overrides[param.default.dependency] = lambda: ctx
        def database():
            with sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = database
        with sessions() as db:
            db.add(SystemSettings(id=1, config_json={'postpaidProviders': [{'name': 'Aramex', 'deposit': 0}],
                'prepaidWallets': [{'name': 'ICL', 'openingBalance': 0}], 'paidToAccounts': ['QA Cash', 'QA Bank']}))
            db.commit()
        self.client = TestClient(self.app)
        self.today = business_today().isoformat()
        self.cash = {'owner_type': 'Business', 'account_holder': 'QA Office'}
        self.customer = self.call('POST', '/api/customers', {'name': 'Link Test', 'mobile': '9000000091'})

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def call(self, method, url, payload=None, expected=200, **kwargs):
        response = self.client.request(method, url, json=payload, **kwargs)
        self.assertEqual(response.status_code, expected, response.text)
        return response.json()

    def booking(self, awb='LINK-1', price=1000, cost=600, **changes):
        return self.call('POST', '/api/shipments', {'awb': awb, 'date': self.today,
            'customer_id': self.customer['id'], 'customer_name': self.customer['name'],
            'customer_mobile': self.customer['mobile'], 'customer_type': 'C2C',
            'receiver': {'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
            'parcel': {'actual_weight': 1}, 'courier': 'Aramex', 'provider_type': 'postpaid',
            'provider_name': 'Aramex', 'price': price, 'provider_cost': cost, 'payment_status': 'Unpaid',
            'payment_method': 'Cash', 'paid_to': 'QA Cash', 'collected_by': 'QA Admin',
            'payment_details': self.cash, **changes})

    def payment(self, invoice, amount, key='link-payment-retry-001'):
        return self.call('POST', f"/api/invoices/{invoice['id']}/payments", {'amount': amount,
            'payment_method': 'Cash', 'paid_to': 'QA Cash', 'collected_by': 'QA Admin',
            'payment_details': self.cash}, headers={'Idempotency-Key': key})

    def entry(self, kind, amount, **extra):
        return self.call('POST', '/api/accounts/entries', {'kind': kind, 'amount': amount,
            'date': self.today, 'account': 'QA Cash', 'payment_mode': 'Cash', 'payment_details': self.cash,
            **extra}, expected=201)

    def assert_totals(self, sales, billed, collected, pending, cost, expenses=0, refunds=0):
        dashboard = self.call('GET', '/api/dashboard/summary')
        accounts = self.call('GET', '/api/accounts/summary')
        overview = self.call('GET', '/api/accounts/overview')['totals']
        eod = self.call('GET', '/api/reports/eod')
        monthly = self.call('GET', '/api/reports/monthly')
        weekly = self.call('GET', '/api/reports/weekly')['daily']
        receipts = self.call('GET', f'/api/accounts/receipts?date_from={self.today}&date_to={self.today}')
        invoices = self.call('GET', '/api/invoices')
        customer = self.call('GET', '/api/customers')[0]
        profile = self.call('GET', f"/api/customers/{self.customer['id']}/360")
        for actual in (dashboard['total_sales'], accounts['total_sales'], overview['sales'],
                       eod['total_sales'], monthly['revenue'], sum(d['revenue'] for d in weekly)):
            self.assertAlmostEqual(actual, sales)
        for actual in (dashboard['total_sales_with_gst'], accounts['total_sales_with_gst'], overview['gross_sales'],
                       eod['invoice_total'], monthly['invoice_total'], sum(i['total'] for i in invoices), customer['total_spend'], profile['total_spent']):
            self.assertAlmostEqual(actual, billed)
        for actual in (dashboard['total_collected'], dashboard['today_collected'], accounts['total_collected'],
                       overview['collected'], eod['total_collected'], receipts['total_amount'], sum(i['paid'] for i in invoices)):
            self.assertAlmostEqual(actual, collected)
        for actual in (dashboard['pending_collection'], overview['pending'], eod['pending_collection'],
                       customer['outstanding_balance'], profile['outstanding_balance'], sum(i['balance'] for i in invoices),
                       accounts['pending_collection'] + accounts['b2b_credit_sales']):
            self.assertAlmostEqual(actual, pending)
        for actual in (dashboard['total_provider_cost'], accounts['total_courier_cost'], overview['cost'], monthly['total_actual_cost']):
            self.assertAlmostEqual(actual, cost)
        for actual in (overview['net'], eod['net_profit'], monthly['net_profit']):
            self.assertAlmostEqual(actual, sales - cost - expenses - refunds)

    def test_partial_full_b2b_payments_and_retry_link_all_modules(self):
        self.booking(payment_status='Partial', amount_received=200)
        self.booking('LINK-2', 500, 300, payment_status='Paid')
        self.booking('LINK-3', 2000, 1200, customer_type='B2B', payment_status='B2B Credit')
        self.assert_totals(3500, 4130, 790, 3340, 2100)
        invoice = next(i for i in self.call('GET', '/api/invoices') if i['awb'] == 'LINK-1')
        self.payment(invoice, 300)
        self.payment(invoice, 300)
        self.assert_totals(3500, 4130, 1090, 3040, 2100)
        self.payment(invoice, 680, 'link-final-payment-001')
        self.assert_totals(3500, 4130, 1770, 2360, 2100)
        shipments = {s['awb']: s for s in self.call('GET', '/api/shipments')}
        self.assertEqual(shipments['LINK-1']['payment_status'], 'Paid')
        self.assertEqual(self.call('GET', '/api/b2b/summary')['outstanding'], 2360)
        failed = self.client.post(f"/api/invoices/{invoice['id']}/payments", json={'amount': 1,
            'payment_method': 'Cash', 'paid_to': 'QA Cash', 'collected_by': 'QA Admin', 'payment_details': self.cash})
        self.assertEqual(failed.status_code, 400)
        self.assert_totals(3500, 4130, 1770, 2360, 2100)

    def test_expense_carrier_payment_transfer_wallet_and_refund_do_not_double_count(self):
        ship = self.booking(payment_status='Paid')
        self.entry('expense', 50, category='Packing', vendor='QA Supplier', shipment_id=ship['id'])
        self.call('POST', '/api/reconciliation/apply', {'provider': 'Aramex',
            'matched': [{'awb': 'LINK-1', 'current_cost': 600, 'actual_cost': 650}]})
        self.entry('provider_payment', 650, provider='Aramex')
        self.entry('provider_deposit', 75, provider='Aramex')
        self.entry('transfer', 100, transfer_to='QA Bank')
        self.call('POST', '/api/accounts/wallets/recharge', {'wallet': 'ICL', 'date': self.today,
            'amount': 200, 'paid_from': 'QA Cash', 'payment_method': 'Cash', 'payment_details': self.cash})
        refund = self.call('POST', '/api/refunds', {'customer_id': self.customer['id'],
            'customer': self.customer['name'], 'awb': 'LINK-1', 'amount': 25, 'reason': 'QA adjustment'})
        self.call('PATCH', f"/api/refunds/{refund['id']}/status", {'status': 'Approved'})
        self.assert_totals(1000, 1180, 1180, 0, 650, expenses=50, refunds=25)
        self.call('PATCH', f"/api/refunds/{refund['id']}/status", {'status': 'Refunded',
            'refund_method': 'Cash', 'account': 'QA Cash', 'payment_details': self.cash})
        self.assert_totals(1000, 1180, 1180, 0, 650, expenses=50, refunds=25)
        overview = self.call('GET', '/api/accounts/overview')
        bank = {a['name']: a['recorded_balance'] for a in overview['bank_accounts']}
        self.assertEqual(bank['QA Cash'], 80)
        self.assertEqual(bank['QA Bank'], 100)
        summary = self.call('GET', '/api/accounts/summary')
        self.assertEqual(summary['prepaid_wallets'][0]['current_balance'], 200)
        self.assertEqual(summary['postpaid_accounts'][0]['net_payable'], 0)
        self.assertEqual(summary['postpaid_accounts'][0]['deposit'], 75)
        ledger = self.call('GET', '/api/accounts/shipment-ledger')['items'][0]
        self.assertEqual(ledger['value'], 300)
        self.assertEqual(ledger['courier_status'], 'Paid')

    def test_carrier_status_consistent_before_reconciliation(self):
        self.booking()
        self.entry('provider_payment', 600, provider='Aramex')
        ship = self.call('GET', '/api/shipments')[0]
        ledger = self.call('GET', '/api/accounts/shipment-ledger')['items'][0]
        self.assertEqual(ship['carrier_payment_status'], ledger['courier_status'])

    def test_paise_and_non_gst_invoice_settlement(self):
        self.booking(price=100.01, cost=60.01, payment_status='Partial', amount_received=0.01)
        self.booking('LINK-NO-GST', 50.01, 20, is_gst_applicable=False, payment_status='Paid')
        self.assert_totals(150.02, 168.02, 50.02, 118, 80.01)
        invoice = next(i for i in self.call('GET', '/api/invoices') if i['awb'] == 'LINK-1')
        self.payment(invoice, 118)
        self.assert_totals(150.02, 168.02, 168.02, 0, 80.01)

    def test_older_booking_collected_today_uses_payment_date(self):
        import datetime as dt
        yesterday = (business_today() - dt.timedelta(days=1)).isoformat()
        self.booking(date=yesterday)
        invoice = self.call('GET', '/api/invoices')[0]
        self.payment(invoice, 180)
        dashboard = self.call('GET', '/api/dashboard/summary')
        self.assertEqual(dashboard['today_sales'], 0)
        self.assertEqual(dashboard['today_collected'], 180)
        today = self.call('GET', f'/api/accounts/overview?date_from={self.today}&date_to={self.today}')['totals']
        self.assertEqual(today['sales'], 0)
        self.assertEqual(today['collected'], 180)
        self.assertEqual(self.call('GET', '/api/reports/eod')['total_collected'], 180)
        self.assertEqual(self.call('GET', f'/api/reports/eod?date={yesterday}')['total_collected'], 0)
        self.assertEqual(self.call('GET', '/api/customers')[0]['outstanding_balance'], 1000)

    def test_prepaid_usage_reduces_wallet_without_second_expense(self):
        self.call('POST', '/api/accounts/wallets/recharge', {'wallet': 'ICL', 'date': self.today,
            'amount': 1000, 'paid_from': 'QA Cash', 'payment_method': 'Cash', 'payment_details': self.cash})
        self.booking(provider_type='prepaid', provider_name='ICL', courier='ICL', payment_status='Paid')
        self.assert_totals(1000, 1180, 1180, 0, 600)
        summary = self.call('GET', '/api/accounts/summary')
        wallet = summary['prepaid_wallets'][0]
        self.assertEqual(wallet['current_balance'], 400)
        self.assertEqual(wallet['total_usage'], 600)
        cash = next(a for a in self.call('GET', '/api/accounts/overview')['bank_accounts'] if a['name'] == 'QA Cash')
        self.assertEqual(cash['recorded_balance'], 180)

    def test_dashboard_filters_use_full_history_and_collection_dates(self):
        import datetime as dt
        yesterday = (business_today() - dt.timedelta(days=1)).isoformat()
        for index in range(12):
            self.booking(awb=f'SCOPED-{index}', price=100, cost=20,
                         center='Main Hub (Bangalore)', entity='Globe Courier',
                         domestic_international='Domestic', receiver={'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
                         payment_status='Unpaid')
        older = self.booking(awb='SCOPED-OLDER', price=200, cost=0, date=yesterday,
                             center='Main Hub (Bangalore)', entity='Globe Courier',
                             domestic_international='Domestic', receiver={'name': 'Receiver', 'city': 'Delhi', 'country': 'India'},
                             payment_status='Unpaid')
        invoice = next(i for i in self.call('GET', '/api/invoices') if i['shipment_id'] == older['id'])
        self.call('POST', f"/api/invoices/{invoice['id']}/payments", {
            'amount': 50, 'payment_method': 'Cash', 'payment_details': self.cash,
            'paid_to': 'QA Cash', 'collected_by': 'QA Admin'})
        self.booking(awb='SCOPED-OTHER', price=900, cost=100,
                     center='Delhi Regional Hub', entity='USU Enterprises',
                     domestic_international='International', payment_status='Unpaid')
        result = self.call('GET', '/api/dashboard/summary?center=Main%20Hub%20(Bangalore)&scope=Domestic&entity=Globe%20Courier')
        self.assertEqual(result['today_shipments_count'], 12)
        self.assertEqual(result['total_sales'], 1400)
        self.assertEqual(result['today_collected'], 50)
        self.assertEqual(result['total_collected'], 50)
        self.assertAlmostEqual(result['pending_collection'], 1400 * 1.18 - 50)
        self.assertEqual(result['active_volume'], 13)
        self.assertEqual(result['scope_counts'], {'all': 13, 'dom': 13, 'intl': 0})
        self.assertEqual(result['entity_summaries']['Globe Courier']['total_count'], 13)
        self.assertEqual(sum(sum(day['centers'].values()) for day in result['booking_trend']), 13)
        self.assertEqual(len(result['recent_shipments']), 10)
        empty = self.call('GET', '/api/dashboard/summary?center=No%20Such%20Center')
        self.assertEqual(empty['total_sales'], 0)
        self.assertEqual(empty['today_collected'], 0)
        self.assertEqual(empty['recent_shipments'], [])
        self.call('GET', '/api/dashboard/summary?scope=bad', expected=422)
        self.assertEqual(self.call('GET', '/api/dashboard/summary')['total_sales'], 2300)

    def test_b2b_center_filter_and_failed_database_are_not_zero_success(self):
        from unittest.mock import Mock
        from fastapi import HTTPException
        from app.routers.b2b import _b2b_summary
        self.booking(awb='B2B-MAIN', customer_type='B2B', center='Main Hub (Bangalore)', price=100)
        self.booking(awb='B2B-DELHI', customer_type='B2B', center='Delhi Regional Hub', price=200)
        result = self.call('GET', '/api/b2b/summary?center=Main%20Hub%20(Bangalore)')
        self.assertAlmostEqual(result['total_credit_sales'], 118)
        result = self.call('GET', '/api/b2b/summary?center=Delhi%20Regional%20Hub')
        self.assertAlmostEqual(result['total_credit_sales'], 236)
        db = Mock()
        db.query.side_effect = RuntimeError('database unavailable')
        with self.assertRaises(HTTPException) as raised:
            _b2b_summary(100, 0, {'is_super_admin': True}, db)
        self.assertEqual(raised.exception.status_code, 503)

    def test_shipment_profit_matches_customer_and_dashboard_excluding_gst(self):
        ship = self.booking(awb='PROFIT-CONSISTENCY', price=1000, cost=600)
        self.assertEqual(ship['gross_profit'], 400)
        listed = next(s for s in self.call('GET', '/api/shipments') if s['id'] == ship['id'])
        self.assertEqual(listed['gross_profit'], 400)
        customer = self.call('GET', f"/api/customers/{self.customer['id']}/360")
        self.assertEqual(customer['shipments'][0]['gross_profit'], 400)
        dashboard = self.call('GET', '/api/dashboard/summary')
        self.assertEqual(dashboard['recent_shipments'][0]['gross_profit'], 400)
        self.assertEqual(dashboard['total_gross_profit'], 400)
