"""In-memory doubles for the ingestion worker tests.

These doubles model the persistence/queue/storage/embedding contracts the
production adapters implement over Supabase and Gemini, so the pipeline
behavior is testable without network access or credentials.
"""

from __future__ import annotations

import hashlib
import math

from app.ingestion.embeddings import EMBEDDING_DIMENSIONS
from app.ingestion.models import ContentChunk, IngestionError, IngestionJob, Material, QueueMessage
from app.ingestion.queue import DEFAULT_POLL_QUANTITY, DEFAULT_VISIBILITY_SECONDS, WorkQueue


class FakeQueue(WorkQueue):
    def __init__(self) -> None:
        self.queues: dict[str, list[dict]] = {}
        self.next_msg_id = 1
        self.redelivered: list[tuple[str, int]] = []

    def send(self, queue: str, payload: dict) -> None:
        self.queues.setdefault(queue, []).append(
            {"msg_id": self.next_msg_id, "payload": payload, "read_ct": 0}
        )
        self.next_msg_id += 1

    def poll(
        self,
        queue: str,
        visibility_seconds: int = DEFAULT_VISIBILITY_SECONDS,
        quantity: int = DEFAULT_POLL_QUANTITY,
    ) -> list[QueueMessage]:
        messages = []
        for item in self.queues.get(queue, []):
            if len(messages) >= quantity:
                break
            if item.get("visible", True):
                item["read_ct"] += 1
                item["visible"] = False
                messages.append(
                    QueueMessage(
                        msg_id=item["msg_id"],
                        payload=item["payload"],
                        read_ct=item["read_ct"],
                    )
                )
        return messages

    def complete(self, queue: str, msg_id: int, success: bool) -> None:
        items = self.queues.get(queue, [])
        for index, item in enumerate(items):
            if item["msg_id"] == msg_id:
                if success:
                    items.pop(index)
                else:
                    item["visible"] = True
                    self.redelivered.append((queue, msg_id))
                return


