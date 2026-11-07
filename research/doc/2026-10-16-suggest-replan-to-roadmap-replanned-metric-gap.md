# `suggest_replan` to `RoadmapReplanned` metric gap

- Date: 2026-10-16
- Scope: loop verdict (`suggest_replan`) lifecycle vs `RoadmapReplanned` persistence in this repo
- Sources: live source under `apps/app/src`, `services/intelligence/app`, `packages/`, specs under `.work/specs/issues/017-plausible-analytics.md` and archived issue-47 records. No secondary write-ups used.

## Claim under test

The `suggest_replan` verdict evaporates by design: it is produced, displayed, and preselected, but no persisted record joins it to a later `RoadmapReplanned`, the only attribution field is dead, and no adherence metric consumes either side.

Verdict: **confirmed** against the sources below.

## 1. Verdict lifecycle (advisory, in-memory, never persisted)

- `POST /v1/loop/decision` is the verdict source. Client call: `apps/app/src/assessments/assessmentClient.ts:373-375` (`getLoopDecision` posts to `/v1/loop/decision`).
- Verdict shape is advisory: `apps/app/src/assessments/types.ts:108-109` (advisory loop action), `apps/app/src/assessments/types.ts:147-154` (`LoopDecision` with verdict/confidence/sufficiency/model, fail-closed hold upstream).
- Server owns the advisory-only contract: `services/intelligence/app/routers/loop.py:1-6` ("advisory only, never writes").
- Hook fires on `updated` feedback state only: `apps/app/src/roadmap/feedback/useLoopDecision.ts:214-218`; leaving `updated` clears it (`apps/app/src/roadmap/feedback/useLoopDecision.test.ts:285-295`).
- Memoization is an in-memory session `Map`, not storage: `apps/app/src/roadmap/feedback/useLoopDecision.ts:38-39` (canonical-input hash to verdict promise), capped at 50 entries with oldest-evicted (`apps/app/src/roadmap/feedback/useLoopDecision.ts:34`, `apps/app/src/roadmap/feedback/useLoopDecision.ts:238-242`); dedupe-across-remounts test at `apps/app/src/roadmap/feedback/useLoopDecision.test.ts:246-256`.
- Failures are never cached and resolve to null so static copy renders: `apps/app/src/roadmap/feedback/useLoopDecision.ts:224-236`; retry-after-failure test at `apps/app/src/roadmap/feedback/useLoopDecision.test.ts:297-310` (file tail).
- Verdict folds into feedback copy text only: `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:290-300` (late verdict refires the one batched copy call carrying `{ verdict, confidence }`); seam contract is reshapes-`advisory`/`advisoryNote`-only at `apps/app/src/roadmap/feedback/types.ts:46-50`; server renders it as one prompt DATA line at `services/intelligence/app/generation/prompts.py:655-678` (`_feedback_verdict_line`), consumed by `services/intelligence/app/generation/prompts.py:681-728` (`build_feedback_messages`); copy transport at `apps/app/src/assessments/assessmentClient.ts:369-371`, LLM-only-for-`updated` with static fallback at `apps/app/src/roadmap/feedback/llmFeedbackProvider.ts:41-48`.

## 2. Dialog preselect writes nothing (no join key minted)

- Preselect: `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:422` (`initialChoice` is `replan` iff verdict is `suggest_replan`, else `keep`); late verdict still steers the open dialog via `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:135-139`; tests at `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx:230-244` (preselect) and `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx:246-273` (late verdict flips open dialog).
- Confirm behavior: `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:423-426` (close dialog always; `navigate('/replan')` only on `replan` choice; Keep path does nothing else).
- No event/id/timestamp is persisted at this step: the component file contains no `append`/`logEvent` call (its only store touch is `useEventStore()` at `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:240`, passed read-only into `useRoadmapFeedback`); the file header declares the advisory-never-writes contract at `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:1-11`.
- Keep-writes-nothing is a tested contract: `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx:198-214` (spies `EventStore.prototype.append`, asserts not called, asserts no navigation). Open-replan navigation test at `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx:216-228`.

## 3. `commitReplan` writes `RoadmapReplanned` with no verdict link; `option` is a dead attribution field

- Write: `apps/app/src/roadmap/replan/commitReplan.ts:89` (`logEvent('RoadmapReplanned', ...)`).
- Rebooking via engine: `apps/app/src/roadmap/replan/commitReplan.ts:115-124` (`generateBookings` then per-booking `SessionBooked` emits); future-booking clearing just above at `apps/app/src/roadmap/replan/commitReplan.ts:91-97`; emit-order test at `apps/app/src/roadmap/replan/commitReplan.test.ts:148-170`.
- `option` hardcoded: `apps/app/src/roadmap/replan/commitReplan.ts:86` (`option: 'edit'`).
- Intent comment: `apps/app/src/sync/types.ts:228-229` ("which entry path produced this replan, for analytics/history (optional)"), union at `apps/app/src/sync/types.ts:225-230`.
- Dead: the only `option:` writer in `apps/app/src` is `commitReplan.ts:86`; the other enum members (`extend-deadline`, `increase-hours`, `trim-scope`) have zero writers in `apps/app/src` (verified by source search). The commit test asserts deadline/hours/days/materials/slots/weeks but never asserts `option` (`apps/app/src/roadmap/replan/commitReplan.test.ts:63-73`).
- No join key exists on either side: no verdict id, verdict timestamp, or decision hash field exists on `RoadmapReplannedPayload` (`apps/app/src/sync/types.ts:225-230`), and no verdict field is added to the `RoadmapReplanned` logEvent payload in `apps/app/src/roadmap/replan/commitReplan.ts:74-89`.

