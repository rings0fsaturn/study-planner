---
date: 2026-07-01
mode: transition
slug: material-session-decoupling-review-phase5
task: .work/plans/active/2026-06-30-material-session-decoupling
---

# Handover — reviewing material↔session decoupling, Phase 5 onwards

## TL;DR
Acting as **senior architect / code reviewer** for the material↔session decoupling plan,
phase by phase. **Phases 1–4 are ✅ Verified and committed** (through `bd20c8a`).
**Phases 5 (Roadmap page + booking interactions) and 6 (ETA composite + Week) are already
implemented but sit UNCOMMITTED in the working tree**, with implementer reports filled in
`VERIFICATION.md` and status `🟡 Implemented locally; awaiting Cowork review`. **Phase 7
(Replan) is not started.** Next session: **review Phase 5** against its acceptance criteria +
`mocks/proposed/roadmap.html`, then Phase 6.

## Goal / why
Round-trip review loop: read each phase's **actual diff** against `PLAN.md` acceptance criteria +
`DECISIONS.md` (D1–D22) + the locked mocks (visual contract), **re-run the tests/typecheck
yourself**, then write per-criterion **Reviewer findings** into `VERIFICATION.md` and set status
`✅ Verified` or `🔁 Changes requested`. A phase is not done until `✅ Verified`.
- **User constraint (firm, from this session):** *deviations must be rectified, not just tracked.*
  In P3/P4 I first verified with tracked follow-ups; the user pushed back and I implemented the
  fixes. Apply the same bar to P5+: UI-fidelity gaps vs the mock are in scope, not just event-model
  correctness.
- **User constraint:** re-run tests/typecheck; don't trust the implementer report alone.

## Key references
| Path | Why it matters |
|---|---|
| `.work/plans/active/2026-06-30-material-session-decoupling/PLAN.md` | Phase specs + acceptance criteria + Files-touched index (Phase 5 ≈ line 485, Phase 6 ≈ 533, Phase 7 ≈ 590) |
| `.work/plans/active/.../VERIFICATION.md` | The review log. P5/P6 implementer reports done (lines ~195, ~219); fill **Reviewer findings**. Cross-cutting invariants at top (lines 11–17) |
| `.work/plans/active/.../DECISIONS.md` | D1–D22 design source of truth (P5=D9/D20/D21; P6=D-07/D-08; P7=D-09/D22) |
| `.work/plans/active/.../mocks/proposed/roadmap.html` | Visual contract for Phase 5 |
| `.work/plans/active/.../mocks/proposed/replan.html` | Visual contract for Phase 7 |
| `research/comparison/src/research_comparison/baselines/projection.py` | Reference for P6 `projectFinish` (`forecast_gp_plus_analytic_finish`, `COLD_START_N=5`) |

## What I learned — the review method that's working
- **Read the diff, not the report:** `git show <sha>` for committed phases; `git diff` for the
  uncommitted P5/P6 in the tree now.
- **Re-run everything yourself** (Node via fnm 22; pnpm via `$PNPM_HOME`):
  - `pnpm --filter app typecheck`
  - `pnpm --filter app test` (currently **56 files / ~483 tests**)
  - `pnpm --filter @study-tracker/progress test` · `pnpm --filter @study-tracker/roadmap-engine test`
- **Check cross-cutting invariants every phase** (VERIFICATION.md lines 11–17): no destructive event
  migration (legacy `slots` still readable); calibration denominator `materialConsumedMinutes ??
  plannedMinutes`; no detector/calibrator model change; finish-date labels **provisional**; per-user
  Dexie isolation.
- **Playwright IS usable for visual verification** despite the "author E2E, don't run" rule. Full app
  screens need Supabase auth + seeded IndexedDB (hard), BUT pure presentational components mount in a
  throwaway Vite preview page with plain props (no providers). Pattern used this session for the dial:
  create `apps/app/preview.html` + `src/preview.tsx` mounting the component → `pnpm --filter app dev`
  (serves at `http://localhost:5173/study/preview.html`) → Chromium screenshot vs the mock → **delete
  the harness after**. Chromium is installed; it works.
