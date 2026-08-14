"""Ingestion worker stages.

The worker owns deterministic extraction, cleaning, chunking, and queue
mechanics. Embedding calls go through the provider adapter. Every stage is
idempotent: extract replaces chunks only after a successful extraction,
embedding resumes through a NULL-scan, and publish re-verifies all chunks
before flipping the material to `ready` atomically.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Protocol

from .chunking import chunk_segments, document_segments
from .embeddings import DEFAULT_BATCH_SIZE, Embedder
from .extractors import (
    Fetcher,
    PdfTextReader,
    TranscriptClient,
    extract_material,
)
from .models import IngestionError, Material
from .queue import (
    DEFAULT_VISIBILITY_SECONDS,
    EMBED_QUEUE,
    EXTRACT_QUEUE,
    PUBLISH_QUEUE,
    WorkQueue,
)
from .repository import IngestionRepo, StorageClient


class TokenCounter(Protocol):
    def __call__(self, text: str) -> int: ...


@dataclass(frozen=True)
class WorkerConfig:
    batch_size: int = DEFAULT_BATCH_SIZE
    visibility_seconds: int = DEFAULT_VISIBILITY_SECONDS
    poll_interval_seconds: float = 1.0
    max_deliveries: int = 3


class _FileSourceReader:
    """Reads an uploaded file material from private Storage."""

    def __init__(self, storage: StorageClient) -> None:
        self._storage = storage

    def read(self, material: Material) -> bytes:
        return self._storage.download(f"{material.owner_id}/{material.id}/{material.source}")


class _MissingSourceReader:
    """Refuses reads for non-file materials; never called by the extractor."""

    def read(self, material: Material) -> bytes:
        raise IngestionError("validation_failed", "file object is missing")


class IngestionWorker:
    def __init__(
        self,
        repo: IngestionRepo,
        queue: WorkQueue,
        storage: StorageClient,
        fetcher: Fetcher,
        pdf_reader: PdfTextReader,
        transcripts: TranscriptClient,
        embedder: Embedder,
        token_counter: TokenCounter,
        config: WorkerConfig | None = None,
    ) -> None:
        self.repo = repo
        self.queue = queue
        self.storage = storage
        self.fetcher = fetcher
        self.pdf_reader = pdf_reader
        self.transcripts = transcripts
        self.embedder = embedder
        self.token_counter = token_counter
        self.config = config or WorkerConfig()

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    def run_once(self, queue_name: str | None = None) -> int:
        """Drain one stage queue, or every stage when no queue is named."""
        if queue_name is not None:
            return self._drain(queue_name, self._handler_for(queue_name))
        processed = 0
        processed += self._drain(EXTRACT_QUEUE, self._handle_extract)
        processed += self._drain(EMBED_QUEUE, self._handle_embed)
        processed += self._drain(PUBLISH_QUEUE, self._handle_publish)
        return processed

    def _handler_for(self, queue_name: str):
        return {
            EXTRACT_QUEUE: self._handle_extract,
            EMBED_QUEUE: self._handle_embed,
            PUBLISH_QUEUE: self._handle_publish,
        }[queue_name]

    def run_forever(self, stop: Callable[[], bool] | None = None) -> None:
        while stop is None or not stop():
            self.run_once()
            time.sleep(self.config.poll_interval_seconds)

    # ------------------------------------------------------------------
    # Queue plumbing
    # ------------------------------------------------------------------

    def _drain(self, queue_name: str, handler) -> int:
        messages = self.queue.poll(queue_name, self.config.visibility_seconds)
        for message in messages:
            try:
                handler(message)
                self.queue.complete(queue_name, message.msg_id, True)
            except _SkipMessage:
                self.queue.complete(queue_name, message.msg_id, True)
            except IngestionError as exc:
                if not exc.retryable or message.read_ct >= self.config.max_deliveries:
                    # Terminal errors fail immediately; transient errors fail
                    # after bounded redelivery. Either way the message is
                    # archived so the user can retry the attempt.
                    try:
                        self._fail_attempt(message, exc)
                        self.queue.complete(queue_name, message.msg_id, True)
                    except _PersistenceFailure:
                        # The failure state could not be persisted: keep the
                        # message in flight so it redelivers once the store
                        # recovers instead of archiving an unrecorded failure.
                        self.queue.complete(queue_name, message.msg_id, False)
                else:
                    # Transient failure with redelivery headroom: leave the
                    # material/job state so the same attempt resumes, and make
                    # the message visible again (pgmq set_vt 0).
                    self.queue.complete(queue_name, message.msg_id, False)
        return len(messages)

    def _fail_attempt(self, message, error: IngestionError) -> None:
        """Persist the failed state for an attempt; raise if it cannot be stored."""
        payload = message.payload
        job_id = payload.get("jobId")
        material_id = payload.get("materialId")
        if job_id:
            try:
                self.repo.set_job_failed(job_id, error.code, error.message, error.retryable)
            except Exception as exc:
                raise _PersistenceFailure() from exc
        if material_id:
            try:
                self.repo.set_material_state(
                    material_id,
                    "failed",
                    0,
                    error_code=error.code,
                    error_message=error.message,
                    retryable=error.retryable,
                )
            except Exception as exc:
                raise _PersistenceFailure() from exc

    def _guard(self, payload: dict, allowed_states: set[str]) -> tuple[Material, str, str]:
        material_id = payload.get("materialId")
        job_id = payload.get("jobId")
        if not material_id or not job_id:
            raise IngestionError("validation_failed", "queue payload is malformed")
        material = self.repo.get_material(material_id)
        job = self.repo.get_job(job_id)
        if job.status in {"succeeded", "failed", "cancelled"}:
            raise _SkipMessage()
        if material.ingestion_state not in allowed_states:
            raise _SkipMessage()
        if job.material_id != material.id:
            raise IngestionError("validation_failed", "job does not belong to the material")
        if job.owner_id != material.owner_id:
            raise IngestionError("validation_failed", "job owner does not match the material")
        payload_owner = payload.get("ownerId")
        if payload_owner and payload_owner != material.owner_id:
            raise IngestionError(
                "validation_failed", "queue payload owner does not match the material"
            )
        return material, job_id, job.correlation_id

    # ------------------------------------------------------------------
    # Stage 1: extract -> chunk -> store full text -> enqueue embed
    # ------------------------------------------------------------------

    def _handle_extract(self, message) -> None:
        payload = message.payload
        material, job_id, correlation_id = self._guard(payload, {"pending", "extracting"})
        self.repo.set_job_running(job_id)
        self.repo.set_material_state(material.id, "extracting", 0.25)

        if material.kind == "file":
            read_source = _FileSourceReader(self.storage)
        else:
            read_source = _MissingSourceReader()

        content = extract_material(
            material,
            fetcher=self.fetcher,
            pdf_reader=self.pdf_reader,
            transcripts=self.transcripts,
            read_source=read_source,
        )

        fulltext_path = f"{material.owner_id}/{material.id}/fulltext.txt"
        self.storage.upload(fulltext_path, content.text.encode("utf-8"), "text/plain")

        chunks = chunk_segments(document_segments(content), self.token_counter)
        chunks = [
            replace(chunk, material_id=material.id, chunk_id=uuid.uuid4().hex)
            for chunk in chunks
        ]

        # Prior chunks (from a replaced or earlier attempt) are cleared only
        # after the new extraction succeeded (D-05).
        self.repo.replace_chunks(material.id, chunks, material.owner_id)
        self.repo.set_material_state(
            material.id,
            "chunking",
            0.5,
            chunk_count=len(chunks),
            extracted_text_path=fulltext_path,
        )
        self.queue.send(
            EMBED_QUEUE,
            {
                "jobId": job_id,
                "materialId": material.id,
                "ownerId": material.owner_id,
                "attempt": payload.get("attempt"),
                "correlationId": correlation_id,
            },
        )

    # ------------------------------------------------------------------
    # Stage 2: embed batches of 100 with NULL-scan resume
    # ------------------------------------------------------------------

    def _handle_embed(self, message) -> None:
        payload = message.payload
        material, job_id, correlation_id = self._guard(payload, {"chunking", "embedding"})
        self.repo.set_job_running(job_id)
        self.repo.set_material_state(material.id, "embedding", 0.6)

        while True:
            batch = self.repo.list_unembedded_chunks(material.id, self.config.batch_size)
            if not batch:
                break
            vectors = self.embedder.embed([chunk.text for chunk in batch])
            if len(vectors) != len(batch):
                raise IngestionError(
                    "internal_error", "embedder returned the wrong number of vectors"
                )
            for chunk, vector in zip(batch, vectors):
                self.repo.update_chunk_embedding(chunk.chunk_id, vector)

        if self.repo.unembedded_chunk_count(material.id) == 0:
            self.queue.send(
                PUBLISH_QUEUE,
                {
                    "jobId": job_id,
                    "materialId": material.id,
                    "ownerId": material.owner_id,
                    "attempt": payload.get("attempt"),
                    "correlationId": correlation_id,
                },
            )

    # ------------------------------------------------------------------
    # Stage 3: atomic ready publish
    # ------------------------------------------------------------------

    def _handle_publish(self, message) -> None:
        payload = message.payload
        material, job_id, _ = self._guard(payload, {"embedding", "ready"})
        self.repo.set_job_running(job_id)

        missing = self.repo.unembedded_chunk_count(material.id)
        if missing > 0:
            # Resume embedding: partial batches must never become ready.
            self.queue.send(
                EMBED_QUEUE,
                {
                    "jobId": payload.get("jobId"),
                    "materialId": material.id,
                    "ownerId": material.owner_id,
                    "attempt": payload.get("attempt"),
                    "correlationId": payload.get("correlationId"),
                },
            )
            return

        total = self.repo.all_chunk_count(material.id)
        if total == 0:
            raise IngestionError("validation_failed", "no content chunks were produced")

        # Publish must be atomic in the store: the material flips to ready and
        # the job succeeds as one operation (DB-level transaction in the
        # repository adapter), so a crash cannot leave a ready material with a
        # non-succeeded job or a job that succeeded without a ready material.
        self.repo.publish_ready(
            material_id=material.id,
            job_id=job_id,
            chunk_count=total,
            grounding_version=material.content_version,
            result_id=material.id,
        )


class _SkipMessage(IngestionError):
    """Internal signal: the message is a duplicate or already handled."""

    def __init__(self) -> None:
        super().__init__("conflict", "message already handled")


class _PersistenceFailure(Exception):
    """Internal signal: the failure state could not be persisted."""
