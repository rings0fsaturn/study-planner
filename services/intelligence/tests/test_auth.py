from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt.utils import base64url_encode

import app.security as security
from app.main import app

SECRET = "test-supabase-jwt-secret-32-bytes-min"
WRONG_SECRET = "wrong-supabase-jwt-secret-32-bytes"
SUPABASE_URL = "https://example-project.supabase.co"


def _calibration_body() -> dict[str, Any]:
    return {
        "sessions": [],
        "exceptionalTags": [],
        "resolutions": [],
    }


def _token(secret: str = SECRET, **overrides: Any) -> str:
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "aud": "authenticated",
        "exp": now + timedelta(minutes=5),
        "iat": now,
        "sub": "user-123",
        "role": "authenticated",
    }
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm="HS256")


def _b64_p256_coordinate(value: int) -> str:
    return base64url_encode(value.to_bytes(32, "big")).decode("ascii")


def _es256_key(kid: str = "es256-test-key") -> tuple[ec.EllipticCurvePrivateKey, dict[str, str]]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_numbers = private_key.public_key().public_numbers()
    public_jwk = {
        "kty": "EC",
        "kid": kid,
        "use": "sig",
        "alg": "ES256",
        "crv": "P-256",
        "x": _b64_p256_coordinate(public_numbers.x),
        "y": _b64_p256_coordinate(public_numbers.y),
    }
    return private_key, public_jwk


def _es256_token(
    private_key: ec.EllipticCurvePrivateKey,
    *,
    kid: str = "es256-test-key",
    issuer: str = f"{SUPABASE_URL}/auth/v1",
    **overrides: Any,
) -> str:
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "iss": issuer,
        "aud": "authenticated",
        "exp": now + timedelta(minutes=5),
        "iat": now,
        "sub": "user-123",
        "role": "authenticated",
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="ES256", headers={"kid": kid})


class _FakeJwkClient:
    def __init__(self, jwk: dict[str, str]) -> None:
        self.jwk = jwk

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        return jwt.PyJWK.from_dict(self.jwk)


def test_health_stays_open_without_token() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_v1_rejects_missing_token(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    response = client.post("/v1/calibration", json=_calibration_body())

    assert response.status_code == 401


def test_v1_rejects_malformed_authorization_header(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": "Basic definitely-not-a-bearer-token"},
        json=_calibration_body(),
    )

    assert response.status_code == 401


def test_v1_rejects_wrong_secret(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": f"Bearer {_token(secret=WRONG_SECRET)}"},
        json=_calibration_body(),
    )

    assert response.status_code == 401


def test_v1_rejects_expired_token(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={
            "Authorization": f"Bearer {_token(exp=datetime.now(UTC) - timedelta(minutes=1))}"
        },
        json=_calibration_body(),
    )

    assert response.status_code == 401


def test_v1_rejects_token_missing_subject(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": f"Bearer {_token(sub='')}"},
        json=_calibration_body(),
    )

    assert response.status_code == 401


def test_v1_rejects_when_auth_secret_is_unset(monkeypatch) -> None:
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": f"Bearer {_token()}"},
        json=_calibration_body(),
    )

    assert response.status_code == 500


def test_v1_accepts_valid_supabase_jwt(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": f"Bearer {_token()}"},
        json=_calibration_body(),
    )

    assert response.status_code == 200


def test_v1_accepts_valid_supabase_es256_jwt_from_jwks(monkeypatch) -> None:
    kid = "es256-test-key"
    private_key, public_jwk = _es256_key(kid)
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setattr(
        security,
        "_jwk_client_for",
        lambda supabase_url: _FakeJwkClient(public_jwk),
    )
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": f"Bearer {_es256_token(private_key, kid=kid)}"},
        json=_calibration_body(),
    )

    assert response.status_code == 200


def test_v1_rejects_es256_jwt_from_wrong_issuer(monkeypatch) -> None:
    kid = "es256-test-key"
    private_key, public_jwk = _es256_key(kid)
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setattr(
        security,
        "_jwk_client_for",
        lambda supabase_url: _FakeJwkClient(public_jwk),
    )
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={
            "Authorization": f"Bearer {_es256_token(private_key, kid=kid, issuer='https://other-project.supabase.co/auth/v1')}"
        },
        json=_calibration_body(),
    )

    assert response.status_code == 401


def test_v1_rejects_es256_jwt_when_supabase_url_is_unset(monkeypatch) -> None:
    kid = "es256-test-key"
    private_key, public_jwk = _es256_key(kid)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setattr(
        security,
        "_jwk_client_for",
        lambda supabase_url: _FakeJwkClient(public_jwk),
    )
    client = TestClient(app)

    response = client.post(
        "/v1/calibration",
        headers={"Authorization": f"Bearer {_es256_token(private_key, kid=kid)}"},
        json=_calibration_body(),
    )

    assert response.status_code == 500
