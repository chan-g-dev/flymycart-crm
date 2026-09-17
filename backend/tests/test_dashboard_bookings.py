import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
import unittest
from datetime import date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.routers.dashboard import booking_trend

class DashboardBookingsTests(unittest.TestCase):
    def test_full_counts_centers_empty_days_and_calendar_boundaries(self):
        engine = create_engine("sqlite://")
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE shipments (id TEXT, date TEXT, center TEXT)"))
            rows = [{"id": str(i), "date": "2026-09-17", "center": "Main"} for i in range(15)]
            rows += [{"id": "other", "date": "2026-09-17", "center": "Branch"},
                     {"id": "last", "date": "2026-09-07", "center": "Main"},
                     {"id": "outside", "date": "2026-09-06", "center": "Main"}]
            connection.execute(text("INSERT INTO shipments VALUES (:id, :date, :center)"), rows)
        with Session(engine) as db:
            result = booking_trend(db, date(2026, 9, 17))
            self.assertEqual(len(result), 14)
            self.assertEqual(result[0], {"date": "2026-09-07", "centers": {"Main": 1}})
            self.assertEqual(result[-1], {"date": "2026-09-20", "centers": {}})
            self.assertEqual(result[10]["centers"], {"Main": 15, "Branch": 1})
            self.assertEqual(sum(sum(day["centers"].values()) for day in result), 17)
            self.assertEqual(booking_trend(db, date(2027, 1, 1))[7]["date"], "2026-12-28")
        engine.dispose()
