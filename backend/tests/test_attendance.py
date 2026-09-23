"""Tests for Attendance Router and Analytics."""
import os
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import unittest
import inspect
import datetime
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import AttendanceRecord
from app.routers.attendance import (
    attendance_router,
    get_attendance_summary,
    get_attendance_events,
    get_daily_breakdown,
    record_punch,
    get_staff_list
)

CTX = {
    'user_id': 'test-admin',
    'display_name': 'Test Admin',
    'is_super_admin': True,
    'permissions': {'*': True}
}

class AttendanceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.app = FastAPI()
        self.app.include_router(attendance_router)

        def db_override():
            with self.sessions() as db:
                yield db

        self.app.dependency_overrides[get_db] = db_override

        for endpoint in (get_attendance_summary, get_attendance_events, get_daily_breakdown, record_punch, get_staff_list):
            params = inspect.signature(endpoint).parameters
            if 'ctx' in params and params['ctx'].default is not inspect._empty:
                dep = params['ctx'].default.dependency
                self.app.dependency_overrides[dep] = lambda: CTX

        self.client = TestClient(self.app, follow_redirects=False)

        # Seed initial records for testing
        with self.sessions() as db:
            db.add(AttendanceRecord(
                id="att_1",
                staff_name="Deepthi M N",
                staff_email="deepthi@flymycart.com",
                date="2026-09-22",
                event="LOGIN",
                time="09:21:52 AM",
                timestamp=datetime.datetime.fromisoformat("2026-09-22T09:21:52"),
                photo_url="/test.jpg"
            ))
            # Completed day for Lissabeth on 21 Sep
            db.add(AttendanceRecord(
                id="att_2",
                staff_name="Lissabeth Babu",
                staff_email="lissabeth@flymycart.com",
                date="2026-09-21",
                event="LOGIN",
                time="09:20:00 AM",
                timestamp=datetime.datetime.fromisoformat("2026-09-21T09:20:00"),
                photo_url="/test.jpg"
            ))
            db.add(AttendanceRecord(
                id="att_3",
                staff_name="Lissabeth Babu",
                staff_email="lissabeth@flymycart.com",
                date="2026-09-21",
                event="LUNCH START",
                time="01:30:00 PM",
                timestamp=datetime.datetime.fromisoformat("2026-09-21T13:30:00"),
                photo_url="/test.jpg"
            ))
            db.add(AttendanceRecord(
                id="att_4",
                staff_name="Lissabeth Babu",
                staff_email="lissabeth@flymycart.com",
                date="2026-09-21",
                event="LUNCH END",
                time="02:00:00 PM",
                timestamp=datetime.datetime.fromisoformat("2026-09-21T14:00:00"),
                photo_url="/test.jpg"
            ))
            db.add(AttendanceRecord(
                id="att_5",
                staff_name="Lissabeth Babu",
                staff_email="lissabeth@flymycart.com",
                date="2026-09-21",
                event="LOGOUT",
                time="06:10:00 PM",
                timestamp=datetime.datetime.fromisoformat("2026-09-21T18:10:00"),
                photo_url="/test.jpg"
            ))
            db.commit()

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_staff_list(self):
        res = self.client.get("/api/attendance/staff-list")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data["staff"]), 2)
        names = data["staff"]
        self.assertIn("Deepthi M N", names)
        self.assertIn("Lissabeth Babu", names)

    def test_attendance_summary(self):
        res = self.client.get("/api/attendance/summary?date_from=2026-09-22&date_to=2026-09-22&expected_login=09:00 AM&grace_period_min=15")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("present_days", data)
        self.assertIn("staff_summaries", data)
        self.assertEqual(data["present_days"], 1)
        self.assertEqual(data["late_days"], 1)  # 09:21:52 is past 09:15

    def test_attendance_events(self):
        res = self.client.get("/api/attendance/events?date_from=2026-09-21&date_to=2026-09-22")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("events", data)
        self.assertGreaterEqual(len(data["events"]), 5)

    def test_daily_breakdown(self):
        res = self.client.get("/api/attendance/daily-breakdown?date_from=2026-09-21&date_to=2026-09-21&expected_login=09:00 AM&expected_logout=06:00 PM&expected_work_min=480&grace_period_min=15")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("entries", data)
        entry = next(e for e in data["entries"] if e["staff_name"] == "Lissabeth Babu")
        self.assertEqual(entry["logout_time"], "06:10:00 PM")
        self.assertEqual(entry["logout_diff"], "✓ on time")

    def test_punch_flow(self):
        payload = {
            "staff_name": "Deepthi M N",
            "event": "LOGOUT",
            "notes": "Testing punch logout"
        }
        res = self.client.post("/api/attendance/punch", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("id", data)
