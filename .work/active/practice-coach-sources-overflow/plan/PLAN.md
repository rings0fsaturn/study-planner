# Plan - practice-coach-sources-overflow

_Spec: `specs/issues/practice-coach-sources-overflow.md` · Task: `active/practice-coach-sources-overflow/` · Status: active · Updated: 2026-10-07._

## Objective

Make the practice coach sources disclosure scrollable and collapsible without changing hint, gate, or run contracts.
Each sentence in this plan is on its own physical line per repo convention.

## Skills invoked per phase

| Phase | Skills invoked | Why |
|---|---|---|
| Phase 0 reproduce and measure | `playwright-cli` | Open the run, drive `I'm stuck`, measure overflow rects, capture screenshots. |
| Phase 1 failing assertions | `tdd`, `ponytail` | `tdd` runs the red-green vertical slice; `ponytail` keeps assertions behavioral, not implementation-coupled. |
| Review R1 (after Phase 1) | `open-code-review-delegate`, `thermo-nuclear-code-quality-review` via fanned-out agents | Mandatory gate after every coding phase, see Fan-out protocol. |
| Phase 2 minimal fix | `impeccable` (Operate refinement), `tdd`, `ponytail` | `impeccable` keeps the Marginalia card identity; `tdd` turns red to green; `ponytail` enforces native `<details>` plus CSS only. |
| Review R2 (after Phase 2) | Same fan-out as R1 | Mandatory gate after every coding phase. |
| Phase 3 verify | `playwright-cli`, repo suite (`vitest`, `typecheck`, `lint`, smallest live spec) | Browser proof at 1280 and 375 plus regression sweep. |
| Review R3 final | Same fan-out as R1 | Pre-wrap gate before SESSION END and WRAP. |
| Session lifecycle | `work-journal-orchestrator` | Owns OPEN, START, SESSION END, WRAP transitions for this task. |

Rules honored throughout: 10 (managed runtime), 11 (scoped role locators), 12 (no `/study` in app routes), 15 (playwright-cli flags), 16 (live-spec hygiene, shared-account cleanup), 17 (request-id join if live streams are used), 42 (generation and practice-run contracts), 53 (restart runtime after edits on `/mnt/d`).

## Phase 0 - Reproduce and measure (no code)

Do: run `./full-app status full` and verify service, app, sidecar, and Piston health.
Do: sign in with the dev account and start a practice run on content rich enough for multi-quote citations.
Do: click `I'm stuck`, then `Yes, help me`, wait for `.coach-body` to be non-empty, then open the `N source(s)` summary.
Do: record `getBoundingClientRect` for `.coach` and `.coach-citations ul` versus `window.innerHeight`, plus `scrollHeight` versus `clientHeight`, at 1280 and 375.
Do: save screenshots to `plan/evidence/` (card open, card scrolled, card collapsed).
Exit gate: evidence confirms the card exceeds the viewport or the list has no scroll path, with measurements written to `plan/evidence/measurements.md`.
No code review: no code changed.

## Phase 1 - Failing UI assertions (coding: tests only)

Do: extend `apps/app/src/guide/PracticeCoach.test.tsx` with one red test rendering five long quotes, asserting the citations region is capped and scrollable and the summary toggles closed again.
Do: add one Playwright regression check modeled on `e2e/practice-guide-live.spec.ts` asserting the open card stays within the viewport and the list scrolls.
Do: keep locators role-based (`region` named `Practice coach`, summary named `N sources`); no new test IDs unless a user-facing locator cannot express the target.
Skills: `tdd` (one failing slice, behavior through the public component interface), `ponytail` (no implementation-coupled assertions).
Exit gate: new assertions fail for the right reason (uncapped growth, no scroll, unreachable toggle), recorded in SCRATCHPAD.
Review: fan out R1 immediately; do not start Phase 2 until R1 is APPROVE.

## Phase 2 - Minimal fix (coding: CSS, markup only if forced)

