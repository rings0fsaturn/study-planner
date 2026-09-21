from __future__ import annotations

from app.ingestion.code_signal import code_proximity, scan_code_blocks


def test_plain_text_has_no_code() -> None:
    assert scan_code_blocks("just prose\nwith no fences") == (False, [])


def test_single_python_fence() -> None:
    text = "intro\n```python\nprint(1)\n```\noutro"
    assert scan_code_blocks(text) == (True, ["python"])


def test_multiple_fences_deduplicated_and_sorted() -> None:
    text = "```sql\nSELECT 1;\n```\n```PYTHON\nprint(2)\n```\n```python\nprint(3)\n```"
    assert scan_code_blocks(text) == (True, ["python", "sql"])


def test_fence_without_info_still_flags_code() -> None:
    assert scan_code_blocks("```\nprint(1)\n```") == (True, [])


def test_info_string_attributes_keep_first_token() -> None:
    assert scan_code_blocks("```python title=example\nprint(1)\n```") == (True, ["python"])


def test_empty_text_has_no_code() -> None:
    assert scan_code_blocks("") == (False, [])


def test_deeply_indented_fence_is_literal_text() -> None:
    # The GFM 0-3 spaces rule: a deeper indent is not a fence.
    assert scan_code_blocks("    ```python\n    x\n    ```") == (False, [])


# --- code_proximity: signals that survive PDF extraction -------------------

_IMPLEMENTATION = (
    "def quicksort(array):\n"
    "if len(array) < 2:\n"
    "return array\n"
    "pivot = array[0]\n"
    "less = [i for i in array[1:] if i <= pivot]\n"
    "return quicksort(less) + [pivot]"
)

_CHAPTER_SUMMARY = (
    "Quicksort is a divide and conquer sorting algorithm. It picks a pivot "
    "element and partitions the array around that pivot. The average running "
    "time is O(n log n), and the base case should return an array of one or "
    "zero items. The algorithm sorts in place and has good cache behavior."
)

_FRONT_MATTER = (
    "Grokking Algorithms\n"
    "An illustrated guide for programmers and other curious people\n"
    "MANNING\n"
    "Chapter 1"
)


def test_implementation_chunk_scores_above_half() -> None:
    assert code_proximity(_IMPLEMENTATION) > 0.5


def test_implementation_outranks_summary_outranks_front_matter() -> None:
    assert code_proximity(_IMPLEMENTATION) > code_proximity(_CHAPTER_SUMMARY)
    assert code_proximity(_CHAPTER_SUMMARY) > code_proximity(_FRONT_MATTER)


def test_front_matter_scores_near_zero() -> None:
    assert code_proximity(_FRONT_MATTER) == 0.0


def test_empty_and_whitespace_score_zero() -> None:
    assert code_proximity("") == 0.0
    assert code_proximity("   \n\t  ") == 0.0


def test_scorer_is_deterministic() -> None:
    assert code_proximity(_IMPLEMENTATION) == code_proximity(_IMPLEMENTATION)
