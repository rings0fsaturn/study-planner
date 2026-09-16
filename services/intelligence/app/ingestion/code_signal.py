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