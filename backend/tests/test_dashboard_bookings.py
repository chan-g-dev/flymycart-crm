import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
import unittest
from datetime import date
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import Session
from app.routers.dashboard import booking_trend
from app.routers.dashboard import get_dashboard_summary
from app.database import Base
from app.models import Followup

class DashboardBookingsTests(unittest.TestCase):
    def test_summary_combines_followup_counts_and_only_queries_entity_totals_once(self):
        engine = create_engine('sqlite://')
        Base.metadata.create_all(engine)
        statements = []
        def capture(connection, cursor, statement, parameters, context, executemany):
            statements.append(statement)
        event.listen(engine, 'before_cursor_execute', capture)
        try:
            with Session(engine) as db:
                db.add_all([
                    Followup(customer='Due', due_date='2000-01-01', status='Pending'),
                    Followup(customer='Upcoming', due_date='2999-01-01', status='Pending'),
                    Followup(customer='Done', due_date='2000-01-01', status='Done'),
                ])
                db.commit()
                statements.clear()
                result = get_dashboard_summary({'is_super_admin': True, 'permissions': {'*': True}}, db)
                self.assertEqual((result['followups_pending'], result['followups_due'], result['followups_upcoming']), (2, 1, 1))
                self.assertEqual(result['total_sales_with_gst'], 0)
                self.assertEqual(result['entity_summaries'], {})
                self.assertEqual(sum('FROM followups' in sql for sql in statements), 1)
                self.assertEqual(sum('GROUP BY coalesce(shipments.entity' in sql for sql in statements), 1)
                db.query(Followup).delete()
                db.commit()
                empty = get_dashboard_summary({'is_super_admin': True, 'permissions': {'*': True}}, db)
                self.assertEqual((empty['followups_pending'], empty['followups_due'], empty['followups_upcoming']), (0, 0, 0))
        finally:
            engine.dispose()

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
