<!--
  This is the verbatim operating-manual preamble. It is pasted as the first content
  of every plan written by the write-implementation-plan skill. Do NOT modify it
  per-plan — keeping it identical across plans means implementing agents learn
  the protocol once and recognize it everywhere.
-->

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

## Cowork operating notes for THIS plan (repo-specific)

- **Step 0 — before writing any code:** commit these planning docs verbatim so later diffs are meaningful:
  `docs(plan): add material-session-ui-bugs PLAN + VERIFICATION`. (Cowork cannot commit — the native side establishes the baseline.)
- **After each phase**, fill your section of [`VERIFICATION.md`](./VERIFICATION.md) (files changed, commit SHA, what you did, deviations + why, self-check vs. the phase's acceptance criteria) and expect review. **A phase is not done until the reviewer marks it `✅ Verified`**; change requests may follow.
- **Phase 4's visual contract is the approved mock** [`mocks/proposed/study-day-indicator.html`](./mocks/proposed/study-day-indicator.html) (renders with **real** app CSS copied into `mocks/real-css/`). Build the study-day indicator to it.
- **Phase 7's visual contract is the approved mock** [`mocks/proposed/bug8-bubble-truncation.html`](./mocks/proposed/bug8-bubble-truncation.html) (baseline + 4 candidates, real CSS + real DOM, live in 390px iframes). Rohit picked Option C (D-10) — build to that.
- **Phase 8's visual contract is the approved mock** [`mocks/proposed/bug6-branded-loading.html`](./mocks/proposed/bug6-branded-loading.html) (baseline + 3 candidates C1/C2/C3, real CSS + real DOM, phone + desktop viewports, long-wait-state toggle). Rohit picked **Option C1** (D-09) — build to that.
- **Project rules** live in `.agents/rules/*.agents.md` (Codex) / `.claude/rules/*.md` (Sonnet); cite the relevant one per phase.
- **E2E tests: author only, do not run** (environment constraint — see repo `CLAUDE.md`). Vitest unit tests DO run.
- **These are independent post-ship items** (BUG-1..BUG-8 across Phases 1–8, plus one feature — suggested upcoming sessions — in Phase 9). Phases have **no cross-dependencies** — each can be picked up and shipped on its own. Ordered by when they were added, not by dependency. (The soft 7-phase cap is intentionally exceeded because this doc is being used as a running post-ship-fix collection for one subsystem; each phase remains a self-contained slice.)

---

# Material-session UI bug fixes (roadmap + onboarding + burn-up)

**Slug:** `material-session-ui-bugs`
**Date written:** 2026-07-02
**Author:** Claude + Rohit
**Plan status:** Draft
**Upstream:** post-ship review of [`2026-06-30-material-session-decoupling`](../2026-06-30-material-session-decoupling/PLAN.md); triage log [`SCRATCHPAD.md`](./SCRATCHPAD.md)

## TL;DR

Five independent UI defects surfaced during hands-on review of the material↔session decoupling work. Fix them as five standalone vertical slices: (1) remove the duplicate **"Edit & add"** roadmap-hero button; (2) **center the booking sheets** (they're stuck bottom-clipped on all viewports); (3) give the **<560px calendar a way to add/book a session** (none exists today); (4) add a **study-day indicator** (tinted cells) across all calendars plus onboarding-preview legibility fixes (recolor booked chip, tooltip, kill false hover-lift) — built to an approved mock; (5) fix the **burn-up chart** (broken "planned" baseline from retired slots, duplicated axis labels, degenerate domain, blobby curve). All fixes are client-side TS/CSS; no Python service or event-model changes.

**Addendum (Phases 6-8, added post-review):** three more issues surfaced during live Playwright verification of Phases 1-5 (out of scope of that review, agreed to fix here): (6) scroll the mobile day-sheet into view when it opens; (7) fix the onboarding-preview session bubble's unreadable truncation at narrow (390px) width, by dropping the redundant "Session" label so icon + duration fit cleanly (Option C, chosen against a real-CSS mock — D-10); (8) close a pre-existing cold-start cloud-restore race that can transiently bounce a brand-new device through `/onboarding` before landing on `/home`, by gating centrally in `SyncProvider`. None of the three touch the event model or intelligence math either.

## Context & background

The material↔session decoupling shipped (all 7 phases verified, `.work/plans/active/2026-06-30-material-session-decoupling/`). Using the running app, Rohit found five UI issues. Two are regressions tied to that change (BUG-4's onboarding preview, BUG-5's "planned" baseline which still reads the now-retired `roadmap.slots`); three are latent gaps (BUG-1 modal centering, BUG-2 mobile add-session, BUG-3 duplicate button). Each was diagnosed against real code during the review; this plan consolidates the agreed fixes.

Constraints: keep the event model and intelligence math untouched; keep rendering client-side (Rohit chose to fix the burn-up chart in-place rather than move to Python rendering — see D-05); match the Marginalia design system; per-user Dexie isolation and the booking event model from the decoupling work are unaffected.

**Support docs:**

- Triage / root-cause log: [`SCRATCHPAD.md`](./SCRATCHPAD.md)
- Phase-4 visual contract (approved): [`mocks/proposed/study-day-indicator.html`](./mocks/proposed/study-day-indicator.html)
- Upstream plan: [`../2026-06-30-material-session-decoupling/PLAN.md`](../2026-06-30-material-session-decoupling/PLAN.md)
- Rules: `.agents/rules/{css-workspace-packages,form-design-spacing,react-router-v7-basename,roadmap-engine}.agents.md`

## Decisions log

### D-01: BUG-3 — collapse to one roadmap-hero button

**Status:** ✅ Agreed
**Context:** `Open plan` and `Edit & add` on the active-roadmap hero both `<Link to="/roadmap">` — same page, no difference; "add material to an existing roadmap" isn't implemented anywhere (`MaterialAdded` only emitted from onboarding).
**Decision:** Remove `Edit & add` entirely; keep a single `Open plan`. Editing (inline booking edits) and `Replan` already live on the opened page.
**Rationale:** Two affordances must not produce one identical outcome; the second promised a capability that doesn't exist.
**Alternatives considered:** repoint secondary → `/replan` → rejected by Rohit (wants one button); build add-material flow → deferred (separate future feature).
**User pushback:** Rohit: "Remove the button Edit & Plan entirely. Let there be one Open Plan button."
**Reversibility:** easy.

### D-02: BUG-1 — center the booking sheets on all viewports

**Status:** ✅ Agreed
**Context:** `.bk-overlay`/`.bk-sheet` are a bespoke bottom-sheet (`align-items:flex-end`, top-only radius) with no responsive rule; they read as clipped/stuck on both desktop and mobile.
**Decision:** Center on all viewports: `.bk-overlay { align-items:center }`, `.bk-sheet { border-radius: var(--radius-lg); max-height: calc(100dvh - var(--space-6)); overflow-y:auto }`. Fixes all four sheets (shared class).
**Rationale:** Rohit confirmed the same behaviour on mobile and wants it centered; `max-height`+`overflow-y` prevents a tall centered sheet clipping on short screens.
**Alternatives considered:** desktop-only `@media(min-width:1024px)` centering (mock's original) → rejected (Rohit wants centered on mobile too); consolidate onto the design-system `.modal-overlay center`/`.modal-card` used by `SessionDetailModal` → deferred as a follow-up (bigger diff).
**Reversibility:** easy.

### D-03: BUG-2 — DaySheet becomes the mobile day hub (empty days tappable + add-session)

**Status:** ✅ Agreed
**Context:** Below 560px the calendar is dot-view; the `+ add session` affordance only exists in the desktop branch, and the empty-day mobile button is `disabled`, so there is no path to add a booking. The `DaySheet` it opens is view-only.
**Decision:** Make empty in-month days tappable in compact mode; add a `+ Add session` action + empty-state to `DaySheet`; wire it to the existing `AddSessionSheet`/`handleCreateBooking`.
**Rationale:** Reuses the existing add flow; per-day tap pre-sets the date. Cleaner than a floating "+" FAB (which needs a separate date picker).
**Alternatives considered:** floating "+" FAB → rejected (less precise, extra UI).
**Reversibility:** easy.

### D-04: BUG-4 — study-day tint across all calendars + onboarding preview legibility

**Status:** ✅ Agreed (mock approved)
**Context:** Onboarding preview shows a green (done-styled) session bubble for a *future* booking, clipped label, false hover-lift, and no cue for why sessions land on their dates.
**Decision:** (a) shared `.roadmap-day-studyday` moss-8% tint on every in-month cell whose weekday ∈ selected study days, applied to **both** the roadmap calendar and the onboarding preview, + "Study day" legend entry + study-day weekday-header emphasis; (b) recolor the onboarding session bubble `roadmap-chip-done` → `roadmap-chip-booked` with a `title`+`aria-label`; (c) scope the `.roadmap-day-in-month:hover` lift so it does NOT apply inside `.onboarding-mini-calendar` (read-only). Built to the approved mock.
**Rationale:** The tint answers "why this day" visually; green must stay reserved for completed; the preview is read-only so it must not imply clicks.
**Alternatives considered:** dot marker / header-only emphasis → rejected (tint reads best with bubbles inside); onboarding-only scope → rejected (Rohit: "all calendars").
**User pushback:** Rohit approved the real-CSS mock after v1 (mock-CSS copies) looked wrong.
**Reversibility:** easy.

### D-05: BUG-5 — fix the burn-up chart client-side; rebuild "planned" from capacity

**Status:** ✅ Agreed
**Context:** `buildPlannedCumulative(roadmap.slots)` now reads booking-synthesized slots (few, sparse) → a near-flat "planned" baseline; plus coarse y-axis formatter, degenerate x-domain on empty data, and `curveBasis` overshoot.
**Decision:** Keep the chart client-side (@visx); do NOT move rendering to Python.
Rebuild "planned" as a capacity-shaped cumulative over `startDate..deadline` using the live booking-capacity semantics: on each selected study day, add `weekdayHours * 60` for Mon-Fri and `weekendHours * 60` for Sat-Sun.
Do not use the legacy slot-grid split (`weekdayHours / weekdayCount`, `weekendHours / weekendCount`) for this burn-up fix.
Fix the axis formatter (h+m, dedupe), guard degenerate/empty domains (+ empty state), swap `curveBasis`→`curveMonotoneX`, and base the y-domain on the data not the inflated GP upper.
This plan intentionally resolves the upstream target-line OQ for the product burn-up chart: the Week chart reference line is capacity-shaped, not linear-to-deadline.
**Rationale:** The mess is data + config bugs, not a rendering-library limit; Python rendering adds a round-trip, loses interactivity/theming, and couples a view to an undeployed service. Python plotting stays the tool for research/dissertation figures only.
**Alternatives considered:** matplotlib PNG/SVG from `/v1/progress` → rejected (static, latency, theming, service gating); Plotly.js → rejected (heavy, still client render).
**User pushback:** Rohit floated Python; accepted Option A ("Sure A then").
**Reversibility:** moderate (planned-baseline change alters the "vs plan" semantics — intended).

### D-06: BUG-4 4d (back-to-/roadmaps exit) is out of scope here

**Status:** ⚠️ Deferred
**Context:** Re-entrant onboarding (via "Resume setup") has no exit to `/roadmaps` except browser-back.
**Decision:** Not fixed in this plan (Rohit: "move on"). Tracked as OQ-01.
**Reversibility:** easy.

---

**The four decisions below (D-07 through D-10) were added post-review**, after Phases 1-5 were implemented and verified. They cover three more issues (BUG-6, BUG-7, BUG-8) found during live Playwright verification of those phases — see [`VERIFICATION.md`](./VERIFICATION.md)'s Final gate section for how they were found.

### D-07: BUG-6 — gate the cloud-restore race centrally in `SyncProvider`, not in the two onboarding gates

**Status:** ✅ Agreed
**Context:** Live Playwright review of Phases 1-5 surfaced a pre-existing, out-of-scope race: on a genuinely fresh browser/device, `RequireOnboarding` (`apps/app/src/onboarding/RequireOnboarding.tsx`) and `OnboardingGate` (`apps/app/src/onboarding/OnboardingGate.tsx`) both read local Dexie state (`useLiveQuery(() => eventStore.getAll())`) the instant it resolves and make an immediate redirect decision, with no awareness that `SyncProvider`'s cloud restore (`engine.restoreFromCloud()`, fired fire-and-forget on mount) might still be in flight. Reproduced 3/3 times: `/roadmaps → /onboarding/1 → /home` on a truly fresh browser profile; never reproduces on an already-hydrated profile.
**Decision:** Fix at one choke point — `SyncProvider` — rather than patching `RequireOnboarding` and `OnboardingGate` individually (both have the identical bug, unmodified by this decision). Add a one-shot `initialRestorePending` flag to `SyncState`; `SyncProvider` withholds rendering `children` (which is everything downstream, including both gates) until it clears.
**Rationale:** Both onboarding gates read local event state the same naive way; fixing the actual source (SyncProvider not signaling "restore still in flight") fixes both at once and is simpler than threading new context into two separate route guards. Neither gate file needs to change at all under this approach.
**Alternatives considered:**
- Patch `RequireOnboarding` + `OnboardingGate` independently with their own fixed-delay timeout (mirroring `auth-init-timeout`) → rejected: duplicated in two places, and a guessed delay rather than a real "restore settled" signal.
**User pushback:** none.
> Rohit: "Agreed with Gate centrally in SyncProvider."
**Reversibility:** easy — revert `SyncProvider`'s render branch and the `SyncState`/`SyncEngine` field; the two onboarding gates are untouched either way.

### D-08: BUG-6 — scope the gate to the cold-start (slow) restore path only, not routine background syncing

**Status:** ✅ Agreed
**Context:** `SyncEngine.doRestoreFromCloud()` (`apps/app/src/sync/SyncEngine.ts:442`) branches on a cheap local check: `const localEventCount = await this.eventStore.table('events').count()` (line 453) — if the device already has any local events it takes a fast path (flush + dedupe + delta-pull only, lines 454-460, no snapshot download); only a genuinely empty local DB takes the slow path (fetch checkpoint, download+parse the snapshot blob, wipe+bulkAppend, delta-pull, lines 462-568). `status: 'syncing'` already covers BOTH paths (the `notifyState` at line 447 fires regardless of which branch follows), so gating the block on `status === 'syncing'` directly would also block/flash on every routine background sync for already-hydrated, returning users — a regression, not a fix.
**Decision:** `initialRestorePending` clears almost immediately on the fast path (right after the local `count()` resolves) and only stays `true` for the duration of the slow path. Default it to `true` in the constructor (not `false`), so the very first paint blocks — this avoids a "flash content then yank it away" glitch versus discovering fast-vs-slow only after an initial unblocked render.
**Rationale:** The race is real only on the slow path (once per device, first-ever login); the fast path already runs invisibly today on every ordinary page reload for the overwhelming majority of sessions and must keep doing so.
**Alternatives considered:**
- Gate on `status === 'syncing'` directly, no new field → rejected: fires on every background flush/pull, would add a visible pause to normal usage.
- Never block, rely on eventual redirect self-correction → rejected: that's the status quo bug (the jarring `/onboarding → /home` flash).
**User pushback:** none.
**Reversibility:** easy — a single boolean's write sites; no schema/data migration.

### D-09: BUG-6 — loading-state visual and safety-timeout duration

**Status:** ✅ Agreed — Option C1 ("Notebook mark"), safety timeout stays 8000ms but becomes a configurable prop
**Context:** While `initialRestorePending` is true, `SyncProvider` needs to render *something* instead of `children`, and the restore needs a bounded safety timeout in case the network hangs with no error ever surfacing. This is a brand-new device's very first impression of the app right after sign-in — rare, but a real moment. Direction (Option C, "a branded moment") was picked in the prior session; this session designed and agreed the concrete treatment via `/frontend-design` + a real-CSS/real-DOM mock + `/grill-me`.
**Decision:** Ship **Option C1, "Notebook mark."** Full-bleed on the paper surface (`--surface-page`, no card box — there's nothing to frame, so it reads as a moment rather than a dialog). The favicon mark (`apps/app/public/favicon.svg` geometry: rounded ink square, three horizontal ruled lines, terracotta accent dot) is rebuilt as three separately-animatable SVG `<path>` elements instead of one combined path, so each line can draw itself in via `stroke-dasharray`/`stroke-dashoffset` with a staggered delay (~100–840ms), followed by the dot popping in (760–1100ms) and settling into a persistent 2.6s pulse — reusing the same pulse vocabulary as `.session-pulse-dot`/`.sync-indicator-dot`, not inventing new motion language. Underneath: the wordmark "Study Tracker" (italic Fraunces, same treatment as `.auth-mark-name`), a mono-caps caption, and a body-text subcaption, each fading up on staggered delays (480/640/780ms) that overlap the tail of the mark's draw-in. `role="status" aria-live="polite"` on the root so screen readers announce the caption (and its later swap — see the long-wait decision below). Respects `prefers-reduced-motion: reduce`: everything renders fully-drawn/static immediately, no pulse, no fade. New CSS lives in `packages/design-tokens/src/components.css` (an app-shell-level state, not roadmap- or onboarding-scoped, so it belongs beside `.sync-indicator`/`.auth-mark` rather than in `roadmap.css`/`onboarding.css`) — see Phase 8 Step 5/8 for the exact rules.

Also decided in the same session, as direct sub-parts of D-09:
- **Long-wait secondary copy (yes):** after ~3 seconds without the restore settling, the caption swaps "Setting up this device" → "Still bringing things over", and the subcaption swaps "Bringing over your study history — this only happens once." → "Larger histories take a little longer. Hang tight." Rationale: a screen that stays byte-identical across a multi-second wait reads as frozen past a certain point — the same reasoning that ruled out Option E (no visible UI, see below) applies at a smaller scale here. This ~3s swap threshold (`LONG_WAIT_COPY_THRESHOLD_MS`) is a fixed constant, deliberately independent of the safety-timeout value — it's cosmetic (which sentence shows), not a safety valve, so it does not get the same configurability treatment as the timeout itself.
- **Safety timeout: 8000ms, made configurable rather than debated to a new number.** In-codebase precedent found during grill-me: `apps/app/src/lib/intelligenceClient.ts:4` already uses `TIMEOUT_MS = 8000` for its own fetch timeout, so 8000 was already this app's convention, not an arbitrary Phase-8-only guess — and the real test account's actual restore payload (294 events) is well under the 5MB snapshot-bucket limit (`.claude/rules/supabase-schema.md`), so 8000ms is generous headroom for the known common case, not a tight fit. Rather than debate a number with no production telemetry to ground it, `SyncProvider` gets a new optional prop `initialRestoreSafetyTimeoutMs?: number`, defaulted from a module constant that reads `import.meta.env.VITE_INITIAL_RESTORE_TIMEOUT_MS` (parsed as a number, falling back to 8000 if unset/non-numeric/non-positive) — the same env-var-with-fallback pattern `VITE_INTELLIGENCE_URL` already uses (documented in `CLAUDE.md`'s Environment Variables section). This means the number can be tuned later via `.env` + rebuild, without touching `SyncProvider`'s internals, and tests can pass a short value instead of fast-forwarding fake timers by a full production-sized 8000ms.

**Rationale:** C1 is the one option that stays *calm* rather than *interruptive* for a screen that's rare (once per device, ever) but not an achievement worth a splash-screen-style takeover; it's a direct, literal expression of the brand's own stated "quiet companion" personality (`.auth-mark-tag`) rather than a different, more assertive personality with no precedent elsewhere in the app.
**Alternatives considered:**
- **Option C2 ("Ink curtain")** — full-bleed `--surface-inverted` takeover (reusing the same inverted-surface token `.card-inverted` already uses elsewhere, not a new dark mode), mark rendered directly on a soft terracotta glow without its square container, sparse copy → rejected: too ceremonial/assertive for a background sync operation; delightful once, mildly annoying to see repeatedly (testing, support repro); no precedent for a full-bleed inverted takeover anywhere else in this app.
- **Option D (skeleton screen approximating Home's layout)** → rejected in the prior session, not revisited.
- **Option E (no visible UI)** → rejected in the prior session (would look frozen/broken); this session's long-wait-copy decision is a direct extension of that same reasoning applied mid-wait, not just at t=0.
- Debating a bespoke safety-timeout number from first principles → rejected: no production telemetry exists for real cold-start restore duration, so any number picked today is a guess regardless; better to keep the existing 8000ms convention and make it cheaply adjustable than invent a differently-guessed number.
**User pushback:**
> Rohit: "Ya C1 is good."
> Rohit: "agree with 8, but make this timeout easily editable, like a plugin, so we can adjust it later as required."
**Reversibility:** easy — presentational only; no change to the underlying gating mechanism (D-07/D-08), reconfirmed explicitly during grill-me (the concrete visual doesn't change *when* the gate applies, only *what it looks like* while applied — the fast path still never renders this screen, not even for one frame).
**Visual contract (approved):** [`mocks/proposed/bug6-branded-loading.html`](./mocks/proposed/bug6-branded-loading.html) — real CSS (tokens/global/components, confirmed byte-identical to source at grounding time) + real DOM, baseline (byte-accurate to today's shipped, uncentered plain card) and all three candidates (C1/C2/C3) rendered live in a 390px phone iframe and a 640px desktop iframe each, plus a working "show long-wait state" toggle.

### D-10: BUG-8 — narrow-width treatment for the onboarding-preview session bubble

**Status:** ✅ Agreed — Option C
**Context:** At a true ~390px mobile viewport, the onboarding-preview mini-calendar's session bubble (`apps/app/src/onboarding/steps/Step3Preview.tsx:360-373`) truncates to an unreadable single character, because `Step3Preview` renders its own bubble markup directly (not via the shared `<CalendarCell>` component) and so never gets that component's compact/dot-stack mobile treatment.
**Decision:** **Option C** — icon + duration, drop the "Session" label text entirely (it's redundant in a calendar of sessions). Below 560px inside `.onboarding-mini-calendar`, hide `.roadmap-bubble-label` and tighten `.roadmap-bubble`'s grid to `14px auto` (icon + minutes only, no wasted middle column).
**Rationale:** Confirmed by a real-CSS visual mock (see below) rendering all candidates inside live 390px iframes with the actual `@media (max-width: 560px)` rule active — not simulated. Option C keeps the most useful piece of information (how much time) that Option A discards, without the layout cost Option B pays: building Option B's mock surfaced that "Session" has no space to break at, so even with a clean 2-line cap it renders as "Se / s…" and the affected calendar rows visibly grow taller than their neighbors, breaking the grid's row rhythm. Option C matches baseline's cell height exactly, with zero truncation.
**Alternatives considered:**
- **Option A** (icon-only, no duration) → rejected: cleaner but throws away the duration entirely; full detail becomes hover/tap-only via the Phase 4 `title`/`aria-label`.
- **Option B** (icon hidden, label wraps 2 lines) → rejected: confirmed via the mock to break the single word "Session" awkwardly ("Se"/"s…") and to make booked-day rows taller than empty-day rows in the same week.
- **Option D** (small dot badge, no chip at all) → rejected: most consistent with the main calendar's own compact dot-stack, but a visual-language mismatch within the same small view — the legend directly below still shows an outlined "booked session" chip swatch, not a dot.
- Giving `Step3Preview` the main calendar's full `isCompact` dot-stack treatment → not proposed as a primary option; a bigger, more invasive change than this cosmetic fix warrants, and the onboarding preview is read-only (no per-bubble tap interaction to preserve).
**User pushback:** none.
> Rohit: "Ya Option C is good."
**Reversibility:** easy — pure CSS, no data/API shape involved.
**Visual contract (approved):** [`mocks/proposed/bug8-bubble-truncation.html`](./mocks/proposed/bug8-bubble-truncation.html) — real CSS (refreshed from current source) + real DOM, baseline and all four candidates rendered live in 390px iframes.

### D-11: FEAT — suggested upcoming sessions (derived, not persisted)

**Status:** ✅ Agreed
**Context:** The roadmap calendar renders only persisted `SessionBooked` events. `generateBookings` is book-to-exhaustion, so with a small backlog only a few bookings exist and upcoming planned study-days look empty — there's no visible path to the deadline and nothing re-projects as time passes.
**Decision:** Add a **read-time "suggested sessions" layer**. Re-run the engine's `generateBookings` over **remaining** material (from `buildMaterialLedger`, `remainingEstimatedMinutes` per not-done material) starting `today`→`deadline`; the engine already **caps each session at that day's capacity and spreads the leftover across consecutive study days**. Render the results as a distinct **`suggested`** bubble on future study days that have **no confirmed booking**. Nothing is persisted; clicking a suggestion **accepts** it → emits a real `SessionBooked` (app-layer `crypto.randomUUID()` id), after which it's an ordinary booking (and the suggestion for that day disappears because the day now has a confirmed booking). Active roadmap only; never in the read-only history view.
**Rationale:** Derived suggestions self-adjust as material is logged and need no event rewrites on replan; they fit the "blank capacity, choose material at start" model (D upstream); reusing the deterministic engine layout means suggestions agree with onboarding's booking math. Cap-and-spread avoids showing an impossible single leftover-sized block.
**Alternatives considered:**
- Persist suggested `SessionBooked` events up front for every study day → rejected: they wouldn't shrink as material is completed, and every replan would rewrite them.
- One suggested session sized to the *entire* material leftover → rejected: can exceed a day's capacity; the calendar should show the realistic per-day spread.
**User pushback:** Rohit picked derived + cap-and-spread.
> Rohit: "Agreed"
**Reversibility:** easy — additive read-time layer + one new bubble status; delete the derivation + status to revert. No event-model change.

## Architecture overview

Five isolated client-side fixes, no shared runtime coupling:

```
BUG-3  apps/app/src/pages/Roadmaps.tsx            — delete one <Link>
BUG-1  apps/app/src/roadmap/roadmap.css           — .bk-overlay / .bk-sheet centering (4 sheets share it)
BUG-2  CalendarCell.tsx + DaySheet.tsx + RoadmapCalendar.tsx  — mobile add-session entry point
BUG-4  roadmap.css (+ shared class) + RoadmapCalendar.tsx + CalendarCell.tsx + Step3Preview.tsx  — study-day tint + preview fixes
BUG-5  packages/progress/src/progress.ts (planned baseline) + apps/app/src/components/BurnUpChart.tsx (axes/domain/curve)

-- added post-review --
BUG-7  apps/app/src/roadmap/DaySheet.tsx                     — scroll the sheet into view on open
BUG-8  apps/app/src/roadmap/roadmap.css                      — narrow-width onboarding bubble treatment (Option C, D-10)
BUG-6  apps/app/src/sync/{types.ts,SyncEngine.ts,SyncProvider.tsx} + packages/design-tokens/src/components.css  — withhold children on initial cloud-restore + branded loading screen (D-09)

-- feature (Phase 9, D-11) --
FEAT   apps/app/src/roadmap/{suggestedBookings.ts (new),calendarModel.ts,statusStyles.ts,CalendarCell.tsx,RoadmapCalendar.tsx,roadmap.css}
       — derived "suggested upcoming sessions" over remaining material (generateBookings from today→deadline), rendered on empty future study days; click = accept → SessionBooked
```

Data facts to rely on (verified in code, do not re-derive):
- `@study-tracker/progress` `RoadmapInput` exposes `startDate, deadline, selectedStudyDays?, weekdayHours?, weekendHours?`.
  The fields are optional in the progress package for legacy compatibility, so Phase 5 must fall back to the old slot-based series when any capacity field is missing or `selectedStudyDays` is empty.
- The live booking path does **not** split weekday/weekend hours across the selected days.
  `generateBookings` uses `capacityForBookingDay(day, input) = (isWeekend(day) ? weekendHours : weekdayHours) * 60`.
  The Phase 5 burn-up planned baseline must mirror that booking-capacity semantics.
- Do not import `apps/app/src/session/sessionPlanning.ts` from `packages/progress`.
  The app-layer `dailyCapacityForDate` can be read as a reference only; `packages/progress` needs its own small pure helper.
- Booking sheets `BookingEditorSheet`/`AddSessionSheet`/`MaterialPickerSheet`/`MaterialProgressSheet` all render `.bk-overlay > .bk-sheet` (`apps/app/src/roadmap/booking/*.tsx`).
- `AddSessionSheet` props: `{ date, materials, capMinutes, onClose, onCreate }`; wired in `RoadmapCalendar` via `addSessionDate` state + `handleCreateBooking` (emits `SessionBooked`).

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/pages/Roadmaps.tsx` | modify | 1 | Remove the `Edit & add` link |
| `apps/app/src/pages/Roadmaps.test.tsx` | modify | 1 | Drop the `Edit & add` assertion |
| `apps/app/src/roadmap/roadmap.css` | modify | 2,4 | Center booking sheets (2); study-day tint + onboarding no-lift (4) |
| `apps/app/src/roadmap/CalendarCell.tsx` | modify | 2,4 | Empty-day tappable in compact (2); study-day class (4) |
| `apps/app/src/roadmap/DaySheet.tsx` | modify | 2 | Add-session action + empty state |
| `apps/app/src/roadmap/RoadmapCalendar.tsx` | modify | 2,4 | Wire DaySheet add (2); study-day set + legend (4) |
| `apps/app/src/onboarding/steps/Step3Preview.tsx` | modify | 4 | Recolor session chip, tooltip, study-day tint, legend |
| `apps/app/src/onboarding/onboarding.css` | modify | 4 | Study-day legend swatch |
| `packages/progress/src/progress.ts` | modify | 5 | Capacity-based `planned` baseline |
| `packages/progress/src/types.ts` | modify | 5 | Add optional `burnUp.startDate` / `burnUp.deadline` domain hints |
| `apps/app/src/components/BurnUpChart.tsx` | modify | 5 | Axis formatter, domain guard, curve, y-domain, empty state |
| `packages/progress/src/progress.test.ts` | modify | 5 | Planned-baseline tests |
| test files per phase | modify | 1,3,4,5 | Cover behavior and rendering changes |
| `apps/app/src/roadmap/DaySheet.tsx` | modify | 6 | Scroll the day sheet into view when it opens |
| `apps/app/src/roadmap/RoadmapCalendar.test.tsx` | modify | 6 | Cover the `scrollIntoView` call on day-sheet open |
| `apps/app/src/roadmap/roadmap.css` | modify | 7 | Narrow-width onboarding bubble treatment (Option C, D-10) |
| `apps/app/src/sync/types.ts` | modify | 8 | Add `initialRestorePending` to `SyncState` |
| `apps/app/src/sync/SyncEngine.ts` | modify | 8 | Set/clear `initialRestorePending` on the fast vs. slow restore path |
| `apps/app/src/sync/SyncEngine.test.ts` | modify | 8 | Cover fast-path immediate clear + slow-path pending-until-settled (success and error) |
| `apps/app/src/sync/SyncProvider.tsx` | modify | 8 | Withhold `children` while restore is pending; configurable safety timeout (D-09); render the Option C1 branded loading screen (`BootScreen`) instead of a placeholder |
| `apps/app/src/sync/SyncProvider.test.tsx` | modify | 8 | Cover blocked→rendered transition (now asserting `BootScreen` content), prop-driven safety-timeout fallback (no fake timers needed), `resolveInitialRestoreSafetyTimeoutMs` default/override/fallback |
| `packages/design-tokens/src/components.css` | modify | 8 | New `.boot-*` branded-loading-screen CSS (D-09, Option C1) |
| `apps/app/src/roadmap/suggestedBookings.ts` | new | 9 | Derive suggested sessions from remaining material via `generateBookings` (D-11) |
| `apps/app/src/roadmap/calendarModel.ts` | modify | 9 | Add `suggested` bubble status + builder + `bindCells` suggested arg |
| `apps/app/src/roadmap/statusStyles.ts` | modify | 9 | `suggested` chip style + legend entry |
| `apps/app/src/roadmap/CalendarCell.tsx` | modify | 9 | Render suggested bubble; click = accept |
| `apps/app/src/roadmap/RoadmapCalendar.tsx` | modify | 9 | Derive suggestions + accept handler (emits `SessionBooked`) |
| `apps/app/src/roadmap/roadmap.css` | modify | 9 | `.roadmap-chip-suggested` ghost style |
| `apps/app/src/roadmap/suggestedBookings.test.ts` | new | 9 | Distribution, collision-skip, empty-when-nothing-remaining |
| `CLAUDE.md` | modify | 8 | Document `VITE_INITIAL_RESTORE_TIMEOUT_MS` in Environment Variables |
| `apps/app/.env.example` | modify | 8 | Add `VITE_INITIAL_RESTORE_TIMEOUT_MS` template entry (commented, matching `VITE_INTELLIGENCE_URL`'s style) |

## Phases

---

### Phase 1: Remove the duplicate "Edit & add" roadmap-hero button (BUG-3)

**Status:** ✅ Complete - `0268f20`, ✅ Reviewer-verified 2026-07-03 (see VERIFICATION.md)
**Depends on:** none — can start immediately
**Estimated scope:** ~2 files, ~6 lines

#### Codebase state assumed at start
- `apps/app/src/pages/Roadmaps.tsx` renders two links in `.rmd-actions`: `Open plan` and `Edit &amp; add`, both `to="/roadmap"` (~lines 172–177).
- `apps/app/src/pages/Roadmaps.test.tsx` asserts both links' hrefs (~lines 133–134).

#### Verification (run BEFORE starting)
```bash
grep -n "Edit &amp; add\|Open plan" apps/app/src/pages/Roadmaps.tsx      # both present
grep -n "Edit & add" apps/app/src/pages/Roadmaps.test.tsx               # assertion present
```

#### Steps
1. **Modify `apps/app/src/pages/Roadmaps.tsx`, `.rmd-actions` block (currently ~lines 171–185):** delete the second link only. Implements D-01.
   ```tsx
   <div className="rmd-actions">
     <Link className="btn btn-accent" to="/roadmap">
       Open plan
     </Link>
     <button
       className="btn btn-ghost"
       type="button"
       onClick={() => setShowCloseControls((shown) => !shown)}
     >
       Close plan
     </button>
   </div>
   ```
   (Removes the `<Link className="btn btn-secondary" to="/roadmap">Edit &amp; add</Link>`.)
2. **Modify `apps/app/src/pages/Roadmaps.test.tsx` (~line 134):** delete the `Edit & add` assertion; keep the `Open plan` href assertion.

#### Tests
- Update `Roadmaps.test.tsx` — remove the `Edit & add` link assertion; keep `Open plan` → `/roadmap`.
- Run: `pnpm --filter @study-tracker/app test -- Roadmaps`

#### Verification (DONE)
```bash
grep -n "Edit &amp; add" apps/app/src/pages/Roadmaps.tsx     # returns nothing
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- Roadmaps
```

#### Rollback
Re-add the removed `<Link>` and the test assertion.

#### Notes (filled in during implementation)
- Removed the duplicate `Edit & add` link from `apps/app/src/pages/Roadmaps.tsx`.
- Removed the matching `Roadmaps.test.tsx` assertion while keeping the `Open plan` href assertion.
- Verification passed: `grep -n "Edit &amp; add" apps/app/src/pages/Roadmaps.tsx` returned no rows, `pnpm --filter @study-tracker/app test -- Roadmaps` passed, and `pnpm --filter @study-tracker/app typecheck` passed.

---

### Phase 2: Center the booking sheets on all viewports (BUG-1)

**Status:** ✅ Complete - `0268f20`, ✅ Reviewer-verified 2026-07-03 (see VERIFICATION.md)
**Depends on:** none — can start immediately
**Estimated scope:** ~1 file, ~6 lines CSS

#### Codebase state assumed at start
- `apps/app/src/roadmap/roadmap.css` has `.bk-overlay` (~line 773, `align-items: flex-end`), `.bk-sheet` (~line 784, `border-radius: var(--radius-xl) var(--radius-xl) 0 0`), `.bk-grip` (~line 793). No `@media` desktop centering exists for `.bk-sheet`.
- Four sheets share these classes: `BookingEditorSheet`, `AddSessionSheet`, `MaterialPickerSheet`, `MaterialProgressSheet`.

#### Verification (run BEFORE starting)
```bash
grep -n "align-items: flex-end" apps/app/src/roadmap/roadmap.css   # in .bk-overlay
grep -n "\.bk-sheet" apps/app/src/roadmap/roadmap.css              # ~784
```

#### Steps
1. **Modify `apps/app/src/roadmap/roadmap.css`, `.bk-overlay` (~line 773):** center vertically. Implements D-02.
   ```css
   .bk-overlay {
     position: fixed;
     inset: 0;
     z-index: var(--z-modal);
     display: flex;
     align-items: center;            /* was: flex-end */
     justify-content: center;
     padding: var(--space-4);
     background: rgba(42, 31, 24, 0.4);
   }
   ```
2. **Modify `.bk-sheet` (~line 784):** full radius + scroll guard.
   ```css
   .bk-sheet {
     width: 100%;
     max-width: 460px;
     max-height: calc(100dvh - var(--space-6));   /* new: tall sheet scrolls, no clip */
     overflow-y: auto;                            /* new */
     padding: var(--space-5) var(--space-5) var(--space-6);
     border-radius: var(--radius-lg);             /* was: --radius-xl --radius-xl 0 0 */
     background: var(--surface-card);
     box-shadow: var(--shadow-modal);
   }
   ```
3. **Modify `.bk-grip` (~line 793):** hide the drag handle because it is a bottom-sheet affordance, not a centered modal affordance.
   ```css
   .bk-grip {
     display: none;
   }
   ```

#### Tests
- No unit test asserts sheet geometry; verify visually. If you run the app, open any booking sheet on desktop and a ≤560px viewport and confirm it's centered and scrolls when tall.
- Run: `pnpm --filter @study-tracker/app typecheck`

#### Verification (DONE)
```bash
grep -n "align-items: center" apps/app/src/roadmap/roadmap.css     # in .bk-overlay
grep -n "max-height: calc(100dvh" apps/app/src/roadmap/roadmap.css # in .bk-sheet
grep -n "\.bk-grip" -A4 apps/app/src/roadmap/roadmap.css           # display:none present
pnpm --filter @study-tracker/app typecheck
```

#### Rollback
Restore the three original rule bodies.

#### Notes (filled in during implementation)
- Updated `.bk-overlay`, `.bk-sheet`, and `.bk-grip` exactly as planned in `apps/app/src/roadmap/roadmap.css`.
- Visual check used the real design-token and roadmap CSS with representative `.bk-overlay > .bk-sheet` DOM.
- Desktop short sheet measured top 300px, bottom 300px, height 201px in an 800px viewport.
- Mobile short sheet measured top 322px, bottom 322px, height 201px in an 844px viewport.
- Tall mobile representative sheet measured top 16px, bottom 16px, height 448px in a 480px viewport, with `scrollHeight` 1135px and `clientHeight` 448px.
- Verification passed: CSS greps confirmed the centered overlay, scroll guard, and hidden grip; `pnpm --filter @study-tracker/app typecheck` passed.

---

### Phase 3: Add-session entry point on the <560px calendar (BUG-2)

**Status:** ✅ Complete - `3c8d869`, ✅ Reviewer-verified 2026-07-03 (see VERIFICATION.md)
**Depends on:** none — can start immediately
**Estimated scope:** ~3 files, ~40 lines

#### Codebase state assumed at start
- `apps/app/src/roadmap/CalendarCell.tsx`: `isCompact = useMatchMedia('(max-width: 560px)')` (~line 70); `canOpenDay = isCompact && day.isInMonth && day.bubbles.length > 0` (~line 74); the mobile day button is `disabled={!canOpenDay}`; the `+ add session` button (`showAddSession`) renders ONLY in the non-compact branch (~lines 165–173).
- `apps/app/src/roadmap/DaySheet.tsx`: view-only; props `{ day, onClose, onSelectBubble }`; maps `day.bubbles` only.
- `apps/app/src/roadmap/RoadmapCalendar.tsx`: renders `<DaySheet day={selectedSheetDay} .../>` (~line 625); has `setAddSessionDate` + `handleCreateBooking` + `<AddSessionSheet .../>` (~line 642); `readOnly` prop exists.

#### Verification (run BEFORE starting)
```bash
grep -n "canOpenDay" apps/app/src/roadmap/CalendarCell.tsx          # ~74
grep -n "onSelectBubble\|day.bubbles.map" apps/app/src/roadmap/DaySheet.tsx
grep -n "setAddSessionDate\|<DaySheet" apps/app/src/roadmap/RoadmapCalendar.tsx
```

#### Steps
1. **`CalendarCell.tsx` (~line 74):** let empty in-month days open in compact mode. Implements D-03.
   ```tsx
   const canOpenDay = isCompact && day.isInMonth
   ```
   (Drops `&& day.bubbles.length > 0`. The dot-stack renders empty for 0 bubbles, which is fine — the tap now opens the DaySheet where Add lives.)
   Also update the compact button's `aria-label` so empty days do not claim they already have sessions:
   ```tsx
   aria-label={day.bubbles.length > 0 ? `Open ${day.date} sessions` : `Open ${day.date} day options`}
   ```
2. **`DaySheet.tsx`:** add props and an add-session action + empty state.
   ```tsx
   interface DaySheetProps {
     day: BoundCalendarDay | null
     onClose: () => void
     onSelectBubble: (bubble: CalendarBubble) => void
     onAddSession?: (date: string) => void
     canAddSession?: boolean
   }
   ```
   In the body, after the list, render the empty state + add button (only when `canAddSession`):
   ```tsx
   {day.bubbles.length === 0 && (
     <p className="roadmap-day-sheet-empty">No sessions booked for this day.</p>
   )}
   {canAddSession && onAddSession && (
     <button
       type="button"
       className="btn btn-accent btn-block roadmap-day-sheet-add"
       onClick={() => onAddSession(day.date)}
     >
       + Add session
     </button>
   )}
   ```
   Destructure the new props in the component signature.
3. **`RoadmapCalendar.tsx`, `<DaySheet .../>` (~line 625):** wire add → existing AddSessionSheet, closing the day sheet first.
   ```tsx
   <DaySheet
     day={selectedSheetDay}
     onClose={() => setSelectedSheetDay(null)}
     onSelectBubble={handleDayBubbleSelect}
     canAddSession={!readOnly}
     onAddSession={(date) => { setSelectedSheetDay(null); setAddSessionDate(date) }}
   />
   ```
4. **`roadmap.css`:** add minimal styles for `.roadmap-day-sheet-empty` (muted, `var(--text-tertiary)`, small) and `.roadmap-day-sheet-add` (top margin `var(--space-3)`), matching the sheet's existing spacing.

#### Tests
- Update `apps/app/src/roadmap/RoadmapCalendar.test.tsx`.
  The file currently mocks `../lib/useMatchMedia` as always `false`, so first make the mock configurable:
  ```tsx
  const mockViewport = vi.hoisted(() => ({ isCompact: false }))

  vi.mock('../lib/useMatchMedia', () => ({
    useMatchMedia: () => mockViewport.isCompact,
  }))
  ```
  Reset `mockViewport.isCompact = false` in `beforeEach`.
  In the compact-path test, set `mockViewport.isCompact = true`, open an empty in-month day, assert the `+ Add session` action appears in the `DaySheet`, click it, assert the day sheet closes, assert `AddSessionSheet` opens with that date, then create the booking and assert `SessionBooked`.
- Add or update a read-only compact test.
  Render a historical/read-only calendar with `mockViewport.isCompact = true`, open a day, and assert `+ Add session` is absent.
  Follow `.agents/rules/dexie-test-setup.agents.md` if any test starts using a real Dexie store.
- Author (do not run) a Playwright case in `e2e/material-session-decoupling.spec.ts`: at ≤560px, open an empty day → Add session → booking appears.
  The test must set a viewport below 560px, for example `page.setViewportSize({ width: 390, height: 844 })`, before visiting `/study/roadmap`.
  This is required because the existing desktop booking E2E coverage never exercises the compact `DaySheet` path.
- Run: `pnpm --filter @study-tracker/app test -- RoadmapCalendar DaySheet`

#### Verification (DONE)
```bash
grep -n "onAddSession" apps/app/src/roadmap/DaySheet.tsx apps/app/src/roadmap/RoadmapCalendar.tsx   # present in both
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- RoadmapCalendar
```

#### Rollback
Revert the four edits; the mobile empty-day button returns to disabled.

#### Notes (filled in during implementation)
- Implemented compact empty-day entry by changing `CalendarCell` to open every in-month compact cell and use neutral `day options` labels for empty days.
- Extended `DaySheet` with `canAddSession` and `onAddSession`, an empty-state line, and a `+ Add session` action.
- Wired `RoadmapCalendar` so the day sheet closes before opening the existing `AddSessionSheet` for the selected date.
- Added sheet spacing styles for the empty state and add action.
- Updated `RoadmapCalendar.test.tsx` with a configurable compact viewport mock, compact add-session coverage, and read-only hidden-add coverage.
- Authored the compact empty-day Playwright case in `e2e/material-session-decoupling.spec.ts`; it was not run per plan.
- Verification passed: `grep -n "onAddSession" apps/app/src/roadmap/DaySheet.tsx apps/app/src/roadmap/RoadmapCalendar.tsx`, `pnpm --filter @study-tracker/app typecheck`, and `pnpm --filter @study-tracker/app test -- CalendarCell RoadmapCalendar Step3Preview calendarModel`.
- Commit SHA: `3c8d869`.

---

### Phase 4: Study-day indicator across all calendars + onboarding preview legibility (BUG-4)

**Status:** ✅ Complete - `3c8d869`, ✅ Reviewer-verified 2026-07-03 (see VERIFICATION.md)
**Depends on:** none — can start immediately
**Estimated scope:** ~5 files, ~80 lines. **Visual contract:** [`mocks/proposed/study-day-indicator.html`](./mocks/proposed/study-day-indicator.html).

#### Codebase state assumed at start
- `roadmap.css` has `.roadmap-day`, `.roadmap-day-today` (`--cal-today-fill`), `.roadmap-day-current-week` (`--cal-week-band`), and `@media (pointer: fine) { .roadmap-day-in-month:hover { transform… } }` (the lift).
- `RoadmapCalendar.tsx` has `roadmap.selectedStudyDays` available; renders `<CalendarCell>` per day and the legend via `LEGEND_ITEMS` (`statusStyles.ts`).
- `CalendarCell.tsx` builds the cell class list (~lines 76–84).
- `Step3Preview.tsx` renders the onboarding mini-calendar (`.roadmap-calendar-shell onboarding-mini-calendar`), a session bubble as `roadmap-bubble roadmap-chip-done` (~lines 348–360), `state.selectedStudyDays` available, and a `.cal-legend` (~lines 370–374).

#### Verification (run BEFORE starting)
```bash
grep -n "roadmap-day-in-month:hover" apps/app/src/roadmap/roadmap.css
grep -n "selectedStudyDays" apps/app/src/roadmap/RoadmapCalendar.tsx apps/app/src/onboarding/steps/Step3Preview.tsx
grep -n "roadmap-chip-done" apps/app/src/onboarding/steps/Step3Preview.tsx
```

#### Steps
1. **`roadmap.css` — add the shared indicator** (implements D-04). Place near the other `.roadmap-day-*` rules:
   ```css
   .roadmap-day-studyday { background: color-mix(in srgb, var(--moss) 8%, var(--surface-card)); }
   .roadmap-day-current-week.roadmap-day-studyday { background: color-mix(in srgb, var(--moss) 8%, var(--cal-week-band)); }
   .roadmap-day-today.roadmap-day-studyday,
   .roadmap-day-today.roadmap-day-current-week.roadmap-day-studyday {
     background: var(--cal-today-fill);
   }
   .roadmap-weekday.roadmap-weekday-studyday { color: var(--moss); font-weight: 600; }
   .roadmap-legend-swatch.roadmap-studyday-swatch {
     background: color-mix(in srgb, var(--moss) 8%, var(--surface-card));
     border: 1px solid color-mix(in srgb, var(--moss) 32%, var(--surface-card));
   }
   ```
   The order and combined today selector matter: if a date is both today and in the current week, today keeps `--cal-today-fill`.
   And **scope the hover-lift off the onboarding mini-calendar** (read-only):
   ```css
   .onboarding-mini-calendar .roadmap-day-in-month:hover { transform: none; box-shadow: none; z-index: auto; }
   .onboarding-mini-calendar .roadmap-day { cursor: default; }
   ```
2. **Add the shared weekday helper in `apps/app/src/roadmap/calendarModel.ts`:** keep it beside the existing month-grid helpers so both `RoadmapCalendar` and `Step3Preview` import one source of truth.
   Use the repo's UTC ISO-date weekday convention, matching `sessionPlanning.ts`, `mapEvents.ts`, and `packages/progress/src/progress.ts`.
   Do **not** use `parseISO(dateISO).getDay()` here, because that introduces a local-time weekday convention for study-day matching.
   Do **not** use `new Date(`${dateISO}T00:00:00`)`; that also depends on local timezone.
   ```ts
   const STUDY_DAY_BY_INDEX = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

   export function dayOfWeekForISODate(dateISO: string): string {
     return STUDY_DAY_BY_INDEX[new Date(`${dateISO}T00:00:00.000Z`).getUTCDay()]
   }

   export function isStudyDay(dateISO: string, studyDays: readonly string[] | undefined): boolean {
     if (!studyDays?.length) return false
     return studyDays.includes(dayOfWeekForISODate(dateISO))
   }
   ```
   Add `calendarModel.test.ts` coverage for known dates, including `2026-07-06` → `Mon`, `2026-07-07` → `Tue`, and `2026-07-12` → `Sun`.
3. **`CalendarCell.tsx`:** accept `isStudyDay?: boolean` and add `'roadmap-day-studyday'` to the class list when true.
   `RoadmapCalendar.tsx`: pass `isStudyDay={day.isInMonth && isStudyDay(day.date, roadmap.selectedStudyDays)}` when rendering each `<CalendarCell>`.
   Do not tint outside-month filler cells.
   Add the study-day weekday-header class to the header cells whose weekday is a study day.
   Add a **"Study day"** legend entry (static span with `roadmap-legend-swatch roadmap-studyday-swatch`) alongside the status legend.
4. **`Step3Preview.tsx` + `onboarding.css`:** (a) add `roadmap-day-studyday` to each mini-calendar in-month cell where `day.isInMonth && isStudyDay(day.date, state.selectedStudyDays)`; (b) recolor the session bubble from `roadmap-chip-done` → `roadmap-chip-booked` and add `title` + `aria-label` (e.g. ``Booked study session · ${formatMinutes(booking.estimatedDuration)} · ${format(parseISO(booking.date),'EEE, MMM d')}``); (c) add a "study day" entry to `.cal-legend`; (d) add `.cal-swatch.studyday` in `apps/app/src/onboarding/onboarding.css` with the same moss tint as `.roadmap-studyday-swatch`; (e) update `.cal-swatch.booked` so the legend no longer presents a moss/green booked session swatch after the booked bubble moves to the outline style; (f) the mini-calendar already has `onboarding-mini-calendar` so the Step-1 hover override applies.
   Keep the buffer caption; the tint replaces the "why the 7th" prose.
5. Honour rules: `.agents/rules/css-workspace-packages.agents.md`, `.agents/rules/form-design-spacing.agents.md`. Match the approved mock.

#### Tests
- `CalendarCell.test.tsx` / `RoadmapCalendar.test.tsx`: a study-day in-month cell gets `roadmap-day-studyday`; a non-study day does not; legend shows "Study day".
  Also assert an outside-month filler cell is not tinted even when its weekday is selected.
- New `calendarModel`/util test for `isStudyDay` (weekday mapping correctness — the load-bearing bit).
- `Step3Preview.test.tsx`: session bubble uses `roadmap-chip-booked` (not `-done`) and has a `title`; study-day cells tinted; the legend still includes booked session and now includes study day.
- Author (not run) Playwright: `/onboarding/3?new=1` shows tinted study-day columns and a booked-style session chip.
- Run: `pnpm --filter @study-tracker/app test -- CalendarCell RoadmapCalendar Step3Preview calendarModel`

#### Verification (DONE)
```bash
grep -n "roadmap-day-studyday" apps/app/src/roadmap/roadmap.css apps/app/src/roadmap/CalendarCell.tsx apps/app/src/onboarding/steps/Step3Preview.tsx
grep -n "roadmap-chip-booked" apps/app/src/onboarding/steps/Step3Preview.tsx   # session recolored
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- CalendarCell RoadmapCalendar Step3Preview
```

#### Rollback
Revert the CSS additions + the `isStudyDay` wiring + the Step3Preview chip recolor.

#### Notes (filled in during implementation)
- Added shared UTC weekday helpers in `calendarModel.ts` and unit coverage for known ISO dates.
- Restored `selectedStudyDays`, `weekdayHours`, and `weekendHours` in `RoadmapCalendar`'s local `roadmapInputFromPayload` adapter because the plan assumed `roadmap.selectedStudyDays` was available and the payload/type already carried it.
- Added `roadmap-day-studyday` to in-month roadmap and onboarding preview cells only.
- Added study-day weekday header emphasis and Study day legend entries in both calendars.
- Added moss-8% tint CSS with today/current-week override ordering matching the approved mock.
- Recolored onboarding preview bookings from `roadmap-chip-done` to `roadmap-chip-booked` with `title` and `aria-label`.
- Updated onboarding booked and study-day swatches so future bookings no longer read as completed green.
- Scoped hover-lift off inside `.onboarding-mini-calendar` and set the preview calendar cursor to default.
- Updated `RoadmapCalendar.test.tsx`, `calendarModel.test.ts`, and `Step3Preview.test.tsx`.
- Authored the onboarding preview Playwright case in `e2e/material-session-decoupling.spec.ts`; it was not run per plan.
- Verification passed: `grep -n "roadmap-day-studyday" ...`, `grep -n "roadmap-chip-booked" apps/app/src/onboarding/steps/Step3Preview.tsx`, `pnpm --filter @study-tracker/app typecheck`, and `pnpm --filter @study-tracker/app test -- CalendarCell RoadmapCalendar Step3Preview calendarModel`.
- Commit SHA: `3c8d869`.

---

### Phase 5: Fix the burn-up chart — planned baseline + axes/domain/curve (BUG-5)

**Status:** ✅ Complete - `256616b`, ✅ Reviewer-verified 2026-07-03 (see VERIFICATION.md)
**Depends on:** none — can start immediately
**Estimated scope:** ~4 files, ~130 lines

#### Codebase state assumed at start
- `packages/progress/src/progress.ts`: `buildPlannedCumulative(slots)` (~line 30) + `computeProgress` builds `burnUp.planned = buildPlannedCumulative(roadmap.slots)` (~line 216) and `deficit = lastActual - lastPlanned`. `roadmap` (RoadmapInput) has `startDate, deadline, selectedStudyDays, weekdayHours, weekendHours`.
- `apps/app/src/components/BurnUpChart.tsx`: `minutesToLabel(m)=Math.floor(m/60)+'h'` (~line 34); x-domain from min/max of planned+gp dates (~lines 87–109); GP band/mean use `curveBasis`; y-domain `Math.max(...allMinutes)*1.08` where `allMinutes` includes `gp.upper`.

#### Verification (run BEFORE starting)
```bash
grep -n "buildPlannedCumulative\|burnUp\b\|deficit" packages/progress/src/progress.ts | head
grep -n "minutesToLabel\|curveBasis\|allMinutes\|allDates" apps/app/src/components/BurnUpChart.tsx
pnpm --filter @study-tracker/progress test   # baseline green
```

#### Steps
1. **`packages/progress/src/types.ts` — add optional domain hints to `BurnUpData`:**
   ```ts
   export interface BurnUpData {
     planned: CumulativePoint[]
     actual: CumulativePoint[]
     gpCurve: Array<{ date: string; mean: number; lower: number; upper: number }>
     today: string
     startDate?: string
     deadline?: string
     deficit: number
     dayNumber: number
     totalDays: number
   }
   ```
   Keep `startDate` and `deadline` optional so existing tests and mocks that construct `BurnUpData` directly do not all have to change in this phase.
2. **`packages/progress/src/progress.ts` — capacity-based planned baseline** (implements D-05). Add a package-local helper that builds cumulative *planned* minutes over every selected study day from `startDate` to `deadline`, then use it instead of `buildPlannedCumulative(roadmap.slots)`.
   The helper must mirror the live booking path, not the legacy slot-grid path:
   ```ts
   const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

   function hasCapacityFields(roadmap: RoadmapInput): roadmap is RoadmapInput & {
     selectedStudyDays: string[]
     weekdayHours: number
     weekendHours: number
   } {
     return Array.isArray(roadmap.selectedStudyDays) &&
       roadmap.selectedStudyDays.length > 0 &&
       typeof roadmap.weekdayHours === 'number' &&
       typeof roadmap.weekendHours === 'number'
   }

   function capacityForStudyDay(day: string, roadmap: { weekdayHours: number; weekendHours: number }): number {
     const hours = day === 'Sat' || day === 'Sun' ? roadmap.weekendHours : roadmap.weekdayHours
     return Math.round(Math.max(0, hours) * 60)
   }

   function buildPlannedCumulativeFromCapacity(roadmap: RoadmapInput): CumulativePoint[] {
     if (!hasCapacityFields(roadmap)) return buildPlannedCumulative(roadmap.slots)

     let cumulative = 0
     const planned: CumulativePoint[] = []
     for (let date = roadmap.startDate; date <= roadmap.deadline; date = addDaysISO(date, 1)) {
       const day = DAY_NAMES[new Date(`${date}T00:00:00.000Z`).getUTCDay()]
       if (!roadmap.selectedStudyDays.includes(day)) continue

       cumulative += capacityForStudyDay(day, roadmap)
       planned.push({ date, minutes: cumulative })
     }

     return planned.length > 0 ? planned : buildPlannedCumulative(roadmap.slots)
   }
   ```
   Replace `const plannedCumulative = buildPlannedCumulative(roadmap.slots)` with `buildPlannedCumulativeFromCapacity(roadmap)`.
   Keep `buildPlannedCumulative` as the legacy fallback.
   Recompute `lastPlanned`, `deficit`, and `verdict` from the new series.
   Populate `burnUp.startDate = roadmap.startDate` and `burnUp.deadline = roadmap.deadline`.
   Do not import from `apps/app/src/session/sessionPlanning.ts` or from `@study-tracker/roadmap-engine`.
3. **`BurnUpChart.tsx` — axis formatter and deterministic ticks** (~line 34): export small pure helpers so this behavior is unit-testable.
   ```ts
   export function minutesToLabel(minutes: number): string {
     const safe = Math.max(0, Math.round(minutes))
     const h = Math.floor(safe / 60)
     const min = safe % 60
     if (h === 0) return `${min}m`
     return min === 0 ? `${h}h` : `${h}h ${min}m`
   }

   export function buildMinuteTickValues(maxMinutes: number): number[] {
     const max = Math.max(60, Math.ceil(maxMinutes / 30) * 30)
     const step = max <= 120 ? 30 : max <= 360 ? 60 : 120
     const ticks: number[] = []
     for (let value = 0; value <= max; value += step) ticks.push(value)
     if (ticks[ticks.length - 1] !== max) ticks.push(max)
     return [...new Set(ticks)]
   }
   ```
   Use `tickValues={buildMinuteTickValues(yDomainMax)}` on `AxisLeft` instead of relying only on `numTicks={5}`.
4. **`BurnUpChart.tsx` — degenerate/empty domain guard** (~lines 87–120): include planned, actual, GP, and explicit roadmap-domain dates in the x-domain calculation.
   Export the pure helper so jsdom unit tests do not depend on SVG layout:
   ```ts
   export function buildBurnUpDateDomain(
     hints: Pick<BurnUpData, 'startDate' | 'deadline' | 'today' | 'dayNumber' | 'totalDays'>,
     candidateDates: Date[],
   ): [Date, Date]
   ```
   Build `domainStart` and `domainEnd` from `data.startDate` / `data.deadline` when present.
   If either is missing, derive a fallback from `today`, `dayNumber`, and `totalDays`.
   The x-domain must always include `[domainStart, domainEnd]`, even when planned or GP arrays are sparse.
   Export and use a second pure helper for the empty-state decision:
   ```tsx
   export function hasMeaningfulBurnUpData(
     planned: BurnUpData['planned'],
     actual: BurnUpData['actual'],
   ): boolean {
     const hasMeaningfulPlan = planned.length > 1 || planned.some((point) => point.minutes > 0)
     return actual.length > 0 || hasMeaningfulPlan
   }
   ```
   In the public `BurnUpChart` component, return the empty state before rendering `ParentSize` when `hasMeaningfulBurnUpData(data.planned, data.actual)` is false.
   The empty state copy is: "Log a session to see your burn-up".
5. **`BurnUpChart.tsx` — curves + y-domain:** change the GP band and mean `curve={curveBasis}` → `curve={curveMonotoneX}`.
   Base the primary y-domain on `max(planned, actual, gp.mean)`.
   Include GP upper only as bounded headroom, for example `Math.min(maxGpUpper, primaryMax * 1.25)`, so a wide confidence band cannot flatten the actual and planned lines.
   Apply normal headroom after that bounded max.
   Export this as a pure helper too, for example:
   ```ts
   export function buildBurnUpYDomainMax(series: {
     planned: number[]
     actual: number[]
     gpMean: number[]
     gpUpper: number[]
   }): number
   ```
6. `Week.tsx` needs no behavioral change because it consumes `progress.burnUp` and already gates chart rendering until there are at least three actual points.
   Do not remove that gate in this phase unless Rohit explicitly widens scope.
   The chart's own empty-state tests should render `BurnUpChart` directly, not through `Week`.
   Update any test fixture that fails typechecking only if you made `startDate` / `deadline` required by mistake; they should remain optional.
   Confirm the "N ahead/behind" footer now reflects the corrected `deficit`.

#### Tests
- `progress.test.ts`: new test proving the planned cumulative uses booking-capacity semantics.
  Example: `selectedStudyDays=['Mon','Wed','Sat']`, `weekdayHours=2`, `weekendHours=3`, `startDate='2026-07-06'`, `deadline='2026-07-12'` should yield `Mon 120`, `Wed 240`, `Sat 420`.
  Add a fallback test where capacity fields are missing or `selectedStudyDays=[]`; it must not crash and should use the old slot-based series.
  Add a `deficit` test that uses the new capacity baseline.
- Add `apps/app/src/components/BurnUpChart.test.tsx` for exported helpers and empty state.
  Cover `minutesToLabel`: `45`→`45m`, `90`→`1h 30m`, `120`→`2h`.
  Cover `buildMinuteTickValues` returns unique labels for a low range where the old formatter collapsed.
  Cover `buildBurnUpDateDomain` with sparse/empty chart data and explicit `startDate` / `deadline`.
  Cover `buildBurnUpYDomainMax` so an inflated GP upper cannot flatten the chart beyond the bounded headroom.
  Cover empty-data renders "Log a session to see your burn-up".
- Author (not run) a visual Playwright check of the Week burn-up if practical.
  If it goes through `/study/week`, seed at least three actual data points so the existing Week gate renders `BurnUpChart`.
- Run: `pnpm --filter @study-tracker/progress test && pnpm --filter @study-tracker/app test -- BurnUpChart Week`

#### Verification (DONE)
```bash
grep -n "buildPlannedCumulativeFromCapacity\|startDate" packages/progress/src/progress.ts packages/progress/src/types.ts
grep -n "curveMonotoneX\|buildMinuteTickValues" apps/app/src/components/BurnUpChart.tsx
pnpm --filter @study-tracker/progress test && pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- BurnUpChart Week
```

#### Rollback
Revert `progress.ts` to `buildPlannedCumulative(roadmap.slots)` and restore the original `BurnUpChart` formatter/curve/domain.

#### Notes (filled in during implementation)
*(empty)*

---

**Phases 6-8 below were added post-review (2026-07-03)**, after Phases 1-5 shipped and were reviewer-verified. They fix three issues found during live Playwright verification of those phases — see `VERIFICATION.md`'s Final gate section for how each was found, and D-07 through D-10 above for the rationale. Like Phases 1-5, all three are independent (no cross-dependencies) and ordered easiest→most-involved.

---

### Phase 6: Scroll the mobile DaySheet into view when it opens (BUG-7)

**Status:** ✅ Complete - `33a98c9`, reviewer pending
**Depends on:** none — can start immediately
**Estimated scope:** ~2 files, ~15 lines

#### Codebase state assumed at start
- `apps/app/src/roadmap/DaySheet.tsx` (96 lines total) is a function component that early-returns `null` when `day` is `null` (line 33: `if (!day) return null`) before returning `<section className="roadmap-day-sheet" role="dialog" aria-modal="true" aria-label="Roadmap day sheet">` (line 36). Its only imports are `format, parseISO` from `date-fns` plus local modules (line 1-4) — no `react` import, no hooks used anywhere in the file today.
- `.roadmap-day-sheet` (`apps/app/src/roadmap/roadmap.css` lines 1220-1228) renders in the normal document flow (`margin: var(--space-4) auto 0`), not as a fixed-position overlay — this is why it can render off-screen below the fold on a tall page (confirmed live: tapping a day near the top of the calendar opens the sheet after the Materials section and footer buttons, requiring a manual scroll).
- `apps/app/src/roadmap/RoadmapCalendar.tsx` renders `<DaySheet day={selectedSheetDay} .../>` (~line 639) whenever `selectedSheetDay` is set by `handleMobileDaySelect` (lines 322-326). No changes needed in `RoadmapCalendar.tsx` for this phase — the fix is entirely internal to `DaySheet.tsx`.

#### Verification (run BEFORE starting)
```bash
grep -n "^import" apps/app/src/roadmap/DaySheet.tsx        # no 'react' import present yet
grep -n "if (!day) return null" apps/app/src/roadmap/DaySheet.tsx   # line 33
grep -n "scrollIntoView" apps/app/src/roadmap/DaySheet.tsx  # returns nothing (not yet implemented)
```

#### Steps
1. **Modify `apps/app/src/roadmap/DaySheet.tsx` — add the hook import (top of file, currently line 1):**
   ```tsx
   import { useEffect, useRef } from 'react'
   import { format, parseISO } from 'date-fns'
   ```
2. **Modify `apps/app/src/roadmap/DaySheet.tsx`, the component body (currently lines 26-41):** add the ref and effect *before* the early return — hooks must be called unconditionally on every render, so this requires moving the early return down, not just inserting above it. Attach the ref to the `<section>`.
   ```tsx
   export function DaySheet({
     day,
     onClose,
     onSelectBubble,
     onAddSession,
     canAddSession = false,
   }: DaySheetProps) {
     const sheetRef = useRef<HTMLElement>(null)

     useEffect(() => {
       if (day) sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
     }, [day])

     if (!day) return null

     return (
       <section
         ref={sheetRef}
         className="roadmap-day-sheet"
         role="dialog"
         aria-modal="true"
         aria-label="Roadmap day sheet"
       >
   ```
   Nothing else in the JSX body changes — only the `<section>` tag gains `ref={sheetRef}`.

#### Tests
- Add to `apps/app/src/roadmap/RoadmapCalendar.test.tsx` (no standalone `DaySheet.test.tsx` exists — this file already covers day-sheet interactions, e.g. the existing `'adds a session from a compact empty day sheet'` test): stub `Element.prototype.scrollIntoView = vi.fn()` in a `beforeEach` (jsdom does not implement `scrollIntoView` natively — calling it unstubbed throws), open a day sheet via the existing compact empty-day flow, and assert the stub was called with `{ behavior: 'smooth', block: 'start' }`.
- Run: `pnpm --filter @study-tracker/app test -- RoadmapCalendar`

#### Verification (DONE)
```bash
grep -n "scrollIntoView" apps/app/src/roadmap/DaySheet.tsx   # present, inside the new effect
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- RoadmapCalendar
```

#### Rollback
Remove the `useEffect`/`useRef`/`ref` additions and the `react` import; restore the original early-return-first function body.

#### Notes (filled in during implementation)
- Added `useRef` and `useEffect` to `apps/app/src/roadmap/DaySheet.tsx`.
- Kept both hooks before the `if (!day) return null` early return.
- Attached the ref to the root `<section>` and call `scrollIntoView({ behavior: 'smooth', block: 'start' })` when `day` is non-null.
- Added a `RoadmapCalendar.test.tsx` assertion in the existing compact empty-day flow, with `Element.prototype.scrollIntoView` stubbed per test.
- Verification passed: `grep -n "scrollIntoView" apps/app/src/roadmap/DaySheet.tsx`, `pnpm --filter @study-tracker/app typecheck`, and `pnpm --filter @study-tracker/app test -- RoadmapCalendar`.
- Live browser check passed against the real app at 390px: tapped enabled empty day `Open 2026-07-01 day options`, page scrolled from `0` to max scroll `758`, DaySheet box was fully visible, and the empty state text was present.

---

### Phase 7: Fix onboarding-preview session bubble truncation at narrow mobile width (BUG-8)

**Status:** ✅ Complete - `75f734f`, reviewer pending
**Depends on:** none — can start immediately
**Estimated scope:** ~1 file, ~10-15 lines CSS

#### Codebase state assumed at start
- `apps/app/src/onboarding/steps/Step3Preview.tsx` renders its own inline day-cell/bubble markup (lines 356-376) — it does not delegate to the shared `<CalendarCell>` component (`apps/app/src/roadmap/CalendarCell.tsx`) that the main roadmap calendar uses, so it never gets that component's `isCompact` dot-stack mobile treatment (`CalendarCell.tsx` lines 108-134 render a simplified dot-stack in compact mode vs. lines 136-177 rendering the full bubble otherwise).
- The bubble (`Step3Preview.tsx` lines 360-373) renders: icon `<svg>` (lines 367-370), `<span className="roadmap-bubble-label">Session</span>` (line 371), `<span className="roadmap-bubble-minutes">{formatMinutes(booking.estimatedDuration)}</span>` (line 372).
- `.roadmap-bubble` (`apps/app/src/roadmap/roadmap.css` lines 533-548) uses `grid-template-columns: 16px minmax(0, 1fr) auto`; `.roadmap-bubble-label` (lines 555-559) already has `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`; `.roadmap-bubble-minutes` is already hidden below 780px by an existing, unscoped `@media (max-width: 780px)` rule (lines 1805-1811) that applies everywhere the class appears, including inside `.onboarding-mini-calendar`.
- At ~390px width (7 columns across the viewport), even with minutes already hidden, the remaining `minmax(0,1fr)` label column has only a few px of room, so only a single truncated character is visible — confirmed live via Playwright during this plan's Phase 1-5 review.
- The `title`/`aria-label` on the bubble (`Step3Preview.tsx` line 358: `` `Booked study session · ${formatMinutes(booking.estimatedDuration)} · ${format(parseISO(booking.date), 'EEE, MMM d')}` ``, added in Phase 4) already carry the full text regardless of what's visually shown — this is not an accessibility gap, purely a visual one.
- Phase-4-scoped onboarding rules already exist around `apps/app/src/roadmap/roadmap.css` lines 1753-1770 (the hover-lift scoping) — the new rule for this phase belongs in that same neighborhood, keyed off the same `.onboarding-mini-calendar` class.

#### Verification (run BEFORE starting)
```bash
grep -n "roadmap-bubble-label\|roadmap-bubble-minutes" apps/app/src/roadmap/roadmap.css   # ~555, ~561, ~1809
grep -n "onboarding-mini-calendar" apps/app/src/roadmap/roadmap.css                        # existing Phase-4-scoped rules
```

#### Design pick: Option C — resolved, see D-10
Confirmed with Rohit against the real-CSS mock ([`mocks/proposed/bug8-bubble-truncation.html`](./mocks/proposed/bug8-bubble-truncation.html)): icon + duration, drop the "Session" label entirely (D-10 is ✅ Agreed). Options A, B, and D were considered and rejected — see D-10's Alternatives for why.

#### Steps
1. **Modify `apps/app/src/roadmap/roadmap.css`** — add a rule scoped to `.onboarding-mini-calendar`, placed near the other Phase-4 onboarding-scoped rules (~line 1753-1770):
   ```css
   @media (max-width: 560px) {
     .onboarding-mini-calendar .roadmap-bubble-label {
       display: none;
     }
     .onboarding-mini-calendar .roadmap-bubble {
       grid-template-columns: 14px auto;
     }
   }
   ```
   (The first rule hides the redundant "Session" text; the second tightens the grid from the default 3-column `16px minmax(0,1fr) auto` to a 2-column `14px auto` now that the middle label column is empty, so the icon and duration sit close together rather than leaving a dead gap.)

#### Tests
- No Vitest unit test for the visual truncation behavior itself: this is a pure `@media`-query CSS change with no new class or conditional render, and jsdom does not evaluate media queries for layout (it has no real viewport/layout engine) — a unit test asserting "the label is hidden" would not actually exercise the browser behavior it claims to cover. This follows the same precedent as Phase 2 (BUG-1 sheet centering), which was also verified by grep + a documented visual/Playwright check rather than a Vitest assertion.
- Author a Playwright visual check (this environment can run E2E per `CLAUDE.md` — run it, don't just author it, if practical): at a 390×844 viewport, open `/study/onboarding/3/preview` with a seeded booking, and screenshot the mini-calendar bubble to confirm it now shows icon + duration only, no clipped label.
- Run: `pnpm --filter @study-tracker/app typecheck` (CSS-only change, confirms nothing else broke).

#### Verification (DONE)
```bash
grep -n "onboarding-mini-calendar .roadmap-bubble" apps/app/src/roadmap/roadmap.css   # new rule present
pnpm --filter @study-tracker/app typecheck
```
Plus the manual/Playwright visual check at 390px width confirming icon + duration render cleanly with no truncation.

#### Rollback
Remove the new `@media (max-width: 560px) { .onboarding-mini-calendar ... }` block; no other files touched.

#### Notes (filled in during implementation)
- Added the scoped max-560 onboarding mini-calendar CSS in `apps/app/src/roadmap/roadmap.css`.
- The rule hides `.roadmap-bubble-label`, tightens `.roadmap-bubble` to `14px auto`, and restores `.roadmap-bubble-minutes` display inside `.onboarding-mini-calendar`.
- Deviation: the implementation adds the scoped minutes-display restore because the pre-existing max-780 rule hides `.roadmap-bubble-minutes`.
  The literal step block would have rendered icon-only at 390px, which conflicts with D-10's icon + duration contract.
- Verification passed: DONE grep, `pnpm --filter @study-tracker/app typecheck`, and a 390px real-browser probe against the managed full app.
  The expanded-calendar probe measured visible bubble text `1h`, preserved title/aria copy, hidden label, grid `14px 12px`, and equal booked/empty day heights.

---

### Phase 8: Gate the cold-start cloud-restore race in `SyncProvider` (BUG-6)

**Status:** ✅ Complete - `f6313f8`, reviewer pending
**Depends on:** none — can start immediately (independent of Phases 6-7 and of Phases 1-5)
**Estimated scope:** ~7 files, ~150 lines (+ tests). D-09 is now ✅ Agreed (Option C1) — the design discussion that used to gate Step 7 is done; this phase can be implemented straight through.

#### Codebase state assumed at start
- `apps/app/src/sync/types.ts` lines 3-8 define `SyncState`:
  ```ts
  export interface SyncState {
    status: 'idle' | 'syncing' | 'error' | 'offline';
    lastSyncedAt: Date | null;
    lastError: string | null;
    pendingCount: number;
  }
  ```
- `apps/app/src/sync/SyncEngine.ts`: constructor (lines 64-80) initializes `this.state` with the four fields above and no more. `notifyState(partial: Partial<SyncState>)` (lines 84-87) does `this.state = { ...this.state, ...partial }` then calls `this.onStateChange?.(this.state)`.
- The public `restoreFromCloud()` wrapper (lines 427-440) already has a `try/finally` around the call to `doRestoreFromCloud()`, currently only used to clear `this.restoreInFlight`:
  ```ts
  async restoreFromCloud(): Promise<void> {
    if (this.destroyed) return;
    if (this.restoreInFlight) {
      return this.restoreInFlight;
    }
    this.restoreInFlight = this.doRestoreFromCloud();
    try {
      await this.restoreInFlight;
    } finally {
      this.restoreInFlight = null;
    }
  }
  ```
  This `finally` runs on every settle path of `doRestoreFromCloud()` — success, early return, or thrown error — regardless of which internal branch it took. This is the single choke point this phase hooks into; it is NOT necessary to touch every individual `notifyState` call inside `doRestoreFromCloud()`.
- `doRestoreFromCloud()` (lines 442-568): calls `this.notifyState({ status: 'syncing', lastError: null })` immediately (line 447), then checks `const localEventCount = await this.eventStore.table('events').count()` (line 453). If `localEventCount > 0` (fast path), it does `flushQueue()` + `deduplicateLocalSessionEvents()` + `pullAndMerge()` then `notifyState({ status: 'idle', lastSyncedAt: new Date() })` and returns (lines 454-460) — this is the common path for every returning device and must stay effectively invisible. Otherwise (`localEventCount === 0`, cold start) it fetches a checkpoint, downloads+validates+replays a snapshot, and delta-pulls (lines 462-568) — this is the slow, network-bound path that causes the race.
- `apps/app/src/sync/SyncProvider.tsx`: `useState<SyncState>` initial value (lines 38-43) mirrors the engine's constructor fields. The effect that creates the engine and fires the restore (lines 67-104) currently does `engine.restoreFromCloud().catch(() => {});` at line 98 with nothing gating it, and returns a cleanup at lines 100-103 (`engine.destroy(); engineRef.current = null;`). The provider's return (lines 149-153) is currently `<SyncContext.Provider value={value}>{children}</SyncContext.Provider>` — always renders `children` unconditionally.
- `apps/app/src/auth/ProtectedRoute.tsx` lines 12-20 has the existing plain "Loading..." JSX — this was the placeholder Step 7 fell back to while D-09 was still open. D-09 is now ✅ Agreed (Option C1); Step 7 below no longer uses this JSX at all, it's superseded. Left here only so you can see what's being replaced:
  ```tsx
  <div className="app">
    <div className="card card-elevated" style={{ textAlign: 'center', padding: '2rem' }}>
      <p className="t-body">Loading...</p>
    </div>
  </div>
  ```
- `RequireOnboarding.tsx` and `OnboardingGate.tsx` are **not modified by this phase** — per D-07, the fix is entirely in the sync layer.
- `apps/app/src/sync/SyncEngine.test.ts` already has a `describe('restoreFromCloud', ...)` block (starts ~line 571) with 7 existing tests covering snapshot restore, missing snapshot, schema guard, re-login fast path, dedup, and concurrent-call safety. New tests for this phase belong inside that same `describe` block.
- `apps/app/src/sync/SyncProvider.test.tsx` has no existing fake-timer usage (`grep -c useFakeTimers` returns 0). This no longer matters for the safety-timeout test (see Step 6/Tests) — because the timeout duration becomes a prop (D-09), that test now passes a short real value instead of needing fake timers at all, so this file's fake-timer-free style stays that way.
- `apps/app/src/lib/intelligenceClient.ts:4` already defines `const TIMEOUT_MS = 8000` for its own fetch timeout to the Python service — this is the in-app precedent D-09's safety-timeout number matches; it was not derived from measuring this specific restore operation.
- `packages/design-tokens/src/components.css` is 1049 lines, ends with an `.app-shell-content` block (no trailing newline after its closing `}`), and has no `.boot-*` classes yet. `.auth-mark`/`.auth-mark-name`/`.auth-mark-tag` (lines 316-337) are the existing wordmark treatment `.boot-wordmark` matches; `.session-pulse-dot`'s pulse keyframe (`apps/app/src/session/session.css:121-126`) and `.sync-indicator.syncing .sync-indicator-dot`'s `pulse-sync` keyframe (`components.css:307-314`) are the existing pulse vocabulary `.boot-mark-dot`'s idle pulse matches.
- `apps/app/public/favicon.svg` is the real mark this phase's SVG is built from: `<rect width="32" height="32" rx="6" fill="#2A1F18"/><path d="M8 10h16M8 16h12M8 22h8" stroke="#F5EFE4" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="22" r="3" fill="#B85C38"/>` — one combined `<path>` with three subpaths. Step 5 below splits that into three separate `<path>` elements (same `d` segments, same stroke/fill) so each can get its own `stroke-dasharray`/`animation-delay`.
- **Visual contract:** [`mocks/proposed/bug6-branded-loading.html`](./mocks/proposed/bug6-branded-loading.html) — build Steps 5/8 to match this exactly (it is real CSS + real DOM, Playwright-screenshot-verified, not a sketch).

#### Verification (run BEFORE starting)
```bash
grep -n "status: 'idle'\|status: 'syncing'\|status: 'error'\|status: 'offline'" apps/app/src/sync/types.ts   # the 4 existing states, no initialRestorePending yet
grep -n "finally {" apps/app/src/sync/SyncEngine.ts     # the restoreFromCloud wrapper's finally, ~line 437
grep -n "initialRestorePending" apps/app/src/sync/*.ts apps/app/src/sync/*.tsx   # returns nothing (not yet implemented)
pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider   # baseline green
```

#### Steps
1. **Modify `apps/app/src/sync/types.ts` (lines 3-8) — add the new field:**
   ```ts
   export interface SyncState {
     status: 'idle' | 'syncing' | 'error' | 'offline';
     lastSyncedAt: Date | null;
     lastError: string | null;
     pendingCount: number;
     /** True from construction until the first restoreFromCloud() attempt settles.
      *  Cleared early on the fast (already-hydrated) path; stays true for the
      *  duration of a genuine cold-start snapshot restore. See D-07/D-08. */
     initialRestorePending: boolean;
   }
   ```
2. **Modify `apps/app/src/sync/SyncEngine.ts`, constructor (currently lines 74-79) — default to pending:**
   ```ts
   this.state = {
     status: 'idle',
     lastSyncedAt: null,
     lastError: null,
     pendingCount: 0,
     initialRestorePending: true,
   };
   ```
3. **Modify `apps/app/src/sync/SyncEngine.ts`, `doRestoreFromCloud()` fast path (currently lines 454-460) — clear it immediately, implements D-08:**
   ```ts
   if (localEventCount > 0) {
     this.notifyState({ initialRestorePending: false });
     await this.flushQueue();
     await this.deduplicateLocalSessionEvents();
     await this.pullAndMerge();
     this.notifyState({ status: 'idle', lastSyncedAt: new Date() });
     return;
   }
   ```
   (Only the new `this.notifyState({ initialRestorePending: false });` line is added, right after entering the `if` block, before the existing `flushQueue()` call. The `count()` call itself is a fast local Dexie read, not network-bound, so fast-path users unblock almost instantly.)
4. **Modify `apps/app/src/sync/SyncEngine.ts`, the public `restoreFromCloud()` wrapper (currently lines 427-440) — add one line to the existing `finally`, implements D-07:**
   ```ts
   async restoreFromCloud(): Promise<void> {
     if (this.destroyed) return;

     if (this.restoreInFlight) {
       return this.restoreInFlight;
     }

     this.restoreInFlight = this.doRestoreFromCloud();
     try {
       await this.restoreInFlight;
     } finally {
       this.restoreInFlight = null;
       this.notifyState({ initialRestorePending: false });
     }
   }
   ```
   This single addition covers every slow-path exit (success at line 563, the schema-version-guard error at ~487, the empty-blob error at ~510, the catch-all at ~566, and the bare `return`s that fall through to `pullAndMerge()` at ~476/~504/~539) without touching each of them individually — by the time `restoreFromCloud()`'s `finally` runs, `doRestoreFromCloud()` has already settled one way or another. On the fast path this is a harmless no-op re-clear (already `false` from Step 3).
5. **Modify `apps/app/src/sync/SyncProvider.tsx` — new module-level config + the Option C1 boot screen (D-09), plus initial state.** First, add these right after the existing `DEFAULT_OPTIONS` constant (currently lines 7-9) and before `interface SyncContextValue` (currently line 11):
   ```tsx
   const FALLBACK_INITIAL_RESTORE_SAFETY_TIMEOUT_MS = 8000;
   const LONG_WAIT_COPY_THRESHOLD_MS = 3000;

   /**
    * Parses VITE_INITIAL_RESTORE_TIMEOUT_MS. A pure function (not inlined into a
    * module constant) so it's directly unit-testable per input without needing to
    * re-import the module per env value — see SyncProvider.test.tsx.
    */
   export function resolveInitialRestoreSafetyTimeoutMs(rawEnvValue: string | undefined): number {
     const parsed = Number(rawEnvValue);
     return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_INITIAL_RESTORE_SAFETY_TIMEOUT_MS;
   }

   const DEFAULT_INITIAL_RESTORE_SAFETY_TIMEOUT_MS = resolveInitialRestoreSafetyTimeoutMs(
     import.meta.env.VITE_INITIAL_RESTORE_TIMEOUT_MS
   );

   // Option C1 ("Notebook mark", D-09) — shown only while a brand-new device's
   // cold-start cloud restore is in flight. Visual contract:
   // mocks/proposed/bug6-branded-loading.html. The mark's three lines are separate
   // <path> elements (not one combined path, unlike apps/app/public/favicon.svg)
   // so each can get its own stroke-dasharray/animation-delay in components.css.
   function BootMark() {
     return (
       <svg className="boot-mark-svg" viewBox="0 0 32 32" width="56" height="56" aria-hidden="true">
         <rect width="32" height="32" rx="6" className="boot-mark-bg" />
         <path d="M8 10h16" className="boot-mark-line boot-mark-line-1" />
         <path d="M8 16h12" className="boot-mark-line boot-mark-line-2" />
         <path d="M8 22h8" className="boot-mark-line boot-mark-line-3" />
         <circle cx="24" cy="22" r="3" className="boot-mark-dot" />
       </svg>
     );
   }

   function BootScreen({ longWait }: { longWait: boolean }) {
     return (
       <div className="boot-screen" role="status" aria-live="polite">
         <div className="boot-mark-wrap">
           <BootMark />
         </div>
         <div className="boot-wordmark">Study Tracker</div>
         <div className="boot-caption">{longWait ? 'Still bringing things over' : 'Setting up this device'}</div>
         <div className="boot-subcaption">
           {longWait
             ? 'Larger histories take a little longer. Hang tight.'
             : 'Bringing over your study history — this only happens once.'}
         </div>
       </div>
     );
   }
   ```
   Then add the new prop to `SyncProviderProps` (currently lines 29-35):
   ```tsx
   interface SyncProviderProps {
     children: ReactNode;
     supabase: SupabaseClientLike;
     supabaseUrl?: string;
     userId: string;
     eventStore: EventStore;
     /** Overrides the cold-start safety timeout. Default: DEFAULT_INITIAL_RESTORE_SAFETY_TIMEOUT_MS
      *  (VITE_INITIAL_RESTORE_TIMEOUT_MS, or 8000 if unset/invalid). Mainly for tests — see D-09. */
     initialRestoreSafetyTimeoutMs?: number;
   }
   ```
   Then update the component signature and initial state (currently lines 37-45):
   ```tsx
   export function SyncProvider({
     children,
     supabase,
     supabaseUrl,
     userId,
     eventStore,
     initialRestoreSafetyTimeoutMs = DEFAULT_INITIAL_RESTORE_SAFETY_TIMEOUT_MS,
   }: SyncProviderProps) {
     const [syncState, setSyncState] = useState<SyncState>({
       status: 'idle',
       lastSyncedAt: null,
       lastError: null,
       pendingCount: 0,
       initialRestorePending: true,
     });
     const [initialRestoreTimedOut, setInitialRestoreTimedOut] = useState(false);
     const [showLongWaitCopy, setShowLongWaitCopy] = useState(false);
   ```
6. **Modify `apps/app/src/sync/SyncProvider.tsx`, the engine-creation effect (currently lines 67-104) — reset both timer flags per engine and arm two independent timers, implements D-09:**
   ```tsx
   useEffect(() => {
     if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
       if (engineRef.current) {
         engineRef.current.destroy();
         engineRef.current = null;
       }
     }

     if (lastEventStoreRef.current && lastEventStoreRef.current !== eventStore) {
       if (engineRef.current) {
         engineRef.current.destroy();
         engineRef.current = null;
       }
     }

     setInitialRestoreTimedOut(false);
     setShowLongWaitCopy(false);

     const sendBeaconUrl = supabaseUrl ? `${supabaseUrl}/rest/v1/events` : '';

     const engine = new SyncEngine(
       supabase,
       eventStore,
       userId,
       clientIdRef.current,
       (newState) => setSyncState(newState),
       sendBeaconUrl,
       DEFAULT_OPTIONS
     );

     engineRef.current = engine;
     lastUserIdRef.current = userId;
     lastEventStoreRef.current = eventStore;

     engine.restoreFromCloud().catch(() => {});

     const safetyTimeoutId = setTimeout(() => setInitialRestoreTimedOut(true), initialRestoreSafetyTimeoutMs);
     const longWaitCopyTimeoutId = setTimeout(() => setShowLongWaitCopy(true), LONG_WAIT_COPY_THRESHOLD_MS);

     return () => {
       engine.destroy();
       engineRef.current = null;
       clearTimeout(safetyTimeoutId);
       clearTimeout(longWaitCopyTimeoutId);
     };
   }, [supabase, userId, eventStore, initialRestoreSafetyTimeoutMs]);
   ```
   New versus the original single-timer version: `setShowLongWaitCopy(false)` alongside the existing reset, a second `longWaitCopyTimeoutId` timer (fixed `LONG_WAIT_COPY_THRESHOLD_MS`, independent of the configurable safety timeout — see D-09 on why these are deliberately two separate numbers), its cleanup, and `initialRestoreSafetyTimeoutMs` added to the dependency array (it's now used inside the effect, and is a stable value in real usage — either the module default or a caller-supplied constant — so this does not cause spurious engine recreation).
7. **Modify `apps/app/src/sync/SyncProvider.tsx`, the return statement (currently lines 149-153) — render `BootScreen` while pending, implements D-07/D-09:**
   ```tsx
   const shouldBlockOnInitialRestore = effectiveSyncState.initialRestorePending && !initialRestoreTimedOut;

   return (
     <SyncContext.Provider value={value}>
       {shouldBlockOnInitialRestore ? <BootScreen longWait={showLongWaitCopy} /> : children}
     </SyncContext.Provider>
   );
   ```
   Place the `shouldBlockOnInitialRestore` line right before the `return`, after the existing `value` object is built (currently lines 143-147) so it can read `effectiveSyncState` (already computed at lines 139-141).
8. **Modify `packages/design-tokens/src/components.css` — append the Option C1 CSS (D-09).** Add at the end of the file (currently 1049 lines, ends with the `.app-shell-content` block):
   ```css

   /* ---- Boot screen (Option C1, D-09) — brand-new device cold-start cloud restore ---- */
   .boot-screen {
     min-height: 100vh;
     min-height: 100dvh;
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     gap: var(--space-2);
     padding: var(--space-6);
     text-align: center;
     background: radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--terracotta) 5%, var(--surface-page)), var(--surface-page) 70%);
   }

   .boot-mark-wrap { margin-bottom: var(--space-3); }
   .boot-mark-svg { display: block; }
   .boot-mark-bg { fill: var(--ink); }
   .boot-mark-line { fill: none; stroke: var(--paper); stroke-width: 2; stroke-linecap: round; }
   .boot-mark-dot { fill: var(--terracotta); }

   .boot-mark-line-1 { stroke-dasharray: 16; stroke-dashoffset: 16; animation: boot-line-draw 400ms var(--ease-out) 100ms forwards; }
   .boot-mark-line-2 { stroke-dasharray: 12; stroke-dashoffset: 12; animation: boot-line-draw 360ms var(--ease-out) 320ms forwards; }
   .boot-mark-line-3 { stroke-dasharray: 8;  stroke-dashoffset: 8;  animation: boot-line-draw 300ms var(--ease-out) 540ms forwards; }
   .boot-mark-dot {
     opacity: 0;
     transform-origin: 24px 22px;
     animation: boot-dot-in 340ms var(--ease-spring) 760ms forwards,
                boot-dot-pulse 2.6s ease-in-out 1100ms infinite;
   }

   @keyframes boot-line-draw { to { stroke-dashoffset: 0; } }
   @keyframes boot-dot-in {
     from { opacity: 0; transform: scale(0.3); }
     60%  { opacity: 1; transform: scale(1.15); }
     to   { opacity: 1; transform: scale(1); }
   }
   @keyframes boot-dot-pulse {
     0%, 100% { opacity: 1; transform: scale(1); }
     50%      { opacity: 0.55; transform: scale(0.88); }
   }

   .boot-wordmark {
     font-family: var(--font-display);
     font-style: italic;
     font-weight: 400;
     font-size: 28px;
     color: var(--text-primary);
     letter-spacing: -0.015em;
     opacity: 0;
     animation: boot-fade-up 420ms var(--ease-out) 480ms forwards;
   }
   .boot-caption {
     font-family: var(--font-mono);
     font-size: 11px;
     letter-spacing: 0.1em;
     text-transform: uppercase;
     color: var(--text-tertiary);
     margin-top: var(--space-1);
     opacity: 0;
     animation: boot-fade-up 420ms var(--ease-out) 640ms forwards;
   }
   .boot-subcaption {
     max-width: 280px;
     font-family: var(--font-body);
     font-size: 13px;
     line-height: 1.5;
     color: var(--text-tertiary);
     margin-top: var(--space-2);
     opacity: 0;
     animation: boot-fade-up 420ms var(--ease-out) 780ms forwards;
   }
   @keyframes boot-fade-up {
     from { opacity: 0; transform: translateY(6px); }
     to   { opacity: 1; transform: translateY(0); }
   }

   @media (prefers-reduced-motion: reduce) {
     .boot-mark-line { stroke-dashoffset: 0 !important; animation: none !important; }
     .boot-mark-dot  { opacity: 1 !important; transform: scale(1) !important; animation: none !important; }
     .boot-wordmark, .boot-caption, .boot-subcaption { opacity: 1 !important; animation: none !important; transform: none !important; }
   }
   ```
   This is the exact CSS from the approved mock's Option C1, minus the C2/C3-only rules (`.boot-screen-ink`, `.boot-glow`, `.on-ink` modifiers, `.boot-card*`) which don't ship.
9. **Document the new env var.** In `CLAUDE.md`'s Environment Variables section, extend the existing `apps/app/.env.local` line to add `VITE_INITIAL_RESTORE_TIMEOUT_MS` (optional, defaults to `8000`ms — see D-09), the same way `VITE_INTELLIGENCE_URL` is already documented there. In `apps/app/.env.example`, read the file first to see its current `VITE_INTELLIGENCE_URL` entry's exact style/comment convention, then add a `VITE_INITIAL_RESTORE_TIMEOUT_MS` entry matching that same style (commented out, since it's optional and defaults to 8000).

#### Tests
- In `apps/app/src/sync/SyncEngine.test.ts`, inside the existing `describe('restoreFromCloud', ...)` block:
  - Add `it('clears initialRestorePending immediately on the fast (already-hydrated) path')` — seed local events first (matching the existing "does not wipe and re-append on re-login when local events already exist" test's setup at ~line 675), call `restoreFromCloud()`, and assert `engine.getState().initialRestorePending === false`.
  - Add `it('keeps initialRestorePending true until a cold-start restore settles (success case)')` — empty local DB (matching the existing "restores local events from snapshot" test's setup at ~line 572), assert `initialRestorePending` is `true` synchronously after calling `restoreFromCloud()` but before awaiting it, then `false` after it resolves.
  - Add `it('clears initialRestorePending even when a cold-start restore errors')` — reuse the existing "refuses snapshot with future schemaVersion" test's setup (~line 645, an error path) and assert `initialRestorePending` is `false` after `restoreFromCloud()` resolves despite the error.
- In `apps/app/src/sync/SyncProvider.test.tsx`, inside the existing `describe('SyncProvider', ...)` block (a new nested `describe('initial restore gating (D-07/D-08/D-09)', ...)` is a natural place, alongside the file's existing `describe('restoreFromCloud on mount', ...)` etc.):
  - Add `it('withholds children while the initial restore is pending, then renders the boot screen, then children once it clears')` — spy on `SyncEngine.prototype.restoreFromCloud` (per `.claude/rules/sync-provider-testing.md` — prototype spy, not instance, since the engine is constructed inside a `useEffect`) with a controllable/deferred promise (`new Promise<void>((resolve) => { resolveRestore = resolve })`, `mockReturnValue`d), render `SyncProvider`, assert `screen.getByText('Study Tracker')` (the `BootScreen` wordmark) is present and the child test content (`screen.queryByTestId(...)`) is absent while unresolved, then `await act(async () => { resolveRestore(); await restorePromise })`, and assert the wordmark is gone and the child content is present.
  - Add `it('renders children after the safety timeout even if restoreFromCloud never settles')` — spy on `SyncEngine.prototype.restoreFromCloud` returning `new Promise(() => {})` (never resolves), render `<SyncProvider initialRestoreSafetyTimeoutMs={50} ...>`, and `await waitFor(() => expect(screen.getByTestId(...)).toBeInTheDocument())`. No `vi.useFakeTimers()` needed — because the timeout is now an injectable prop (D-09) rather than a hardcoded 8000ms, the test can just use a genuinely short real value and this file's existing fake-timer-free style is preserved.
  - Add a new top-level `describe('resolveInitialRestoreSafetyTimeoutMs', ...)` block (import it from `./SyncProvider`, alongside the existing `SyncProvider`/`useSync`/`SyncEngine` imports at the top of the file) with four cases: `undefined` → `8000`; `'3000'` → `3000`; `'abc'` (non-numeric) → `8000`, not `NaN`; `'0'` and `'-100'` (non-positive) → `8000`. This is a plain function test, no rendering needed.
- Update `CLAUDE.md`'s Environment Variables section and `apps/app/.env.example` per Step 9 — doc-only, no test, but include in the phase's diff.
- Run: `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider`

#### Verification (DONE)
```bash
grep -n "initialRestorePending" apps/app/src/sync/types.ts apps/app/src/sync/SyncEngine.ts apps/app/src/sync/SyncProvider.tsx   # present in all three
grep -n "resolveInitialRestoreSafetyTimeoutMs\|BootScreen\|initialRestoreSafetyTimeoutMs" apps/app/src/sync/SyncProvider.tsx     # present
grep -n "\.boot-screen\b" packages/design-tokens/src/components.css   # new CSS present
grep -n "VITE_INITIAL_RESTORE_TIMEOUT_MS" CLAUDE.md apps/app/.env.example   # documented in both
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider
```
Plus a live re-check of the original repro: fresh Playwright profile (`chromium.launchPersistentContext` with a brand-new, never-used `userDataDir`), sign in, immediately `page.goto()` a `RequireOnboarding`-gated route (e.g. `/study/roadmaps`), and confirm it no longer transiently visits `/onboarding/1` before settling — it should show the Option C1 boot screen (mark drawing in, then wordmark/caption), then land directly on the correct destination. While doing this check, note the actual observed wall-clock duration of the cold-start restore (e.g. via the browser's network panel or a `console.time`/`console.timeEnd` bracketing `restoreFromCloud()`) and record it in this phase's Notes — this is the real telemetry D-09 explicitly deferred gathering to this step, so a future adjustment to `VITE_INITIAL_RESTORE_TIMEOUT_MS` has data behind it instead of another guess. Also verify the reduced-motion fallback: `page.emulateMedia({ reducedMotion: 'reduce' })` before triggering the cold-start path, confirm the mark renders fully-drawn/static with no animation.

#### Rollback
Revert `apps/app/src/sync/types.ts`, `SyncEngine.ts`, and `SyncProvider.tsx` to drop `initialRestorePending`/`resolveInitialRestoreSafetyTimeoutMs`/`BootScreen`/the two timers (remove `initialRestorePending` from `SyncState`, the constructor, the fast-path clear, the `finally` clear, and `SyncProvider`'s new constants/components/props/initial state/timers/render branch). Remove the `.boot-*` block from `packages/design-tokens/src/components.css`. Revert the `CLAUDE.md`/`apps/app/.env.example` doc additions. The two onboarding gates were never touched, so no rollback needed there.

#### Notes (filled in during implementation)
- Implemented `initialRestorePending` in `SyncState`, `SyncEngine`, and `SyncProvider`.
- The already-hydrated fast path clears the flag immediately before `flushQueue()`/`pullAndMerge()`.
- The public `restoreFromCloud()` wrapper clears the flag in `finally`, covering every slow-path success/error/early-return exit.
- `SyncProvider` now withholds children behind the D-09 Option C1 `BootScreen` while the initial restore is pending, then falls back after configurable `initialRestoreSafetyTimeoutMs`.
- The timeout defaults through `resolveInitialRestoreSafetyTimeoutMs(import.meta.env.VITE_INITIAL_RESTORE_TIMEOUT_MS)` with an 8000ms fallback, and `apps/app/.env.example` plus `CLAUDE.md` document the optional override.
- Added SyncEngine tests for fast-path clear, cold-start pending-until-success, and cold-start error clear.
- Added SyncProvider tests for boot-screen gating, safety-timeout fallback, and timeout parsing.
- Updated `SyncIndicator.test.tsx` fixtures for the new required `SyncState.initialRestorePending` field.
- Focused verification passed: `pnpm --filter @study-tracker/app typecheck` and `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider`.
- Live fresh-profile verification passed against the real running app and test login: route log stayed on `/study/roadmaps`, never visited `/study/onboarding/1`, boot screen was visible, and the observed cold-start boot-screen duration was about 2808ms.
- Reduced-motion verification passed: boot mark, dot, and caption animations computed to `none`, with the mark fully drawn/static.
- Deviations: the provider transition test uses the real `restoreFromCloud()` path with a prototype spy rather than a fully mocked deferred restore, because a full mock would not exercise the engine state notification that clears the provider gate.
- Deviations: boot subcaption uses a plain hyphen instead of the mock's em dash, and the new boot CSS uses `letter-spacing: 0`, to comply with active repo/frontend instructions.

---

### Phase 9: Suggested upcoming sessions on the roadmap calendar (FEAT, D-11)

**Status:** ☐ Not started
**Depends on:** none — can start immediately (independent of Phases 1–8; Phase 4's study-day tint is complementary but not required)
**Estimated scope:** ~6 files, ~140 lines. Implements D-11.

#### Codebase state assumed at start
- `apps/app/src/roadmap/RoadmapCalendar.tsx`: has `selectedRoadmap` (`RoadmapLifecycleEntry`), `roadmap` (`RoadmapInput`, exposes `startDate, deadline, selectedStudyDays, weekdayHours, weekendHours`), `today`, `readOnly`, `materialLedger` (`MaterialLedgerEntry[]` with `remainingEstimatedMinutes/done/started/materialId/title`), `bookings` = `deriveBookingsForRoadmap(...)`, `handleCreateBooking(draft)` (emits `SessionBooked`), and the `calendar` useMemo that calls `deriveBookingStatuses` + `bindCells`.
- `@study-tracker/roadmap-engine` exports `generateBookings(input: BookingLayoutInput)` (pure, deterministic, book-to-exhaustion + per-day capacity via `capacityForBookingDay`) and `suggestMaterialForBooking(materials, ledger, usedMaterialIds)`.
- `apps/app/src/roadmap/calendarModel.ts`: `CalendarBubbleStatus = 'done'|'booked'|'missed'|'unplanned'` (line 35); `bubbleForBooking`/`bubbleForActivity`; `bindCells(grid, derivedBookings, unplannedActivity, materialsById)` (line 203); `CalendarBubble.kind` is `'booking'|'activity'`.
- `apps/app/src/roadmap/statusStyles.ts`: `STATUS_STYLES` map + `LEGEND_ITEMS`.
- `apps/app/src/roadmap/CalendarCell.tsx`: renders `roadmap-bubble` buttons in the non-compact branch and dots in compact; `onBubbleClick(bubble)` routed to `handleCalendarBubbleSelect` in RoadmapCalendar.

#### Verification (run BEFORE starting)
```bash
grep -n "generateBookings\|suggestMaterialForBooking" packages/roadmap-engine/src/index.ts   # exported
grep -n "CalendarBubbleStatus" apps/app/src/roadmap/calendarModel.ts                          # ~35
grep -n "deriveBookingsForRoadmap\|materialLedger\|handleCreateBooking" apps/app/src/roadmap/RoadmapCalendar.tsx
pnpm --filter @study-tracker/app test -- RoadmapCalendar   # baseline green
```

#### Steps
1. **New `apps/app/src/roadmap/suggestedBookings.ts`** — pure derivation (D-11):
   ```ts
   import { generateBookings, suggestMaterialForBooking, type Booking, type Material } from '@study-tracker/roadmap-engine'
   import type { RoadmapInput } from '@study-tracker/progress'          // or the shared RoadmapInput type used by RoadmapCalendar
   import type { MaterialLedgerEntry } from '@study-tracker/progress'

   export interface SuggestedBooking { id: string; date: string; estimatedDuration: number; materialId?: string }

   // Suggested = book-to-exhaustion over REMAINING material, today→deadline, minus days that already have a confirmed booking.
   export function deriveSuggestedBookings(args: {
     roadmap: Pick<RoadmapInput, 'startDate'|'deadline'|'selectedStudyDays'|'weekdayHours'|'weekendHours'>
     ledger: MaterialLedgerEntry[]
     confirmedBookings: Booking[]
     today: string
   }): SuggestedBooking[] {
     const { roadmap, ledger, confirmedBookings, today } = args
     if (!roadmap.selectedStudyDays?.length) return []
     const remainingMaterials: Material[] = ledger
       .filter((m) => !m.done && m.remainingEstimatedMinutes > 0)
       .map((m, i) => ({ id: m.materialId, title: m.title, totalMinutes: m.remainingEstimatedMinutes, role: 'foundation', additionOrder: i }))
     if (remainingMaterials.length === 0) return []
     const { bookings } = generateBookings({
       startDate: today, deadline: roadmap.deadline,
       selectedStudyDays: roadmap.selectedStudyDays,
       weekdayHours: roadmap.weekdayHours, weekendHours: roadmap.weekendHours,
       materials: remainingMaterials,
     })
     const confirmedDates = new Set(confirmedBookings.map((b) => b.date))
     const ledgerForSuggest = ledger.map((m) => ({ materialId: m.materialId, done: m.done, started: m.started }))
     const used: string[] = []
     return bookings
       .filter((b) => b.date >= today && !confirmedDates.has(b.date))
       .map((b, i) => {
         const materialId = suggestMaterialForBooking(remainingMaterials, ledgerForSuggest, used)
         if (materialId) used.push(materialId)
         return { id: `suggested:${b.date}:${i}`, date: b.date, estimatedDuration: b.estimatedDuration, materialId }
       })
   }
   ```
   Confirm the exact `Material.role` union and `RoadmapInput`/`MaterialLedgerEntry` import paths against the packages; adjust if the app re-exports them elsewhere.
2. **`calendarModel.ts`:** add `'suggested'` to `CalendarBubbleStatus` (line 35); add a `bubbleForSuggested(s, materialsById)` builder (id `suggested:${s.id}`, `status:'suggested'`, `kind:'suggested'`, `label = materialTitle ?? 'Suggested session'`, `minutes/plannedMinutes = s.estimatedDuration`, `materialId`); extend `bindCells` with a new `suggested: SuggestedBooking[] = []` param that pushes suggested bubbles **only onto dates that have no existing bubble** (so a confirmed booking or logged activity always wins). Add `'suggested'` to `CalendarBubble['kind']`.
3. **`statusStyles.ts`:** add a `suggested` entry to `STATUS_STYLES` — outlined/dashed **ghost** chip in moss (`chipClass: 'roadmap-chip-suggested'`, `icon: 'ti-plus'` or `'ti-clock'`), visually lighter than `booked`. Add a **"Suggested"** entry to `LEGEND_ITEMS` (or a separate legend constant if you don't want it to render as a status filter).
4. **`roadmap.css`:** add `.roadmap-chip-suggested` — dashed border in `color-mix(in srgb, var(--moss) 45%, transparent)`, text `var(--moss-soft)`, transparent/tinted fill; clearly distinct from the solid `booked` outline. Keep it legible in the compact dot-stack (a moss dot).
5. **`CalendarCell.tsx`:** render suggested bubbles like bookings but with the suggested style and a `title="Suggested session — tap to book"`; in compact mode include them in the dot-stack. No new interaction wiring here beyond passing the bubble to `onBubbleClick`.
6. **`RoadmapCalendar.tsx`:**
   - Compute `const suggested = useMemo(() => (!readOnly && roadmap) ? deriveSuggestedBookings({ roadmap, ledger: materialLedger, confirmedBookings: bookings, today }) : [], [readOnly, roadmap, materialLedger, bookings, today])`.
   - Pass `suggested` into `bindCells(grid, derived.bookings, derived.unplanned, materialsById, suggested)`.
   - In `handleCalendarBubbleSelect`, branch on `bubble.status === 'suggested'` → `void handleAcceptSuggestion(bubble)` instead of opening a detail/editor.
   - Add `handleAcceptSuggestion(bubble)` → `logEvent('SessionBooked', { roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt, bookingId: crypto.randomUUID(), date: bubble.date, estimatedDuration: bubble.plannedMinutes, ...(bubble.materialId ? { materialId: bubble.materialId } : {}) })`. (Mirrors `handleCreateBooking`.)
   - Ensure the mobile `DaySheet` path also accepts a suggested row (its `onSelectBubble` → same branch). Read-only view passes no suggestions (guarded above).
7. Honour `.agents/rules/roadmap-engine.agents.md` (engine stays pure/deterministic — suggestions are derived in the app layer; the `suggested:*` ids are display-only and never persisted; the accepted booking gets a fresh `crypto.randomUUID()`).

#### Tests
- `apps/app/src/roadmap/suggestedBookings.test.ts` (new): remaining 5h with 2h/day cap on Mon/Wed/Fri from today → suggestions of 120/120/60 on the next three study days; a day with a confirmed booking is skipped; `done`/zero-remaining materials produce no suggestions; empty `selectedStudyDays` → `[]`.
- `calendarModel.test.ts`: `bindCells` places a suggested bubble only on an otherwise-empty date; a confirmed booking on the same date suppresses the suggestion.
- `RoadmapCalendar.test.tsx`: suggested bubbles render for an active roadmap with remaining material; clicking one emits `SessionBooked` (with the suggested date/duration/material) and no other event; `readOnly` renders zero suggestions.
- Author (not run) a Playwright case: open `/roadmap` with remaining material → suggested sessions visible on upcoming study days → click one → it becomes a confirmed booking.
- Run: `pnpm --filter @study-tracker/app test -- suggestedBookings calendarModel RoadmapCalendar`

#### Verification (DONE)
```bash
grep -n "deriveSuggestedBookings" apps/app/src/roadmap/suggestedBookings.ts apps/app/src/roadmap/RoadmapCalendar.tsx
grep -n "roadmap-chip-suggested\|'suggested'" apps/app/src/roadmap/statusStyles.ts apps/app/src/roadmap/calendarModel.ts
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app test -- suggestedBookings calendarModel RoadmapCalendar
```

#### Rollback
Delete `suggestedBookings.ts`, revert the `suggested` status/style/bindCells arg, and the RoadmapCalendar derive+accept wiring. No persisted data to unwind (suggestions were never events).

#### Notes (filled in during implementation)
*(empty)*

---

## Open questions

### OQ-01: Back-to-/roadmaps exit from re-entrant onboarding (BUG-4 4d)
**Why deferred:** Rohit said "move on"; not blocking the tint/legibility fixes.
**Triggers needing resolution:** any re-entrant-onboarding UX work, or user complaints about being stuck in setup.
**Owner / resolution path:** product decision + a small nav affordance in the onboarding preview/layout.
**Cross-ref:** D-06.

## Out of scope

- **Add-material-to-existing-roadmap flow** — not built anywhere today; a separate feature, not part of BUG-3's button removal (D-01).
- **Consolidating `.bk-*` onto the design-system `.modal-overlay`/`.modal-card`** — deferred follow-up to D-02; this plan does the minimal centering fix.
- **Moving any chart rendering to the Python service** — explicitly rejected (D-05); Python plotting stays for research/dissertation figures.
- **Server-side ETA/`/v1/progress` parity** — unchanged; still OQ in the upstream plan.
- **Giving the onboarding-preview mini-calendar the main calendar's full `isCompact` dot-stack treatment** — considered and rejected as the fix for BUG-8 (D-10); a bigger change than the cosmetic truncation fix warrants, and built for a tap interaction the read-only preview doesn't have.
- **Modifying `RequireOnboarding.tsx` or `OnboardingGate.tsx`** — explicitly not needed for BUG-6 (D-07); the fix is centralized in `SyncProvider` instead.

## References

- Triage log + root causes: [`SCRATCHPAD.md`](./SCRATCHPAD.md)
- Approved visual contract (Phase 4): [`mocks/proposed/study-day-indicator.html`](./mocks/proposed/study-day-indicator.html)
- Approved visual contract (Phase 8/D-09): [`mocks/proposed/bug6-branded-loading.html`](./mocks/proposed/bug6-branded-loading.html)
- Upstream decoupling plan: [`../2026-06-30-material-session-decoupling/PLAN.md`](../2026-06-30-material-session-decoupling/PLAN.md)
- Verification log: [`VERIFICATION.md`](./VERIFICATION.md)
- Rules: `.agents/rules/{css-workspace-packages,form-design-spacing,react-router-v7-basename,roadmap-engine,dexie-test-setup}.agents.md`
- Rules for Phase 8 (added post-review): `.claude/rules/{sync-architecture,auth-init-timeout,sync-provider-testing}.md` (mirrors: `.agents/rules/{sync-architecture,auth-init-timeout,sync-provider-testing}.agents.md`)
