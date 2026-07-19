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

# Roadmap calendar — detail page, history page, and Python-routed replan seam

**Slug:** `roadmap-calendar`
**Date written:** 2026-06-26
**Author:** Claude + Rohit
**Plan status:** Draft
**Upstream:** PRD `.work/specs/prd/PRD-study-tracker-web.md`; replan ticket `.work/specs/issues/010-replan-flow-with-three-options.md`; design `design/screens.html` §H/§I/K15/K16

> **Step 0 — before writing any code:** commit these planning docs verbatim (`docs(plan): add roadmap-calendar plan + verification`). Cowork cannot commit (its sandbox bricks on git lock files), so the native side must establish this baseline first; otherwise later review diffs are meaningless.
>
> **After each phase:** fill your section of `VERIFICATION.md` (files changed, commit SHA, what you did, deviations + why) and expect review. A phase is **not done** until the reviewer marks it `✅ Verified`; change requests may follow.

## TL;DR

Build the `/study/roadmap` detail page and `/study/roadmaps` history page (both are "Coming soon" stubs today). The detail page renders the active roadmap as a **month calendar grid** with status-colored session bubbles (done / pending / skipped / unplanned), month-at-a-time navigation, hover-to-expand (desktop) and click-to-open a session-detail modal; on mobile it degrades to status dots with a tap-to-open day sheet. All data is **derived from the existing event log** — no new storage. Two new terminal events (`RoadmapMarkedComplete`, `RoadmapMarkedAbandoned`) feed the history page. **Edit and Replan are stubbed but infra-ready**, including a fully-specified TypeScript **replan interface that routes to the Python intelligence service** (`POST /v1/roadmap/regenerate`).

## Context & background

The app is local-first and event-sourced. A roadmap is **not a stored record** — it is reconstructed from the event log:

- Onboarding (`apps/app/src/onboarding/steps/Step3Preview.tsx`) calls `generateRoadmap(input)` from `@study-tracker/roadmap-engine` (pure TS), flattens the result into `slots[]`, and emits one `RoadmapCreated` event (payload type `RoadmapCreatedPayload` in `apps/app/src/sync/types.ts`).
- Pages read all events via `useLiveQuery(() => eventStore.getAll())` (per-user Dexie DB) and call `findRoadmap(events)` to get the **latest** `RoadmapCreated`|`RoadmapReplanned` payload. `apps/app/src/progress/mapEvents.ts::findRoadmap` returns a `RoadmapInput`; `apps/app/src/pages/Home.tsx::findRoadmap` returns the raw `RoadmapCreatedPayload`.
- Actuals come from `SessionLogged` events; material metadata from `MaterialAdded` events; calibration-driven projection from `useProgressSnapshot` / `useCalibrationState` (which call the Python service `POST /v1/calibration` via `apps/app/src/lib/intelligenceClient.ts::postCalibration`).

**Engine duality (important):** a Python port exists — `packages/py-roadmap-engine/` exposes `generate_roadmap` / `regenerate_roadmap`, served at `POST /v1/roadmap/generate`, `POST /v1/roadmap/regenerate`, and `POST /v1/progress` (`services/intelligence/app/routers/roadmap.py`). **The frontend does not call these yet** — only `/v1/calibration` is wired. Per D-12, the deferred Replan seam is specified to route to the Python `regenerate` endpoint.

