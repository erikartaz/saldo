from __future__ import annotations

from datetime import date


def test_month_arithmetic():
    from app.services import add_months, month_bounds, shift_month

    assert add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2025, 12, 15), 1) == date(2026, 1, 15)
    assert shift_month("2025-01", -1) == "2024-12"
    start, end = month_bounds("2025-02")
    assert start == date(2025, 2, 1)
    assert end == date(2025, 3, 1)


def test_next_occurrence_keeps_month_end():
    from app.services import next_occurrence

    assert next_occurrence(date(2025, 1, 31), "monthly", 1) == date(2025, 2, 28)
    assert next_occurrence(date(2025, 1, 1), "weekly", 2) == date(2025, 1, 15)
    assert next_occurrence(date(2025, 1, 1), "yearly", 1) == date(2026, 1, 1)


def test_occurrences_respect_end_date():
    from types import SimpleNamespace

    from app.services import occurrences_between

    rec = SimpleNamespace(
        next_date=date(2025, 1, 15),
        frequency="monthly",
        interval=1,
        end_date=date(2025, 3, 31),
    )
    occurrences = occurrences_between(rec, date(2025, 1, 1), date(2025, 12, 31))
    assert occurrences == [date(2025, 1, 15), date(2025, 2, 15), date(2025, 3, 15)]


def test_cents_roundtrip():
    from app.services import from_cents, to_cents

    assert to_cents(19.99) == 1999
    assert to_cents(0.1 + 0.2) == 30
    assert from_cents(1999) == 19.99
