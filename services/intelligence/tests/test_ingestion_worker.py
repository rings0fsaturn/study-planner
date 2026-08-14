from __future__ import annotations

import uuid

from app.ingestion.models import PROGRESS_BY_STAGE, IngestionError, IngestionJob, Material
from app.ingestion.queue import EMBED_QUEUE, EXTRACT_QUEUE, PUBLISH_QUEUE
from app.ingestion.worker import IngestionWorker, WorkerConfig
from tests.ingestion_doubles import (
    DeterministicEmbedder,
    FailingEmbedder,
    FakeIngestionRepo,
    FakeQueue,
    InMemoryStorage,
    ZeroVectorEmbedder,
)
from tests.test_extractors import FakeFetcher, FakePdfReader, FakeTranscripts


def make_material(kind: str = "manual", source: str = "body text") -> Material:
    return Material(
        id="mat-1",
        owner_id="user-1",
        title="A material",
        kind=kind,  # type: ignore[arg-type]
        source=source,
        ingestion_state="pending",
        content_version="v1",
        created_at="2026-08-14T00:00:00Z",
        updated_at="2026-08-14T00:00:00Z",
    )


def make_worker(
    *,
    repo: FakeIngestionRepo | None = None,
    queue: FakeQueue | None = None,
    storage: InMemoryStorage | None = None,
    fetcher: FakeFetcher | None = None,
    pdf_reader: FakePdfReader | None = None,
    transcripts: FakeTranscripts | None = None,
    embedder=None,
    batch_size: int = 2,
    max_deliveries: int = 3,
    max_in_flight: int = 1,
    max_batch_tokens: int = 4000,
) -> tuple[IngestionWorker, FakeIngestionRepo, FakeQueue, InMemoryStorage]:
    repo = repo or FakeIngestionRepo()
    queue = queue or FakeQueue()
    storage = storage or InMemoryStorage()
    worker = IngestionWorker(
        repo=repo,
        queue=queue,
        storage=storage,
        fetcher=fetcher or FakeFetcher("<html><body>page</body></html>"),
        pdf_reader=pdf_reader or FakePdfReader(),
        transcripts=transcripts or FakeTranscripts(),
        embedder=embedder or DeterministicEmbedder(),
        token_counter=lambda text: len(text.split()),
        config=WorkerConfig(
            batch_size=batch_size,
            max_deliveries=max_deliveries,
            max_in_flight=max_in_flight,
            max_batch_tokens=max_batch_tokens,
        ),
    )
    return worker, repo, queue, storage


def seed_and_enqueue(
    repo: FakeIngestionRepo,
    queue: FakeQueue,
    material: Material,
    attempt: int = 1,
) -> str:
    """Seed the material and a consistent job row, then enqueue extraction."""
    job_id = uuid.uuid4().hex
    repo.seed_material(material)
    repo.seed_job(
        IngestionJob(
            id=job_id,
            owner_id=material.owner_id,
            material_id=material.id,
            status="queued",
            attempt=attempt,
            correlation_id=uuid.uuid4().hex,
        )
    )
    queue.send(
        EXTRACT_QUEUE,
        {
            "jobId": job_id,
            "materialId": material.id,
            "ownerId": material.owner_id,
            "attempt": attempt,
            "correlationId": uuid.uuid4().hex,
            "kind": material.kind,
            "title": material.title,
            "source": material.source,
        },
    )
    return job_id


def run_pipeline(worker: IngestionWorker, queue: FakeQueue) -> None:
    for _ in range(6):
        pending = (
            len(queue.queues.get(EXTRACT_QUEUE) or [])
            + len(queue.queues.get(EMBED_QUEUE) or [])
            + len(queue.queues.get(PUBLISH_QUEUE) or [])
        )
        if pending == 0:
            break
        worker.run_once()


def test_text_material_reaches_ready_atomically() -> None:
    worker, repo, queue, storage = make_worker()
    material = make_material()
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    row = repo.materials["mat-1"]
    assert row["ingestion_state"] == "ready"
    assert row["ingestion_progress"] == 1.0
    assert row["grounding_version"] == "v1"
    assert row["chunk_count"] > 0
    assert repo.jobs[job_id]["status"] == "succeeded"
    assert repo.jobs[job_id]["result_id"] == "mat-1"
    assert all(chunk["embedding"] is not None for chunk in repo.chunks.values())
    assert storage.objects["user-1/mat-1/fulltext.txt"]
    assert not queue.queues.get(EXTRACT_QUEUE)
    assert not queue.queues.get(PUBLISH_QUEUE)


