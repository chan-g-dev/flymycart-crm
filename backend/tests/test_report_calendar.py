import os
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.routers.reports import get_weekly_operations_report, get_range_report
from datetime import date

class ReportCalendarTests(unittest.TestCase):
    def report(self, selected, start=None):
        db = MagicMock()
        db.query.return_value.filter.return_value.group_by.return_value.all.return_value = []
        with patch('app.routers.reports.expense_summary', return_value=(0, {})):
            return get_weekly_operations_report(selected, {}, db, start)

    def test_calendar_week_and_boundaries(self):
        for selected, start, end in [
            ('2026-09-17', '2026-09-14', '2026-09-20'),
            ('2026-09-13', '2026-09-07', '2026-09-13'),
            ('2026-09-14', '2026-09-14', '2026-09-20'),
            ('2027-01-01', '2026-12-28', '2027-01-03'),
        ]:
            with self.subTest(selected=selected):
                result = self.report(selected)
                self.assertEqual((result['period_start'], result['period_end']), (start, end))
                self.assertEqual(len(result['daily']), 7)
                self.assertEqual(result['daily'][0]['date'], start)
                self.assertEqual(result['daily'][-1]['date'], end)

    def test_custom_range_preserved(self):
        result = self.report('2026-09-17', '2026-09-11')
        self.assertEqual(result['period_start'], '2026-09-11')
        self.assertEqual(result['period_end'], '2026-09-17')

    def test_default_uses_ist_business_day(self):
        with patch('app.routers.reports.business_today', return_value=date(2026, 9, 14)):
            self.assertEqual(self.report(None)['period_start'], '2026-09-14')

    def test_invalid_date_rejected(self):
        with self.assertRaises(HTTPException):
            self.report('invalid')
