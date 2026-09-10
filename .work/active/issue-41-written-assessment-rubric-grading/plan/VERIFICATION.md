# Verification – issue-41-written-assessment-rubric-grading (#41)

_Ticket: #41 · Parent spec #32 · Plan: plan/PLAN.md · Updated: 2026-09-10_

## AC tick-down (all unchecked until proven)

- [ ] AC1 — Written generation uses typed visible payloads and server-only rubric content.
- [ ] AC2 — Written grading returns normalized score, rubric feedback, explanation, citations, warnings, per-skill observations.
- [ ] AC3 — Partial, timeout, provider, retry, no-leakage behavior is tested.
- [ ] AC4 — Results render through the shared review surface.

## Phase gates

- [x] P1 contract: `uv run pytest services/intelligence/contracts/phase2/tests -q` green — 20 passed 2026-09-10 (RED first: 6 failed / 14 passed before the amendment).
- [x] P2 generation: service pytest green (written schema/validation/accept/repair-drop, recipe gate, `_question` subtype); migration 027 applies clean on dev Supabase. — 2026-09-10: 471 passed / 7 pre-existing failures (test_retrieval_probe 2 + test_v1_integration goldens 5, re-confirmed alone); contracts 20 passed; ruff clean on changed files; 027 + 028 pushed to dev Supabase (dry-run first) and a `BEGIN … ROLLBACK` probe proved the written row round-trips with `subtype` + hidden rubric, the assessment flips `ready`, an objective row carrying a subtype is rejected, and `answer_block` stays out of the `authenticated` column grant. 028 repaired the uuid cast 027 dropped from 024 (see plan Notes (b)).
- [x] P3 grading: `uv run pytest services/intelligence/tests -q` green (rubric math, threshold edges, timeout/provider/partial, redaction). — 2026-09-10: focused set (rubric grader + grading worker + grading grader + worker main + assessments API) 76 passed; contracts 20 passed; full service suite 501 passed / 7 pre-existing failures (same `test_retrieval_probe` 2 + `test_v1_integration` 5 set as P2); `ruff check` clean on every changed file. Composed-grade assertions cover weighted partial credit (0.75 / 0.7 / 0.6 / 0.5 / 0.19), inclusive τ=0.6, weight renormalization, and the retryable/non-retryable/redelivery matrices. Live dry run (one real provider call, 565 tokens, 10.9 s): `RUBRIC_GRADING_SCHEMA` accepted under strict mode, partial answer composed to 0.70, grade contained no `referenceAnswer` / `rubricVersion` / `maxPoints`.
- [ ] P4 client: `pnpm --filter app test` green; typecheck + lint clean; redaction grep clean (rubric/reference keys + #40 list).
- [ ] P5 live: `e2e/assessment-written-41-live.spec.ts` green `--workers=1` (short_answer + long_form, real LLM grades, desktop + mobile, retry, restore); evidence in `plan/evidence/`.

## Live evidence

- (pending) `plan/evidence/written-41-*.png`

## Wayfinder resolution (exit)

- [ ] Resolution comment posted on #41; issue closed; Decisions-so-far line appended on map #4; STATUS row flipped to Done; folder archived.
