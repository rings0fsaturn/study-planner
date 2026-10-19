# Scratchpad - closed-loop-hold-analysis · session 2026-10-19 (Phase 2)
_state.md: .work/active/closed-loop-hold-analysis/state.md · Updated: 2026-10-19_

## Now / Next
- Doing: Phase 2 complete + reviewed + verified; PLAN/state/STATUS updates and commit decision pending
- Next: commit Phase 2 (plan protocol step 7) after user go-ahead, then record SHA in a docs follow-up
- Blocked: none

## Session log
- 2026-10-19 START: resumed task per user instruction (Phase 2 of closed-loop-hold-fix). Prior session (Phase 1) already distilled into state.md; scratchpad reset for this session.
- 2026-10-19 DECIDED (user): `days_span` dates come from the local graded attempts table (`assessmentAttempts`), scoped to the roadmap's materials via `grade.materialId`, using server-authored `grade.gradedAt`.
- 2026-10-19 DECIDED (user): dip-timed capture = keep updated-entry firing + real page posture (already wired), add explicit postureSource ('real' when a projection exists, else 'neutral') and log it per call. No dip-detection heuristic.
- 2026-10-19 PREREQS green: `days_span: 0` at useLoopDecision.ts:97; hook suite 21/21.
- 2026-10-19 TDD A: RED multi-day span (0!=21) -> GREEN 26/26. `buildLoopInput(..., observedDates)` + `observedSpanDays` (date-only, malformed dropped, <2 days => 0).
- 2026-10-19 TDD B: RED hook pass-through + section wiring -> GREEN. `observedGradeDates(rows, materialIds)`; section live-queries `assessmentAttempts` and passes `observedDates`; first call can beat the live query, input-hash refire sends the real span.
- 2026-10-19 TDD C: RED posture-source log + calendar prop -> GREEN. `postureSource` arg logged per fired call (logger.info); section prop + `RoadmapCalendar` derives 'real' iff projectedFinish exists.
- 2026-10-19 DONE pins cleanup: old `days_span: 0` summary pins dropped (toMatchObject) + explicit default-0 test kept.
- 2026-10-19 VERIFIED: feedback/ 66/66, RoadmapCalendar 20/20, `pnpm typecheck` clean, `pnpm lint` clean, no console.* in touched feedback files.
- 2026-10-19 REVIEW: OCR preview/rules + 2 code-reviewer subagents (correctness/spec; thermo-nuclear). APPROVE-WITH-FIXES: M1 lenient date parse can fabricate a span; HIGH tri-state race fires a span-0 POST then refires (plus lows: memo-hit log pin, test waitFors, comment/log/doc trims, materialIdList dedupe).
- 2026-10-19 TDD fixes: RED strict-day test (282!=0), RED tri-state (fired while undefined) -> GREEN. Strict `YYYY-MM-DD` round-trip `parseDay`; `observedDates` undefined holds the call; section passes the live-query tri-state; log trimmed to posture+days_span; two section tests made waitFor-safe.
- 2026-10-19 VERIFIED post-review: src/roadmap 161/161, typecheck + lint clean, no dashes, no console.* in touched source.
- 2026-10-19 DONE PLAN Phase 2 Notes filled (incl. deviations + review record); commit pending user go-ahead.
- 2026-10-19 DONE Phase 2 COMMITTED `2a15115` (10 files: 4 code/test app files + PLAN Notes/Status + state + STATUS row + scratchpad); SHA recorded in docs follow-up `3d84101`-style commit. Full app 1254/1256 with only the 2 known TZ flakes (forks rerun green).
