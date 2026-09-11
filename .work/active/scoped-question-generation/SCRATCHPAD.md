# Scratchpad – scoped-question-generation · session 2026-09-11
_state.md: active/scoped-question-generation/state.md · Updated: 2026-09-11T05:27_

## Now / Next
- Doing: nothing in flight — P1 (steer + meta blocklist) is implemented, live-verified and recorded; GitHub #62 filed + claimed.
- Next: P2 page provenance — `TextSegment.page` / `ContentChunk.page_start|page_end`, per-page PDF extraction (byte-identical joined text), chunk page propagation, and migration 029 (chunk page columns + nullable page bounds in `match_content_chunks`, migration-016 body copied verbatim).
- Blocked: none for P2.

## Session log
- 05:27 RESET  P1 session closed. Trail distilled into `state.md` (Done so far, Files affected, Pitfalls, D-08, Open); plan P1 marked done with notes, verification gate ticked, evidence written to `research/2026-09-11-p1-live-verification.md`, STATUS row refreshed.
- 05:5x FOUND  the "credentials no longer work" claim was wrong: `.work/specs/test-login-cred.txt` wraps each value in backticks, so the password grant was sent `\`user@host\`` and answered `invalid_credentials`.
- 05:5x DONE   authenticated API run: grant 200 -> `POST /v1/assessments/generate` (chapter steer) -> 202 -> `ready`; question is Chapter 5 content (ZBB) citing ordinal 203. Records corrected (state/PLAN/VERIFICATION/evidence) to carry the backtick quirk instead of the false claim.
