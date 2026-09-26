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
from app.models import AttendanceRecord, SystemSettings, UserProfile
from app.routers.attendance import (
    attendance_router,
    get_attendance_summary,
    get_attendance_events,
    get_daily_breakdown,
    record_punch,
    record_bulk_punch,
    create_leave_request,
    cancel_leave_request,
    get_leave_requests,
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

        for endpoint in (get_attendance_summary, get_attendance_events, get_daily_breakdown, record_punch, record_bulk_punch, create_leave_request, cancel_leave_request, get_leave_requests, get_staff_list):
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

    def test_explicit_manage_denial_cannot_read_or_punch_for_other_staff(self):
        restricted = {**CTX, 'is_super_admin': False, 'display_name': 'Restricted Staff',
                      'permissions': {'attendance.view': True, 'attendance.punch': True, 'attendance.manage': False}}
        for endpoint in (get_attendance_summary, get_attendance_events, get_daily_breakdown, record_punch, get_staff_list):
            dependency = inspect.signature(endpoint).parameters['ctx'].default.dependency
            self.app.dependency_overrides[dependency] = lambda: restricted
        self.assertEqual(self.client.get('/api/attendance/staff-list').json()['staff'], ['Restricted Staff'])
        params = {'date_from': '2026-09-21', 'date_to': '2026-09-21'}
        self.assertEqual(self.client.get('/api/attendance/events', params=params).json()['events'], [])
        self.assertEqual(self.client.get('/api/attendance/daily-breakdown', params=params).json()['entries'], [])
        self.assertEqual(self.client.get('/api/attendance/summary', params=params).json()['total_staff_count'], 1)
        response = self.client.post('/api/attendance/punch', json={
            'staff_name': 'Deepthi M N', 'event': 'LOGIN', 'date': '2026-09-21', 'time': '09:00 AM'})
        self.assertEqual(response.status_code, 201, response.text)
        with self.sessions() as db:
            self.assertEqual(db.get(AttendanceRecord, response.json()['id']).staff_name, 'Restricted Staff')

    def test_staff_list(self):
        res = self.client.get("/api/attendance/staff-list")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(len(data["staff"]), 2)
        names = data["staff"]
        self.assertIn("Deepthi M N", names)
        self.assertIn("Lissabeth Babu", names)

    def test_active_profiles_are_the_roster_source_and_deleted_staff_do_not_reappear(self):
        with self.sessions() as db:
            db.add(UserProfile(id="active-1", email="active@example.com", display_name="Active Staff", role="manager", status="active"))
            db.add(UserProfile(id="archived-1", email="archived@example.com", display_name="Deleted Staff", role="staff", status="archived"))
            db.commit()
        response = self.client.get("/api/attendance/staff-list")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["staff"], ["Active Staff"])

    def test_attendance_summary(self):
        res = self.client.get("/api/attendance/summary?date_from=2026-09-22&date_to=2026-09-22&expected_login=09:00 AM&grace_period_min=15")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("present_days", data)
        self.assertIn("staff_summaries", data)
        self.assertEqual(data["present_days"], 1)
        self.assertEqual(data["late_days"], 1)  # 09:21:52 is past 09:15

    def test_saved_schedule_defaults_drive_late_and_early_status(self):
        with self.sessions() as db:
            db.add(SystemSettings(id=1, config_json={"attendanceSchedule": {
                "expected_login": "10:00", "expected_logout": "19:00",
                "grace_period_min": 0, "expected_work_min": 480,
            }}))
            db.commit()
        summary = self.client.get("/api/attendance/summary?date_from=2026-09-22&date_to=2026-09-22").json()
        self.assertEqual(summary["late_days"], 0)
        breakdown = self.client.get("/api/attendance/daily-breakdown?date_from=2026-09-21&date_to=2026-09-21").json()
        entry = next(item for item in breakdown["entries"] if item["staff_name"] == "Lissabeth Babu")
        self.assertEqual(entry["logout_status"], "early")

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
            "date": "2026-09-22",
            "notes": "Testing punch logout"
        }
        res = self.client.post("/api/attendance/punch", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("id", data)

    def test_rejects_duplicate_and_out_of_order_attendance_actions(self):
        duplicate_login = self.client.post("/api/attendance/punch", json={
            "staff_name": "Deepthi M N", "event": "LOGIN", "date": "2026-09-22"
        })
        self.assertEqual(duplicate_login.status_code, 409)

        lunch_out = self.client.post("/api/attendance/punch", json={
            "staff_name": "Deepthi M N", "event": "LUNCH END", "date": "2026-09-22"
        })
        self.assertEqual(lunch_out.status_code, 409)

    def test_bulk_login_records_every_eligible_staff(self):
        response = self.client.post("/api/attendance/punch-bulk", json={
            "event": "LOGIN", "date": "2026-09-23", "time": "09:00 AM"
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["recorded_count"], 2)
        self.assertEqual(response.json()["skipped_count"], 0)

    def test_manager_can_mark_and_cancel_staff_leave(self):
        created = self.client.post("/api/attendance/leaves", json={
            "staff_name": "Deepthi M N", "leave_type": "Casual",
            "start_date": "2026-09-24", "end_date": "2026-09-24", "reason": "Personal work"
        })
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()["status"], "Approved")

        summary = self.client.get("/api/attendance/summary?date_from=2026-09-24&date_to=2026-09-24").json()
        self.assertEqual(summary["on_leave_days"], 1)
        self.assertEqual(summary["absent_days"], 1)

        punch = self.client.post("/api/attendance/punch", json={
            "staff_name": "Deepthi M N", "event": "LOGIN", "date": "2026-09-24"
        })
        self.assertEqual(punch.status_code, 409)

        cancelled = self.client.delete(f"/api/attendance/leaves/{created.json()['id']}")
        self.assertEqual(cancelled.status_code, 200, cancelled.text)
        self.assertEqual(cancelled.json()["status"], "Cancelled")
