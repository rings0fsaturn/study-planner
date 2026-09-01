"""User-scoped Supabase REST access for the authenticated API.

The API never holds service credentials: every read/write uses the caller's
access token against Supabase RLS, so owner scoping is enforced by the
database itself. The ingestion worker is the only process with a service role.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx

from app.ingestion.models import IngestionError

MATERIALS_TABLE = "materials"
JOBS_TABLE = "ingestion_jobs"
ASSESSMENTS_TABLE = "assessments"
QUESTIONS_TABLE = "questions"
STORAGE_BUCKET = "material-raw"

QUESTION_PUBLIC_COLUMNS = (
    "id,assessment_id,user_id,material_id,format,prompt,options,"
    "skill_tags,authored_difficulty,citations,created_at"
)

TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class UserScopedClient:
    supabase_url: str
    anon_key: str
    user_token: str
    _http: httpx.Client = field(default_factory=lambda: httpx.Client(timeout=TIMEOUT_SECONDS))

    @property
    def _base(self) -> str:
        return self.supabase_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.user_token}",
            "Content-Type": "application/json",
        }

    def _get_rows(self, url: str) -> list[dict[str, Any]]:
        response = self._http.get(url, headers=self._headers())
        if response.status_code == 404 or response.status_code == 406:
            return []
        if response.status_code >= 400:
            raise IngestionError("provider_unavailable", "supabase read rejected", retryable=True)
        return response.json()

    def get_material(self, material_id: str) -> dict[str, Any]:
        rows = self._get_rows(
            f"{self._base}/rest/v1/{MATERIALS_TABLE}?id=eq.{material_id}&select=*"
        )
        if not rows:
            raise IngestionError("not_found", "material not found")
        return rows[0]

    def get_job(self, job_id: str) -> dict[str, Any]:
        rows = self._get_rows(f"{self._base}/rest/v1/{JOBS_TABLE}?id=eq.{job_id}&select=*")
        if not rows:
            raise IngestionError("not_found", "ingestion job not found")
        return rows[0]

    def latest_job(self, material_id: str) -> dict[str, Any] | None:
        rows = self._get_rows(
            f"{self._base}/rest/v1/{JOBS_TABLE}"
            f"?material_id=eq.{material_id}&order=attempt.desc&limit=1&select=*"
        )
        return rows[0] if rows else None

    def get_assessment(self, assessment_id: str) -> dict[str, Any]:
        rows = self._get_rows(
            f"{self._base}/rest/v1/{ASSESSMENTS_TABLE}?id=eq.{assessment_id}&select=*"
        )
        if not rows:
            raise IngestionError("not_found", "assessment not found")
        return rows[0]

    def list_questions(self, assessment_id: str) -> list[dict[str, Any]]:
        """Read the column-granted public question columns only."""
        return self._get_rows(
            f"{self._base}/rest/v1/{QUESTIONS_TABLE}"
            f"?assessment_id=eq.{assessment_id}&select={QUESTION_PUBLIC_COLUMNS}"
        )

    def insert_assessment(self, row: dict[str, Any]) -> None:
        response = self._http.post(
            f"{self._base}/rest/v1/{ASSESSMENTS_TABLE}", json=row, headers=self._headers()
        )
        if response.status_code == 409 or "23505" in response.text:
            raise IngestionError("conflict", "assessment with this client id already exists")
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable", "assessment insert rejected", retryable=True
            )

    def enqueue_generation(
        self, assessment_id: str, job_id: str, material_id: str, correlation_id: str
    ) -> dict[str, Any]:
        """Call the DB-atomic enqueue RPC; returns the job row (row shape)."""
        response = self._http.post(
            f"{self._base}/rest/v1/rpc/enqueue_assessment_generation",
            json={
                "p_assessment_id": assessment_id,
                "p_job_id": job_id,
                "p_material_id": material_id,
                "p_correlation_id": correlation_id,
            },
            headers=self._headers(),
        )
        if response.status_code in (403, 404):
            raise IngestionError("not_found", "assessment not found")
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable", "generation enqueue rejected", retryable=True
            )
        return response.json()

    def download_fulltext(self, material_id: str, path: str) -> bytes:
        response = self._http.get(
            f"{self._base}/storage/v1/object/{STORAGE_BUCKET}/{path}",
            headers=self._headers(),
        )
        if response.status_code == 404:
            raise IngestionError("not_found", "extracted content not available")
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable", "content download rejected", retryable=True
            )
        return response.content
