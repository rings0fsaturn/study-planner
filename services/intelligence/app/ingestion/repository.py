"""Server-owned persistence access for the ingestion worker.

All access runs through Supabase REST with the service role; the worker is
the only caller. Owner scoping is enforced by the worker's guard checks and
by the RPC/RLS layer, not by every individual read query.
"""

from __future__ import annotations

from typing import Protocol

import httpx

from .embeddings import EMBEDDING_DIMENSIONS
from .models import ContentChunk, IngestionError, IngestionJob, Material

MATERIALS_TABLE = "materials"
CHUNKS_TABLE = "content_chunks"
JOBS_TABLE = "ingestion_jobs"
ASSESSMENTS_TABLE = "assessments"
QUESTIONS_TABLE = "questions"
ATTEMPTS_TABLE = "question_attempts"


class IngestionRepo(Protocol):
    def get_material(self, material_id: str) -> Material: ...
    def set_material_state(
        self,
        material_id: str,
        state: str,
        progress: float,
        error_code: str | None = None,
        error_message: str | None = None,
        retryable: bool = False,
        chunk_count: int | None = None,
        grounding_version: str | None = None,
        extracted_text_path: str | None = None,
        embedding_provider: str | None = None,
        outline: dict | None = None,
        page_count: int | None = None,
        page_offset: int | None = None,
    ) -> None: ...
    def get_job(self, job_id: str) -> IngestionJob: ...
    def set_job_running(self, job_id: str) -> None: ...
    def set_job_succeeded(self, job_id: str, result_id: str) -> None: ...
    def set_job_failed(
        self,
        job_id: str,
        code: str,
        message: str,
        retryable: bool = False,
    ) -> None: ...
    def publish_ready(
        self,
        material_id: str,
        job_id: str,
        chunk_count: int,
        grounding_version: str,
        result_id: str,
    ) -> None: ...
    def replace_chunks(
        self, material_id: str, chunks: list[ContentChunk], owner_id: str
    ) -> None: ...
    def list_unembedded_chunks(self, material_id: str, limit: int) -> list[ContentChunk]: ...
    def list_chunks(self, material_id: str, limit: int = 10000) -> list[ContentChunk]: ...
    def unembedded_chunk_count(self, material_id: str) -> int: ...
    def embedded_chunk_count(self, material_id: str) -> int: ...
    def all_chunk_count(self, material_id: str) -> int: ...
    def update_chunk_embedding(self, chunk_id: str, embedding: list[float]) -> None: ...
    def update_chunk_embeddings(
        self, material_id: str, rows: list[tuple[str, list[float]]]
    ) -> None: ...
    def flag_chunk(self, material_id: str, chunk_id: str) -> None: ...
    def delete_material_chunks(self, material_id: str) -> None: ...


class StorageClient(Protocol):
    def download(self, path: str) -> bytes: ...
    def upload(self, path: str, data: bytes, content_type: str) -> None: ...


def _material_from_row(row: dict) -> Material:
    return Material(
        id=row["id"],
        owner_id=row["user_id"],
        title=row.get("title") or "",
        kind=row.get("kind") or "manual",
        source=row.get("source") or "",
        ingestion_state=row.get("ingestion_state") or "pending",
        ingestion_progress=float(row.get("ingestion_progress") or 0),
        ingestion_error=row.get("ingestion_error"),
        upload_complete_at=row.get("upload_complete_at"),
        content_version=row.get("content_version") or "",
        chunk_count=int(row.get("chunk_count") or 0),
        grounding_version=row.get("grounding_version"),
        extracted_text_path=row.get("extracted_text_path"),
        embedding_provider=row.get("embedding_provider"),
        created_at=row.get("created_at") or "",
        updated_at=row.get("updated_at") or "",
    )


def _job_from_row(row: dict) -> IngestionJob:
    return IngestionJob(
        id=row["id"],
        owner_id=row["user_id"],
        material_id=row["material_id"],
        status=row.get("status") or "queued",
        attempt=int(row.get("attempt") or 1),
        correlation_id=row.get("correlation_id") or "",
        result_id=row.get("result_id"),
        error_code=row.get("error_code"),
        error_message=row.get("error_message"),
        retryable=bool(row.get("retryable")),
        created_at=row.get("created_at") or "",
        completed_at=row.get("completed_at"),
    )


