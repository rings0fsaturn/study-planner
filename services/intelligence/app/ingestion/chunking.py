"""Deterministic structure-first recursive chunking.

Target ~400 tokens per chunk with ~30-token overlap. The overlap was reduced
from 60 tokens on 2026-08-14 (performance-baseline C3): the 60-token tail
re-embedded ~19% of a 572-page book (measured), and 30 tokens keeps chunk
boundary continuity at ~10% waste on quota-billed embeddings. Overlapping tail
text is carried without timestamps so `start_seconds` stays anchored to the
chunk's first timestamped segment.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

from .models import ContentChunk, ExtractedContent, TextSegment

DEFAULT_TARGET_TOKENS = 400
DEFAULT_OVERLAP_TOKENS = 30

TokenCounter = Callable[[str], int]


def _split_text_by_tokens(text: str, counter: TokenCounter, target: int) -> list[str]:
    """Greedy word-level split of one text into pieces of at most target tokens.

    The budget is measured on the actual joined piece text, so separator
    tokens between words count towards the target.
    """
    words = text.split(" ")
    pieces: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word]) if current else word
        if current and counter(candidate) > target:
            pieces.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        pieces.append(" ".join(current))
    return [piece for piece in pieces if piece]


def document_segments(extracted: ExtractedContent) -> list[TextSegment]:
    """Structure-first segment stream: timestamped transcript segments, else paragraphs."""
    if extracted.segments:
        return list(extracted.segments)
    paragraphs = [
        TextSegment(text=part.strip())
        for part in extracted.text.split("\n\n")
        if part.strip()
    ]
    if len(paragraphs) > 1:
        return paragraphs
    return [TextSegment(text=extracted.text)]


def _overlap_tail(text: str, counter: TokenCounter, overlap_tokens: int) -> str:
    if overlap_tokens <= 0 or not text:
        return ""
    words = text.split(" ")
    taken: list[str] = []
    for word in reversed(words):
        candidate = " ".join([word, *taken]) if taken else word
        if counter(candidate) > overlap_tokens:
            break
        taken.append(word)
    return " ".join(reversed(taken))


def chunk_segments(
    segments: Sequence[TextSegment],
    counter: TokenCounter,
    target_tokens: int = DEFAULT_TARGET_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
) -> list[ContentChunk]:
    """Chunk extracted segments into ordinal chunks with bounded token counts."""
    if target_tokens < 1:
        raise ValueError("target_tokens must be positive")
    chunks: list[ContentChunk] = []
    carry: list[TextSegment] = []
    carry_tokens = 0
    current: list[TextSegment] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current, current_tokens, carry, carry_tokens
        parts = carry + current
        current = []
        current_tokens = 0
        carry = []
        carry_tokens = 0
        if not parts:
            return
        text = "\n\n".join(part.text for part in parts)
        if not text.strip():
            return
        first_start = next(
            (part.start_seconds for part in parts if part.start_seconds is not None), None
        )
        if counter(text) > target_tokens:
            # Separator tokens (e.g. "\n\n" between segments) can push the
            # joined text over budget even when every part fit alone; re-split
            # the joined text so the real bound holds. Only the first sub-piece
            # keeps the timestamp anchor.
            pieces = _split_text_by_tokens(text, counter, target_tokens)
            first = True
            for piece in pieces:
                chunks.append(
                    ContentChunk(
                        material_id="",
                        text=piece,
                        ordinal=len(chunks),
                        start_seconds=first_start if first else None,
                    )
                )
                first = False
        else:
            chunks.append(
                ContentChunk(
                    material_id="",
                    text=text,
                    ordinal=len(chunks),
                    start_seconds=first_start,
                )
            )
        tail = _overlap_tail(text, counter, overlap_tokens)
        if tail:
            carry = [TextSegment(tail)]
            carry_tokens = counter(tail)

    def feed(segment: TextSegment) -> None:
        nonlocal carry_tokens, current_tokens
        text = segment.text
        if not text.strip():
            return
        tokens = counter(text)
        if current and carry_tokens + current_tokens + tokens > target_tokens:
            flush()
        if not current and carry_tokens + tokens > target_tokens:
            # The overlap tail would overflow the next chunk; drop it at this
            # boundary rather than produce an oversized chunk.
            carry.clear()
            carry_tokens = 0
        if tokens > target_tokens:
            pieces = _split_text_by_tokens(text, counter, target_tokens)
            if len(pieces) == 1:
                # An indivisible token larger than the target: keep it whole as
                # its own chunk rather than recursing forever on the same text.
                current.append(segment)
                current_tokens += tokens
                return
            for piece in pieces:
                feed(TextSegment(piece, segment.start_seconds))
            return
        current.append(segment)
        current_tokens += tokens

    for segment in segments:
        feed(segment)
    flush()
    return chunks


class TiktokenCounter:
    """Production token counter backed by tiktoken cl100k_base (lazy load)."""

    def __init__(self) -> None:
        self._encoder = None

    def _load(self):
        if self._encoder is None:
            import tiktoken

            self._encoder = tiktoken.get_encoding("cl100k_base")
        return self._encoder

    def __call__(self, text: str) -> int:
        return len(self._load().encode(text))
