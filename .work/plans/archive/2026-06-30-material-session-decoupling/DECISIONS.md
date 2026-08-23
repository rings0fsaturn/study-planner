# Material ↔ Session decoupling — decisions scratchpad

> **Status:** active design discussion (grilling). Living document — **append every new
> decision here as we make it.** Not yet an implementation plan; this is the decision log
> the eventual `PLAN.md` will be built from.
> **Started:** 2026-06-30 · **Owner:** Rohit (design) + Cowork (planner)
> **Companion:** [`SessionDial.jsx`](./SessionDial.jsx) — the live dial prototype.

## Legend

`✅` locked (agreed) · `🟡` proposed / awaiting confirmation · `☐` open (not yet discussed/resolved) · `🛑` blocked

---

## 1. Why this work exists

- **Trigger:** the roadmap engine is buggy at `study/onboarding/3?new=1`. Root cause is the
  *prescriptive* packing: it force-fits each Material onto a specific calendar day as a
  `Slot`, and the boundary "tie" slots (`candidateMaterialIds = [...ids, '__rest__']`,
  `plannedMinutes = 0`) plus tie-resolution / `addMaterialToRoadmap` mishandle session-title
  counts and role inference.
- **Goal:** stop assigning materials to fixed days. Make **materials a browsable directory**;
  the user **picks a material at session start** and runs the existing timer. The engine no
  longer dictates a per-day grid — it **estimates completion time vs the deadline** from
  material lengths + planned capacity, and **recommends** (not dictates) session length.

## 2. Current-state facts (ground truth, verified in code)

These are what the redesign changes — recorded so the plan is grounded, not from memory.

- **Slot = a material pinned to a day.** `Slot { weekIndex, dayOfWeek, date, capacityMinutes,
  plannedMinutes, candidateMaterialIds, role, sessionTitle }` (`packages/roadmap-engine/src/roadmap-engine.ts`).
- **Start-session is pre-bound today.** `Home` reads the next `Slot`, builds `SessionSlotData`,
  hands it to `/session`. The user does not choose what to study.
- **`SessionLogged` payload** carries `materialId, slotDate, weekIndex, plannedMinutes,
  activeMinutes, duration, date, source, resolution` (`apps/app/src/session/types.ts`).
- **Attribution today** = `deriveSlotStatuses` (`packages/progress/src/deriveSlotStatuses.ts`):
  match a session to a slot by **exact `date` + `materialId ∈ candidateMaterialIds`**, FCFS;
  unmatched → "unplanned". Emits done / pending / skipped / unplanned.
- **Calibration reads `plannedMinutes` straight off the event** (`packages/progress/src/calibration.ts:57–100`),
  not from a slot. Pace ratio today = `activeMinutes / plannedMinutes`, filtered to
  `source==='active' && plannedMinutes>0 && activeMinutes>0`. **→ calibration is already
  decoupled from the dated grid.**
- **Pillar A as actually implemented** (the architecture diagram is STALE):
  - Pace Calibration — hierarchical **Bayesian** (`bayesian.ts`); research winner that overturned
    the null is **`enriched_shrink`** (log-linear + context features, `dual_prior`) in the Python
    `py-progress` tier; TS `bayesian.ts` is the shipped fallback.
  - Change Detection — **CUSUM** (`cusum.ts`); literature verdict was a **robust null** (nothing beat it).
  - **Kalman per-phase trend** (`kalman.ts` via `trend.ts`) — segments the pace series at CUSUM
    breakpoints; **this box is missing from the stale diagram.**
  - Progress Projection — **GP burn-up** (`gp.ts` / `progress.ts`); honest interval story is
    across-learner split-conformal in the research tier.
  - **Schedule Generator** = the roadmap-engine greedy interleaving packer — **the one box this
    redesign retires.**

---

## 3. Locked decisions ✅

