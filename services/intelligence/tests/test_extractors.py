from __future__ import annotations

import pytest

from app.ingestion.extractors import (
    HttpxFetcher,
    PypdfTextReader,
    YoutubeTranscriptClient,
    extract_article_text,
    extract_material,
    youtube_video_id,
)
from app.ingestion.models import IngestionError, Material


def make_material(kind: str, source: str = "") -> Material:
    return Material(
        id="mat-1",
        owner_id="user-1",
        title="A material",
        kind=kind,  # type: ignore[arg-type]
        source=source,
        ingestion_state="pending",
    )


class FakeFetcher:
    def __init__(self, html: str | None = None) -> None:
        self.html = html

    def fetch(self, url: str) -> str:
        if self.html is None:
            raise IngestionError("provider_unavailable", "page fetch failed", retryable=True)
        return self.html


class FakePdfReader:
    def __init__(self, text: str = "pdf text") -> None:
        self.text = text

    def extract(self, data: bytes) -> str:
        if not data:
            raise IngestionError("validation_failed", "PDF could not be read")
        return self.text


class FakeTranscripts:
    def __init__(self, segments: list[tuple[float, str]] | None = None) -> None:
        self.segments = (
            [(0.0, "hello"), (5.5, "world")] if segments is None else segments
        )

    def fetch(self, video_id: str) -> list[tuple[float, str]]:
        return self.segments


class FakeSourceReader:
    def __init__(self, data: bytes = b"pdf-bytes") -> None:
        self.data = data

    def read(self, material: Material) -> bytes:
        return self.data


def extract(
    material: Material,
    fetcher: FakeFetcher | None = None,
    pdf: FakePdfReader | None = None,
    transcripts: FakeTranscripts | None = None,
    source: FakeSourceReader | None = None,
):
    return extract_material(
        material,
        fetcher=fetcher or FakeFetcher("<html><body>page</body></html>"),
        pdf_reader=pdf or FakePdfReader(),
        transcripts=transcripts or FakeTranscripts(),
        read_source=source or FakeSourceReader(),
    )


def test_youtube_video_id_formats() -> None:
    assert youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert youtube_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert youtube_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert youtube_video_id("not a url") is None


def test_manual_material_extracts_cleaned_text() -> None:
    content = extract(make_material("manual", "  Hello   world\n\nSecond para  "))
    assert content.text == "Hello world\n\nSecond para"


def test_contentless_manual_material_is_terminal_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(make_material("manual", ""))
    assert exc_info.value.code == "validation_failed"
    assert not exc_info.value.retryable


def test_url_material_extracts_readable_text() -> None:
    html = "<html><body><h1>Title</h1><p>The quick brown fox jumps.</p></body></html>"
    content = extract(make_material("url", "https://example.com/a"), fetcher=FakeFetcher(html))
    assert "quick brown fox" in content.text


def test_url_fetch_failure_is_retryable() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(make_material("url", "https://example.com/a"), fetcher=FakeFetcher(None))
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable


def test_url_with_no_readable_text_is_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(
            make_material("url", "https://example.com/a"),
            fetcher=FakeFetcher("<html>   </html>"),
        )
    assert exc_info.value.code == "validation_failed"


def test_file_material_extracts_pdf_text() -> None:
    content = extract(make_material("file", "paper.pdf"), pdf=FakePdfReader("PDF body text"))
    assert content.text == "PDF body text"


def test_file_material_missing_object_is_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(
            make_material("file", "paper.pdf"),
            pdf=FakePdfReader(),
            source=FakeSourceReader(b""),
        )
    assert exc_info.value.code == "validation_failed"


def test_youtube_material_extracts_timestamped_segments() -> None:
    content = extract(
        make_material("youtube", "https://youtu.be/dQw4w9WgXcQ"),
        transcripts=FakeTranscripts([(0.0, "first line"), (3.25, "second line")]),
    )
    assert content.text == "first line\nsecond line"
    assert len(content.segments) == 2
    assert content.segments[0].start_seconds == 0.0
    assert content.segments[1].start_seconds == 3.25


def test_youtube_invalid_url_is_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(make_material("youtube", "not a url"), transcripts=FakeTranscripts())
    assert exc_info.value.code == "validation_failed"


def test_youtube_missing_transcript_is_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(
            make_material("youtube", "https://youtu.be/dQw4w9WgXcQ"),
            transcripts=FakeTranscripts([]),
        )
    assert exc_info.value.code == "validation_failed"


def test_article_fallback_strips_script_and_tags() -> None:
    html = (
        "<html><head><script>var secret = 1;</script><style>p{}</style></head>"
        "<body><div>Visible &amp; readable text here.</div></body></html>"
    )
    text = extract_article_text(html)
    assert "Visible & readable text here." in text
    assert "script" not in text.lower()


def test_preview_truncates_long_text() -> None:
    content = extract(make_material("manual", "word " * 500))
    preview = content.preview(limit=50)
    assert len(preview) <= 51
    assert preview.endswith("…")


