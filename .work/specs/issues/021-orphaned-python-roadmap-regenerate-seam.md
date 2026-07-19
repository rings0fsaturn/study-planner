---
title: Decide fate of orphaned Python roadmap-regenerate seam and dead /v1 endpoints
type: HITL
blocked_by: []
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md` · Related: issue #010 (re-plan flow), `.work/STATUS.md`'s
"Material ↔ session decoupling redesign" entry · Found in:
`.work/plans/active/2026-07-03 third-review-report-work/research/01-app-architecture-and-data-flow.md`
§2 and `02-research-to-app-mapping.md` §1, and `01-*.md` §5 finding #3
(architecture/research audit, 2026-07-03).

## What's wrong

There are **two parallel roadmap-generation systems** in the codebase, and the live app
uses only one of them — leaving a fully-built, unit-tested Python integration with zero
live callers:

| System | TS API | Python mirror | Live app usage |
|---|---|---|---|
| **Booking engine (current)** | `generateBookings`, `suggestMaterialForBooking` (`packages/roadmap-engine/src/roadmap-engine.ts:159-189`) | **None — never ported, no HTTP exposure** | **This is what onboarding and Replan actually run**, 100% client-side |
| **Packed-slot engine (legacy, `@deprecated`)** | `generateRoadmap`, `regenerateRoadmap`, `addMaterialToRoadmap`, `removeMaterialFromRoadmap` | `packages/py-roadmap-engine/src/py_roadmap_engine/engine.py` — full parity, exposed over HTTP | **Reachable only via `apps/app/src/roadmap/replan/replanRoadmap.ts`, which has zero callers anywhere in `apps/app/src`** (confirmed by repo-wide grep — only its own definition and its own `.test.ts` reference it) |

Confirmed call chains:

- **Live replan** (`pages/Replan.tsx:317`) calls `commitReplan()`
  (`apps/app/src/roadmap/replan/commitReplan.ts`), which imports and calls `generateBookings`
  directly (`commitReplan.ts:115`) — 100% client-side TS, no network call.
- **Orphaned replan path** (`apps/app/src/roadmap/replan/replanRoadmap.ts:69`) posts to
  `POST /v1/roadmap/regenerate` via `postRoadmapRegenerate`
  (`apps/app/src/lib/intelligenceClient.ts:110-150`), with an offline fallback to the
  deprecated TS `regenerateRoadmap`. `.work/STATUS.md` describes this as "Python-routed
  replanRoadmap seam done" — accurate as a description of tested infrastructure, but it is
  **not wired to any live UI**. The redesign that replaced packed slots with the booking
  model (per `.work/STATUS.md`'s "Material ↔ session decoupling redesign" entry) superseded
  this seam and left it in place, unreferenced.
- **`packages/py-roadmap-engine`'s types never got the `Booking`/`BookingLayoutInput` types
  added** — it mirrors only the deprecated packed-slot API, so even if someone wanted to
  wire it up today, it would need new work, not just a new caller.

**Two more dead HTTP endpoints found in the same audit, same category of issue:**

- `POST /v1/progress` (`services/intelligence/app/routers/progress.py`) — fully built,
  OpenAPI-documented (`packages/py-progress/openapi.yaml`), fixture-tested. The live app
  computes all progress/burn-up/GP-projection/streak data client-side
  (`apps/app/src/progress/useProgress.ts` → `computeProgress`) and never calls this
  endpoint. Confirmed by repo-wide grep — no reference to `/v1/progress` or a
  `postProgress` client function anywhere in `apps/app/src`.
- `POST /v1/calibration/prompt-detail` (`services/intelligence/app/routers/calibration.py:24-28`)
  — fully wired server-side (`py_progress.get_prompt_detail`), but the app computes this
  client-side instead via `apps/app/src/progress/usePromptDetail.ts` calling
  `getPromptDetail` from `@study-tracker/progress` directly. No caller of the HTTP endpoint
  exists in `apps/app/src`.

## Update (2026-07-03) — corroborating evidence found

A follow-up cross-reference against `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md`
confirms this orphaning was the **direct, intended consequence of an explicit, dated product
decision**, not an ambiguous leftover. D1 states: *"Drop the prescriptive day-by-day `Slot`
assignment... The engine's job shrinks to capacity model + finish-date projection, not
per-day packing."* §5c goes further and explicitly retires the entire research-comparison
track built around that packing model (see issue #022's correction history for detail).
This doesn't fully resolve the HITL question below on its own (there's still a real choice
between deleting the dead code now vs. leaving it as clearly-documented dead infrastructure
vs. some future reuse), but it substantially strengthens the case for **option 1 (removal)**
— the design decision that made this code obsolete was deliberate and is already recorded,
so keeping the code "in case the Python-routed engine comes back" has less to hang on than
it might otherwise.

## Why this needs a human decision (HITL)

This isn't a bug with one obvious fix — it's a maintenance-cost/clarity question with at
least three reasonable resolutions, and the right one depends on product direction (is the
Python-routed roadmap engine ever coming back?) that only Rohit/the team can answer:

1. **Remove the dead code.** Delete `replanRoadmap.ts`, `mapToRegenerateRequest.ts`, the
   `/v1/roadmap/regenerate` router + schema, the `/v1/progress` router + schema, the
   `/v1/calibration/prompt-detail` router, and the corresponding unused exports from
   `packages/roadmap-engine`/`packages/py-roadmap-engine` (`generateRoadmap`,
   `regenerateRoadmap`, `addMaterialToRoadmap`, `removeMaterialFromRoadmap` and their Python
   mirrors) — if nothing needs them and nothing is planned to need them.
2. **Keep it as intentional forward infrastructure**, but fix the documentation:
   `.work/STATUS.md`'s current wording ("infra-ready") could be read as "in use" — reword to
   state explicitly that this is unwired infrastructure, and add a code comment at the top
   of `replanRoadmap.ts` explaining it has no live caller and why it still exists.
3. **Actually wire it up** — if there's a reason to prefer server-side roadmap regeneration
   (e.g. heavier computation, wanting the Python-side scheduling improvements from issue
   #022 to apply here), port the `Booking`/`BookingLayoutInput` types to
   `py_roadmap_engine` and switch `commitReplan.ts`/onboarding's `Step3Preview.tsx` to call
   through `replanRoadmap.ts` instead of `generateBookings` directly.

## What to build (once a direction is chosen)

Fill in based on the decision above. If removal (option 1) is chosen:

## Acceptance criteria

- [ ] A decision is recorded (in this issue or `.work/STATUS.md`) on which of the three
      options above was chosen, and why.
- [ ] If removing: `replanRoadmap.ts`, `mapToRegenerateRequest.ts`, their test files, the
      `/v1/roadmap/regenerate` router/schema, `/v1/progress` router/schema,
      `/v1/calibration/prompt-detail` router entry, and the now-fully-unused
      `generateRoadmap`/`regenerateRoadmap`/`addMaterialToRoadmap`/`removeMaterialFromRoadmap`
      exports (TS + Python) are deleted, and `.work/STATUS.md`'s "Python-routed replan seam"
      language is removed/corrected.
- [ ] If keeping as documented-dead infra: `.work/STATUS.md` and a code comment in
      `replanRoadmap.ts` are updated to state plainly that this path has no live caller.
- [ ] If wiring up: `Booking`/`BookingLayoutInput` are added to
      `packages/py-roadmap-engine/src/py_roadmap_engine/types.py`, the live replan/onboarding
      commit paths are switched to call `replanRoadmap`, and end-to-end tests confirm the
      Python round-trip produces the same bookings a client-side `generateBookings` call
      would for equivalent input.
- [ ] Whichever path is taken, `pnpm --filter @study-tracker/app test`, `pnpm --filter @study-tracker/app typecheck`,
      and `uv run pytest packages/py-roadmap-engine` (if touched) all pass.

## Notes

**Severity: Low-medium** — not a correctness bug (the live booking engine works correctly
on its own), but a real maintenance-cost and documentation-accuracy issue: three sizeable,
tested code paths (`/v1/roadmap/regenerate`, `/v1/progress`, `/v1/calibration/prompt-detail`)
currently do nothing for any real user, and `.work/STATUS.md` currently describes one of
them in a way that overstates its live status. Flagging as HITL because "should we delete
working, tested code" and "should we invest in wiring it up instead" are product/architecture
calls, not something to decide unilaterally while fixing a bug.
