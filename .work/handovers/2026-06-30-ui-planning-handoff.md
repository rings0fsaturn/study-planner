# Handover — UI/UX planning for the material/session decoupling

**For:** a fresh Cowork planning session (study-planner-web planner/reviewer role).
**Goal:** plan the **UI/UX** for the four screens affected by the decoupling redesign —
**onboarding page 3, Home, Session, Roadmap** — to the locked design. The intelligence/research side is
already handed off separately and runs in parallel.
**Your output:** UI plan(s) under `.work/plans/active/…` (you may split per page). You are the planner —
read-only on code (`apps/ packages/ …`), describe the UI, don't implement it.

---

## 1. Read first (the design is already decided — don't re-litigate)

1. **`.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md`** — the SoT. D1–D11 locked.
   Pay attention to D1 (decouple), D2 (dial planned + actual), D3/D10 (material-based progress + partial
   position capture), D4 (interrupt auto-log), D5 (soft cap), D6/Q3 (pace-first recommendation), D7 (dial
   UX), D9/D9a (session-booking model, soft-suggest preferring in-progress material), D11 (legacy adapter
   + bookings as `SessionBooked`/`BookingEdited`/`BookingCleared` events).
2. **`.work/plans/active/2026-06-30-material-session-decoupling/SessionDial.jsx`** — the working dial
   prototype (fixed 270° scale, rotating planned knob, actual ring teal→amber→red, cap notch, recommended
   marker). This **is** the Session-screen dial direction — build the plan around it.
3. **§5b of DECISIONS.md** — deferred UI items to fold in: material directory view on the Roadmap page;
   non-YouTube progress-marking affordances (in-session + in-directory).

## 2. Per-screen scope

- **Onboarding page 3** (`apps/app/src/onboarding/steps/Step3Materials.tsx` + `Step3Preview.tsx`) — where
  the current bug lives. New flow: capture **capacity + material list**, then show the **booked-session
  layout** (blank bookings = date + estimated duration, capacity-only) — **NOT** day-by-day material
  packing (that packing is the bug; it's gone). Soft-suggested material per booking (overridable),
  preferring in-progress materials. The dial appears to confirm/adjust.
- **Home** (`apps/app/src/pages/Home.tsx`) — the day's **booking** shows with its material pre-loaded;
  user confirms planned length on the dial + confirms material → starts. No booking today → browse the
  **material directory** or start ad-hoc (auto-creates a booking, D9a #3).
- **Session** (`apps/app/src/pages/Session.tsx`, `session/`) — the dial (SessionDial.jsx): planned length
  + actual timer that can overrun; **interrupt** = auto-log partial, material stays open (D4); **complete**
  = material done (D3); partial **position capture** for non-YouTube at end (D10).
- **Roadmap** (`apps/app/src/pages/Roadmap.tsx`, `Roadmaps.tsx`, `roadmap/RoadmapCalendar.tsx`,
  `calendarModel.ts`) — retrospective **activity** (past) + **future bookings** (blank/suggested); click a
  booking → attach/swap material; click an empty day → "add a session" (creates a booking); **material
  directory view** (browse materials + per-material progress); the **ETA / burn-up** display.

## 3. Constraints, dependencies, gotchas

- **ETA visuals depend on open question #3** (the GP+analytic composite), which is **proposed, gated on the
  research R4 benchmark** (separate Opus handoff). Design the burn-up / finish-date / verdict UI to the
  proposed composite, but mark those elements **provisional** until R4 lands.
- **`deriveSlotStatuses` is being replaced** (D9): calendar reads per-material ledger + per-day activity +
  booking status by `bookingId`. Status enum: past = active/idle; future = booked/open; done/missed/unplanned
  keyed by booking.
- **Reuse the design system:** `packages/design-tokens` (Marginalia), `apps/app/src/components` (AppShell,
  NavBar, Field, Button, Card, Tag). Honour the existing rules: React Router `basename="/study"` (never put
  `/study` in `to`), form spacing tokens, etc. (see `.claude/rules/`).
- **Multi-roadmap lifecycle exists** (recently-built Roadmaps dashboard: active/queued/abandoned, date-window
  attribution, `findActiveRoadmap`) — the booking model must slot into it; ground in the current code before
  planning (STATUS.md "Roadmaps dashboard" rows).
- Planner constraints: read-only code; write only to `.work/**`; Step-0-commit-docs + VERIFICATION.md
  instructions in each plan preamble (Cowork can't commit).

## 4. Definition of done

- [ ] UI plan(s) in `.work/plans/active/…` per the `write-implementation-plan` format, phased into
      independent vertical slices, grounded in the real components above (verify paths/symbols).
- [ ] Each page's plan states what it renders from the new derivations (ledger / daily activity / bookings)
      and flags ETA elements as provisional-pending-R4.
- [ ] Deferred UI items (§5b) folded in.
- [ ] Open UI questions logged, not silently resolved.

## 5. State of the broader effort (for context)

- **Locked:** D1–D11. **Proposed/gated:** #3 ETA composite (research R4). **Open plan-time:** replan service
  contract; Pillar-A claims-ledger note; multi-roadmap lifecycle interaction.
- **Parallel work:** research model-selection plan in progress with Opus
  (`.work/handovers/2026-06-30-research-eta-model-selection.md`).