def test_max_in_flight_bounds_messages_processed_per_cycle() -> None:
    worker, repo, queue, _ = make_worker(max_in_flight=1)
    job_ids = []
    for index in range(3):
        material = make_material(source=f"material {index} content")
        material = Material(**{**vars(material), "id": f"mat-{index}"})
        job_ids.append(seed_and_enqueue(repo, queue, material))

    # One poll cycle may take at most max_in_flight messages: the other two
    # extract messages stay visible for later cycles (backpressure).
    worker.run_once(EXTRACT_QUEUE)
    remaining = queue.queues.get(EXTRACT_QUEUE) or []
    assert len(remaining) == 2
    assert repo.materials["mat-0"]["ingestion_state"] == "chunking"
    assert repo.materials["mat-1"]["ingestion_state"] == "pending"
    assert repo.materials["mat-2"]["ingestion_state"] == "pending"

    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    assert len(queue.queues.get(EXTRACT_QUEUE) or []) == 1

    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-2"]["ingestion_state"] == "chunking"
    assert not queue.queues.get(EXTRACT_QUEUE)


def test_max_in_flight_can_be_raised() -> None:
    worker, repo, queue, _ = make_worker(max_in_flight=5)
    for index in range(3):
        material = make_material(source=f"material {index} content")
        material = Material(**{**vars(material), "id": f"mat-{index}"})
        seed_and_enqueue(repo, queue, material)

    worker.run_once(EXTRACT_QUEUE)
    assert not queue.queues.get(EXTRACT_QUEUE)
    assert all(
        repo.materials[f"mat-{index}"]["ingestion_state"] == "chunking"
        for index in range(3)
    )


def test_worker_progress_writes_match_shared_stage_map() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="one two three four five six seven eight nine ten")
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_progress"] == PROGRESS_BY_STAGE["chunking"]
    worker.run_once(EMBED_QUEUE)
    assert repo.materials["mat-1"]["ingestion_progress"] == PROGRESS_BY_STAGE["embedding"]
    worker.run_once(PUBLISH_QUEUE)
    assert repo.materials["mat-1"]["ingestion_progress"] == PROGRESS_BY_STAGE["ready"]


def test_transient_extraction_failure_redelivers_then_fails_after_bounded_deliveries() -> None:
    fetcher = FakeFetcher(None)
    worker, repo, queue, _ = make_worker(fetcher=fetcher, max_deliveries=3)
    material = make_material(kind="url", source="https://example.com/a")
    job_id = seed_and_enqueue(repo, queue, material)

    # First two deliveries fail transiently: the same attempt resumes and the
    # message is redelivered without flipping the material to failed.
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "extracting"
    assert repo.jobs[job_id]["status"] == "running"
    assert ("material_extract", 1) in queue.redelivered

    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "extracting"

    # Third delivery exceeds max_deliveries: attempt fails, message archived.
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["status"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "provider_unavailable"
    assert repo.jobs[job_id]["retryable"] is True
    assert not queue.queues.get(EXTRACT_QUEUE)


def test_contentless_manual_material_is_terminal() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(kind="manual", source="")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once()

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"
    assert repo.jobs[job_id]["retryable"] is False
    assert ("material_extract", 1) not in queue.redelivered
    assert not queue.queues.get(EXTRACT_QUEUE)


def test_file_material_with_missing_object_fails_validation() -> None:
    worker, repo, queue, storage = make_worker()
    material = make_material(kind="file", source="paper.pdf")
    job_id = seed_and_enqueue(repo, queue, material)
    # No object uploaded: the worker must reject without creating chunks.
    worker.run_once()

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"
    assert repo.chunks == {}


def test_file_material_with_upload_extracts_and_readies() -> None:
    worker, repo, queue, storage = make_worker()
    material = make_material(kind="file", source="paper.pdf")
    storage.objects["user-1/mat-1/paper.pdf"] = b"pdf bytes"
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job_id]["status"] == "succeeded"


