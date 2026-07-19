# VERIFICATION — roadmaps-dashboard-fixes

Round-trips between planner (Cowork), implementer (Codex/Sonnet), and reviewer (Cowork).
Acceptance criteria are pre-filled by the planner. Implementer fills its report per phase; reviewer
fills findings. A phase is done only at `✅ Verified`.

---

## Phase A — New-roadmap mode survives the whole wizard (P0)

### Acceptance criteria (planner pre-fill)

- [ ] `apps/app/src/onboarding/useOnboardingNavigate.ts` exists and preserves `location.search` + `location.state` for string destinations.
- [ ] As a user with an existing `OnboardingCompleted` event: `/onboarding/1?new=1` → fill deadline + purpose → **Continue** advances to `/onboarding/2` with `?new=1` still in the URL (NOT redirected to `/home`).
- [ ] The full wizard (steps 1→2→3→preview) keeps `?new=1` at every step for a returning user.
- [ ] `OnboardingGate` latches new-roadmap mode in a ref; a single missed nav path does not bounce the user to `/home` mid-wizard.
- [ ] `Step3Preview` finish branches correctly for a returning user (its own `newRoadmapMode` is true): active plan present → saves draft, returns to `/roadmaps`; no active plan → emits `RoadmapCreated` (no duplicate `OnboardingCompleted`), returns to `/roadmaps`.
- [ ] Exit navigations are unchanged: `/roadmaps`, `/onboarding/4`, `/home` do NOT carry `?new=1`.
- [ ] `CheckpointGate` back-redirect preserves `location.search` + `state`.
- [ ] First-run (no `OnboardingCompleted`) onboarding still works end-to-end and lands on `/onboarding/4`.
- [ ] Direct/refresh entry to `/onboarding/2` with no param and no latch still redirects a completed user to `/home`.
- [ ] New Vitest tests cover param survival and the gate's no-redirect-in-new-mode case; suite green under Node ≥ 20.
- [ ] `pnpm --filter app typecheck` clean.

### Implementer report (Codex/Sonnet fills)

- Files changed:
  - `apps/app/src/onboarding/useOnboardingNavigate.ts`
  - `apps/app/src/onboarding/useOnboardingNavigate.test.tsx`
  - `apps/app/src/onboarding/OnboardingGate.tsx`
  - `apps/app/src/onboarding/OnboardingGate.test.tsx`
  - `apps/app/src/onboarding/CheckpointGate.tsx`
  - `apps/app/src/onboarding/components/CapacityPrompt.tsx`
  - `apps/app/src/onboarding/steps/Step1Deadline.tsx`
  - `apps/app/src/onboarding/steps/Step2Hours.tsx`
  - `apps/app/src/onboarding/steps/Step3Materials.tsx`
  - `apps/app/src/onboarding/steps/Step3Preview.tsx`
- Commit SHA: `03f7386331c56c193ed49ea32fb73ed79d6ae5a8`
- What was done:
  - Added `useOnboardingNavigate()` to preserve `location.search` and `location.state` while navigating between onboarding steps.
  - Converted the Phase A intra-onboarding navigations to the helper, while leaving `/roadmaps`, `/onboarding/4`, and `/home` exits on plain `useNavigate()`.
  - Latched new-roadmap mode in `OnboardingGate` and preserved search/state in `CheckpointGate` redirects.
  - Added Vitest coverage for helper preservation and a returning user staying inside new-roadmap mode after step navigation.
- Deviations + why:
  - None.
- Self-check vs criteria:
  - `pnpm --filter app test -- onboarding OnboardingGate useOnboardingNavigate` passed under Node v22.17.1 (49 files, 452 tests).
  - `pnpm --filter app typecheck` passed under Node v22.17.1.
  - Grep confirmed `Step1Deadline` imports/uses `useOnboardingNavigate`, and exit navigations remain unconverted.

### Reviewer findings (Cowork fills)

- Per-criterion verdict:
- Issues / required changes:
- Status: ☐ `✅ Verified` / ☐ `🔁 Changes requested`

### Resolution (implementer fills on redo)