class SupabaseIngestionRepo:
    def __init__(
        self, supabase_url: str, service_role_key: str, client: httpx.Client | None = None
    ) -> None:
        self._base = supabase_url.rstrip("/")
        self._key = service_role_key
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def _request(
        self,
        method: str,
        url: str,
        *,
        payload: dict | list[dict] | None = None,
        timeout: float = 10.0,
    ) -> httpx.Response:
        client = self._client or httpx.Client(timeout=timeout)
        try:
            if payload is None:
                response = client.request(method, url, headers=self._headers())
            else:
                response = client.request(method, url, json=payload, headers=self._headers())
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", f"storage {method.lower()} timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", f"storage {method.lower()} failed", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable", f"storage {method.lower()} rejected", retryable=True
            )
        return response

    def _get(self, url: str, headers: dict[str, str]) -> list[dict]:
        return self._request("GET", url).json()

    def _post(self, url: str, payload: dict | list[dict]) -> None:
        self._request("POST", url, payload=payload)

    def _patch(self, url: str, payload: dict) -> None:
        self._request("PATCH", url, payload=payload)

    def _delete(self, url: str) -> None:
        self._request("DELETE", url)

    def get_material(self, material_id: str) -> Material:
        rows = self._get(
            f"{self._base}/rest/v1/{MATERIALS_TABLE}?id=eq.{material_id}&select=*",
            self._headers(),
        )
        if not rows:
            raise IngestionError("not_found", "material not found")
        return _material_from_row(rows[0])

    def set_material_state(
        self,
        material_id: str,
        state: str,
        progress: float,
        error_code: str | None = None,
        error_message: str | None = None,
        retryable: bool = False,
        chunk_count: int | None = None,
        grounding_version: str | None = None,
        extracted_text_path: str | None = None,
        embedding_provider: str | None = None,
        outline: dict | None = None,
        page_count: int | None = None,
        page_offset: int | None = None,
        has_code: bool | None = None,
        code_languages: list[str] | None = None,
    ) -> None:
        payload: dict[str, object] = {
            "ingestion_state": state,
            "ingestion_progress": progress,
            "ingestion_error": error_message if error_code else None,
        }
        if chunk_count is not None:
            payload["chunk_count"] = chunk_count
        if grounding_version is not None:
            payload["grounding_version"] = grounding_version
        if extracted_text_path is not None:
            payload["extracted_text_path"] = extracted_text_path
        if embedding_provider is not None:
            payload["embedding_provider"] = embedding_provider
        if outline is not None:
            payload["outline"] = outline
        if page_count is not None:
            payload["page_count"] = page_count
        if page_offset is not None:
            payload["page_offset"] = page_offset
        # `is not None` on purpose: a scanned material with no code fences
        # writes `has_code: false` / `code_languages: []` (D-10); NULL stays
        # reserved for "never scanned".
        if has_code is not None:
            payload["has_code"] = has_code
        if code_languages is not None:
            payload["code_languages"] = code_languages
        self._patch(
            f"{self._base}/rest/v1/{MATERIALS_TABLE}?id=eq.{material_id}",
            payload,
        )

    def get_job(self, job_id: str) -> IngestionJob:
        rows = self._get(
            f"{self._base}/rest/v1/{JOBS_TABLE}?id=eq.{job_id}&select=*",
            self._headers(),
        )
        if not rows:
            raise IngestionError("not_found", "ingestion job not found")
        return _job_from_row(rows[0])

    def set_job_running(self, job_id: str) -> None:
        # Conditional write: a stale stage message must never re-open a
        # terminal job (the worker's guard already skips terminal jobs; this
        # makes the re-open impossible at the store too).
        self._patch(
            f"{self._base}/rest/v1/{JOBS_TABLE}?id=eq.{job_id}"
            f"&status=not.in.(succeeded,failed,cancelled)",
            {"status": "running", "error_code": None, "error_message": None},
        )

    def set_job_succeeded(self, job_id: str, result_id: str) -> None:
        self._patch(
            f"{self._base}/rest/v1/{JOBS_TABLE}?id=eq.{job_id}",
            {
                "status": "succeeded",
                "result_id": result_id,
                "completed_at": _now(),
            },
        )

    def set_job_failed(self, job_id: str, code: str, message: str, retryable: bool = False) -> None:
        self._patch(
            f"{self._base}/rest/v1/{JOBS_TABLE}?id=eq.{job_id}",
            {
                "status": "failed",
                "error_code": code,
                "error_message": message,
                "retryable": retryable,
                "completed_at": _now(),
            },
        )

    def update_job_status(
        self,
        job_id: str,
        status: str,
        *,
        error_code: str | None = None,
        error_message: str | None = None,
        retryable: bool = False,
        retry_after: float | None = None,
        result_id: str | None = None,
    ) -> None:
        """General job transition used by the generation worker."""
        payload: dict = {"status": status}
        if error_code is not None:
            payload["error_code"] = error_code
        if error_message is not None:
            payload["error_message"] = error_message
        if retryable:
            payload["retryable"] = True
        if retry_after is not None:
            payload["retry_after_seconds"] = max(1, int(retry_after))
        if result_id is not None:
            payload["result_id"] = result_id
        if status in ("succeeded", "failed", "cancelled"):
            payload["completed_at"] = _now()
        self._patch(f"{self._base}/rest/v1/{JOBS_TABLE}?id=eq.{job_id}", payload)

    def get_assessment(self, assessment_id: str) -> dict:
        rows = self._get(
            f"{self._base}/rest/v1/{ASSESSMENTS_TABLE}?id=eq.{assessment_id}&select=*",
            self._headers(),
        )
        if not rows:
            raise IngestionError("not_found", "assessment not found")
        return rows[0]

    def update_assessment_status(
        self, assessment_id: str, status: str, warnings: list[dict]
    ) -> None:
        self._patch(
            f"{self._base}/rest/v1/{ASSESSMENTS_TABLE}?id=eq.{assessment_id}",
            {"status": status, "warnings": warnings, "updated_at": _now()},
        )

    def insert_question(self, row: dict) -> None:
        self._post(f"{self._base}/rest/v1/{QUESTIONS_TABLE}", row)

    def complete_assessment(
        self, question_row: dict, job_id: str, status: str, warnings: list[dict]
    ) -> None:
        """Atomic accept: question insert + assessment status + job success in
        one security-definer transaction (migration 023). Refuses to run when
        the assessment is not `generating` (re-entry guard)."""
        self._request(
            "POST",
            f"{self._base}/rest/v1/rpc/complete_assessment_generation",
            payload={
                "p_question": question_row,
                "p_job_id": job_id,
                "p_status": status,
                "p_warnings": warnings,
            },
        )

    def publish_ready(
        self,
        material_id: str,
        job_id: str,
        chunk_count: int,
        grounding_version: str,
        result_id: str,
    ) -> None:
        # Transactional publish: migration 007's ingestion_publish_ready flips
        # the material to ready and the job to succeeded in one database
        # transaction, so a crash cannot leave the two states split.
        self._request(
            "POST",
            f"{self._base}/rest/v1/rpc/ingestion_publish_ready",
            payload={
                "p_material_id": material_id,
                "p_job_id": job_id,
                "p_chunk_count": chunk_count,
                "p_grounding_version": grounding_version,
            },
        )

    # --- Grading (#39): the GradingRepo protocol implementation ---

    def get_attempt(self, attempt_id: str) -> dict:
        rows = self._get(
            f"{self._base}/rest/v1/{ATTEMPTS_TABLE}?id=eq.{attempt_id}&select=*",
            self._headers(),
        )
        if not rows:
            raise IngestionError("not_found", "attempt not found")
        return rows[0]

    def get_question(self, question_id: str) -> dict:
        # service_role select: answer_block is included and must never leave
        # the grading path in any response or log.
        rows = self._get(
            f"{self._base}/rest/v1/{QUESTIONS_TABLE}?id=eq.{question_id}&select=*",
            self._headers(),
        )
        if not rows:
            raise IngestionError("not_found", "question not found")
        return rows[0]

    def complete_attempt(
        self, attempt_id: str, job_id: str, status: str, grade: dict | None
    ) -> None:
        # Transactional completion: attempt status/grade + job success in one
        # security-definer transaction (migration 025).
        self._request(
            "POST",
            f"{self._base}/rest/v1/rpc/complete_attempt_grading",
            payload={
                "p_attempt_id": attempt_id,
                "p_job_id": job_id,
                "p_status": status,
                "p_grade": grade,
            },
        )

    def replace_chunks(self, material_id: str, chunks: list[ContentChunk], owner_id: str) -> None:
        self.delete_material_chunks(material_id)
        if not chunks:
            return
        rows = [
            {
                "id": chunk.chunk_id,
                "user_id": owner_id,
                "material_id": material_id,
                "ordinal": chunk.ordinal,
                "text": chunk.text,
                "start_seconds": chunk.start_seconds,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
            }
            for chunk in chunks
        ]
        # PostgREST bulk insert takes a bare JSON array ({"rows": [...]} is
        # rejected by the deployed PostgREST as an unknown column).
        self._post(f"{self._base}/rest/v1/{CHUNKS_TABLE}", rows)

    def list_unembedded_chunks(self, material_id: str, limit: int) -> list[ContentChunk]:
        rows = self._get(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?material_id=eq.{material_id}"
            f"&embedding=is.null&skipped=is.false&order=ordinal.asc&limit={limit}"
            f"&select=id,ordinal,text,start_seconds",
            self._headers(),
        )
        return [
            ContentChunk(
                chunk_id=row["id"],
                material_id=material_id,
                text=row.get("text") or "",
                ordinal=int(row.get("ordinal") or 0),
                start_seconds=row.get("start_seconds"),
            )
            for row in rows
        ]

    def list_chunks(self, material_id: str, limit: int = 10000) -> list[ContentChunk]:
        rows = self._get(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?material_id=eq.{material_id}"
            f"&order=ordinal.asc&limit={limit}"
            f"&select=id,ordinal,text,start_seconds,page_start,page_end",
            self._headers(),
        )
        return [
            ContentChunk(
                chunk_id=row["id"],
                material_id=material_id,
                text=row.get("text") or "",
                ordinal=int(row.get("ordinal") or 0),
                start_seconds=row.get("start_seconds"),
                page_start=row.get("page_start"),
                page_end=row.get("page_end"),
            )
            for row in rows
        ]

    def unembedded_chunk_count(self, material_id: str) -> int:
        rows = self._get(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?material_id=eq.{material_id}"
            f"&embedding=is.null&skipped=is.false&select=id",
            self._headers(),
        )
        return len(rows)

    def embedded_chunk_count(self, material_id: str) -> int:
        rows = self._get(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?material_id=eq.{material_id}"
            f"&embedding=not.is.null&select=id",
            self._headers(),
        )
        return len(rows)

    def all_chunk_count(self, material_id: str) -> int:
        rows = self._get(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?material_id=eq.{material_id}&select=id",
            self._headers(),
        )
        return len(rows)

    def flag_chunk(self, material_id: str, chunk_id: str) -> None:
        # Both filters guard the write: only this material's chunk may be
        # flagged, so a stale payload cannot touch another material.
        self._patch(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?id=eq.{chunk_id}&material_id=eq.{material_id}",
            {"skipped": True},
        )

    def update_chunk_embedding(self, chunk_id: str, embedding: list[float]) -> None:
        self._patch(
            f"{self._base}/rest/v1/{CHUNKS_TABLE}?id=eq.{chunk_id}",
            {"embedding": _embedding_to_halfvec(embedding)},
        )

    def update_chunk_embeddings(
        self, material_id: str, rows: list[tuple[str, list[float]]]
    ) -> None:
        if not rows:
            return
        # PostgREST cannot bulk-patch different values per row, so the worker
        # writes an embedding batch through the server-side RPC (migration
        # 011), which guards every row on the material id.
        self._post(
            f"{self._base}/rest/v1/rpc/ingestion_update_chunk_embeddings",
            {
                "p_material_id": material_id,
                "p_chunks": [
                    {"chunkId": chunk_id, "embedding": _embedding_to_halfvec(embedding)}
                    for chunk_id, embedding in rows
                ],
            },
        )

    def delete_material_chunks(self, material_id: str) -> None:
        self._delete(f"{self._base}/rest/v1/{CHUNKS_TABLE}?material_id=eq.{material_id}")


