# Scratchpad – scoped-question-generation · session 2026-09-11
_state.md: active/scoped-question-generation/state.md · Updated: 2026-09-11T06:20_

## Now / Next
- Doing: nothing in flight — P1 is done, verified live and pushed (`7411ebb`); P2 is unblocked and its entry conditions are pinned.
- Next: **P2 page provenance.** Branch `phase2/issue-62-scoped-question-generation`. Order: `models.py` (`TextSegment.page`, `ContentChunk.page_start/page_end`) -> `extractors.py` (per-page PDF read; page-tagged paragraph segments **alongside the unchanged `text`**) -> `chunking.py` (propagate through `flush()` **and the overlap tail**) -> `worker.py`/`repository.py` (columns) -> migration 029 (`page_start`/`page_end` + nullable `p_page_start`/`p_page_end` in both CTEs, body copied verbatim from 016).
- Blocked: none. Traps to respect (measured offline, `research/2026-09-11-p2-precheck-page-identity.md`): attach pages to the existing paragraph segments (page-sized segments re-cut all 754 chunks); keep `ExtractedContent.text` built by one `clean_text` over the joined raw pages (per-page cleaning loses 735 chars of boundary blank lines); derive pages in the chunker, never by text lookup (only 3/754 chunks start at a paragraph boundary).

## Session log
- 05:27 RESET  P1 session closed. Trail distilled into `state.md` (Done so far, Files affected, Pitfalls, D-08, Open); plan P1 marked done with notes, verification gate ticked, evidence written to `research/2026-09-11-p1-live-verification.md`, STATUS row refreshed.
- 05:5x FOUND  the "credentials no longer work" claim was wrong: `.work/specs/test-login-cred.txt` wraps each value in backticks, so the password grant was sent `\`user@host\`` and answered `invalid_credentials`.
- 05:5x DONE   authenticated API run: grant 200 -> `POST /v1/assessments/generate` (chapter steer) -> 202 -> `ready`; question is Chapter 5 content (ZBB) citing ordinal 203. Records corrected (state/PLAN/VERIFICATION/evidence) to carry the backtick quirk instead of the false claim. Pushed `7411ebb`.
- 06:1x FOUND  P2 pre-check offline on the real 572-page fixture: paragraph stream (1257) is identical whether cleaned as one blob or per page, and today's path reproduces **754 chunks** exactly -> pages can be attached to the existing paragraph segments without moving a boundary.
- 06:1x FOUND  per-page cleaning + join is NOT byte-identical to today's single clean (963,136 vs 962,401 chars): `ExtractedContent.text` must keep the old construction, since it is the uploaded `fulltext.txt` (`worker.py:347-348`).
- 06:1x FOUND  page-by-text-lookup fails (3/754): `flush()` composes `carry + current` (`chunking.py:88`), so most chunks open with the overlap tail; the page must be carried through the chunker, tail included.
- 06:2x DONE   entry conditions for P2 recorded in `plan/PLAN.md` under Phase 2; evidence in `research/2026-09-11-p2-precheck-page-identity.md`. Ready to hand to a fresh session.
