"""Repeatable local API benchmark. Always uses a disposable SQLite database."""
import argparse
import datetime
import json
import os
from pathlib import Path
import statistics
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shipments", type=int, default=3000)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--output")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="fmc-perf-") as directory:
        os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(directory) / "benchmark.db").replace("\\", "/")
        os.environ["DEBUG"] = "false"
        os.environ["STORAGE_PROVIDER"] = "local"
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from fastapi.testclient import TestClient
        from sqlalchemy import event
        from app.main import app
        from app.database import Base, engine, SessionLocal
        from app.models import Customer, Shipment, Invoice, PaymentCollection, UserProfile
        from app.seed import seed_database
        from app.auth import create_app_session
        from app.cache import cache_engine

        Base.metadata.create_all(engine)
        today = datetime.date.today().isoformat()
        customer_count = max(1, args.shipments // 10)
        with SessionLocal() as db:
            seed_database(db)
            db.bulk_insert_mappings(Customer, [dict(id=f"perf-c-{i}", name=f"Customer {i}", mobile=f"910{i:09}", customer_type="B2B" if i % 3 == 0 else "C2C") for i in range(customer_count)])
            shipments, invoices, payments = [], [], []
            for i in range(args.shipments):
                customer_id = f"perf-c-{i % customer_count}"
                shipments.append(dict(id=f"perf-s-{i}", awb=f"PERF{i:08}", date=today,
                    customer_id=customer_id, customer_name=f"Customer {i % customer_count}", customer_type="B2B" if i % 3 == 0 else "C2C",
                    receiver_name="Receiver", receiver_city="Delhi", receiver_country="India",
                    courier="Aramex", provider_name="Aramex", provider_type="postpaid", price=1000,
                    provider_cost=600, actual_provider_cost=600, gross_profit=400, payment_status="Partial"))
                invoices.append(dict(id=f"perf-i-{i}", invoice_no=f"PERFINV{i:08}", date=today,
                    customer_id=customer_id, customer_name=f"Customer {i % customer_count}", shipment_id=f"perf-s-{i}",
                    awb=f"PERF{i:08}", amount=1000, total=1000, paid=200, balance=800, status="Partial"))
                payments.append(dict(id=f"perf-p-{i}", invoice_id=f"perf-i-{i}", shipment_id=f"perf-s-{i}",
                    date=today, amount=200, payment_method="Cash", paid_to="Drawer", collected_by="Staff"))
            db.bulk_insert_mappings(Shipment, shipments)
            db.bulk_insert_mappings(Invoice, invoices)
            db.bulk_insert_mappings(PaymentCollection, payments)
            db.commit()
            admin = db.query(UserProfile).filter(UserProfile.role == "super_admin").first()
            _, token = create_app_session(db, admin.id, mfa_verified=True)
        counts = {"queries": 0}

        def count_query(*_):
            counts["queries"] += 1
        event.listen(engine, "before_cursor_execute", count_query)
        results = {}
        client = TestClient(app, headers={"Authorization": f"Bearer {token}"})
        routes = ["/api/dashboard/summary", "/api/customers/", "/api/shipments/", "/api/accounts/summary", "/api/b2b/summary", "/api/auth/me", "/api/search/?q=PERF0000"]
        for route in routes:
            timings, queries = [], []
            for _ in range(args.repeats):
                cache_engine.clear()
                counts["queries"] = 0
                start = time.perf_counter()
                response = client.get(route)
                elapsed = (time.perf_counter() - start) * 1000
                if response.status_code != 200:
                    raise RuntimeError(f"{route}: {response.status_code} {response.text[:200]}")
                timings.append(elapsed)
                queries.append(counts["queries"])
            results[route] = {"median_ms": round(statistics.median(timings), 2), "median_queries": statistics.median(queries), "response_bytes": len(response.content)}
        client.close()
        event.remove(engine, "before_cursor_execute", count_query)
        engine.dispose()
        report = {"database": "disposable SQLite", "shipments": args.shipments, "customers": customer_count, "repeats": args.repeats, "cache": "cleared before every request", "routes": results}
        output = json.dumps(report, indent=2)
        print(output)
        if args.output:
            Path(args.output).write_text(output + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