---

## Phase B — Historical roadmap opens as a closable route view (P1)

### Acceptance criteria (planner pre-fill)

- [ ] Clicking a History row navigates to `/roadmap?roadmap=<encodeURIComponent(createdAt)>` (URL changes; not component state).
- [ ] `pages/Roadmap.tsx` reads the `roadmap` param: present → read-only calendar for that entry; absent → active plan (unchanged).
- [ ] The read-only historical route view shows a "← Roadmaps" back link; the link and the browser Back button both return to `/roadmaps` without a page refresh.
- [ ] The inline `selectedCreatedAt` read-only calendar is removed from `Roadmaps.tsx` (no dead state / unused import).
- [ ] No `/study` prefix appears in any `to`/`navigate` path (router rule).
- [ ] Active `/roadmap` (no param) view is unchanged.
- [ ] Vitest covers: history click → URL navigation; no inline detail panel in the dashboard. Suite green under Node ≥ 20.
- [ ] `pnpm --filter app typecheck` and `pnpm lint` clean.

### Implementer report (Codex/Sonnet fills)

- Files changed:
  - `apps/app/src/pages/Roadmap.tsx`
  - `apps/app/src/pages/Roadmap.test.tsx`
  - `apps/app/src/pages/Roadmaps.tsx`
  - `apps/app/src/pages/Roadmaps.test.tsx`
  - `apps/app/src/roadmap/RoadmapCalendar.tsx`
  - `apps/app/src/roadmap/RoadmapCalendar.test.tsx`
  - `apps/app/src/onboarding/OnboardingGate.test.tsx`
- Commit SHA: `5d3cfcc94849c97c299370c4af8aa4d10897e4b0`
- What was done:
  - Changed history rows from component-state buttons to `<Link>` rows targeting `/roadmap?roadmap=${encodeURIComponent(createdAt)}`.
  - Removed `selectedCreatedAt`, `selectedEntry`, the inline `roadmaps-readonly` calendar panel, and the unused `RoadmapCalendar` import from `Roadmaps.tsx`.
  - Updated `Roadmap.tsx` to read the `roadmap` search param and render the selected entry in read-only mode when present.
  - Updated `RoadmapCalendar` so historical read-only route views still show the existing `← Roadmaps` back link.
  - Added tests for history link navigation/no inline panel, `Roadmap` query-param handoff, and the historical back link.
- Deviations + why:
  - Also replaced explicit `any` casts in the touched `OnboardingGate.test.tsx` with typed `EventStore` casts after `pnpm lint` surfaced warnings in that file. No behavior changed.
- Self-check vs criteria:
  - `pnpm --filter app test -- Roadmaps Roadmap` passed under Node v22.17.1 (50 files, 455 tests).
  - `pnpm --filter app test -- OnboardingGate useOnboardingNavigate Roadmaps Roadmap` passed after the touched-test lint cleanup (50 files, 455 tests).
  - `pnpm --filter app typecheck` passed.
  - `pnpm lint` exited 0; it reports four warning-only `no-explicit-any` findings in unrelated session files.
  - Grep found no `selectedCreatedAt`, `roadmaps-readonly`, or `RoadmapCalendar` references left in `Roadmaps.tsx`.
  - Grep found no `/study` paths in the touched route/calendar files.

### Reviewer findings (Cowork fills)

- Per-criterion verdict:
- Issues / required changes:
- Status: ☐ `✅ Verified` / ☐ `🔁 Changes requested`

### Resolution (implementer fills on redo)

---

## Follow-up — Roadmap session modal viewport overlay

### Implementer report

- Files changed:
  - `apps/app/src/roadmap/SessionDetailModal.tsx`
  - `apps/app/src/roadmap/SessionDetailModal.test.tsx`
  - `apps/app/src/roadmap/roadmap.css`
