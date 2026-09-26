"""Ingestion + generation worker entrypoint (D-04).

Runs the stage pipeline against Supabase (REST + Storage, service role) and
the configured embedding provider, plus a second daemon arm polling the
`assessment_generate` queue. The generation call is network-bound, so the
two arms share one connection pool without blocking each other.
Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `EMBEDDING_PROVIDER`
selects the adapter: `gemini` (default, needs `GEMINI_API_KEY`) or `sidecar`
(local Docker embedder at `EMBEDDER_URL`, default http://localhost:8200).
Without an embedder the extraction/chunking stages still work and the embed
stage fails materials with a clear retryable error.
"""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
import time

import httpx

from app.generation.factory import build_openrouter_adapter as _build_openrouter_adapter
from app.ingestion.chunking import TiktokenCounter
from app.ingestion.embeddings_sidecar import DEFAULT_URL as DEFAULT_EMBEDDER_URL
from app.ingestion.extractors import HttpxFetcher, PypdfTextReader, YoutubeTranscriptClient
from app.ingestion.queue import SupabaseWorkQueue
from app.ingestion.repository import SupabaseIngestionRepo, SupabaseStorageClient
from app.ingestion.telemetry import SupabaseTelemetrySink
from app.ingestion.worker import IngestionWorker, WorkerConfig

logger = logging.getLogger("ingestion.worker")


def _env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required for the ingestion worker")
    return value


def _build_embedder(shared_client: httpx.Client):
    """Construct the provider adapter selected by EMBEDDING_PROVIDER (D-B)."""
    provider = os.getenv("EMBEDDING_PROVIDER", "gemini").strip().lower()
    if provider in ("sidecar", "qwen-sidecar"):
        from app.query_embedder import get_embedder

        embedder_url = os.getenv("EMBEDDER_URL", DEFAULT_EMBEDDER_URL)
        logger.info("embedding provider: sidecar (%s)", embedder_url)
        return (
            get_embedder(client=shared_client, token_counter=TiktokenCounter()),
            # Local GPU has no token quota; a disabled limiter never sleeps.
            0,
        )
    if provider == "gemini":
        from app.query_embedder import get_embedder

        gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not gemini_api_key:
            logger.warning(
                "GEMINI_API_KEY is not set: extraction and chunking still work, "
                "but the embedding stage will fail materials with provider_unavailable"
            )
        return (
            get_embedder(client=shared_client, token_counter=TiktokenCounter()),
            int(os.getenv("INGESTION_MAX_TOKENS_PER_MINUTE", "25000")),
        )
    raise SystemExit(f"unknown EMBEDDING_PROVIDER: {provider}")


def _build_generation_worker(shared_client: httpx.Client, repo, queue, telemetry, sandbox=None):
    """Construct the generation arm from GENERATION_* env (D-08 defaults).

    `sandbox` is the Piston client the coding self-check runs the reference
    solution through (the same instance the grading arm executes learner
    submissions with).
    """
    from app.generation.context import build_context
    from app.generation.worker import GenerationWorker, GenerationWorkerConfig

    adapter = _build_openrouter_adapter("GENERATION", "grounded_mcq")
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    def context_builder(
        material_id,
        skill_tags,
        scope,
        *,
        code_seeking: bool = False,
        exclude_chunk_ids: frozenset[str] = frozenset(),
    ):
        return build_context(
            material_id,
            skill_tags,
            scope,
            supabase_url,
            service_key,
            shared_client,
            code_seeking=code_seeking,
            exclude_chunk_ids=exclude_chunk_ids,
        )

    # Slice-1 Jev gate (#70): one flag for suitability + citation; off (the
    # default) means zero decide() calls. The client is built only when a flag
    # is on so disabled workers never import the SDK. Slice-2 passage shadow
    # (#72) reuses the flag with a tighter timeout ceiling so the one batched
    # call still fits the 90 s visibility window (#74 retunes it). The slice-2
    # filter's own switch (#76) can enforce without the slice-1 gate.
    jev_slice1_enabled = os.getenv("JEV_SLICE1_ENABLED", "false").strip().lower() == "true"
    jev_slice2_enforce = os.getenv("JEV_SLICE2_ENFORCE", "false").strip().lower() == "true"
    jev = None
    jev_slice2 = None
    if jev_slice1_enabled or jev_slice2_enforce:
        from app.jev.client import JevClient

        jev = JevClient.from_env()
        jev_slice2 = JevClient.from_env("JEV_SLICE2", default_timeout_ms=15000)

    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        context_builder=context_builder,
        sandbox=sandbox,
        jev=jev,
        jev_slice2=jev_slice2,
        config=GenerationWorkerConfig(
            poll_interval_seconds=float(os.getenv("GENERATION_POLL_INTERVAL_SECONDS", "1")),
            visibility_seconds=int(os.getenv("GENERATION_VISIBILITY_SECONDS", "90")),
            max_in_flight=int(os.getenv("GENERATION_MAX_IN_FLIGHT", "1")),
            model=os.getenv("GENERATION_MODEL", "deepseek/deepseek-v4-flash-0731"),
            jev_slice1_enabled=jev_slice1_enabled,
            jev_slice2_enforce=jev_slice2_enforce,
        ),
    )


