from __future__ import annotations

from app.ingestion.code_signal import scan_code_blocks


def test_plain_text_has_no_code() -> None:
    assert scan_code_blocks("just prose\nwith no fences") == (False, [])


def test_single_python_fence() -> None:
    text = "intro\n```python\nprint(1)\n```\noutro"
    assert scan_code_blocks(text) == (True, ["python"])


def test_multiple_fences_deduplicated_and_sorted() -> None:
    text = (
        "```sql\nSELECT 1;\n```\n"
        "```PYTHON\nprint(2)\n```\n"
        "```python\nprint(3)\n```"
    )
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