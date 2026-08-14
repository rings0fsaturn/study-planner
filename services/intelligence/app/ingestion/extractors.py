"""Source extractors for the approved material kinds.

Production adapters talk to real providers (HTTP fetch, pypdf, YouTube
transcripts, trafilatura). Every adapter is injectable so worker tests use
deterministic doubles without network or provider credentials.
"""

from __future__ import annotations

import html as html_lib
import re
from collections.abc import Callable
from typing import Protocol

import httpx

from .cleaning import clean_text
from .models import ExtractedContent, IngestionError, Material, TextSegment

_YOUTUBE_ID = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


class Fetcher(Protocol):
    def fetch(self, url: str) -> str: ...


class PdfTextReader(Protocol):
    def extract(self, data: bytes) -> str: ...


class TranscriptClient(Protocol):
    def fetch(self, video_id: str) -> list[tuple[float, str]]: ...


class SourceReader(Protocol):
    def read(self, material: Material) -> bytes: ...


def youtube_video_id(url: str) -> str | None:
    match = _YOUTUBE_ID.search(url.strip())
    return match.group(1) if match else None


def extract_article_text(html: str) -> str:
    """Best-effort article extraction: trafilatura first, deterministic fallback."""
    try:
        from trafilatura import extract as trafilatura_extract

        extracted = trafilatura_extract(html, include_comments=False, include_tables=False)
        if extracted and extracted.strip():
            return clean_text(extracted)
    except Exception:
        pass
    return _strip_html(html)


def _strip_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    return clean_text(text)


class HttpxFetcher:
    """Fetch web pages with the contract's provider timeout and normalization."""

    def __init__(self, timeout_seconds: float = 30.0, client: httpx.Client | None = None) -> None:
        self._timeout = timeout_seconds
        self._client = client

    def fetch(self, url: str) -> str:
        client = self._client or httpx.Client(timeout=self._timeout, follow_redirects=True)
        try:
            response = client.get(url, headers={"User-Agent": "study-tracker-ingestion/1.0"})
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", "page fetch timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", "page fetch failed", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 500:
            raise IngestionError("provider_unavailable", "page server error", retryable=True)
        if response.status_code == 429:
            raise IngestionError("quota_exhausted", "page fetch rate limited", retryable=False)
        if response.status_code >= 400:
            raise IngestionError("validation_failed", "page not readable", retryable=False)
        return response.text


class PypdfTextReader:
    """Extract text from PDF bytes with pypdf."""

    def extract(self, data: bytes) -> str:
        import io

        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            pages = [page.extract_text() or "" for page in reader.pages]
        except Exception as exc:
            raise IngestionError("validation_failed", "PDF could not be read") from exc
        return "\n\n".join(pages)


class YoutubeTranscriptClient:
    """Fetch a YouTube transcript with timestamps."""

    def fetch(self, video_id: str) -> list[tuple[float, str]]:
        from youtube_transcript_api import (
            NoTranscriptFound,
            TranscriptsDisabled,
            VideoUnavailable,
            YouTubeTranscriptApi,
        )

        try:
            transcript = YouTubeTranscriptApi().fetch(video_id)
        except (VideoUnavailable, TranscriptsDisabled, NoTranscriptFound) as exc:
            raise IngestionError(
                "validation_failed", "no transcript available for this video"
            ) from exc
        except Exception as exc:
            raise IngestionError(
                "provider_unavailable", "transcript fetch failed", retryable=True
            ) from exc
        return [(float(item.start), str(item.text)) for item in transcript]


def extract_material(
    material: Material,
    *,
    fetcher: Fetcher,
    pdf_reader: PdfTextReader,
    transcripts: TranscriptClient,
    read_source: SourceReader,
) -> ExtractedContent:
    """Extract and clean the source body for one material.

    Contentless manual materials and unreadable sources are terminal
    validation failures; transient provider failures are retryable.
    """
    kind = material.kind
    source = material.source.strip()

    if kind == "manual":
        if not source:
            raise IngestionError(
                "validation_failed", "contentless material has no body to ingest"
            )
        return ExtractedContent(clean_text(source))

    if kind == "url":
        if not source:
            raise IngestionError("validation_failed", "url source is empty")
        html = fetcher.fetch(source)
        text = extract_article_text(html)
        if not text.strip():
            raise IngestionError("validation_failed", "no readable text at this url")
        return ExtractedContent(text)

    if kind == "file":
        raw = read_source.read(material)
        text = pdf_reader.extract(raw)
        if not text.strip():
            raise IngestionError("validation_failed", "PDF contains no extractable text")
        return ExtractedContent(clean_text(text))

    if kind == "youtube":
        video_id = youtube_video_id(source)
        if not video_id:
            raise IngestionError("validation_failed", "invalid youtube url")
        raw_segments = transcripts.fetch(video_id)
        if not raw_segments:
            raise IngestionError("validation_failed", "no transcript available for this video")
        segments = tuple(
            TextSegment(text=clean_text(text), start_seconds=start)
            for start, text in raw_segments
            if clean_text(text)
        )
        full_text = "\n".join(segment.text for segment in segments)
        if not full_text.strip():
            raise IngestionError("validation_failed", "no transcript available for this video")
        return ExtractedContent(text=full_text, segments=segments)

    raise IngestionError("validation_failed", f"unsupported material kind: {kind}")


def make_production_extractors(
    fetcher: Callable[[], Fetcher] = HttpxFetcher,
    pdf_reader: Callable[[], PdfTextReader] = PypdfTextReader,
    transcripts: Callable[[], TranscriptClient] = YoutubeTranscriptClient,
) -> dict[str, object]:
    """One place to build the real adapters for the worker entrypoint."""
    return {"fetcher": fetcher(), "pdf_reader": pdf_reader(), "transcripts": transcripts()}
