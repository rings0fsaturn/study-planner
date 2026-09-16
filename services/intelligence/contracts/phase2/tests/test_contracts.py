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
        validator = jsonschema.Draft202012Validator(
            schema, resolver=resolver, format_checker=jsonschema.FormatChecker()
        )
        validator.validate(instance)


def test_public_contracts_reject_hidden_fields() -> None:
    public_schema_paths = [
        ROOT / "provider/gated-reveal-response.schema.json",
        ROOT / "provider/guide-hint-frame.schema.json",
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
    event_kinds = {
        "assessmentCreated",
        "questionAttempted",
        "questionGraded",
        "guideRequested",
        "guideCompleted",
        "roadmapFeedbackRecorded",
    }
    assert event_kinds <= set(events["$defs"])


def test_public_error_matrix_is_explicit() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))
    codes = document["components"]["schemas"]["ServiceError"]["properties"]["code"]["enum"]
    assert {"safety_block", "quota_exhausted", "provider_timeout", "malformed_output"} <= set(codes)
    assert "unsupported_request" in codes


def test_guide_frame_conditionals_reject_mixed_payloads() -> None:
    schema = load_json(ROOT / "provider/guide-hint-frame.schema.json")
    invalid = {"frame": "done", "sequence": 1, "correlationId": "corr", "text": "not allowed"}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(invalid)


GENERATION_FIXTURES = [
    "generation-success.json",
    "generation-malformed.json",
    "generation-partial.json",
    "generation-safety-block.json",
    "generation-quota-failure.json",
    "generation-timeout.json",
]


def test_generation_fixtures_use_flattened_openrouter_envelope() -> None:
    for name in GENERATION_FIXTURES:
        fixture = load_json(ROOT / "fixtures" / name)
        assert fixture["provider"] == "openrouter"
        assert "candidates" not in fixture
    for name in [
        "generation-success.json",
        "generation-malformed.json",
        "generation-partial.json",
        "generation-safety-block.json",
    ]:
        fixture = load_json(ROOT / "fixtures" / name)
        assert "content" in fixture or "refusal" in fixture
    success = load_json(ROOT / "fixtures/generation-success.json")
    assert success["content"]
    assert success["structuredOutput"]
    assert success["finishReason"] == "stop"
    assert success["usage"]["reasoningTokens"] == 0
    assert success["routedProvider"]
    assert "finishReason" not in load_json(ROOT / "fixtures/generation-timeout.json")


def test_generation_response_schema_covers_refusal_branch() -> None:
    schema = load_json(ROOT / "provider/generation-response.schema.json")
    finish = schema["properties"]["finishReason"]["enum"]
    assert finish == ["stop", "length", "content_filter", "refusal", "error"]
    safety = load_json(ROOT / "fixtures/generation-safety-block.json")
    assert safety["finishReason"] == "refusal"
    assert safety["outcome"] == "safety_block"
    assert safety["refusal"]


def test_generation_response_schema_pins_flattened_shape() -> None:
    schema = load_json(ROOT / "provider/generation-response.schema.json")
    props = schema["properties"]
    assert "candidates" not in props
    assert "safetyFeedback" not in props
    assert set(props) <= {
        "provider",
        "model",
        "traceId",
        "correlationId",
        "providerRequestId",
        "content",
        "refusal",
        "structuredOutput",
        "finishReason",
        "nativeFinishReason",
        "usage",
        "routedProvider",
        "outcome",
        "error",
    }
    assert "nativeFinishReason" not in schema["required"]
    assert "routedProvider" not in schema["required"]
    assert "usage" not in schema["required"]
    assert {"reasoningTokens"} <= set(props["usage"]["properties"])


