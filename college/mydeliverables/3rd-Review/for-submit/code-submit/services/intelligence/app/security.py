from __future__ import annotations

import os
import time
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException

_SYMMETRIC_ALGS = ["HS256"]
_ASYMMETRIC_ALGS = {"ES256", "RS256"}
_AUDIENCE = "authenticated"
_RATE_LIMIT_WINDOW_SECONDS = 60


@dataclass
class _RateBucket:
    window_started_at: float
    count: int


_RATE_LIMITS: dict[str, _RateBucket] = {}
_JWK_CLIENTS: dict[str, jwt.PyJWKClient] = {}


class AuthConfigurationError(Exception):
    pass


def _bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="missing bearer token")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="missing bearer token")

    return token


def _configured_supabase_url() -> str:
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    if not supabase_url:
        raise AuthConfigurationError("SUPABASE_URL is required for asymmetric JWTs")
    return supabase_url


def _jwk_client_for(supabase_url: str) -> jwt.PyJWKClient:
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    client = _JWK_CLIENTS.get(jwks_url)
    if client is None:
        client = jwt.PyJWKClient(jwks_url, lifespan=600, timeout=5)
        _JWK_CLIENTS[jwks_url] = client
    return client


def _decode_asymmetric_token(token: str, algorithm: str) -> dict:
    supabase_url = _configured_supabase_url()
    signing_key = _jwk_client_for(supabase_url).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[algorithm],
        audience=_AUDIENCE,
        issuer=f"{supabase_url}/auth/v1",
    )


def _decode_symmetric_token(token: str) -> dict:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise AuthConfigurationError("SUPABASE_JWT_SECRET is required for HS256 JWTs")
    return jwt.decode(token, secret, algorithms=_SYMMETRIC_ALGS, audience=_AUDIENCE)


def _decode_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    algorithm = str(header.get("alg") or "")

    if algorithm in _SYMMETRIC_ALGS:
        return _decode_symmetric_token(token)

    if algorithm in _ASYMMETRIC_ALGS:
        return _decode_asymmetric_token(token, algorithm)

    raise jwt.InvalidAlgorithmError(f"unsupported signing algorithm: {algorithm}")


def require_user(authorization: str | None = Header(default=None)) -> str:
    """Verify the Supabase access JWT and return the user id (sub)."""
    token = _bearer_token(authorization)
    try:
        claims = _decode_token(token)
    except AuthConfigurationError:
        raise HTTPException(status_code=500, detail="auth not configured")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token") from None

    sub = str(claims.get("sub") or "")
    if not sub:
        raise HTTPException(status_code=401, detail="token missing subject")
    return sub


def rate_limit_user(user_id: str = Depends(require_user)) -> None:
    """Dev-only in-memory per-user rate-limit stub."""
    raw_limit = os.getenv("INTELLIGENCE_RATE_LIMIT_PER_MINUTE", "120")
    try:
        limit = int(raw_limit)
    except ValueError:
        limit = 120
    if limit <= 0:
        return

    now = time.monotonic()
    bucket = _RATE_LIMITS.get(user_id)
    if bucket is None or now - bucket.window_started_at >= _RATE_LIMIT_WINDOW_SECONDS:
        _RATE_LIMITS[user_id] = _RateBucket(window_started_at=now, count=1)
        return

    if bucket.count >= limit:
        raise HTTPException(status_code=429, detail="rate limit exceeded")

    bucket.count += 1