- Commit SHA: pending native commit
- What was done:
  - Moved `SessionDetailModal` / `DayDetailModal` frames into a `document.body` portal so the overlay is not clipped by the roadmap page container.
  - Kept page scrolling enabled while a session modal is open; removed the rejected body scroll lock and internal modal max-height clipping.
  - Raised the CSS selector specificity to `.modal-overlay.roadmap-modal-overlay` so the roadmap overlay reliably beats the shared `.modal-overlay { position: absolute }` rule regardless of CSS import order.
  - The overlay is fixed to the viewport, covers the current visible screen, and the card stays centered while the underlying page scrolls.
- Verification:
  - `pnpm --filter app test -- SessionDetailModal` passed (52 files, 465 tests).
  - `pnpm --filter app typecheck` passed.
  - `pnpm lint` exited 0; existing unrelated YouTube `no-explicit-any` warnings remain.
  - Browser check with Playwright Chromium after restarting Vite confirmed: `bodyOverflow=visible`, overlay `position=fixed`, page scrolled from `scrollY=0` to `scrollY=700`, overlay stayed viewport-height, and card center stayed at viewport center.

---

## Follow-up — Roadmap progress scopes to selected roadmap coverage

### Implementer report

- Files changed:
  - `apps/app/src/roadmap/roadmapProgress.ts`
  - `apps/app/src/roadmap/RoadmapCalendar.tsx`
  - `apps/app/src/roadmap/RoadmapCalendar.test.tsx`
  - `apps/app/src/pages/Roadmaps.tsx`
  - `apps/app/src/pages/Roadmaps.test.tsx`
  - `e2e/roadmap.spec.ts`
- Commit SHA: pending native commit
- What was done:
  - Added `summarizeRoadmapProgress()` so roadmap UI progress is computed from planned slot coverage (`date + materialId` match) for the selected lifecycle entry.
  - Switched `/roadmap` detail progress away from global `useProgressSnapshot()` totals; historical sessions no longer make a new roadmap show `100%`.
  - Switched `/roadmaps` active hero stats to the same summary so date-window gap sessions do not inflate roadmap session/logged counts.
  - Tightened the roadmap Playwright sign-in helper to use the exact `Continue` submit button after the Google button made the old selector ambiguous.
- TDD evidence:
  - RED: `pnpm --filter app test -- RoadmapCalendar -t "does not count historical sessions"` failed with `Progress100%1h 2m logged0m to go`.
  - GREEN: same focused RoadmapCalendar test passed after the scoped summary.
  - RED: `pnpm --filter app test -- Roadmaps -t "does not count date-window gap sessions"` failed with `1 sessions30m logged0% complete`.
  - GREEN: same focused Roadmaps test passed after sharing the scoped summary.
- Verification:
  - `pnpm --filter app test -- RoadmapCalendar Roadmaps` passed (52 files, 467 tests).
  - `pnpm --filter app typecheck` passed.
  - `pnpm lint` exited 0; existing unrelated YouTube `no-explicit-any` warnings remain.
  - First Playwright attempt confirmed sandbox Chromium launch failure and a stale sign-in selector.
  - Unsandboxed focused rerun passed: `pnpm exec playwright test -c e2e/playwright.config.ts e2e/roadmap.spec.ts --project=app -g "progress ignores"` (1 passed).

---

## Phase C — Dashboard layout polish

🛑 Deferred (OQ-01 / D-03) — handled in a later holistic UI pass. No acceptance criteria.

---

## Phase D — "Current roadmap" is lifecycle-aware (P1)

### Acceptance criteria (planner pre-fill)

