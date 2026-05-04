# How to use this plan

> **You are the implementing agent.** This document is your runbook for one cohesive change to this codebase. It was written collaboratively by Claude and a human after a planning discussion, and it is the source of truth for this work. Read this preamble in full before doing anything else.

## What you're holding

A phase-by-phase implementation plan. Each phase is a **vertical slice** — an end-to-end working increment that leaves the codebase in a working state. Phases are designed so any one of them can be implemented by a fresh agent in a new context window, with only this document and the codebase as input.

## Your job

1. **Read the document header in full first.** TL;DR, Context, Decisions log, Architecture overview, and Files-touched index. These give you the *why* behind every step. The Decisions log especially — those decisions were made deliberately and explain choices that may otherwise look arbitrary or wrong. Reference IDs (D-NN) appear inside phase steps so you can look up rationale.

2. **Find your starting phase.** Scan the phase list. Pick the first phase whose status is `☐ Not started` AND whose `Depends on:` phases are all `✅ Complete`. Implement that phase only. **Do not skip ahead. Do not implement multiple phases in one go unless the human explicitly asks.**

3. **Run the prereq verification.** Each phase has a "Verification (run BEFORE starting)" block. Run those commands. **If any fail, STOP** — the codebase isn't in the state this phase expects. Surface to the human: "Phase N's prereqs failed: `<command>` returned `<result>`. Want me to investigate or hand back?"

4. **Follow the steps in order.** Code blocks in steps are the actual code, not pseudocode or sketches. Apply them as written.

5. **If reality doesn't match the step — STOP.** If the plan says "modify line 47 of `auth.py`" and line 47 is something different, do not improvise. Surface the discrepancy: "Plan expected `<X>` at `auth.py:47`, found `<Y>`. Possible causes: plan is stale, file was edited since planning, plan was wrong. How should I proceed?"

6. **Run the tests and post-verification.** Each phase specifies what tests to add or update and the bash command to run. All must pass before the phase is considered done.

7. **Update status and commit.** When the phase is complete:
   - Edit this document: change the phase's `Status:` line to `✅ Complete — <commit-sha-here>`.
   - `git add` the code changes AND this plan file.
   - Commit them together. Suggested message: `Phase N: <phase title>` (with longer body referencing the plan file).
   - The status update and the code change live in the same commit so the doc and the code never drift.

## What you must NOT do

- **Do not skip phases.** Order matters; later phases assume earlier ones completed.
- **Do not modify the Decisions log, the Operating manual preamble, the TL;DR, the Architecture overview, the Files-touched index, the Open questions, the Out-of-scope list, or the References.** Those are immutable above-the-phases content. If you discover a decision is wrong, surface to the human — don't silently revise.
- **Do not re-plan or re-architect.** If the plan seems wrong, that's a signal to stop and surface, not to improvise.
- **Do not implement multiple phases without surfacing for human review** between them, unless the user explicitly asked for batch execution upfront.

## If you get stuck

- Update the phase's `Status:` to `🛑 Blocked: <one-line reason>`.
- Fill in the phase's `Notes (filled in during implementation)` block with what you tried, what's blocking, and what you'd want to know to unblock.
- Hand back to the human.

## Status vocabulary

- `☐ Not started`
- `🟡 In progress`
- `🛑 Blocked: <reason>`
- `✅ Complete — <commit-sha>`

## When status markers and reality drift

The status markers are a fast read, but they are not the source of truth. The phase's `Verification (DONE)` commands are the truth — if you suspect a marker is wrong (someone forgot to update, branches diverged, partial commits, etc.), run the verification commands for the phases marked complete. Trust the commands over the markers, and surface the drift to the human so the markers can be corrected.

---

# ProgressEngine & PaceCalibration — ML algorithms package (Plan A of 2)

**Slug:** `009a-progress-engine-ml-algorithms`
**Date written:** 2026-05-03
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** `issues/009-progress-engine-and-pace-calibration.md`, `prd/PRD-study-tracker-web.md`
**Companion plan:** Plan B (UI integration, exceptional tagging, recalibration prompt) — to be written separately after Plan A is complete.

## TL;DR

Rename the existing `@study-tracker/progress-engine` package (which generates roadmaps, not progress) to `@study-tracker/roadmap-engine`. Create a new `@study-tracker/progress` package containing two pure modules: `computeCalibration()` and `computeProgress()`. PaceCalibration uses a Hierarchical Bayesian model (per-role multipliers), CUSUM regime detection (h=4.5σ), and Piecewise Kalman trend tracking. ProgressEngine derives streak, burn-up with GP regression (ℓ=7d), projected finish with confidence intervals, verdict, and weekly stats. Both modules are pure functions — events in, derivations out, no I/O. All hyperparameters were validated via parameter sweeps on realistic synthetic data.

## Context & background

The Home screen currently shows a stub — total time logged, a static projected finish (the last roadmap slot date), and an up-next card. Issue #009 upgrades this to a real progress dashboard with streak tracking, calibrated projections, burn-up visualization, and pace monitoring.

The PRD specifies ProgressEngine and PaceCalibration as "deep, pure" modules. The existing `packages/progress-engine/` is a misnomer — it generates roadmaps (generateRoadmap, inferRole), not progress data. Renaming it clears the namespace for the real progress module.

The ML approach was designed through an extensive /grill-me session and validated with hyperparameter sweeps on synthetic data (Python scripts in `issues/images/`). This plan creates the pure algorithm package; Plan B wires it into the React UI.

**Support docs:**

- Issue: `issues/009-progress-engine-and-pace-calibration.md`
- PRD: `prd/PRD-study-tracker-web.md` (user stories 14, 15; module decomposition)
- Downstream issues: `issues/010-replan-flow-with-three-options.md` (consumes projections), `issues/011-weekly-progress-streaming-narrative.md` (consumes verdict + weekly stats)
- Hyperparameter sweep results: `issues/images/cusum_sweep.png`, `kalman_sweep.png`, `gp_sweep.png`
- Best-params visualizations: `issues/images/best_params_*.png`
- Algorithm test script: `issues/images/hyperparam_sweep.py` (reference implementation in Python)
- Design mockups: `design/screens.html` (Section C: Home, Section E: Log, Section F: Weekly progress)
- Burn-up chart design: `issues/images/expectedDesign/burnupchart.png` (The Ledger variant)
- Existing architecture rules: `.claude/rules/progress-engine.md`, `.claude/rules/eventstore-architecture.md`

## Decisions log

### D-01: Rename `packages/progress-engine/` to `packages/roadmap-engine/`

**Status:** ✅ Agreed

**Context:** The existing package generates roadmaps (slot grids, role assignment). Naming it "progress-engine" would collide with the new progress tracking module.

**Decision:** Rename to `@study-tracker/roadmap-engine`. Find-and-replace across all 28 import sites.

**Rationale:** "Roadmap engine" describes exactly what it does. The rename is cheap now (before adding more consumers).

**Alternatives considered:**

- Keep both names (add progress alongside) → rejected: confusing when both exist
- Put new code in the existing package → rejected: conflates roadmap generation with progress tracking

**User pushback / disagreement:** None

**Reversibility:** Easy — mechanical rename.

### D-02: New pure package at `packages/progress/`

**Status:** ✅ Agreed

**Context:** The new progress/calibration modules need a home. Options: app-level code (`apps/app/src/progress/`) or workspace package.

**Decision:** Workspace package at `packages/progress/` (`@study-tracker/progress`). Own types, no app dependencies.

**Rationale:** Pure module with its own types is trivially testable without importing anything from the app. Enforces "no I/O" at the package boundary. Mirrors the pattern `packages/roadmap-engine/` already proved.

**Alternatives considered:**

- App-level directory → rejected: can't enforce purity at package boundary, imports app types

**User pushback / disagreement:** None

**Reversibility:** Moderate — would need to move files and update imports.

### D-03: Two aggregate functions as the public API

**Status:** ✅ Agreed

**Context:** Should the package export many small functions or two aggregate functions?

**Decision:** `computeCalibration(events) → CalibrationState` and `computeProgress(events, roadmap, calibration) → ProgressSnapshot`. Roadmap is a parameter, not derived internally.