### D1 — Decouple sessions from the dated slot grid; materials become a directory ✅
Drop the prescriptive day-by-day `Slot` assignment. Materials live in a browsable **directory**;
the user **picks a material at session start**, then sets a session length. The engine's job
shrinks to **capacity model + finish-date projection**, not per-day packing.
- **Scope = end-to-end:** onboarding (page 3), Home (start-session), Session, Roadmap. (Confirmed
  by Rohit's request to redesign all four pages.)
- **Why:** the bug, the rigid up-next, and the brittle calendar are all symptoms of slots being
  prescriptive.

### D2 — Two session inputs: planned length (dial) + actual length (timer) ✅
At start, after picking the material, the user sets a **planned length** on a dial (Input 1).
Then the **actual** timer runs and **can overrun** past planned until they close it (Input 2).
Both inputs feed the intelligence layer. *(See P1 — how `planned` relates to calibration is being
revised.)*

### D3 — Progress is material-based, with per-material completion captured ✅
The user is trying to finish **materials**, not log hours. Each material tracks `estimatedMinutes`
vs `loggedMinutes` + a completion signal. **Capture:** YouTube/playlist auto (video timer /
`videosCompleted`); articles & manual the user keys in. *(Being extended to partial position — see P1.)*

### D4 — Interrupted / partial sessions auto-log; material left open ✅
A partial session that's interrupted (incl. crossing midnight) **auto-logs its real
`activeMinutes`** with `resolution:'interrupted'` and leaves the **material open** to resume next
session. `End · complete` logs and marks the material **done**. The material (not the session) is
what "resumes" — a session stays bounded to one calendar day for clean per-day attribution.
- **Changes current behaviour:** today `stale_midnight` → `SessionAbandoned` (logs nothing). New
  behaviour logs the partial.

### D5 — Soft-cap dial driven by daily budget ✅
Soft cap = `hoursPerDay − minutesAlreadyLoggedToday`, applied on **any** day (planned or not — the
user may study any day). The dial defaults its **recommended** length within the cap; the user can
dial past it and the live timer can overrun it (visual indicator, choice stays theirs). A second
same-day session sees a reduced cap.

### D6 (Q3) — Recommendation is pace-first ✅
The recommended session length is **capped at a realistic ceiling = the user's stated remaining
daily budget (cap)**. Within that, it nudges from demonstrated pace toward the deadline-required
rate. When even the cap can't hit the deadline, the app **stops recommending an impossible number**
and surfaces the levers: **extend the deadline / drop or shorten materials / accept the later
finish**. The dial still lets the user voluntarily blow past the ceiling.
- `requiredDailyMinutes = (remaining material × throughputFactor) ÷ remaining days to deadline`,
  compared against `demonstratedDailyMinutes`.

### D7 — Dial UX (prototype direction) ✅
Real twist-to-set-timer model: **fixed 270° scale** anchored to the daily budget (printed minute
ticks, only rescales when hours/day changes). Four roles on four layers so none occludes another:
**planned** = draggable blue knob (rotate to set); **actual** = bold inner ring, colour-staged
teal (≤ plan) → amber (> plan) → red (> cap); **cap** = dashed bezel notch; **recommended** =
purple bezel triangle (flips to red "risk" flag under D6 infeasibility). Prototype: `SessionDial.jsx`.

---

### D8 — The intelligence layer calibrates THROUGHPUT (time ÷ material), not session-length adherence ✅
*Confirmed by reading the A-series synthetic generator (see verification below).*

Two signals, both using **time + material completion**:

1. **Throughput pace** = `actual minutes ÷ estimated material minutes consumed`, captured **per
   session including interrupted ones** (via **partial material position** — see below). → feeds
   **Pillar A** (Bayesian/CUSUM/Kalman, **math unchanged**) → drives the **finish-date / ETA** and
   the throughput factor in D6.
2. **Session-length adherence** = actual vs the dial's planned target. → a **lighter, separate
   signal** → drives the **recommended session length**. **Interrupted sessions are excluded here**
   (the cutoff was external, not a choice); complete-but-short sessions stay in.

- **Why this preserves Pillar A:** in the old slot model `planned` was the slot's *material chunk*
  (≈ estimated material time), so `active/planned` was *already* throughput. Feeding throughput
  keeps the **same validated signal**, just sourced from material position instead of a slot.
  Using the *dial value* as the calibration denominator (the earlier D2 reading) would have
  silently changed the signal to adherence and broken that — **this corrects D2.**
- **Requires:** completion capture (D3) extended from binary → **partial position**: free for
  video (timer position), a light "where'd you get to" for articles/manual, default-inferred from
  `logged ÷ estimated` if skipped.
- **Resolves concern #1** (interrupted 30 min is a real signal — it lives in throughput) and
  **concern #4** (throughput stays its own ratio; Pillar A machinery unchanged).

**Verification — A-series synthetic generator models a time-vs-material signal ✅**
(`research/comparison/src/research_comparison/generator/`)
- `generate.py` `PlannedSlot.planned_minutes = sample_chunk_minutes(material_type)` — `planned` is
  a **material chunk** (playlist 20–50, textbook 40–90, practice ~45, flashcards 10–20 min), not a
  time budget.
- `_event_for_slot` (gen.py:140–141): `plannedMinutes = planned_minutes`,
  `activeMinutes = planned_minutes * ratio` → `activeMinutes / plannedMinutes = ratio`.
- `ratio` ← `latent_base = m_global × role_rho × tau × weekend` (`pace.py`) — the ground-truth pace
  multiplier the calibration estimates.
- `_true_finish_date` (gen.py:110–116): `cumulative += planned_minutes * latent` until
  `sum(material.total_minutes)` — the finish date is *material consumed at pace*.
- **Conclusion:** the calibrated quantity is the multiplier on **material time** = throughput.
  Feeding the product calibration `actual ÷ estimated-material-consumed` is the **same signal shape
  → no re-validation needed.**

### D8a — Interrupted / partial-chunk throughput points ✅
*Confirmed: include them.* The generator only emits **full-chunk** sessions (no
partial-chunk events), so interrupted sessions' throughput points (`partial est ÷ actual`) use the
**same ratio definition** but weren't explicitly in the validation set.
- **Rec:** **include** them in calibration (real users get interrupted often; the ratio is in-family)
  + add a one-line external-validity note in the Pillar-A claims ledger + let Research Phase 5
  (N=1 real-data) sanity-check partial points.
- **Alternative:** complete-sessions-only in calibration (purest match to validation); interrupted
  sessions feed material progress + daily-minutes only.

### D9 — Roadmap = a session-booking model (resolves open #2's calendar fork) ✅
The roadmap keeps a **forward plan**, but as **blank session bookings**, not material-packed slots.
- **Engine = capacity layout only.** From `startDate, deadline, selectedStudyDays, weekday/weekendHours`
  it lays out **booked sessions** = `{ id, date, estimatedDuration, materialId?, status }` (dates +
  estimated durations). It does **NOT** pack materials — no `candidateMaterialIds`, no role-tie
  resolution, no `__rest__`. **This reduction is what kills the `/onboarding/3` bug.**
- **Advance booking:** on the Roadmap page the user clicks a future blank booking → attaches a
  material to it. Or leaves it blank and picks at start.
- **Non-planned days:** click an empty day cell → "no sessions planned — add one?" → same
  add-session UX → creates a booking on that day.
- **Study day (Home):** the day's booking shows with its material pre-loaded; the user confirms the
  planned length on the dial (defaults to `estimatedDuration`) + confirms the material → starts.
- **Calendar:** past = activity/done; future = bookings (with/without material). Status enum
  (done / booked / missed / unplanned) returns, keyed by **`bookingId`** (exact match, replacing the
  fuzzy date+materialId FCFS matching of `deriveSlotStatuses`).
- **Editable:** the Roadmap page allows add/move/remove bookings, change durations, attach/detach
  materials (replaces the old slot-coordinate `RoadmapEdited` events).
- **Week page target** = capacity (`hoursPerDay × study-days that week` / booked-session minutes),
  not summed slot-planned minutes.

## 4. Recently resolved (this session)

### D9a — booked-session shape & material relationship ✅
1. **Cardinality:** **one** material per booked session (matches the dial flow; a long material spans
   consecutive bookings).
2. **Soft-suggest, overridable:** the engine suggests a material per booking via spaced-practice ordering
   (foundation→anchor→practice, interleaving), **preferring a material that's already in-progress**
   (resume/continuity before opening new material). Non-binding — the user can swap or clear it.
3. **Attribution:** `SessionLogged` carries `bookingId` (exact match). A spontaneous Home start with no
   booking auto-creates a booking for today.
4. **Edit events:** booking-edit events replace slot-coordinate `RoadmapEdited`; exact shape deferred to
   the implementation plan.

### D10 — Material progress marking (extends D3) ✅
- **YouTube/playlist:** auto from the video timer / `videosCompleted`.
- **Non-YouTube (article/textbook/practice/manual):** the user marks progress as a **progress rate**
  (% / position). Available **(i)** within the session (at end; optionally adjustable during) **and**
  **(ii)** from the Roadmap material directory, any time.
- **Throughput rule:** only **session-bound** progress (paired with actual minutes) feeds the throughput
  calibration (D8). An **out-of-session** edit from the directory updates the material ledger and the
  ETA's "remaining," but does **not** produce a pace data point (no time component).

### D11 — Legacy roadmaps via read-time adapter; bookings are first-class events ✅
The app is **event-sourced** (append-only, synced to Supabase, replayed) — so **never rewrite history.**
- **Old slot-based roadmaps:** extend `mapEvents.ts` to **adapt on read** — capacity + materials come from
  the existing `RoadmapCreated` payload (`weekdayHours/weekendHours/selectedStudyDays`) + `MaterialAdded`;
  **future slots → derived bookings** (date + estimatedDuration + suggested material = `candidateMaterialIds[0]`);
  past `SessionLogged` already carry `materialId`/`date` → feed the material ledger directly.
- **New bookings = their own events:** `SessionBooked` / `BookingEdited` / `BookingCleared` (mutable —
  add/move/remove/attach/detach). `RoadmapCreated` for new roadmaps carries capacity + deadline + materials,
  **not** slots or bookings. **This also resolves D9a #4 (edit-event shape).**
- **Why:** event-sourcing-correct — no destructive migration to fight sync / risk cross-device divergence;
  one mapper, no second legacy UI. (Alternatives rejected: one-time event rewrite; legacy read-only calendar.)

---

## 5. Open questions ☐ (not yet resolved)

- ~~**#2 — Replacement for `deriveSlotStatuses`.**~~ **RESOLVED → D9** (session-booking model).
  Derivations become: per-material ledger + per-day activity + booking-status by `bookingId`.
  Sub-forks in D9a.
- **#3 — ETA / projection redefinition.** 🟡 **QUALIFIED by R4:** GP extrapolation of the
  material-done curve remains the finish-date base. The `gp_plus_analytic` composite is validated only as
  a **small-plan / cold-start fallback layered on GP**: it beats `gp_ard` under held-out + Holm on the
  small band only, is worse on max, and `analytic_required_rate` never wins. Do **not** claim this as a
  general GP replacement. Reference-line eval is still deferred; conformal remains the coverage fix.
  *Gates Home + Roadmap UI display with qualified copy.*
- **Lower-priority / plan-time:**
  - ~~Migration of existing slot-based `RoadmapCreated` events.~~ **RESOLVED → D11** (read-time adapter;
    bookings as first-class events).
  - Replan service contract (`/v1/roadmap/regenerate` currently returns slots) → becomes a
    re-projection / capacity-deadline adjust. *(Still open.)*
  - One-line note in the Pillar-A claims ledger that calibration's `planned` reference changed source.
  - Multi-roadmap lifecycle (active/queued/abandoned, date-window attribution) interaction with the
    material-set model.

---

## 5b. Deferred UI concerns (design later)

- **Material directory view on the Roadmap page** — let the user browse their materials + per-material
  progress from within the roadmap (not just attach-on-booking). UI concern, revisit during page design.
- **Progress-marking affordances** — the in-session and in-directory controls for D10 (how the
  % / position is captured per material type).

## 5c. Research / validation workstream (proof for the new design)

The refactor changes the **data-generating process** (session arrival + new event types), **not** the
**latent pace signal** (throughput; verified in D8). So validation splits three ways:
- **Transfers (re-confirm, don't redo):** calibration multiplier estimation
  (`enriched_shrink`/`dual_prior` vs baselines on `m_global`/context) — same signal, fed from material
  throughput.
- **Must re-run (cadence / new-event sensitive):** change-detection latency + false-alarm-rate, GP
  projection coverage, and the **new ETA composite** (never benchmarked).
- **Dropped:** the scheduling track (constrained packer retired; soft-suggest ordering is a lighter,
  separate KT concern).

Harness exists and is reusable (`research/comparison/`): 4 tracks, 200 seeds × 9 archetypes × 3 bands,
Holm + held-out, results stamped by `generator_version` / `params_version_hash`; adding a model = register
a candidate → auto-scored vs ground truth with paired-Holm vs incumbent. Projection candidates live in
`runners/projection.py:42-82`, scored by `metrics/projection.py` (coverage / MAE-days / sharpness vs
`GroundTruth.true_finish_date`).

- **R1 — Extend the generator** (keep the validated latent-pace core; add layers, each with ground truth):
  separate `plannedSessionMinutes` (dial choice) from the material chunk (adherence vs throughput); emit
  **interrupted / partial-chunk** sessions (D4/D8a); model **booking cadence + ad-hoc any-day** sessions.
  Bump `generator_version` (datasets coexist; nothing overwritten).
- **R2 — Calibration regression:** re-run; confirm the `enriched_shrink`/`dual_prior` win survives Holm +
  held-out with partial-chunk throughput points included. Down-weight partials if it degrades. *(Transfers
  only if reproduced.)*
- **R3 — Detection re-run:** re-score the 7 detectors under the new cadence; confirm the CUSUM robust-null
  holds when partials + irregular arrivals add noise.
- **R4 — ETA benchmark (headline new result):** register `analytic_required_rate` (B) and the
  `gp+analytic` composite (A+B) alongside `gp_ard/linear/conformal/kalman`; score vs `true_finish_date`,
  paired-Holm vs the GP incumbent. Also test cold-start fallback + linear-vs-capacity ideal line.
  **This is what proves the #3 design.**
- **R5 — Rigour parity** with the A-series (same seeds/archetypes/bands/Holm/held-out) → dissertation-grade,
  directly comparable.
- **R6 — Circularity guard (Research Phase 5, N=1 real data):** synthetic scoring is model-dependent and
  the new event types are where external validity is weakest — validate partial-chunk throughput + the ETA
  on real logged sessions before claiming.

**Consequence:** the **#3 ETA composite is 🟡 QUALIFIED after R4** — design the UI to use it as a
small-plan / cold-start fallback layered on GP, but the dissertation must not claim it as a general GP
replacement. R6 still guards external validity on real N=1 data.

## 7. UI/UX & build-plan decisions (grill session 2 — 2026-06-30)

> Second grilling session, focused on the **UI/UX** of the four screens + how the work is
> packaged into a plan. Foundation (engine reduction, new events, mapEvents adapter, the three
> derivations) is planned **here too**, not elsewhere. Goal: one cohesive, concrete plan family
> incorporating UI + UX + logic. Append every decision below as `D12+`.

### 7.0 Screen status index (catch-up — keep current)

| Screen | Status | Baseline (before) | Canonical proposed | Decisions |
|---|---|---|---|---|
| Onboarding page 3 | ✅ agreed | `mocks/baseline/onboarding-3.html` | `mocks/proposed/onboarding-3.html` | D13, D13a, D14, D14a |
| Home | ✅ agreed | `mocks/baseline/home.html` | `mocks/proposed/home.html` | D15 |
| Session — pre-session setup | ✅ agreed | — (new page) | `mocks/proposed/session-presession.html` | D15a, D16, D17 |
| Session — running | ✅ agreed | `mocks/baseline/session-running.html` | `mocks/proposed/session-running.html` | D18 (+D16/D17) |
| Roadmap (+ booking interactions) | ✅ agreed | `mocks/baseline/roadmap.html` | `mocks/proposed/roadmap.html` | D20, D21 |
| Week | ✅ no visual change | — | — (derivation only) | D19 |
| Replan window | ✅ agreed | `mocks/baseline/replan.html` | `mocks/proposed/replan.html` | D22 |

Cross-cutting locked: D12 (plan-here), D8/D8a (throughput), D9/D9a (booking model), D10 (progress capture),
D11 (events + read-time adapter). **Gated:** #3 ETA composite → research R4.
Rejected-but-retained option mocks: `mocks/proposed/onboarding-3-option{A,B,C}-*`,
`mocks/proposed/onboarding-3-left-options`, `mocks/proposed/session-presession-options`,
`mocks/proposed/roadmap-option{A,C}-*`.

### D12 — Planning scope & packaging ✅
The whole decoupling (foundation + UI + UX + logic) is planned in **this folder**. We will
clarify the UI/UX design through grilling first, then produce a concrete `PLAN.md` (+ companion
`VERIFICATION.md`) that incorporates UI, UX, and logic together. Open sub-question (revisit after
UI/UX is clear): whether to ship as one phased `PLAN.md` with a **Phase 0 foundation** slice + per-page
slices, or split into a prerequisite foundation plan + four page plans. Leaning: one phased PLAN.md,
Phase 0 = foundation (engine reduction + new events + mapEvents adapter + three derivations), then a
vertical slice per page. *(Confirmed by Rohit: "we will plan it here… UI, UX and logic all incorporated.")*

### D13 — Onboarding page-3 preview: summary + expandable calendar ✅
The day-by-day packing preview (`Step3Preview` + `SchedulePreview`, tie-resolution, swap-FAB) is
**retired**. Replacement = **Option A (capacity summary) with an embedded, expandable calendar**
(Option C's grid), chosen by Rohit from three mocked options (A summary / B booking-list / C calendar;
the losing two kept under `mocks/proposed/onboarding-3-option{A,B,C}-*.html` for the record).
Locked mock: `mocks/proposed/onboarding-3.html`. Shape:
- **Default view = summary:** a **Projected finish** verdict card, a backlog-fits-capacity bar, a
  sessions/total/buffer stat row, and an **unordered material directory** ("what you'll study"). No
  day-by-day grid by default.
- **Projected-finish card is a toggle:** clicking it **slides a calendar panel down** (pushing the
  cards below it down) showing booked study-days + finish + deadline; clicking again collapses it.
  Closed by default.
- **Discoverability (required by Rohit):** the card carries a **persistent "Calendar ⌄" pill** + a
  chevron that rotates on open, **hover elevation** (`--shadow-md` + border darken + 1px lift), a
  hover-revealed hint line, `cursor:pointer`, and keyboard support (`role=button`, `tabindex=0`,
  Enter/Space, `aria-expanded`/`aria-controls`).
- **Calendar is multi-month with ‹ › arrows** (Rohit: must page across months); arrows disable at the
  plan's month bounds. Reuses the real `roadmap-calendar-shell` grid classes.
- Finish-date / "estimate" labels flagged **provisional pending research R4** (#3) — shown with a
  `provisional` eyebrow.

### D13a — Booking generation rule ✅
**Book-to-exhaustion + buffer:** engine books one session per selected study-day (Mon/Wed/Fri in the
mock), each sized to that day's capacity, **stopping once cumulative booked minutes ≥ total material
minutes**; remaining days to the deadline render as **buffer**. (Chosen with D13; rejects "book every
study-day to the deadline" from option B.) Generation is pure counting — `ceil(totalMaterialMin ÷
per-day capacity)` study-days laid onto the soonest study-days — **no material-to-day assignment**, so
the `/onboarding/3` packing bug cannot recur.

### D14 — Onboarding page-3 LEFT panel: grouped-by-type material organisation ✅
Problem: the current flat vertical stack of full edit-cards (`MaterialRow`) grows unbounded — many
materials = endless ugly scroll. **Chosen = Option 2 (grouped by type)** from two mocked options in
`mocks/proposed/onboarding-3-left-options.html` (Option 1 flat accordion rejected; kept for record).
Now folded into the locked `mocks/proposed/onboarding-3.html`. Shape:
- **Compact, expand-on-edit row** is the atom: one slim line (type icon · title · length · role tag ·
  chevron); click reveals the inline edit fields; incomplete rows auto-open.
- **Collapsible sections by type:** **Videos / Playlists / Links & articles / Manual**, each with a
  count + total time; collapse finished buckets. Only non-empty sections render.
- **Material types supported:** YouTube **video** (`yt`), YouTube **playlist** (`pl`, new purple icon),
  **external URL/article** (`art`), **manual/book** (`bk`). Mirrors the four real `material-icon`
  colour classes already in `components.css`.
- **Playlist interaction (Rohit, D14a):** a playlist row **opens the existing `PlaylistPickerPopup`
  modal** (search + per-video checkboxes + bulk select + pagination + confirm) — **kept as-is from the
  current app**, *not* an inline checklist. Non-playlist rows still expand inline to edit. Modal
  reproduced faithfully in the mock from `onboarding/components/PlaylistPickerPopup.tsx`.
- **Open sub-points (defer to plan):** drag-reorder persistence; whether grouping should auto-engage
  only past N items (kept always-grouped for simplicity); empty-section handling on first add.

### ✅ PAGE 3 — UI AGREED (visual contract)
Onboarding page 3 design is **agreed and frozen as a visual contract**:
**`mocks/proposed/onboarding-3.html`** is canonical — the eventual `PLAN.md` and the implementer build
to match it. Covers D13 (summary + expandable multi-month calendar), D13a (book-to-exhaustion + buffer),
D14 (grouped-by-type materials, compact expand-on-edit rows), D14a (playlist → existing picker modal).
Baseline "before" = `mocks/baseline/onboarding-3.html`. Explored-but-rejected option mocks retained under
`mocks/proposed/onboarding-3-*` for provenance. Implementation notes to carry into the plan: ETA/finish
elements provisional pending R4; reuse real classes (`onboarding.css`, `roadmap-calendar-shell`,
`material-icon`, `playlist-picker-*`); new `pl` (purple) icon already exists in `components.css`.

---

### D15 — Home stays a launcher; material confirm + dial move to a new pre-session page ✅ / 🟡
**Home (D15, ✅):** stays exactly as today **except** the up-next/booking card labels its material as
**"Suggested material"** (not a locked assignment). No dial on Home. "Start session" routes to `/session`.
Mock: `mocks/proposed/home.html` (diff vs `baseline/home.html` = the card copy only).
**New pre-session page (D15a, ✅ — V1 chosen):** clicking Start lands on a **new setup step on the
Session route, before the timer runs** — confirm/swap the material **+ set planned length on the dial**
(D7) — then Start begins the existing running-session UI. Built faithful to `/session`
(`.session-frame`, eyebrow→title→subtitle, `material-strip`, `session-actions`). Dial **re-skinned to
Marginalia** (warm: ink knob, moss recommended, terracotta cap — the `SessionDial.jsx` prototype's
teal/blue/purple clashed) and **reduced to "set planned length"** (no running ring/timer yet).
**Chosen = V1 (Confirm card, stacked):** suggested material as the session title, the dial where the
timer will sit, "Change"/"Pick a different material" → material-picker modal, "Start session" (accent).
Reads as the pre-state of the running timer — the frame "comes alive" on Start. Canonical mock:
`mocks/proposed/session-presession.html`. Rejected V2 (split) / V3 (dial-forward) retained in
`mocks/proposed/session-presession-options.html`. ETA/recommended copy provisional pending R4.

### D16 — Session state model: pre-session runs once; Continue resumes the running timer ✅
Grounded in real code: the in-progress session is the **Dexie `activeSession` singleton (id=1)** =
`ActiveSessionRecord` (`session/types.ts`) holding `materialId, sessionTitle, plannedMinutes, startedAt,
status:'active'|'paused', pauseIntervals, videoPlaybackPosition, …`. It is the **local source of truth**;
the lifecycle **events** (`SessionStarted/Paused/Resumed/Logged/Abandoned`) flow through sync so other
devices reconstruct it. `SessionLifecycle.initialize()` loads any existing record on mount.

**Rule that prevents re-running the pre-req:**
- **Pre-session page (V1) shows ONLY on a fresh start** — i.e. `state==='idle'` and **no `activeSession`
  record** yet. It is the step that *creates* the record. Today `Session.tsx` auto-calls `lc.start(slotData)`
  when `idle && slotData`; the change is to **render the pre-session page instead of auto-starting**, seeded
  with the booking's suggested material + `estimatedDuration` as the dial default.
- **"Start session"** (on the pre-session page) → `lc.start(...)` writes the `activeSession` record with the
  **confirmed/swapped `materialId`** + the **dial's `plannedMinutes`** and emits `SessionStarted`. From here
  on, an active record exists.
- **"Come back later"** → `lc.pause()` writes `status:'paused'` (+ saves `videoPlaybackPosition`) and emits
  `SessionPaused`; the record **persists**. (Navigates to Home.)
- **Continue** → Home shows the **"Continue session"** card whenever the `activeSession` record exists
  (already implemented: `eventStore.table('activeSession').get(1)`). It routes to `/session` with **no
  slotData**; `initialize()` finds the existing record → `state!=='idle'` → **renders the running timer
  layout directly, bypassing the pre-session page.** Resume is one tap.
- **Session tab with nothing running** (no record): instead of today's bare "No active session" empty state,
  show the **pre-session page seeded with today's booking/suggested material** (or the directory to pick) —
  a strict improvement, same component.

**Implementation notes for the plan:** `ActiveSessionRecord` + `SessionStartedPayload` gain **`bookingId`**
(D9a #3 / D11) and the slot-era fields (`slotDate`, `weekIndex`) become derived/deprecated. The only
behavioural change to the running screen's resume path is **none** — Continue already bypasses start; we are
only inserting the explicit pre-session step on the *fresh-start* branch that currently auto-starts.

### D17 — The dial is PRE-SESSION ONLY; the running session keeps the existing numeric timer ✅
**Corrects/scopes D2 & D7.** The `SessionDial` is used **only on the pre-session setup page (D15a/V1)** to
**set the planned length** before starting. It does **NOT** appear on the running session screen. The
running screen keeps the **current `TimerDisplay`** (big numeric elapsed) and its existing layout
(`SessionDefaultLayout` / `SessionYouTubeLayout`) **unchanged** — explicitly rejecting the earlier
"timer becomes the dial / live actual ring (teal→amber→red)" idea from the `SessionDial.jsx` prototype's
running state. (Rohit: "The timer becomes the dial — False, i don't want that in running session page.")
- **Consequence:** the dial's "actual ring", overrun-as-ring, and live cap-on-dial visuals are **not built**.
  `plannedMinutes` is captured once on the pre-session dial; the running timer shows elapsed as it does today
  (overrun still indicated the **current** way — terracotta numeric + planned-end line/banner).
- **D2 restated:** Input 1 (planned) = pre-session dial; Input 2 (actual) = existing running timer. Both still
  feed the intelligence layer (D8); only the *running UI* is unchanged.

**Running-session changes that DO remain (no dial):**
- **D4 — end controls split:** `End · complete` (log + mark material done) / `Interrupt` (auto-log partial,
  material stays open) / `Pause · come back later` (resume same session, nothing logged). Replaces today's
  single End + the `stale_midnight → SessionAbandoned` no-log path.
- **D10 — end-of-session position capture** for non-YouTube (% / position), on complete *and* interrupt;
  YouTube/playlist stays automatic.
- **D3 — material strip** shows logged-vs-estimated progress (optional in-session nudge).
- **D8 — throughput** computed from actual + captured position (backend; no running-UI change).

### D18 — Running-session redesign (D4 + D10), decided by frontend-design principles ✅
Rohit: "use frontend-design principles for UI decisions." Decisions, with the principle behind each:
- **Progressive disclosure → one primary `End session`, not three end-buttons.** Tapping End opens an
  **end-of-session bottom sheet** that handles *both* D4 (complete vs keep-open) and D10 (position) — keeps
  the live screen calm; defers the "did I finish?" decision to when it's actually answerable.
- **Quiet resume stays:** `Pause · come back later` remains the ghost/tertiary action (resume same session,
  nothing logged — the D16 path). Visual hierarchy: one accent primary, one ghost tertiary.
- **End sheet contents:**
  - **Positive reinforcement:** "13m logged for this session" up top.
  - **D10 position capture (non-YouTube):** quick presets (¼ ½ ¾ Done) **+** a % slider — *recognition over
    recall*, low-effort, with a precise fallback. (YouTube/playlist: auto from video progress, read-only.)
  - **D4 completion choice:** two clear options — **"↺ Keep open / continue later"** vs **"✓ Finished /
    mark material done"** — with a **smart default** wired to position (100% → Finished, else Keep open).
    *Forgiveness:* nothing destructive; "Back to session" cancels; Interrupt-equivalent = log + keep open.
  - "This session was unusual" moves into the sheet (it's an end-time judgement).
- **Running screen otherwise unchanged (D17):** same numeric timer, frame, eyebrow, open-material. The
  **material strip gains a progress sub-line** (logged-vs-estimated bar, D3).
- **Consistency/a11y:** reuses `session-actions`, `btn-*`, `checkbox-box`, `modal-overlay` (bottom-sheet on
  mobile, centered on desktop); colour from tokens (moss = finished/progress, ink = selection).
- Mocks: baseline `mocks/baseline/session-running.html`; proposed `mocks/proposed/session-running.html`
  (interactive: tap End → sheet; slider/presets drive the smart default). ETA/“over plan” still shown the
  current way (terracotta numeric + planned-end line) — no dial on this screen (D17).

### D19 — Week page: no visual redesign; derivation-only change ✅
The Week page (`pages/Week.tsx`) keeps its current UI (week nav, verdict, "logged Xh against Yh target",
sessions/hours, `DailyMinutesChart`, `BurnUpChart`, slipping→Replan CTA). Decoupling changes only what feeds
it:
- **Weekly target (D9):** `weeklyStats.plannedMinutesThisWeek` is recomputed from **capacity**
  (`hoursPerDay × study-days that week`, or that week's booked-session minutes) instead of summed slot
  `plannedMinutes`. Same text/line, new source — a Phase-0/`mapEvents`+`progress` change.
- **Burn-up planned line + verdict** ride on the projection → flagged **provisional pending R4** (#3).
- **Replan CTA** stays; its target (replan service contract) is a separate open item.
- **Declined:** optional "booked vs unplanned day" marker on `DailyMinutesChart` — kept out of scope to keep
  the change tight (Rohit: leave Week visually untouched). No Week mock built.

### D20 — Roadmap page redesign (🟡 designing)
Baseline mocked (`mocks/baseline/roadmap.html`): current slot-based calendar — header + progress card,
month-nav, 4-status legend (done/planned/skipped/unplanned), bubble grid (`CalendarCell` →
`roadmap-bubble` chips), footer (complete/abandon/edit-disabled/replan), detail modals. Built on
`deriveSlotStatuses` — **being replaced** (D9).
**Redesign scope (to mock):**
- **Calendar status semantics (D9):** past = **activity** (done) / unplanned-logged; future = **bookings**
  (booked, with/without suggested material) / missed. Keyed by `bookingId` (exact), replacing the fuzzy
  date+materialId FCFS. Legend changes: done / **booked** / missed / unplanned.
- **Future bubble** shows a booking ("Session · 1h", or suggested material) — visually distinct from past
  activity (e.g. outlined vs filled).
- **Click a future booking → attach/swap material; click an empty day → "+ add a session"** (creates a
  booking). Booking edit (move/duration/attach/detach/remove) replaces slot-coord `RoadmapEdited` →
  `SessionBooked`/`BookingEdited`/`BookingCleared` (D11). `SessionDetailModal` becomes a booking editor.
- **Material directory view (§5b):** browse materials + per-material progress; mark progress out-of-session
  (D10(ii)). Placement is the key structural fork (tab vs panel vs split).
- **ETA / burn-up (#3):** finish-date projection + burn-up, **provisional pending R4**.
**Options rendered (choose one):** all three fold in the new statuses (Done/Booked/Missed/Unplanned),
future **bookings as outlined bubbles** vs past **activity filled**, blank booking = "Session · pick at
start", **"+ add session"** on empty in-month days (hover), a **material directory** (per-material progress
+ "mark progress"), and a header **ETA card** (finish Jul 13 + burn-up sparkline, `provisional`).
- **A — Calendar / Materials tabs** (`roadmap-optionA-tabs.html`): one view at a time; least clutter; extra
  tap to reach materials.
- **B — Directory panel below calendar** (`roadmap-optionB-panel.html`): calendar always visible, collapsible
  Materials panel under it; good default; long-scroll on mobile.
- **C — Split calendar + directory** (`roadmap-optionC-split.html`): side-by-side on desktop; materials always
  in view; tighter calendar width; stacks on mobile.
**Common sub-decisions folded in:** future=outlined/dashed bubble, past=filled status chip; ETA as a dedicated
header card (replaces the plain progress card); add-session affordance on empty days.
**✅ Chosen = Option B (directory panel below calendar).** Canonical mock: `mocks/proposed/roadmap.html`
(copy of the fixed Option B). Rejected A (tabs) / C (split) retained under `mocks/proposed/roadmap-option*`.
**Bug fixed:** the option mocks rendered only 4 week rows — July 2026 needs **5** (week of Jul 27–31 was
missing, which looked like a clipped calendar). Fixed in Option B + the canonical file; a note for the plan:
the real grid comes from `buildMonthGrid` so it's correct in-app — the bug was mock-only, but flags that any
month-grid mock must render all 5–6 rows.

### ✅ ROADMAP — UI AGREED (visual contract)
Chosen **Option B** frozen as the visual contract: **`mocks/proposed/roadmap.html`** is canonical. New booking
statuses (Done/Booked/Missed/Unplanned), outlined future bookings vs filled past activity, blank booking =
"Session · pick at start", "+ add session" on empty days, collapsible material directory (per-material
progress + mark-progress), header ETA card (finish + burn-up sparkline, **provisional pending R4**). Baseline
"before" = `mocks/baseline/roadmap.html`. Rejected A/C retained under `mocks/proposed/roadmap-option*`.

### ✅ ALL FOUR SCREENS — UI AGREED
Onboarding p3 (D13/D13a/D14/D14a) · Home (D15) · Session pre-session V1 (D15a) + running (D18) + state model
(D16) + dial-pre-session-only (D17) · Roadmap (D20) · Week no-visual-change (D19). Each has a frozen
`mocks/baseline/*` and a locked `mocks/proposed/*`. These mocks are the **visual contract** for the PLAN.md.

### D21 — Booking interaction model ✅ (wired into canonical `roadmap.html`)
How bookings behave on the Roadmap (D9/D9a/D11). Mocked into the canonical `roadmap.html` as interactive
sheets:
- **Edit a booking** (click a future booking bubble) → **booking editor** sheet: attached/suggested material
  (Swap / Clear / Attach → material picker), **duration stepper** (−/+ 15m; *not* the dial — D17), **Move to
  another day**, **Remove booking**. Save → `BookingEdited`; remove → `BookingCleared`; detach material →
  `BookingEdited(materialId:null)`.
- **Add a session** (click "+ add session" on an empty day) → **add-session** sheet: duration stepper
  (cap-aware note), optional Attach material else "leave open — pick at start". Add → `SessionBooked`.
- **Material picker** reused (radio list, suggested pre-selected) for attach/swap.
- Principles: duration via stepper (quick, bounded) not the dial (dial stays the pre-session planned-length
  instrument); destructive **Remove** is a quiet ghost, not primary; suggested-preferring order on attach.
- **Balance refinement (Rohit feedback — "cluttered, left-aligned, empty right space"):** switched to a
  **settings-row layout** — label left / control right, `justify-content:space-between` so rows fill the
  sheet width (no lopsided gap). Material collapsed from a card + two buttons into **one tappable material
  card** (opens the picker; picker now carries the "No material · pick at start" option — removes the
  Clear/Swap button clutter). Softer sentence-case labels (not shouty mono-caps), one full-width primary,
  Remove as a small centred ghost link. Alignment + whitespace balanced; fewer competing elements.

### D22 — Replan window redesign (🟡 designing)
**Current (`pages/Replan.tsx`, baseline `mocks/baseline/replan.html`):** full `/replan` page that previews a
**regenerated slot grid** via `SchedulePreview` (weeks/planned/warnings summary) + Apply / Keep current;
`?intent=extend` adds a week; built on `mapToRegenerateRequest` → `replanRoadmap` → `/v1/roadmap/regenerate`
(returns slots). **This whole slot-regen preview is retired** (D1/D9).
**Redesign — replan = pull levers → re-project finish (D6), no slot repack.** Triggers: Week "Replan the
rest" (slipping), Home `RecalibrationModal` → Replan (pace changed), Roadmap footer Replan (manual).
Content: **why** (context: "at this pace you'll finish Jul 28 — 8 days past Jul 20"), the **levers** —
(1) **extend deadline**, (2) **adjust capacity** (hours/day + study days), (3) **drop or shorten materials**,
(4) **accept the later finish** — and a **live projected-finish** that updates as levers move (**provisional
pending R4**), then Apply / Keep current. Emits capacity/deadline/material edits + re-projection, **not**
slot regen; replan service contract (`/v1/roadmap/regenerate`) becomes a re-projection/capacity-deadline
adjust (open item).
**Options rendered (full `/replan` page; live finish updates as levers move — illustrative model,
provisional pending R4):**
- **A — single column** (`mocks/proposed/replan-optionA-single.html`): context banner → **sticky live-finish
  card** → stacked lever cards (extend / capacity / drop-shorten) → Apply / Keep current. Mobile-first, linear.
- **B — split** (`mocks/proposed/replan-optionB-split.html`): levers left, **sticky outcome panel right**
  (new finish + delta + "was" + Apply/Keep). Desktop cause↔effect side-by-side; stacks on mobile.
Both: levers = extend-deadline presets, hours/day stepper + study-day chips, per-material Drop; "Keep current"
= **accept the later finish** (D6's 4th lever). Chose full-page over modal (too many levers + live preview for
a modal).
**✅ Chosen = Option B (split levers + sticky outcome).** Canonical mock: `mocks/proposed/replan.html`.
**Materials-lever fix (Rohit):** the heading said "Drop **or shorten**" but only Drop existed. Now each row
has a **remaining-length stepper (shorten)** — state line shows `planned` / `shortened · was Xh` / `dropped` —
**plus a `×` to drop** (remaining→0). Control now matches the label; both shrink the backlog and move the live
finish. Rejected A retained at `mocks/proposed/replan-optionA-single.html`. ETA/finish provisional pending R4.

### ✅ REPLAN — UI AGREED (visual contract)
**`mocks/proposed/replan.html`** is canonical (Option B): full `/replan` page, split **levers (left) + sticky
live-outcome panel (right)**. Levers = extend-deadline presets · hours/day stepper + study-day chips ·
per-material **shorten stepper + × drop** · "Keep current" = accept the later finish (D6). Live projected
finish is **provisional pending R4**. Baseline "before" = `mocks/baseline/replan.html` (retired slot-regen
preview). Rejected A retained at `mocks/proposed/replan-optionA-single.html`. Replaces the slot-regen model:
replan now = capacity/deadline/material edits → re-projection (service contract `/v1/roadmap/regenerate` →
re-projection is an open plan-time item).

### ✅ DESIGN PASS COMPLETE
All screens agreed with frozen baselines + locked proposed mocks (see §7.0 index): onboarding p3, Home,
Session (pre-session + running), Roadmap (+ bookings), Week (no-visual), **Replan**. `DECISIONS.md` D1–D22 is
the source of truth; the `mocks/` are the **visual contract** for the eventual `PLAN.md` (Phase 0 foundation →
per-screen vertical slices; ETA elements gated on research R4).

<!-- append D23+ here as the grill resolves them -->

## 6. Change log

- **2026-06-30** — Document created. Captured D1–D7 + Q3 (D6) as locked; P1 (throughput
  realignment) as proposed/pending; concerns #2, #3 and lower-priority items as open.
- **2026-06-30** — Verified the A-series synthetic generator models a time-vs-material signal
  (`planned_minutes` = material chunk; `active = planned × pace`). **P1 confirmed → locked as D8**
  (calibrate throughput; no re-validation needed). New sub-decision **D8a** opened (include
  interrupted/partial-chunk throughput points vs complete-only; rec = include + ledger note).
- **2026-06-30** — D8a confirmed: **include** interrupted/partial-chunk throughput points (+ claims-
  ledger note + Phase-5 check). Moved to discussing open question #2 (replace `deriveSlotStatuses`).
- **2026-06-30** — #2 resolved → **D9 (session-booking model):** engine lays out blank bookings
  (date + estimated duration, capacity-only, no material packing); user attaches material in advance or
  at start; non-planned days bookable; Home loads the day's booking → confirm dial + material → start;
  attribution by `bookingId`. Sub-forks **D9a** opened (cardinality, blank-vs-suggested, attribution,
  edit events).
- **2026-06-30** — **D9a resolved** (one material/booking; soft-suggest preferring in-progress material;
  bookingId attribution; edit-event shape deferred). **D10 added** (non-YouTube progress marking in-session
  + in-directory; out-of-session edits don't feed throughput). Deferred UI: material directory view on the
  Roadmap page. Remaining open: **#3 (ETA/projection)**.
- **2026-06-30** — #3 design drafted as a **proposed composite** (GP finish-date + analytic recommendation)
  but **not locked**: Rohit flagged it needs empirical proof. Added **§5c research workstream R1–R6** —
  extend the generator, regression-test calibration/detection, **benchmark the ETA composite (R4)** on the
  existing `research/comparison/` harness with A-series rigour, guard circularity via Phase-5 real data.
  #3 composite is now 🟡 gated on R4.
- **2026-07-01** — Research verdicts baton read (`handovers/2026-07-01-research-verdicts-for-ui-impl.md`):
  G1 calibration transfers (keep `enriched_shrink`, INCLUDE partials), G2 keep CUSUM, G3 ETA #3 QUALIFIED
  (GP + analytic cold-start fallback, `COLD_START_N=5`, actual-minutes, provisional; not a GP replacement).
  **`PLAN.md` + `VERIFICATION.md` authored** in this folder — 7 phases (2 foundation: engine→bookings +
  events, then derivations + read-time adapter; then onboarding-p3, session-flow, roadmap, ETA+week, replan),
  grounded in real symbols, mocks as visual contract, D-01…D-10 decisions log, OQ-01…05. Ready for
  Codex/Sonnet (Step 0 = commit docs). Design pass (D1–D22) → implementation plan complete.
- **2026-06-30 (grill session 2)** — **D22 locked:** Replan window = **Option B** (split levers + sticky live
  outcome), canonical `mocks/proposed/replan.html`. Replan reframed from slot-regen → **pull levers →
  re-project finish** (extend deadline / capacity / shorten+drop materials / accept later finish). Materials
  lever fixed: stepper **shortens**, × **drops** (label now matches the control). **Design pass complete** —
  §7.0 index tracks all agreed screens. Next: assemble `PLAN.md` + `VERIFICATION.md`.
- **2026-06-30 (grill session 2)** — All four screens UI-agreed + documented as visual contracts. **D21:**
  booking interactions wired into canonical `roadmap.html` — booking editor (swap/clear/duration-stepper/
  move/remove → `BookingEdited`/`BookingCleared`), add-session sheet (→ `SessionBooked`), material picker.
  Duration via **stepper** not dial (D17). Next: assemble PLAN.md.
- **2026-06-30 (grill session 2)** — **D20 locked:** Roadmap = **Option B** (calendar + collapsible Materials
  panel), canonical `mocks/proposed/roadmap.html`. New booking statuses (Done/Booked/Missed/Unplanned),
  outlined future bookings vs filled past activity, "+ add session" on empty days, material directory with
  per-material progress, provisional ETA card. Fixed mock calendar-row bug (5 rows for July). All four
  screens now designed (onboarding p3, Home+pre-session+running, Roadmap). Next: assemble the PLAN.md.
- **2026-06-30 (grill session 2)** — **D16** (session state model: pre-session runs once; Continue resumes
  the running timer via the persisted `activeSession` record, bypassing the pre-req) + **D17** (dial is
  pre-session-only; running session keeps the existing numeric timer — rejects dial-as-running-timer) locked.
  Running-session changes reduced to D4 end-controls + D10 position capture + D3 strip progress.
- **2026-06-30 (grill session 2)** — **D15 + D15a locked:** Home stays a launcher (booking material
  re-labelled "Suggested material", `mocks/proposed/home.html`); new **pre-session page** chosen = **V1
  confirm card** (`mocks/proposed/session-presession.html`) — material confirm/swap + Marginalia-skinned
  planned-length dial, faithful to `/session`. Next: running-session changes (D4 interrupt/complete, D10
  partial position capture) + Roadmap.
- **2026-06-30 (grill session 2)** — **D14a:** playlist row keeps the existing `PlaylistPickerPopup`
  modal (not inline checklist) — reproduced in the mock. **Page 3 UI AGREED** — `mocks/proposed/onboarding-3.html`
  is the frozen visual contract. Moving on to **Home**.
- **2026-06-30 (grill session 2)** — **D14 locked:** left-panel materials reorganised **grouped-by-type**
  (Videos/Playlists/Links/Manual, collapsible, count+total) with compact expand-on-edit rows + playlist
  video checklist; folded into `mocks/proposed/onboarding-3.html`. Onboarding page 3 now fully designed
  (left + right). Next: Home.
- **2026-06-30 (grill session 2)** — Mock-driven workflow set up under `mocks/` (verbatim design-system
  CSS in `mocks/css/`; frozen `baseline/`, evolving `proposed/`). Onboarding-3 baseline mocked + fidelity
  confirmed by Rohit. Three preview options rendered (A summary / B booking-list / C calendar). **D13 +
  D13a locked:** chose **Option A summary + expandable multi-month calendar** (Projected-finish card
  toggles a slide-down calendar; persistent "Calendar ⌄" pill + hover affordance + keyboard a11y;
  ‹ › month arrows) and **book-to-exhaustion + buffer** generation. Chosen mock:
  `mocks/proposed/onboarding-3.html`.
- **2026-06-30 (grill session 2)** — UI/UX grilling started. **D12** logged: plan the whole
  decoupling (foundation + UI + UX + logic) in this folder as one cohesive plan; clarify UI/UX
  first. Grounded in real components: `Step3Materials.tsx` / `Step3Preview.tsx` (the day-by-day
  packing UI to retire), `Home.tsx` (`getUpNextSlot` pre-bound start). Appending D13+ as resolved.
- **2026-06-30** — Research workstream handed off to a separate Opus session
  (`.work/handovers/2026-06-30-research-eta-model-selection.md`). Lower-priority **legacy-data** item
  resolved → **D11** (read-time adapter; new bookings as first-class `SessionBooked`/`BookingEdited`/
  `BookingCleared` events — also closes D9a #4). UI planning handed off
  (`.work/handovers/2026-06-30-ui-planning-handoff.md`). Remaining open: replan contract; claims-ledger
  note; multi-roadmap lifecycle interaction; **#3 gated on R4**.
- **2026-06-30** — R4 ETA benchmark result incorporated: **#3 is 🟡 QUALIFIED**, not generally proven.
  `gp_plus_analytic` wins vs `gp_ard` under held-out + Holm on the small band only (cold-start /
  low-data regime), loses on max, and `analytic_required_rate` never wins. Product framing may use the
  composite as a cold-start fallback layered on GP; dissertation framing must not call it a GP
  replacement. R6 real-data guard remains.
