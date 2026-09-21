"""Deterministic code-bearing signal for materials (#42, D-04/D-10).

Fenced code blocks (``` with an optional info string) are the signal: a
material that shows code is a candidate for coding-question generation. The
scan is pure and cheap; the generation prompt remains the real judge (a
conceptual material can still yield a coding question, and a fenced one can
still be judged unsuitable).
"""

from __future__ import annotations

import re

# An opening or closing fence line: up to three spaces of indent, three
# backticks, then an optional info string. A closing fence matches with an
# empty info string, which is harmless: `has_code` is already True.
_FENCE_RE = re.compile(r"^[ \t]{0,3}```[ \t]*(?P<info>[^\n`]*)$", re.MULTILINE)


def scan_code_blocks(text: str) -> tuple[bool, list[str]]:
    """Return `(has_code, languages)` for fenced blocks in `text`.

    `languages` is sorted and de-duplicated and lowercased; only the first
    token of the info string counts (GitHub-flavoured `python title=x`).
    A fence with no info string contributes no language. `has_code` is True
    when at least one fence opens, even with no language hint.
    """
    languages: set[str] = set()
    has_code = False
    for match in _FENCE_RE.finditer(text or ""):
        has_code = True
        info = (match.group("info") or "").strip().lower()
        if info:
            languages.add(info.split()[0])
    return has_code, sorted(languages)


# Signals that survive PDF text extraction. Fences and leading indentation are
# flattened by the extractor (measured 2026-09-21 on grokking-algorithms: 0/260
# chunks carry a fence, 0/260 carry a newline + 4-space indent), so the scorer
# reads what does survive: code keywords, call/assignment shapes, and the
# operator punctuation prose does not use in runs.
_CODE_SIGNAL_RE = re.compile(
    r"\b(?:def|class|return|import|while|elif|None|True|False)\b"
    r"|\b(?:print|len)\s*\("
    r"|\bfor\s+\w+\s+in\b"
    r"|\belse\s*:"
    r"|\w+\s*=\s*[^=\s]"
    r"|->|==|!=|<=|>=|:=|\[\]|\{\}"
)

# Density multiplier: hits per word is small, so scale it into 0..1. Chosen so
# a dense listing saturates while a chapter that merely mentions code does not.
_PROXIMITY_DENSITY_SCALE = 20.0


def code_proximity(text: str) -> float:
    """0.0 (prose) .. 1.0 (dense code) for one chunk. Pure and deterministic.

    Scores signals that survive PDF extraction, not fences: code keywords, call
    and assignment shapes, and operator punctuation. Uses signal density (hits
    per word) with a saturating cap, so a dense listing outranks a chapter that
    merely mentions code, and front matter with no signals scores 0.
    """
    hits = len(_CODE_SIGNAL_RE.findall(text or ""))
    if hits == 0:
        return 0.0
    words = max(1, len((text or "").split()))
    return min(1.0, (hits / words) * _PROXIMITY_DENSITY_SCALE)
