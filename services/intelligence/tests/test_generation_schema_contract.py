"""Strict-compatibility contract for the three generation schemas.

The adapter sends every schema with `strict: True` (`openrouter_client._kwargs`),
so each schema must stay strict-shaped: object roots with `additionalProperties:
False` at every level. The coding arm is the known exception: its root is a
`oneOf` (rejection | tests-bearing | output_prediction), which strict mode
tolerates live (proved ok-on-retry, see
`.work/active/practice-gen-400-debug/research/400-debug-findings.md` H2).
Each coding branch must still be strict-shaped, and local `jsonschema`
validation must accept one sample per branch.
"""

from __future__ import annotations

from typing import Any

import jsonschema

from app.generation.prompts import coding_schema, mcq_schema, written_schema

CONTEXT_IDS = {"c1", "c2"}


def _assert_strict_object(schema: dict, path: str) -> None:
    """This object node is closed; every nested object node is closed too.

    Closed means `additionalProperties: False`. Required-completeness is
    deliberately not asserted: `written_schema` keeps `expectedLengthWords`
    optional (tolerated live under `strict: True`), so it cannot be part of
    this contract.
    """
    assert schema.get("type") == "object", path
    assert schema.get("additionalProperties") is False, path
    properties = schema.get("properties", {})
    for name, subschema in properties.items():
        _assert_strict_node(subschema, f"{path}.{name}")


def _assert_strict_node(schema: Any, path: str) -> None:
    """Descend through `properties` and `items`; `oneOf` branches are pinned explicitly."""
    if isinstance(schema, dict) and schema.get("type") == "object":
        _assert_strict_object(schema, path)
    if isinstance(schema, dict) and isinstance(schema.get("items"), dict):
        _assert_strict_node(schema["items"], f"{path}[]")


def test_objective_and_written_roots_are_strict_compatible() -> None:
    for schema in (mcq_schema(CONTEXT_IDS), written_schema(CONTEXT_IDS)):
        _assert_strict_object(schema, "root")


def test_coding_oneof_root_is_the_known_exception() -> None:
    """Coding keeps its `oneOf` root (strict-suspicious but live-passing)."""
    schema = coding_schema(CONTEXT_IDS)
    assert "type" not in schema
    assert len(schema["oneOf"]) == 3
    markers = [set(branch.get("properties", {})) for branch in schema["oneOf"]]
    assert any("unsuitable" in marker for marker in markers)
    assert any("visibleTests" in marker for marker in markers)
    assert any("acceptedValue" in marker for marker in markers)
    for branch in schema["oneOf"]:
        _assert_strict_object(branch, "oneOf-branch")


def test_coding_branches_validate_samples_locally() -> None:
    """Each coding branch accepts its canonical sample via local validation."""
    schema = coding_schema(CONTEXT_IDS)
    samples = [
        {"unsuitable": True, "reason": "no code in these chunks"},
        {
            "stem": "Implement fib.",
            "subtype": "implement_fn",
            "language": "python",
            "starterCode": "def fib(n):\n    pass\n",
            "visibleTests": [
                {"name": "a", "stdin": "", "expectedOutput": "0"},
                {"name": "b", "stdin": "", "expectedOutput": "1"},
            ],
            "hiddenTests": [{"name": "c", "stdin": "1", "expectedOutput": "1"}],
            "referenceSolution": "print(0)",
            "difficulty": 3,
            "skillTags": ["algorithms"],
            "citations": [{"chunkId": "c1", "quote": "fib grows fast"}],
        },
        {
            "stem": "What does this print?",
            "subtype": "output_prediction",
            "codeSnippet": "print(2 ** 5)",
            "acceptedValue": 32,
            "difficulty": 3,
            "skillTags": ["python"],
            "citations": [{"chunkId": "c1", "quote": "powers of two"}],
        },
    ]
    validator = jsonschema.Draft202012Validator(schema)
    for sample in samples:
        assert validator.is_valid(sample), sample
        matched = [
            branch
            for branch in schema["oneOf"]
            if jsonschema.Draft202012Validator(branch).is_valid(sample)
        ]
        assert len(matched) == 1, sample
