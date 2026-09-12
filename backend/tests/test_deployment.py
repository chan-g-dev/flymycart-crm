"""Run with DATABASE_URL=sqlite:///:memory:; no application lifespan or data writes."""
import unittest
from datetime import datetime
from fastapi.testclient import TestClient
from app.business_dates import business_today
from app.main import app


class DeploymentTests(unittest.TestCase):
    def test_business_day_rollover(self):
        for instant, expected in [
            ("2026-09-30T18:29:59+00:00", "2026-09-30"),
            ("2026-09-30T18:30:00+00:00", "2026-10-01"),
            ("2026-12-31T18:30:00+00:00", "2027-01-01"),
        ]:
            self.assertEqual(business_today(datetime.fromisoformat(instant)).isoformat(), expected)

    def test_collection_requests_do_not_redirect_out_of_proxy(self):
        client = TestClient(app, base_url="https://api.example.com", follow_redirects=False)
        for path, methods in [("customers", ["GET", "POST"]),
                              ("shipments", ["GET", "POST"]), ("invoices", ["GET"])]:
            for method in methods:
                for suffix in ("", "/"):
                    with self.subTest(path=path, method=method, suffix=suffix):
                        response = client.request(method, f"/api/{path}{suffix}")
                        self.assertIn(response.status_code, (401, 403))
                        self.assertNotIn("location", response.headers)
