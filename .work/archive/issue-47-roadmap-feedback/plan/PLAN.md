# PLAN - issue-47-roadmap-feedback (#47 Roadmap Feedback Implementation)

Ticket: [rings0fsaturn/study-planner#47](https://github.com/rings0fsaturn/study-planner/issues/47) (`wayfinder:phase2`, `ready-for-agent`)
Parent: spec #32 · map #4 · local mirror `specs/phase2-tickets/15-roadmap-feedback-implementation.md`
Upstream: prototype #35 (CLOSED 2026-09-23, Variant B chosen) · mastery engine #43 (CLOSED)

## Acceptance criteria (verbatim)
- [ ] Cold-start uncertainty, updated mastery, adaptive recommendation, stale projection, and rebuild states are clear.
- [ ] Feedback is advisory and cannot silently rewrite pinned roadmap decisions or bookings.
- [ ] The surface consumes the shared projection and recommendation contracts rather than duplicating algorithm logic.
- [ ] Mobile and desktop browser behavior is verified against the approved prototype.

## Locked decisions
- **D-01 Surface:** a section inside Roadmap detail (`apps/app/src/roadmap/RoadmapCalendar.tsx`), placed after the calendar shell and before the materials directory. No new route.
- **D-02 Stale:** stale = the local `masteryCache` snapshot differs from a fresh `GET /v1/mastery`; Rebuild adopts fresh into the cache and recomputes. Cold = no observed projections. Updated = cache matches fresh. Rebuilding = transient while the cache is overwritten.
- **D-03 Boundary:** Keep roadmap = acknowledgement only (the one-band guidance already feeds the next Adaptive run through `bandGuidanceByMaterial`; no write). Open replan = `navigate('/replan')`. Advisory never writes a booking or an event.
- **D-04 Copy seam:** copy comes from a `FeedbackCopyProvider` (sync or async). Ship `StaticFeedbackCopyProvider` (deterministic plain-language templates from real values, no raw decimals). Shape the input/output for #50's LLM contract; no model call in #47.
- **D-05 Evidence:** the evidence trail derives from the real per-(material, skill) projections for the roadmap's attached materials, each row linking to `/materials/:materialId`.
- **D-06 Aggregate:** headline projection = highest mastery among observed roadmap-material projections (mirrors `bandGuidanceByMaterial`); `recommendBand(headline, DEFAULT_BAND)`.
- **D-07 Hierarchy (HITL, #35):** summary -> know/watch -> evidence trail -> advisory + pinned boundary -> collapsed Model context.
- **D-08 No Dexie bump:** read existing `masteryCache` + `assessmentAttempts` tables only.

## Phases

### P1 - types + static copy provider
- `apps/app/src/roadmap/feedback/types.ts`: `FeedbackState`, `FeedbackEvidence`, `FeedbackCopyInput`, `FeedbackCopy`, `FeedbackCopyProvider`.
- `apps/app/src/roadmap/feedback/feedbackCopy.ts`: `staticFeedbackCopy(input)` + export as the default provider.
- Tests: `feedbackCopy.test.ts` (cold/updated up/down/stale/rebuilding; no raw decimals in output).

### P2 - data hook
- `apps/app/src/roadmap/feedback/useRoadmapFeedback.ts`: read cache, fetch fresh, compute state, expose `rebuild()`.
- Reuses `readMasteryProjections`/`saveMasteryProjections`, `assessmentClient.getMastery()`, `projectMastery`/`recommendBand`, `DEFAULT_BAND`.
- Tests: `useRoadmapFeedback.test.tsx` with fake client + fake-indexeddb (cold, updated, stale, rebuild, fetch-failure falls back to cache).

### P3 - section UI
- `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx` + `feedback.css` (Marginalia tokens).
- Subcomponents: story card, know/watch, evidence list, advisory + pinned boundary dialog, Model context.
- Tests: `RoadmapFeedbackSection.test.tsx` (all states render; Keep closes with no event; Replan navigates; model context collapsed).

### P4 - wire into Roadmap detail
- Render `<RoadmapFeedbackSection>` in `RoadmapCalendar.tsx`; pass `materialIds`, `materialTitlesById`, `readOnly`.
- Remove the dev-only "See learning feedback" prototype link (real section replaces it); keep the dev-only prototype route/file as the throwaway reference.

### P5 - verification
- `pnpm --filter app typecheck`, `pnpm --filter app lint`, `pnpm --filter app test`, `pnpm --filter app build` (section in bundle).
- Live: `./full-app restart full`; Roadmap detail at 1280 + 375; all four states; Keep/Replan dialog; console clean; no horizontal overflow.

### P6 - wayfinder exit
- Resolution comment on #47, tick ACs, close; append Decisions-so-far line on map #4 + local snapshot; archive the task folder.

## Verification commands
```bash
pnpm --filter app typecheck
pnpm --filter app lint
pnpm --filter app test
pnpm --filter app build
```
