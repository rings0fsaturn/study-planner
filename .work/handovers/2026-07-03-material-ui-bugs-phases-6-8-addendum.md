---
date: 2026-07-03
mode: transition
slug: material-ui-bugs-phases-6-8-addendum
task: .work/plans/active/2026-07-02-material-session-ui-bugs
---

# Handover — material-session-ui-bugs Phases 6-8 addendum, Phase 8/D-09 design in progress

## TL;DR
Reviewed and reviewer-verified all 5 phases of the material-session-ui-bugs plan (commits `0268f20`/`3c8d869`/`256616b`) via diff inspection + live Playwright testing against the real app with real test-account login — no changes requested. That live testing surfaced 3 new, out-of-scope issues; wrote them up as Phases 6-8 in the *same* plan file (not a new plan doc). Resolved Phase 7's design fork via a real-CSS mock — Rohit picked **Option C**. Got a directional pick for Phase 8's loading-UI decision (D-09: **Option C, a branded moment**) but not the concrete treatment. Next session: design D-09's concrete treatment, then implement Phases 6-8 (all independent, no cross-dependencies).

## Goal / why
- Rohit asked for a code review of an already-implemented 5-phase UI bugfix plan, specifically via Playwright + real test-account login (not hermetic/mocked users — `SUPABASE_SERVICE_ROLE_KEY` is unset in this environment anyway, so hermetic specs auto-skip).
- The review found all 5 original phases correct (no changes requested) — see `VERIFICATION.md` for the full per-phase reviewer findings if that level of detail is ever needed again; this handover does not repeat it.
- That review surfaced 3 issues outside the original 5 bugs' scope during live testing; Rohit chose to fix all 3 as a plan addendum (Phases 6-8) rather than spin up separate work items.
- **Constraint:** Rohit wants a real rendered comparison, not prose descriptions, before deciding narrow, genuinely-ambiguous UI treatments — established via the Phase 7 mock process; expected to repeat for Phase 8's loading screen.
- **Constraint:** the "test account" (`iamrohitsaji@gmail.com`) is Rohit's own real, long-lived dev account with substantial genuine history (294+ events, one real active roadmap), not a disposable/hermetic one — treat with production-like care (add and clean up afterward, never destructive resets).

## Key references
| File | Why it matters |
|---|---|
| `.work/plans/active/2026-07-02-material-session-ui-bugs/PLAN.md` | The living plan — Phases 1-8, Decisions D-01..D-10, Open Questions. Read this first for anything code-related, not this handover. |
| `.work/plans/active/2026-07-02-material-session-ui-bugs/VERIFICATION.md` | Reviewer findings for Phases 1-5 (all ✅ Verified) plus pre-filled acceptance criteria for Phases 6-8 (not yet implemented). |
| `.work/plans/active/2026-07-02-material-session-ui-bugs/SCRATCHPAD.md` | Living "Now/Open/Decisions in force" state, kept current through this session — best single-page orientation. |
| `.work/plans/active/2026-07-02-material-session-ui-bugs/mocks/proposed/bug8-bubble-truncation.html` | Real-CSS mock that resolved Phase 7 (D-10 → Option C). Also the technique template to reuse for Phase 8/D-09's mock next session. |
| `apps/app/src/sync/SyncEngine.ts`, `SyncProvider.tsx`, `types.ts` | Phase 8's actual target files — fully spec'd with exact line numbers and literal code in `PLAN.md`'s Phase 8 section. |
| `apps/app/src/auth/ProtectedRoute.tsx` (lines 12-20) | The existing plain "Loading..." card — the now-superseded placeholder for Phase 8's loading UI (D-09 wants something more considered, Option C). |

## What I learned

