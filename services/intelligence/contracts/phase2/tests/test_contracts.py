from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest
import yaml


ROOT = Path(__file__).parents[1]
SECRET_FIELDS = {"answerkey", "rubric", "referencesolution", "hiddentests", "hiddenanswer"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="ascii"))


def walk_values(value: object):
    yield value
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from walk_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_values(child)


def assert_no_secret_fields(value: object) -> None:
    for item in walk_values(value):
        if isinstance(item, str):
            assert item.replace("_", "").replace("-", "").lower() not in SECRET_FIELDS


def test_openapi_31_has_structurally_complete_operations() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))
    assert document["openapi"] == "3.1.0"
    assert document["info"]["x-contract-status"] == "approved"
    assert "/v1/jobs/{jobId}" in document["paths"]
    assert "ServiceError" in document["components"]["schemas"]
    for path, path_item in document["paths"].items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete", "options", "head"}:
                continue
            assert operation["operationId"], path
            assert operation["security"], path
            assert operation["responses"], path
            refs = {parameter.get("$ref") for parameter in operation.get("parameters", [])}
            assert "#/components/parameters/RequestId" in refs, path
            if method in {"post", "put", "patch", "delete"}:
                assert "#/components/parameters/IdempotencyKey" in refs, path
            for response in operation["responses"].values():
                assert "description" in response or "$ref" in response, path


def test_openapi_refs_resolve_locally() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))

    def resolve_pointer(pointer: str) -> object:
        current: object = document
        for token in pointer[2:].split("/"):
            token = token.replace("~1", "/").replace("~0", "~")
            assert isinstance(current, dict) and token in current, pointer
            current = current[token]
        return current

    def visit(value: object) -> None:
        if isinstance(value, dict):
            ref = value.get("$ref")
            if isinstance(ref, str):
                if ref.startswith("#/"):
                    resolve_pointer(ref)
                else:
                    target = (ROOT / ref.split("#", 1)[0]).resolve()
                    assert target.is_file(), ref
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(document)


def test_every_json_schema_and_fixture_validates() -> None:
    schemas = {load_json(path)["$id"]: load_json(path) for path in ROOT.rglob("*.schema.json")}
    for schema_path in sorted(ROOT.rglob("*.schema.json")):
        schema = load_json(schema_path)
        jsonschema.Draft202012Validator.check_schema(schema)

    for item in load_json(ROOT / "fixtures/manifest.json"):
        schema = load_json(ROOT / "fixtures" / item["schema"])
        instance = load_json(ROOT / "fixtures" / item["file"])
        resolver = jsonschema.RefResolver.from_schema(schema, store=schemas)
        jsonschema.Draft202012Validator(schema, resolver=resolver, format_checker=jsonschema.FormatChecker()).validate(instance)


def test_public_contracts_reject_hidden_fields() -> None:
    public_schema_paths = [
        ROOT / "gemini/gated-reveal-response.schema.json",
        ROOT / "gemini/guide-hint-frame.schema.json",
        ROOT / "execution-result.schema.json",
        ROOT / "durable-events.schema.json",
    ]
    for path in public_schema_paths:
        assert_no_secret_fields(load_json(path))

    reveal = load_json(ROOT / "fixtures/gated-reveal.json")
    assert_no_secret_fields(reveal)
    assert "explanation" in reveal
    assert "content" not in reveal

    events = load_json(ROOT / "durable-events.schema.json")
    assert_no_secret_fields(events)
    assert "$defs" in events
    assert {"assessmentCreated", "questionAttempted", "questionGraded", "guideRequested", "guideCompleted", "roadmapFeedbackRecorded"} <= set(events["$defs"])


def test_public_error_matrix_is_explicit() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))
    codes = document["components"]["schemas"]["ServiceError"]["properties"]["code"]["enum"]
    assert {"safety_block", "quota_exhausted", "provider_timeout", "malformed_output"} <= set(codes)


def test_guide_frame_conditionals_reject_mixed_payloads() -> None:
    schema = load_json(ROOT / "gemini/guide-hint-frame.schema.json")
    invalid = {"frame": "done", "sequence": 1, "correlationId": "corr", "text": "not allowed"}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(invalid)
