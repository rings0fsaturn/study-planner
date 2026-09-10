# Verification – issue-41-written-assessment-rubric-grading (#41)

_Ticket: #41 · Parent spec #32 · Plan: plan/PLAN.md · Updated: 2026-09-10_

## AC tick-down (all unchecked until proven)

- [ ] AC1 — Written generation uses typed visible payloads and server-only rubric content.
- [ ] AC2 — Written grading returns normalized score, rubric feedback, explanation, citations, warnings, per-skill observations.
- [ ] AC3 — Partial, timeout, provider, retry, no-leakage behavior is tested.
- [ ] AC4 — Results render through the shared review surface.

## Phase gates

- [x] P1 contract: `uv run pytest services/intelligence/contracts/phase2/tests -q` green — 20 passed 2026-09-10 (RED first: 6 failed / 14 passed before the amendment).
- [ ] P2 generation: service pytest green (written schema/validation/accept/repair-drop, recipe gate, `_question` subtype); migration 027 applies clean on dev Supabase.
- [ ] P3 grading: `uv run pytest services/intelligence/tests -q` green (rubric math, threshold edges, timeout/provider/partial, redaction).
- [ ] P4 client: `pnpm --filter app test` green; typecheck + lint clean; redaction grep clean (rubric/reference keys + #40 list).
- [ ] P5 live: `e2e/assessment-written-41-live.spec.ts` green `--workers=1` (short_answer + long_form, real LLM grades, desktop + mobile, retry, restore); evidence in `plan/evidence/`.

## Live evidence

- (pending) `plan/evidence/written-41-*.png`

## Wayfinder resolution (exit)

- [ ] Resolution comment posted on #41; issue closed; Decisions-so-far line appended on map #4; STATUS row flipped to Done; folder archived.