- [ ] A single shared `findActiveRoadmap(events)` resolver exists (exported from `progress/mapEvents.ts`), backed by `deriveRoadmapLifecycle(events).active[0]`; returns `null` when no roadmap is active.
- [ ] `RoadmapInput` shape returned by `findActiveRoadmap` is identical to the old `findRoadmap` (consumers unaffected in the normal active case).
- [ ] After abandoning the active roadmap (no successor): Home shows **no** up-next session and **no** progress card; the plan appears under `/roadmaps` History/abandoned (unchanged).
- [ ] After completing the active roadmap (no successor): same — it stops driving Home.
- [ ] Starting a NEW roadmap after abandon → Home tracks only the new active roadmap.
- [ ] A replanned-in-place active roadmap (`RoadmapReplanned` with `roadmapCreatedAt`) still resolves as active and returns the latest snapshot.
- [ ] **Calibration unchanged for learning:** `mapSessions(events)` is NOT scoped by roadmap/lifecycle; the calibration request still includes every `SessionLogged` event. Only `nextContext` becomes `null` when no active roadmap.
- [ ] The two old `findRoadmap` copies (Home local + mapEvents) are reconciled; UI consumers (`Home.tsx`, `useProgress.ts`, `useCalibration.ts`) use the shared resolver.
- [ ] No event deleted/mutated/migrated; no Dexie schema change.
- [ ] Vitest covers: active-vs-terminal resolution, replan parity, and sessions-stay-global; green under Node ≥ 20.
- [ ] `pnpm --filter app typecheck` and `pnpm lint` clean.

### Implementer report (Codex/Sonnet fills)

- Files changed:
  - `apps/app/src/progress/mapEvents.ts`
  - `apps/app/src/progress/mapEvents.test.ts`
  - `apps/app/src/progress/useProgress.ts`
  - `apps/app/src/progress/useProgress.test.ts`
  - `apps/app/src/progress/useCalibration.ts`
  - `apps/app/src/progress/useCalibration.test.ts`
  - `apps/app/src/pages/Home.tsx`
  - `apps/app/src/pages/Home.test.tsx`
  - `apps/app/src/pages/Week.tsx`
  - `apps/app/src/pages/Week.test.tsx`
  - `.work/plans/active/2026-06-27-roadmaps-dashboard-fixes/PLAN.md`
  - `.work/plans/active/2026-06-27-roadmaps-dashboard-fixes/VERIFICATION.md`
  - `.work/STATUS.md`
- Commit SHA: pending native commit
- What was done:
  - Added shared `findActiveRoadmap(events)` in `progress/mapEvents.ts`, backed by
    `deriveRoadmapLifecycle(events).active[0]`, returning `null` when no roadmap is active.
  - Kept `findRoadmap` exported for compatibility and routed both old/new resolvers through the same
    `RoadmapInput` mapper to preserve the normal active/replanned shape.
  - Removed Home's local latest-roadmap resolver and switched Home, Week, `useProgressSnapshot`, and
    `useCalibrationState` to `findActiveRoadmap`.
  - Kept `mapSessions(events)` global; abandoned/completed roadmap sessions still feed calibration,
    while `nextContext` becomes `null` when there is no active roadmap.
  - Added Vitest coverage for abandoned/completed null resolution, new active roadmap after abandon,
    replan parity, sessions-stay-global, `useProgressSnapshot` nulling, calibration request behavior,
    and Home no longer rendering the retired up-next card.
- Deviations + why:
  - The plan listed ~4 files / ~70 lines; implementation also added focused hook/page tests and
    switched `Week.tsx` after final grep found it was another UI current-roadmap consumer. No behavior
    deviation from D-04.
  - The existing `.work` plan/status files were already dirty at session start; this report records the
    implementation with a pending commit marker instead of inventing a SHA.
- Self-check vs criteria:
  - RED run before production changes failed exactly on the stale lifecycle behavior:
    `pnpm --filter app test -- mapEvents useProgress useCalibration Home` failed with missing
    `findActiveRoadmap`, Home still showing `Up next`, calibration `nextContext` non-null after abandon,
    and `useProgressSnapshot` still computing progress.
  - GREEN run passed under Node v22.17.1:
    `pnpm --filter app test -- mapEvents useProgress useCalibration Home Week` (52 files, 464 tests).
  - `pnpm --filter app typecheck` passed.
  - `pnpm lint` exited 0; it still reports four warning-only `no-explicit-any` findings in unrelated
    session files.
  - No event deletion/mutation/migration and no Dexie schema change.

### Reviewer findings (Cowork fills)

- Per-criterion verdict:
- Issues / required changes:
- Status: ☐ `✅ Verified` / ☐ `🔁 Changes requested`

### Resolution (implementer fills on redo)
