from __future__ import annotations

from app.ingestion.cleaning import clean_text


def test_clean_text_collapses_line_endings_and_blank_lines() -> None:
    raw = "Line one\r\n\r\n\r\n   Line two  \r\nLine three"
    assert clean_text(raw) == "Line one\n\nLine two\nLine three"


def test_clean_text_collapses_runs_of_spaces() -> None:
    assert clean_text("a    b   c") == "a b c"


def test_clean_text_strips_zero_width_characters() -> None:
    assert clean_text("a\u200bb\u200cc") == "abc"


def test_clean_text_normalizes_unicode_nfc() -> None:
    assert clean_text("cafe\u0301") == "café"


def test_clean_text_trims_outer_whitespace() -> None:
    assert clean_text("  \n  hello  \n  ") == "hello"


def test_clean_text_empty_input() -> None:
    assert clean_text("") == ""
    assert clean_text("   \n  ") == ""