- **Blocking vs non-blocking:** missing *required* tests and event-model/correctness bugs block;
  pure UI fidelity I used to track — but per user, rectify those too.

## In-flight state — UNCOMMITTED Phase 5/6 in the working tree
`git status` shows the P5/P6 implementation not yet committed (last commit is `bd20c8a`, my P3/P4
fixes). Decide first whether to review the working tree as-is or ask for a commit.
- **Phase 5 (Roadmap) files:** `apps/app/src/roadmap/{RoadmapCalendar,CalendarCell,SessionDetailModal,calendarModel,statusStyles}.tsx/ts`, new dir `apps/app/src/roadmap/booking/`, `roadmap.css`, roadmap tests, `pages/{Home,Week}.tsx` copy touch, `e2e/material-session-decoupling.spec.ts`.
- **Phase 6 (ETA/Week) files:** `packages/progress/src/{projectFinish,progress,types,index}.ts` (+ new `projectFinish.ts`/`.test.ts`), `packages/progress/test/{progress,deriveBookingStatuses,cusum}.test.ts`, `apps/app/src/progress/mapEvents.ts`, `pages/{Home,Week}.tsx(+tests)`, `progress/useProgress.test.ts`.
- Also modified: `SCRATCHPAD.md`, `VERIFICATION.md`.

## Known deviations already self-disclosed (verify + decide blocking)
- **Phase 5:** booking add/edit sheets use native `<select>` + native date input instead of reusing
  the grouped directory/`PlaylistPickerPopup` modal (D10/D21). Detach ("No material · pick at start"),
  duration stepper, move-day, remove, and the booking events ARE implemented/tested. Per the user's
  "rectify deviations" stance, weigh whether the native-picker shortcut needs the grouped picker.
- **Phase 6:** no Python-subprocess parity for `projectFinish` (TS asserts the product contract
  directly). `cusum.test.ts` flakiness from `Math.random()` was fixed by seeding `mulberry32` — confirm
  no production CUSUM logic changed.
- **D6 (still open):** pace-first pre-session *recommendation nudge* remains deferred (genuinely needs
  P6 pace/ETA). Current `PreSessionSetup` recommends booking target clamped to the D5 soft cap. Decide
  if P6 should now close D6 or leave it for a polish pass.

## Dead ends / don't redo
- Don't try to reach `/session` or `/roadmap` in Playwright through real auth+DB — too heavy. Use the
  presentational-component preview-harness pattern above.
- Don't re-verify Phases 1–4 — ✅ Verified, committed (`327ca45`, `863161a`, `de2339a`, `bd20c8a`).
- `deriveSlotStatuses` is intentionally still present (deprecated) — only the live roadmap path must
  use `deriveBookingStatuses`; a residual `deriveSlotStatuses` reference in the Phase-7 replan path is
  expected until P7.

## Next action
Review **Phase 5**: read `PLAN.md` Phase 5 + `mocks/proposed/roadmap.html`, `git diff` the uncommitted
`apps/app/src/roadmap/**` (esp. `RoadmapCalendar.tsx`, `booking/*`, `calendarModel.ts`, `statusStyles.ts`),
confirm each acceptance criterion (booking calendar, ETA card, directory + Mark progress →
`MaterialProgressMarked` with no `SessionLogged`, booking editor events), re-run
`pnpm --filter app typecheck && pnpm --filter app test`, then write Reviewer findings + status into
`VERIFICATION.md` Phase 5.

## User context
- Rigorous reviewer-of-the-reviewer: wants the diff read, tests re-run, and **deviations fixed, not
  just logged**.
- Reviews **one phase at a time**; expects `VERIFICATION.md` Reviewer-findings filled with per-criterion
  verdicts and a clear ✅/🔁.
- Model: Opus 4.8 (1M). Env: Node via `fnm use 22`; pnpm via `$PNPM_HOME`; Playwright/Chromium installed.
- `.work/` is tracked on purpose (CLAUDE.md) — this handover lives in `.work/handovers/`, not a
  gitignored root path.
