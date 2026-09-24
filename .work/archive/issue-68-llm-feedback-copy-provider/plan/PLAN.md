# Plan - issue-68-llm-feedback-copy-provider (executed 2026-09-24)

Builds the #50 contract behind the #47 seam. Defaults confirmed by user:
Python builder + `feedback-v1`, `FEEDBACK_*` env prefix, LLM-with-static-fallback default.

## Phases (as executed; OCR review between each)

1. **Backend** - `routers/feedback.py` (`POST /v1/feedback/copy`), `feedback-v1`
   builder + schema in `generation/prompts.py`, factory `model` kwarg,
   `main.py` registration, `tests/test_feedback_copy.py` (12 tests).
   Merged planned P1+P2 to avoid double-touching files.
2. **Frontend** - `AssessmentClient.getFeedbackCopy`, fake + script + factory,
   `llmFeedbackProvider.ts`, section LLM default with key-stabilized identity.
3. **Section behavior + safety** - AC1 section test, redaction sweep
   (no `console.*`, no decimals in copy code, exact-body client test).
4. **Impeccable fix (live-found)** - `useRoadmapFeedback.settled` + section
   and effect gates against the cold-copy flash; 3 more tests.
5. **Live E2E + exit** - `e2e/feedback-copy-live.spec.ts` 3/3 at 1280 + 375
   with request-id join and evidence PNGs; resolution comment; #68 closed;
   map #4 line (remote body + local snapshot); archived.

## Live-run prerequisites (operator)

- `export FEEDBACK_REASONING_EFFORT=low` in the SAME command as
  `./full-app start|restart` (bare restarts drop it; the contract model
  mandates reasoning and 400s without it). `FEEDBACK_MODEL` stays unset
  for the contract default (needs the OpenRouter 18+ attestation, done
  2026-09-24).
- `E2E_LIVE_EMAIL` / `E2E_LIVE_PASSWORD` / `SUPABASE_PUBLISHABLE_KEY` in env.
- Live specs seed-then-navigate (raw IDB writes bypass Dexie liveQuery).
