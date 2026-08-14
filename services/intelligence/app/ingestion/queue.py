"""Queue access for the ingestion worker.

Production access goes through the public-schema RPC wrappers
(`ingestion_poll` / `ingestion_complete`) with the service role, so browsers
never touch pgmq. Tests inject an in-memory double that models visibility
timeout and redelivery.
"""

from __future__ import annotations

from typing import Protocol

import httpx

from .models import IngestionError, QueueMessage

EXTRACT_QUEUE = "material_extract"
EMBED_QUEUE = "material_embed"
PUBLISH_QUEUE = "material_publish"

DEFAULT_VISIBILITY_SECONDS = 30


class WorkQueue(Protocol):
    def poll(
        self, queue: str, visibility_seconds: int = DEFAULT_VISIBILITY_SECONDS
    ) -> list[QueueMessage]: ...
    def complete(self, queue: str, msg_id: int, success: bool) -> None: ...
    def send(self, queue: str, payload: dict) -> None: ...


class SupabaseWorkQueue:
    """pgmq access through the Supabase REST RPC boundary with the service role."""

    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._base = supabase_url.rstrip("/")
        self._key = service_role_key
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    def _post(self, url: str, payload: dict) -> httpx.Response:
        client = self._client or httpx.Client(timeout=10.0)
        try:
            response = client.post(url, json=payload, headers=self._headers())
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", "queue request timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", "queue request failed", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 400:
            raise IngestionError("provider_unavailable", "queue request rejected", retryable=True)
        return response

    def send(self, queue: str, payload: dict) -> None:
        self._post(
            f"{self._base}/rest/v1/rpc/ingestion_send",
            {"p_queue": queue, "p_payload": payload},
        )

    def poll(
        self, queue: str, visibility_seconds: int = DEFAULT_VISIBILITY_SECONDS
    ) -> list[QueueMessage]:
        response = self._post(
            f"{self._base}/rest/v1/rpc/ingestion_poll",
            {"p_queue": queue, "p_vt": visibility_seconds},
        )
        try:
            rows = response.json()
        except ValueError as exc:
            raise IngestionError("malformed_output", "queue poll response is not json") from exc
        return [
            QueueMessage(
                msg_id=int(row["msg_id"]),
                payload=row.get("payload") or {},
                read_ct=int(row.get("read_ct") or 0),
            )
            for row in rows
            if isinstance(row, dict) and row.get("msg_id") is not None
        ]

    def complete(self, queue: str, msg_id: int, success: bool) -> None:
        self._post(
            f"{self._base}/rest/v1/rpc/ingestion_complete",
            {"p_queue": queue, "p_msg_id": msg_id, "p_success": success},
        )
