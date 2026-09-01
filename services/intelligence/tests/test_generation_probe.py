"""Unit tests for the pure helpers of the generation-quality probe."""

import importlib.util
import pathlib

PROBE = pathlib.Path(__file__).resolve().parents[1] / "scripts/generation_probe.py"
spec = importlib.util.spec_from_file_location("generation_probe", PROBE)
gp = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(gp)


def test_classify_success_maps_finish_reasons():
    assert (
        gp.classify_success({"finish_reason": "stop", "message": {"content": '{"a": 1}'}}) == "ok"
    )
    assert (
        gp.classify_success({"finish_reason": "length", "message": {"content": "x"}}) == "truncated"
    )
    assert (
        gp.classify_success({"finish_reason": "content_filter", "message": {"content": "x"}})
        == "content_filter"
    )
    assert (
        gp.classify_success({"finish_reason": "error", "message": {"content": "x"}})
        == "provider_error"
    )
    assert (
        gp.classify_success(
            {"finish_reason": "stop", "message": {"refusal": "no", "content": None}}
        )
        == "refusal"
    )
    assert (
        gp.classify_success({"finish_reason": "stop", "message": {"content": "not json"}})
        == "malformed_json"
    )
    assert (
        gp.classify_success({"finish_reason": "weird", "message": {"content": "x"}})
        == "provider_error"
    )


def test_classify_http_status():
    assert gp.classify_http_status(400, "invalid reasoning effort value") == "tier_rejected"
    assert gp.classify_http_status(429, "rate limit") == "rate_limited"
    assert gp.classify_http_status(401, "auth") == "credit_or_auth"
    assert gp.classify_http_status(402, "insufficient credits") == "credit_or_auth"
    assert gp.classify_http_status(403, "forbidden") == "credit_or_auth"
    assert gp.classify_http_status(500, "boom") == "provider_error"
    assert gp.classify_http_status(400, "bad request") == "provider_error"


def test_build_kwargs_strict_vs_json_mode():
    msgs = [{"role": "user", "content": "hi"}]
    strict = gp.build_kwargs("high", msgs)
    assert strict["response_format"]["type"] == "json_schema"
    assert strict["response_format"]["json_schema"]["strict"] is True
    assert strict["extra_body"]["provider"]["require_parameters"] is True
    assert strict["extra_body"]["reasoning"] == {"enabled": True, "effort": "high"}
    off = gp.build_kwargs("off", msgs)
    assert off["extra_body"]["reasoning"] == {"enabled": False}
    json_mode = gp.build_kwargs("json", msgs)
    assert json_mode["response_format"]["type"] == "json_object"
    assert json_mode["extra_body"]["reasoning"] == {"enabled": False}


def test_citation_and_gold_support_math():
    contexts = {
        "S:1": {
            "steer": "q",
            "snippets": ["The difference between these two is known as a planning gap"],
            "context": [
                {
                    "chunkId": "c1",
                    "text": "The difference between these two is known as a planning gap.",
                },
                {"chunkId": "c2", "text": "Unrelated text here."},
            ],
        }
    }
    rows = [
        {
            "key": "S:1:off",
            "layer": "S",
            "tier": "off",
            "index": 1,
            "outcome": "ok",
            "parsed_ok": True,
            "latency_ms": 100,
            "usage": {"prompt": 10, "completion": 5, "reasoning": 0},
            "mcq": {
                "stem": "What describes the shortfall?",
                "options": ["a", "b", "c", "d"],
                "correctIndex": 0,
                "difficulty": 3,
                "skillTags": ["planning"],
                "citations": [{"chunkId": "c1"}],
            },
        }
    ]
    row = gp.metric_row(rows, contexts)
    assert row["schema_valid"] == 1.0
    assert row["citation_valid"] == 1.0
    assert row["gold_support"] == 1.0
    assert row["cost_usd"] > 0


def test_citation_out_of_context_counts_as_invalid():
    contexts = {"S:1": {"snippets": [], "context": [{"chunkId": "c1", "text": "hello world"}]}}
    rows = [
        {
            "key": "S:1:off",
            "layer": "S",
            "tier": "off",
            "index": 1,
            "outcome": "ok",
            "parsed_ok": True,
            "latency_ms": 10,
            "usage": {"prompt": 1, "completion": 1, "reasoning": 0},
            "mcq": {
                "stem": "s",
                "options": ["a", "b", "c", "d"],
                "correctIndex": 1,
                "difficulty": 2,
                "skillTags": ["t"],
                "citations": [{"chunkId": "c999"}],
            },
        }
    ]
    row = gp.metric_row(rows, contexts)
    assert row["citation_valid"] == 0.0


