"""Exercise HTTP booking and persistence without connecting to a live database."""
import unittest
import inspect as python_inspect
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models import Shipment, Customer, Invoice, PaymentCollection, WalletTransaction, SystemSettings
from app.routers.shipments import create_shipment
from app.seed import migrate_database_schema


class ShipmentCreationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        def test_db():
            with self.sessions() as db:
                yield db
        self.old_overrides = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = test_db
        permission_dependency = python_inspect.signature(create_shipment).parameters["ctx"].default.dependency
        app.dependency_overrides[permission_dependency] = lambda: {
            "user_id": "test-staff", "display_name": "Test Staff",
            "is_super_admin": True, "permissions": {"*": True}}
        self.client = TestClient(app, follow_redirects=False)
        with self.sessions() as db:
            db.add(SystemSettings(id=1, config_json={"prepaidWallets": [{"name": "ICL", "openingBalance": 10000}]}))
            db.commit()

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.old_overrides)
        self.engine.dispose()

    def payload(self, **overrides):
        return {"awb": "TEST-AWB-001", "date": "2026-09-12", "customer_name": "Test Customer",
                "customer_mobile": "9990000001", "sender": {"name": "Test Customer", "phone": "9990000001"},
                "receiver": {"name": "Test Receiver", "city": "Delhi", "country": "India"},
                "parcel": {"boxes": [{"length": 50, "width": 40, "height": 30, "actual_weight": 2},
                                       {"length": 10, "width": 10, "height": 10, "actual_weight": 1}]},
                "courier": "DHL", "provider_type": "postpaid", "provider_name": "DHL",
                "price": 1000, "provider_cost": 600, "payment_status": "Paid", **overrides}

    def test_booking_payment_variants_and_duplicate(self):
        cases = [("Paid", None, True, "postpaid", 1180, 1180),
                 ("Partial", 400, True, "postpaid", 1180, 400),
                 ("Unpaid", None, True, "postpaid", 1180, 0),
                 ("Paid", None, False, "prepaid", 1000, 1000)]
        for index, (status, received, gst, provider, total, paid) in enumerate(cases):
            with self.subTest(status=status, gst=gst, provider=provider):
                payload = self.payload(awb=f"TEST-{index}", payment_status=status, amount_received=received,
                                       is_gst_applicable=gst, provider_type=provider,
                                       provider_name="ICL" if provider == "prepaid" else "DHL")
                response = self.client.post("/api/shipments", json=payload)
                self.assertEqual(response.status_code, 200, response.text)
                shipment_id = response.json()["id"]
                with self.sessions() as db:
                    shipment = db.get(Shipment, shipment_id)
                    invoice = db.query(Invoice).filter_by(shipment_id=shipment_id).one()
                    self.assertEqual(shipment.packages_count, 2)
                    self.assertAlmostEqual(shipment.chargeable_weight, 12.2)
                    self.assertEqual(invoice.total, total)
                    self.assertEqual(invoice.paid, paid)
                    self.assertEqual(invoice.balance, total-paid)
                    collections = db.query(PaymentCollection).filter_by(shipment_id=shipment_id).all()
                    self.assertEqual(sum(row.amount for row in collections), paid)
                    if provider == "prepaid":
                        self.assertEqual(db.query(WalletTransaction).one().balance_after, 9400)
                duplicate = self.client.post("/api/shipments", json=payload)
                self.assertEqual(duplicate.status_code, 400)
        with self.sessions() as db:
            self.assertEqual(db.query(Customer).count(), 1)
            self.assertEqual(db.query(Shipment).count(), 4)
            self.assertEqual(db.query(Invoice).count(), 4)

    def test_existing_database_migration_then_booking(self):
        columns = {"shipments": ["is_gst_applicable", "gst_rate", "gst_amount", "total_amount"],
                   "invoices": ["is_gst_invoice", "tax_rate", "cgst", "sgst", "igst"]}
        with self.sessions() as db:
            for table, names in columns.items():
                for name in names:
                    db.execute(text(f"ALTER TABLE {table} DROP COLUMN {name}"))
            db.commit()
            migrate_database_schema(db)
            migrate_database_schema(db)
            for table, names in columns.items():
                actual = {c["name"] for c in inspect(db.bind).get_columns(table)}
                self.assertTrue(set(names) <= actual)
        response = self.client.post("/api/shipments", json=self.payload())
        self.assertEqual(response.status_code, 200, response.text)

    def test_invalid_partial_payment_writes_nothing(self):
        response = self.client.post("/api/shipments", json=self.payload(payment_status="Partial", amount_received=0))
        self.assertEqual(response.status_code, 400)
        with self.sessions() as db:
            self.assertEqual(db.query(Customer).count(), 0)
            self.assertEqual(db.query(Shipment).count(), 0)
            self.assertEqual(db.query(Invoice).count(), 0)

    def test_reconciled_shipments_leave_unbilled_count(self):
        from app.routers.accounts import get_accounts_summary
        with self.sessions() as db:
            settings = db.get(SystemSettings, 1)
            settings.config_json = {"postpaidProviders": [{"name": "DHL", "deposit": 0}]}
            db.commit()
        for index in range(2):
            response = self.client.post("/api/shipments", json=self.payload(awb=f"COUNT-{index}"))
            self.assertEqual(response.status_code, 200, response.text)
        ctx = {"is_super_admin": True, "permissions": {"*": True}}
        with self.sessions() as db:
            def account():
                return get_accounts_summary(ctx=ctx, db=db)["postpaid_accounts"][0]
            self.assertEqual(account()["unbilled_shipments_count"], 2)
            self.assertEqual(account()["unbilled_usage"], 1200)
            shipments = db.query(Shipment).all()
            shipments[0].cost_reconciled = True
            db.commit()
            self.assertEqual(account()["unbilled_shipments_count"], 1)
            self.assertEqual(account()["unbilled_usage"], 600)
            shipments[1].cost_reconciled = True
            db.commit()
            self.assertEqual(account()["unbilled_shipments_count"], 0)
            self.assertEqual(account()["unbilled_usage"], 0)
            self.assertEqual(account()["shipments_count"], 2)

    def test_custom_expenses_persist_and_flow_to_reports(self):
        from app.routers.accounts import record_accounting_entry, get_accounts_summary
        from app.routers.reports import get_monthly_pl_report, get_eod_report, get_weekly_operations_report
        dependency = python_inspect.signature(record_accounting_entry).parameters["ctx"].default.dependency
        ctx = {"user_id": "test-staff", "display_name": "Test Staff", "is_super_admin": True, "permissions": {"*": True}}
        app.dependency_overrides[dependency] = lambda: ctx
        with self.sessions() as db:
            settings = db.get(SystemSettings, 1)
            settings.config_json = {"postpaidProviders": [{"name": "DHL", "deposit": 0}]}
            db.commit()
        base = {"date": "2026-09-12", "kind": "expense", "amount": 100,
                "reference": "Test expense", "account": "Cash"}
        for extra in [{"category": "  Packing   Materials "}, {"category": "packing materials", "amount": 50},
                      {"category": "Electricity", "amount": 200}, {},
                      {"category": "Packing Materials", "date": "2026-08-12", "amount": 999},
                      {"kind": "provider_payment", "provider": "DHL", "category": "Ignore", "amount": 500}]:
            response = self.client.post("/api/accounts/entries", json={**base, **extra})
            self.assertEqual(response.status_code, 201, response.text)
        invalid = self.client.post("/api/accounts/entries", json={**base, "category": "   "})
        self.assertEqual(invalid.status_code, 422)
        with self.sessions() as db:
            summary = get_accounts_summary(ctx=ctx, db=db)
            self.assertEqual(summary["expense_categories"], ["Electricity", "General", "Packing Materials"])
            reports = [get_monthly_pl_report("2026-09", ctx, db), get_eod_report("2026-09-12", ctx, db),
                       get_weekly_operations_report("2026-09-12", ctx, db)]
            for report in reports:
                self.assertEqual(report["operational_expenses"], 450)
                self.assertEqual(report["expense_breakdown"], {"Electricity": 200, "General": 100, "Packing Materials": 150})
            self.assertEqual(reports[0]["net_profit"], -450)
            self.assertEqual(reports[1]["net_profit"], -450)
            restricted = get_eod_report("2026-09-12", {"permissions": {}}, db)
            self.assertEqual(restricted["expense_breakdown"], {})
            self.assertIsNone(restricted["operational_expenses"])

    def test_expense_category_migration_preserves_old_entries(self):
        from app.models import AccountingEntry
        with self.sessions() as db:
            db.add(AccountingEntry(date="2026-09-12", kind="expense", amount=100,
                                   reference="Legacy", account="Cash", created_by="test-staff"))
            db.commit()
            db.execute(text("ALTER TABLE accounting_entries DROP COLUMN category"))
            db.commit()
            migrate_database_schema(db)
            migrate_database_schema(db)
            row = db.query(AccountingEntry).one()
            self.assertEqual(row.amount, 100)
            self.assertIsNone(row.category)
