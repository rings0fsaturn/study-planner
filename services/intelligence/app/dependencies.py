"""Shared FastAPI dependencies for the Phase 2 material/job boundary."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException

from app.userrest import UserScopedClient


def get_user_client(
    authorization: str | None = Header(default=None),
) -> UserScopedClient:
    """Build a user-scoped Supabase client from the request's bearer token."""
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    anon_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not supabase_url or not anon_key:
        raise HTTPException(status_code=500, detail="supabase not configured")

    token = ""
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer":
            token = value.strip()

    return UserScopedClient(supabase_url=supabase_url, anon_key=anon_key, user_token=token)