def _build_grading_worker(repo, queue, adapter, sandbox=None):
    """Construct the grading arm (#39/#41/#42).

    Objective grading is deterministic and needs no provider; written grading
    rides the shared OpenRouter adapter with the rubric schema name; coding
    grading rides the sandbox client (Piston, the recorded D-02 fallback).
    """
    from app.grading.worker import GradingWorker, GradingWorkerConfig

    # Slice-4 rubric shadow (#73): reuses the slice-1 flag (no new flag); the
    # 15 s ceiling fits the 30 s grading visibility window (#74 retunes it).
    jev_shadow_enabled = os.getenv("JEV_SLICE1_ENABLED", "false").strip().lower() == "true"
    # Slice-4 flag queue (#77): its own switch, independent of the shadow. The
    # queue is advisory and fail-open, so it can run without the log-only shadow.
    jev_flags_enabled = os.getenv("JEV_SLICE4_FLAGS", "false").strip().lower() == "true"
    jev = None
    if jev_shadow_enabled or jev_flags_enabled:
        from app.jev.client import JevClient

        jev = JevClient.from_env("JEV", default_timeout_ms=15000)

    return GradingWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        sandbox=sandbox,
        jev=jev,
        config=GradingWorkerConfig(
            poll_interval_seconds=float(os.getenv("GRADING_POLL_INTERVAL_SECONDS", "1")),
            visibility_seconds=int(os.getenv("GRADING_VISIBILITY_SECONDS", "30")),
            max_in_flight=int(os.getenv("GRADING_MAX_IN_FLIGHT", "1")),
            model=os.getenv("GRADING_MODEL", "deepseek/deepseek-v4-flash-0731"),
            jev_shadow_enabled=jev_shadow_enabled,
            jev_flags_enabled=jev_flags_enabled,
        ),
    )


def _build_piston_client():
    """Construct the sandbox client from PISTON_* env (#42, D-02 fallback)."""
    from app.grading.piston_client import PistonClient

    return PistonClient(
        base_url=os.getenv("PISTON_URL", "http://127.0.0.1:2000"),
        python_version=os.getenv("PISTON_PYTHON_VERSION", "3.12.0"),
        http_timeout_seconds=float(os.getenv("PISTON_HTTP_TIMEOUT_MS", "60000")) / 1000,
        max_cpu_time_ms=int(os.getenv("PISTON_MAX_CPU_TIME_MS", "15000")),
        wall_time_extra_ms=int(os.getenv("PISTON_WALL_TIME_EXTRA_MS", "1000")),
        max_memory_mb=int(os.getenv("PISTON_MAX_MEMORY_MB", "256")),
    )