def test_generation_response_schema_rejects_invalid_envelope_states() -> None:
    schemas = {load_json(path)["$id"]: load_json(path) for path in ROOT.rglob("*.schema.json")}
    schema = load_json(ROOT / "provider/generation-response.schema.json")
    base = {
        "provider": "openrouter",
        "model": "deepseek/deepseek-v4-flash-0731",
        "traceId": "trace-reject",
        "usage": {"promptTokens": 1, "outputTokens": 1, "totalTokens": 2},
    }

    def new_validator():
        resolver = jsonschema.RefResolver.from_schema(schema, store=schemas)
        return jsonschema.Draft202012Validator(schema, resolver=resolver)

    for instance in [
        {**base, "outcome": "ok"},
        {**base, "outcome": "partial"},
        {**base, "outcome": "malformed_output"},
        {**base, "outcome": "quota_failure"},
        {**base, "outcome": "timeout"},
        {**base, "outcome": "provider_error"},
        {**base, "outcome": "safety_block"},
    ]:
        with pytest.raises(jsonschema.ValidationError):
            new_validator().validate(instance)
    with pytest.raises(jsonschema.ValidationError):
        error = {
            "code": "safety_block",
            "retryable": False,
            "requestId": "req",
            "correlationId": "corr",
            "message": "m",
        }
        new_validator().validate({**base, "outcome": "ok", "content": "x", "error": error})
    quota_error = {
        "code": "quota_exhausted",
        "retryable": False,
        "requestId": "req",
        "correlationId": "corr",
        "message": "m",
        "retryAfterSeconds": 60,
    }
    with pytest.raises(jsonschema.ValidationError):
        new_validator().validate(
            {**base, "outcome": "quota_failure", "content": "x", "error": quota_error}
        )
    with pytest.raises(jsonschema.ValidationError):
        timeout_error = {**quota_error, "code": "provider_timeout"}
        new_validator().validate(
            {**base, "outcome": "timeout", "finishReason": "stop", "error": timeout_error}
        )


def test_provider_error_enum_includes_unsupported_request() -> None:
    schema = load_json(ROOT / "provider-error.schema.json")
    codes = schema["properties"]["code"]["enum"]
    assert "unsupported_request" in codes
    assert schema["properties"]["code"]["enum"] == [
        "safety_block",
        "quota_exhausted",
        "rate_limited",
        "provider_credentials",
        "provider_unavailable",
        "provider_timeout",
        "unsupported_request",
        "malformed_output",
    ]


def test_generation_request_uses_neutral_envelope() -> None:
    schema = load_json(ROOT / "provider/generation-request.schema.json")
    assert schema["properties"]["provider"]["const"] == "openrouter"
    assert "messages" in schema["properties"]
    roles = schema["properties"]["messages"]["items"]["properties"]["role"]["enum"]
    assert roles == ["system", "user", "assistant"]
    assert "systemInstruction" not in schema["properties"]
    assert "generationConfig" not in schema["properties"]
    assert schema["properties"]["reasoningEffort"]["default"] == "off"
    assert schema["properties"]["timeoutMs"]["default"] == 30000
    assert schema["properties"]["temperature"]["const"] == 0.3
    assert schema["properties"]["maxOutputTokens"]["default"] == 4096


# --- #39 assessment taking: attempt submission + read contract ---


def _openapi() -> dict:
    return yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))


def _validate_against_openapi(document: dict, schema_name: str, instance: object) -> None:
    schema = document["components"]["schemas"][schema_name]
    resolver = jsonschema.RefResolver.from_schema(document)
    validator = jsonschema.Draft202012Validator(
        schema, resolver=resolver, format_checker=jsonschema.FormatChecker()
    )
    validator.validate(instance)


def test_assessment_attempt_routes_exist() -> None:
    document = _openapi()
    paths = document["paths"]

    submit = paths["/v1/assessments/{assessmentId}/questions/{questionId}/attempts"]["post"]
    assert submit["operationId"] == "submitAssessmentAttempt"
    assert submit["requestBody"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "AttemptSubmit"
    )
    assert submit["responses"]["201"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "AttemptCreated"
    )
    assert "200" in submit["responses"], "idempotent replay of an existing clientAttemptId"

    read = paths["/v1/assessments/{assessmentId}/attempts"]["get"]
    assert read["operationId"] == "listAssessmentAttempts"
    items = read["responses"]["200"]["content"]["application/json"]["schema"]["items"]
    assert items["$ref"].endswith("AttemptRecord")


