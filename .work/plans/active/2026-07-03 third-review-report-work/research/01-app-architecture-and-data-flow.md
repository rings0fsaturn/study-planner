---
title: App Architecture & Data Flow — Pages, Engines, TS-vs-Python
status: durable reference (third-review-report-work research stage 1)
last_updated: 2026-07-03
scope: >
  Every route/page in the React SPA, every engine (pure-TS deep modules and the
  TS-vs-Python mirrored pairs), the exact data flowing through each, and — for the
  mirrored engines — which implementation is actually live in production. Built for the
  M.Tech 3rd-review report's system-architecture chapter. Read-only investigation; no
  code was changed while producing this document (one empirical fixture-regeneration
  check was performed and fully reverted — see §5.4).
sources: >
  Six parallel research-agent traces (pages; progress/calibration engine; roadmap engine;
  EventStore/SyncEngine/SessionLifecycle/Onboarding/AuthGate; plus two direct
  grep/read verifications by the orchestrating session) synthesized into this single doc.
---

# App Architecture & Data Flow

## 0. Executive Summary — what's actually live

The repo ships **two parallel implementations** for two of its four core engines (progress-analytics
and roadmap-generation), per `CLAUDE.md`'s "keep the two implementations behaviorally aligned"
directive. Tracing actual call sites (not just what exists) shows the live/dead split is **not** a
clean "TS for X, Python for Y" story — it varies capability-by-capability, and two of the four
Python-side integration points are dead code with zero callers from the app:

| Capability | Live implementation | Python counterpart status |
|---|---|---|
| Bayesian pace calibration + `enriched_shrink` dual-prior override | **HTTP → Python** (`POST /v1/calibration`) | This IS the Python path — no TS equivalent for `enriched_shrink` exists |
| CUSUM change-point detection | **HTTP → Python** (same call) | same |
| Kalman trend / phase segmentation | **HTTP → Python** (same call) | same |
| GP burn-up projection, finish-date ETA, streak, weekly stats | **Client-side TS**, direct import | `POST /v1/progress` exists, fully built, **zero callers in the app** — dead endpoint |
| Regime-shift "prompt detail" | **Client-side TS** | `POST /v1/calibration/prompt-detail` exists, **zero callers** — dead endpoint |
| Material ledger, daily activity, booking/slot-status derivation | **Client-side TS only** | **No Python mirror exists at all** for these — never intended to be server-side |
| Roadmap generation & replan ("booking" system: `generateBookings`) | **Client-side TS only, no Python port** | Not ported — the Python roadmap package mirrors only the *legacy* system (see next row) |
| Roadmap "packed-slot" system (`generateRoadmap`/`regenerateRoadmap`) + `/v1/roadmap/regenerate` HTTP seam | **Fully built and unit-tested on both sides — zero live callers** | Orphaned infrastructure from a superseded design |
| EventStore, SyncEngine, SessionLifecycle, Onboarding wizard, AuthGate | **Pure TS, no Python mirror was ever planned** | N/A |

Three findings below are load-bearing enough to state up front, because they contradict either a
project doc or an implicit assumption a reviewer would otherwise make:

1. **Session-runtime events never reach the cloud.** `SessionStarted/Paused/Resumed/Abandoned` and
   timer-completed `SessionLogged` events are appended straight to the local Dexie `events` table by
   `SessionLifecycle`, bypassing `sync_queue` entirely — see §4.3. This contradicts a design-intent
   comment in the code itself.
2. **The TS/Python "behavioral parity" claim is false for one function.** `computeCalibration`'s
   checked-in fixture reflects Python's `enriched_shrink`/dual-prior override output, not TS's plain
   Bayesian output — see §3.5. Every other shared function (Bayesian pre-override, CUSUM, Kalman, GP,
   streak) does have genuine, empirically-verified numeric parity via the same harness.
3. **The Python-routed roadmap-regenerate seam described in `.work/STATUS.md` as "infra-ready" has no
   live caller.** The shipped Replan UI uses a different, TS-only regeneration path — see §2.2.

---

## 1. Routing, Providers, and Pages

### 1.1 Provider nesting (`apps/app/src/App.tsx:200-217`)

```
<BrowserRouter basename="/study">
  <AuthProvider>                    # auth/AuthProvider.tsx — { user, session, loading, recoveryMode, signIn/signUp/signOut/resetPassword/updatePassword }
    <EventStoreRouter>              # wraps EventStoreProvider — { eventStore, ready }, keyed on user.id
      {DEV && <DevSeeder />}
      <SyncRouter>                  # wraps SyncProvider — only mounted once user+ready+eventStore all truthy
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </SyncRouter>
    </EventStoreRouter>
  </AuthProvider>
</BrowserRouter>
```

`SyncRouter` renders bare children (no `SyncProvider`) until auth + EventStore are both ready — **any
page calling `useSync()` before that point throws.** `MetadataFetcherProvider` and `OnboardingProvider`
are mounted only inside the `/onboarding/*` subtree.

### 1.2 Full route table

| Path | Component | Guards |
|---|---|---|
| `/` | `RootRedirect` | none — routes to `/home` or `/sign-in` once auth resolves |
| `/sign-in`, `/sign-up` | `SignIn`, `SignUp` | `PublicRouteWithAuthCheck` (bounces to `/home` if already authed) |
| `/auth-confirmed` | `AuthConfirmed` | none |
| `/reset-password` | `ResetPassword` | none — dual-mode (request-link / set-new-password) driven by `recoveryMode` |
| `/home`, `/session`, `/log`, `/week`, `/roadmap`, `/roadmaps`, `/replan`, `/settings` | `Home`, `Session`, `Log`, `Week`, `Roadmap`, `Roadmaps`, `Replan`, `Settings` | `ProtectedRoute` → `RequireOnboarding` → `AppShell` |
| `/onboarding` (index) | redirects to `/onboarding/1` | `ProtectedRoute` → `OnboardingGate` → `MetadataFetcherProvider` → `OnboardingProvider` → `OnboardingLayout` |
| `/onboarding/1..4`, `/onboarding/3/preview` | `Step1Deadline`…`Step4Confirm`, `Step3Preview` | + per-step `CheckpointGate` |
| `*` | `Navigate to="/"` | none |

