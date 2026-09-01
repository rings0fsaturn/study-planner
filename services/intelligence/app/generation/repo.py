"""Persistence contract for the generation worker (service-role REST).

`SupabaseIngestionRepo` implements this protocol structurally: the worker
depends on the narrow interface below, not on the concrete class.
"""

from __future__ import annotations

from typing import Protocol


class GenerationRepo(Protocol):
    def get_assessment(self, assessment_id: str) -> dict: ...
    def get_material(self, material_id: str): ...
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
    ) -> None: ...
    def update_assessment_status(
        self, assessment_id: str, status: str, warnings: list[dict]
    ) -> None: ...
    def complete_assessment(
        self, question_row: dict, job_id: str, status: str, warnings: list[dict]
    ) -> None: ...
