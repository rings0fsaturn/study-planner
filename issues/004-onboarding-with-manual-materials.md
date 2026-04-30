---
title: Onboarding with manual-only materials produces a roadmap (with role-aware planning)
type: AFK
blocked_by: [2, "4a"]
covers_user_stories: [8, 11, 12, 13, 15, 60, 61, 62, 63, 64, 65, 66]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

A new user signs in for the first time and is walked through a four-step onboarding flow:

1. **Step 1 (`/study/onboarding/1`)** — pick a deadline (date picker + chips) and optionally a purpose label
2. **Step 2 (`/study/onboarding/2`)** — set weekly hours, weekday/weekend split, and select study days (Mon–Sun checkboxes)
3. **Step 3 (`/study/onboarding/3`)** — add at least one study material (manual entry: title + estimated duration + **type** + optional URL) and review the live preview of the generated session breakdown
4. **Step 4 (`/study/onboarding/4`)** — confirmation screen with first session card and "Go to home" button

Committing emits `OnboardingCompleted`, `RoadmapCreated`, and one or more `MaterialAdded` events. After commit, `/study/home` shows the projected finish date and days-until-deadline alongside the activity list from slice 2.

The preview step is **interactive**, not just visual:

- The user sees a week-by-week schedule with day chips (Mon, Wed, Sat) and material titles
- **Multi-candidate slots** (where the algorithm couldn't decide between two materials) render as tap-to-pick rows: `[Review DDIA] or [Review Alex Xu] or [Rest day]`
- **Inline rename** is available on every slot title — click the title, type a new name, blur to commit
- **Rest days** appear as explicit rows (`Mon · Rest day`) rather than being hidden
- **Edits at preview time are stored on the in-progress roadmap state** and emitted as part of `RoadmapCreated` (no separate `RoadmapEdited` events at onboarding — those are only post-commit)

The desktop layout (≥1024px) uses a two-column arrangement: form on the left, live preview on the right. Mobile stays single-column with the form first and the preview below.

### Material entry (step 3) — new field

Each material row captures four fields:

```
Title:           [text input]
Estimated time:  [number] minutes
Type:            [dropdown: Main reading | Foundations | Practice]
URL (optional):  [text input]
```

The **Type** dropdown is pre-selected by title-regex inference (see slice 4a for the full inference rules) but the user can override. The user-facing labels are deliberately plain English; the internal `role` taxonomy (`anchor` / `foundation` / `practice`) is hidden.

### Over-capacity prompt at preview

If the user's materials sum to more minutes than the timeline can hold (`totalMaterialMinutes > totalCapacityMinutes`), the preview shows a **blocking modal** with three buttons:

- **Adjust deadline** → routes back to step 1
- **Adjust hours** → routes back to step 2
- **Adjust scope** → routes back to step 3

This is the v1 "dumb" version of slice 10's three-option component. Slice 10 later upgrades it to live recompute. The user **cannot commit until the math fits**.

### Under-capacity (lots of buffer) prompt

If `totalCapacityMinutes > totalMaterialMinutes × 1.3`, a soft prompt appears at the top of the preview:

> "You have 12 hours of buffer in this plan. Want to compress the timeline to finish earlier?"

with two buttons: **Compress to N weeks** (regenerate with fewer weeks) or **Keep buffer** (proceed; unused slots become rest days). *Add material* is grayed out as v2.

### Tie-resolution before commit

The "Looks good" commit button at the bottom of step 3 is **disabled while any multi-candidate slot remains unresolved**. The user must pick a candidate (or rest day) for every such slot before committing. The disabled state shows tooltip: "Resolve N undecided slots to continue."

## Acceptance criteria

### Routing & guards

- [ ] A first-time user (no `OnboardingCompleted` event in their EventStore) is routed to `/study/onboarding/1` instead of `/study/home`
- [ ] An `OnboardingGate` wrapper component checks the EventStore on mount and handles redirect
- [ ] Each onboarding step has its own URL (`/onboarding/1` through `/onboarding/4`) and is independently bookmarkable
- [ ] Skip-ahead guard: if a user lands on step 3 without step-1 or step-2 data in the React context, they're redirected to the earliest incomplete step
- [ ] A user with `OnboardingCompleted` in their store skips onboarding on subsequent sign-ins

### Step 1 — deadline

- [ ] Step 1 captures: deadline date (date picker + chips for "in 2 weeks", "in 1 month", "in 2 months", "in 3 months", "in 6 months") and optional "What are you preparing for?" text
- [ ] Picking a chip auto-fills the date picker

### Step 2 — hours & days

- [ ] Step 2 captures: weekly hours total, weekday hours, weekend hours, and a Mon–Sun checkbox row for selected study days
- [ ] At least one study day must be selected before continuing
- [ ] Weekday and weekend hour totals must sum to weekly hours total (live validation)

### Step 3 — materials & preview (the meat of this slice)

- [ ] Step 3 captures: 1+ manual-entry materials, each with title, estimated duration (minutes), **type (Main reading / Foundations / Practice)**, and optional URL
- [ ] **The Type dropdown defaults are populated by title-regex inference** (delegated to `RoadmapEngine.inferRole()` per slice 4a)
- [ ] **The preview re-renders within 200ms of any input change** in the form (title, duration, type, URL, material added, material removed, step 1/2 fields)
- [ ] **The preview shows multi-candidate slots as tap-to-pick rows** with all candidate materials and a "Rest day" option
- [ ] **Inline rename of slot titles works on every slot in the preview** — click title, edit, blur to commit
- [ ] **Rest days render as explicit rows** with the label "Rest day" and no duration
- [ ] **Over-capacity prompt blocks commit** and shows three buttons routing to steps 1/2/3
- [ ] **Under-capacity-buffer prompt appears as a non-blocking banner** when capacity > material × 1.3 with Compress / Keep buffer options
- [ ] **Compress regenerates the preview with fewer weeks** (computes the smallest N where capacity still fits material) without leaving step 3
- [ ] **The commit button is disabled while any multi-candidate slot is unresolved**, with a tooltip indicating how many remain

### Commit

- [ ] On commit, the following events are appended in order:
  1. One `MaterialAdded` event per material (with new payload shape — see below)
  2. `RoadmapCreated` (with full week/slot structure including any preview-time edits and tie resolutions)
  3. `OnboardingCompleted` (empty payload)
- [ ] All events emit via `useSync().logEvent()` and sync per slice 3
- [ ] **`MaterialAdded` payload uses the new shape:** `{ title, estimatedDuration, url?, kind: 'manual', role: 'anchor' | 'foundation' | 'practice' }` (note `kind` replacing the old `type`, and the new required `role` field)
- [ ] **`RoadmapCreated` payload includes the full slot grid** with `weeks[].slots[]` containing `{ dayOfWeek, date, capacityMinutes, plannedMinutes, materialId, role, sessionTitle }` per slot

### Post-commit

- [ ] After onboarding, `/study/home` shows the projected finish date and days-until-deadline (read from `RoadmapCreated`)
- [ ] The "Up next" card on Home shows the first non-rest-day slot of the roadmap
- [ ] The activity list from slice 2 still renders below the projection card

### Layout

- [ ] Desktop layout (≥1024px) for step 3 is two-column: form on the left, live preview on the right
- [ ] Mobile layout is single-column: form first, preview stacked below
- [ ] Onboarding screens use design-system primitives (no inline styles)

### Tests

- [ ] Tests cover: first-time routing, onboarding step navigation (forward + back), skip-ahead guard, in-progress data preservation across step changes
- [ ] Tests cover: type inference for various titles ("DDIA" → Main reading, "Mock interviews" → Practice, "Cracking the Coding Interview · 1200m" → Main reading because of the >200m guard, "LeetCode patterns" → Practice)
- [ ] Tests cover: preview re-renders on every input change, multi-candidate slot resolution, inline rename round-trip, rest day rendering
- [ ] Tests cover: over-capacity blocks commit and routes correctly, under-capacity-buffer prompt appears at right threshold, Compress regenerates with correct week count
- [ ] Tests cover: commit button disabled-state logic (tied to unresolved tie count)
- [ ] Tests cover: full event sequence on commit (MaterialAdded × N, then RoadmapCreated, then OnboardingCompleted), in correct order
- [ ] Tests cover: payload shape of `MaterialAdded` (new `kind`/`role` fields) and `RoadmapCreated` (full slot grid)
- [ ] An end-to-end test walks the full onboarding flow with a multi-material plan including a tie-resolution case, and verifies Home shows the correct projection and "Up next" afterward

## New user stories covered

- **User story 60:** As a new user adding study materials, I want each material to have a clear type (main reading, foundations, or practice) so that the schedule respects what each material is *for*, not just how long it takes.
- **User story 61:** As a new user adding a material, I want the type to be guessed from my title so that I don't have to think about it for the obvious cases — but I want to be able to override the guess when it's wrong.
- **User story 62:** As a new user reviewing the schedule preview, I want sessions where the algorithm couldn't decide between two materials to be presented as a choice, so that I make those calls myself instead of the app picking arbitrarily.
- **User story 63:** As a new user reviewing the schedule preview, I want to rename any session inline (e.g., "DDIA · session 5 of 12" → "DDIA · ch. 5 Replication"), so that the schedule reflects the actual content I plan to cover.
- **User story 64:** As a new user reviewing the schedule, I want explicit "Rest day" rows on days I selected as study days but where there's no material assigned, so that I can see my buffer at a glance.
- **User story 65:** As a new user whose materials don't fit the timeline, I want to be told clearly and given three concrete ways to fix it (more time, more hours, less scope), so that I'm never silently committed to an impossible plan.
- **User story 66:** As a new user whose timeline has lots of buffer, I want the option to compress to a tighter schedule, so that I'm not artificially holding myself to a longer deadline than I need.

## Blocked by

- Blocked by #2 (event sync infrastructure)
- Blocked by #4a (RoadmapEngine — the algorithm itself must exist before this slice can call it)
