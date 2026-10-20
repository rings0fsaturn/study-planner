"""Shared client for live operator scripts (probes, top-ups, pilot runs).

Every script in this folder hand-rolled its own sign-in, header, and body
handling; the copies drifted (a missing ``Idempotency-Key`` 422s the loop
endpoint, a ``str`` error body crashes ``.get`` callers). Import from here
instead::

    sys.path.insert(0, str(Path(__file__).parent))
    from live_client import call, headers_for, load_kv, request_id, sign_in

Secret-safe by construction: values are only ever read from gitignored files
and only ids, states, counts, and request-ids are printed by callers.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any


def load_kv(path: Path) -> dict[str, str]:
    """``key=value`` file into a dict; skips blanks/comments, strips CR/BOM/quotes.

    File-wins with no ``os.environ`` interaction (unlike probe env loaders).
    """
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def request_id(prefix: str) -> str:
    """One id per logical call; reuse it across that call's retries."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def headers_for(token: str, rid: str) -> dict[str, str]:
    """Auth + trace headers; the idempotency key is mandatory (loop 422s)."""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Request-ID": rid,
        "Idempotency-Key": uuid.uuid4().hex,
    }


def decode_body(raw: bytes) -> dict[str, Any] | list[Any] | str | None:
    """JSON body, ``None`` for empty, raw text when it is not JSON."""
    text = raw.decode(errors="replace")
    if not text.strip():
        return None
    try:
        return json.loads(text)
    except ValueError:
        return text


def as_dict(payload: object) -> dict[str, Any]:
    """Error bodies arrive as ``str``; callers needing a dict get ``{}``."""
    return payload if isinstance(payload, dict) else {}


def read_credentials(path: Path) -> tuple[str, str]:
    """Shared-account ``email=``/``password=`` lines, unwrapped (rule 16).

    Sending the raw wrapped value answers ``invalid_credentials`` for a
    valid account, so the split-and-strip here is load-bearing.
    """
    email = password = ""
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("email="):
            email = line.partition("=")[2].strip()
        elif line.startswith("password="):
            password = line.partition("=")[2].strip()
    if not email or not password:
        raise SystemExit("credentials file must carry email= and password= lines")
    return email, password


def call(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    payload: Any = None,
    timeout: int = 60,
) -> tuple[int, dict[str, Any] | list[Any] | str | None]:
    """One HTTP call; ``(status, decoded-or-raw body)`` for HTTP responses.

    Network errors (refused, DNS, timeout) return ``(0, message)`` instead of
    raising, so operator scripts stay linear without try/except at every call.
    """
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, decode_body(response.read())
    except urllib.error.HTTPError as exc:
        body: dict[str, Any] | list[Any] | str | None = decode_body(exc.read())
        if isinstance(body, str):
            body = body[:400]
        return exc.code, body
    except (urllib.error.URLError, OSError) as exc:
        return 0, str(exc)[:400]


def sign_in(base: str, apikey: str, email: str, password: str) -> tuple[str, str]:
    """Supabase password grant; returns ``(access token, user id)``."""
    status, body = call(
        "POST",
        f"{base}/auth/v1/token?grant_type=password",
        headers={"Content-Type": "application/json", "apikey": apikey},
        payload={"email": email, "password": password},
    )
    record = as_dict(body)
    if status != 200 or "access_token" not in record:
        raise SystemExit(f"sign_in -> http_{status}")
    user = record.get("user")
    user_id = user.get("id") if isinstance(user, dict) else ""
    return str(record["access_token"]), str(user_id or "")