def _arm_loop(worker, stop: threading.Event, poll_interval: float) -> None:
    """Daemon-arm loop: poll the worker until the stop event is set."""
    while not stop.is_set():
        try:
            worker.run_once()
        except Exception:
            logger.exception("generation arm iteration failed; backing off")
            time.sleep(5)
        if stop.is_set():
            break
        time.sleep(poll_interval)


def main() -> None:
    os.environ.setdefault("LOG_LEVEL", os.getenv("INGESTION_LOG_LEVEL", "INFO"))
    from app.logging_config import configure_logging

    configure_logging()
    supabase_url = _env("SUPABASE_URL").rstrip("/")
    service_role_key = _env("SUPABASE_SERVICE_ROLE_KEY")

    # One keep-alive connection pool shared by every Supabase adapter and the
    # embedding provider; per-request timeouts still follow each adapter's own
    # contract where one is configured.
    shared_client = httpx.Client(timeout=30.0)

    repo = SupabaseIngestionRepo(supabase_url, service_role_key, client=shared_client)
    queue = SupabaseWorkQueue(supabase_url, service_role_key, client=shared_client)
    storage = SupabaseStorageClient(supabase_url, service_role_key, client=shared_client)
    embedder, max_tokens_per_minute = _build_embedder(shared_client)
    worker = IngestionWorker(
        repo=repo,
        queue=queue,
        storage=storage,
        fetcher=HttpxFetcher(client=shared_client),
        pdf_reader=PypdfTextReader(),
        transcripts=YoutubeTranscriptClient(),
        embedder=embedder,
        token_counter=TiktokenCounter(),
        telemetry=SupabaseTelemetrySink(supabase_url, service_role_key, client=shared_client),
        config=WorkerConfig(
            batch_size=int(os.getenv("INGESTION_BATCH_SIZE", "100")),
            visibility_seconds=int(os.getenv("INGESTION_VISIBILITY_SECONDS", "30")),
            poll_interval_seconds=float(os.getenv("INGESTION_POLL_INTERVAL_SECONDS", "1")),
            max_deliveries=int(os.getenv("INGESTION_MAX_DELIVERIES", "3")),
            max_in_flight=int(os.getenv("INGESTION_MAX_IN_FLIGHT", "1")),
            max_batch_tokens=int(os.getenv("INGESTION_MAX_BATCH_TOKENS", "4000")),
            max_tokens_per_minute=max_tokens_per_minute,
        ),
    )
    # One sandbox client for both arms: the generation self-check and the
    # grading execution talk to the same Piston (demand-started, rule 54).
    sandbox = _build_piston_client()
    generation_worker = _build_generation_worker(
        shared_client,
        repo,
        queue,
        SupabaseTelemetrySink(supabase_url, service_role_key, client=shared_client),
        sandbox=sandbox,
    )
    grading_worker = _build_grading_worker(
        repo,
        queue,
        _build_openrouter_adapter("GRADING", "written_rubric"),
        sandbox,
    )

    logger.info("ingestion worker starting against %s", supabase_url)
    stop = threading.Event()

    def _handle_signal(signum, _frame):  # noqa: ARG001
        stop.set()
        logger.info("received signal %s, draining current iteration", signum)

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    generation_thread = threading.Thread(
        target=_arm_loop,
        args=(generation_worker, stop, generation_worker.config.poll_interval_seconds),
        daemon=True,
    )
    generation_thread.start()

    grading_thread = threading.Thread(
        target=_arm_loop,
        args=(grading_worker, stop, grading_worker.config.poll_interval_seconds),
        daemon=True,
    )
    grading_thread.start()

    while not stop.is_set():
        try:
            worker.run_once()
        except Exception:
            logger.exception("worker iteration failed; backing off")
            time.sleep(5)
        if stop.is_set():
            break
        time.sleep(worker.config.poll_interval_seconds)

    stop.set()
    generation_thread.join(timeout=10.0)
    grading_thread.join(timeout=10.0)
    shared_client.close()
    logger.info("ingestion worker stopped")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        sys.exit(exc.code)