class FakeIngestionRepo:
    def __init__(self) -> None:
        self.materials: dict[str, dict] = {}
        self.jobs: dict[str, dict] = {}
        self.chunks: dict[str, dict] = {}
        self.publish_ready_calls: list[dict] = []

    def seed_material(self, material: Material) -> None:
        self.materials[material.id] = {
            "id": material.id,
            "user_id": material.owner_id,
            "title": material.title,
            "kind": material.kind,
            "source": material.source,
            "ingestion_state": material.ingestion_state,
            "ingestion_progress": material.ingestion_progress,
            "ingestion_error": material.ingestion_error,
            "upload_complete_at": material.upload_complete_at,
            "content_version": material.content_version,
            "chunk_count": material.chunk_count,
            "grounding_version": material.grounding_version,
            "extracted_text_path": material.extracted_text_path,
            "created_at": material.created_at,
            "updated_at": material.updated_at,
        }

    def seed_job(self, job: IngestionJob) -> None:
        self.jobs[job.id] = {
            "id": job.id,
            "user_id": job.owner_id,
            "material_id": job.material_id,
            "status": job.status,
            "attempt": job.attempt,
            "correlation_id": job.correlation_id,
            "result_id": job.result_id,
            "error_code": job.error_code,
            "error_message": job.error_message,
            "retryable": job.retryable,
            "created_at": job.created_at,
            "completed_at": job.completed_at,
        }

    def get_material(self, material_id: str) -> Material:
        if material_id not in self.materials:
            raise IngestionError("not_found", "material not found")
        row = dict(self.materials[material_id])
        row["owner_id"] = row.pop("user_id")
        return Material(**row)

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
    ) -> None:
        row = self.materials[material_id]
        row["ingestion_state"] = state
        row["ingestion_progress"] = progress
        row["ingestion_error"] = error_message if error_code else None
        if chunk_count is not None:
            row["chunk_count"] = chunk_count
        if grounding_version is not None:
            row["grounding_version"] = grounding_version
        if extracted_text_path is not None:
            row["extracted_text_path"] = extracted_text_path

    def get_job(self, job_id: str) -> IngestionJob:
        if job_id not in self.jobs:
            raise IngestionError("not_found", "ingestion job not found")
        row = dict(self.jobs[job_id])
        row["owner_id"] = row.pop("user_id")
        return IngestionJob(**row)

    def set_job_running(self, job_id: str) -> None:
        self.jobs[job_id]["status"] = "running"
        self.jobs[job_id]["error_code"] = None
        self.jobs[job_id]["error_message"] = None

    def set_job_succeeded(self, job_id: str, result_id: str) -> None:
        self.jobs[job_id]["status"] = "succeeded"
        self.jobs[job_id]["result_id"] = result_id
        self.jobs[job_id]["completed_at"] = "2026-08-14T00:00:00Z"

    def set_job_failed(self, job_id: str, code: str, message: str, retryable: bool = False) -> None:
        self.jobs[job_id]["status"] = "failed"
        self.jobs[job_id]["error_code"] = code
        self.jobs[job_id]["error_message"] = message
        self.jobs[job_id]["retryable"] = retryable
        self.jobs[job_id]["completed_at"] = "2026-08-14T00:00:00Z"

    def publish_ready(
        self,
        material_id: str,
        job_id: str,
        chunk_count: int,
        grounding_version: str,
        result_id: str,
    ) -> None:
        self.publish_ready_calls.append(
            {
                "material_id": material_id,
                "job_id": job_id,
                "chunk_count": chunk_count,
                "grounding_version": grounding_version,
                "result_id": result_id,
            }
        )
        self.set_material_state(
            material_id,
            "ready",
            1.0,
            chunk_count=chunk_count,
            grounding_version=grounding_version,
        )
        self.set_job_succeeded(job_id, result_id)

    def replace_chunks(
        self, material_id: str, chunks: list[ContentChunk], owner_id: str
    ) -> None:
        self.delete_material_chunks(material_id)
        for chunk in chunks:
            self.chunks[chunk.chunk_id] = {
                "id": chunk.chunk_id,
                "material_id": material_id,
                "ordinal": chunk.ordinal,
                "text": chunk.text,
                "start_seconds": chunk.start_seconds,
                "embedding": None,
                "skipped": False,
            }

    def list_unembedded_chunks(self, material_id: str, limit: int) -> list[ContentChunk]:
        rows = [
            row
            for row in self.chunks.values()
            if row["material_id"] == material_id
            and row["embedding"] is None
            and not row["skipped"]
        ]
        rows.sort(key=lambda row: row["ordinal"])
        return [
            ContentChunk(
                chunk_id=row["id"],
                material_id=material_id,
                text=row["text"],
                ordinal=row["ordinal"],
                start_seconds=row["start_seconds"],
            )
            for row in rows[:limit]
        ]

    def unembedded_chunk_count(self, material_id: str) -> int:
        return sum(
            1
            for row in self.chunks.values()
            if row["material_id"] == material_id
            and row["embedding"] is None
            and not row["skipped"]
        )

    def embedded_chunk_count(self, material_id: str) -> int:
        return sum(
            1
            for row in self.chunks.values()
            if row["material_id"] == material_id and row["embedding"] is not None
        )

    def all_chunk_count(self, material_id: str) -> int:
        return sum(
            1 for row in self.chunks.values() if row["material_id"] == material_id
        )

    def update_chunk_embedding(self, chunk_id: str, embedding: list[float] | None) -> None:
        self.chunks[chunk_id]["embedding"] = embedding

    def update_chunk_embeddings(
        self, material_id: str, rows: list[tuple[str, list[float]]]
    ) -> None:
        for chunk_id, embedding in rows:
            if chunk_id not in self.chunks or self.chunks[chunk_id]["material_id"] != material_id:
                continue
            self.chunks[chunk_id]["embedding"] = embedding

    def flag_chunk(self, material_id: str, chunk_id: str) -> None:
        if chunk_id in self.chunks and self.chunks[chunk_id]["material_id"] == material_id:
            self.chunks[chunk_id]["skipped"] = True

    def delete_material_chunks(self, material_id: str) -> None:
        stale = [
            key
            for key, row in self.chunks.items()
            if row["material_id"] == material_id
        ]
        for chunk_id in stale:
            del self.chunks[chunk_id]


class InMemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def download(self, path: str) -> bytes:
        if path not in self.objects:
            raise IngestionError("validation_failed", "uploaded object is missing")
        return self.objects[path]

    def upload(self, path: str, data: bytes, content_type: str) -> None:
        self.objects[path] = data


class DeterministicEmbedder:
    """Hash-seeded 768-dimensional vectors, L2-normalized (test double)."""

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def _vector(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        vector = [
            ((digest[index % len(digest)] + index * 7) % 256) / 128.0 - 1.0
            for index in range(EMBEDDING_DIMENSIONS)
        ]
        norm = math.sqrt(sum(value * value for value in vector))
        return [value / norm for value in vector]


class FailingEmbedder:
    """Fails the first N batches, then delegates to a deterministic embedder."""

    def __init__(self, fail_batches: int, error: IngestionError) -> None:
        self.fail_batches = fail_batches
        self.error = error
        self.calls = 0
        self.delegate = DeterministicEmbedder()

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        self.calls += 1
        if self.calls <= self.fail_batches:
            raise self.error
        return self.delegate.embed(texts)


class ZeroVectorEmbedder:
    """Returns a provider zero vector for every N-th text (simulating garbage).

    Mirrors the production adapter contract: a zero vector surfaces as None so
    the worker flags the chunk instead of persisting it.
    """

    def __init__(self, every: int) -> None:
        self.every = every
        self.calls = 0
        self.delegate = DeterministicEmbedder()

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        self.calls += 1
        vectors = self.delegate.embed(texts)
        return [
            None if index % self.every == 0 else vector
            for index, vector in enumerate(vectors)
        ]