def test_embedding_quota_is_terminal_immediately() -> None:
    embedder = FailingEmbedder(1, IngestionError("quota_exhausted", "quota"))
    worker, repo, queue, _ = make_worker(embedder=embedder, batch_size=2, max_deliveries=5)
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)  # extract -> enqueue embed
    worker.run_once(EMBED_QUEUE)  # embed fails with quota: terminal, no redelivery

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "quota_exhausted"
    assert repo.jobs[job_id]["retryable"] is False
    assert not queue.queues.get(EMBED_QUEUE)


def test_embedding_resume_embeds_only_missing_chunks() -> None:
    worker, repo, queue, _ = make_worker(batch_size=2)
    material = make_material(source="a b c d e f g h i j k l m n o p q r s t")
    seed_and_enqueue(repo, queue, material)

    # Crash after extraction: chunks exist, embedding never ran.
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    assert queue.queues.get(EMBED_QUEUE)

    # Run the remaining stages; the embedder must see every chunk exactly once.
    while queue.queues.get(EMBED_QUEUE):
        worker.run_once(EMBED_QUEUE)
    worker.run_once(PUBLISH_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert all(chunk["embedding"] is not None for chunk in repo.chunks.values())


def test_partial_embedding_never_publishes_ready() -> None:
    worker, repo, queue, _ = make_worker(batch_size=100)
    material = make_material(source="one two three four five six seven eight nine ten")
    seed_and_enqueue(repo, queue, material)

    worker.run_once(EXTRACT_QUEUE)  # extract -> enqueue embed
    worker.run_once(EMBED_QUEUE)  # embed completes -> enqueue publish

    # Simulate a crash between embedding and publishing: one chunk lost its
    # vector. Publishing must resume embedding, never flip ready.
    missing_chunk = next(iter(repo.chunks.values()))
    repo.update_chunk_embedding(missing_chunk["id"], None)  # type: ignore[arg-type]
    worker.run_once(PUBLISH_QUEUE)  # publish detects the gap -> re-enqueues embed

    assert repo.materials["mat-1"]["ingestion_state"] == "embedding"
    assert queue.queues.get(EMBED_QUEUE)

    worker.run_once(EMBED_QUEUE)  # resume: embed the missing chunk
    worker.run_once(PUBLISH_QUEUE)  # publish again -> ready
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert all(chunk["embedding"] is not None for chunk in repo.chunks.values())


def test_duplicate_extract_message_is_skipped() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material()
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"

    # Redelivered duplicate of the original extract message: skipped, not
    # reprocessed, chunk rows unchanged.
    queue.send(
        EXTRACT_QUEUE,
        {
            "jobId": job_id,
            "materialId": "mat-1",
            "ownerId": "user-1",
            "attempt": 1,
            "correlationId": "c1",
            "kind": "manual",
            "source": "body text",
        },
    )
    worker.run_once()
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert len(repo.chunks) == repo.materials["mat-1"]["chunk_count"]


def test_retry_creates_new_attempt_and_replaces_chunks_only_after_extraction() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="first attempt content " * 20)
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)
    old_chunk_texts = {chunk["text"] for chunk in repo.chunks.values()}
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"

    # User retry (D-05): a new job/attempt re-enqueues; old chunks must
    # survive until the new extraction succeeds.
    from dataclasses import replace

    material = replace(
        repo.get_material("mat-1"),
        ingestion_state="pending",
        source="new attempt content " * 20,
    )
    job2 = seed_and_enqueue(repo, queue, material, attempt=2)
    worker.run_once(EXTRACT_QUEUE)
    # Extraction succeeded: only now were the old chunks replaced (D-05).
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    new_chunk_texts = {chunk["text"] for chunk in repo.chunks.values()}
    assert new_chunk_texts != old_chunk_texts

    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job2]["status"] == "succeeded"
    assert "new attempt content" in next(iter(repo.chunks.values()))["text"]