def test_url_material_cleans_successful_trafilatura_output(monkeypatch) -> None:
    def fake_extract(*args, **kwargs):
        return "  Dirty\n\n\ntext   with  spacing  "

    monkeypatch.setattr("trafilatura.extract", fake_extract)
    content = extract(
        make_material("url", "https://example.com/a"),
        fetcher=FakeFetcher("<html><body>irrelevant</body></html>"),
    )
    assert content.text == "Dirty\n\ntext with spacing"


def test_url_material_empty_source_is_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(make_material("url", "   "))
    assert exc_info.value.code == "validation_failed"


def test_file_material_cleans_pdf_output() -> None:
    content = extract(
        make_material("file", "paper.pdf"),
        pdf=FakePdfReader("  Page   one\n\n\n\n   Page two   "),
    )
    assert content.text == "Page one\n\nPage two"


def test_youtube_transcript_client_converts_snippet_objects(monkeypatch) -> None:
    from youtube_transcript_api._transcripts import FetchedTranscript, FetchedTranscriptSnippet

    transcript = FetchedTranscript(
        snippets=[
            FetchedTranscriptSnippet(text="first line", start=0.0, duration=4.0),
            FetchedTranscriptSnippet(text="second line", start=3.25, duration=4.0),
        ],
        video_id="dQw4w9WgXcQ",
        language="en",
        language_code="en",
        is_generated=False,
    )

    class FakeApi:
        def fetch(self, *args, **kwargs):
            return transcript

    monkeypatch.setattr("youtube_transcript_api.YouTubeTranscriptApi", lambda: FakeApi())
    client = YoutubeTranscriptClient()
    assert client.fetch("dQw4w9WgXcQ") == [(0.0, "first line"), (3.25, "second line")]


def test_youtube_transcript_client_missing_transcript_is_validation_failure(
    monkeypatch,
) -> None:
    from youtube_transcript_api import VideoUnavailable

    class FailingApi:
        def fetch(self, *args, **kwargs):
            raise VideoUnavailable("no transcript")

    monkeypatch.setattr("youtube_transcript_api.YouTubeTranscriptApi", lambda: FailingApi())
    client = YoutubeTranscriptClient()
    with pytest.raises(IngestionError) as exc_info:
        client.fetch("dQw4w9WgXcQ")
    assert exc_info.value.code == "validation_failed"
    assert not exc_info.value.retryable


def test_youtube_transcript_client_transient_failure_is_retryable(monkeypatch) -> None:
    class FailingApi:
        def fetch(self, *args, **kwargs):
            raise RuntimeError("network hiccup")

    monkeypatch.setattr("youtube_transcript_api.YouTubeTranscriptApi", lambda: FailingApi())
    client = YoutubeTranscriptClient()
    with pytest.raises(IngestionError) as exc_info:
        client.fetch("dQw4w9WgXcQ")
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable


def test_unsupported_material_kind_is_validation_failure() -> None:
    with pytest.raises(IngestionError) as exc_info:
        extract(make_material("docx", "notes.docx"))
    assert exc_info.value.code == "validation_failed"
    assert not exc_info.value.retryable


def test_httpx_fetcher_429_is_quota_exhausted() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    fetcher = HttpxFetcher(client=client)
    with pytest.raises(IngestionError) as exc_info:
        fetcher.fetch("https://example.com/")
    assert exc_info.value.code == "quota_exhausted"
    assert not exc_info.value.retryable


def test_httpx_fetcher_500_is_retryable_provider_error() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    fetcher = HttpxFetcher(client=client)
    with pytest.raises(IngestionError) as exc_info:
        fetcher.fetch("https://example.com/")
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable


def test_httpx_fetcher_404_is_validation_failure() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    fetcher = HttpxFetcher(client=client)
    with pytest.raises(IngestionError) as exc_info:
        fetcher.fetch("https://example.com/")
    assert exc_info.value.code == "validation_failed"
    assert not exc_info.value.retryable


def test_httpx_fetcher_timeout_is_provider_timeout() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("connection timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    fetcher = HttpxFetcher(client=client)
    with pytest.raises(IngestionError) as exc_info:
        fetcher.fetch("https://example.com/")
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable


def test_pypdf_reader_rejects_malformed_pdf() -> None:
    with pytest.raises(IngestionError) as exc_info:
        PypdfTextReader().extract(b"this is not a pdf at all")
    assert exc_info.value.code == "validation_failed"
    assert not exc_info.value.retryable


def test_httpx_fetcher_normalizes_provider_failures() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    fetcher = HttpxFetcher(client=client)
    with pytest.raises(IngestionError) as exc_info:
        fetcher.fetch("https://example.com/")
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable


def test_pypdf_reader_parses_minimal_pdf() -> None:
    data = make_pdf(b"Hello from a minimal PDF.")
    text = PypdfTextReader().extract(data)
    assert "Hello from a minimal PDF." in text


def make_pdf(body: bytes) -> bytes:
    """Build a minimal single-page PDF with extractable text (valid xref)."""
    content = b"BT /F1 12 Tf 72 720 Td (" + body + b") Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>"
        ),
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return bytes(out)