Guards: `ProtectedRoute` (auth) → `RequireOnboarding` (redirects to onboarding if no `OnboardingCompleted`
event) is the *inverse* of `OnboardingGate` (redirects an already-onboarded user away from onboarding
**unless** `?new=1` / `location.state.newRoadmap` — latched via a `useRef` so it survives internal wizard
navigation, letting a returning user re-enter the wizard to plan their *next* roadmap). `CheckpointGate`
enforces per-step prerequisites (`STEP_PREREQS`), always redirecting to the earliest unmet step.

**Dead code found:** `pages/StudyPlaceholder.tsx` is not imported anywhere in the route table or
elsewhere — a leftover pre-auth design-system demo page. `SignIn.tsx` links to `/terms` and `/privacy`,
neither of which is a registered route (falls through to the catch-all).

### 1.3 Per-page data flow (condensed)

| Page | Renders | Key engines/hooks called | IN | OUT (events / navigation) |
|---|---|---|---|---|
| `AuthConfirmed` | Static confirmation card | — | — | — |
| `Home` | Dashboard: banners, up-next card, streak, stat tiles, recent activity | `useCalibrationState/useProgressSnapshot/usePromptDetail` (progress engine), `findActiveRoadmap`, `deriveTodaySessionPlan`, `deriveRoadmapEndedState` | all events (liveQuery), calibration state (HTTP), `activeSession` record | `RecalibrationPromptResolved`, `SessionTaggedExceptional`; nav to `/session`,`/log`,`/replan` |
| `Log` | Manual past-session log form | `useSync().logEvent` | form fields | `SessionLogged` (`source:'manual'`), optional `SessionTaggedExceptional`; nav `/home` |
| `Replan` | 3-lever adjust-plan screen (extend deadline / hours-per-day+days / shorten-drop materials) | `buildMaterialLedger`, `calibrationDenominator`, `projectFinish` (client TS), `deriveRoadmapLifecycle`, `commitReplan` | all events → memoized ledger + two client-computed finish projections | `commitReplan(...)` → `RoadmapReplanned` + rebooked `SessionBooked`s (TS-local, see §2.2); nav `/roadmap` |
| `ResetPassword` | Request-link / set-new-password / success views | `useAuth` | URL hash error parsing | `resetPassword(email)` / `updatePassword(password)` |
| `Roadmap` | Thin wrapper around `RoadmapCalendar` | — | `?roadmap=<id>` query param | delegated to `RoadmapCalendar` |
| `Roadmaps` | Roadmap lifecycle dashboard: active hero, next draft, history | `deriveRoadmapDraft`, `deriveRoadmapLifecycle`, `resolveRoadmap`, `summarizeRoadmapProgress` | all events, `onboardingDraft` table | `resolveRoadmap` → `RoadmapMarkedComplete`/`Abandoned`; direct Dexie `onboardingDraft.delete(1)` (bypasses sync); nav to onboarding `?new=1` |
| `Session` | Full session runtime UI (pre-session setup → active/YouTube layout → overlays) | `SessionLifecycle` (state machine), `NotificationStrategy`, `YouTubePlayerAdapter`, `deriveTodaySessionPlan` | `location.state: SessionSlotData`, all events (initial plan derivation) | `SessionBooked` (ad-hoc), `SessionTaggedExceptional`; session-completion events emitted by `SessionLifecycle` itself (§4.3); nav `/home` |
| `Settings` | Static "coming soon" | — | — | — |
| `SignIn`/`SignUp` | Auth forms | `useAuth` | credentials | `signIn`/`signUp`; nav `/home` (sign-in only — sign-up requires email confirmation first) |
| `StudyPlaceholder` | **Dead — unmounted, not in route table** | — | — | — |
| `Week` | Weekly progress view: verdict banner, stat tiles, `DailyMinutesChart`, `BurnUpChart` | `useCalibrationState`, `useProgressSnapshot(calibration, referenceDate)` | `?w=<n>` query param selects historical week | none (pure read); nav `/replan` |

### 1.4 Onboarding — steps, gate, and where completion actually happens

| Step | File | Collects | Gate prereq |
|---|---|---|---|
| 1 | `Step1Deadline.tsx` | Deadline (chip presets or manual), purpose | none |
| 2 | `Step2Hours.tsx` | Weekly hours (chip presets, auto-split 60/40 weekday/weekend or manual), study days | `deadline !== null` |
| 3 | `Step3Materials.tsx` | Materials via URL paste (`url-classifier.ts` → YouTube video/playlist/article/manual) or manual entry, role assignment | study days + hours must sum correctly |
| 3/preview | `Step3Preview.tsx` | Calls `generateBookings()` (roadmap-engine, client-side) → calendar preview + capacity warnings. **This is where commit actually happens** (below) | inherits step-3 gating |
| 4 | `Step4Confirm.tsx` | Read-only summary of already-persisted events. **Emits nothing itself** | `materials.length >= 1` |

**Documentation drift found:** `.claude/rules/onboarding-architecture.md` states *"Step4Confirm emits
three events: `OnboardingCompleted`, `MaterialAdded`, `RoadmapCreated`."* The actual code has moved
all of that (plus `SessionBooked`) into `Step3Preview.handleCommit()` (`onboarding/steps/Step3Preview.tsx:156-224`):