**The cold-start race mechanism (BUG-6/Phase 8).** `SyncEngine.doRestoreFromCloud()` branches on a local Dexie event count — a device with existing local data takes a fast, invisible path (flush + dedupe + pull); a genuinely empty local DB takes a slow path (download + replay a cloud snapshot). The race only exists on the slow path (a device's first-ever login). The clean fix hooks into the *existing* `try/finally` inside the public `restoreFromCloud()` wrapper (already there for `restoreInFlight` cleanup) — one added line there clears the new flag on every slow-path exit; no need to touch each of the ~5 individual exit branches inside `doRestoreFromCloud` itself (see [Dead ends](#dead-ends) — the first draft assumed otherwise).

**Mocking a treatment gated by a real `@media` query needs an iframe, not a plain div.** A `@media (max-width:560px)` rule evaluates against the actual browser viewport — a narrow `<div>` inside a wide browser window never triggers it. `<iframe srcdoc="...">` gets its own independent viewport, so sizing the iframe itself to 390px genuinely activates the query. This is the technique behind `bug8-bubble-truncation.html`.

**This project's mock convention.** `mocks/real-css/*.css` are verbatim copies of the live app's CSS — refresh them from source before building a new mock, they go stale fast (Phase 4's copies were already stale by this session, from before Phase 4 itself had even shipped). `mocks/proposed/*.html` link/embed that CSS plus real component DOM, so what Rohit reviews is pixel-accurate to production, not an approximation.

**The real test account.** `iamrohitsaji@gmail.com` has substantial genuine history and one real active roadmap ("Tests", Jun 27 - Jul 11 2026). A brand-new Playwright browser profile hits a real cold-start restore race against it (this is literally how BUG-6 was discovered) — use a persistent profile (`chromium.launchPersistentContext` with a fixed `userDataDir`) for repeat testing so you don't re-pay that cost on every run.

## Decisions made
| Decision | Status | What |
|---|---|---|
| D-07 | ✅ Agreed | Phase 8 gates centrally in `SyncProvider`; `RequireOnboarding`/`OnboardingGate` stay untouched |
| D-08 | ✅ Agreed | Fast path clears the new flag instantly; only a genuine cold-start restore blocks |
| D-10 | ✅ Agreed | Phase 7 ships **Option C** — icon + duration, drop the redundant "Session" label |
| D-09 | 🟡 In progress | Phase 8's loading UI: direction is **Option C, a branded moment** (not the plain reused card) — concrete treatment and the 8000ms safety-timeout number are both still open |

## Open questions & assumptions
- **D-09 concrete design (the actual next-session task):** what does "a branded moment" look like — wordmark, animation, copy? Nothing designed yet, only the direction is chosen.
- **D-09 safety-timeout value:** currently an unconfirmed placeholder of 8000ms in Phase 8's Step 7 code — this number hasn't been discussed at all against the Option C pick, treat as fully open.
- Lower-priority, carried over from the original review, not blocking anything: run the authored hermetic E2E specs (`e2e/material-session-decoupling.spec.ts`) on a machine with `SUPABASE_SERVICE_ROLE_KEY` set.

## Dead ends
- **Mocking Phase 7's "zoomed single cell" via a CSS grid-column override.** Tried forcing `.roadmap-week-row` to `grid-template-columns: 1fr` for a lone cell — this made the cell ~4x its real width, silently "fixing" the truncation bug in the mock and defeating the whole comparison. A `transform:scale()`-based true zoom was considered but needs fragile pixel-offset math to crop correctly afterward. Removed the zoom section entirely rather than ship something misleading; the full-calendar-at-true-scale comparison was sufficient on its own.
- **Option B's `white-space: normal` alone doesn't wrap "Session".** It's a single word with no space to break at, so nothing wraps without also adding `overflow-wrap: anywhere` (then `-webkit-line-clamp: 2` to cap it at a clean 2 lines instead of 3 cramped ones). Not going forward as an option anyway (rejected in D-10), but the underlying CSS gotcha — single unbreakable words don't wrap under plain `white-space:normal` — could resurface elsewhere.
- **Touching every individual exit branch inside `doRestoreFromCloud()` for the D-08 fix.** The first-draft plan (written before fully reading `SyncEngine.ts`) assumed this was necessary. Reading the actual code found `restoreFromCloud()`'s wrapper already has a `try/finally` that fires on every exit path regardless — one line there instead. `PLAN.md`'s Phase 8 already reflects the cleaner version; don't revert to the branch-by-branch approach.

## Next action
Design Phase 8/D-09's concrete Option C ("branded moment") loading-screen treatment with Rohit — likely by building a real-CSS mock the same way `bug8-bubble-truncation.html` was built, then separately confirm or adjust the 8000ms safety-timeout default.

## User context
- Rohit wants real rendered comparisons, not prose descriptions, before picking between UI options whenever there's genuine ambiguity — this worked well for Phase 7 and is expected to repeat for Phase 8/D-09.
- Rohit is comfortable with pure-engineering decisions (no design ambiguity) being made without a mock or explicit sign-off — accepted D-08 as ✅ Agreed without needing to discuss it.
- Session ended proactively by Rohit citing rising context, not because the work hit a natural stopping point — expect to pick up mid-thought specifically on Phase 8; Phases 6 and 7 are fully spec'd and ready to implement whenever, independent of Phase 8's remaining discussion.