Do: cap the card with `max-height: min(70vh, 560px)`, `display: flex`, `flex-direction: column`, `overflow: hidden` so header and actions stay reachable.
Do: make `.coach-body` the primary scroll region (`overflow-y: auto`, `min-height: 0`).
Do: cap `.coach-citations ul` independently (`max-height` around 160 to 200px, `overflow-y: auto`); keep native `<details>` and `<summary>`.
Do: guard the phone layout (`max-width: 640px`) with `max-height: calc(100dvh - 120px)` so the card clears the bottom tab bar, keeping 44px targets and the focus-visible outline.
Do: touch `PracticeCoach.tsx` only if flex containment needs a wrapper; change no stream, tier, gate, or pointer logic.
Skills: `impeccable` Operate refinement (identity preserved), `tdd` (red to green with minimal diff), `ponytail` full (native platform feature before any component).
Exit gate: Phase 1 assertions green, existing `PracticeCoach` suite green, no contract drift.
Review: fan out R2 immediately; do not start Phase 3 until R2 is APPROVE.

## Fan-out review protocol (R1, R2, R3)

After every coding phase, launch three review agents in parallel with the `Task` tool in a single turn.
Agent A: `subagent_type: code-reviewer`, instructed to apply the `open-code-review-delegate` skill (Standards axis against repo rules plus Spec axis against `specs/issues/practice-coach-sources-overflow.md`).
Agent B: `subagent_type: code-reviewer`, instructed to apply the `thermo-nuclear-code-quality-review` lens (abstraction quality, file size, spaghetti-condition growth; this fix should add no abstraction).
Agent C: `subagent_type: code-reviewer`, instructed to review as `impeccable` Operate plus accessibility (focus reachability, keyboard toggle, 375px overflow, touch targets).
Merge rule: collect all three verdicts into `plan/REVIEWS.md` (R1, R2, R3 sections with per-agent verdict and findings).
Every correctness finding is fixed inside the phase that produced it, then that phase's tests re-run.
A gate passes only when all three agents return APPROVE (or APPROVE with explicitly waived minors).
Never carry review findings forward into the next phase.

## Phase 3 - Verify (no new code)

Do: restart the managed runtime after the CSS edit (rule 53 stale-watch), then re-run the Phase 0 browser pass at 1280 and 375 with sources open, scrolled, and collapsed.
Do: run `PracticeCoach` unit tests, then `pnpm typecheck` and `pnpm lint` for touched paths, then the smallest relevant live spec before any wider suite.
Do: confirm zero console errors, redaction holds (no reference solutions rendered), and shared-account materials are cleaned up (rule 16).
Do: write results to `plan/VERIFICATION.md` with request IDs if live streams were exercised (rule 17).
Exit gate: AC1 through AC5 ticked with linked evidence.
Review: fan out R3; on APPROVE run SESSION END (distill to `state.md`, reset scratchpad, refresh STATUS) and WRAP (promote reusable research, archive folder, flip STATUS to Done).

## Verification matrix

| Check | Where | Pass bar |
|---|---|---|
| Disclosure scrolls and collapses | `PracticeCoach.test.tsx` + browser | Capped list, internal scroll, toggle works by pointer and keyboard. |
| Card stays in viewport | Playwright 1280 + 375 | Card rect within viewport with sources open. |
| Actions reachable | Playwright 1280 + 375 | Dismiss, `Got it`, tier buttons clickable with sources open. |
| No contract drift | Unit + live spec | Stream, ladder, reveal gate, pointers unchanged. |
| Clean tree | `typecheck`, `lint`, suite | Green; evidence under `plan/evidence/`. |

## Risks and pitfalls

- The reporter's exact runId lives in their browser's per-user Dexie DB and is unreachable from a fresh CLI session; reproduce with a fresh run on the shared dev account instead.
- Vite on `/mnt/d` may serve stale CSS; restart the managed runtime after edits before browser proof.
- Long-quote volume varies by provider response; the deterministic fallback is injecting five long citations and measuring.
- Do not invent a second collapsible component; the native `<details>` is the contracted behavior under test.