def test_copy_through_detects_shingle_copy():
    SHINGLE_TEXT = (
        "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda "
        "mu nu xi omicron pi rho sigma tau"
    )
    contexts = {"R:1": {"snippets": [], "context": [{"chunkId": "c1", "text": SHINGLE_TEXT}]}}
    copied = SHINGLE_TEXT + " copied verbatim"
    rows = [
        {
            "key": "R:1:off",
            "layer": "R",
            "tier": "off",
            "index": 1,
            "outcome": "ok",
            "parsed_ok": True,
            "latency_ms": 10,
            "usage": {"prompt": 1, "completion": 1, "reasoning": 0},
            "mcq": {
                "stem": copied,
                "options": ["a", "b", "c", "d"],
                "correctIndex": 0,
                "difficulty": 2,
                "skillTags": ["t"],
                "citations": [{"chunkId": "c1"}],
            },
        }
    ]
    assert gp.metric_row(rows, contexts)["copy_through"] == 1.0
    rows[0]["mcq"]["stem"] = "completely unrelated question stem text"
    assert gp.metric_row(rows, contexts)["copy_through"] == 0.0


def test_near_dup_and_position_histogram():
    vec = [1.0] + [0.0] * 767
    rows = [
        {
            "key": f"R:{i}:off",
            "layer": "R",
            "tier": "off",
            "index": i,
            "outcome": "ok",
            "parsed_ok": True,
            "latency_ms": 5,
            "usage": {"prompt": 1, "completion": 1, "reasoning": 0},
            "mcq": {
                "stem": f"s{i}",
                "options": ["a", "b", "c", "d"],
                "correctIndex": i % 4,
                "difficulty": 2,
                "skillTags": ["t"],
                "citations": [{"chunkId": "c1"}],
            },
            "embeddings": {"stem": vec, "options": [vec, vec, vec, vec]},
        }
        for i in range(1, 4)
    ]
    SHINGLE_TEXT = (
        "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda "
        "mu nu xi omicron pi rho sigma tau"
    )
    contexts = {"R:1": {"snippets": [], "context": [{"chunkId": "c1", "text": SHINGLE_TEXT}]}}
    row = gp.metric_row(rows, contexts)
    assert row["near_dup_rate"] == 1.0
    assert sum(row["option_position_hist"].values()) == 3


def test_sanitizer_redacts_keys():
    out = gp.sanitize("error with sk-or-v1-abc123XYZ and more")
    assert "sk-or-" not in out
    assert "REDACTED" in out


def test_validate_mcq_local():
    ctx = {"c1"}
    assert (
        gp.validate_mcq_local(
            {
                "stem": "s",
                "options": ["a", "b", "c", "d"],
                "correctIndex": 0,
                "difficulty": 3,
                "skillTags": ["t"],
                "citations": [{"chunkId": "c1"}],
            },
            ctx,
        )
        == []
    )
    assert "options_not_4" in gp.validate_mcq_local(
        {
            "stem": "s",
            "options": ["a", "b"],
            "correctIndex": 0,
            "difficulty": 3,
            "skillTags": ["t"],
            "citations": [{"chunkId": "c1"}],
        },
        ctx,
    )
    assert "citation_out_of_context" in gp.validate_mcq_local(
        {
            "stem": "s",
            "options": ["a", "b", "c", "d"],
            "correctIndex": 0,
            "difficulty": 3,
            "skillTags": ["t"],
            "citations": [{"chunkId": "zzz"}],
        },
        ctx,
    )


def test_normalize_mcq_tolerates_provider_drift():
    drifted = {
        "question": "What is X?",
        "options": [{"text": "A", "isCorrect": True}, {"text": "B"}, {"text": "C"}, {"text": "D"}],
        "chunkIds": ["c1", "c2"],
    }
    norm = gp.normalize_mcq(drifted)
    assert norm["stem"] == "What is X?"
    assert norm["options"] == ["A", "B", "C", "D"]
    assert norm["correctIndex"] == 0
    assert [c["chunkId"] for c in norm["citations"]] == ["c1", "c2"]
