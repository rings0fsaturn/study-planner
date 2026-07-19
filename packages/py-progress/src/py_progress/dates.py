from __future__ import annotations

from datetime import UTC, datetime, timedelta


def parse_date_only(date_str: str) -> datetime:
    """Parse YYYY-MM-DD like JavaScript ``new Date(dateStr)`` (month/day overflow)."""
    year, month, day = map(int, date_str.split("-"))
    return datetime(year, month, 1, tzinfo=UTC) + timedelta(days=day - 1)


def date_to_ms(date_str: str) -> float:
    return parse_date_only(date_str).timestamp() * 1000
