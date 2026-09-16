# Scratchpad – issue-42-coding-assessment-sandbox-grading

_state.md: active/issue-42-coding-assessment-sandbox-grading/state.md · Reset: 2026-09-16 (P3 session distilled)_

## Now / Next

- Doing: (no live session) P3 done and committed
- Next: P4 — client slice: `types.ts` coding fields, `attemptFlow.submitCodingAttempt`, `CodingTaker.tsx` (lazy CodeMirror + Pyodide advisory), `ReviewSurface` execution table, `AssessmentConfig` Coding chip; PracticeThis stays disabled (D-08)
- Blocked: none
- Session-start decisions (read before P4): LLM picks the coding subtype (3-branch schema, P3); Piston is the sandbox (profile `sandbox`, demand-start, stop after); self-check failures drop with `self_check_failed`; `hasCode`/`codeLanguages` already browser-readable via Supabase `select('*')`; P5 output_prediction determinism needs a seeded row or generation retries

## Session log

- (reset — P3 session log distilled into state.md "Done so far", "Files affected", "Pitfalls & rules", "Decisions in force")