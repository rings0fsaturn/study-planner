# P2 pre-check — can page provenance ride the existing segmentation? (2026-09-11)

Offline, no API cost, on the real document (`e2e/pdf/sample-textbook-572page.pdf`, 22,919,258 bytes = byte-for-byte the stored copy of the ingested ACCA APM material). Probe: `/tmp/p2_page_identity.py` (ad-hoc, not committed).

## Setup

- Today's `file` path: `clean_text("\n\n".join(raw_pages))` -> split on `\n\n` -> paragraph segments -> `chunk_segments` (`extractors.py:176-181`, `chunking.py:44-55`, `worker.py:367`).
- P2's path: clean per page, keep pages separate, give every paragraph its page, feed the same chunker.
- The question: does attaching a page move a chunk boundary? If it does, chunk texts change, the 754-chunk baseline moves, and every measured retrieval number is invalidated.

## Results

| Measurement | Result |
|---|---|
| Fixture vs stored copy | 22,919,258 bytes, **same file** |
| Pages | 572 (0 blank) |
| Paragraph stream: today vs per-page | **identical** (1257 paragraphs both) |
| Joined `ExtractedContent.text`: today vs per-page | **NOT identical** — 963,136 vs 962,401 chars |
| Chunks from today's path | **754** — reproduces the live baseline exactly |
| Chunks missing a page, derived by text lookup | 751/754 |

## What this settles

1. **The paragraph stream is the safe attachment point.** Chunking consumes segments (`document_segments` returns `extracted.segments` when present, else the `\n\n` paragraphs), so tagging those same 1257 paragraphs with a page cannot move a boundary, and the 754-chunk baseline holds. This is the rung P2 should take: page-tagged paragraph segments built from per-page text.
2. **`ExtractedContent.text` must keep being built the old way.** Cleaning per page and joining loses 735 characters of blank-line runs that span page boundaries (page A's trailing newlines + the separator + page B's leading newlines collapse differently when cleaned once as a whole vs per page). That text is uploaded as `fulltext.txt` (`worker.py:347-348`) and is what the resume/reuse assumption at `worker.py:391-397` rests on, so the file branch should derive page-tagged segments *alongside* an unchanged `text`.
3. **Page lookup by text cannot work.** Only 3/754 chunks start at a paragraph boundary: `flush()` composes `parts = carry + current` (`chunking.py:88`), so most chunk texts open with the previous chunk's overlap tail. The page must be carried through the chunker — including the overlap tail, which today is created as a bare `TextSegment(tail)` with no page (`chunking.py:127-130`) — and `page_start` should be the page of the first part, `page_end` the page of the last.

## Entry conditions for P2

- Branch `phase2/issue-62-scoped-question-generation` at `7411ebb`, clean and pushed.
- Next migration number is **029**; the hybrid function body to copy verbatim is `apps/app/supabase/migrations/016_hybrid_rrf_tuning.sql` (4-arg overload, k=60, dense 1.0, lexical 0.7, pool 25).
- Live re-ingest needs: migration pushed to the dev project (rule 36), the material's chunk rows deleted (D-07 — otherwise `worker.py:391-397` reuses them and the new columns stay NULL), the detached worker restarted after any `services/intelligence/app/` change (rule 53), and the sidecar up on :8200 for the free re-embed.