def test_malformed_payload_is_validation_failure() -> None:
    worker, repo, queue, _ = make_worker()
    repo.seed_material(make_material())
    queue.send(EXTRACT_QUEUE, {"materialId": "mat-1"})  # missing jobId
    worker.run_once(EXTRACT_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.materials["mat-1"]["ingestion_error"] == "queue payload is malformed"
    assert not queue.queues.get(EXTRACT_QUEUE)


def test_job_material_mismatch_is_validation_failure() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material()
    repo.seed_material(material)
    job_id = uuid.uuid4().hex
    repo.seed_job(
        IngestionJob(
            id=job_id,
            owner_id=material.owner_id,
            material_id="other-mat",
            status="queued",
            attempt=1,
            correlation_id=uuid.uuid4().hex,
        )
    )
    queue.send(EXTRACT_QUEUE, {"jobId": job_id, "materialId": "mat-1"})
    worker.run_once(EXTRACT_QUEUE)

    assert repo.jobs[job_id]["status"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"


def test_payload_owner_mismatch_is_validation_failure() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material()
    repo.seed_material(material)
    job_id = uuid.uuid4().hex
    repo.seed_job(
        IngestionJob(
            id=job_id,
            owner_id=material.owner_id,
            material_id=material.id,
            status="queued",
            attempt=1,
            correlation_id=uuid.uuid4().hex,
        )
    )
    queue.send(EXTRACT_QUEUE, {"jobId": job_id, "materialId": "mat-1", "ownerId": "attacker"})
    worker.run_once(EXTRACT_QUEUE)

    assert repo.jobs[job_id]["status"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"


def test_job_owner_mismatch_is_validation_failure() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material()
    repo.seed_material(material)
    job_id = uuid.uuid4().hex
    repo.seed_job(
        IngestionJob(
            id=job_id,
            owner_id="other-user",
            material_id=material.id,
            status="queued",
            attempt=1,
            correlation_id=uuid.uuid4().hex,
        )
    )
    queue.send(EXTRACT_QUEUE, {"jobId": job_id, "materialId": "mat-1"})
    worker.run_once(EXTRACT_QUEUE)

    assert repo.jobs[job_id]["status"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"


def test_stale_extract_message_for_advanced_material_is_skipped() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    chunk_ids_before = sorted(chunk["id"] for chunk in repo.chunks.values())
    assert queue.queues.get(EMBED_QUEUE)

    # A redelivered duplicate extract message for the same job arrives while
    # the material is already chunking: it must be skipped, not re-extracted
    # (a re-extraction would replace the chunks with fresh ids).
    queue.send(
        EXTRACT_QUEUE,
        {
            "jobId": job_id,
            "materialId": "mat-1",
            "ownerId": "user-1",
            "attempt": 1,
            "correlationId": "c1",
            "kind": "manual",
            "source": "one two three four five six seven eight nine ten",
        },
    )
    worker.run_once(EXTRACT_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    assert sorted(chunk["id"] for chunk in repo.chunks.values()) == chunk_ids_before
    assert queue.queues.get(EMBED_QUEUE)

    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"


class CountingEmbedder:
    """Records each embedder call so sub-batch boundaries are observable."""

    def __init__(self) -> None:
        self.call_texts: list[list[str]] = []
        self.delegate = DeterministicEmbedder()

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.call_texts.append(list(texts))
        return self.delegate.embed(texts)


def test_embedding_splits_batches_by_token_budget() -> None:
    embedder = CountingEmbedder()
    worker, repo, queue, _ = make_worker(
        embedder=embedder,
        batch_size=100,
        max_batch_tokens=450,  # token_counter counts words
    )
    # ~900 words chunk into two ~400-token chunks; two chunks together exceed
    # the 450-token provider budget, so the worker must split them into
    # separate provider calls instead of one oversized request.
    material = make_material(source="word " * 900)
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    worker.run_once(EMBED_QUEUE)

    assert len(repo.chunks) >= 2
    total_texts = sum(len(texts) for texts in embedder.call_texts)
    assert total_texts == len(repo.chunks)
    assert len(embedder.call_texts) >= 2
    assert all(
        sum(len(text.split()) for text in texts) <= 450
        for texts in embedder.call_texts
    )

    worker.run_once(PUBLISH_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job_id]["status"] == "succeeded"
    assert all(chunk["embedding"] is not None for chunk in repo.chunks.values())


def test_zero_vector_chunk_is_flagged_and_material_readies() -> None:
    # Two chunks; the embedder returns a zero vector for every second one.
    embedder = ZeroVectorEmbedder(every=2)
    worker, repo, queue, _ = make_worker(embedder=embedder, batch_size=100)
    material = make_material(source="word " * 900)
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    worker.run_once(EMBED_QUEUE)

    chunks = sorted(repo.chunks.values(), key=lambda row: row["ordinal"])
    assert len(chunks) >= 2
    assert chunks[0]["embedding"] is None and chunks[0]["skipped"] is True
    assert chunks[1]["embedding"] is not None and chunks[1]["skipped"] is False
    # The flagged chunk must not resurface in the NULL-scan.
    assert repo.unembedded_chunk_count("mat-1") == 0

    worker.run_once(PUBLISH_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job_id]["status"] == "succeeded"
    assert repo.embedded_chunk_count("mat-1") >= 1


def test_all_zero_vector_chunks_fail_validation() -> None:
    embedder = ZeroVectorEmbedder(every=1)
    worker, repo, queue, _ = make_worker(embedder=embedder, batch_size=100)
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    worker.run_once(EMBED_QUEUE)
    worker.run_once(PUBLISH_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"
    assert repo.jobs[job_id]["retryable"] is False
    assert repo.embedded_chunk_count("mat-1") == 0
    assert not queue.queues.get(PUBLISH_QUEUE)


def test_redelivered_publish_for_ready_material_is_skipped() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    publish_calls_before = len(repo.publish_ready_calls)

    # Simulate the fragile window the guard exists for: a stale publish
    # message arrives while the job row is non-terminal and the material is
    # already ready. The worker must skip it without re-publishing.
    repo.jobs[job_id]["status"] = "running"
    queue.send(
        PUBLISH_QUEUE,
        {
            "jobId": job_id,
            "materialId": "mat-1",
            "ownerId": "user-1",
            "attempt": 1,
            "correlationId": "c1",
        },
    )
    worker.run_once(PUBLISH_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert len(repo.publish_ready_calls) == publish_calls_before
    assert not queue.queues.get(PUBLISH_QUEUE)


class WrongCountEmbedder:
    """Returns fewer vectors than inputs, simulating a broken provider."""

    def __init__(self) -> None:
        self.calls = 0

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls += 1
        if self.calls >= 3:
            raise AssertionError("embedder must not be called again")
        return [[1.0] * 3 for _ in texts[:-1]]


def test_embedder_count_mismatch_fails_the_attempt() -> None:
    worker, repo, queue, _ = make_worker(embedder=WrongCountEmbedder(), batch_size=100)
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    worker.run_once(EMBED_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "internal_error"
    assert not queue.queues.get(EMBED_QUEUE)


class FlakyJobUpdateRepo(FakeIngestionRepo):
    def __init__(self) -> None:
        super().__init__()
        self.fail_job_updates = False

    def set_job_failed(self, job_id: str, code: str, message: str, retryable: bool = False) -> None:
        if self.fail_job_updates:
            raise IngestionError("provider_unavailable", "db down", retryable=True)
        return super().set_job_failed(job_id, code, message, retryable)


def test_failure_state_persistence_failure_redelivers_instead_of_archiving() -> None:
    repo = FlakyJobUpdateRepo()
    worker, _, queue, _ = make_worker(repo=repo)
    material = make_material(kind="manual", source="")
    job_id = seed_and_enqueue(repo, queue, material)

    repo.fail_job_updates = True
    worker.run_once(EXTRACT_QUEUE)
    # The terminal failure could not be persisted: the message must stay in
    # flight (redelivered), never archived with the failure unrecorded.
    assert repo.jobs[job_id]["status"] == "running"
    assert repo.materials["mat-1"]["ingestion_state"] == "extracting"
    assert queue.queues.get(EXTRACT_QUEUE)

    repo.fail_job_updates = False
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    assert repo.jobs[job_id]["status"] == "failed"
    assert not queue.queues.get(EXTRACT_QUEUE)


def test_publish_uses_atomic_publish_ready_seam() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.publish_ready_calls == [
        {
            "material_id": "mat-1",
            "job_id": job_id,
            "chunk_count": repo.materials["mat-1"]["chunk_count"],
            "grounding_version": "v1",
            "result_id": "mat-1",
        }
    ]


def test_embed_message_carries_exact_attempt_and_correlation() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)

    embed_messages = queue.queues.get(EMBED_QUEUE)
    assert embed_messages
    payload = embed_messages[0]["payload"]
    assert payload["jobId"] == job_id
    assert payload["materialId"] == "mat-1"
    assert payload["ownerId"] == "user-1"
    assert payload["attempt"] == 1
    assert payload["correlationId"] == repo.jobs[job_id]["correlation_id"]
