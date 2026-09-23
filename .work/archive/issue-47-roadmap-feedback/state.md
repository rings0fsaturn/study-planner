# State - issue-47-roadmap-feedback
_Spec: https://github.com/rings0fsaturn/study-planner/issues/47 (parent #32, map #4) · local mirror specs/phase2-tickets/15-roadmap-feedback-implementation.md · Plan: archive/issue-47-roadmap-feedback/plan/PLAN.md · STATUS row: issue-47-roadmap-feedback · Status: done · Updated: 2026-09-23_

## Current state & next
- **Done + wrapped 2026-09-23.** All four ACs met (see `plan/VERIFICATION.md`); code + tests green; live-verified at 1280 + 375.
- Wayfinder exit run complete: resolution comment + ACs ticked + #47 closed; map #4 body + local snapshot gained the #47 decision line (and the #21 cluster annotation); task folder archived.
- Closing #47 unblocks #49 Phase 2 Integrated Verification.

## Done so far
- Opened the task + STATUS Active row; claimed #47 (assigned `rings0fsaturn`).
- P1: `feedback/types.ts` (`FeedbackState`, `FeedbackRead`, `FeedbackEvidence`, `FeedbackCopyInput`, `FeedbackCopy`, `FeedbackCopyProvider`), `feedbackModel.ts` (`readFor`, `selectHeadline`, `buildEvidence`, `projectionsEqual`), `feedbackCopy.ts` (`staticFeedbackCopy` + `staticFeedbackProvider`).
- P2: `useRoadmapFeedback.ts` - cache-first paint, fresh `GET /v1/mastery`, cold/updated/stale/rebuilding, `rebuild()` adopts fresh into `masteryCache`.
- P3: `RoadmapFeedbackSection.tsx` + `feedback.css` - Variant B hierarchy (story card -> know/watch -> evidence trail -> advisory + pinned boundary -> collapsed Model context), boundary dialog (Keep/Replan), model-context disclosure.
- P4: wired into `RoadmapCalendar.tsx` (after the calendar shell, active roadmaps only); removed the dev-only "See learning feedback" prototype link.
- Live-found polish: evidence trail was unbounded (38 rows on the ACCA roadmap) -> capped to 5 with a "Showing 5 of 33" note; case-variant skill tags collapsed so know/watch never contradict (e.g. "Exam structure" vs "exam structure").
- Live-found bug: sync copy path exposed an unstable `[]` fallback in the hook (tight render loop, test hang) -> fixed with a module-level `NO_PROJECTIONS` constant.

## Flow trace
1. Ticket #47 = Roadmap Feedback Implementation - `wayfinder:phase2`, `ready-for-agent`, OPEN (claimed); body = 4 ACs.
2. Prototype #35 (CLOSED 2026-09-23) chose Variant B; hierarchy locked by HITL.
3. Data: `readMasteryProjections` / `saveMasteryProjections` (`apps/app/src/assessments/masteryCache.ts`), fresh `assessmentClient.getMastery()` (`apps/app/src/assessments/assessmentClient.ts:297`).
4. Vocabulary: `recommendBand` + `DifficultyRecommendation` from `@study-tracker/progress`; `DEFAULT_BAND` from `apps/app/src/assessments/masteryBands.ts`; `selectHeadline` mirrors `bandGuidanceByMaterial`'s highest-per-material choice, then `recommendBand(headline, DEFAULT_BAND)`.
5. States: cold = no observed projections; updated = cache matches fresh; stale = cache differs from fresh (cached shown, rebuild offered); rebuilding = transient while the cache is overwritten.
6. Boundary: Keep = acknowledgement only (the band already feeds the next Adaptive run through `bandGuidanceByMaterial`); Open replan = `navigate('/replan')` (`App.tsx:227`). No booking/event write.
7. Copy seam: `FeedbackCopyProvider` (sync or async) shaped for #50; `staticFeedbackProvider` is deterministic plain-language copy derived from real values, no raw decimals.
8. Replan footer link already existed (`RoadmapCalendar.tsx`); the removed dev-only link was `roadmap-feedback-prototype-link`.

## Files affected
- `apps/app/src/roadmap/feedback/types.ts` - feedback contract + copy seam.
- `apps/app/src/roadmap/feedback/feedbackModel.ts` - pure derivation (read/headline/evidence/equality).
- `apps/app/src/roadmap/feedback/feedbackCopy.ts` - static copy provider (#50 seam).
- `apps/app/src/roadmap/feedback/useRoadmapFeedback.ts` - cache/fetch state machine + rebuild.
- `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx` + `feedback.css` - Variant B UI.
- `apps/app/src/roadmap/feedback/feedbackModel.test.ts`, `useRoadmapFeedback.test.tsx`, `RoadmapFeedbackSection.test.tsx` - 22 tests.
- `apps/app/src/roadmap/RoadmapCalendar.tsx` - render section; removed dev-only prototype link.
- `apps/app/src/roadmap/RoadmapCalendar.test.tsx` - stub the async section to keep calendar tests focused.
- `.work/active/issue-47-roadmap-feedback/plan/PLAN.md` + `plan/VERIFICATION.md`, `plan/evidence/desktop-1280.png`, `plan/evidence/mobile-375.png`.
- `.work/STATUS.md` - Active row, then Done.

## Pitfalls & rules
- Rule 41: consume `@study-tracker/progress` + `masteryBands`; never re-implement BKT or a band model.
- HITL hard constraint (#35): plain language leads; raw mastery decimals / expected-correctness % only behind the collapsed Model context.
- Advisory must never write a booking/event: Keep is acknowledgement, Replan navigates.
- #50 owns the LLM feedback contract; #47 ships only the seam + static provider (no model call).
- The section is async (mastery fetch); unit-test suites that render `RoadmapCalendar` should stub it to avoid act noise.
- Rule 31: no Dexie bump; the hook reads the existing `masteryCache` only.
- Rule 17: warnings go through `logger`; no bare `console.*`.

## Decisions in force
- D-01 Surface = section inside Roadmap detail, not a new route (user 2026-09-23).
- D-02 Stale = local `masteryCache` differs from fresh `GET /v1/mastery`; Rebuild adopts fresh (user 2026-09-23).
- D-03 Boundary = Keep acknowledges / Replan navigates; no auto-edit of pinned sessions (user 2026-09-23).
- D-04 Copy via `FeedbackCopyProvider`; `staticFeedbackProvider` now, #50 swaps the LLM one (user 2026-09-23).
- D-05 Evidence from real per-(material, skill) projections, linked to material detail.
- D-06 Headline = highest-mastery observed projection; band from `recommendBand`.
- D-07 Evidence capped at 5 rows; case-variant skill tags collapsed (2026-09-23, live polish).
- D-08 Dev-only prototype route/file kept as throwaway reference; its Roadmap-detail link removed.

## Open
- none. #50 (LLM feedback contract) remains a separate open ticket; #49 (Phase 2 Integrated Verification) is unblocked by closing #47.
