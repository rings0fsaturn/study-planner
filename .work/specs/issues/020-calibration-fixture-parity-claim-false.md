---
title: "computeCalibration TS/Python \"parity\" fixture actually encodes Python's overridden output, not TS's"
type: AFK
blocked_by: []
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md` · CLAUDE.md directive: "Keep the two implementations
behaviorally aligned." · Found in: `.work/plans/active/2026-07-03 third-review-report-work/research/01-app-architecture-and-data-flow.md`
§3.5 and §5 finding #2 (architecture/research audit, 2026-07-03).

## What's wrong

The repo maintains a cross-language fixture-parity harness to prove `@study-tracker/progress`
(TS) and `py_progress` (Python) compute identical results: `scripts/fixture-export/progress-cases.ts`
runs each TS function and writes golden `*.expected.json` files under
`tests/fixtures/pillar-a/progress/`; `packages/py-progress/tests/test_fixtures.py::test_fixture_parity`
replays the matching `*.input.json` through the Python function and asserts numeric
equality (`rel_tol=abs_tol=1e-6`) against the checked-in `expected.json`.

For every function **except** `computeCalibration`, this genuinely holds — verified for
`bayesian` (pre-override), `cusum`, `gp`, `kalman`, `streak`, `trend`, and the burn-up/verdict
math inside `computeProgress`.

**For `computeCalibration` specifically, the checked-in fixture does not represent TS's
actual output.** This was verified empirically (2026-07-03), not just by code inspection:

1. The checked-in file
   `tests/fixtures/pillar-a/progress/compute-calibration-excludes-exceptional.expected.json`
   contains `"globalMultiplier": 0.9255084562624987` and a `"nextSessionForecast": null` key.
2. Regenerating the golden fixture live by actually running the TS exporter
   (`pnpm --filter @study-tracker/progress exec vitest run --config vitest.fixture-export.config.ts`)
   produces `"globalMultiplier": 1` **exactly** — mathematically required, since the
   fixture's 7 input sessions all have `activeMinutes === plannedMinutes`, so
   `updatePosterior` leaves the Bayesian posterior mean unchanged at the prior — and
   produces **no `nextSessionForecast` key at all**, because TS's `packages/progress/src/calibration.ts`
   never computes one.
3. The regeneration was reverted immediately (`git checkout -- tests/fixtures/pillar-a/`,
   confirmed clean via `git status --porcelain`) — no working-tree changes were left from
   this investigation.

**Root cause**: the live production calibration endpoint (`POST /v1/calibration`) doesn't
return the plain Bayesian result — `py_progress.compute_calibration()` computes it, then
*overwrites* `globalMultiplier`/`globalPosterior.variance` with
`production_calibrator()`'s output (the `enriched_shrink`/dual-prior model,
`packages/py-progress/src/py_progress/enriched.py`) and adds `nextSessionForecast`. At some
point, the checked-in `expected.json` fixture was updated to match this overridden
production behavior rather than TS's plain-Bayesian behavior — meaning the
`test_fixture_parity` test currently passes **because the fixture was changed to match
Python's divergent output**, not because TS and Python agree. `roleMultipliers`, Kalman
`trend`, and CUSUM `promptNeeded` are untouched by the enriched override and remain
genuinely identical between the two languages.

## Why this matters

The whole point of the fixture-parity harness is to catch TS/Python drift automatically. As
currently checked in, `test_fixture_parity`'s `computeCalibration` case cannot catch a real
regression in either implementation's *plain calibration* math — it's silently asserting
against enriched-model output instead. Anyone reading the test suite (including future
agents) would reasonably believe "TS and Python compute the same calibration," which is
false for this one function, and the test gives false confidence rather than surfacing that.

Secondary, lower-priority divergence found in the same investigation: `projectFinish`'s TS
shape (`{finishDate, confidenceInterval, basis:'gp'|'analytic', provisional:true}`, with a
`COLD_START_N=5` analytic fallback) doesn't match Python's `_find_projected_finish`
(`{finishDate, confidenceInterval}` only, no fallback) — low-impact only because the
`/v1/progress` endpoint that would exercise it has zero callers in the app (see issue #021).

## What to build

Pick one of two honest fixes — don't just leave the mismatch:

**Option A — split the fixture into two cases.** Keep a `compute-calibration-*` fixture that
genuinely asserts TS-plain vs. Python-plain parity (both computing only the Bayesian
posterior, no enriched override), and add a **separate**, clearly-named fixture/test (e.g.
`compute-calibration-with-enriched-override`) that documents Python's production behavior
as Python-only — with no TS equivalent expected, since `enriched_shrink` doesn't exist in
TS. This keeps the parity claim honest for what's actually shared, and makes the
Python-only override explicit rather than silently baked into a "parity" fixture's name.

**Option B — rename/re-scope the existing test.** If splitting is too invasive, at minimum
rename `test_fixture_parity`'s calibration case (or add a comment directly on it) to state
plainly that it validates Python's *production* calibration output including the enriched
override, not cross-language parity, and stop implying TS was ever expected to match it.

Either way, decide whether `nextSessionForecast` should be added to the TS implementation
for real parity, or explicitly documented as Python-only (it currently isn't rendered
anywhere in the app's UI regardless — see `.work/plans/active/2026-07-03 third-review-report-work/research/01-app-architecture-and-data-flow.md`
§3.2).

## Acceptance criteria

- [ ] The fixture-parity test suite no longer implies `computeCalibration` has verified
      cross-language parity when it doesn't — either by splitting fixtures (Option A) or by
      renaming/documenting the existing test's actual scope (Option B).
- [ ] A clear code comment or test name states which fields are Python-only
      (`globalMultiplier`/`globalPosterior.variance` under the enriched override,
      `nextSessionForecast`) versus genuinely shared (`roleMultipliers`, `trend`,
      `promptNeeded`).
- [ ] `uv run pytest packages/py-progress/tests` passes with the updated test(s).
- [ ] `pnpm --filter @study-tracker/progress test` passes.
- [ ] No unrelated fixture files are modified (only the calibration-related ones this issue
      is about).

## Notes

**Severity: Medium.** Doesn't affect production correctness today — the enriched override
is the intended live behavior (see `.work/STATUS.md`'s A6-calibration entry) — but it's a
test-integrity issue that could mask a real future regression in the plain-Bayesian math
that both languages are supposed to share, and it misrepresents what "parity" means to
anyone maintaining this suite going forward.