class SupabaseStorageClient:
    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        bucket: str = "material-raw",
        client: httpx.Client | None = None,
    ) -> None:
        self._base = supabase_url.rstrip("/")
        self._key = service_role_key
        self._bucket = bucket
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
        }

    def _request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        content: bytes | None = None,
    ) -> httpx.Response:
        client = self._client or httpx.Client(timeout=30.0)
        try:
            response = client.request(
                method, url, headers=headers or self._headers(), content=content
            )
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", f"object {method.lower()} timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", f"object {method.lower()} failed", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        return response

    def download(self, path: str) -> bytes:
        response = self._request("GET", f"{self._base}/storage/v1/object/{self._bucket}/{path}")
        if response.status_code == 404:
            raise IngestionError("validation_failed", "uploaded object is missing")
        if response.status_code >= 400:
            raise IngestionError("provider_unavailable", "object download rejected", retryable=True)
        return response.content

    def upload(self, path: str, data: bytes, content_type: str) -> None:
        # The fulltext path is deterministic per material, so a redelivered
        # extract stage re-uploads the same object. Upsert keeps the stage
        # idempotent (the browser upload already sends upsert=true).
        headers = {
            **self._headers(),
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        response = self._request(
            "POST",
            f"{self._base}/storage/v1/object/{self._bucket}/{path}",
            headers=headers,
            content=data,
        )
        if response.status_code >= 400:
            raise IngestionError("provider_unavailable", "object upload rejected", retryable=True)


def _embedding_to_halfvec(embedding: list[float]) -> str:
    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise IngestionError("internal_error", "embedding dimension mismatch")
    if not all(_finite(value) for value in embedding):
        raise IngestionError("internal_error", "embedding contains non-finite values")
    return "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"


def _finite(value: float) -> bool:
    import math

    return math.isfinite(value)


def _now() -> str:
    from datetime import UTC, datetime

    return datetime.now(UTC).isoformat()