Constraints: mobile-first responsive; `BrowserRouter basename="/study"` (never put `/study` in `to` props — see rule `react-router-v7-basename`); design tokens only, no raw pixel colors (rule `form-design-spacing`); Dexie schema changes must version up (rule `dexie-schema-migration`); E2E tests are **written but not run** in this environment (write them, don't run them — see `CLAUDE.md`).

**Testing strategy (required — D-15).** Every UI phase ships a **Playwright visual walkthrough**: a spec that drives the feature one interaction at a time and captures a `page.screenshot` at each state, so when the suite is later run (it is not run here) it produces a step-by-step visual record that surfaces layout/interaction bugs the static mockup can't. The walkthrough lives in `e2e/roadmap.spec.ts` as an ordered sequence of `test.step(...)` blocks; each phase appends its steps. Steps assert behaviour (element visible, modal open/closed, month label changed, status colors applied) **and** screenshot before/after the action into `e2e/__screens__/roadmap/<NN>-<step>.png`. Use role/class selectors, not bare element selectors. Run config is `playwright test -c e2e/playwright.config.ts` (rule `playwright-config`) — author only; do not execute (environment-blocked). Unit/pure logic (status derivation, calendar model, lifecycle) is covered by Vitest as specified per phase; the Playwright walkthrough covers the *wired* behaviour end to end.

**Support docs:**

- PRD — `.work/specs/prd/PRD-study-tracker-web.md`
- Replan ticket — `.work/specs/issues/010-replan-flow-with-three-options.md`
- Design — `design/screens.html` (§H Roadmap detail, §I Roadmaps history, K15/K16 desktop)
- Roadmap engine guide — `design/algo/ROADMAP_ENGINE_GUIDE.md`
- Rules — `.claude/rules/eventstore-architecture.md`, `react-router-v7-basename.md`, `dexie-schema-migration.md`, `fetch-typed-error-normalization.md`, `onboarding-architecture.md`

## Decisions log

### D-01: Scope = detail + history this round; Edit and Replan stubbed but infra-ready

**Status:** ✅ Agreed
**Context:** `/roadmap`, `/roadmaps` are both stubs; Edit, Replan, and Mark-complete/abandon are all unbuilt and entangled.
**Decision:** Ship `/roadmap` (calendar detail) + `/roadmaps` (history) now. Edit and Replan are **stubbed but infra-ready**: reserved `/replan` route, defined event kinds (`RoadmapEdited`, `RoadmapReplanned`), exposed engine/interface seams, and visible-but-disabled affordances.
**Rationale:** Detail + history are read-mostly views over existing data plus two terminal events — a clean shippable slice. Replan needs a new `ReplanEngine`, pin semantics, and a drag/trim UI (issue 010) — its own plan.
**Alternatives considered:** Build replan now → rejected: balloons scope past the 7-phase cap. Skip history → rejected: it shares the data model and the design pairs them.
**User pushback / disagreement:** User: "edit and replan can be stubbed for now, but need to make the infra ready so those can be wired in/worked on easily."
**Reversibility:** easy — follow-up plan fills the seams.

### D-02: Per-slot status derived purely from the event log; no new "slot completed" event

**Status:** ✅ Agreed
**Context:** The calendar colors each slot done/pending/skipped, but no event records slot completion.
**Decision:** New pure helper `deriveSlotStatuses(roadmap, sessions, today)` in `packages/progress`. For each slot, match `SessionLogged` by **same calendar date AND materialId ∈ slot.candidateMaterialIds**: `done` = ≥1 match (sum actual minutes); `pending` = slot date ≥ today, no match; `skipped` = slot date < today, no match. The helper **also returns the unattributed sessions** (matched no slot) as `unplanned` entries keyed by date. Header totals continue to come from `useProgressSnapshot` (so off-plan minutes still count).
**Rationale:** Preserves the local-first derived-state model; date+material is the only signal available; degrades gracefully. Returning leftovers keeps the seam open for richer "unplanned" UI without re-deriving.
**Alternatives considered:** New `SlotCompleted` event → rejected: double-books against `SessionLogged`, fragile. Stricter many-to-one matching → deferred as refinement.
**User pushback / disagreement:** none on the rule; user expanded the UI to surface unplanned sessions as their own bubbles (D-03).
**Reversibility:** easy — pure function, fully unit-tested.

### D-03: Primary UI = month calendar grid with status-colored session bubbles

**Status:** ✅ Agreed (visual contract locked — see D-14)
**Context:** Original design (screens.html §H) used vertical week-strip cards; user prefers a calendar.
**Decision:** Replace week-strip cards and the desktop week-filter chips with a **month calendar grid**. Each day cell shows status-colored session bubbles: `done` (moss, filled), `pending` (paper + terracotta outline), `skipped` (rust, filled), `unplanned` (paper + dashed neutral border). A legend + icon/shape redundancy accompanies the color (accessibility rule).
**Rationale:** "Whole arc at a glance"; a month grid is more legible than long week strips and matches user mental model.
**Alternatives considered:** Keep week strips → rejected by user. Agenda list as primary → rejected: loses glanceability.
**User pushback / disagreement:** User: "a calendar grid for a month is easier to display in UI than strips of weeks." Flagged the mockup as a draft to refine further.
**Reversibility:** moderate — it's the page's core component.

### D-04: Interaction model — desktop hover-expand + click-to-modal; modal reuses onboarding modal structure

**Status:** ✅ Agreed
**Context:** How to reveal session detail without clutter.
**Decision:** Desktop: hovering a day cell expands it (scale + raised) to show fuller bubble labels (`pointer: fine` only). Clicking a bubble opens a **session-detail modal** built on the onboarding modal structure. Per-cell bubble cap = 3, then a `+N more` affordance opens the day-detail modal (same target as a day tap). Survey-validated (Google/Notion/+N more; Apple/Fantastical dots).
**Rationale:** Industry-standard split; reuses existing modal infra; keeps cells bounded.
**Alternatives considered:** Hover-only detail → rejected: no touch equivalent. Navigate to a detail page → rejected: heavier than a popover.
**User pushback / disagreement:** User: "we can reuse the modal logic from onboarding page."
**Reversibility:** easy.

### D-05: Month-at-a-time navigation with smooth horizontal slide

**Status:** ✅ Agreed
**Context:** Roadmaps span multiple months (sample Apr→Jun).
**Decision:** Prev/next arrows + a prominent **Today** button + month label; default to the month containing today; clamp to the roadmap's start/end months; smooth horizontal slide transition (~150–200ms); mark the deadline day.
**Rationale:** Bounded views, matches calendar conventions, degrades to mobile (swipe) cleanly.
**Alternatives considered:** Continuous multi-month scroll → rejected: tall, "where am I now" is lost.
**User pushback / disagreement:** User: "they have to click next, prev, the calendar has to smoothly slide."
**Reversibility:** easy.

### D-06: Mobile keeps the 7-column grid (dots + day bottom-sheet), not an agenda list

**Status:** ✅ Agreed
**Context:** A 7-col grid at ~360px can't fit text bubbles; touch has no hover.
**Decision:** On mobile keep the 7-col month grid; bubbles render as **colored status dots** (with a count when >1); no hover; **tapping a day opens a bottom sheet** listing that day's sessions, each row opening the session-detail modal. Swipe left/right between months.
**Rationale:** People expect a calendar to look like a calendar; dots+tap is the standard mobile-calendar pattern (Apple/Fantastical); one responsive component beats two layouts.
**Alternatives considered:** Agenda/list on mobile (Todoist) → rejected: loses the arc. Same text bubbles shrunk → rejected: illegible.
**User pushback / disagreement:** none.
**Reversibility:** moderate.

### D-07: Cell-density contract — ≤3 bubbles then "+N more"; degrade to dots when dense; legend + icon redundancy

**Status:** ✅ Agreed
**Context:** Days can hold several sessions.
**Decision:** Fix the rendering contract now: per-cell cap of 3 bubbles, overflow → `+N more` opening the day modal; below a responsive width threshold bubbles render as dots; status→(color+icon) mapping and a legend are baked into the design-tokens-driven component.
**Rationale:** Convergent pattern across all surveyed apps; it's the part we build now, so fixing it prevents the deferred edit/replan from renegotiating cell layout.
**Alternatives considered:** Unbounded bubbles → rejected: cells grow without limit.
**User pushback / disagreement:** none ("agreed").
**Reversibility:** easy.

### D-08: Mark complete / abandon = two new terminal events

**Status:** ✅ Agreed
**Context:** The detail page bottom offers "Mark roadmap complete" / "Abandon roadmap"; no events exist.
**Decision:** Add event kinds `RoadmapMarkedComplete` and `RoadmapMarkedAbandoned` (payload: `{ roadmapCreatedAt: string, resolvedAt: string, reason?: string }`, where `roadmapCreatedAt` identifies which roadmap by its `RoadmapCreated.createdAt`). Emitted from the detail page via `useSync().logEvent`. A roadmap is "active" iff its latest `RoadmapCreated`/`RoadmapReplanned` has no later matching complete/abandon event.
**Rationale:** Consistent with the existing domain-event model (PRD lists both kinds as v1 events); derivation stays pure.
**Alternatives considered:** A status field on the roadmap payload → rejected: payloads are immutable snapshots; status is derived.
**User pushback / disagreement:** none.
**Reversibility:** easy — additive event kinds.

### D-09: History page derives Active / Completed / Abandoned from the event log

**Status:** ✅ Agreed
**Context:** `/roadmaps` lists past roadmaps with outcomes and an empty state.
**Decision:** Derive three groups from the event log (Active, Completed, Abandoned) using the rule in D-08; render the empty state when there are no roadmaps; "Start a new roadmap" routes to onboarding; clicking an entry opens it as a **read-only** calendar (reuse the detail component in a read-only mode).
**Rationale:** Reuses the detail component and the same derivation; no new storage.
**Alternatives considered:** Separate archive store → rejected: event log already has everything.
**User pushback / disagreement:** none.
**Reversibility:** easy.

### D-10: Intelligence-service wiring this round = calibration-driven projection only

**Status:** ✅ Agreed
**Context:** "Wire in the python intelligence service as applicable."
**Decision:** The only Python call surfaced on these pages is the existing calibration path via `useProgressSnapshot` (projection, "to go", completion %, deadline delta) in the detail header. No new endpoint is called for rendering.
**Rationale:** Generation/regeneration aren't needed to *display* a roadmap; the projection already flows through calibration.
**Alternatives considered:** Call `/v1/progress` for server-side projection → deferred (OQ-02); current client snapshot suffices.
**User pushback / disagreement:** none.
**Reversibility:** easy.

### D-11: Edit seam (deferred) — inline modal edit + drag-to-reschedule; `RoadmapEdited` pins the slot

**Status:** ✅ Agreed (deferred)
**Context:** Design shows "Edit roadmap" / long-press a row.
**Decision:** When built, editing lives inline: the session-detail modal grows edit fields (rename, retag role, change planned minutes, remove); rescheduling = drag a bubble (desktop) / "Move to…" date picker in the modal (mobile); each edit emits `RoadmapEdited` and marks the slot **pinned**. This round only reserves the seam: the modal renders from a slot object, `deriveSlotStatuses` preserves slot identity, and the event kind is reserved. Drag commits immediately with a toast-Undo (no confirm modal) — survey-validated.
**Rationale:** Reuses modal + day-sheet infra; makes pin semantics concrete and local.
**Alternatives considered:** A separate edit mode/screen → rejected by user in favor of inline.
**User pushback / disagreement:** User agreed inline + separate `/replan`.
**Reversibility:** n/a this round (not built).

### D-12: Replan seam (deferred) routes to the Python backend via a typed interface

**Status:** ✅ Agreed (deferred build; interface specified now)
**Context:** Replan must regenerate future slots; a Python `regenerate` endpoint exists; user asked to "create an interface and it should route to the python backend."
**Decision:** Define a typed boundary `replanRoadmap(input, pins): Promise<RoadmapOutput>` whose **default implementation calls the Python service** `POST /v1/roadmap/regenerate` through a new `intelligenceClient` function `postRoadmapRegenerate`. The interface owns the mapping between app state and the Python contract (see Phase 7). The TS `regenerateRoadmap` from `@study-tracker/roadmap-engine` is retained only as an offline fallback behind the same boundary.
**Rationale:** User directive; the Python port is the intended engine of record; a thin boundary lets the follow-up `/replan` UI consume it without knowing transport.
**Alternatives considered:** TS engine as default (issue 010's original assumption) → overridden by user. Call Python directly from UI → rejected: leaks mapping + transport into components.
**User pushback / disagreement:** User: "Create an interface and its shd route to python backend."
**Reversibility:** moderate — swapping the default impl behind the boundary is localized; depends on OQ-03 (service deploy/auth/CORS).

### D-13: Empty / no-roadmap state on `/roadmap`

**Status:** 🤔 Assumed (unconfirmed)
**Context:** `findRoadmap` returns `null` if the user hasn't onboarded.
**Decision:** `/roadmap` shows an explicit empty state ("No active roadmap") with a CTA routing to onboarding, mirroring the `/roadmaps` empty state.
**Rationale:** `RequireOnboarding` already guards app routes, but a roadmap can be absent post-abandon; the page must not crash on `null`.
**Alternatives considered:** Redirect to onboarding → rejected: jarring if the user abandoned intentionally.
**User pushback / disagreement:** none yet — flagged for confirmation.
**Reversibility:** easy.

### D-14: Status & elevation visual contract (resolves OQ-01)

**Status:** ✅ Agreed
**Context:** The draft mockup overloaded terracotta (it ringed "today" *and* outlined "pending"), and a warm ring around the current week read as an error/warning. The user asked for a redesign with the two design skills (`.claude/skills/frontend-design/SKILL.md`, `.claude/skills/interface-design/SKILL.md`): distinguish *today* from *this week*, fill today's cell, and stop signalling "something's wrong" on the current week.
**Decision:** Lock the following token-based contract. All values are design tokens (rule `form-design-spacing` — no raw hex). The calendar reads as a unified grid (shared hairline borders), not floating cards.

**Status chips** (icon pairs the color so it is never color-only — accessibility):

| Status | Fill | Border | Text/Icon color | Icon (Tabler) |
|---|---|---|---|---|
| `done` | `var(--moss)` | none | `var(--text-on-inverted)` (`--paper`) | `ti-check` |
| `pending` ("Planned") | `var(--surface-card)` | 1.4px **solid** `var(--border-default)` | `var(--text-tertiary)` | `ti-clock` |
| `skipped` | `var(--rust)` | none | `var(--text-on-inverted)` | `ti-x` |
| `unplanned` | `var(--surface-card)` | 1.4px **dashed** `var(--border-default)` | `var(--text-tertiary)` | `ti-plus` |

**Cell elevation** (two whisper-quiet levels; today sits visually above the week band):

| Cell | Background | Notes |
|---|---|---|
| In-month, normal | `var(--surface-card)` | base surface |
| Out-of-month | `var(--surface-page)` @ ~0.55 opacity | dimmed, non-interactive |
| Current ISO week (the whole row) | `var(--surface-recessed)` (= `--paper-deep`) | recessed band = "this week", **no border highlight** |
| Today | **new token** `--cal-today-fill` (light terracotta wash) | filled cell + a "Today" pill: text `var(--terracotta-d)` on `rgba(terracotta, .16)`; day number `var(--terracotta-d)`, weight 600 |

Grid borders: hairline `var(--border-subtle)` (≈ `rgba(ink, .07–.12)`); container radius `var(--radius-lg)`, hover-expanded cell radius `var(--radius-md)`.

**Hard rule:** rust/red appears **only** on `skipped`. "Today" and "this week" carry **no** negative/alarm color. Day numbers use the mono font; the roadmap title + month label use the display (Fraunces) font.

**New design tokens to add** (in `packages/design-tokens/src/tokens.css`): `--cal-today-fill` (a light terracotta wash derived from `--terracotta`) and `--cal-week-band: var(--surface-recessed)` (alias for intent clarity). No other new colors.

**Rationale:** Marginalia has only three hues (moss/terracotta/rust); spending a hue on a *status* would leave "today" without a marker, so terracotta is reserved as the pure "you are here" wash. Recessed elevation (not color) carries "current week," matching the interface-design "subtle layering" principle. Rust stays meaningful by being exclusive to a genuine miss.
**Alternatives considered:** terracotta ring on today → rejected (reads as warning, and overloads the hue). Tinting the week with terracotta → rejected (alarm). A 4th hue for today → rejected (off-palette).
**User pushback / disagreement:** User: "highlighting with red feels like there is something wrong with current week … Let current days cell be filled to show distinct." Redesign approved: "visually looks good."
**Reversibility:** easy — centralized in `statusStyles.ts` + the two new tokens; restyle without structural change.

### D-15: Playwright visual walkthrough per UI phase

**Status:** ✅ Agreed
**Context:** The user noted the approved visual "looks good, but there can be bugs" and asked for Playwright tests that "visually walk through each action to see behaviour works well."
**Decision:** Each UI phase appends ordered `test.step(...)` blocks to a single `e2e/roadmap.spec.ts` walkthrough that drives every interaction and captures a screenshot at each state into `e2e/__screens__/roadmap/`. Assertions cover behaviour (visibility, modal open/close, month label change, applied status classes); screenshots provide the visual record. Authored against the existing Playwright config; **not executed here** (environment-blocked per CLAUDE.md). Vitest still covers the pure logic per phase.
**Rationale:** A static mockup can't catch wiring/layout/interaction regressions; a screenshot-per-step walkthrough makes behaviour reviewable and gives a re-runnable safety net once the environment allows.
**Alternatives considered:** Pixel visual-regression (e.g. `toHaveScreenshot`) → deferred: baselines can't be generated without running, and the visual contract is still settling; raw screenshots are enough to eyeball now. Unit tests only → rejected: don't exercise the wired interactions the user cares about.
**User pushback / disagreement:** none — this is the user's explicit request.
**Reversibility:** easy.

## Architecture overview

Data flow (all client-side, reading the per-user Dexie event log; sync mirrors to Supabase in the background):

```
events (Dexie)
  ├─ RoadmapCreated / RoadmapReplanned ──┐
  ├─ MaterialAdded ──────────────────────┤
  ├─ SessionLogged ──────────────────────┤
  └─ RoadmapMarkedComplete/Abandoned ─────┤
                                          ▼
                          findRoadmap(events) → RoadmapInput/Payload
                          deriveSlotStatuses(roadmap, sessions, today)
                                          ▼
            ┌──────────────── RoadmapCalendar (month grid) ───────────────┐
            │  header (useProgressSnapshot: projection, to-go, %)         │
            │  month nav (prev/next/today, slide)                         │
            │  day cells → bubbles/dots → SessionDetailModal / DaySheet   │
            │  footer → Mark complete / Abandon (new events)              │
            │  Edit + Replan affordances (disabled stubs → /replan)       │
            └─────────────────────────────────────────────────────────────┘

Replan seam (deferred build):  /replan UI → replanRoadmap(input, pins)
                                            → postRoadmapRegenerate()
                                            → POST /v1/roadmap/regenerate (Python)
```

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `packages/progress/src/deriveSlotStatuses.ts` | new | 1 | Pure per-slot status + unattributed sessions (D-02) |
| `packages/progress/src/index.ts` | modify | 1 | Export `deriveSlotStatuses`, status types |
| `packages/progress/test/deriveSlotStatuses.test.ts` | new | 1 | Unit + property tests for the derivation |
| `apps/app/src/roadmap/RoadmapCalendar.tsx` | new | 2 | Month-grid container; reads events, renders cells |
| `apps/app/src/roadmap/CalendarCell.tsx` | new | 2 | Day cell: bubbles/dots, hover-expand, +N more |
| `apps/app/src/roadmap/calendarModel.ts` | new | 2 | Pure: build month grid (weeks×days), map slots→cells |
| `apps/app/src/roadmap/statusStyles.ts` | new | 2 | Status→(token color + icon) map + legend data (D-03/D-07/D-14) |
| `packages/design-tokens/src/tokens.css` | modify | 2 | Add `--cal-today-fill`, `--cal-week-band` (D-14) |
| `apps/app/src/pages/Roadmap.tsx` | modify | 2 | Replace stub; wire calendar + header + empty state (D-13) |
| `apps/app/src/roadmap/MonthNav.tsx` | new | 3 | Prev/next/today + slide transition (D-05) |
| `apps/app/src/roadmap/SessionDetailModal.tsx` | new | 4 | Detail modal (reuses onboarding modal structure) (D-04) |
| `apps/app/src/roadmap/DaySheet.tsx` | new | 5 | Mobile bottom sheet listing a day's sessions (D-06) |
| `apps/app/src/sync/types.ts` | modify | 6 | Add `RoadmapMarkedComplete/Abandoned` payload types (D-08) |
| `apps/app/src/roadmap/roadmapLifecycle.ts` | new | 6 | Pure: derive Active/Completed/Abandoned groups (D-08/D-09) |
| `apps/app/src/pages/Roadmaps.tsx` | modify | 6 | Replace stub; history groups + empty state (D-09) |
| `apps/app/src/roadmap/replan/replanRoadmap.ts` | new | 7 | Typed boundary; default routes to Python (D-12) |
| `apps/app/src/lib/intelligenceClient.ts` | modify | 7 | Add `postRoadmapRegenerate` (mirrors `postCalibration`) |
| `apps/app/src/roadmap/replan/mapToRegenerateRequest.ts` | new | 7 | Pure: app state → `RoadmapRegenerateRequest` + pins |
| `apps/app/src/App.tsx` | modify | 7 | Reserve `/replan` route (stub component) |
| `e2e/roadmap.spec.ts` | new | 2–7 | Playwright visual-walkthrough spec, appended per phase (write only; do not run) (D-15) |
| `e2e/__screens__/roadmap/` | new (dir) | 2–7 | Per-step screenshots produced by the walkthrough when run |

## Phases

### Phase 1: Pure per-slot status derivation in `packages/progress`

**Status:** ✅ Complete — c50ff53
**Depends on:** none — can start immediately
**Estimated scope:** ~2 files + 1 test, ~150 lines

#### Codebase state assumed at start

- `packages/progress` exists and exports `RoadmapInput`, `SessionEvent` types (used by `apps/app/src/progress/mapEvents.ts`).
- `findRoadmap` already maps events → `RoadmapInput` with `slots[]` carrying `{date, dayOfWeek, weekIndex, plannedMinutes, candidateMaterialIds, role, sessionTitle}`.

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls packages/progress/src/index.ts                       # exists
grep -n "RoadmapInput" packages/progress/src/*.ts       # type is defined here
grep -rn "candidateMaterialIds" packages/progress/src    # slot shape present
```

#### Steps

1. **Create `packages/progress/src/deriveSlotStatuses.ts`** implementing D-02. Define `SlotStatus = 'done' | 'pending' | 'skipped'`; `DerivedSlot = { slot; status; loggedMinutes; sessionIds: string[] }`; `UnplannedSession = { date; materialId?; minutes; sessionId? }`; and `deriveSlotStatuses(roadmap, sessions, today): { slots: DerivedSlot[]; unplanned: UnplannedSession[] }`. Matching rule: a session matches a slot iff `session.date === slot.date && slot.candidateMaterialIds.includes(session.materialId)`. Each session attributes to at most one slot (first unmatched slot for that date+material, in slot order); sessions matching no slot go to `unplanned`. `done` if ≥1 attributed; else `pending` when `slot.date >= today`, `skipped` when `slot.date < today`. `today` is an ISO `yyyy-MM-dd` string passed in (no `new Date()` inside — keep pure for tests).
2. **Export from `packages/progress/src/index.ts`:** add `export { deriveSlotStatuses } from './deriveSlotStatuses'` and the new types.

#### Tests

- Add `packages/progress/test/deriveSlotStatuses.test.ts` covering: single match (done + summed minutes), multiple sessions same day+material (one attributes, extra → unplanned), past slot no match (skipped), future slot no match (pending), off-plan material (unplanned), empty roadmap, all-done week. Add a fast-check property: every input session appears exactly once across `slots[].sessionIds ∪ unplanned` (no double count, no loss).
- Run: `pnpm --filter progress test`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter progress test       # all green, new file covered
pnpm --filter progress typecheck  # or: pnpm typecheck
```

#### Rollback

Delete the new file + test, revert the `index.ts` export line. No data or schema impact (pure addition).

#### Notes (filled in during implementation)

- Added `materialId?: string` to `SessionEvent`; app-level `SessionLogged` payloads already carry it, and D-02's date+material matching cannot be typed without it. `deriveSlotStatuses` stays pure: no clock reads, no `Date` construction, and all status decisions use the caller-provided ISO `today`.
- The final Phase 1 code commit is `c50ff53`; its SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

### Phase 2: Read-only month calendar on `/roadmap` (current month, desktop)

**Status:** ✅ Complete — 8019007
**Depends on:** Phase 1
**Estimated scope:** ~5 files, ~400 lines

#### Codebase state assumed at start

- `deriveSlotStatuses` is exported from `@study-tracker/progress` (Phase 1 complete).
- `apps/app/src/pages/Roadmap.tsx` is the "Coming soon" stub mounted at `/roadmap` in `App.tsx`.
- `useEventStore`, `useLiveQuery`, `findRoadmap` (in `apps/app/src/progress/mapEvents.ts`), `useProgressSnapshot`/`useCalibrationState` (in `apps/app/src/progress`) are available; see `Home.tsx`/`Week.tsx` for usage patterns.

#### Verification (run BEFORE starting)

```bash
grep -n "Coming soon" apps/app/src/pages/Roadmap.tsx     # confirm still a stub
grep -n "deriveSlotStatuses" packages/progress/src/index.ts  # Phase 1 done
grep -n "ROLE_TO_LABEL" apps/app/src/pages/Home.tsx      # material-join pattern reference
```

#### Steps

1. **Create `apps/app/src/roadmap/calendarModel.ts`** — pure helpers: `buildMonthGrid(monthDate): {weeks: Day[][]}` (ISO Monday-start, 6 rows max, in/out-of-month flags) and `bindCells(grid, derivedSlots, unplanned, materialsById)` → per-day list of bubbles `{status|'unplanned', label, materialId, sessionTitle, minutes, slotRef}`. Join material titles via `MaterialAdded` payloads (build `materialsById` from events, mirroring `Home.tsx`).
2. **Add tokens to `packages/design-tokens/src/tokens.css`** (D-14): `--cal-today-fill` (light terracotta wash derived from `--terracotta`) and `--cal-week-band: var(--surface-recessed)`. No other new colors.
3. **Create `apps/app/src/roadmap/statusStyles.ts`** — implement the **D-14 contract exactly**: `status → { fillVar, borderStyle, textVar, icon }` for done/pending/skipped/unplanned (tokens only, no raw hex — rule `form-design-spacing`), plus cell-elevation helpers (normal `--surface-card`, out-of-month dimmed `--surface-page`, current-week `--cal-week-band`, today `--cal-today-fill` + "Today" pill) and exported legend data. Rust must map only to `skipped`.
4. **Create `apps/app/src/roadmap/CalendarCell.tsx`** — renders day number + up to 3 bubbles, `+N more`, desktop hover-expand (CSS, `@media (pointer: fine)`). Bubble click + `+N more` call callbacks (wired in Phase 4; for now open nothing / console-noop placeholder clearly marked `TODO Phase 4`).
5. **Create `apps/app/src/roadmap/RoadmapCalendar.tsx`** — reads events, `findRoadmap`, `deriveSlotStatuses(roadmap, mapSessions(events), todayISO)`, builds the current month grid, renders header (title, date range, progress card from `useProgressSnapshot`: logged / to-go / %), legend, grid, and footer buttons (Mark complete / Abandon as **disabled** placeholders until Phase 6; Edit/Replan disabled stubs per D-01/D-11/D-12). Render the empty state (D-13) when `findRoadmap` is `null`.
6. **Modify `apps/app/src/pages/Roadmap.tsx`** — replace the stub body with `<RoadmapCalendar />`.

> **Visual note:** the status/elevation visual contract is **locked in D-14** — implement to those tokens exactly (recessed `--cal-week-band` for the current week, `--cal-today-fill` wash for today, rust only on `skipped`, icon-paired statuses). Do not introduce raw hex or a terracotta ring on today/this-week.

#### Tests

- Add `apps/app/src/roadmap/calendarModel.test.ts` (Vitest): month-grid boundaries (month starting mid-week, 31-day month, Feb), cell binding (slot→bubble, unplanned→bubble, material title join).
- Add `e2e/roadmap.spec.ts` — start the **visual walkthrough** (D-15; Playwright, **write only — do not run**, per CLAUDE.md). `test.step`s: (a) seed a roadmap + sessions, visit `/study/roadmap`, assert month grid + progress card + legend, `screenshot 01-grid`; (b) assert the **D-14 contract** is applied — current-week row uses `--cal-week-band`, today's cell uses `--cal-today-fill` with a "Today" pill, a `done` chip is moss + `ti-check`, a `skipped` chip is rust + `ti-x`, no terracotta ring anywhere, `screenshot 02-status-colors`; (c) no-roadmap user → empty state, `screenshot 03-empty`. Use role/class selectors.
- Run: `pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test            # calendarModel tests green
pnpm --filter app typecheck       # no type errors
pnpm lint                         # clean
# Manual: pnpm dev:app → http://localhost:5173/study/roadmap renders current month
```

#### Rollback

Restore `Roadmap.tsx` stub; delete `apps/app/src/roadmap/*` and the new tests. No schema impact.

#### Notes (filled in during implementation)

- Added `apps/app/src/roadmap/roadmap.css` for the grid, status chips, hover expansion, current-week band, and responsive sizing; keeping the media-query styles out of inline React made the D-14 visual contract easier to audit.
- Forwarded `materialId` through `apps/app/src/progress/mapEvents.ts` so Phase 1's date+material status derivation works with real `SessionLogged` events.
- `pnpm lint` had pre-existing gate failures (`packages/progress` missing an ESLint config, stale `react-hooks/exhaustive-deps` disable comments without the plugin installed, and one unused Deno-test type import). Fixed those narrowly so the required Phase 2 lint gate can pass.
- The final Phase 2 code commit is `8019007`; its SHA is recorded in this follow-up doc state for the same self-referential SHA reason noted in Phase 1.

### Phase 3: Month navigation (prev/next/today, clamp, slide)

**Status:** ✅ Complete — 3cb0df6
**Depends on:** Phase 2
**Estimated scope:** ~2 files, ~150 lines

#### Codebase state assumed at start

- `RoadmapCalendar` renders a single (current) month and has the roadmap's `startDate`/`deadline` available.

#### Verification (run BEFORE starting)

```bash
grep -n "buildMonthGrid" apps/app/src/roadmap/calendarModel.ts   # Phase 2 done
```

#### Steps

1. **Create `apps/app/src/roadmap/MonthNav.tsx`** — prev/next buttons, a Today button, and the month label. Disable prev/next past the roadmap's start/end months (clamp via `startOfMonth(startDate)`…`startOfMonth(deadline)` with `date-fns`).
2. **Modify `RoadmapCalendar.tsx`** — hold `viewMonth` state (default = month containing `today`), pass to `buildMonthGrid`, and animate month changes with a horizontal slide (CSS transform, ~180ms; respect `prefers-reduced-motion`).

#### Tests

- Extend `calendarModel.test.ts` with clamp bounds (no paging before start month / after deadline month).
- Extend the `e2e/roadmap.spec.ts` walkthrough (write only): `test.step`s screenshotting before/after each nav action — `04-next-month` (label advances, slide settles), `05-prev-month`, `06-today-reset`; assert prev/next disabled at the roadmap's start/end months; assert the deadline-day marker is visible in its month.
- Run: `pnpm --filter app test`

#### Verification (DONE)

```bash
pnpm --filter app test && pnpm --filter app typecheck
# Manual: prev/next slide; clamp at roadmap bounds; Today resets.
```

#### Rollback

Remove `MonthNav.tsx`; revert `RoadmapCalendar` to static current month.

#### Notes (filled in during implementation)

- Added `MonthNav.tsx` and pure month-key helpers in `calendarModel.ts` for inclusive roadmap month bounds, clamped shifting, and Today reset.
- `RoadmapCalendar` now keeps `viewMonth` state, animates month changes through `roadmap-calendar-slide`, respects `prefers-reduced-motion`, and marks the roadmap deadline day.
- The final batched Phase 3/4 code commit is `3cb0df6`; Phase 4 was implemented in the same commit because the human explicitly asked to start both phases together.

### Phase 4: Session-detail modal + day modal + wire bubble/overflow clicks (desktop)

**Status:** ✅ Complete — 3cb0df6
**Depends on:** Phase 2
**Estimated scope:** ~2 files, ~200 lines

#### Codebase state assumed at start

- Onboarding modal structure exists (see `apps/app/src/onboarding/components/` and `RecalibrationModal.tsx` for the app's modal idiom).
- `CalendarCell` exposes `onBubbleClick(bubble)` and `onOverflowClick(day)` callbacks (placeholders from Phase 2).

#### Verification (run BEFORE starting)

```bash
ls apps/app/src/components/RecalibrationModal.tsx        # modal idiom reference
grep -n "onBubbleClick\|onOverflowClick" apps/app/src/roadmap/CalendarCell.tsx
```

#### Steps

1. **Create `apps/app/src/roadmap/SessionDetailModal.tsx`** — reuse the onboarding/Recalibration modal shell. Render from a bubble/slot object: eyebrow (date), title, status pill, body (logged vs planned minutes, material link if present), and an action button whose label depends on status (`done`→View session, `pending`→Start session, `skipped`→Log it late, `unplanned`→View session). For this round the action button may be a **disabled stub** for start/log (those flows live elsewhere); "View session" can deep-link to existing session detail if available, else stub.
2. **Wire clicks in `RoadmapCalendar`/`CalendarCell`:** bubble click → open `SessionDetailModal` for that bubble; `+N more` → open a day modal listing that day's sessions (reuse the same modal in a "day list" mode, or a thin list that opens the detail modal per row).

#### Tests

- Add `apps/app/src/roadmap/SessionDetailModal.test.tsx`: renders correct status pill + action label per status; close works.
- Extend the `e2e/roadmap.spec.ts` walkthrough (write only): `test.step`s — hover a day cell and screenshot `07-hover-expand`; click a `done` chip → `08-modal-done` (title + "Completed" pill + "View session"); close; click a `pending` chip → `09-modal-pending` ("Planned" + "Start session"); click `+N more` on a busy day → `10-day-modal` (lists all that day's sessions). Assert modal open/close state at each step.
- Run: `pnpm --filter app test`

#### Verification (DONE)

```bash
pnpm --filter app test && pnpm --filter app typecheck
```

#### Rollback

Remove modal file; revert cell callbacks to no-ops.

#### Notes (filled in during implementation)

- Added `SessionDetailModal.tsx` using the existing `.modal-overlay` / `.modal-card` app modal structure, plus a day-list modal in the same file for overflow days.
- Bubble clicks now open a session detail modal; `+N more` opens the day list, and selecting a row opens the detail modal.
- Material URLs from `MaterialAdded` payloads now flow into calendar bubbles so the modal can render a material link when present.
- The final batched Phase 3/4 code commit is `3cb0df6`.

### Phase 5: Mobile responsive — dots + day bottom-sheet + swipe

**Status:** ✅ Complete — 3967553
**Depends on:** Phase 4
**Estimated scope:** ~2 files, ~180 lines

#### Codebase state assumed at start

- `CalendarCell` renders bubbles (desktop) and `SessionDetailModal` exists.
- `useMatchMedia` hook exists at `apps/app/src/lib/` (per CLAUDE.md directory map).

#### Verification (run BEFORE starting)

```bash
ls apps/app/src/lib/useMatchMedia.ts                     # responsive hook present
grep -n "SessionDetailModal" apps/app/src/roadmap/        # Phase 4 done
```

#### Steps

1. **Modify `CalendarCell.tsx`** — below a width threshold (via `useMatchMedia`/CSS), render bubbles as status **dots** with a count badge when >1; disable hover-expand; make the whole cell tappable.
2. **Create `apps/app/src/roadmap/DaySheet.tsx`** — a bottom sheet (normal-flow overlay, never `position: fixed`) listing the tapped day's sessions; each row opens `SessionDetailModal`.
3. **Modify `RoadmapCalendar.tsx`** — add left/right swipe (touch handlers) to change months on mobile, reusing the Phase 3 slide.

#### Tests

- Extend the `e2e/roadmap.spec.ts` walkthrough (write only) with a **mobile-viewport** project (~390px): `test.step`s — `11-mobile-dots` (bubbles render as dots with a count badge, hover-expand absent), tap a day → `12-day-sheet` (bottom sheet lists that day's sessions), tap a row → `13-mobile-modal`, swipe → `14-mobile-month-change`.
- Run: `pnpm --filter app test`

#### Verification (DONE)

```bash
pnpm --filter app test && pnpm --filter app typecheck
# Manual: emulate 360px — dots render, tap → sheet, swipe changes month.
```

#### Rollback

Remove `DaySheet.tsx`; revert `CalendarCell` to bubbles-only.

#### Notes (filled in during implementation)

- Added compact mobile rendering in `CalendarCell`: below 560px, day cells render status dots plus a count badge, hide desktop bubbles, and use a single tappable day target that opens the mobile sheet.
- Added `DaySheet.tsx` as the mobile day-session surface. It is a normal-flow `section[role="dialog"]` in the roadmap page, not a fixed-position modal, and its rows open the existing `SessionDetailModal`.
- Added touch-swipe month navigation to `RoadmapCalendar`, reusing `shiftMonth`/clamp bounds and the existing Phase 3 slide direction.
- Extended the write-only Playwright walkthrough with an `app-mobile` project and screenshots `11-mobile-dots` through `14-mobile-month-change`; E2E remains authored only per D-15.

### Phase 6: Mark complete / abandon events + `/roadmaps` history page

**Status:** ✅ Complete — 192cbef
**Depends on:** Phase 2
**Estimated scope:** ~4 files, ~300 lines

#### Codebase state assumed at start

- `useSync().logEvent` appends events (see `Home.tsx`).
- `Roadmaps.tsx` is the "Coming soon" stub at `/roadmaps`.
- `RoadmapCalendar` can render read-only (accepts a roadmap payload prop) — add a `readOnly`/`roadmap` prop in this phase if not already present.

#### Verification (run BEFORE starting)

```bash
grep -n "Coming soon" apps/app/src/pages/Roadmaps.tsx
grep -n "logEvent" apps/app/src/sync/useSync.ts
```

#### Steps

1. **Modify `apps/app/src/sync/types.ts`** — add `RoadmapMarkedCompletePayload` and `RoadmapMarkedAbandonedPayload` (`{ roadmapCreatedAt: string; resolvedAt: string; reason?: string }`) (D-08).
2. **Create `apps/app/src/roadmap/roadmapLifecycle.ts`** — pure: from events, list every `RoadmapCreated`/`RoadmapReplanned` and classify each as Active / Completed / Abandoned using the latest matching `RoadmapMarkedComplete`/`Abandoned` by `roadmapCreatedAt` (D-08/D-09). Return display metadata (date range, week count, % complete via stored slots).
3. **Wire footer buttons in `RoadmapCalendar`** (enable the Phase-2 placeholders): "Mark roadmap complete" → `logEvent('RoadmapMarkedComplete', {...})`; "Abandon roadmap" → confirm, then `logEvent('RoadmapMarkedAbandoned', {...})`. After either, route to `/roadmaps`.
4. **Modify `apps/app/src/pages/Roadmaps.tsx`** — render Active / Completed / Abandoned groups from `roadmapLifecycle`, the empty state (italic Fraunces "Nothing here yet." per design §I), and "Start a new roadmap" → onboarding (`to="/onboarding"`). Clicking an entry opens the detail calendar in read-only mode.

#### Tests

- Add `apps/app/src/roadmap/roadmapLifecycle.test.ts`: active when no terminal event; completed/abandoned when matching event present; replan supersedes; multiple historical roadmaps grouped correctly.
- Extend the `e2e/roadmap.spec.ts` walkthrough (write only): `test.step`s — click "Mark roadmap complete" → `15-complete-confirm` → lands on `/study/roadmaps`, roadmap now under **Completed** → `16-history-completed`; in a second flow, "Abandon roadmap" → confirm → appears under **Abandoned** → `17-history-abandoned`; empty account → `18-history-empty`; click a history entry → read-only calendar opens → `19-history-readonly`.
- Run: `pnpm --filter app test`

#### Verification (DONE)

```bash
pnpm --filter app test && pnpm --filter app typecheck && pnpm lint
```

#### Rollback

Revert `Roadmaps.tsx` stub; remove `roadmapLifecycle.ts`; revert the two type additions and footer wiring. Note: any `RoadmapMarkedComplete/Abandoned` events emitted during testing persist in the local Dexie DB — clear via the app's data reset or a fresh user.

#### Notes (filled in during implementation)

- Added additive terminal event payload types for `RoadmapMarkedComplete` and `RoadmapMarkedAbandoned`.
- Added pure `deriveRoadmapLifecycle(events)` to group Active / Completed / Abandoned roadmaps, keep superseded replans out of active history groups, and compute slot completion percentage from stored roadmap slots plus matching sessions.
- Updated `RoadmapCalendar` to select the lifecycle-active roadmap by default, emit terminal events through `useSync().logEvent`, route to `/roadmaps`, and render selected history entries in read-only mode.
- Replaced the `/roadmaps` stub with lifecycle-derived Active / Completed / Abandoned groups, an italic empty state, onboarding CTA, and inline read-only calendar selection.
- Phase 6 prereq `grep -n "logEvent" apps/app/src/sync/useSync.ts` was stale: `useSync.ts` re-exports `useSyncContext`, while the actual `logEvent` implementation lives in `SyncProvider.tsx`. Capability was confirmed there before continuing.

### Phase 7: Replan interface seam routed to the Python backend (stubbed UI)

**Status:** ✅ Complete — 84abbd2
**Depends on:** Phase 2
**Estimated scope:** ~4 files, ~250 lines

#### Codebase state assumed at start

- `intelligenceClient.ts` exposes `postCalibration` with the auth/timeout/retry/typed-error pattern (see rule `fetch-typed-error-normalization`).
- Python endpoint `POST /v1/roadmap/regenerate` accepts `{ input: RoadmapGenerateRequest, pins: Pin[] }` and returns a `RoadmapOutput` JSON (`services/intelligence/app/schemas/roadmap.py`, `routers/roadmap.py`). Request shapes:
  - `RoadmapGenerateRequest = { materials: {id,title,totalMinutes,role,additionOrder}[], weeks, startDate, selectedStudyDays, weekdayHours, weekendHours }`
  - `Pin = { weekIndex, dayOfWeek, materialId?, sessionTitle?, plannedMinutes, reason: 'completed'|'today'|'user-edited' }`
- `@study-tracker/roadmap-engine` exports `regenerateRoadmap`, `RoadmapInput`, `RoadmapOutput`, `Pin`, `PinSet`.

#### Verification (run BEFORE starting)

```bash
grep -n "postCalibration" apps/app/src/lib/intelligenceClient.ts
sed -n '1,48p' services/intelligence/app/schemas/roadmap.py     # confirm request shapes
grep -n "regenerateRoadmap" packages/roadmap-engine/src/index.ts
```

#### Steps

1. **Modify `apps/app/src/lib/intelligenceClient.ts`** — add `postRoadmapRegenerate(body): Promise<unknown>` mirroring `postCalibration` exactly (same `BASE`, `authHeaders`, `AbortController` timeout, retry/backoff, and typed errors — define `RoadmapServiceError`/reuse the auth error). It POSTs to `${BASE}/v1/roadmap/regenerate`. Apply rule `fetch-typed-error-normalization` (normalize by `name`, not `instanceof Error`).
2. **Create `apps/app/src/roadmap/replan/mapToRegenerateRequest.ts`** — pure mapping that the interface owns (this is the contract-bridge the app currently lacks):
   - Build `materials[]` from `MaterialAdded` events: `{ id: materialId, title, totalMinutes: estimatedDuration, role, additionOrder: <event order index> }`.
   - Pull `weeks`, `startDate`, `selectedStudyDays`, `weekdayHours`, `weekendHours` from the latest `RoadmapCreatedPayload`.
   - Build `pins[]` from derived state (Phase 1 + lifecycle): `completed` slots (done), `today`'s slot, and `user-edited` slots (`RoadmapEdited` — none yet, but map the kind). Emit `Pin` objects in the Python shape.
   - Return `{ input, pins }` typed to match the Python request.
3. **Create `apps/app/src/roadmap/replan/replanRoadmap.ts`** — the boundary `replanRoadmap(events, opts): Promise<RoadmapOutput>` that calls `mapToRegenerateRequest(events)` then `postRoadmapRegenerate(...)`, parsing the response into `RoadmapOutput`. Keep an internal `offlineReplan` that calls the TS `regenerateRoadmap` as a fallback behind the same signature (D-12) — not wired to UI this round.
4. **Modify `apps/app/src/App.tsx`** — reserve a `/replan` route rendering a clear stub component (e.g. "Replan — coming soon") inside `ProtectedRoute + RequireOnboarding`, so the detail-page Edit/Replan buttons and Week's "Replan the rest" have a real destination. **Do not** add `/study` to the path (rule `react-router-v7-basename`).

#### Tests

- Add `apps/app/src/roadmap/replan/mapToRegenerateRequest.test.ts`: materials mapping (order index, role, minutes), capacity fields pulled from payload, pin construction (completed + today; user-edited absent), exact Python field names present.
- Add `apps/app/src/lib/intelligenceClient.test.ts` cases for `postRoadmapRegenerate` mirroring the calibration tests: 401 → auth error; ≥500 → retryable; timeout via a real `Error` subclass named `AbortError` (per `fetch-typed-error-normalization`, **not** jsdom `DOMException`); network `TypeError` exhaustion → typed error.
- Extend the `e2e/roadmap.spec.ts` walkthrough (write only): from the calendar, click the (stub) "Replan" affordance → lands on `/study/replan` stub → `20-replan-stub`; confirm the route resolves under `ProtectedRoute + RequireOnboarding` and the URL has no double `/study` prefix.
- Run: `pnpm --filter app test`

#### Verification (DONE)

```bash
pnpm --filter app test && pnpm --filter app typecheck && pnpm lint
grep -n "postRoadmapRegenerate" apps/app/src/lib/intelligenceClient.ts   # interface present
grep -n '"/replan"' apps/app/src/App.tsx                                  # route reserved
```

#### Rollback

Remove the three new replan files and the `intelligenceClient` addition; remove the `/replan` route. No schema impact; the Python endpoint is unchanged.

#### Notes (filled in during implementation)

- Added `postRoadmapRegenerate` to `intelligenceClient.ts`, targeting `POST /v1/roadmap/regenerate` with the same auth headers, timeout, retry/backoff, and typed-error normalization contract as calibration.
- Added the pure `mapToRegenerateRequest(events, today)` bridge from app events to the Python request shape, including material `additionOrder`, capacity fields from the latest active roadmap payload, completed/today pins, and a reserved `RoadmapEdited` user-edited pin path.
- Added `replanRoadmap(events, opts)` as the interface boundary. Its default transport calls the Python endpoint; the TS `regenerateRoadmap` fallback stays behind the same signature and is opt-in via `offlineFallback`.
- Reserved `/replan` under the protected/onboarded app shell and pointed the Roadmap footer and Week "Replan the rest" affordance at it without adding `/study`.
- Extended the write-only Playwright walkthrough with `20-replan-stub`.

## Open questions

### OQ-01: Final calendar visual (spacing, bubble shapes, exact status palette) — ✅ RESOLVED 2026-06-26

Resolved via a design-skill redesign pass and user sign-off ("visually looks good"). The status/elevation contract is locked in **D-14** (recessed band = current week; warm `--cal-today-fill` wash = today; rust reserved for `skipped`; icon-paired statuses). Remaining tuning (exact wash intensity, day-number prominence) is cosmetic and lives inside the D-14 token set — no structural impact.

### OQ-02: Server-side projection via `/v1/progress`

**Why deferred:** Current client `useProgressSnapshot` suffices for the header; `/v1/progress` is live but unwired.
**Triggers needing resolution:** If projection logic must be unified server-side, or the TS/Python progress impls diverge.
**Owner / resolution path:** Tracked by STATUS OQ-01 (projection wiring) / OQ-03 (service deploy).
**Cross-ref:** D-10.

### OQ-03: Intelligence Service deploy + auth + CORS for production replan

**Why deferred:** Replan UI is deferred; the interface (Phase 7) targets the local service. Production needs deploy/auth/CORS (already STATUS OQ-03).
**Triggers needing resolution:** When the `/replan` UI is built and must hit a deployed service.
**Owner / resolution path:** Rohit; coordinate with the Pillar-A backend deploy.
**Cross-ref:** D-12.

### OQ-04: Drag-to-reschedule + edit fields (the Edit build)

**Why deferred:** D-01/D-11 — Edit is a follow-up plan.
**Triggers needing resolution:** When inline editing is scheduled.
**Owner / resolution path:** New plan wrapping `RoadmapEdited` + the modal edit form + drag handler (toast-Undo).
**Cross-ref:** D-11.

## Out of scope

- **Full Replan flow** (three option cards, trim-scope drag picker, diff-preview/confirm, load-balancing) — deferred to a follow-up plan per issue 010; only the Python-routed interface seam ships now (D-12).
- **Inline editing / drag-to-reschedule** — deferred (D-11).
- **Server-side progress/generation cutover for onboarding** — onboarding keeps the TS engine; only replan is specified to route to Python.
- **PWA / analytics / streaming narrative** — separate queued items in STATUS.
- **Running E2E** — environment-blocked; specs are written but not executed (CLAUDE.md).

## References

- PRD — `.work/specs/prd/PRD-study-tracker-web.md`
- Replan ticket (pin categories, three levers) — `.work/specs/issues/010-replan-flow-with-three-options.md`
- Design comps — `design/screens.html` §H (mobile detail), §I (history), K15/K16 (desktop)
- Roadmap engine guide — `design/algo/ROADMAP_ENGINE_GUIDE.md`
- Python regenerate contract — `services/intelligence/app/schemas/roadmap.py`, `services/intelligence/app/routers/roadmap.py`
- Calibration client pattern — `apps/app/src/lib/intelligenceClient.ts`
- Event/data model — `.claude/rules/eventstore-architecture.md`; `apps/app/src/sync/types.ts`; `apps/app/src/progress/mapEvents.ts`
- Rules — `react-router-v7-basename.md`, `dexie-schema-migration.md`, `fetch-typed-error-normalization.md`, `form-design-spacing.md`, `onboarding-architecture.md`
- Calendar UX survey (Google/Notion/Apple/Fantastical/Motion/Sunsama/Akiflow/TickTick/RemNote/Anki FSRS) — captured in the planning conversation (2026-06-26)
