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
from app.ingestion.repository import ATTEMPTS_TABLE

MATERIALS_TABLE = "materials"
JOBS_TABLE = "ingestion_jobs"
ASSESSMENTS_TABLE = "assessments"
QUESTIONS_TABLE = "questions"
STORAGE_BUCKET = "material-raw"

QUESTION_PUBLIC_COLUMNS = (
    "id,assessment_id,user_id,material_id,format,subtype,prompt,options,"
    "skill_tags,authored_difficulty,citations,created_at,"
    "language,starter_code,visible_tests"
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

    def submit_attempt(
        self,
        assessment_id: str,
        question_id: str,
        body: dict[str, Any],
        attempt_id: str,
        job_id: str,
    ) -> dict[str, Any]:
        """Call the DB-atomic attempt-submit RPC (#39, migration 025).

        Verifies ownership + objective format, dedupes on clientAttemptId,
        inserts the attempt, inserts the grading job, and sends the queue
        message in one transaction. Returns the RPC's JSONB result.
        """
        response = self._http.post(
            f"{self._base}/rest/v1/rpc/submit_assessment_attempt",
            json={
                "p_assessment_id": assessment_id,
                "p_question_id": question_id,
                "p_client_attempt_id": str(body.get("clientAttemptId") or ""),
                "p_attempt_id": attempt_id,
                "p_job_id": job_id,
                "p_answer": body.get("answer"),
                "p_submitted_at": body.get("submittedAt"),
                "p_elapsed_seconds": body.get("elapsedSeconds"),
                "p_correlation_id": str(body.get("correlationId") or ""),
            },
            headers=self._headers(),
        )
        if response.status_code in (403, 404):
            raise IngestionError("not_found", "question not found")
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable", "attempt submit rejected", retryable=True
            )
        return response.json()

    def list_attempts(self, assessment_id: str) -> list[dict[str, Any]]:
        """Owner-scoped attempt rows (RLS SELECT); grade included when present."""
        return self._get_rows(
            f"{self._base}/rest/v1/{ATTEMPTS_TABLE}"
            f"?assessment_id=eq.{assessment_id}&order=submitted_at.asc&select=*"
        )

    def list_graded_attempts(self) -> list[dict[str, Any]]:
        """Owner-scoped graded attempt rows in grade order (mastery input).

        Only the grade column is fetched; the durable per-skill observations
        live in ``grade.perSkill`` and the owning material in
        ``grade.materialId``, so the projection can be rebuilt from this
        alone (RLS SELECT keeps it owner-scoped).
        """
        return self._get_rows(
            f"{self._base}/rest/v1/{ATTEMPTS_TABLE}"
            f"?status=eq.graded&order=graded_at.asc&select=grade"
        )

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
