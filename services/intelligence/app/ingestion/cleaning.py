"""Deterministic text cleaning shared by every extractor."""

from __future__ import annotations

import re
import unicodedata

_ZERO_WIDTH = re.compile("[\u200b\u200c\u200d\ufeff]")
_LINE_ENDING = re.compile(r"\r\n?")
_BLANK_LINES = re.compile(r"\n[ \t]*\n+")
_SPACES = re.compile(r"[ \t]{2,}")


def clean_text(text: str) -> str:
    """Normalize extracted text without changing meaning.

    Strips zero-width characters, normalizes Unicode to NFC, converts line
    endings, collapses runs of blank lines and runs of spaces, and trims every
    line. Paragraph structure is preserved as single blank lines.
    """
    if not text:
        return ""
    normalized = unicodedata.normalize("NFC", _ZERO_WIDTH.sub("", text))
    normalized = _LINE_ENDING.sub("\n", normalized)
    normalized = _BLANK_LINES.sub("\n\n", normalized)
    lines = [line.strip() for line in normalized.split("\n")]
    joined = "\n".join(lines)
    joined = _SPACES.sub(" ", joined)
    return joined.strip()
