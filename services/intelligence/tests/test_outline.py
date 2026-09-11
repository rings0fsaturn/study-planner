"""Outline derivation at ingestion (P3, ticket #62).

The three layout rules below were discovered by reading real extracted
contents pages of four publishers' PDFs (APM, SICP, CSAPP, DDIA); each one is
pinned so a regex tweak cannot silently break a layout.
"""

from __future__ import annotations

from app.ingestion.outline import (
    build_outline,
    derive_page_offset,
    logical_lines,
    parse_entries,
)

CONTENTS_LINES = (
    "Contents\nChapter 1 Alpha 7\nChapter 2 Beta 9\nChapter 3 Gamma 11\nChapter 4 Delta 13"
)


def paged_book(pages: int = 30, offset: int = -3, contents: bool = True) -> list[str]:
    """A synthetic PDF: a contents page plus body pages with running headers."""
    book: list[str] = []
    for index in range(1, pages + 1):
        if index == 3 and contents:
            book.append(CONTENTS_LINES)
        elif index >= 10:
            # `printed = pdf + offset`, the running header APM uses.
            book.append(f"{index + offset} SOME RUNNING HEAD\nbody paragraph text")
        else:
            book.append("Cover or preface text")
    return book


# --- the three contents layouts -------------------------------------------------


def test_wrapped_title_and_its_page_merge_into_one_entry() -> None:
    text = "Chapter 6 Business structure and performance\nmanagement\n181\n"
    assert logical_lines(text) == ["Chapter 6 Business structure and performance management 181"]
    assert parse_entries(text) == [
        {"title": "Chapter 6 Business structure and performance management", "page": 181}
    ]


def test_dot_leaders_may_be_space_separated() -> None:
    text = "1.1 The Elements of Programming . . . . . . . . 6\n"
    assert parse_entries(text) == [{"title": "1.1 The Elements of Programming", "page": 6}]


def test_single_space_rule_is_gated_on_a_contents_page() -> None:
    text = "1.1 Information Is Bits + Context 39\n"
    assert parse_entries(text) == []
    assert parse_entries(text, permissive=True) == [
        {"title": "1.1 Information Is Bits + Context", "page": 39}
    ]


# --- the printed -> PDF offset --------------------------------------------------


def test_offset_is_measured_from_the_running_headers() -> None:
    assert derive_page_offset(paged_book()) == -3


def test_offset_needs_enough_voting_pages() -> None:
    # 30 pages minus the front matter leaves too few headers to trust.
    assert derive_page_offset(paged_book(pages=12, offset=-3)) is None


def test_offset_needs_agreement() -> None:
    pages = [f"{index - 3} HEAD" if index % 2 else f"{index - 1} HEAD" for index in range(1, 41)]
    assert derive_page_offset(pages) is None


def test_a_conflicting_header_is_skipped_not_counted_against_the_offset() -> None:
    pages = [f"{index - 3} KAPLAN PUBLISHING" for index in range(1, 41)]
    for index in (5, 15, 25, 35):
        # "Chapter 5" on a page whose header says 2 is a second candidate
        # delta: the page does not vote rather than voting wrongly.
        pages[index - 1] = f"Chapter {index} Something\n{index - 3} KAPLAN PUBLISHING"
    assert derive_page_offset(pages) == -3


# --- build_outline ---------------------------------------------------------------


def test_contents_page_entries_become_pdf_pages() -> None:
    outline = build_outline(paged_book())
    assert outline is not None
    assert outline.source == "contents"
    assert outline.page_count == 30
    assert outline.page_offset == -3
    assert [entry["page"] for entry in outline.entries] == [10, 12, 14, 16]
    assert outline.entries[0]["title"] == "Chapter 1 Alpha"
    assert outline.to_json()["entries"] == [
        {"title": "Chapter 1 Alpha", "page": 10},
        {"title": "Chapter 2 Beta", "page": 12},
        {"title": "Chapter 3 Gamma", "page": 14},
        {"title": "Chapter 4 Delta", "page": 16},
    ]


def test_bookmarks_win_and_already_carry_pdf_pages() -> None:
    outline = build_outline(
        ["Cover text"] * 12,
        bookmarks=(("Part One", 2), ("Part Two", 5), ("Part Three", 8)),
    )
    assert outline is not None
    assert outline.source == "bookmarks"
    assert outline.page_offset is None
    assert [entry["page"] for entry in outline.entries] == [2, 5, 8]


def test_no_measurable_offset_refuses_the_outline() -> None:
    # The contents page parses, but without the offset its printed numbers
    # cannot be mapped onto chunk pages, and a wrong chapter range is worse
    # than no chapter list (the typed page range still works).
    pages = ["Cover text"] * 3
    pages[2] = CONTENTS_LINES
    pages += ["Unnumbered body page"] * 40
    assert build_outline(pages) is None


def test_llm_fallback_is_used_only_when_the_parse_is_thin() -> None:
    calls: list[int] = []

    def fallback(pages: list[str], page_count: int) -> list[dict]:
        calls.append(page_count)
        return [
            {"title": "Part A", "page": 7},
            {"title": "Part B", "page": 9},
            {"title": "Part C", "page": 11},
        ]

    book = paged_book(contents=False)
    outline = build_outline(book, llm=fallback)
    assert outline is not None
    assert outline.source == "llm"
    assert [entry["page"] for entry in outline.entries] == [10, 12, 14]
    assert calls == [30]

    calls.clear()
    parsed = build_outline(paged_book(), llm=fallback)
    assert parsed is not None and parsed.source == "contents"
    assert calls == []


def test_a_failing_fallback_is_not_an_ingestion_failure() -> None:
    def boom(_pages: list[str], _page_count: int) -> list[dict]:
        raise RuntimeError("provider down")

    assert build_outline(paged_book(contents=False), llm=boom) is None


def test_implausible_entries_are_dropped() -> None:
    def fallback(_pages: list[str], _count: int) -> list[dict]:
        return [
            {"title": "Beyond the end", "page": 500},
            {"title": "Duplicate", "page": 7},
            {"title": "Duplicate again", "page": 7},
        ]

    assert build_outline(paged_book(contents=False), llm=fallback) is None


def test_page_less_sources_have_no_outline() -> None:
    assert build_outline([]) is None