def test_attempt_schemas_exclude_hidden_content() -> None:
    document = _openapi()
    schemas = document["components"]["schemas"]

    record = schemas["AttemptRecord"]
    assert set(record["properties"]) == {
        "attemptId",
        "clientAttemptId",
        "questionId",
        "assessmentId",
        "submittedAt",
        "status",
        "elapsedSeconds",
        "answer",
        "grade",
    }
    assert record["properties"]["status"]["enum"] == ["queued", "graded", "failed"]
    # #41 widens the echoed answer to objective + written; #42 adds coding.
    # All three are learner input, never key material.
    answer_branches = record["properties"]["answer"]["oneOf"]
    assert {branch.get("$ref") for branch in answer_branches} == {
        "#/components/schemas/ObjectiveAnswer",
        "#/components/schemas/WrittenAnswer",
        "#/components/schemas/CodingAnswer",
    }
    # The record carries the public grade only; the answer key stays in questions.answer_block.
    grade_schema = record["properties"]["grade"]
    grade_branches = grade_schema.get("oneOf", [grade_schema])
    assert any(
        branch.get("$ref", "").endswith("QuestionGraded") for branch in grade_branches
    )
    assert "answerKey" not in record["properties"]

    created = schemas["AttemptCreated"]
    assert set(created["required"]) == {"attemptId", "questionId", "status", "jobId"}

    objective = schemas["ObjectiveAnswer"]
    assert set(objective["properties"]) <= {"index", "indices", "flag", "value"}
    assert objective["additionalProperties"] is False


def test_attempt_fixtures_validate_against_openapi() -> None:
    document = _openapi()

    submit = load_json(ROOT / "fixtures/attempt-submit.json")
    _validate_against_openapi(document, "AttemptSubmit", submit)
    _validate_against_openapi(document, "ObjectiveAnswer", submit["answer"])

    created = load_json(ROOT / "fixtures/attempt-created.json")
    _validate_against_openapi(document, "AttemptCreated", created)

    queued = load_json(ROOT / "fixtures/attempt-record-queued.json")
    _validate_against_openapi(document, "AttemptRecord", queued)
    _validate_against_openapi(document, "ObjectiveAnswer", queued["answer"])
    assert queued["grade"] is None

    graded = load_json(ROOT / "fixtures/attempt-record-graded.json")
    _validate_against_openapi(document, "AttemptRecord", graded)
    _validate_against_openapi(document, "ObjectiveAnswer", graded["answer"])
    _validate_against_openapi(document, "QuestionGraded", graded["grade"])
    assert len(graded["grade"]["perSkill"]) >= 1
    assert_no_secret_fields(graded)

    # D-01: answer is optional — pre-echo rows without the key still validate.
    legacy = dict(queued)
    del legacy["answer"]
    _validate_against_openapi(document, "AttemptRecord", legacy)


# --- #41 written assessment: written answers, subtype, rubric breakdown ---

# Authored rubric content and reference solutions are server-only; these names
# must never appear on a client-visible schema (#41 AC1/AC3, PIPELINES.md).
WRITTEN_SERVER_ONLY_NAMES = {
    "rubric",
    "rubricblock",
    "referencesolution",
    "referenceanswer",
    "modelanswer",
    "answerblock",
    "answerkey",
    "hiddentests",
    "hiddenanswer",
}


def _property_names(value: object) -> set[str]:
    names: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            names.add(key)
            names |= _property_names(child)
    elif isinstance(value, list):
        for child in value:
            names |= _property_names(child)
    return names


def test_written_answer_schema_is_typed_and_bounded() -> None:
    document = _openapi()
    written = document["components"]["schemas"]["WrittenAnswer"]
    assert written["additionalProperties"] is False
    assert written["required"] == ["text"]
    assert set(written["properties"]) == {"text"}
    assert written["properties"]["text"]["minLength"] == 1
    assert written["properties"]["text"]["maxLength"] == 20000


def test_question_subtype_is_optional_and_written_scoped() -> None:
    document = _openapi()
    question = document["components"]["schemas"]["Question"]
    assert "subtype" in question["properties"]
    assert "subtype" not in question["required"]
    # #42 widens the enum with the four coding subtypes; written members stay.
    subtypes = question["properties"]["subtype"]["enum"]
    assert {"short_answer", "long_form"} <= set(subtypes)
    assert {"implement_fn", "debug", "output_prediction", "complete_code"} <= set(subtypes)


