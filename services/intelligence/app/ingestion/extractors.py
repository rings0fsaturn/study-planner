"""Source extractors for the approved material kinds.

Production adapters talk to real providers (HTTP fetch, pypdf, YouTube
transcripts, trafilatura). Every adapter is injectable so worker tests use
deterministic doubles without network or provider credentials.
"""

from __future__ import annotations

import html as html_lib
import logging
import re
from collections.abc import Callable
from typing import Protocol

import httpx

from .cleaning import clean_text
from .models import ExtractedContent, IngestionError, Material, TextSegment

logger = logging.getLogger("ingestion.extractors")

_YOUTUBE_ID = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


class Fetcher(Protocol):
    def fetch(self, url: str) -> str: ...


class PdfTextReader(Protocol):
    def extract(self, data: bytes) -> list[str]: ...


class TranscriptClient(Protocol):
    def fetch(self, video_id: str) -> list[tuple[float, str]]: ...


class SourceReader(Protocol):
    def read(self, material: Material) -> bytes: ...


def youtube_video_id(url: str) -> str | None:
    match = _YOUTUBE_ID.search(url.strip())
    return match.group(1) if match else None


def extract_article_text(html: str, context: str = "") -> str:
    """Best-effort article extraction: trafilatura first, deterministic fallback."""
    try:
        from trafilatura import extract as trafilatura_extract

        extracted = trafilatura_extract(html, include_comments=False, include_tables=False)
        if extracted and extracted.strip():
            return clean_text(extracted)
    except Exception:
        logger.warning(
            "trafilatura extraction failed for source %r; falling back to html strip",
            context,
            exc_info=True,
        )
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
    """Extract text from PDF bytes with pypdf, one entry per page (page 1 first)."""

    def extract(self, data: bytes) -> list[str]:
        import io

        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            _prune_repeated_kids(reader)
            return [page.extract_text() or "" for page in reader.pages]
        except Exception as exc:
            raise IngestionError("validation_failed", "PDF could not be read") from exc

    def normalize(self, data: bytes) -> bytes | None:
        """Rewritten PDF for the browser viewer, or None when nothing needed it.

        pdf.js aborts the very same repeated-`/Kids` documents ("Pages tree
        contains circular reference.") and silently truncates them to the
        pages before the repeat, so a PDF whose tree had repeats to prune needs
        a clean copy for the viewer. Re-serializing the pruned tree gives both
        engines the same page list, in the same order, as this reader.
        """
        import io

        from pypdf import PdfReader, PdfWriter

        try:
            reader = PdfReader(io.BytesIO(data))
            if _prune_repeated_kids(reader) == 0:
                return None
            out = io.BytesIO()
            PdfWriter(clone_from=reader).write(out)
            return out.getvalue()
        except Exception:
            logger.warning("PDF viewer copy could not be written", exc_info=True)
            return None

    def bookmarks(self, data: bytes) -> tuple[tuple[str, int], ...]:
        """Top-level bookmark titles with their 1-based PDF page.

        Optional adapter capability (the outline prefers bookmarks when a
        document has them); a broken bookmark tree is not a read failure.
        """
        import io

        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            _prune_repeated_kids(reader)
            return _bookmark_entries(reader)
        except Exception:
            logger.warning("PDF bookmarks could not be read", exc_info=True)
            return ()


