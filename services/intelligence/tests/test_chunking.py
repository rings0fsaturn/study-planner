from __future__ import annotations

from app.ingestion.chunking import (
    DEFAULT_OVERLAP_TOKENS,
    DEFAULT_TARGET_TOKENS,
    _overlap_tail,
    chunk_segments,
    document_segments,
)
from app.ingestion.models import ExtractedContent, TextSegment


def word_counter(text: str) -> int:
    return len(text.split())


def make_words(count: int) -> str:
    return " ".join(f"word{i}" for i in range(count))


def test_empty_input_produces_no_chunks() -> None:
    assert chunk_segments([], word_counter) == []


def test_single_short_segment_is_one_chunk() -> None:
    chunks = chunk_segments([TextSegment("hello world")], word_counter)
    assert len(chunks) == 1
    assert chunks[0].ordinal == 0
    assert chunks[0].text == "hello world"
    assert chunks[0].start_seconds is None


def test_long_document_packs_paragraphs_and_bounds_chunks() -> None:
    paragraphs = [make_words(150) for _ in range(10)]
    segments = [TextSegment(text=paragraph) for paragraph in paragraphs]
    chunks = chunk_segments(segments, word_counter, target_tokens=400, overlap_tokens=60)
    assert len(chunks) >= 3
    assert all(chunk.ordinal == index for index, chunk in enumerate(chunks))
    assert all(word_counter(chunk.text) <= 400 for chunk in chunks)


def test_overlap_tail_is_carried_into_next_chunk() -> None:
    segments = [TextSegment(text=make_words(120)) for _ in range(8)]
    chunks = chunk_segments(segments, word_counter, target_tokens=400, overlap_tokens=60)
    for previous, following in zip(chunks, chunks[1:]):
        tail = _overlap_tail(previous.text, word_counter, 60)
        assert tail, "expected a non-empty overlap tail"
        assert following.text.startswith(tail)
        assert word_counter(tail) <= 60


def test_oversized_paragraph_is_split_without_exceeding_target() -> None:
    segments = [TextSegment(text=make_words(2000))]
    chunks = chunk_segments(segments, word_counter, target_tokens=400, overlap_tokens=60)
    assert len(chunks) >= 5
    assert all(word_counter(chunk.text) <= 400 for chunk in chunks)


def test_timestamp_anchor_comes_from_first_timestamped_segment() -> None:
    segments = [
        TextSegment(text="word " * 5, start_seconds=0.0),
        TextSegment(text="mid " * 5),
        TextSegment(text="tail " * 5, start_seconds=30.0),
    ]
    chunks = chunk_segments(segments, word_counter, target_tokens=10, overlap_tokens=2)
    assert len(chunks) == 2
    assert chunks[0].start_seconds == 0.0
    assert chunks[1].start_seconds == 30.0


def test_timestamped_segments_keep_their_own_anchors() -> None:
    segments = [
        TextSegment(text="word " * 300, start_seconds=0.0),
        TextSegment(text="word " * 300, start_seconds=10.0),
    ]
    chunks = chunk_segments(segments, word_counter, target_tokens=400, overlap_tokens=60)
    assert len(chunks) == 2
    assert chunks[0].start_seconds == 0.0
    assert chunks[1].start_seconds == 10.0


def test_defaults_match_approved_constants() -> None:
    assert DEFAULT_TARGET_TOKENS == 400
    assert DEFAULT_OVERLAP_TOKENS == 30


def test_document_segments_uses_transcript_segments_when_present() -> None:
    extracted = ExtractedContent(
        text="full", segments=(TextSegment("part", 1.0), TextSegment("two", 2.0))
    )
    segments = document_segments(extracted)
    assert len(segments) == 2
    assert segments[0].start_seconds == 1.0


def test_document_segments_splits_paragraphs_otherwise() -> None:
    extracted = ExtractedContent(text="One.\n\nTwo.\n\nThree.")
    segments = document_segments(extracted)
    assert [segment.text for segment in segments] == ["One.", "Two.", "Three."]


def test_document_segments_single_block_stays_whole() -> None:
    extracted = ExtractedContent(text="One.\nTwo.\nThree.")
    segments = document_segments(extracted)
    assert len(segments) == 1
    assert segments[0].text == "One.\nTwo.\nThree."


def test_single_oversized_word_does_not_recurse() -> None:
    from app.ingestion.chunking import TiktokenCounter

    counter = TiktokenCounter()
    segment = TextSegment(text="w" * 5000)
    chunks = chunk_segments([segment], counter, target_tokens=400, overlap_tokens=60)
    assert len(chunks) == 1
    assert chunks[0].text == "w" * 5000


def test_long_unbreakable_url_does_not_recurse() -> None:
    from app.ingestion.chunking import TiktokenCounter

    counter = TiktokenCounter()
    segment = TextSegment(text="https://example.com/" + "a" * 5000)
    chunks = chunk_segments([segment], counter, target_tokens=400, overlap_tokens=60)
    assert len(chunks) == 1
    assert chunks[0].text == segment.text


def test_non_positive_target_is_rejected() -> None:
    import pytest

    with pytest.raises(ValueError):
        chunk_segments([TextSegment("hello world")], word_counter, target_tokens=0)
    with pytest.raises(ValueError):
        chunk_segments([TextSegment("hello world")], word_counter, target_tokens=-5)


def test_join_separator_overhead_does_not_overflow_chunks() -> None:
    def sep_aware(text: str) -> int:
        return len(text.split()) + text.count("\n\n")

    segments = [TextSegment(text="x " * 40), TextSegment(text="y " * 40)]
    chunks = chunk_segments(segments, sep_aware, target_tokens=80, overlap_tokens=0)
    assert len(chunks) == 2
    assert all(sep_aware(chunk.text) <= 80 for chunk in chunks)


def test_real_token_budget_respected_with_tiktoken() -> None:
    from app.ingestion.chunking import TiktokenCounter

    counter = TiktokenCounter()
    paragraphs = [make_words(150) for _ in range(10)]
    segments = [TextSegment(text=paragraph) for paragraph in paragraphs]
    chunks = chunk_segments(segments, counter, target_tokens=400, overlap_tokens=60)
    assert len(chunks) >= 3
    assert all(counter(chunk.text) <= 400 for chunk in chunks)


def test_real_token_overlap_tail_respects_budget() -> None:
    from app.ingestion.chunking import TiktokenCounter

    counter = TiktokenCounter()
    segments = [TextSegment(text=make_words(120)) for _ in range(8)]
    chunks = chunk_segments(segments, counter, target_tokens=400, overlap_tokens=60)
    for previous, following in zip(chunks, chunks[1:]):
        tail = _overlap_tail(previous.text, counter, 60)
        assert tail
        assert following.text.startswith(tail)
        assert counter(tail) <= 60