## 4. No adherence metric consumes the loop

- `adherence` has zero hits in `apps/app/src`, `packages/`, and `services/intelligence` (verified by repo search; the only `plausible` hit in `apps/app/src` is an unrelated prototype comment at `apps/app/src/prototype/practice-guide/hint-ladders.ts:25`).
- `pace_vs_plan` exists only as a loop-*input* posture field: computed at `apps/app/src/roadmap/feedback/useLoopDecision.ts:132-144`, typed at `apps/app/src/assessments/types.ts:130-136`, defaulted neutral at `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:57-63`. No query, test, or script in the searched trees computes pace recovery from it.
- `recovery` hits in `apps/app/src` are session/auth UI states (e.g. `apps/app/src/pages/Session.tsx:490`, `apps/app/src/session/SessionLifecycle.ts:118-154`), not pace-recovery metrics.

## 5. Specced telemetry is unwired; Keep-acknowledgement tension is real but intentional

- Spec plans the join: `.work/specs/issues/017-plausible-analytics.md:14` (custom events including `replan_chosen`), `.work/specs/issues/017-plausible-analytics.md:25` (`replan_chosen` emitted when `RoadmapReplanned` is appended, with chosen-option property), `.work/specs/issues/017-plausible-analytics.md:28-29` (fake-client tests + `TELEMETRY.md` documentation).
- Unwired status: no `replan_chosen` string, no Plausible client, and no `TELEMETRY.md` exist in the repo (verified by search and glob). All acceptance boxes in `.work/specs/issues/017-plausible-analytics.md:18-29` remain unchecked.
- Keep acknowledgement-only contract: `.work/archive/issue-47-roadmap-feedback/plan/PLAN.md:16` (Keep = acknowledgement only, Open replan = `navigate('/replan')`, advisory never writes), `.work/archive/issue-47-roadmap-feedback/state.md:24`, `.work/archive/issue-47-roadmap-feedback/plan/VERIFICATION.md:10` (Keep asserted via `EventStore.append` spy), `.work/STATUS.md:46` (Variant B evidence ledger, Keep = acknowledgement), `.work/archive/issue-50-learner-feedback-contract/plan/DECISIONS.md:37` (copy layer never writes).
- Tension: wiring the metric requires persisting *something* about the decision, while the shipped contract requires Keep to write *nothing* (`apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx:198-214`). Any fix must keep that test green.

## 6. What is persisted vs in-memory (store/sync boundary)

- Per-user Dexie DB: `apps/app/src/events/EventStoreProvider.tsx:15-17` (`StudyTracker_<userId>`); schema versions 1-7 at `apps/app/src/events/EventStoreProvider.tsx:21-78`, including non-synced `masteryCache` precedent at `apps/app/src/events/EventStoreProvider.tsx:65-78` and explicitly-never-synced attempt tables at `apps/app/src/events/EventStoreProvider.tsx:57-63`.
- Durable write path: `apps/app/src/events/EventStore.ts:36-44` (`append` to `events` table) plus `apps/app/src/sync/SyncEngine.ts:97-125` (`logEvent` = local `append` + `sync_queue` row + flush/snapshot scheduling).
- The loop verdict never enters that path: it lives in React state (`apps/app/src/roadmap/feedback/useLoopDecision.ts:208`) and the session memo (`apps/app/src/roadmap/feedback/useLoopDecision.ts:38-39`), and is passed only to the copy provider (`apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:290-300`).

## Fix direction (proposal, not yet implemented)

1. Mint a lightweight join key as an additive optional field (preserves Keep-writes-nothing): e.g. optional `loopDecisionId`/`verdict`/`decidedAt` on the feedback-to-replan handoff and optional mirror fields on `RoadmapReplannedPayload` beside `apps/app/src/sync/types.ts:228-229`. Additive-optional mirrors the existing `option?` and `loopDecision?` (`apps/app/src/roadmap/feedback/types.ts:46-50`) precedents; per the Dexie additive-evolution rule, widen the reader rather than rewriting history.
2. Compute adherence from already-durable events instead of new writes: `SessionBookedPayload` at `apps/app/src/sync/types.ts:183-189` (plan) vs `SessionLogged` rows healed/synced via `apps/app/src/sync/SyncEngine.ts:293-298`, `apps/app/src/sync/SyncEngine.ts:577-617` (actuals). Pace recovery = post-replan actuals vs post-replan bookings; no new event kinds needed.
3. Wire the specced telemetry: emit `replan_chosen` with the chosen-option property at the `RoadmapReplanned` call site per `.work/specs/issues/017-plausible-analytics.md:25`, which also gives the dead `option` enum a real producer for the replan-entry paths. Keep path stays write-free so `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.test.tsx:198-214` keeps passing.
