"""Calendar dates for Indian courier operations, independent of server timezone."""
from datetime import datetime, timedelta, timezone

BUSINESS_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def business_today(now=None):
    """Keep business dates in IST; authentication and audit timestamps remain UTC."""
    instant = now if now is not None else datetime.now(timezone.utc)
    if instant.tzinfo is None:
        raise ValueError("Expected a timezone-aware instant")
    return instant.astimezone(BUSINESS_TIMEZONE).date()
