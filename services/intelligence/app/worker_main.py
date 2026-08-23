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


def _build_generation_worker(shared_client: httpx.Client, repo, queue, telemetry):
    """Construct the generation arm from GENERATION_* env (D-08 defaults)."""
    from app.generation.context import build_context
    from app.generation.openrouter_client import OpenRouterGenerationClient
    from app.generation.worker import GenerationWorker, GenerationWorkerConfig

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        logger.warning(
            "OPENROUTER_API_KEY is not set: generation jobs will fail with provider_credentials"
        )
    adapter = OpenRouterGenerationClient(
        api_key=api_key,
        base_url=os.getenv("GENERATION_BASE_URL", "https://openrouter.ai/api/v1"),
        model=os.getenv("GENERATION_MODEL", "deepseek/deepseek-v4-flash-0731"),
        timeout_ms=int(os.getenv("GENERATION_TIMEOUT_MS", "30000")),
        max_output_tokens=int(os.getenv("GENERATION_MAX_OUTPUT_TOKENS", "4096")),
        temperature=float(os.getenv("GENERATION_TEMPERATURE", "0.3")),
        reasoning_effort=os.getenv("GENERATION_REASONING_EFFORT", "off"),
    )
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    def context_builder(material_id, skill_tags, title):
        return build_context(
            material_id, skill_tags, title, supabase_url, service_key, shared_client
        )

    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        context_builder=context_builder,
        config=GenerationWorkerConfig(
            poll_interval_seconds=float(os.getenv("GENERATION_POLL_INTERVAL_SECONDS", "1")),
            visibility_seconds=int(os.getenv("GENERATION_VISIBILITY_SECONDS", "90")),
            max_in_flight=int(os.getenv("GENERATION_MAX_IN_FLIGHT", "1")),
            model=os.getenv("GENERATION_MODEL", "deepseek/deepseek-v4-flash-0731"),
        ),
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
    logging.basicConfig(level=os.getenv("INGESTION_LOG_LEVEL", "INFO"))
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
    generation_worker = _build_generation_worker(
        shared_client,
        repo,
        queue,
        SupabaseTelemetrySink(supabase_url, service_role_key, client=shared_client),
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
    shared_client.close()
    logger.info("ingestion worker stopped")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        sys.exit(exc.code)