def _prune_repeated_kids(reader) -> int:
    """Drop page-tree `/Kids` entries that repeat an object already reached.

    Returns how many entries were dropped (0 for a well-formed tree). A
    `/Kids` array may legally list the same page object more than once, but
    pypdf treats the second visit as a cyclic page reference and aborts the
    whole document ("Detected cyclic page references"), failing a PDF that is
    perfectly readable. Removing the repeats hands pypdf an acyclic tree (and
    bounds its recursion, which is what that guard is for); well-formed files
    are untouched because every object is already unique. A repeated page
    carries no extra text, so deduping it loses nothing. `/Count` is resynced
    from the surviving kids so the tree stays self-consistent for readers that
    pre-validate it.
    """
    from pypdf.generic import NameObject, NumberObject

    root = reader.trailer["/Root"]["/Pages"]
    root_node = root.get_object() if hasattr(root, "get_object") else root
    visited = {getattr(root, "idnum", None) or id(root_node)}
    dropped = 0

    def walk(node) -> int:
        """Pages under `node`, after dropping repeated kids."""
        nonlocal dropped
        kids = node.get("/Kids")
        if kids is None:
            return 1
        pages = 0
        for kid in list(kids):
            obj = kid.get_object() if hasattr(kid, "get_object") else kid
            key = getattr(kid, "idnum", None) or id(kid)
            if key in visited:
                kids.remove(kid)
                dropped += 1
                continue
            visited.add(key)
            pages += walk(obj)
        node[NameObject("/Count")] = NumberObject(pages)
        return pages

    walk(root_node)
    return dropped


def _viewer_pdf(pdf_reader: PdfTextReader, raw: bytes) -> bytes | None:
    """Optional reader capability: a viewer-side copy when the file needs one."""
    normalize = getattr(pdf_reader, "normalize", None)
    if normalize is None:
        return None
    try:
        return normalize(raw)
    except Exception:
        logger.warning("viewer copy write failed", exc_info=True)
        return None


def _bookmark_entries(reader) -> tuple[tuple[str, int], ...]:
    entries: list[tuple[str, int]] = []
    for item in getattr(reader, "outline", None) or []:
        if isinstance(item, list):
            # Nested children of the previous bookmark: top-level only.
            continue
        title = str(getattr(item, "title", "") or "").strip()
        try:
            page_index = reader.get_destination_page_number(item)
        except Exception:
            continue
        if title and page_index is not None and page_index >= 0:
            entries.append((title, int(page_index) + 1))
    return tuple(entries)


def _bookmarks(pdf_reader: PdfTextReader, raw: bytes) -> tuple[tuple[str, int], ...]:
    """Optional reader capability: adapters that can list bookmarks do."""
    reader_bookmarks = getattr(pdf_reader, "bookmarks", None)
    if reader_bookmarks is None:
        return ()
    try:
        return tuple(reader_bookmarks(raw))
    except Exception:
        logger.warning("bookmark read failed; using the contents parse", exc_info=True)
        return ()


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


def _page_segments(pages: list[str]) -> tuple[TextSegment, ...]:
    """One paragraph segment per blank-line block, tagged with its 1-based page.

    Chunking consumes the segment stream, so tagging the same paragraphs the
    pre-page-provenance path derived (from `text.split("\\n\\n")`) cannot move a
    chunk boundary. Page-sized segments would.
    """
    segments: list[TextSegment] = []
    for number, page in enumerate(pages, start=1):
        for part in clean_text(page).split("\n\n"):
            if part.strip():
                segments.append(TextSegment(text=part.strip(), page=number))
    return tuple(segments)


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
        text = extract_article_text(html, context=material.source)
        if not text.strip():
            raise IngestionError("validation_failed", "no readable text at this url")
        return ExtractedContent(text)

    if kind == "file":
        raw = read_source.read(material)
        pages = pdf_reader.extract(raw)
        # `text` keeps the pre-page-provenance construction exactly: one clean
        # over the pages joined with a blank line. It is the uploaded
        # `fulltext.txt` and the resume-on-retry reuse key, so it must stay
        # byte-identical or existing embeddings are invalidated. Per-page
        # cleaning loses the blank-line runs that span page boundaries
        # (963,136 -> 962,401 chars on the 572-page fixture), so the page-tagged
        # segments are derived *alongside* it from the same pages.
        text = "\n\n".join(pages)
        if not text.strip():
            raise IngestionError("validation_failed", "PDF contains no extractable text")
        return ExtractedContent(
            text=clean_text(text),
            segments=_page_segments(pages),
            pages=tuple(pages),
            bookmarks=_bookmarks(pdf_reader, raw),
            viewer_pdf=_viewer_pdf(pdf_reader, raw),
        )

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
