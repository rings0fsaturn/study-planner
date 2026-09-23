# VERIFICATION - issue-47-roadmap-feedback

Ticket: [rings0fsaturn/study-planner#47](https://github.com/rings0fsaturn/study-planner/issues/47) · Verified 2026-09-23

## Acceptance criteria

| AC | Where it is satisfied | Evidence |
|---|---|---|
| Cold-start uncertainty, updated mastery, adaptive recommendation, stale projection, and rebuild states are clear. | `useRoadmapFeedback` derives `cold`/`updated`/`stale`/`rebuilding`; the section shows a state pill + rebuild control; the copy provider branches per state. | Unit: `useRoadmapFeedback.test.tsx` (cold, updated, stale, rebuild, fetch-failure); `feedbackModel.test.ts` (all four copy states); live `updated` at 1280 + 375. |
| Feedback is advisory and cannot silently rewrite pinned roadmap decisions or bookings. | The section only reads `masteryCache`/`GET /v1/mastery`; Keep is acknowledgement; Replan navigates to `/replan`; no booking/event write anywhere. | Unit: `RoadmapFeedbackSection.test.tsx` "Keep roadmap acknowledges without navigating or writing an event" (spies `EventStore.append`, asserts no call); live: Keep keeps URL `/study/roadmap`, Open replan goes to `/study/replan`. |
| The surface consumes the shared projection and recommendation contracts rather than duplicating algorithm logic. | `recommendBand` + `DifficultyRecommendation`/`MasteryProjection` from `@study-tracker/progress`; `DEFAULT_BAND` from `masteryBands`; `readMasteryProjections`/`saveMasteryProjections`; `assessmentClient.getMastery`. No BKT/band math in the section. | `feedbackModel.ts` + `useRoadmapFeedback.ts` imports; typecheck. |
| Mobile and desktop browser behavior is verified against the approved prototype. | Live walk at 1280×900 and 375×812 against the Variant B prototype hierarchy. | `plan/evidence/desktop-1280.png`, `plan/evidence/mobile-375.png`; 0 console errors; no horizontal overflow (`scrollWidth === innerWidth` at both). |

## Gates

| Gate | Result |
|---|---|
| `pnpm --filter @study-tracker/app typecheck` | green |
| `pnpm --filter @study-tracker/app lint` | green |
| `pnpm --filter @study-tracker/app test` | 957/959 (2 = known WSL timezone flakes in `src/dev/seedTestData.test.ts`, green under `--pool=forks`) |
| `pnpm --filter @study-tracker/app build` | green; section in `dist/assets/*.js`, prototype still tree-shaken (0 hits) |
| Feedback suites | `feedbackModel.test.ts` 11, `useRoadmapFeedback.test.tsx` 6, `RoadmapFeedbackSection.test.tsx` 5 = 22 green |

## Live walk (2026-09-23, ACCA roadmap)

- Section renders on Roadmap detail for the active roadmap, `updated` state.
- Evidence trail capped at the 5 most-practised skills of 33; case-variant tags collapsed so know/watch do not contradict.
- Model context collapsed by default; no raw decimals in the learner-facing copy.
- Boundary dialog: "Keep roadmap / Open replan"; Keep stays on `/study/roadmap`, Open replan navigates to `/study/replan`.
- Removed the dev-only "See learning feedback" prototype link (real section replaces it); prototype route/file retained as throwaway.