**Rationale:** One call site per module, one cache boundary, module controls internal consistency. CalibrationState feeds into computeProgress — explicit dependency direction. Roadmap as parameter enables issue #010 (replan) to call computeProgress with hypothetical roadmaps.

**Alternatives considered:**

- Individual functions (streak(), burnUp(), projection()) → rejected: forces consumer to coordinate inputs, no consistency guarantee

**User pushback / disagreement:** None

**Reversibility:** Easy — API surface is two functions.

### D-04: Hierarchical Bayesian model with per-role multipliers

**Status:** ✅ Agreed

**Context:** How to compute pace multiplier from session data. User explicitly requested ML, said "this should be a STAR algorithm."

**Decision:** Three-level hierarchical Bayesian model:
- Level 0 (global): Prior μ=1.0, σ²=0.1. Updated by every active session.
- Level 1 (per-role): Inherits global posterior as prior. Activated per role at 3+ sessions. Used for slot projection.
- Level 2 (per-role × time-of-day): Inherits role posterior. For insights only (slots don't have time-of-day).

Normal-Normal conjugate updates. Min 3 sessions per bucket before activation.

**Rationale:** Bayesian handles cold start gracefully (prior does the work). Per-role multipliers map directly to roadmap slots. Hierarchical structure means each level inherits a warm prior from above.

**Alternatives considered:**

- Simple rolling average → rejected: no uncertainty, no per-role differentiation
- Fixed-window average of last N sessions → rejected: doesn't handle cold start or per-role
- Online linear regression → rejected: needs more data to stabilize feature weights

**User pushback / disagreement:** User drove the ML direction — "I want to bring in Machine Learning. I don't mind it getting complex."

**Reversibility:** Moderate — the CalibrationState output shape is the contract, internal implementation can be swapped.

### D-05: CUSUM regime detection for recalibration prompt

**Status:** ✅ Agreed

**Context:** Need to detect when user's pace has shifted significantly to trigger the recalibration prompt.

**Decision:** CUSUM monitoring against Bayesian posterior mean. Parameters: k=0.5σ (slack), h=4.5σ (threshold). ~8 sessions to trigger. Reset on RecalibrationPromptResolved event.

**Rationale:** CUSUM is statistically principled for detecting mean shifts. Monitoring against posterior (not 1.0) catches genuine *changes* in pace, not users who naturally study faster/slower. h=4.5σ was validated via parameter sweep — zero false alarms on consistent users, 2.6-session detection delay on regime shifts.

**Alternatives considered:**

- Arbitrary cooldown timers → rejected: not statistically grounded
- Percentage-based threshold → rejected: doesn't adapt to per-user variance

**User pushback / disagreement:** None — h=4.0σ was originally proposed, sweep data moved it to 4.5σ.

**Reversibility:** Easy — threshold is a constant.

### D-06: Piecewise Kalman trend tracking (B+D architecture)

**Status:** ✅ Agreed

**Context:** Need to detect and extrapolate trends (is user improving or fatiguing?).

**Decision:** CUSUM breakpoints segment session history into phases. Kalman Filter (state=[level, slope]) runs within each phase. Output: per-phase level, slope, and uncertainty. Short segments (<3 sessions) fall back to Bayesian posterior.

Process noise: Q=diag(0.01, 0.0001). Measurement noise: empirical variance.

**Rationale:** CUSUM + Kalman complement each other — CUSUM detects structural breaks, Kalman tracks the fine-grained trend between breaks. Validated via parameter sweep.

**Alternatives considered:**

- Linear regression per phase (pure D) → rejected: no uncertainty, bad on short segments
- Standalone Kalman without CUSUM (pure B) → rejected: smooths through regime shifts instead of detecting them
- Gaussian Process for trend (C) → accepted for burn-up chart but not for phase trends (see D-07)

**User pushback / disagreement:** User asked for B vs C vs D comparison, then asked "How would B+D look?" Settled on B+D for trends.

**Reversibility:** Moderate — internal to calibration module.

### D-07: GP regression for burn-up chart and finish date CI

**Status:** ✅ Agreed

**Context:** Burn-up chart needs a smooth curve with uncertainty band. Finish date needs a confidence interval.

**Decision:** Gaussian Process with Linear + RBF kernel. ℓ=7 days, σ²_n/σ²_f=0.20. Fits cumulative actual minutes, extrapolates with naturally widening CI. CI inflation factor of 1.5x for extrapolation to compensate for inherent under-coverage. Where GP mean crosses total planned = projected finish date. CI band at crossing = finish date range.

**Rationale:** GP gives the smoothest curve and most principled uncertainty bands. Validated via sweep: CI calibration 53.4% at ℓ=7, noise=0.20 (raw), inflated to ~80% coverage with 1.5x factor.

**Alternatives considered:**

- GP for trends too (pure C) → rejected: GP output is a curve, not phases. Hard to distill into narrative for LLM weekly summary (issue #011)
- Visx-rendered burn-up with no ML → rejected: no uncertainty band, no extrapolation

**User pushback / disagreement:** None — user approved B+C+D combined architecture.

**Reversibility:** Easy — GP powers the burn-up visual only. CalibrationState and trend analysis are unaffected.

### D-08: Streak uses `date` field, 4-level relative intensity

**Status:** ✅ Agreed

**Context:** What counts as "a day with a session" for streak, and how to color the heatmap.

**Decision:** Use `SessionLogged.payload.date` (user's intent, not UTC `createdAt`). Heatmap intensity is relative to daily planned target from roadmap:
- Level 0: no session
- Level 1: 1–49% of planned
- Level 2: 50–99% of planned
- Level 3: 100%+ of planned
Manual logs without duration: level 1. Days without a planned slot: use global average daily target.

**Rationale:** `date` reflects user's calendar day (no timezone issues). Relative thresholds adapt to different study plans.

**Alternatives considered:**

- Use `createdAt` → rejected: UTC rollover misattributes sessions for users in non-UTC timezones
- Fixed minute thresholds → rejected: unfair to users with short/long plans

**User pushback / disagreement:** User specified "for streak we also look at duration to map the color" and "relative" to planned target.

**Reversibility:** Easy — display logic only.

### D-09: Verdict uses GP CI against planned line

**Status:** ✅ Agreed

**Context:** How to compute "ahead" / "on-track" / "slipping" verdict.

**Decision:**
- Ahead: GP lower bound (pessimistic) ≥ planned cumulative at today
- On-track: GP mean ≥ planned, but lower bound < planned
- Slipping: GP mean < planned

**Rationale:** Statistically grounded — a consistent user with high mean and tight CI gets "ahead," while a variable user with same mean but wide CI gets "on-track" (honestly cautious).

**Alternatives considered:**

- Percentage threshold (±10%) → rejected: doesn't adapt to per-user variance

**User pushback / disagreement:** None

**Reversibility:** Easy — one function.

### D-10: Three recalibration responses with session checklist

**Status:** ✅ Agreed

**Context:** What happens when CUSUM triggers the recalibration prompt.

**Decision:** Three responses in RecalibrationPromptResolved event:
1. `'replan'` → navigate to replan flow (issue #010)
2. `'acknowledged'` → user confirms pace shift, CUSUM resets with updated reference, Bayesian posterior snaps to observed pace
3. `'temporary'` → show session checklist from CUSUM window, user picks which sessions were temporary, those get batch-tagged as SessionTaggedExceptional

**Rationale:** Binary accept/dismiss forces the user to either replan or get nagged. "Acknowledged" is the most common real response. "Temporary" with checklist gives precise exceptional tagging.

**Alternatives considered:**

- Binary accept/dismiss → rejected: no middle option for "I know but I'm fine"
- Reset CUSUM without user input on dismiss → rejected: same shift re-triggers in 8 sessions

**User pushback / disagreement:** User suggested "instead of starting again, what can user give us so that the existing CUSUM can match their need?" — leading to the acknowledge/temporary split.

**Reversibility:** Easy — event payload shape.

### D-11: SessionTaggedExceptional as separate event

**Status:** ✅ Agreed

**Context:** Should exceptional status be a field on SessionLogged or a separate event?

**Decision:** Always a separate `SessionTaggedExceptional` event with `{ sessionId, exceptional: boolean }`. Three UI entry points: flag on Home recent activity, toggle on /session end, "This was unusual" checkbox on /log form.

**Rationale:** One event kind, one code path for calibration filtering. Avoids two sources of truth (payload field + standalone event).

**Alternatives considered:**

- `exceptional` field on SessionLoggedPayload → rejected: retroactive tagging from history still needs standalone event, creating two sources of truth

**User pushback / disagreement:** None

**Reversibility:** Easy.

### D-12: Manual sessions count for streak/burn-up, excluded from calibration

**Status:** ✅ Agreed

**Context:** Manual logs (source='manual') don't have plannedMinutes or activeMinutes.

**Decision:** Filter by `source === 'active'` for calibration. All sessions count for streak and burn-up.

**Rationale:** Streak and burn-up reflect "did the user study?" — manual logs confirm they did. Calibration needs measured activeMinutes vs plannedMinutes — manual logs don't have that signal.

**Alternatives considered:**

- Exclude manual from everything → rejected: punishes users who study away from the app

**User pushback / disagreement:** None

**Reversibility:** Easy — one filter condition.

### D-13: Burn-up lives on /week only, not /home

**Status:** ✅ Agreed

**Context:** Where should the burn-up chart render?

**Decision:** /week page only. Home stays lean: streak, stats, up-next, recent activity.

**Rationale:** Design mockup in `design/screens.html` shows burn-up on the weekly review (Section F), not Home (Section C). Home is a quick-glance surface, week is the reflective deep-dive.

**Alternatives considered:**

- Burn-up on both Home and /week → rejected: bloats the quick-glance Home experience

**User pushback / disagreement:** User confirmed "Agreed" — follow the design.

**Reversibility:** Easy — render the component on Home too if needed.

### D-14: Visx for chart rendering

**Status:** ✅ Agreed

**Context:** Need a charting approach for the burn-up chart.

**Decision:** Visx (low-level React SVG primitives). BurnUpChart.tsx already created as a prototype — Plan B will refine it.

**Rationale:** Low-level enough to match Marginalia design exactly, high-level enough to handle scales/axes/tooltips. Visx packages already installed in `apps/app/`.

**Alternatives considered:**

- Recharts/Chart.js → rejected: impose their own visual style
- Pure hand-coded SVG → rejected: reimplements axis ticking, responsive scaling, tooltips from scratch

**User pushback / disagreement:** None

**Reversibility:** Easy — BurnUpChart is one component.

### D-15: Tuned hyperparameters from sweep

**Status:** ✅ Agreed

**Context:** Initial hyperparameters needed validation.

**Decision:** Final values from parameter sweep on realistic synthetic data (5 profiles × 20 seeds):

| Parameter | Value | Source |
|---|---|---|
| CUSUM h | 4.5σ | Sweep: elbow where false alarms < 0.3 |
| CUSUM k | 0.5σ | Standard |
| Kalman Q[0,0] (level) | 0.010 | Sweep: best 1-step-ahead MAE |
| Kalman Q[1,1] (slope) | 0.0001 | Sweep: best slope accuracy on Improving profile |
| GP ℓ (length scale) | 7 days | Sweep: best CI calibration + RMSE balance |
| GP σ²_n/σ²_f (noise ratio) | 0.20 | Sweep: improved CI calibration |
| GP extrapolation CI inflation | 1.5× | Compensates for inherent GP under-coverage on extrapolation |
| Bayesian prior μ | 1.0 | Identity (no bias) |
| Bayesian prior σ² | 0.1 | Wide enough for cold start |
| Min sessions per bucket | 3 | Minimum for meaningful posterior |

**Rationale:** Validated against 5 realistic user profiles: Consistent Carla (no false alarms), Improving Ian (drift detected), Fading Fiona (drift detected), Chaotic Carlos (no false alarms despite high variance), Regime-Shift Riley (2.6-session detection delay).

**Alternatives considered:**

- Initial guesses (h=4.0, Q[1,1]=0.001, noise=0.10) → adjusted: sweep showed 4.5σ reduces false alarms, 0.0001 slope noise gives better slope accuracy, 0.20 noise improves CI calibration

**User pushback / disagreement:** None — user requested the sweep.

**Reversibility:** Easy — all constants in one config file.

## Architecture overview

```
@study-tracker/progress (new package)
├── src/
│   ├── index.ts              # Public API: computeCalibration, computeProgress, getPromptDetail
│   ├── types.ts              # CalibrationState, ProgressSnapshot, BurnUpData, etc.
│   ├── config.ts             # All hyperparameters as named constants
│   ├── bayesian.ts           # Hierarchical Bayesian model (Normal-Normal conjugate)
│   ├── cusum.ts              # CUSUM regime detection
│   ├── kalman.ts             # Kalman Filter (2D state: level + slope)
│   ├── gp.ts                 # Gaussian Process regression (Linear + RBF kernel)
│   ├── calibration.ts        # computeCalibration() — composes bayesian + cusum + kalman
│   ├── progress.ts           # computeProgress() — streak, burn-up, projection, verdict
│   └── streak.ts             # Streak calculation (isolated for testability)
└── test/
    ├── bayesian.test.ts
    ├── cusum.test.ts
    ├── kalman.test.ts
    ├── gp.test.ts
    ├── calibration.test.ts
    ├── progress.test.ts
    └── streak.test.ts
```

**Data flow:**

```
Events[] ──→ computeCalibration(events)
                    │
                    ▼
            CalibrationState
                    │
                    ▼
Events[] + Roadmap + CalibrationState ──→ computeProgress(events, roadmap, calibration)
                                                    │
                                                    ▼
                                            ProgressSnapshot
                                            (streak, burnUp, projection, verdict, weeklyStats, ...)
```

**Algorithm composition within computeCalibration:**

```
SessionLogged events (source='active', not exceptional)
    │
    ├──→ Hierarchical Bayesian ──→ globalMultiplier, roleMultipliers, posteriors
    │
    ├──→ CUSUM (monitors posterior mean) ──→ breakpoints[], promptNeeded
    │
    └──→ Piecewise Kalman (per breakpoint segment) ──→ TrendAnalysis { phases[] }
```

**Algorithm within computeProgress (burn-up):**

```
SessionLogged events (all sources)
    │
    └──→ GP regression on cumulative minutes ──→ gpCurve[], projectedFinish, confidenceInterval
```

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `packages/progress-engine/` → `packages/roadmap-engine/` | rename | 1 | Clear namespace |
| `packages/roadmap-engine/package.json` | modify | 1 | Update package name |
| `apps/app/package.json` | modify | 1 | Update dependency name |
| ~28 import sites in `apps/app/src/` | modify | 1 | Update import paths |
| `.claude/rules/progress-engine.md` | modify | 1 | Update rule title/content |
| `CLAUDE.md` | modify | 1 | Update commands and references |
| `packages/progress/package.json` | new | 2 | Package manifest |
| `packages/progress/tsconfig.json` | new | 2 | TypeScript config |
| `packages/progress/vitest.config.ts` | new | 2 | Test runner config |
| `packages/progress/src/index.ts` | new | 2 | Public API exports |
| `packages/progress/src/types.ts` | new | 2 | All type definitions |
| `packages/progress/src/config.ts` | new | 2 | Hyperparameter constants |
| `packages/progress/src/bayesian.ts` | new | 3 | Hierarchical Bayesian model |
| `packages/progress/src/cusum.ts` | new | 3 | CUSUM regime detection |
| `packages/progress/test/bayesian.test.ts` | new | 3 | Bayesian model tests |
| `packages/progress/test/cusum.test.ts` | new | 3 | CUSUM tests |
| `packages/progress/src/kalman.ts` | new | 4 | Kalman Filter |
| `packages/progress/src/trend.ts` | new | 4 | Piecewise trend analysis |
| `packages/progress/test/kalman.test.ts` | new | 4 | Kalman tests |
| `packages/progress/test/trend.test.ts` | new | 4 | Trend analysis tests |
| `packages/progress/src/gp.ts` | new | 5 | Gaussian Process regression |
| `packages/progress/src/streak.ts` | new | 5 | Streak calculation |
| `packages/progress/test/gp.test.ts` | new | 5 | GP tests |
| `packages/progress/test/streak.test.ts` | new | 5 | Streak tests |
| `packages/progress/src/calibration.ts` | new | 6 | computeCalibration() |
| `packages/progress/src/progress.ts` | new | 6 | computeProgress() |
| `packages/progress/test/calibration.test.ts` | new | 6 | Integration tests |
| `packages/progress/test/progress.test.ts` | new | 6 | Integration tests |
| `apps/app/src/events/ProgressEngine.ts` | modify | 7 | Deprecate, re-export from @study-tracker/progress |
| `apps/app/src/progress/mapEvents.ts` | new | 7 | Shared mapper: raw Event[] → typed SessionEvent[], ExceptionalTag[], etc. |
| `apps/app/src/progress/useProgress.ts` | new | 7 | Hook: useProgressSnapshot() |
| `apps/app/src/progress/useCalibration.ts` | new | 7 | Hook: useCalibrationState() |
| `apps/app/src/progress/usePromptDetail.ts` | new | 7 | Hook: usePromptDetail() for recalibration modal |
| `apps/app/src/progress/index.ts` | new | 7 | Barrel export |

## Phases

### Phase 1: Rename `@study-tracker/progress-engine` to `@study-tracker/roadmap-engine`

**Status:** ✅ Complete
**Depends on:** none — can start immediately
**Estimated scope:** ~30 files, ~30 lines changed (mechanical find-and-replace)

#### Codebase state assumed at start

- `packages/progress-engine/` exists with `package.json` having `name: "@study-tracker/progress-engine"`
- ~28 files in `apps/app/src/` import from `@study-tracker/progress-engine`
- All tests pass: `pnpm --filter progress-engine test` and `pnpm --filter app test`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls packages/progress-engine/package.json   # should exist
grep -r "@study-tracker/progress-engine" apps/app/src/ --include="*.ts" --include="*.tsx" | wc -l   # should return ~28
pnpm --filter progress-engine test   # should pass
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Rename directory:** `packages/progress-engine/` → `packages/roadmap-engine/`

2. **Update `packages/roadmap-engine/package.json`:** Change `"name"` from `"@study-tracker/progress-engine"` to `"@study-tracker/roadmap-engine"`.

3. **Update `apps/app/package.json`:** In dependencies, change `"@study-tracker/progress-engine"` to `"@study-tracker/roadmap-engine"`.

4. **Find-and-replace all imports in `apps/app/src/`:** Replace `@study-tracker/progress-engine` with `@study-tracker/roadmap-engine` in every `.ts` and `.tsx` file. Key files (non-exhaustive):

   - `apps/app/src/pages/Home.tsx` (2 imports)
   - `apps/app/src/events/ProgressEngine.ts` (1 import)
   - `apps/app/src/sync/types.ts` (1 import)
   - `apps/app/src/onboarding/OnboardingProvider.tsx` (1 import)
   - `apps/app/src/onboarding/steps/Step3Preview.tsx` (1 import)
   - `apps/app/src/onboarding/steps/Step2Hours.tsx` (1 import)
   - `apps/app/src/onboarding/components/SchedulePreview.tsx` (2 imports)
   - `apps/app/src/onboarding/components/TieResolver.tsx` (1 import)
   - `apps/app/src/onboarding/components/computeSwapEdits.ts` (1 import)
   - `apps/app/src/onboarding/components/CapacityPrompt.tsx` (1 import)
   - `apps/app/src/onboarding/components/PlaylistCard.tsx` (2 imports)
   - `apps/app/src/onboarding/components/MaterialRow.tsx` (1 import)
   - `apps/app/src/onboarding/OnboardingFlow.test.tsx` (3 references)
   - `apps/app/src/onboarding/steps/Step3Preview.test.tsx` (6 references)

5. **Update `.claude/rules/progress-engine.md`:** Rename to `roadmap-engine.md`. Update title to "Roadmap Engine". Update package name references.

6. **Update `CLAUDE.md`:** Change `pnpm --filter progress-engine test` to `pnpm --filter roadmap-engine test`. Update the directory map entry. Update the architecture rules table.

7. **Run `pnpm install`** from workspace root to update the lockfile.

#### Tests

- No new tests. All existing tests should pass with the renamed imports.
- Run: `pnpm --filter roadmap-engine test && pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
ls packages/roadmap-engine/package.json   # should exist
grep -r "@study-tracker/progress-engine" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.json" | wc -l   # should return 0
pnpm --filter roadmap-engine test   # should pass
pnpm --filter app test   # should pass
pnpm typecheck   # should pass
```

#### Rollback

`git revert <commit-sha>`. No data migrations or external effects.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 2: Create `@study-tracker/progress` package skeleton with types and config

**Status:** ✅ Complete
**Depends on:** Phase 1 (namespace must be clear)
**Estimated scope:** ~6 new files, ~350 lines

#### Codebase state assumed at start

- `packages/roadmap-engine/` exists (Phase 1 complete)
- No `packages/progress/` directory exists
- Workspace `pnpm-workspace.yaml` has `packages: ["packages/*", "apps/*"]`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls packages/roadmap-engine/package.json   # should exist
test ! -d packages/progress && echo "OK"   # should print OK
```

If any of these fail, STOP.

#### Steps

1. **Create `packages/progress/package.json`:**

   ```json
   {
     "name": "@study-tracker/progress",
     "version": "1.0.0",
     "type": "module",
     "exports": {
       ".": {
         "import": "./src/index.ts",
         "types": "./src/index.ts"
       }
     },
     "scripts": {
       "typecheck": "tsc --noEmit",
       "test": "vitest run",
       "test:watch": "vitest",
       "lint": "eslint ."
     },
     "devDependencies": {
       "@typescript-eslint/eslint-plugin": "^8.57.0",
       "@typescript-eslint/parser": "^8.57.0",
       "eslint": "^8.57.0",
       "fast-check": "^3.23.1",
       "globals": "^17.5.0",
       "typescript": "^5.4.0",
       "vitest": "^1.6.1"
     }
   }
   ```

2. **Create `packages/progress/tsconfig.json`:**

   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ES2022",
       "moduleResolution": "bundler",
       "strict": true,
       "noEmit": true,
       "skipLibCheck": true,
       "esModuleInterop": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "isolatedModules": true
     },
     "include": ["src/**/*.ts", "test/**/*.ts"]
   }
   ```

3. **Create `packages/progress/vitest.config.ts`:**

   ```typescript
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
     test: {
       globals: true,
     },
   })
   ```

4. **Create `packages/progress/src/types.ts`:** All type definitions for both modules. Implements D-03, D-04, D-06, D-07, D-08, D-09.

   ```typescript
   export type MaterialRole = 'anchor' | 'foundation' | 'practice'
   export type TimeOfDay = 'morning' | 'afternoon' | 'evening'
   export type Verdict = 'ahead' | 'on-track' | 'slipping'

   // --- Input types (what the app feeds in) ---

   export interface SessionEvent {
     date: string
     source: 'active' | 'manual'
     plannedMinutes?: number
     activeMinutes?: number
     duration: number
     materialRole?: MaterialRole
     startedAt?: string
     sessionId?: string
   }

   export interface ExceptionalTag {
     sessionId: string
     exceptional: boolean
   }

   export interface RecalibrationResolution {
     resolution: 'replan' | 'acknowledged' | 'temporary'
     resolvedAt: string
   }

   export interface RoadmapSlot {
     date: string
     dayOfWeek: string
     weekIndex: number
     plannedMinutes: number
     candidateMaterialIds: string[]
     role: MaterialRole | null
     sessionTitle?: string | null
   }

   export interface RoadmapInput {
     startDate: string
     deadline: string
     weeks: number
     weeklyHours: number
     slots: RoadmapSlot[]
   }

   // --- CalibrationState output ---

   export interface BayesianPosterior {
     mean: number
     variance: number
     sessionCount: number
   }

   export interface RoleMultiplier {
     multiplier: number
     confidence: number
     sessionCount: number
   }

   export interface Phase {
     startSessionIndex: number
     endSessionIndex: number
     startDate: string
     endDate: string
     level: number
     slope: number
     slopeUncertainty: number
     sessionCount: number
   }

   export interface TrendAnalysis {
     phases: Phase[]
     currentPhase: Phase | null
     projectionSlope: number
     projectionUncertainty: number
   }

   export interface ContextInsight {
     role: MaterialRole
     timeOfDay: TimeOfDay
     multiplier: number
     sessionCount: number
     label: string
   }

   export interface CalibrationState {
     globalMultiplier: number
     globalPosterior: BayesianPosterior
     roleMultipliers: Partial<Record<MaterialRole, RoleMultiplier>>
     trend: TrendAnalysis
     promptNeeded: boolean
     insightsByContext: ContextInsight[]
   }

   // --- PromptDetail (cold path, only when modal opens) ---

   export interface PromptSession {
     sessionId: string
     date: string
     timeOfDay: TimeOfDay
     sessionTitle: string
     plannedMinutes: number
     activeMinutes: number
   }

   export interface PromptDetail {
     sessions: PromptSession[]
     currentPace: number
     previousPace: number
   }

   // --- ProgressSnapshot output ---

   export interface DayCell {
     date: string
     level: 0 | 1 | 2 | 3
     minutes: number
     isToday: boolean
   }

   export interface CumulativePoint {
     date: string
     minutes: number
   }

   export interface GPPoint {
     date: string
     mean: number
     lower: number
     upper: number
   }

   export interface BurnUpData {
     planned: CumulativePoint[]
     actual: CumulativePoint[]
     gpCurve: GPPoint[]
     today: string
     deficit: number
     dayNumber: number
     totalDays: number
   }

   export interface WeeklyStats {
     weekIndex: number
     weekStartDate: string
     sessionsThisWeek: number
     minutesThisWeek: number
     plannedMinutesThisWeek: number
     minutesByDay: Record<string, number>
     materialsTouched: string[]
   }

   export interface WeekSummaryForNarrative {
     weekStartDate: string
     sessionsLogged: number
     hoursLogged: number
     verdict: Verdict
     daysWithActivity: number
     materialsTouched: string[]
   }

   export interface ReplanContext {
     isPlanDrifted: boolean
     daysOverDeadline: number | null
     pinnedSlotCount: number
     editableSlotCount: number
   }

   export interface ProgressSnapshot {
     streak: {
       current: number
       longest: number
       grid: DayCell[]
     }
     burnUp: BurnUpData
     projection: {
       finishDate: string | null
       confidenceInterval: [string, string] | null
     }
     totalMinutes: number
     totalPlannedMinutes: number
     completionPercentage: number
     verdict: Verdict
     driftPastDeadline: boolean
     upNext: RoadmapSlot | null
     weeklyStats: WeeklyStats
     weekSummaryForNarrative: WeekSummaryForNarrative
     replanContext: ReplanContext
   }
   ```

5. **Create `packages/progress/src/config.ts`:** All hyperparameters as named constants. Implements D-15.

   ```typescript
   // Bayesian model
   export const BAYESIAN_PRIOR_MEAN = 1.0
   export const BAYESIAN_PRIOR_VARIANCE = 0.1
   export const MIN_SESSIONS_PER_BUCKET = 3

   // CUSUM
   export const CUSUM_SLACK_FACTOR = 0.5
   export const CUSUM_THRESHOLD_FACTOR = 4.5

   // Kalman Filter
   export const KALMAN_LEVEL_NOISE = 0.01
   export const KALMAN_SLOPE_NOISE = 0.0001

   // Gaussian Process
   export const GP_LENGTH_SCALE = 7.0
   export const GP_NOISE_RATIO = 0.20
   export const GP_EXTRAPOLATION_CI_INFLATION = 1.5
   export const GP_EXTRAPOLATION_DAYS = 14

   // Streak
   export const STREAK_LEVEL_THRESHOLDS = [0, 0.01, 0.50, 1.00] as const
   ```

6. **Create `packages/progress/src/index.ts`:** Public API surface (stubs for now, filled in Phase 6).

   ```typescript
   export type {
     SessionEvent,
     ExceptionalTag,
     RecalibrationResolution,
     RoadmapInput,
     RoadmapSlot,
     CalibrationState,
     ProgressSnapshot,
     PromptDetail,
     BurnUpData,
     GPPoint,
     CumulativePoint,
     DayCell,
     Phase,
     TrendAnalysis,
     RoleMultiplier,
     ContextInsight,
     WeeklyStats,
     WeekSummaryForNarrative,
     ReplanContext,
     Verdict,
     MaterialRole,
     TimeOfDay,
   } from './types'

   export {
     BAYESIAN_PRIOR_MEAN,
     BAYESIAN_PRIOR_VARIANCE,
     MIN_SESSIONS_PER_BUCKET,
     CUSUM_SLACK_FACTOR,
     CUSUM_THRESHOLD_FACTOR,
     KALMAN_LEVEL_NOISE,
     KALMAN_SLOPE_NOISE,
     GP_LENGTH_SCALE,
     GP_NOISE_RATIO,
     GP_EXTRAPOLATION_CI_INFLATION,
   } from './config'

   // Stubs — implemented in Phase 6
   export { computeCalibration } from './calibration'
   export { computeProgress } from './progress'
   export { getPromptDetail } from './calibration'
   ```

7. **Run `pnpm install`** to register the new package.

#### Tests

- No behavioral tests yet — this phase creates types and config only.
- Run: `pnpm --filter progress typecheck`

#### Verification (DONE — run after implementation)

```bash
ls packages/progress/src/types.ts   # should exist
ls packages/progress/src/config.ts   # should exist
pnpm --filter progress typecheck   # should pass (once stubs exist)
```

#### Rollback

`rm -rf packages/progress && pnpm install`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 3: Implement Hierarchical Bayesian model and CUSUM detector

**Status:** ☐ Not started
**Depends on:** Phase 2 (types and config must exist)
**Estimated scope:** ~4 files, ~400 lines

#### Codebase state assumed at start

- `packages/progress/src/types.ts` exists with all type definitions (Phase 2)
- `packages/progress/src/config.ts` exists with hyperparameter constants (Phase 2)
- `pnpm --filter progress typecheck` passes

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls packages/progress/src/types.ts   # should exist
grep "BAYESIAN_PRIOR_MEAN" packages/progress/src/config.ts   # should return a line
```

If any of these fail, STOP.

#### Steps

1. **Create `packages/progress/src/bayesian.ts`:** Hierarchical Normal-Normal conjugate update model. Implements D-04.

   The implementing agent should write the full Bayesian module with these functions:

   - `updatePosterior(prior: BayesianPosterior, observation: number, observationVariance: number): BayesianPosterior` — single Normal-Normal conjugate update. Formula: `posteriorMean = (prior.variance * observation + observationVariance * prior.mean) / (prior.variance + observationVariance)`, `posteriorVariance = (prior.variance * observationVariance) / (prior.variance + observationVariance)`.

   - `computeHierarchicalModel(sessions: SessionEvent[], exceptionalIds: Set<string>): HierarchicalResult` — the main function. Filters to active, non-exceptional sessions. Extracts pace ratios (`activeMinutes / plannedMinutes`). Computes empirical variance of ratios. Runs Level 0 (global) updates across all sessions. Runs Level 1 (per-role) updates using global posterior as prior, activated at `MIN_SESSIONS_PER_BUCKET`. Runs Level 2 (per-role × time-of-day) using role posterior as prior, for insights only.

   - `inferTimeOfDay(startedAt: string): TimeOfDay` — helper: before 12pm → morning, 12-5pm → afternoon, after 5pm → evening.

   - `HierarchicalResult` interface: `{ globalPosterior, globalMultiplier, roleMultipliers, insights }`.

   Reference implementation: `issues/images/hyperparam_sweep.py` lines that implement the Bayesian model.

2. **Create `packages/progress/src/cusum.ts`:** CUSUM detector. Implements D-05, D-10.

   The implementing agent should write the full CUSUM module with these functions:

   - `runCUSUM(paceRatios: number[], referenceMean: number, std: number): CUSUMResult` — runs bilateral CUSUM. Maintains `S_upper` and `S_lower` accumulators. `k = CUSUM_SLACK_FACTOR * std`, `h = CUSUM_THRESHOLD_FACTOR * std`. Returns breakpoints (indices where |accumulator| crossed threshold) and final accumulator values.

   - `detectRegimeShifts(sessions: SessionEvent[], exceptionalIds: Set<string>, posteriorMean: number, resolutions: RecalibrationResolution[]): RegimeShiftResult` — the main function. Extracts pace ratios. Computes empirical std. Runs CUSUM. Handles resets at RecalibrationPromptResolved events. Returns `{ breakpoints: number[], promptNeeded: boolean, cusumState: { upper: number, lower: number } }`.

   Reference: `issues/images/hyperparam_sweep.py` CUSUM implementation.

3. **Create `packages/progress/test/bayesian.test.ts`:** Tests for the Bayesian model.

   Key test cases:
   - Single update shifts posterior toward observation
   - Multiple updates converge — 10 sessions at 0.8x → posterior mean near 0.8
   - Per-role multipliers diverge — anchor sessions at 1.2x, practice at 0.8x → different multipliers
   - Below MIN_SESSIONS_PER_BUCKET → role falls back to global
   - Exceptional sessions excluded — tagged sessions don't affect posterior
   - Empty input → returns prior unchanged
   - Manual sessions (source='manual') excluded from calibration

4. **Create `packages/progress/test/cusum.test.ts`:** Tests for CUSUM.

   Key test cases:
   - Stable signal → no breakpoints detected
   - Abrupt shift (1.0 for 20, then 0.75 for 20) → breakpoint detected near session 20
   - High variance stable signal → no false alarms (critical — tests Chaotic Carlos scenario)
   - Gradual drift → eventually triggers (but later than abrupt)
   - RecalibrationPromptResolved resets accumulator → requires another 8+ sessions to re-trigger
   - `resolution: 'acknowledged'` updates reference mean → same pace doesn't re-trigger
   - `resolution: 'temporary'` keeps original reference → same pace re-triggers

#### Tests

- Run: `pnpm --filter progress test`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter progress test   # all tests pass
grep "computeHierarchicalModel" packages/progress/src/bayesian.ts   # should return the function
grep "detectRegimeShifts" packages/progress/src/cusum.ts   # should return the function
```

#### Rollback

`git revert <commit-sha>`. No external effects.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 4: Implement Piecewise Kalman Filter and trend analysis

**Status:** ☐ Not started
**Depends on:** Phase 3 (CUSUM breakpoints are input to Kalman)
**Estimated scope:** ~4 files, ~300 lines

#### Codebase state assumed at start

- `packages/progress/src/cusum.ts` exists with `detectRegimeShifts()` (Phase 3)
- `packages/progress/src/bayesian.ts` exists with `computeHierarchicalModel()` (Phase 3)
- Phase 3 tests pass

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "detectRegimeShifts" packages/progress/src/cusum.ts   # should return the function
pnpm --filter progress test   # Phase 3 tests pass
```

If any of these fail, STOP.

#### Steps

1. **Create `packages/progress/src/kalman.ts`:** 2D Kalman Filter. Implements D-06.

   The implementing agent should write:

   - `KalmanState` interface: `{ x: [number, number], P: [[number, number], [number, number]] }` — state vector [level, slope] and covariance matrix.

   - `initKalman(initialLevel: number, initialVariance: number): KalmanState` — initializes state from Bayesian posterior.

   - `kalmanPredict(state: KalmanState): KalmanState` — prediction step. State transition: `F = [[1, 1], [0, 1]]`. Process noise: `Q = [[KALMAN_LEVEL_NOISE, 0], [0, KALMAN_SLOPE_NOISE]]`.

   - `kalmanUpdate(state: KalmanState, observation: number, R: number): KalmanState` — update step with observation matrix `H = [1, 0]`. Standard Kalman gain computation.

   - `runKalmanOnPhase(paceRatios: number[], initialLevel: number, initialVariance: number, measurementVariance: number): KalmanPhaseResult` — runs predict-update loop over a sequence. Returns final state (level, slope, uncertainties).

2. **Create `packages/progress/src/trend.ts`:** Piecewise trend analysis composing CUSUM + Kalman.

   - `analyzeTrend(sessions: SessionEvent[], exceptionalIds: Set<string>, bayesianResult: HierarchicalResult, cusumResult: RegimeShiftResult): TrendAnalysis` — segments sessions at CUSUM breakpoints, runs Kalman per segment, assembles Phase[] array. Short segments (<3 sessions) use Bayesian posterior directly (level=posterior mean, slope=0, high uncertainty).

3. **Create `packages/progress/test/kalman.test.ts`:** Tests for Kalman Filter.

   Key test cases:
   - Constant input → level tracks to constant, slope ≈ 0
   - Linear trend (decreasing) → negative slope detected
   - Linear trend (increasing) → positive slope detected
   - Short sequence (2 sessions) → wide uncertainty, level near input mean
   - Sudden jump → level adjusts within 3-5 updates

4. **Create `packages/progress/test/trend.test.ts`:** Tests for trend analysis.

   Key test cases:
   - No breakpoints → single phase covering all sessions
   - One breakpoint → two phases with independent Kalman runs
   - Short segment after breakpoint (<3 sessions) → falls back to Bayesian posterior
   - Empty sessions → empty phases array

#### Tests

- Run: `pnpm --filter progress test`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter progress test   # all tests pass
grep "analyzeTrend" packages/progress/src/trend.ts   # should return the function
grep "runKalmanOnPhase" packages/progress/src/kalman.ts   # should return the function
```

#### Rollback

`git revert <commit-sha>`. No external effects.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 5: Implement GP regression and streak calculation

**Status:** ☐ Not started
**Depends on:** Phase 2 (types and config only — GP and streak are independent of Bayesian/CUSUM/Kalman)
**Estimated scope:** ~4 files, ~400 lines

#### Codebase state assumed at start

- `packages/progress/src/types.ts` exists with `GPPoint`, `CumulativePoint`, `DayCell` types (Phase 2)
- `packages/progress/src/config.ts` exists with GP constants (Phase 2)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "GP_LENGTH_SCALE" packages/progress/src/config.ts   # should return a line
grep "GPPoint" packages/progress/src/types.ts   # should return a line
```

If any of these fail, STOP.

#### Steps

1. **Create `packages/progress/src/gp.ts`:** Gaussian Process with Linear + RBF kernel. Implements D-07.

   The implementing agent should write:

   - `rbfKernel(x1: number, x2: number, lengthScale: number, signalVariance: number): number` — `σ²_f * exp(-0.5 * ((x1-x2)/ℓ)²)`

   - `linearKernel(x1: number, x2: number, variance: number): number` — `σ²_l * x1 * x2`

   - `computeKernelMatrix(xs: number[], lengthScale: number, signalVariance: number, linearVariance: number, noiseVariance: number): number[][]` — K(X,X) + σ²_n * I. Uses both RBF + linear kernel.

   - `choleskyDecompose(A: number[][]): number[][]` — lower triangular L such that A = L * L^T. Add jitter (1e-8) to diagonal for numerical stability.

   - `choleskySolve(L: number[][], b: number[]): number[]` — solve L * L^T * x = b via forward/back substitution.

   - `gpRegression(trainX: number[], trainY: number[], testX: number[]): { mean: number[], variance: number[] }` — full GP posterior inference. Detrend trainY with linear fit first (subtract linear trend, fit GP on residuals, add trend back). This is critical for cumulative data — raw cumulative values fight the RBF kernel.

   - `fitBurnUpGP(actualPoints: CumulativePoint[], startDate: string, endDate: string, today: string): GPPoint[]` — the high-level function. Converts dates to day indices, runs GP, applies `GP_EXTRAPOLATION_CI_INFLATION` factor for points beyond today, returns GPPoint[].

   Reference: `issues/images/hyperparam_sweep.py` GP implementation (with detrending).

2. **Create `packages/progress/src/streak.ts`:** Streak calculation. Implements D-08.

   - `calculateStreak(sessions: SessionEvent[], today: string): { current: number, longest: number }` — groups sessions by `date`, counts consecutive days backward from today (or most recent session date). Also tracks longest streak across all history.

   - `buildStreakGrid(sessions: SessionEvent[], today: string, dailyPlannedMinutes: Record<string, number>, globalAvgDailyMinutes: number): DayCell[]` — builds 7-day grid (current week, Mon-Sun). For each day: sum session durations, compute level (0-3) relative to planned target for that day (or global average if no slot).

3. **Create `packages/progress/test/gp.test.ts`:** Tests for GP.

   Key test cases:
   - Linear data → GP mean tracks linear trend, CI tight
   - Noisy data around trend → CI wider, mean still close to trend
   - Extrapolation → CI widens beyond training data
   - CI inflation applied beyond today → extrapolation CI is 1.5x wider
   - Empty input → returns empty array
   - Single point → returns that point with wide CI
   - Detrending works — cumulative data produces smooth curve, not wiggly

4. **Create `packages/progress/test/streak.test.ts`:** Tests for streak.

   Key test cases:
   - 5 consecutive days → current streak = 5
   - Gap in middle → current streak counts from gap forward
   - Sessions on same day → count as one streak day
   - No sessions → current = 0, longest = 0
   - Streak grid: session at 100% of planned → level 3
   - Streak grid: session at 60% → level 2
   - Streak grid: session at 30% → level 1
   - Streak grid: no session → level 0
   - Streak grid: manual log without duration → level 1
   - Streak grid: rest day with session → uses global average as denominator

#### Tests

- Run: `pnpm --filter progress test`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter progress test   # all tests pass
grep "fitBurnUpGP" packages/progress/src/gp.ts   # should return the function
grep "calculateStreak" packages/progress/src/streak.ts   # should return the function
```

#### Rollback

`git revert <commit-sha>`. No external effects.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 6: Implement `computeCalibration()` and `computeProgress()` integration

**Status:** ☐ Not started
**Depends on:** Phase 3, Phase 4, Phase 5 (all algorithm modules)
**Estimated scope:** ~4 files, ~400 lines

#### Codebase state assumed at start

- `packages/progress/src/bayesian.ts` — `computeHierarchicalModel()` exists (Phase 3)
- `packages/progress/src/cusum.ts` — `detectRegimeShifts()` exists (Phase 3)
- `packages/progress/src/trend.ts` — `analyzeTrend()` exists (Phase 4)
- `packages/progress/src/gp.ts` — `fitBurnUpGP()` exists (Phase 5)
- `packages/progress/src/streak.ts` — `calculateStreak()`, `buildStreakGrid()` exist (Phase 5)
- All Phase 3–5 tests pass

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
pnpm --filter progress test   # all Phase 3-5 tests pass
grep "computeHierarchicalModel" packages/progress/src/bayesian.ts   # exists
grep "detectRegimeShifts" packages/progress/src/cusum.ts   # exists
grep "analyzeTrend" packages/progress/src/trend.ts   # exists
grep "fitBurnUpGP" packages/progress/src/gp.ts   # exists
grep "calculateStreak" packages/progress/src/streak.ts   # exists
```

If any of these fail, STOP.

#### Steps

1. **Create `packages/progress/src/calibration.ts`:** Implements D-03.

   - `computeCalibration(sessions: SessionEvent[], exceptionalTags: ExceptionalTag[], resolutions: RecalibrationResolution[]): CalibrationState` — the public function. Orchestrates: build exceptionalIds set → `computeHierarchicalModel()` → `detectRegimeShifts()` → `analyzeTrend()` → assemble CalibrationState.

   - `getPromptDetail(sessions: SessionEvent[], cusumBreakpoints: number[]): PromptDetail` — cold path function. Returns the sessions in the CUSUM detection window with display data (date, time, title, planned vs actual).

2. **Create `packages/progress/src/progress.ts`:** Implements D-03, D-09, D-13.

   - `computeProgress(sessions: SessionEvent[], roadmap: RoadmapInput, calibration: CalibrationState, today: string): ProgressSnapshot` — the public function. Computes:
     - **streak** via `calculateStreak()` + `buildStreakGrid()`
     - **burn-up** via cumulative summation of planned/actual + `fitBurnUpGP()`
     - **projection** — where GP mean crosses total planned minutes → finish date. GP CI at crossing → confidence interval.
     - **verdict** — compare GP lower/mean against planned cumulative at today (D-09)
     - **totalMinutes** — sum of all session durations
     - **completionPercentage** — actualCumulative / totalPlanned
     - **upNext** — first incomplete slot where `date >= today`
     - **weeklyStats** — filter sessions to current ISO week, aggregate
     - **weekSummaryForNarrative** — structured summary for LLM prompt
     - **replanContext** — `isPlanDrifted = finishDate > deadline`
     - **driftPastDeadline** — boolean

3. **Update `packages/progress/src/index.ts`:** Remove stub comments, ensure all exports resolve. Add `getPromptDetail` export.

4. **Create `packages/progress/test/calibration.test.ts`:** Integration tests.

   Key test cases:
   - Full pipeline: 30 active sessions → CalibrationState with valid multipliers, trend phases, no prompt
   - Regime shift at session 20 → promptNeeded = true
   - Exceptional sessions excluded → don't affect multipliers
   - RecalibrationPromptResolved resets CUSUM
   - Empty input → default CalibrationState (multiplier 1.0, no phases)

5. **Create `packages/progress/test/progress.test.ts`:** Integration tests.

   Key test cases:
   - Full pipeline: 30 sessions + roadmap → ProgressSnapshot with all fields populated
   - Streak: 5 consecutive days → current = 5
   - Burn-up: actual below planned → verdict = 'slipping', deficit < 0
   - Burn-up: actual above planned → verdict = 'ahead', deficit > 0
   - Projection: GP extrapolation produces finishDate and CI
   - Empty roadmap → null projection, zero totals
   - Completed roadmap (all slots have sessions) → completionPercentage = 100%
   - upNext: skipped past slots → returns next incomplete slot
   - weeklyStats: sessions filtered to current week
   - replanContext: finishDate past deadline → isPlanDrifted = true

#### Tests

- Run: `pnpm --filter progress test`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter progress test   # ALL tests pass (phases 3-6)
pnpm --filter progress typecheck   # passes
grep "export.*computeCalibration" packages/progress/src/index.ts   # exported
grep "export.*computeProgress" packages/progress/src/index.ts   # exported
```

#### Rollback

`git revert <commit-sha>`. No external effects.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 7: Wire into app — hooks, providers, and replace existing ProgressEngine

**Status:** ☐ Not started
**Depends on:** Phase 6 (computeCalibration and computeProgress must be working)
**Estimated scope:** ~6 files, ~200 lines

#### Codebase state assumed at start

- `@study-tracker/progress` package is complete with `computeCalibration()` and `computeProgress()` (Phase 6)
- `apps/app/src/events/ProgressEngine.ts` exists with 3 functions: `totalMinutesLogged`, `getProjectedFinish`, `getUpNextSlot`
- `apps/app/src/pages/Home.tsx` imports from `events/ProgressEngine`
- EventStore is accessible via `useEventStore()` hook

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
pnpm --filter progress test   # all pass
grep "totalMinutesLogged" apps/app/src/events/ProgressEngine.ts   # exists
grep "useEventStore" apps/app/src/events/useEventStore.ts   # exists
```

If any of these fail, STOP.

#### Steps

1. **Add `@study-tracker/progress` dependency to `apps/app/package.json`:**

   ```json
   "@study-tracker/progress": "workspace:*"
   ```

   Run `pnpm install`.

2. **Create `apps/app/src/progress/mapEvents.ts`:** Shared mapper — extracts typed data from raw Event[]. Resolves OQ-02 upfront so no hook duplicates this logic.

   ```typescript
   import type { Event } from '../events/EventStore'
   import type { SessionEvent, ExceptionalTag, RecalibrationResolution, RoadmapInput } from '@study-tracker/progress'
   import type { RoadmapCreatedPayload } from '../sync/types'

   export function mapSessions(events: Event[]): SessionEvent[] {
     return events
       .filter(e => e.kind === 'SessionLogged')
       .map(e => ({
         date: e.payload.date as string,
         source: (e.payload.source as 'active' | 'manual') ?? 'manual',
         plannedMinutes: e.payload.plannedMinutes as number | undefined,
         activeMinutes: e.payload.activeMinutes as number | undefined,
         duration: e.payload.duration as number,
         materialRole: e.payload.role as SessionEvent['materialRole'],
         startedAt: e.payload.startedAt as string | undefined,
         sessionId: e.payload.sessionId as string | undefined,
       }))
   }

   export function mapExceptionalTags(events: Event[]): ExceptionalTag[] {
     return events
       .filter(e => e.kind === 'SessionTaggedExceptional')
       .map(e => ({
         sessionId: e.payload.sessionId as string,
         exceptional: e.payload.exceptional as boolean,
       }))
   }

   export function mapResolutions(events: Event[]): RecalibrationResolution[] {
     return events
       .filter(e => e.kind === 'RecalibrationPromptResolved')
       .map(e => ({
         resolution: e.payload.resolution as RecalibrationResolution['resolution'],
         resolvedAt: e.createdAt,
       }))
   }

   export function findRoadmap(events: Event[]): RoadmapInput | null {
     const roadmapEvents = events.filter(e => e.kind === 'RoadmapCreated' || e.kind === 'RoadmapReplanned')
     if (roadmapEvents.length === 0) return null
     const payload = roadmapEvents[roadmapEvents.length - 1].payload as unknown as RoadmapCreatedPayload
     return {
       startDate: payload.startDate,
       deadline: payload.deadline,
       weeks: payload.weeks,
       weeklyHours: payload.weeklyHours,
       slots: payload.slots,
     }
   }
   ```

3. **Create `apps/app/src/progress/useCalibration.ts`:** Uses shared mapper.

   ```typescript
   import { useLiveQuery } from 'dexie-react-hooks'
   import { useEventStore } from '../events/useEventStore'
   import { computeCalibration } from '@study-tracker/progress'
   import type { CalibrationState } from '@study-tracker/progress'
   import { mapSessions, mapExceptionalTags, mapResolutions } from './mapEvents'

   export function useCalibrationState(): CalibrationState | null {
     const eventStore = useEventStore()

     return useLiveQuery(async () => {
       const events = await eventStore.getAll()
       return computeCalibration(
         mapSessions(events),
         mapExceptionalTags(events),
         mapResolutions(events),
       )
     }, [eventStore]) ?? null
   }
   ```

4. **Create `apps/app/src/progress/useProgress.ts`:** Uses shared mapper.

   ```typescript
   import { useLiveQuery } from 'dexie-react-hooks'
   import { useEventStore } from '../events/useEventStore'
   import { computeProgress } from '@study-tracker/progress'
   import type { ProgressSnapshot, CalibrationState } from '@study-tracker/progress'
   import { mapSessions, findRoadmap } from './mapEvents'
   import { format } from 'date-fns'

   export function useProgressSnapshot(calibration: CalibrationState | null): ProgressSnapshot | null {
     const eventStore = useEventStore()
     const today = format(new Date(), 'yyyy-MM-dd')

     return useLiveQuery(async () => {
       if (!calibration) return null
       const events = await eventStore.getAll()
       const roadmap = findRoadmap(events)
       if (!roadmap) return null
       return computeProgress(mapSessions(events), roadmap, calibration, today)
     }, [eventStore, calibration, today]) ?? null
   }
   ```

5. **Create `apps/app/src/progress/usePromptDetail.ts`:** Uses shared mapper. Consumed by Plan B's recalibration modal.

   ```typescript
   import { useLiveQuery } from 'dexie-react-hooks'
   import { useEventStore } from '../events/useEventStore'
   import { getPromptDetail } from '@study-tracker/progress'
   import type { PromptDetail, CalibrationState } from '@study-tracker/progress'
   import { mapSessions } from './mapEvents'

   export function usePromptDetail(calibration: CalibrationState | null): PromptDetail | null {
     const eventStore = useEventStore()

     return useLiveQuery(async () => {
       if (!calibration?.promptNeeded) return null
       const events = await eventStore.getAll()
       const breakpoints = calibration.trend.phases.map(p => p.startSessionIndex)
       return getPromptDetail(mapSessions(events), breakpoints)
     }, [eventStore, calibration]) ?? null
   }
   ```

6. **Create `apps/app/src/progress/index.ts`:**

   ```typescript
   export { useCalibrationState } from './useCalibration'
   export { useProgressSnapshot } from './useProgress'
   export { usePromptDetail } from './usePromptDetail'
   export { mapSessions, mapExceptionalTags, mapResolutions, findRoadmap } from './mapEvents'
   ```

5. **Update `apps/app/src/events/ProgressEngine.ts`:** Keep existing functions for backward compatibility (Home.tsx still uses them until Plan B). Add a deprecation comment pointing to the new package.

   Add at top of file:
   ```typescript
   // Deprecated: use @study-tracker/progress instead.
   // These functions are kept for backward compat until Plan B migrates Home.tsx.
   ```

#### Tests

- No new unit tests in this phase — the hooks are thin wrappers.
- Verify typecheck passes: `pnpm typecheck`

#### Verification (DONE — run after implementation)

```bash
pnpm typecheck   # passes across all packages
pnpm --filter progress test   # all pass
pnpm --filter app test   # existing tests still pass
grep "useCalibrationState" apps/app/src/progress/useCalibration.ts   # exists
grep "useProgressSnapshot" apps/app/src/progress/useProgress.ts   # exists
grep "usePromptDetail" apps/app/src/progress/usePromptDetail.ts   # exists
grep "mapSessions" apps/app/src/progress/mapEvents.ts   # shared mapper exists
```

#### Rollback

`git revert <commit-sha>`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

## Open questions

### OQ-01: GP CI calibration below 95%

**Why deferred:** The parameter sweep showed GP CI coverage at ~53% (raw) for extrapolation, inflated to ~80% with 1.5× factor. True 95% coverage on extrapolation may require a different kernel or a bootstrap approach.

**Triggers needing resolution:** If users report the projected finish date range as unreliable (too narrow too often). Not urgent for v1 — the visual CI band is "honest" in that it widens, just not wide enough to be statistically calibrated.

**Owner / resolution path:** Review after collecting real user data. May increase inflation factor or switch to bootstrap CI.

**Cross-ref:** Affects D-07, D-15.

### ~~OQ-02: Event mapping boilerplate in hooks~~ — RESOLVED

Resolved in Phase 7: shared mapper at `apps/app/src/progress/mapEvents.ts` is used by all three hooks (`useCalibrationState`, `useProgressSnapshot`, `usePromptDetail`). No duplication.

## Out of scope

- **UI integration (Home page, BurnUpChart, recalibration prompt, session tagging)** — covered in Plan B. This plan builds the pure algorithm package only.
- **Manual log form updates (time-of-day chips, estimated duration)** — covered in Plan B.
- **ReplanEngine** — issue #010, depends on this plan's output.
- **WeeklyNarrativeService** — issue #011, consumes ProgressSnapshot.
- **E2E tests** — Plan B covers integration testing with the React UI.

## References

- Issue #009: `issues/009-progress-engine-and-pace-calibration.md`
- PRD: `prd/PRD-study-tracker-web.md`
- Python reference implementation: `issues/images/hyperparam_sweep.py`
- Hyperparameter sweep results: `issues/images/cusum_sweep.png`, `kalman_sweep.png`, `gp_sweep.png`
- Best-params visualizations: `issues/images/best_params_*.png`
- Burn-up chart design: `issues/images/expectedDesign/burnupchart.png`
- Design screens: `design/screens.html` (Sections C, E, F)
- Existing architecture: `.claude/rules/eventstore-architecture.md`, `.claude/rules/progress-engine.md`
- Dexie test patterns: `.claude/rules/dexie-test-setup.md`
- Session types: `apps/app/src/session/types.ts`
- Sync types (RoadmapCreatedPayload): `apps/app/src/sync/types.ts`
