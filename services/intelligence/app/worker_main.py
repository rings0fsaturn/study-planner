"""Ingestion worker entrypoint.

Runs the stage pipeline against Supabase (REST + Storage, service role) and
Gemini embeddings. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
`GEMINI_API_KEY` enables embedding, without it extraction/chunking still work
and the embed stage fails materials with a clear retryable error.
"""

from __future__ import annotations

import logging
import os
import sys
import time

import httpx

from app.ingestion.chunking import TiktokenCounter
from app.ingestion.embeddings import GeminiEmbedder
from app.ingestion.extractors import HttpxFetcher, PypdfTextReader, YoutubeTranscriptClient
from app.ingestion.queue import SupabaseWorkQueue
from app.ingestion.repository import SupabaseIngestionRepo, SupabaseStorageClient
from app.ingestion.worker import IngestionWorker, WorkerConfig

logger = logging.getLogger("ingestion.worker")


def _env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required for the ingestion worker")
    return value


def main() -> None:
    logging.basicConfig(level=os.getenv("INGESTION_LOG_LEVEL", "INFO"))
    supabase_url = _env("SUPABASE_URL").rstrip("/")
    service_role_key = _env("SUPABASE_SERVICE_ROLE_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not gemini_api_key:
        logger.warning(
            "GEMINI_API_KEY is not set: extraction and chunking still work, "
            "but the embedding stage will fail materials with provider_unavailable"
        )

    # One keep-alive connection pool shared by every Supabase adapter and the
    # Gemini embedder; per-request timeouts still follow each adapter's own
    # contract where one is configured.
    shared_client = httpx.Client(timeout=30.0)

    repo = SupabaseIngestionRepo(supabase_url, service_role_key, client=shared_client)
    queue = SupabaseWorkQueue(supabase_url, service_role_key, client=shared_client)
    storage = SupabaseStorageClient(supabase_url, service_role_key, client=shared_client)
    embedder = GeminiEmbedder(api_key=gemini_api_key, client=shared_client)
    worker = IngestionWorker(
        repo=repo,
        queue=queue,
        storage=storage,
        fetcher=HttpxFetcher(client=shared_client),
        pdf_reader=PypdfTextReader(),
        transcripts=YoutubeTranscriptClient(),
        embedder=embedder,
        token_counter=TiktokenCounter(),
        config=WorkerConfig(
            batch_size=int(os.getenv("INGESTION_BATCH_SIZE", "100")),
            visibility_seconds=int(os.getenv("INGESTION_VISIBILITY_SECONDS", "30")),
            poll_interval_seconds=float(os.getenv("INGESTION_POLL_INTERVAL_SECONDS", "1")),
            max_deliveries=int(os.getenv("INGESTION_MAX_DELIVERIES", "3")),
            max_in_flight=int(os.getenv("INGESTION_MAX_IN_FLIGHT", "1")),
            max_batch_tokens=int(os.getenv("INGESTION_MAX_BATCH_TOKENS", "4000")),
        ),
    )

    logger.info("ingestion worker starting against %s", supabase_url)
    while True:
        try:
            worker.run_once()
        except Exception:
            logger.exception("worker iteration failed; backing off")
            time.sleep(5)
        time.sleep(worker.config.poll_interval_seconds)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        sys.exit(exc.code)
