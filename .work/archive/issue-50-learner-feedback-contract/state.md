# State - issue-50-learner-feedback-contract
_Spec: https://github.com/rings0fsaturn/study-planner/issues/50 (map #4) · Plan: archive/issue-50-learner-feedback-contract/plan/DECISIONS.md · STATUS row: issue-50-learner-feedback-contract · Status: done · Updated: 2026-09-24_

## Current state & next
- **Done + wrapped 2026-09-24.** HITL grilling (all six accepted), contract locked in `plan/DECISIONS.md`.
- Wayfinder exit run complete: resolution comment + #50 closed; map #4 body + local snapshot gained the #50 decision line (plus a #46 backfill line the remote map was missing); task folder archived.
- Implementation (endpoint + versioned Jinja template + client + tests + live E2E) is a follow-up build ticket, not this decision.

## Done so far
- Oriented: map #4, #32 spec, #35 Variant B, #47 seam (`types.ts`, `feedbackCopy.ts`, `RoadmapFeedbackSection.tsx`, `useRoadmapFeedback.ts`), #43 mastery shape, guide SSE precedent, OpenRouter client precedent.

## Flow trace
1. Ticket #50 = Decision: LLM-generated learner feedback contract - `wayfinder:grilling`, OPEN (claimed).
2. Blocker #35 CLOSED 2026-09-23 (Variant B). #47 CLOSED 2026-09-23 (static seam, no model call).
3. Seam: `FeedbackCopyInput` -> `FeedbackCopy`, sync or async, `staticFeedbackProvider` default.

## Files affected
- `.work/active/issue-50-learner-feedback-contract/state.md` + `SCRATCHPAD.md` + `plan/DECISIONS.md` (this session).
- Live code read only so far: `apps/app/src/roadmap/feedback/*`, `apps/app/src/assessments/types.ts`, `assessmentClient.ts`, `services/intelligence/app/routers/guide.py`, `mastery.py`, `generation/openrouter_client.py`.

## Pitfalls & rules
- Rule 17: any new endpoint logs with `request_id`, sends `X-Request-ID`, surfaces id on typed errors, no silent fallback.
- Rule 22: new client normalizes abort/network/unknown into typed errors, centralized in client.
- Rule 41: consume `@study-tracker/progress` + `masteryBands`; never recompute BKT/bands in copy layer.
- HITL #35 constraint: plain language leads; raw decimals/% only behind collapsed Model context.
- Advisory only: Keep acknowledges, Open replan navigates; never writes bookings/events.
- Wayfinder: one ticket per session; resolution comment + close + map line at exit.

## Decisions in force
- D-00 Provider = OpenRouter chat/completions, model `meta/muse-spark-1.3-contributor` (user 2026-09-24; amends #9 Gemini note for this arm).
- D-01..D-06 locked 2026-09-24 (see `plan/DECISIONS.md`): server endpoint; whole-input ceiling; exact `FeedbackCopy`; titles+links grounding; LLM on `updated` only with static fallback; advisory-only confirmed.

## Open
- Q1 provider boundary (server endpoint vs client direct).
- Q2 input allowlist (whole `FeedbackCopyInput` vs minimal subset).
- Q3 output schema (exact `FeedbackCopy` vs extended citations).
- Q4 grounding (titles + evidence links vs chunk quotes).
- Q5 stale/rebuild + failure policy.
- Q6 advisory-only + safety confirmation.
