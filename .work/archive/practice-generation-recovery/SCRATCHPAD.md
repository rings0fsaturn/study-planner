# Scratchpad – practice-generation-recovery · session 2026-09-15
_state.md: active/practice-generation-recovery/state.md · Updated: 2026-09-15T17:20_

## Now / Next
- Doing: records written (state.md, VERIFICATION.md, STATUS + #44 note) — all phases landed and verified
- Next: on user sign-off, wrap this task (archive + STATUS flip to Done)
- Blocked: none

## Session log
- 17:15 FOUND  generation worker absent: `ps aux` has only uvicorn+Vite; `ingestion-worker.log` ends "received signal 15" at 14:19 (worker_main.py:249). Job `ea7aefd2…` kind=generation `queued` attempt 15 since 17:06; assessment `c8b4171a…` `generating`, warnings=[], 0 questions.
- 17:16 FOUND  full-app profiles (scripts/full_app.py:66) are `["intelligence","app"]`; no worker in SERVICES; worker launched only via scripts/run-detached-ingestion-worker.sh (issue-44 state.md:31 documents the gap).
- 17:17 DECIDED retry re-enqueues the SAME assessment via existing `enqueue_assessment_generation` RPC, gated to `status='generating'` (a `failed` assessment's message would be dropped by generation/worker.py:157) — no migration needed.
- 17:18 DECIDED ponytail full mode per user request: reuse existing helpers, shortest diff, YAGNI.
- 17:20 DONE   task folder opened: active/practice-generation-recovery/{plan,state,SCRATCHPAD}, STATUS row added.
- 17:20 NEXT   start the worker (Phase 1) and verify the drain
- 17:30 DONE   worker started detached (pids 11852/11855), queue drained FIFO; user's job ea7aefd2 processed.
- 17:35 FOUND  user's generation FAILED `malformed_output`/`difficulty_mismatch` (validation.py:106-108 hard gate, exact-band difficulty). Non-retryable terminal by design; the run page now shows the honest "could not be generated" state. Root cause of the spinner was the dead worker, now fixed. Fresh runs regenerate cleanly.
- 17:35 DECIDED do not touch the difficulty gate (contract); Phase B retry stays gated to `status='generating'` (retryable provider errors), `failed` keeps honest copy.
- 17:36 NEXT   Phase A: worker service in scripts/full_app.py
- 17:50 DONE   Phase A: `Service` port/health optional + worker service + profiles + tests; `./full-app restart full` runs all three (worker health=running, log worker.log); `uv run python -m pytest scripts/tests/test_full_app.py` 8 passed.
- 18:00 DONE   Phase B: `POST /v1/assessments/{id}/regenerate` route (reuses `enqueue_generation`), openapi path, client `regenerateAssessment`, fake `scriptRegenerate`, PracticeRun warnings+retry UI. Backend 7 new tests pass; client test added.
- 18:10 DONE   Phase C: `mergeEnvelopes` (identity-stable) in practiceRunModel + PracticeRun; 5 unit tests. Focused frontend 43/43; full app suite 872/874 (2 = known seedTestData WSL TZ flakes); typecheck, lint, build green.
- 18:20 DONE   Live spec `e2e/practice-run-live.spec.ts` 2/2 (desktop + phone) against the managed worker; regenerate route live (OPTIONS 200 / GET 405).
- 18:25 NEXT   distil records, refresh STATUS + #44 note, write plan/VERIFICATION.md
- 18:30 DONE   state.md distilled, plan/VERIFICATION.md written, STATUS row + #44 stale note updated, rule 10 updated.
- 18:30 NEXT   wrap on user sign-off