def test_question_graded_breakdown_is_criterion_typed() -> None:
    document = _openapi()
    schemas = document["components"]["schemas"]

    breakdown = schemas["QuestionGraded"]["properties"]["rubricBreakdown"]
    assert breakdown["type"] == "array"
    assert breakdown["items"]["$ref"].endswith("RubricCriterionResult")

    criterion = schemas["RubricCriterionResult"]
    assert criterion["additionalProperties"] is False
    assert {"criterion", "weight", "score", "met"} <= set(criterion["required"])
    assert criterion["properties"]["score"]["minimum"] == 0
    assert criterion["properties"]["score"]["maximum"] == 1
    assert criterion["properties"]["weight"]["minimum"] == 0
    assert criterion["properties"]["weight"]["maximum"] == 1


def test_written_attempt_fixtures_validate_against_openapi() -> None:
    document = _openapi()

    submitted = load_json(ROOT / "fixtures/written-attempt-submit.json")
    _validate_against_openapi(document, "AttemptSubmit", submitted)
    _validate_against_openapi(document, "WrittenAnswer", submitted["answer"])

    question = load_json(ROOT / "fixtures/written-question.json")
    _validate_against_openapi(document, "Question", question)
    assert question["format"] == "written"
    assert question["subtype"] == "long_form"

    record = load_json(ROOT / "fixtures/written-attempt-record.json")
    _validate_against_openapi(document, "AttemptRecord", record)
    _validate_against_openapi(document, "WrittenAnswer", record["answer"])
    _validate_against_openapi(document, "QuestionGraded", record["grade"])
    assert record["grade"]["grader"] == "llm_rubric"
    breakdown = record["grade"]["rubricBreakdown"]
    assert len(breakdown) >= 2
    assert abs(sum(line["weight"] for line in breakdown) - 1.0) < 1e-9
    assert all(0.0 <= line["score"] <= 1.0 for line in breakdown)
    assert record["grade"]["perSkill"]


def test_written_contract_shapes_carry_no_server_only_vocabulary() -> None:
    document = _openapi()
    schemas = document["components"]["schemas"]

    client_visible = set()
    for name in ("WrittenAnswer", "RubricCriterionResult", "AttemptRecord", "Question"):
        client_visible |= _property_names(schemas[name])
    offenders = {
        name for name in client_visible if name.lower() in WRITTEN_SERVER_ONLY_NAMES
    }
    assert not offenders, offenders

    # The learner's own written answer fixture carries no key material either.
    assert_no_secret_fields(load_json(ROOT / "fixtures/written-attempt-record.json"))
    assert_no_secret_fields(load_json(ROOT / "fixtures/written-question.json"))


# --- #42 coding assessment: visible payload, coding answers, judge0 testCases ---


def test_coding_answer_schema_is_python_only_and_bounded() -> None:
    document = _openapi()
    coding = document["components"]["schemas"]["CodingAnswer"]
    assert coding["additionalProperties"] is False
    assert coding["required"] == ["language", "source", "config"]
    assert coding["properties"]["language"]["enum"] == ["python"]
    source = coding["properties"]["source"]
    assert source["minLength"] == 1
    assert source["maxLength"] == 100000
    config = coding["properties"]["config"]
    assert set(config["required"]) == {"stdin", "timeLimitMs", "memoryLimitMb"}
    assert config["properties"]["timeLimitMs"]["maximum"] == 30000
    assert config["properties"]["memoryLimitMb"]["maximum"] == 1024


def test_coding_answer_fixtures_validate_against_openapi() -> None:
    document = _openapi()
    fixture = load_json(ROOT / "fixtures/coding-answer.json")
    _validate_against_openapi(document, "CodingAnswer", fixture)
    submit = load_json(ROOT / "fixtures/coding-attempt-submit.json")
    _validate_against_openapi(document, "AttemptSubmit", submit)
    _validate_against_openapi(document, "CodingAnswer", submit["answer"])


def test_question_coding_fields_are_optional_and_typed() -> None:
    document = _openapi()
    question = document["components"]["schemas"]["Question"]
    for name in ("language", "starterCode", "visibleTests"):
        assert name in question["properties"], name
        assert name not in question["required"], name
    assert question["properties"]["language"]["enum"] == ["python"]
    assert question["properties"]["starterCode"]["maxLength"] == 100000
    visible = question["properties"]["visibleTests"]
    assert visible["items"]["$ref"].endswith("VisibleTestCase")
    test_case = document["components"]["schemas"]["VisibleTestCase"]
    assert set(test_case["required"]) == {"name", "stdin", "expectedOutput"}
    # The subtype enum now carries both families; objective stays subtype-free.
    assert question["properties"]["subtype"]["enum"] == [
        "short_answer",
        "long_form",
        "implement_fn",
        "debug",
        "output_prediction",
        "complete_code",
    ]


