"""Ingestion worker stages.

The worker owns deterministic extraction, cleaning, chunking, and queue
mechanics. Embedding calls go through the provider adapter. Every stage is
idempotent: extract replaces chunks only after a successful extraction,
embedding resumes through a NULL-scan, and publish re-verifies all chunks
before flipping the material to `ready` atomically.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Protocol

from .chunking import chunk_segments, document_segments
from .embeddings import DEFAULT_BATCH_SIZE, EMBEDDING_MODEL, Embedder
from .extractors import (
    Fetcher,
    PdfTextReader,
    TranscriptClient,
    extract_material,
)
from .models import PROGRESS_BY_STAGE, ContentChunk, IngestionError, Material
from .queue import (
    DEFAULT_VISIBILITY_SECONDS,
    EMBED_QUEUE,
    EXTRACT_QUEUE,
    PUBLISH_QUEUE,
    WorkQueue,
)
from .repository import IngestionRepo, StorageClient
from .telemetry import (
    EMBEDDING_TEMPLATE_VERSION,
    INGESTION_TEMPLATE_VERSION,
    STAGE_CHUNK,
    STAGE_EMBED,
    STAGE_EMBED_BATCH,
    STAGE_EXTRACT,
    STAGE_PUBLISH,
    STAGE_UPLOAD,
    TelemetryRecord,
    TelemetrySink,
    outcome_for_error_code,
)

logger = logging.getLogger("ingestion.worker")


class TokenCounter(Protocol):
    def __call__(self, text: str) -> int: ...


@dataclass(frozen=True)
class WorkerConfig:
    batch_size: int = DEFAULT_BATCH_SIZE
    visibility_seconds: int = DEFAULT_VISIBILITY_SECONDS
    poll_interval_seconds: float = 1.0
    max_deliveries: int = 3
    max_in_flight: int = 1
    max_batch_tokens: int = 4000
    max_tokens_per_minute: int = 25000


class TokenRateLimiter:
    """Sliding-window provider token budget (TPM throttling).

    The free Gemini tier budgets ~30 k input tokens per minute
    (`INGESTION_MAX_TOKENS_PER_MINUTE`, default 25 k for headroom); a worker
    that blasts embedding batches back-to-back trips the wall after ~8 calls
    and fails the material with `quota_exhausted`. This limiter sleeps until
    the oldest call leaves the 60 s window instead of failing.
    """

    def __init__(
        self,
        max_tokens_per_minute: int,
        now_fn: Callable[[], float] = time.monotonic,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        self._max = max_tokens_per_minute
        self._now = now_fn
        self._sleep = sleep_fn
        self._events: list[tuple[float, int]] = []

    def wait_for(self, tokens: int) -> None:
        if self._max <= 0 or tokens <= 0:
            return
        if tokens > self._max:
            # A single over-budget call (indivisible oversized chunk) cannot
            # be split further; send it rather than waiting forever.
            return
        window = 60.0
        while True:
            now = self._now()
            cutoff = now - window
            self._events = [(t, n) for t, n in self._events if t > cutoff]
            if sum(n for _, n in self._events) + tokens <= self._max:
                self._events.append((now, tokens))
                return
            oldest = min(t for t, _ in self._events) if self._events else now
            self._sleep(oldest + window - now + 0.05)


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
        telemetry: TelemetrySink | None = None,
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
        self.telemetry = telemetry or _NullSink()
        self._rate_limiter = TokenRateLimiter(self.config.max_tokens_per_minute)

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
        messages = self.queue.poll(
            queue_name, self.config.visibility_seconds, self.config.max_in_flight
        )
        for message in messages:
            started = time.perf_counter()
            try:
                handler(message)
                self.queue.complete(queue_name, message.msg_id, True)
            except _SkipMessage:
                self.queue.complete(queue_name, message.msg_id, True)
            except IngestionError as exc:
                self._emit_stage_failure(
                    queue_name,
                    message.payload,
                    exc,
                    (time.perf_counter() - started) * 1000.0,
                )
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

    def _emit_telemetry(self, records: list[TelemetryRecord]) -> None:
        """Best-effort telemetry: a sink failure must never fail the stage."""
        try:
            self.telemetry.emit(records)
        except Exception:
            logger.warning("telemetry emission failed", exc_info=True)

    def _emit_stage_failure(
        self, queue_name: str, payload: dict, error: IngestionError, latency_ms: float
    ) -> None:
        stage = {
            EXTRACT_QUEUE: STAGE_EXTRACT,
            EMBED_QUEUE: STAGE_EMBED,
            PUBLISH_QUEUE: STAGE_PUBLISH,
        }.get(queue_name)
        if not stage:
            return
        job_id = payload.get("jobId")
        if not job_id:
            return
        try:
            job = self.repo.get_job(job_id)
        except Exception:
            return
        model = _model_for_kind(payload.get("kind")) if stage == STAGE_EXTRACT else "local"
        self._emit_telemetry(
            [
                TelemetryRecord(
                    trace_id=job.correlation_id,
                    owner_id=job.owner_id,
                    task="ingestion",
                    model=model,
                    prompt_template_version=INGESTION_TEMPLATE_VERSION,
                    outcome=outcome_for_error_code(error.code),
                    latency_ms=latency_ms,
                    material_id=payload.get("materialId") or job.material_id,
                    attempt=payload.get("attempt") or 1,
                    stage=stage,
                )
            ]
        )

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
        attempt = payload.get("attempt") or 1
        self.repo.set_job_running(job_id)
        self.repo.set_material_state(material.id, "extracting", PROGRESS_BY_STAGE["extracting"])

        if material.kind == "file":
            read_source = _FileSourceReader(self.storage)
        else:
            read_source = _MissingSourceReader()

        started = time.perf_counter()
        content = extract_material(
            material,
            fetcher=self.fetcher,
            pdf_reader=self.pdf_reader,
            transcripts=self.transcripts,
            read_source=read_source,
        )
        self._emit_telemetry(
            [
                TelemetryRecord(
                    trace_id=correlation_id,
                    owner_id=material.owner_id,
                    task="ingestion",
                    model=_model_for_kind(material.kind),
                    prompt_template_version=INGESTION_TEMPLATE_VERSION,
                    outcome="ok",
                    latency_ms=(time.perf_counter() - started) * 1000.0,
                    material_id=material.id,
                    attempt=attempt,
                    stage=STAGE_EXTRACT,
                )
            ]
        )

        started = time.perf_counter()
        fulltext_path = f"{material.owner_id}/{material.id}/fulltext.txt"
        self.storage.upload(fulltext_path, content.text.encode("utf-8"), "text/plain")
        self._emit_telemetry(
            [
                TelemetryRecord(
                    trace_id=correlation_id,
                    owner_id=material.owner_id,
                    task="ingestion",
                    model="supabase-storage",
                    prompt_template_version=INGESTION_TEMPLATE_VERSION,
                    outcome="ok",
                    latency_ms=(time.perf_counter() - started) * 1000.0,
                    material_id=material.id,
                    attempt=attempt,
                    stage=STAGE_UPLOAD,
                )
            ]
        )

        started = time.perf_counter()
        chunks = chunk_segments(document_segments(content), self.token_counter)
        chunks = [
            replace(chunk, material_id=material.id, chunk_id=uuid.uuid4().hex)
            for chunk in chunks
        ]
        self._emit_telemetry(
            [
                TelemetryRecord(
                    trace_id=correlation_id,
                    owner_id=material.owner_id,
                    task="ingestion",
                    model="tiktoken-cl100k",
                    prompt_template_version=INGESTION_TEMPLATE_VERSION,
                    outcome="ok",
                    latency_ms=(time.perf_counter() - started) * 1000.0,
                    material_id=material.id,
                    attempt=attempt,
                    stage=STAGE_CHUNK,
                )
            ]
        )

        # Resume-on-retry (baseline C2): when the previous attempt failed after
        # extraction (e.g. embedding quota), the new extraction of the same
        # source is byte-identical. Reusing the existing chunk rows preserves
        # the embeddings that already succeeded, so the embed stage's NULL-scan
        # only pays for the missing vectors instead of the whole book again.
        # Chunks are still replaced (not merged) whenever the text differs.
        existing_chunks = self.repo.list_chunks(material.id)
        if [chunk.text for chunk in existing_chunks] == [chunk.text for chunk in chunks]:
            chunks = existing_chunks
        else:
            # Prior chunks (from a replaced or earlier attempt) are cleared
            # only after the new extraction succeeded (D-05).
            self.repo.replace_chunks(material.id, chunks, material.owner_id)
        self.repo.set_material_state(
            material.id,
            "chunking",
            PROGRESS_BY_STAGE["chunking"],
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
        provider = getattr(self.embedder, "provider_name", None)
        if (
            provider
            and material.embedding_provider
            and material.embedding_provider != provider
        ):
            # Vectors from different models do not share an embedding space;
            # a material must be re-embedded wholesale before a new provider
            # may write into it (reembed_materials.py nulls chunk vectors and
            # resets the column first).
            raise IngestionError(
                "validation_failed",
                f"material was embedded with {material.embedding_provider}; "
                f"re-embed with {provider} required before new embeddings can be written",
            )
        self.repo.set_job_running(job_id)
        self.repo.set_material_state(material.id, "embedding", PROGRESS_BY_STAGE["embedding"])
        if provider:
            self.repo.set_material_state(
                material.id, "embedding", PROGRESS_BY_STAGE["embedding"],
                embedding_provider=provider,
            )

        # Every provider adapter reports per-call stats through its optional
        # observer slot; the adapter turns them into telemetry records for
        # this attempt. Test doubles without the slot skip attachment.
        observer = _TelemetryEmbeddingObserver(
            self._emit_telemetry,
            material_id=material.id,
            owner_id=material.owner_id,
            trace_id=correlation_id,
            attempt=payload.get("attempt") or 1,
            model=getattr(self.embedder, "telemetry_model", EMBEDDING_MODEL),
        )
        if hasattr(self.embedder, "observer"):
            self.embedder.observer = observer

        started = time.perf_counter()
        while True:
            batch = self.repo.list_unembedded_chunks(material.id, self.config.batch_size)
            if not batch:
                break
            vectors = self._embed_batch(batch)
            if len(vectors) != len(batch):
                raise IngestionError(
                    "internal_error", "embedder returned the wrong number of vectors"
                )
            embedded: list[tuple[str, list[float]]] = []
            for chunk, vector in zip(batch, vectors):
                if vector is None:
                    # A provider zero vector is garbage for one chunk: flag it
                    # so the NULL-scan stops returning it, and let the rest of
                    # the material keep moving.
                    self.repo.flag_chunk(material.id, chunk.chunk_id)
                else:
                    embedded.append((chunk.chunk_id, vector))
            self.repo.update_chunk_embeddings(material.id, embedded)

        embed_ms = (time.perf_counter() - started) * 1000.0
        self._emit_telemetry(
            [
                TelemetryRecord(
                    trace_id=correlation_id,
                    owner_id=material.owner_id,
                    task="ingestion",
                    model="local",
                    prompt_template_version=INGESTION_TEMPLATE_VERSION,
                    outcome="ok",
                    latency_ms=embed_ms,
                    input_tokens=observer.total_tokens if observer is not None else 0,
                    material_id=material.id,
                    attempt=payload.get("attempt") or 1,
                    stage=STAGE_EMBED,
                )
            ]
        )

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

    def _embed_batch(self, chunks: list[ContentChunk]) -> list[list[float]]:
        """Embed one batch, splitting it by estimated token budget.

        The provider batch limit is a count of 100 requests, but a pathological
        oversized chunk (an indivisible token kept whole by the chunker) can
        make a single request larger than the provider payload limit. Splitting
        by tokens bounds every request size; chunk order and identity are
        preserved. Each sub-batch waits on the per-minute token budget so the
        provider's TPM quota is never exceeded (a burst otherwise fails the
        whole material with `quota_exhausted`).
        """
        vectors: list[list[float]] = []
        for sub_batch in self._split_batch_by_tokens(chunks):
            tokens = sum(self.token_counter(chunk.text) for chunk in sub_batch)
            self._rate_limiter.wait_for(tokens)
            vectors.extend(self.embedder.embed([chunk.text for chunk in sub_batch]))
        return vectors

    def _split_batch_by_tokens(self, chunks: list[ContentChunk]) -> list[list[ContentChunk]]:
        batches: list[list[ContentChunk]] = []
        current: list[ContentChunk] = []
        current_tokens = 0
        for chunk in chunks:
            tokens = self.token_counter(chunk.text)
            if current and current_tokens + tokens > self.config.max_batch_tokens:
                batches.append(current)
                current = []
                current_tokens = 0
            current.append(chunk)
            current_tokens += tokens
        if current:
            batches.append(current)
        return batches

    # ------------------------------------------------------------------
    # Stage 3: atomic ready publish
    # ------------------------------------------------------------------

    def _handle_publish(self, message) -> None:
        payload = message.payload
        material, job_id, correlation_id = self._guard(payload, {"embedding", "ready"})
        if material.ingestion_state == "ready":
            # Belt-and-braces: a redelivered publish message for an
            # already-ready material is a duplicate, not a re-publish.
            raise _SkipMessage()
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

        if self.repo.embedded_chunk_count(material.id) == 0:
            # Every chunk was flagged (provider zero vectors): nothing is
            # embeddable, so the attempt fails validation instead of
            # publishing an empty grounding set.
            raise IngestionError(
                "validation_failed", "no embeddable chunks were produced"
            )

        # Publish must be atomic in the store: the material flips to ready and
        # the job succeeds as one operation (DB-level transaction in the
        # repository adapter), so a crash cannot leave a ready material with a
        # non-succeeded job or a job that succeeded without a ready material.
        started = time.perf_counter()
        self.repo.publish_ready(
            material_id=material.id,
            job_id=job_id,
            chunk_count=total,
            grounding_version=material.content_version,
            result_id=material.id,
        )
        self._emit_telemetry(
            [
                TelemetryRecord(
                    trace_id=correlation_id,
                    owner_id=material.owner_id,
                    task="ingestion",
                    model="supabase-rpc",
                    prompt_template_version=INGESTION_TEMPLATE_VERSION,
                    outcome="ok",
                    latency_ms=(time.perf_counter() - started) * 1000.0,
                    material_id=material.id,
                    attempt=payload.get("attempt") or 1,
                    stage=STAGE_PUBLISH,
                )
            ]
        )


class _SkipMessage(IngestionError):
    """Internal signal: the message is a duplicate or already handled."""

    def __init__(self) -> None:
        super().__init__("conflict", "message already handled")


class _PersistenceFailure(Exception):
    """Internal signal: the failure state could not be persisted."""


class _NullSink:
    """Default telemetry sink when the worker is constructed without one."""

    def emit(self, records: list[TelemetryRecord]) -> None:
        pass


def _model_for_kind(kind: str | None) -> str:
    return {
        "file": "pypdf",
        "url": "trafilatura",
        "youtube": "youtube-transcript",
        "manual": "local",
    }.get(kind or "", "local")


class _TelemetryEmbeddingObserver:
    """Turns provider EmbeddingStats into telemetry records for one attempt.

    Also accumulates the batch totals so the embed-stage aggregate record can
    report the same numbers without a second token pass.
    """

    def __init__(
        self,
        emit: Callable[[list[TelemetryRecord]], None],
        *,
        material_id: str,
        owner_id: str,
        trace_id: str,
        attempt: int,
        model: str = EMBEDDING_MODEL,
    ) -> None:
        self._emit = emit
        self._material_id = material_id
        self._owner_id = owner_id
        self._trace_id = trace_id
        self._attempt = attempt
        self._model = model
        self.total_tokens = 0
        self.total_latency_ms = 0.0
        self.batches = 0

    def on_completed(self, stats) -> None:
        self.batches += 1
        self.total_tokens += stats.tokens
        self.total_latency_ms += stats.latency_ms
        self._emit(
            [
                TelemetryRecord(
                    trace_id=self._trace_id,
                    owner_id=self._owner_id,
                    task="embedding",
                    model=self._model,
                    prompt_template_version=EMBEDDING_TEMPLATE_VERSION,
                    outcome=stats.outcome,
                    latency_ms=stats.latency_ms,
                    input_tokens=stats.tokens,
                    repair_attempted=stats.attempts > 1,
                    texts_count=stats.texts_count,
                    material_id=self._material_id,
                    attempt=self._attempt,
                    stage=STAGE_EMBED_BATCH,
                )
            ]
        )
