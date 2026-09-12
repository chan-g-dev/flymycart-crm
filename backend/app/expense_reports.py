"""Shared date-filtered expense totals; carrier payouts and deposits are excluded."""
from sqlalchemy import func
from app.models import AccountingEntry


def expense_summary(db, start, end):
    category = func.coalesce(func.nullif(AccountingEntry.category, ""), "General")
    rows = db.query(category, func.sum(AccountingEntry.amount)).filter(
        AccountingEntry.kind == "expense", AccountingEntry.date.between(start, end)
    ).group_by(category).order_by(category).all()
    breakdown = {name: round(float(amount or 0), 2) for name, amount in rows}
    return round(sum(breakdown.values()), 2), breakdown
