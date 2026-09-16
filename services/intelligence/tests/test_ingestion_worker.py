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
from tests.test_outline import paged_book


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
    max_tokens_per_minute: int = 25000,
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
            max_tokens_per_minute=max_tokens_per_minute,
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


class ViewerPdfReader(FakePdfReader):
    """Fake reader that can also hand back a repaired viewer copy."""

    def __init__(self, viewer: bytes | None) -> None:
        super().__init__(["page one"])
        self.viewer = viewer

    def normalize(self, data: bytes) -> bytes | None:
        return self.viewer


def test_stores_a_viewer_copy_only_when_the_pdf_needed_repair() -> None:
    # pdf.js cannot open a page tree with a repeated kid, so a repaired copy is
    # stored for the viewer; a PDF that needed no repair stores none.
    storage = InMemoryStorage()
    worker, repo, queue, storage = make_worker(
        storage=storage, pdf_reader=ViewerPdfReader(b"%PDF-1.4 repaired")
    )
    material = make_material(kind="file", source="book.pdf")
    storage.objects["user-1/mat-1/book.pdf"] = b"%PDF-1.4 uploaded"
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert storage.objects["user-1/mat-1/view-v1.pdf"] == b"%PDF-1.4 repaired"

    storage = InMemoryStorage()
    worker, repo, queue, storage = make_worker(
        storage=storage, pdf_reader=ViewerPdfReader(None)
    )
    material = make_material(kind="file", source="book.pdf")
    storage.objects["user-1/mat-1/book.pdf"] = b"%PDF-1.4 uploaded"
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert "user-1/mat-1/view-v1.pdf" not in storage.objects


def test_extract_derives_the_code_bearing_signal() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(
        source="theory text\n```python\nprint(1)\n```\nmore text"
    )
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)

    row = repo.materials["mat-1"]
    assert row["ingestion_state"] == "chunking"
    assert row["has_code"] is True
    assert row["code_languages"] == ["python"]


def test_extract_derives_no_code_signal_for_plain_text() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="only prose, no fences")
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)

    row = repo.materials["mat-1"]
    assert row["ingestion_state"] == "chunking"
    assert row["has_code"] is False
    assert row["code_languages"] == []


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


def test_file_material_persists_the_outline_at_extraction() -> None:
    worker, repo, queue, storage = make_worker(pdf_reader=FakePdfReader(paged_book()))
    material = make_material(kind="file", source="paper.pdf")
    storage.objects["user-1/mat-1/paper.pdf"] = b"pdf bytes"
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    row = repo.materials["mat-1"]
    assert row["ingestion_state"] == "ready"
    assert row["page_count"] == 30
    assert row["page_offset"] == -3
    assert row["outline"] == {
        "entries": [
            {"title": "Chapter 1 Alpha", "page": 10},
            {"title": "Chapter 2 Beta", "page": 12},
            {"title": "Chapter 3 Gamma", "page": 14},
            {"title": "Chapter 4 Delta", "page": 16},
        ],
        "source": "contents",
    }


def test_page_less_materials_leave_the_outline_columns_empty() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material(source="plain text body")
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)

    row = repo.materials["mat-1"]
    assert "outline" not in row
    assert "page_count" not in row
    assert "page_offset" not in row


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


class FakeTelemetrySink:
    """Captures telemetry records for assertions."""

    def __init__(self) -> None:
        self.records: list = []

    def emit(self, records: list) -> None:
        self.records.extend(records)


def make_worker_with_telemetry(
    *,
    embedder=None,
    telemetry: FakeTelemetrySink | None = None,
    batch_size: int = 2,
    **kwargs,
):
    worker, repo, queue, storage = make_worker(
        embedder=embedder, batch_size=batch_size, **kwargs
    )
    telemetry = telemetry or FakeTelemetrySink()
    worker.telemetry = telemetry
    return worker, repo, queue, storage, telemetry