1. `MaterialAdded` per committable material.
2. One `RoadmapCreated` (custom `createdAt` = `roadmapCreatedAt`, the roadmap's lifecycle identity key).
3. One `SessionBooked` per generated booking.
4. `OnboardingCompleted` (`{}` payload) — only if not already emitted (idempotent across repeat "plan
   next roadmap" flows).
5. Clear `onboardingDraft` table (direct Dexie write, bypasses sync).
6. Navigate to `/onboarding/4` (first-time) or straight to `/roadmaps` (returning user planning their
   Nth roadmap — `Step4Confirm` is a first-time-only screen).

A guard at the top of `handleCommit` aborts (navigating straight to `/roadmaps` without committing) if
`newRoadmapMode && hasCompletedOnboarding && hasActiveRoadmap` — prevents starting a second roadmap
while one is already active.

**Reading order for a new contributor:** `App.tsx` → the three context providers → `SignIn`/`SignUp`
(simplest) → `OnboardingProvider` + the four `steps/*` in order → `Home.tsx` (busiest orchestrator,
touches nearly every engine) → `Session.tsx` (most complex state machine) → `Week.tsx`/`Replan.tsx`
(progress-engine consumers) → `Roadmaps.tsx`/`Roadmap.tsx` (lifecycle management).

---

## 2. Roadmap Engine — two parallel systems, only one live

### 2.1 The split

| System | TS API | Python mirror | Live app usage |
|---|---|---|---|
| **Booking engine (current)** | `generateBookings`, `suggestMaterialForBooking` (`packages/roadmap-engine/src/roadmap-engine.ts:159-189`) | **None — never ported, no HTTP exposure at all** | **This is what onboarding and Replan actually run**, 100% client-side |
| **Packed-slot engine (legacy, `@deprecated`)** | `generateRoadmap`, `regenerateRoadmap`, `addMaterialToRoadmap`, `removeMaterialFromRoadmap` | `packages/py-roadmap-engine/src/py_roadmap_engine/engine.py` — full parity, exposed over HTTP | **Reachable only via `replanRoadmap.ts`, which has zero callers in the live app** |

The "Material ↔ session decoupling redesign" (`.work/STATUS.md`) replaced the packed-slot roadmap with
the booking model and left the HTTP seam orphaned. `.work/STATUS.md`'s "Python-routed replanRoadmap
seam done" is accurate as a description of tested infrastructure — it is simply not wired to any live UI.

### 2.2 Confirmed call chains

- **Onboarding-time generation** (100% TS-local): `Step3Preview.tsx:116-119` calls `generateBookings(bookingInput)` in a `useMemo`; on commit, the result is written straight to local events (no network call anywhere in this file).
- **Replan-time regeneration, live path**: `pages/Replan.tsx:317` → `commitReplan()` (`roadmap/replan/commitReplan.ts`) → imports and calls `generateBookings` directly (`commitReplan.ts:115`) — 100% client-side, emits `RoadmapReplanned` then rebooks locally.
- **Replan-time regeneration, orphaned path**: `roadmap/replan/replanRoadmap.ts:69` posts to `/v1/roadmap/regenerate` via `postRoadmapRegenerate` (`intelligenceClient.ts:110-150`), with an *offline fallback* to the deprecated TS `regenerateRoadmap` if the HTTP call fails. Repo-wide grep confirms `replanRoadmap`/`postRoadmapRegenerate`/`mapToRegenerateRequest` are referenced only by their own definitions and their own `.test.ts` files — no page/hook/component imports them.
- **Slot/booking-status derivation, live**: `deriveBookingsForRoadmap` (`apps/app/src/progress/mapEvents.ts:215-224`) wraps `deriveBookingStatuses` (`@study-tracker/progress`) — called from `RoadmapCalendar.tsx`, `commitReplan.ts`, `sessionPlanning.ts`. The legacy `deriveSlotStatuses` (`@deprecated`) is used only inside `mapToRegenerateRequest.ts` — itself only reachable from the dead `replanRoadmap.ts` path.
- **Add/remove material, live**: no dedicated engine function — handled by emitting/clearing `SessionBooked`/`BookingCleared` events and re-running `generateBookings` (`commitReplan.ts:91-125`). The legacy `addMaterialToRoadmap`/`removeMaterialFromRoadmap` have no live callers.
- **Role inference** (`anchor`/`foundation`/`practice`): `inferRole` (`roadmap-engine.ts:863-886`, config-driven rules in `constants.ts:42-46`) has its **single live call site** at `onboarding/components/MaterialRow.tsx:28-31`, re-inferring live as the user types during onboarding Step 3 (unless manually overridden). Generation-time only — once `MaterialAdded` is emitted, `role` is frozen; no edit-time re-inference exists anywhere in the app.

### 2.3 Data structures — TS vs Python

Field names are identical (Python intentionally mirrors TS camelCase) for every type the Python side
actually has: `Material`, `RoadmapInput`, `Slot`, `RoadmapWeek`, `Warning`, `CapacityCheck`,
`RoadmapOutput`, `Pin`. **The one real divergence**: `Booking`/`BookingLayoutInput` (the types behind
`generateBookings` — i.e., the system that's actually live) were **never added to
`py_roadmap_engine/types.py`** — the Python package is a faithful port of the deprecated packed-slot
API only.

### 2.4 `/v1/roadmap/regenerate` contract (built, tested, unused)

```python
# services/intelligence/app/schemas/roadmap.py
class RoadmapGenerateRequest(ApiModel):
    materials: list[Material]; weeks: int; startDate: str
    selectedStudyDays: list[DayOfWeek]; weekdayHours: float; weekendHours: float

class Pin(ApiModel):
    weekIndex: int; dayOfWeek: DayOfWeek; materialId: str | None; sessionTitle: str | None
    plannedMinutes: float; reason: Literal["completed", "today", "user-edited"]

class RoadmapRegenerateRequest(ApiModel):
    input: RoadmapGenerateRequest
    pins: list[Pin] = []
```
Mounted at `POST /v1/roadmap/regenerate` under the same `require_user` + `rate_limit_user` dependency
chain as calibration (see §3.6). The TS mapper (`mapToRegenerateRequest.ts:164-218`) builds this shape
field-for-field correctly — the contract works, it's simply never invoked live.

---

## 3. Progress / Calibration Engine — a genuinely split architecture

This is not "TS vs Python," it's "stateful model-fitting → Python; derive-from-local-events → TS,"
decided per capability:

### 3.1 Live call chains

**Calibration (Bayesian + CUSUM + Kalman + enriched_shrink), HTTP → Python:**
`progress/useCalibration.ts:64` → `postCalibration()` (`lib/intelligenceClient.ts:76`, `POST /v1/calibration`,
retry/backoff, 8s timeout, typed-error normalization) → `services/intelligence/app/routers/calibration.py:12-21`
→ `py_progress.compute_calibration()` (`packages/py-progress/src/py_progress/calibration.py:21-67`), which
runs, in order: `compute_hierarchical_model` (plain Bayesian), `detect_regime_shifts` (CUSUM),
`analyze_trend` (Kalman) — **then** overrides `globalMultiplier`/`globalPosterior.variance` with
`production_calibrator()` output (§3.5). Result is cached client-side in Dexie `calibrationCache`
table, with stale-cache fallback on network/5xx failure.

The pure-TS mirror `packages/progress/src/calibration.ts::computeCalibration` exists, is exported, but
**has zero call sites in `apps/app/src`** — dead from the live app's perspective, used only by its own
package tests and the fixture-export script.

**Progress/burn-up/GP/streak, 100% client-side TS, no HTTP call:**
`progress/useProgress.ts:24` → `computeProgress()` (`packages/progress/src/progress.ts:211-372`) directly
in-browser, internally calling `calculateStreak`/`buildStreakGrid`, `fitBurnUpGP` (RBF-kernel GP
regression, Cholesky-solved, `gp.ts:199-234`), `projectFinish` (GP-crossing with a `COLD_START_N=5`
analytic fallback), `computeVerdict`, `computeWeeklyStats`, `findUpNext`. The `calibration` object
passed in (already fetched from Python) is accepted as a parameter but **not read anywhere inside
`computeProgress`'s body** — it's plumbed through unused.

The Python mirror `py_progress.compute_progress` and its route `POST /v1/progress`
(`services/intelligence/app/routers/progress.py:12-21`) are fully built, OpenAPI-documented, and
fixture-tested — but have **zero callers anywhere in `apps/app/src`**. Dead endpoint.

**Regime-shift "prompt detail," client-side TS, HTTP twin unused:**
`progress/usePromptDetail.ts:20` calls `getPromptDetail` from `@study-tracker/progress` directly. The
matching `POST /v1/calibration/prompt-detail` (`routers/calibration.py:24-28`, backed by
`py_progress.get_prompt_detail`) is fully wired server-side but has no caller. Dead endpoint.

**Material ledger / daily activity / booking-status derivation — TS-only, no Python file exists:**
Confirmed via directory listing: `packages/py-progress/src/py_progress/` contains no
`materialLedger.py`, `dailyActivity.py`, `deriveBookingStatuses.py`, `deriveSlotStatuses.py`, or
`calibrationDenominator.py`. Live call sites: `buildMaterialLedger` in `mapEvents.ts:128`,
`roadmapProgress.ts:83`, `sessionPlanning.ts:236`, `Replan.tsx:169`, `RoadmapCalendar.tsx`;
`buildDailyActivity` in `sessionPlanning.ts:100,263`; `deriveBookingStatuses` in `RoadmapCalendar.tsx`.

### 3.2 `POST /v1/calibration` — request/response shapes

Request (`useCalibration.ts:32-49`, validated by `services/intelligence/app/schemas/progress.py:59-63`):

```ts
{
  sessions: SessionEvent[],       // date, source('active'|'manual'), plannedMinutes?, activeMinutes?,
                                   // duration, materialRole?, startedAt?, sessionId?
  exceptionalTags: { sessionId: string, exceptional: boolean }[],
  resolutions: { resolution: 'replan'|'acknowledged'|'temporary', resolvedAt: string }[],
  nextContext: {                  // present only when an active roadmap + up-next slot exist
    date, startedAt, materialRole,
    session_index?,
    planned_horizon: { deadline, planned_total_sessions }
  } | null
}
```

Response (`CalibrationStatePayload`, `schemas/progress.py:127-134`):

```ts
{
  globalMultiplier: number,       // enriched_shrink/dual-prior fit, NOT plain Bayesian mean
  globalPosterior: { mean, variance, sessionCount },
  roleMultipliers: Record<'anchor'|'foundation'|'practice', { multiplier, confidence, sessionCount }>,
  trend: { phases: Phase[], currentPhase: Phase|null, projectionSlope, projectionUncertainty },
  promptNeeded: boolean,
  insightsByContext: { role, timeOfDay, multiplier, sessionCount, label }[],
  nextSessionForecast: number | null   // present only when nextContext was supplied — NOT rendered anywhere in the UI (dead field client-side)
}
```

The app casts this response straight to `CalibrationState` with **no runtime schema validation** —
the contract is enforced only by hand-kept type parity between `packages/progress/src/types.ts` and
`packages/py-progress/src/py_progress/types.py`.

### 3.3 Numeric constants — genuinely identical

`packages/progress/src/config.ts` and `packages/py-progress/src/py_progress/config.py` are byte-identical:
`BAYESIAN_PRIOR_MEAN=1.0`, `BAYESIAN_PRIOR_VARIANCE=0.1`, `MIN_SESSIONS_PER_BUCKET=3`,
`CUSUM_SLACK_FACTOR=0.5`, `CUSUM_THRESHOLD_FACTOR=4.5`, `KALMAN_LEVEL_NOISE=0.01`,
`KALMAN_SLOPE_NOISE=0.0001`, `GP_LENGTH_SCALE=7.0`, `GP_NOISE_RATIO=0.20`,
`GP_EXTRAPOLATION_CI_INFLATION=1.5`, `GP_EXTRAPOLATION_DAYS=14`.

### 3.4 The fixture-parity harness — and where it genuinely holds

`scripts/fixture-export/progress-cases.ts` runs the TS functions and writes golden JSON to
`tests/fixtures/pillar-a/progress/*.{input,expected}.json`; `packages/py-progress/tests/test_fixtures.py`
(`test_fixture_parity`) replays each input through Python and asserts numeric equality
(`rel_tol=abs_tol=1e-6`). For `bayesian` (pre-override), `cusum`, `gp`, `kalman`, `streak`, `trend`, and
the burn-up/verdict math inside `computeProgress`, this is genuine, verified line-for-line parity.

### 3.5 Where parity breaks: `computeCalibration` (empirically verified, then reverted)

The checked-in fixture `tests/fixtures/pillar-a/progress/compute-calibration-excludes-exceptional.expected.json`
has `"globalMultiplier": 0.9255084562624987` and a `"nextSessionForecast": null` key.

This was verified empirically during this investigation: regenerating the TS golden fixture live
(`pnpm --filter @study-tracker/progress exec vitest run --config vitest.fixture-export.config.ts`)
produces `"globalMultiplier": 1` exactly (mathematically required — the fixture's 7 sessions all have
`activeMinutes === plannedMinutes`, so `updatePosterior` leaves the Bayesian mean at the prior) and
**no `nextSessionForecast` key at all** (TS's `calibration.ts` doesn't compute one). The regeneration
was reverted immediately (`git checkout -- tests/fixtures/pillar-a/`, confirmed clean).

**Conclusion**: the checked-in `expected.json` reflects Python's `production_calibrator()`-overridden
output, not TS's plain-Bayesian output as the harness's structure implies. The Python
`test_fixture_parity` test currently passes because the fixture was updated to match Python's
(divergent) production behavior — not because the two implementations agree. Only
`globalMultiplier`/`globalPosterior.variance`/`nextSessionForecast` are affected; `roleMultipliers`,
Kalman `trend`, and CUSUM `promptNeeded` are untouched by the enriched override and remain in genuine
parity.

**Correction (added 2026-07-03, after cross-referencing `.work/plans/active/2026-06-30-research-eta-model-selection/`):**
`projectFinish`'s `COLD_START_N=5` cold-start-analytic-fallback design is **not an unexplained TS-only
quirk — it is a direct, fast promotion of a validated research finding.** `packages/progress/src/projectFinish.ts`
was committed **2026-07-01** (`1d9270e feat(planner): ship booking ETA phases`), one day after the
`research-eta-model-selection` plan's **R4 phase** (2026-06-30) benchmarked and validated a
`gp_plus_analytic` composite forecaster (`research/comparison/src/research_comparison/baselines/projection.py`)
with the **exact same design**: cold-start (`sessionCount < COLD_START_N`, same constant name, same
value 5) → analytic fallback; GP-non-crossing/past-horizon → analytic rescue; otherwise GP point + CI.
R4's Holm-verified verdict (`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`, "Material/session
decoupling validation" section) is that this composite **beats the plain-GP incumbent on the small/cold-start
band only** — a qualified, not general, win — which is exactly the role it plays in `projectFinish`
(cold-start fallback layered on GP, not a GP replacement). This is a clean example of research → production
promotion, on the same footing as the `enriched_shrink`/dual-prior calibration promotion (§3.6) — see the
corrected discussion in `02-research-to-app-mapping.md` §1.

What genuinely still diverges: Python's `_find_projected_finish` (`packages/py-progress/src/py_progress/progress.py`,
last touched 2026-06-08) has **not** been updated with this composite — it remains `{finishDate,
confidenceInterval}` only, no cold-start/analytic fallback. This is a real, new TS-ahead-of-Python
divergence, distinct from the `computeCalibration` divergence in §3.5 (where Python is ahead of TS) —
low-impact only because `/v1/progress` is a dead endpoint (§3.1), so nothing live currently depends on
the Python side matching.

What's still a genuine, currently-unaddressed gap (**not** fixed by the above promotion): the
**split-conformal interval-width correction** for the GP-basis confidence interval. Every research
snapshot through 2026-06-30 (both the original A1/A3.7 evidence and the post-redesign R4 re-validation)
states conformal correction as "the coverage fix" for data-rich plans — distinct from the cold-start
composite, which addresses a different failure mode (low-data plans). `grep -rn "conformal"
packages/progress/ packages/py-progress/ apps/app/src/` returns nothing — this fix has not been ported
to either language, and the plain (uncorrected) GP interval is what ships for any plan past the
cold-start threshold. See `02-research-to-app-mapping.md` §1 for the full, corrected accounting.

### 3.6 The `enriched_shrink` / dual-prior calibrator — what's actually live

`packages/py-progress/src/py_progress/enriched.py`. `.work/STATUS.md` records this as
"production-integrated" and as the finding that "overturns the null" for Pillar-A calibration.

- **`EnrichedShrinkageCalibrator`** (`enriched.py:182-262`): fits a ridge/shrinkage-regularized
  log-linear regression of `log(activeMinutes/plannedMinutes)` against a 10-feature context vector per
  session — `intercept, anchor, practice, morning, evening, weekend, same_day_extra,
  planned_progress, deadline_urgency, recency`. Stateless — refit fresh on every calibration call, no
  persisted model state. Shrunk toward a *population prior* (`ridge=2.0`, `shrink=6.0`) rather than
  zero, so it behaves sensibly cold-start and converges to learner-specific as data accumulates.
- **What's live**: `production_calibrator()` (`enriched.py:368-375`) returns a
  `DualPriorWeightedCalibrator` — an ensemble of two `EnrichedShrinkageCalibrator`s, one seeded with a
  `REALITY_POPULATION_PRIOR` and one with a `FROZEN_POPULATION_PRIOR` (provenanced to specific
  verification-run evidence files under `research/doc/verification-runs/`), combined by
  leave-one-out-weighted log-space averaging (static `(0.6, 0.4)` weights when fewer than 2 sessions
  exist).
- **Confirmed live-path impact**: `compute_calibration` computes the plain Bayesian posterior first,
  then *overwrites* `globalMultiplier`/`globalPosterior.variance` with the dual-prior calibrator's
  output, and adds `nextSessionForecast`. `roleMultipliers`, Kalman `trend`, and CUSUM `promptNeeded`
  are **not** touched — those stay the baseline algorithm. Since `/v1/calibration` is exactly the
  endpoint the live app calls, **the enriched dual-prior calibrator is what production actually
  displays as the global pace multiplier** — not the plain Bayesian mean. TS has no equivalent; this
  model exists exclusively server-side.

### 3.7 Auth — JWT flow to the Intelligence Service

1. Client: `intelligenceClient.ts:26-30` — `supabase.auth.getSession()` → `Authorization: Bearer <access_token>` on every `/v1/*` call.
2. Server: `services/intelligence/app/security.py` — `require_user` inspects the unverified JWT header's `alg`:
   - `HS256` → verified against `SUPABASE_JWT_SECRET` env var, audience `"authenticated"`.
   - `ES256`/`RS256` → keys fetched from the Supabase project's JWKS endpoint via a cached `PyJWKClient` (10-min cache), audience `"authenticated"`, issuer `{SUPABASE_URL}/auth/v1`.
   - JWT `sub` claim → user id; missing/invalid → `401`; missing server config → `500`.
3. `rate_limit_user` — dev-only in-memory per-user token bucket (120 req/60s default), `429` on breach — explicitly documented as not distributed-safe.
4. All three `/v1/*` routers (`calibration`, `progress`, `roadmap`) share this dependency chain (`main.py:68-72`); `/health`/`/readiness` are unauthenticated.
5. Client-side: HTTP `401` → typed `CalibrationAuthError`, excluded from retry, surfaces as `useCalibrationState()` status `'auth-error'` (no stale-cache fallback for auth failures specifically).

---

## 4. Pure-TS Deep Modules (no Python mirror was ever planned)

### 4.1 EventStore — the backbone

**Dexie schema is v5** (`.claude/rules/eventstore-architecture.md` is stale at v3):

```ts
v1: { events: '++id, kind, createdAt' }
v2: { ...v1, sync_queue: '++id, kind, createdAt, retries', sync_meta: 'key' }
v3: { ...v2, onboardingDraft: 'id' }
v4: { ...v3, activeSession: 'id' }
v5: { ...v4, calibrationCache: 'key' }
```
DB name: `StudyTracker_<userId>` (per-user isolation). Event shape: `{ id?, kind, payload: Record<string,unknown>, createdAt }`.

**Public API**: `append`, `bulkAppend`, `getAll`, `query()` (liveQuery), `getMaxId`, `getEventsSince`,
`table(name)` (generic escape hatch used for `sync_queue`/`sync_meta`/`onboardingDraft`/`activeSession`),
`wipe`, `close`. `events/ProgressEngine.ts` (`totalMinutesLogged`, etc.) is explicitly deprecated in
favor of `@study-tracker/progress` + `progress/mapEvents.ts`, but still used by `Home.tsx`.

**Full event-kind catalog (18 kinds), the backbone connecting every module:**

| Kind | Emitted from | Payload (key fields) |
|---|---|---|
| `SessionStarted` | `SessionLifecycle.start()` | see `session/types.ts:63-87` |
| `SessionPaused` | `SessionLifecycle.pause()` | `types.ts:94-102` |
| `SessionResumed` | `SessionLifecycle.resume()` | `types.ts:107-111` |
| `SessionLogged` | `SessionLifecycle.logSession()` **and** `pages/Log.tsx` (manual) | `sessionId, materialId?, sessionTitle?, slotDate?, weekIndex?, plannedMinutes?, startedAt?, endedAt?, activeMinutes?, pauseCount?, totalPauseMinutes?, videoPlayTimeMinutes?, videosCompleted?, lastVideoIndex?, pomodorosCompleted?, resolution:'completed'|'trimmed'|'interrupted', bookingId?, plannedSessionMinutes?, materialPosition?, materialConsumedMinutes?, source:'active'|'manual', duration, description, date` (`types.ts:124-177`) |
| `SessionAbandoned` | `SessionLifecycle.doAbandon()` | `types.ts:191-198` |
| `SessionTaggedExceptional` | `Home.tsx`, `Session.tsx`, `Log.tsx` | `{ sessionId, exceptional }` (inline, no dedicated type) |
| `RecalibrationPromptResolved` | `Home.tsx` | `{ resolution:'replan'|'acknowledged'|'temporary', resolvedAt }` |
| `OnboardingCompleted` | `Step3Preview.tsx` | `{}` — pure gate signal |
| `MaterialAdded` | `Step3Preview.tsx` | `materialId, title, estimatedDuration, url?, kind:'youtube'|'article'|'manual', role:'anchor'|'foundation'|'practice', playlistId?, youtubeVideoId?, videos?` |
| `RoadmapCreated` | `Step3Preview.tsx` | `startDate, deadline, weeks, purpose?, selectedStudyDays, weekdayHours, weekendHours, weeklyHours, materialIds?, materialDurationOverrides?, slots?` (legacy-only field — new roadmaps omit it) |
| `RoadmapReplanned` | `roadmap/replan/commitReplan.ts` | extends `RoadmapCreatedPayload` + `roadmapCreatedAt, option?` |
| `RoadmapEdited` | `roadmap/edit/logRoadmapEdit.ts` | `roadmapCreatedAt, weekIndex, dayOfWeek, materialId, sessionTitle, plannedMinutes` |
| `RoadmapMarkedComplete` / `RoadmapMarkedAbandoned` | `roadmap/resolveRoadmap.ts` | `roadmapCreatedAt, resolvedAt, reason?` |
| `SessionBooked` | `Step3Preview.tsx`, `RoadmapCalendar.tsx`, `commitReplan.ts`, `Session.tsx` | `roadmapCreatedAt, bookingId, date, estimatedDuration, materialId?` |
| `BookingEdited` | `RoadmapCalendar.tsx` | `roadmapCreatedAt, bookingId, date?, estimatedDuration?, materialId?` |
| `BookingCleared` | `RoadmapCalendar.tsx`, `commitReplan.ts` | `roadmapCreatedAt, bookingId` |
| `MaterialProgressMarked` | `RoadmapCalendar.tsx` | `roadmapCreatedAt, materialId, markedAt, materialPosition, source:'directory'|'session-end'` |

**Known payload inconsistency**: `Step4Confirm.tsx` still reads `roadmap.slots` off the freshly-committed
`RoadmapCreatedPayload`, but `Step3Preview.handleCommit` constructs the payload **without** `slots`
(uses `materialIds` + separate `SessionBooked` events instead) — a latent inconsistency worth fixing
if that file is touched again.

### 4.2 SyncEngine — write-ahead queue + snapshot restore

**Write path**: `logEvent(kind, payload)` → `eventStore.append()` (local `events` row) → insert into
`sync_queue` → debounced `flushQueue()` (200ms). `flushQueue` maps queue rows to Supabase `events` table
records (`{ user_id, kind, payload, client_id, device_local_id, created_at }`), inserts, deletes queue
rows on success; on failure, increments `retries` and reschedules with exponential backoff
(`backoffBaseMs * 2^retries`, base 1s, max 5 retries).

**Snapshot save**: always flushes first (invariant: `snapshot.asOfRemoteId == lastPulledId`), writes a
`sync_checkpoints` row (`{ user_id, as_of_remote_id, schema_version, event_count }`) *before* uploading
the blob (never orphans an unvalidated blob), uploads `SnapshotPayload` JSON to Storage bucket
`sync-snapshots` at `${userId}/snapshot.json`.

**Snapshot restore**: same-device re-login (local events exist) skips the wipe, just flushes + dedupes +
pulls delta. Cold start (empty local DB) downloads the snapshot, validates it against the checkpoint row
(`asOfRemoteId`, `event_count`, `schemaVersion` must all match — mismatch discards and falls back to a
full `pullAndMerge()`), then `wipe()` → `bulkAppend(snapshot.events)` → pull the post-snapshot delta.

**Delta pull**: fetches remote events with `id > lastPulledId`, filters out events from this client
(`client_id === clientId`) and duplicate `SessionLogged` rows (matched by `payload.sessionId`), then
replays session-lifecycle kinds into the local `activeSession` singleton
(`SessionStarted`→create, `Paused`/`Resumed`→update status, `Logged`/`Abandoned`→delete) so a second
device sees an in-progress session reflected correctly.

**Browser lifecycle** (via shared `DurabilityHooks`): `visibilitychange` on return-to-foreground after
`>5min` hidden → `pullAndMerge()`; `pagehide` → `flushOnPageHide()` via `navigator.sendBeacon`, falling
back to `flushQueue()`.

**`SyncState`**: `{ status: 'idle'|'syncing'|'error'|'offline', lastSyncedAt, lastError, pendingCount }`
— `offline` is overlaid client-side from `navigator.onLine`, independent of the engine's own `status`.

### 4.3 SessionLifecycle — state machine, Pomodoro, YouTube ⚠️ sync gap

**States**: `idle → active ⇄ paused`, plus `walk_away` (elapsed > planned + 10min) and `recovery`
(tab reopened after >5min hidden while active). Terminal transitions (`end`/`interrupt`/walk-away
resolutions/`resolveRecovery('end_now')`) all funnel into `logSession()`, which builds the
`SessionLogged` payload (§4.1) and clears the `activeSession` Dexie singleton.

**Staleness detection** on `initialize()`: paused >12h → `stale_12h_paused`; active session's date ≠
today → `stale_midnight` (routed to `interrupt()`, not abandon); active >6h → `stale_6h` (→
`doAbandon()`).

**Pomodoro** (`pomodoro.ts`): `buildIntervals` packs `plannedMinutes` into work/break cycles (default
50min work / 10min break), no trailing break; `getPomodoroPhase` is **wall-clock based, ignoring pause
intervals** (documented behavior) — phase keeps advancing while paused.

**⚠️ Confirmed architecture gap — session events bypass cloud sync.** `Session.tsx:81-82` constructs
`SessionLifecycle` with the **raw** `eventStore` from `useEventStore()`:
```ts
const lc = new SessionLifecycle({ eventStore, /* ... */ })
```
and `SessionLifecycle.ts` only ever calls `this.eventStore.append(...)` (5 call sites: `start`, `pause`,
`resume`, `doAbandon`, `logSession`) — **never** `useSync().logEvent(...)`. Since `sync_queue` insertion
happens *only* inside `SyncEngine.logEvent()` (confirmed: `grep -rn "sync_queue"` across `apps/app/src`
shows `sync_queue` referenced only in `SyncEngine.ts` and the Dexie schema declarations), this means:

- `SessionStarted`, `SessionPaused`, `SessionResumed`, `SessionAbandoned`, and **timer-completed**
  `SessionLogged` events are written to the local `events` table but **never queued, never flushed to
  Supabase**. They exist only on the device that produced them.
- **Manually-logged sessions are fine** — `pages/Log.tsx` uses `useSync().logEvent`, which does
  correctly enqueue.
- This directly contradicts a design-intent comment at `apps/app/src/session/types.ts:233`:
  *"This record is the local source of truth for the session UI. It is NOT synced to Supabase
  directly — instead, the lifecycle events (SessionStarted, SessionPaused, etc.) flow through the sync
  pipeline, and remote devices reconstruct the active session from those events."* The comment describes
  intended behavior; the actual wiring doesn't do it.
- **Product impact**: cross-device session history is incomplete for anyone who uses the in-app timer
  (the primary flow) rather than the manual log form. `SyncEngine.test.ts` never exercises
  `SessionLifecycle` end-to-end, so this gap has no test coverage either. This is a documentation
  finding, not a fix applied here — flagged for the team to decide on.

**Session completion payload derivation** (`logSession()`): `activeMinutes = round(activeMs/60000)`;
`materialPosition` defaults to `{kind:'percent', value:100, ofTotal:100}` on `resolution:'completed'`;
`materialConsumedMinutes` converts a position delta into minutes against `materialEstimatedMinutes`,
clamped to `[0, remaining]`; `pomodorosCompleted` derived from the Pomodoro phase walk.
`videoPlayTimeMinutes` is defined in the type but **not currently populated** by `logSession()` — the
YouTube adapter tracks it (`YouTubePlayerAdapter.trackPlayTime`) but it isn't wired into the emitted
payload yet.

### 4.4 Onboarding wizard — reducer + IndexedDB draft persistence

`OnboardingProvider.tsx` — `useReducer` over `OnboardingState { deadline, purpose, weeklyHours,
weekdayHours, weekendHours, selectedStudyDays, materials, playlists, previewEdits, stepReached,
nextAdditionOrder }`. Every dispatch after first render write-throughs to Dexie
`onboardingDraft.put({id:1, state})`; on mount, `RESTORE` re-hydrates from that row, and
`recoverStuckLoading()` flips any `fetchStatus:'loading'` material/playlist left over from a
crashed/closed tab to `'error'`. Draft is cleared on successful commit (§1.4).

### 4.5 AuthGate — DI-wrapped Supabase Auth

Constructor takes a structural `AuthGateDeps` subset of the Supabase `auth` namespace, enabling
hand-written fakes in tests (per `.claude/rules/auth-testing-fakes.md`). Notable business rule at the
gate layer: `signIn()` returns `{ user: null, error: new Error('Email not confirmed') }` if
`!data.user.email_confirmed_at`, even when Supabase itself returned no error.

`AuthProvider`'s init races two paths to flip `loading → false`: the real `getSession()`/`getUser()`
promise, and a hard 500ms `setTimeout` (per `.claude/rules/auth-init-timeout.md`) — whichever fires
first wins. `recoveryMode` is driven independently by the `onAuthStateChange` event stream
(`PASSWORD_RECOVERY` → true; `USER_UPDATED`/`SIGNED_OUT` → false). `AuthProvider` has zero imports from
`events/` or `sync/` — auth is a strictly upstream concern.

### 4.6 Cross-cutting write-path asymmetry

**Onboarding and roadmap code paths route through `useSync().logEvent()`** (queued for cloud sync
immediately). **`SessionLifecycle` calls `eventStore.append()` directly** (§4.3) — this is the single
most important asymmetry in the write path for a reviewer to understand, since it means "does this
event reach the cloud" depends on which module emitted it, not on the event's `kind` alone.

---

## 5. Notable Findings Summary (for the dissertation's "current limitations" discussion)

| # | Finding | Where | Severity |
|---|---|---|---|
| 1 | Session-runtime events (`SessionStarted/Paused/Resumed/Abandoned`, timer-completed `SessionLogged`) never reach `sync_queue` — local-only, contradicts a design-intent code comment | `Session.tsx:81-82`, `SessionLifecycle.ts` | High — real cross-device data-completeness gap, no test coverage |
| 2 | `computeCalibration` TS/Python "parity" fixture actually encodes Python's overridden (`enriched_shrink`) output, not TS's plain output — the parity claim is false for this one function | `tests/fixtures/pillar-a/progress/compute-calibration-excludes-exceptional.expected.json` | Medium — doesn't affect production correctness (Python is the live path) but misrepresents test intent |
| 3 | Roadmap "packed-slot" engine + Python mirror + `/v1/roadmap/regenerate` HTTP seam: fully built and tested, zero live callers. **Corroborated, not just inferred**: `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` D1/§5c explicitly retires this "prescriptive day-by-day packing" design in favor of the booking model — the orphaning was a deliberate consequence of a documented decision, not an oversight. | `replanRoadmap.ts`, `py_roadmap_engine/`, `routers/roadmap.py`, `DECISIONS.md` D1/§5c | Low-medium — orphaned infra; maintenance/clarity cost and a `.work/STATUS.md` documentation-accuracy issue, but the underlying design choice is sound and already recorded |
| 4 | `POST /v1/progress` and `POST /v1/calibration/prompt-detail` — fully built, documented, tested; zero callers in the app | `services/intelligence/app/routers/progress.py`, `calibration.py:24-28` | Low — dead endpoints, same category as #3 |
| 5 | `pages/StudyPlaceholder.tsx` unmounted; `/terms`/`/privacy` links with no matching routes | `App.tsx`, `SignIn.tsx` | Low — dead code / broken links |
| 6 | `.claude/rules/onboarding-architecture.md` and `eventstore-architecture.md` are stale (describe Step4Confirm emitting events that actually fire from Step3Preview; describe schema v3 when live schema is v5) | rule files | Low — docs drift, easy fix |
| 7 | `Step4Confirm.tsx` reads a `roadmap.slots` field that `Step3Preview`'s commit no longer populates | `Step4Confirm.tsx:24-29`, `Step3Preview.tsx:192-202` | Low — latent inconsistency, likely dead-reads-undefined rather than a visible bug |
| 8 | Split-conformal GP-interval correction remains unpromoted (a distinct, still-open finding — see §3.5 correction above and `02-research-to-app-mapping.md` §1). The scheduling-algorithm "gap" and the ETA cold-start-composite "gap" originally listed here were **withdrawn on 2026-07-03** after cross-referencing `.work/plans/active/2026-06-30-material-session-decoupling/` and `.work/plans/active/2026-06-30-research-eta-model-selection/`: scheduling was explicitly retired by design decision (not a gap), and the ETA composite *was* promoted to production one day after validation (also not a gap). | `projectFinish.ts` (composite: promoted); `conformal` (correction: not promoted anywhere) | Low-medium — narrower and more current than originally scoped; see Doc 2 for the corrected accounting |

None of these were fixed as part of this documentation task — they're recorded here for the team to
triage, per the scope of the original request (comprehensive documentation, not remediation). **Revision
note (2026-07-03):** the original version of this document and its companion `02-research-to-app-mapping.md`
understated how current the ETA/projection research is and mischaracterized the scheduling-algorithm
comparison as an unaddressed gap — both were corrected after the user pointed out two directly relevant
plan folders (`2026-06-30-material-session-decoupling`, `2026-06-30-research-eta-model-selection`) that
the original investigation had not cross-referenced against `git log` dates. See Doc 2 for the full corrected
analysis and the four filed issues (`.work/specs/issues/019-022.md`) for what changed.
