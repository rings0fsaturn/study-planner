"""Unit tests for scripts/live_client.py (pure helpers only; no network)."""

from __future__ import annotations

import io
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import live_client


def test_load_kv_skips_comments_blanks_and_cr(tmp_path: Path) -> None:
    path = tmp_path / "creds.txt"
    path.write_bytes(b"\xef\xbb\xbf# comment\n\remail=a@b.c\r\npassword=pw\r\nsynth-x=1\r\n")
    data = live_client.load_kv(path)
    assert data == {"email": "a@b.c", "password": "pw", "synth-x": "1"}


def test_headers_for_always_carries_idempotency_key() -> None:
    headers = live_client.headers_for("tok", "rid-1")
    assert headers["Authorization"] == "Bearer tok"
    assert headers["X-Request-ID"] == "rid-1"
    assert len(headers["Idempotency-Key"]) >= 16


def test_request_id_unique_with_prefix() -> None:
    first = live_client.request_id("pilot")
    second = live_client.request_id("pilot")
    assert first.startswith("pilot-")
    assert first != second


def test_decode_body_shapes() -> None:
    assert live_client.decode_body(b"") is None
    assert live_client.decode_body(b'{"a": 1}') == {"a": 1}
    assert live_client.decode_body(b"[1]") == [1]
    assert live_client.decode_body(b"plain") == "plain"


def test_as_dict_coerces_non_dicts() -> None:
    assert live_client.as_dict({"a": 1}) == {"a": 1}
    assert live_client.as_dict([1]) == {}
    assert live_client.as_dict("oops") == {}
    assert live_client.as_dict(None) == {}


def test_read_credentials_unwraps_rule16_lines(tmp_path: Path) -> None:
    path = tmp_path / "creds.txt"
    path.write_text("email=a@b.c\r\npassword=pw\r\n", encoding="utf-8")
    assert live_client.read_credentials(path) == ("a@b.c", "pw")


def test_read_credentials_missing_raises(tmp_path: Path) -> None:
    path = tmp_path / "creds.txt"
    path.write_text("email=a@b.c\n", encoding="utf-8")
    with pytest.raises(SystemExit):
        live_client.read_credentials(path)


def test_load_kv_strips_quotes(tmp_path: Path) -> None:
    path = tmp_path / "env"
    path.write_text("URL=\"https://x\"\nKEY='abc'\n", encoding="utf-8")
    assert live_client.load_kv(path) == {"URL": "https://x", "KEY": "abc"}


def test_read_credentials_handles_bom(tmp_path: Path) -> None:
    path = tmp_path / "creds.txt"
    path.write_bytes(b"\xef\xbb\xbfemail=a@b.c\npassword=pw\n")
    assert live_client.read_credentials(path) == ("a@b.c", "pw")


def _http_error(code: int, body: bytes) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("http://x", code, "msg", {}, io.BytesIO(body))


def test_call_returns_sentinel_on_network_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*args: object, **kwargs: object) -> object:
        raise urllib.error.URLError("refused")

    monkeypatch.setattr(urllib.request, "urlopen", boom)
    status, body = live_client.call("GET", "http://x", headers={})
    assert status == 0
    assert "refused" in str(body)


def test_call_decodes_json_error_body(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*args: object, **kwargs: object) -> object:
        raise _http_error(422, b'{"detail": "nope"}')

    monkeypatch.setattr(urllib.request, "urlopen", fail)
    status, body = live_client.call("GET", "http://x", headers={})
    assert status == 422
    assert body == {"detail": "nope"}


def test_sign_in_failure_never_echoes_body(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*args: object, **kwargs: object) -> object:
        raise _http_error(401, b"invalid user secret-account")

    monkeypatch.setattr(urllib.request, "urlopen", fail)
    with pytest.raises(SystemExit) as exc:
        live_client.sign_in("http://x", "key", "e", "p")
    assert "secret-account" not in str(exc.value)