def test_pipeline_emits_stage_and_embedding_telemetry() -> None:
    worker, repo, queue, _, telemetry = make_worker_with_telemetry()
    material = make_material(source="one two three four five six seven eight nine ten")
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    correlation = repo.jobs[job_id]["correlation_id"]
    stages = {record.stage for record in telemetry.records}
    assert {
        "extract",
        "chunk",
        "upload",
        "embed",
        "publish",
    } <= stages
    for record in telemetry.records:
        assert record.trace_id == correlation
        assert record.owner_id == "user-1"
        assert record.material_id == "mat-1"
        assert record.outcome == "ok"
    assert all(record.latency_ms >= 0 for record in telemetry.records)
    # Models identify the stage engines.
    by_stage = {record.stage: record.model for record in telemetry.records}
    assert by_stage["extract"] == "local"
    assert by_stage["chunk"] == "tiktoken-cl100k"
    assert by_stage["upload"] == "supabase-storage"
    assert by_stage["publish"] == "supabase-rpc"


def test_embed_batch_telemetry_reports_tokens_per_provider_call() -> None:
    import json as json_lib

    import httpx

    from app.ingestion.embeddings import EMBEDDING_DIMENSIONS, GeminiEmbedder

    def handler(request: httpx.Request) -> httpx.Response:
        body = json_lib.loads(request.content)
        count = len(body["requests"])
        vectors = [
            [1.0 + i * 0.001 + d * 0.0001 for d in range(EMBEDDING_DIMENSIONS)]
            for i in range(count)
        ]
        return httpx.Response(200, json={"embeddings": [{"values": v} for v in vectors]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(
        api_key="test-key",
        client=client,
        token_counter=lambda text: len(text.split()),
    )
    worker, repo, queue, _, telemetry = make_worker_with_telemetry(
        embedder=embedder, batch_size=2
    )
    material = make_material(source="word " * 900)
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    batch_records = [r for r in telemetry.records if r.stage == "embed-batch"]
    assert len(batch_records) >= 2
    for record in batch_records:
        assert record.task == "embedding"
        assert record.model == "gemini-embedding-001"
        assert record.outcome == "ok"
        assert record.input_tokens > 0
        assert record.texts_count > 0
    # The stage aggregate carries the same total token count. The total is
    # >= the source word count because carried overlap tails are re-embedded.
    aggregate = [r for r in telemetry.records if r.stage == "embed"][0]
    assert aggregate.input_tokens == sum(r.input_tokens for r in batch_records)
    assert sum(r.input_tokens for r in batch_records) >= 900


def test_terminal_failure_emits_failure_telemetry() -> None:
    worker, repo, queue, _, telemetry = make_worker_with_telemetry()
    material = make_material(kind="manual", source="")
    job_id = seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    failure = [r for r in telemetry.records if r.outcome != "ok"]
    assert len(failure) == 1
    assert failure[0].stage == "extract"
    assert failure[0].outcome == "partial"  # validation_failed has no provider mapping
    assert failure[0].trace_id == repo.jobs[job_id]["correlation_id"]


def test_transient_failure_outcome_maps_to_provider_error() -> None:
    from app.ingestion.models import IngestionError as IngErr

    embedder = FailingEmbedder(1, IngErr("provider_unavailable", "gemini down", retryable=True))
    worker, repo, queue, _, telemetry = make_worker_with_telemetry(
        embedder=embedder, batch_size=2, max_deliveries=3
    )
    material = make_material(source="one two three four five six seven eight nine ten")
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    worker.run_once(EMBED_QUEUE)  # first embed call fails transiently -> redelivered

    assert ("material_embed", 2) in queue.redelivered
    failure = [r for r in telemetry.records if r.outcome != "ok"]
    assert len(failure) == 1
    assert failure[0].stage == "embed"
    assert failure[0].outcome == "provider_error"


def test_telemetry_sink_failure_never_fails_the_stage() -> None:
    class ExplodingSink(FakeTelemetrySink):
        def emit(self, records: list) -> None:
            raise RuntimeError("telemetry db down")

    worker, repo, queue, storage = make_worker()
    worker.telemetry = ExplodingSink()
    material = make_material()
    job_id = seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job_id]["status"] == "succeeded"


class SucceedThenFailEmbedder:
    """Embeds the first call, then fails with the given error (quota mid-run)."""

    def __init__(self, error: IngestionError) -> None:
        self.error = error
        self.calls = 0
        self.delegate = DeterministicEmbedder()

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        self.calls += 1
        if self.calls > 1:
            raise self.error
        return self.delegate.embed(texts)


def test_retry_preserves_embeddings_when_extraction_is_identical() -> None:
    """C2 resume: a retry after an embed-stage failure keeps the vectors that
    already succeeded and only re-embeds the missing chunks."""
    worker, repo, queue, _ = make_worker(batch_size=2)
    # ~900 words -> 3 chunks, so the embed stage makes multiple provider calls.
    material = make_material(source="word " * 900)
    seed_and_enqueue(repo, queue, material)

    # Attempt 1: extract succeeds, embed fails mid-way (e.g. quota) after the
    # first batch was embedded.
    from app.ingestion.models import IngestionError as IngErr

    worker.embedder = SucceedThenFailEmbedder(IngErr("quota_exhausted", "quota", retryable=False))
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    worker.run_once(EMBED_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "failed"
    embedded_ids = {cid for cid, row in repo.chunks.items() if row["embedding"] is not None}
    assert embedded_ids

    # Retry (attempt 2): same source -> same text. The extract stage must NOT
    # replace the chunk rows, so the already-embedded vectors survive and the
    # embed NULL-scan only pays for the missing ones.
    from dataclasses import replace

    material = replace(
        repo.get_material("mat-1"),
        ingestion_state="pending",
    )
    job2 = seed_and_enqueue(repo, queue, material, attempt=2)
    worker.embedder = DeterministicEmbedder()
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    assert {cid for cid, row in repo.chunks.items() if row["embedding"] is not None} == embedded_ids
    assert len(repo.chunks) == repo.materials["mat-1"]["chunk_count"]

    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job2]["status"] == "succeeded"
    assert all(row["embedding"] is not None for row in repo.chunks.values())


def test_retry_replaces_chunks_when_content_changed() -> None:
    """C2: a changed source is not identical, so chunks are replaced and the
    stale embeddings are dropped (the old vectors would be wrong)."""
    worker, repo, queue, _ = make_worker(batch_size=2)
    material = make_material(source="original content " * 20)
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    old_ids = set(repo.chunks)

    from dataclasses import replace

    material = replace(
        repo.get_material("mat-1"),
        ingestion_state="pending",
        source="completely different content " * 20,
    )
    job2 = seed_and_enqueue(repo, queue, material, attempt=2)
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    assert set(repo.chunks).isdisjoint(old_ids)

    run_pipeline(worker, queue)
    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.jobs[job2]["status"] == "succeeded"


def test_first_extraction_still_creates_chunks() -> None:
    """C2: a fresh material has no existing chunks; the extract stage inserts
    them as before (resume path must not accidentally skip the insert)."""
    worker, repo, queue, _ = make_worker(batch_size=2)
    material = make_material(source="word " * 20)
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    assert repo.materials["mat-1"]["ingestion_state"] == "chunking"
    assert repo.chunks
    assert repo.materials["mat-1"]["chunk_count"] == len(repo.chunks)


class FakeClock:
    """A monotonic fake clock; sleeping advances it so limiter loops terminate."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class AdvancingSleep:
    def __init__(self, clock: FakeClock) -> None:
        self.clock = clock
        self.sleeps: list[float] = []

    def __call__(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.clock.now += seconds


def test_token_rate_limiter_waits_for_window_space() -> None:
    from app.ingestion.worker import TokenRateLimiter

    clock = FakeClock()
    sleeper = AdvancingSleep(clock)
    limiter = TokenRateLimiter(max_tokens_per_minute=30000, now_fn=clock, sleep_fn=sleeper)

    limiter.wait_for(12000)  # ok
    limiter.wait_for(12000)  # ok: 24000 <= 30000
    limiter.wait_for(12000)  # would exceed 36000: must sleep until the window slides
    assert sleeper.sleeps, "the third batch must wait for the sliding window"
    assert sleeper.sleeps[-1] > 55.0, "the wait must span to the window boundary"

    limiter.wait_for(5000)  # the sleep advanced the clock: 12000 + 5000 fits again
    assert len(sleeper.sleeps) == 1, "no new sleep after the window slid"


def test_token_rate_limiter_allows_over_budget_single_batch() -> None:
    from app.ingestion.worker import TokenRateLimiter

    clock = FakeClock()
    sleeper = AdvancingSleep(clock)
    limiter = TokenRateLimiter(max_tokens_per_minute=1000, now_fn=clock, sleep_fn=sleeper)
    limiter.wait_for(5000)  # indivisible oversized batch: sent anyway, no wait
    assert sleeper.sleeps == []


def test_embed_stage_paces_calls_to_the_per_minute_budget() -> None:
    """The rate limiter must spread embedding calls so a big material never
    bursts past the provider's TPM quota (the PDF E2E failure mode)."""
    from app.ingestion.worker import TokenRateLimiter

    clock = FakeClock()
    sleeper = AdvancingSleep(clock)
    worker, repo, queue, _ = make_worker(
        batch_size=100,
        max_batch_tokens=2000,  # ~2 chunks of ~450 words per provider call
        max_tokens_per_minute=2500,  # ~1 provider call per minute
    )
    worker._rate_limiter = TokenRateLimiter(
        max_tokens_per_minute=2500, now_fn=clock, sleep_fn=sleeper
    )
    material = make_material(source="word " * 9000)
    seed_and_enqueue(repo, queue, material)
    worker.run_once(EXTRACT_QUEUE)
    worker.run_once(EMBED_QUEUE)
    worker.run_once(PUBLISH_QUEUE)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert sleeper.sleeps, "the limiter must have paced the burst"


class ProviderEmbedder(DeterministicEmbedder):
    """Deterministic double carrying the provider identity like a real adapter."""

    provider_name = "qwen-sidecar"
    telemetry_model = "qwen3-embedding-0.6b"


def test_embed_writes_embedding_provider_and_reports_sidecar_model() -> None:
    import json as json_lib

    import httpx

    from app.ingestion.embeddings import EMBEDDING_DIMENSIONS
    from app.ingestion.embeddings_sidecar import SidecarEmbedder

    def handler(request: httpx.Request) -> httpx.Response:
        body = json_lib.loads(request.content)
        count = len(body["texts"])
        assert body["is_query"] is False
        vectors = [
            [1.0 + i * 0.001 + d * 0.0001 for d in range(EMBEDDING_DIMENSIONS)]
            for i in range(count)
        ]
        return httpx.Response(200, json={"embeddings": vectors})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = SidecarEmbedder(
        "http://embedder.test",
        client=client,
        token_counter=lambda text: len(text.split()),
    )
    worker, repo, queue, _, telemetry = make_worker_with_telemetry(
        embedder=embedder, batch_size=2
    )
    material = make_material(source="one two three four five six seven eight nine ten")
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.materials["mat-1"]["embedding_provider"] == "qwen-sidecar"
    batch_records = [r for r in telemetry.records if r.stage == "embed-batch"]
    assert batch_records
    assert all(record.model == "qwen3-embedding-0.6b" for record in batch_records)


def test_embed_refuses_to_mix_providers_on_one_material() -> None:
    worker, repo, queue, _ = make_worker(embedder=ProviderEmbedder())
    material = Material(
        **{
            **vars(make_material()),
            "ingestion_state": "embedding",
            "embedding_provider": "gemini",
        }
    )
    job_id = uuid.uuid4().hex
    repo.seed_material(material)
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
    queue.send(
        EMBED_QUEUE,
        {
            "jobId": job_id,
            "materialId": material.id,
            "ownerId": material.owner_id,
            "attempt": 1,
            "correlationId": uuid.uuid4().hex,
        },
    )
    worker.run_once(EMBED_QUEUE)

    assert repo.jobs[job_id]["status"] == "failed"
    assert repo.jobs[job_id]["error_code"] == "validation_failed"
    assert repo.jobs[job_id]["retryable"] is False
    assert not queue.queues.get(EMBED_QUEUE)


def test_plain_double_without_provider_identity_still_embeds() -> None:
    worker, repo, queue, _ = make_worker()
    material = make_material()
    seed_and_enqueue(repo, queue, material)
    run_pipeline(worker, queue)

    assert repo.materials["mat-1"]["ingestion_state"] == "ready"
    assert repo.materials["mat-1"].get("embedding_provider") is None