def test_question_graded_test_cases_shape_is_veiled() -> None:
    document = _openapi()
    graded = document["components"]["schemas"]["QuestionGraded"]
    cases = graded["properties"]["testCases"]
    assert cases["items"]["$ref"].endswith("TestCaseResult")
    result = document["components"]["schemas"]["TestCaseResult"]
    assert set(result["required"]) == {"name", "passed", "visible"}
    assert set(result["properties"]) == {"name", "passed", "visible"}
    # The veil is in the contract: hidden tests are named, never shown.
    description = cases.get("description", "")
    assert "Hidden test" in description


def test_coding_fixtures_validate_against_openapi() -> None:
    document = _openapi()

    question = load_json(ROOT / "fixtures/coding-question.json")
    _validate_against_openapi(document, "Question", question)
    assert question["format"] == "coding"
    assert question["subtype"] == "implement_fn"
    assert question["language"] == "python"
    assert question["visibleTests"]

    record = load_json(ROOT / "fixtures/coding-attempt-record.json")
    _validate_against_openapi(document, "AttemptRecord", record)
    _validate_against_openapi(document, "CodingAnswer", record["answer"])
    _validate_against_openapi(document, "QuestionGraded", record["grade"])
    assert record["grade"]["grader"] == "judge0"
    assert record["grade"]["testCases"]
    hidden = [case for case in record["grade"]["testCases"] if not case["visible"]]
    assert hidden and all(case["name"].startswith("Hidden test ") for case in hidden)


def test_coding_contract_shapes_carry_no_server_only_vocabulary() -> None:
    document = _openapi()
    schemas = document["components"]["schemas"]

    client_visible = set()
    for name in (
        "WrittenAnswer",
        "RubricCriterionResult",
        "AttemptRecord",
        "Question",
        "CodingAnswer",
        "VisibleTestCase",
        "TestCaseResult",
        "QuestionGraded",
    ):
        client_visible |= _property_names(schemas[name])
    offenders = {
        name for name in client_visible if name.lower() in WRITTEN_SERVER_ONLY_NAMES
    }
    assert not offenders, offenders

    coding_fixtures = (
        "coding-question.json",
        "coding-attempt-record.json",
        "coding-attempt-submit.json",
    )
    for name in coding_fixtures:
        assert_no_secret_fields(load_json(ROOT / "fixtures" / name))


# --- #62 scoped question generation: recipe.scope ---


def test_assessment_recipe_scope_is_in_the_contract() -> None:
    document = _openapi()
    schemas = document["components"]["schemas"]

    recipe = schemas["AssessmentRecipe"]
    assert recipe["additionalProperties"] is False
    assert recipe["properties"]["scope"]["$ref"].endswith("AssessmentScope")

    scope = schemas["AssessmentScope"]
    assert scope["additionalProperties"] is False
    assert set(scope["required"]) == {"pageStart", "pageEnd"}
    assert set(scope["properties"]) == {"pageStart", "pageEnd", "sectionLabel"}

    # Unscoped requests keep validating: the scope is opt-in.
    _validate_against_openapi(
        document, "AssessmentRecipe", {"formats": ["written"], "questionCount": 1}
    )

    scoped = load_json(ROOT / "fixtures/assessment-recipe-scoped.json")
    _validate_against_openapi(document, "AssessmentRecipe", scoped)
    _validate_against_openapi(document, "AssessmentScope", scoped["scope"])


def test_assessment_scope_rejects_malformed_ranges() -> None:
    document = _openapi()
    for invalid in (
        {"pageStart": 156},  # pageEnd is required
        {"pageStart": 156, "pageEnd": 213, "chapterId": "ch-5"},  # unknown key
        {"pageStart": 0, "pageEnd": 213},  # pages are 1-based
        {"pageStart": 156, "pageEnd": 213, "sectionLabel": ""},  # label must be non-empty
    ):
        with pytest.raises(jsonschema.ValidationError):
            _validate_against_openapi(document, "AssessmentScope", invalid)
