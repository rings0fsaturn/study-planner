# Assessment library and Practice hub - implementation plan

_Written 2026-09-28. Status: not started._
_Ticket: [#81](https://github.com/rings0fsaturn/study-planner/issues/81) (OPEN, `ready-for-agent`) · Prototype: [#80](https://github.com/rings0fsaturn/study-planner/issues/80) (agreed 2026-09-28, variant B) · Locked IA: [#5](https://github.com/rings0fsaturn/study-planner/issues/5) · Wayfinder map: [#4](https://github.com/rings0fsaturn/study-planner/issues/4) · Task: `.work/active/assessment-library-practice-hub/`_

## How to use this plan

You are an AI agent asked to implement one or more phases below.
Read this whole preamble, the Decisions log, and the Skill contract before touching code.
Each phase is a vertical slice that a fresh context window can implement and verify on its own.
Work phases in order.
Phase 1 (data layer) blocks every UI phase; Phase 6 (live verification) must not start before Phases 1-5 are green; Phase 7 must not start before Phase 6 passes.
Update each phase's status marker as you go.

Repository rules to read before starting, and again whenever a phase touches their trigger: rule 10 (runtime and E2E), rule 11 (Playwright selectors), rule 12 (router basename), rule 15 (playwright-cli), rule 16 (live E2E authoring), rule 17 (logging and tracing), rule 30 (eventstore boundaries), rule 32 (Dexie testing), rule 33 (sync boundaries), rule 42 (assessment and practice generation), rule 53 (WSL dev runtime).
Run the smallest relevant check first, then broaden verification in proportion to the change.

Do not commit unless the human explicitly asks.
When asked, stage only the paths this plan names: the worktree is dirty with other tasks (see "Worktree state to respect").
Never run `git add -A`.
Never print, copy, or commit credentials from `.work/specs/test-login-cred.txt` or any `.env` file.

## Skill contract (enforced in every phase)

The human requires these skills and they are not optional.

| Kind | Skill | When | How it is enforced |
|---|---|---|---|
| Coding | `tdd` | Every phase that writes code | Write the failing test first, then red -> green -> refactor. A phase's steps below list the test file before the implementation file. Do not implement before the test is red. |
| Coding | `ponytail` | Every phase that writes code | Climb the ladder: reuse `practiceRunModel`, `buildReviewModel`, `mergeEnvelopes`, `attemptFlow`, the materials clients, `.materials-grid`, `.materials-page`, `.materials-head`, `.tag` vocabulary, and the shipped routes. No new dependency, no new abstraction with one caller, no config for a constant, no speculative fields. |
| UI/UX | `impeccable` | Every phase that writes markup or CSS (Phases 2-5) | Load it before the first edit. Keep the Marginalia world (Operate mode): mono-caps eyebrow, Fraunces H1, paper surfaces, tokens only, one Fired Clay accent per screen, no em dashes. Verify in a real browser at 1280 and 375 with `playwright-cli` (rule 15) before calling the phase done. |
| Code review | `open-code-review-delegate` via subagents | After every phase that changes code | See "Review gate" below. |
| Code review | `thermo-nuclear-code-quality-review` via subagents | After every phase that changes code | Same gate, second reviewer. |
| Task tracking | `work-journal-orchestrator` | Phase 0 and every phase end | Open the task, append to `SCRATCHPAD.md` after each phase, run the wrap in Phase 7. |

### Review gate (run after every phase that changes code)

1. Dispatch a `code-reviewer` subagent whose prompt tells it to load the `open-code-review-delegate` skill, run its deterministic engineering step for the exact phase file set (OCR resolves the files plus the project rules), and then perform the review itself on that scope.
   Ask for findings ranked by severity with `file:line`.
2. Dispatch a second subagent for the `thermo-nuclear-code-quality-review` skill on the same diff.
3. Fix every correctness, security, accessibility, or maintainability finding.
   Re-run the phase's focused tests plus `pnpm --filter app test`, `pnpm typecheck`, and `pnpm lint` if the fix is non-trivial.
4. Record both verdicts and anything deferred in `.work/active/assessment-library-practice-hub/SCRATCHPAD.md`.

If the OCR tooling is unavailable, the subagents review the explicit file list the phase names.
Do not skip the gate.

## TL;DR

Two production hubs arrive at `/assessments` and `/practice`, nested under the existing Materials tab with a `Library | Assessments N | Practice M` sub-nav, rendered as the agreed variant B card grid.
They read only local-first data: `AssessmentCreated` and `PracticeRunStarted`/`PracticeRunFinished` pointers from the event log, hydrated through the existing owner-scoped `GET /v1/assessments/{id}` plus the existing `assessmentAttempts` / `assessmentContentCache` Dexie tables.
Material detail gains an assessments plus practice-runs backlink section and loses its misleading placeholder copy.
Every honest state from the prototype ships: first-run empty, generating with retry, terminal failed with the server reason verbatim, partial runs, offline cached versus uncached, loading, and error with retry.
One new pure model module plus one shared data hook carry all derivation; the shipped taking, review, and run screens are untouched except for links into them.
The throwaway prototype (`apps/app/src/prototype/assessment-library/`) and its dev route are deleted in the same diff.
Exit runs through the wayfinder protocol on #81 (AC7).

## Context and evidence (verified in the live checkout 2026-09-28)

### The user-visible gap

- Direct generation appends the durable pointer `AssessmentCreated {assessmentId, materialIds}` and navigates to `/assessments/:assessmentId` (`apps/app/src/pages/assessments/AssessmentConfig.tsx:212`). Nothing reads `AssessmentCreated` today, so leaving the page loses the only path back.
- Practice generation appends `PracticeRunStarted {runId, materialIds, mode, assessmentIds, count, families}` and navigates to `/materials/:materialId/practice/:runId` (`apps/app/src/pages/materials/PracticeThis.tsx:254`). No surface lists runs, so an unfinished run cannot be resumed and a completed run summary cannot be reopened.
- Material detail has no assessment backlink; its "Used by" empty copy still says "Not attached to any roadmap yet. Assessments will appear here once created." (`apps/app/src/pages/materials/MaterialDetail.tsx:405-407`).
- Neither `/assessments` nor `/practice` exists as a route and neither has a nav entry (`apps/app/src/App.tsx:206-237`, `apps/app/src/components/NavBar.tsx:62-69`).

### What already exists to reuse (do not rebuild)

| Concern | Existing code |
|---|---|
| Assessment pointer shape | `AssessmentCreatedPayload` (`apps/app/src/sync/types.ts:91`); practice pointer shapes (`:108`, `:123`) |
| Practice run derivation | `findPracticeRun` (`apps/app/src/pages/practice/practiceRunModel.ts:118`), `buildPracticeRunModel` (`:177`), `mergeEnvelopes` (`:69`), `problemStatus` (`:98`) |
| Review/score derivation | `buildReviewModel` (`apps/app/src/pages/assessments/review/reviewModel.ts:128`); the round score pattern at `AssessmentDetail.tsx:33-60` |
| Attempt + cache storage | `assessmentAttempts` and `assessmentContentCache` (`apps/app/src/events/EventStoreProvider.tsx:62-63`, v7 unchanged), `createAttemptFlow` with `refreshAttempts`, `listLocalAttempts`, `cacheAssessment`, `cachedAssessment` (`apps/app/src/assessments/attemptFlow.ts:187,437,482,486,493`) |
| Clients | `AssessmentClientLike.getAssessment` / `regenerateAssessment` / `transport` (`apps/app/src/assessments/assessmentClient.ts:26-46`); `MaterialClientLike.getMaterial` / `listMaterials` (`apps/app/src/materials/materialClient.ts`) |
| Visual vocabulary | `.materials-page` (max-width 1120px), `.materials-head`, `.materials-grid` (`repeat(auto-fill, minmax(270px, 1fr))`) at `apps/app/src/materials/materials.css:3,15,85`; `.tag`, `.tag-moss`, `.tag-rust`, `.tag-terracotta`; `Tag` component (`apps/app/src/components/Tag.tsx`) |
| Event/reactivity pattern | `useLiveQuery(() => eventStore.getAll(), [eventStore])` (`apps/app/src/materials/useMaterialUsage.ts:9`), attemptFlow via `eventStore.db` (`apps/app/src/pages/practice/PracticeRun.tsx:93-97`) |
| Test doubles | `FakeAssessmentClient` (`apps/app/src/assessments/testing/fakeAssessmentClient.ts`), `FakeMaterialClient` (`apps/app/src/materials/testing/fakeMaterialClient.ts`), `fake-indexeddb/auto` in `apps/app/src/test/setup.ts` |
| E2E models | `e2e/practice-run-live.spec.ts` (sign-in, cleanup window, `REDACTION_RE`, request-id join), `e2e/material-library-live.spec.ts`, `e2e/fixtures.ts` (`watchErrors`, `grepIntelligenceLog`) |

### Spec versus reality: the content cache has no production writer

`cacheAssessment` / `cachedAssessment` exist and are unit-tested (`apps/app/src/assessments/attemptFlow.test.ts:352`) but no production code calls them.
The `assessmentContentCache` table is therefore empty on every real device today.
This plan makes the hub the first production writer (it caches every envelope it hydrates), which is what turns AC5's offline promise into a real state.
Wiring the taking/review/run screens to cache too is deliberately out of scope (issue "Not in scope": no changes to shipped screens beyond linking) and is recorded as a follow-up in "Open questions".

### Worktree state to respect

The worktree is dirty with other tasks and none of it belongs to this plan:

- `repair-validation-resilience` is code-complete but uncommitted: `scripts/full_app.py`, `scripts/tests/test_full_app.py`, `services/intelligence/app/generation/*`, `services/intelligence/tests/test_generation_*`, rule files, and its `.work/active/` plus `.work/plans/` records.
- Roughly 900 deletions under `college/mydeliverables/`, plus untracked `apps/app/src/prototype/assessment-library/`, `e2e/jev-*.spec.ts`, `e2e/pdf/*.pdf`, `graphify-out/`, `.claude/`, `e2e/assessment-library-prototype` route edits in `apps/app/src/App.tsx`.
- The prototype route is an uncommitted modification of `apps/app/src/App.tsx` (the import at line 42 and the route at lines 190-195); Phase 7 reverts exactly those lines and deletes the untracked prototype directory.

Never `git add -A`; stage only the paths this plan names.

## Data contract (no schema change, no server change)

- **Assessments hub** reads `AssessmentCreated` pointers from the local event log and hydrates each row with the existing owner-scoped `GET /v1/assessments/{id}` (status `generating | ready | partial | failed`, `recipe`, `warnings`, `created_at`, `questions`).
  No list endpoint is added; hydration is N reads with per-row loading/error, the choice #80 left open and #81 decided.
- **Practice hub** reads `PracticeRunStarted` / `PracticeRunFinished` pointers and derives state with the real `buildPracticeRunModel` + `findPracticeRun`.
  Practice problems write no `AssessmentCreated` (`PracticeThis.tsx:251`), so run-pointer reads are the only source for those rows.
- **Scores and progress** come from the per-user Dexie `assessmentAttempts` rows through `buildReviewModel`, plus `refreshAttempts` for fresh-device restore; `assessmentContentCache` is the offline fallback.
- **Material titles** come from one `listMaterials({ includeArchived: true })` call per hydration pass, not N `getMaterial` calls.
- **Hidden content** never reaches the browser beyond the existing redacted contract; no new fetch path, no new event kind, no Dexie version bump, no logging changes (rule 17 untouched: no new failure path is introduced outside the existing typed clients).

## Decisions log

### D-01: Events plus N reads, no server list endpoint

**Status:** locked by #81 (recorded as the build-time choice #80 left open).

**Decision:** the hub derives its row set from local events and hydrates each row with `GET /v1/assessments/{id}`.

**Rationale:** local-first honesty; a list endpoint is a server change the ticket forbids.

**Reversibility:** easy later; a list endpoint would replace the hydration loop and nothing else.

### D-02: Nested in Materials, with a sub-nav and an extended NavBar prefix

**Status:** locked by #81 HITL decision 1.

**Decision:** routes `/assessments` and `/practice` (basename-safe, no `/study` in code); a `Library | Assessments N | Practice M` sub-nav renders at the top of the three materials list surfaces; the Materials NavBar tab stays active across `/materials`, `/assessments`, `/practice`.

**Reversibility:** easy (one NavBar entry plus one component).

### D-03: Variant B card grid, reusing `.materials-grid`

**Status:** locked by #81 HITL decision 2 (dense variant A declined).

**Decision:** both hubs render cards in `repeat(auto-fill, minmax(270px, 1fr))` (the existing `.materials-grid` class), collapsing to one column at 375.

**Reversibility:** easy; it is CSS.

### D-04: One shared hydration hook, bounded concurrency 4, poll only while generating or in flight

**Status:** chosen here.

**Decision:** one `useLibraryRows(options?: { materialId?: string })` hook serves both hubs and the material backlink.
It hydrates the union of unique assessment ids at most 4 in flight, reuses `mergeEnvelopes` for polling, caches every successfully read envelope through `flow.cacheAssessment`, refreshes attempts once per hydration, and polls `getAssessment` at 3 s only while some loaded envelope is `generating` or some local attempt row is still queued/submitted.

**Rationale:** one place owns the network/cache/offline policy; every page stays a renderer; the poll scopes match the shipped `PracticeRun` behavior (`apps/app/src/pages/practice/PracticeRun.tsx:104-136,283-290`).

**Alternatives considered:** per-page hooks (duplicate policy, drift risk); polling all rows forever (wasteful, unbounded on a shared account).

**Reversibility:** easy; the hook is the only caller of the clients.

### D-05: Row state semantics are explicit and unit-tested

**Status:** chosen here to make the locked honest states testable.

Assessment row state, in priority order:

| Condition | Tag | Right side | Action |
|---|---|---|---|
| Envelope not readable and not cached | `Unavailable offline` (dim) | no score | none (card still links; the detail route owns its own error state) |
| Envelope `status === 'generating'` | `Generating` (terracotta) | `N of M ready` with pulsing dots (static under `prefers-reduced-motion`) | `Retry generation` (secondary) |
| Envelope `status === 'failed'` | `Failed` (rust) | server `warning.code` plus `warning.message` verbatim | `Start a new run` (secondary) |
| `status === 'ready'` or `'partial'`, no graded attempt | `Ready` (moss) | `Not started` | none |
| graded attempt(s) present | `Ready` (moss) | score, `toFixed(2)`, Fraunces tabular figures | none |

Practice run row state, in priority order:

| Condition | Tag | Note/right side | Action |
|---|---|---|---|
| `finished.outcome === 'completed'` | `Completed` (moss) | `N of M graded` | `Open summary` (secondary; same route as the card) |
| `finished.outcome === 'abandoned'` | `Abandoned` (dim) | `N of M graded`, "kept as history" | none (card opens the run) |
| unfinished and any ungraded problem's assessment is terminal `failed` | `Failed` (rust) | the failed problem's reason verbatim, plus `N of M graded` | `Start a new run` (secondary) |
| unfinished and any ungraded problem's assessment is `generating`, or is unloaded while the row is reachable | `Generating` (terracotta) | `N of M ready`, pulsing dots | `Resume` (topmost only is `btn-accent`) |
| unfinished, assessments readable, nothing generating | `In progress` (terracotta) | `N of M graded`, missing-count note when `missingCount > 0` | `Resume` (accent for the topmost row, secondary below) |
| unfinished and no assessment is readable and none is cached | `Unavailable offline` (dim) | "Progress unavailable offline", never a made-up count | `Resume` (the pointer is local; the run screen owns its own offline state) |

Sections: Resume first (`in-progress` + `generating`, newest first), then History (`completed` + `abandoned` + `failed`, newest first).
A run card's route is `/materials/{started.materialIds[0]}/practice/{started.runId}`.
Assessment ordering: `generating` first (newest first), then the rest newest first.
A `failed` assessment is terminal by contract (rule 42): never offer retry on it; start fresh generation instead.

**Reversibility:** medium; changing semantics later means updating the tests, which is the point.

### D-06: Link into shipped surfaces, never re-implement them

**Status:** locked by #81.

**Decision:** ready assessment rows and completed run rows link to the shipped `/assessments/:assessmentId` and `/materials/:materialId/practice/:runId` routes; no `/practice/:runId` convergence now.

**Reversibility:** easy.

### D-07: Score = mean of latest graded attempts via `buildReviewModel`

**Status:** chosen here.

**Decision:** for one assessment, build `buildReviewModel(assessment, rows)`, take each group's `latest.grade.score` where present, and average them; `gradedCount` = groups with a grade; `totalCount` = `assessment.questions.length` (`recipe.questionCount` while generating).
No new score semantics are invented.

**Reversibility:** easy.

### D-08: The hub is the first production writer of the redacted cache; offline titles have a known ceiling

**Status:** chosen here, records the spec-reality note above.

**Decision:** the hub caches every envelope it hydrates; offline it falls back to `cachedAssessment` plus local attempts.
Material titles come from the network list call, so an offline hub row whose title was never hydrated shows the neutral fallback "Material unavailable" while still showing its honest state, never a crash.
Upgrading titles (cache the map per user, or widen the pointer payload additively) is a recorded follow-up, not this ticket.

**Reversibility:** easy.

### D-09: The prototype is removed in this diff

**Status:** locked by #81.

**Decision:** delete `apps/app/src/prototype/assessment-library/` and revert the prototype import plus dev route in `App.tsx` in Phase 7; verify the production build contains no prototype symbol.

**Reversibility:** n/a.

### D-10: No schema, no event, no server, no logging change

**Status:** locked by #81 "Not in scope".

**Decision:** the only writers are the existing event appends and the existing attempt flow; rule 17 is satisfied by not adding any new failure path or network call outside the existing typed clients.

## Architecture overview

```
events (local log, synced)                        Dexie (per user, not synced)
  AssessmentCreated {assessmentId, materialIds}     assessmentAttempts
  PracticeRunStarted {runId, ...}                   assessmentContentCache
  PracticeRunFinished {runId, outcome}                    |
          |                                               |
          v                                               v
  apps/app/src/library/libraryModel.ts   <-- pure: pointer lists + row view models
          |
          v
  apps/app/src/library/useLibraryRows.ts <-- hydration, cache fallback, polling, retry
          |
          +--> MaterialsSubnav (counts only, no hydration)
          +--> AssessmentLibrary page  (cards, actions, states)
          +--> PracticeHub page        (Resume + History, cards, actions)
          +--> MaterialLibrarySection  (compact backlink on MaterialDetail)
```

The pure model owns every status, score, ordering, and section decision.
The hook owns every I/O decision.
The pages and the backlink section only render rows and wire actions.

## Files-touched index

New files:

| Path | Purpose |
|---|---|
| `apps/app/src/library/libraryModel.ts` | Pure derivations: pointer lists, assessment rows, practice run rows, ordering, section split |
| `apps/app/src/library/libraryModel.test.ts` | Unit tests for every state mapping and ordering rule (D-05) |
| `apps/app/src/library/useLibraryRows.ts` | `useLibraryCounts` + `useLibraryRows`; hydration, cache fallback, poll, retry (D-04) |
| `apps/app/src/library/useLibraryRows.test.tsx` | Hook tests with `EventStoreProvider`, `fake-indexeddb`, `FakeAssessmentClient`, `FakeMaterialClient` |
| `apps/app/src/library/LibraryCards.tsx` | Shared `StateTag`, `GeneratingDots`, `AssessmentCard`, `PracticeRunCard` |
| `apps/app/src/library/library.css` | Card, sub-nav, skeleton, and backlink styles (Marginalia tokens) |
| `apps/app/src/library/MaterialLibrarySection.tsx` | Compact backlink list for one material (assessments + practice runs) |
| `apps/app/src/materials/MaterialsSubnav.tsx` | `Library | Assessments N | Practice M` links with counts |
| `apps/app/src/materials/MaterialsSubnav.test.tsx` | Sub-nav unit tests |
| `apps/app/src/pages/assessments/AssessmentLibrary.tsx` | `/assessments` hub page |
| `apps/app/src/pages/assessments/AssessmentLibrary.test.tsx` | Page unit tests (all honest states, actions, keyboard) |
| `apps/app/src/pages/practice/PracticeHub.tsx` | `/practice` hub page |
| `apps/app/src/pages/practice/PracticeHub.test.tsx` | Page unit tests (resume, history, run states) |
| `apps/app/src/components/NavBar.test.tsx` | Materials-tab prefix tests |
| `e2e/assessment-library-live.spec.ts` | Live E2E at 1280 + 375 with cleanup and request-id join |

Modified files:

| Path | Change |
|---|---|
| `apps/app/src/App.tsx` | Add `/assessments` and `/practice` routes; Phase 7 removes the prototype import and dev route |
| `apps/app/src/components/NavBar.tsx` | Materials entry matches `['/materials', '/assessments', '/practice']` |
| `apps/app/src/pages/materials/MaterialDetail.tsx` | Add the backlink section; retire the placeholder sentence |
| `apps/app/src/pages/materials/MaterialDetail.test.tsx` | New section assertions; placeholder-copy assertion |
| `.work/STATUS.md`, `.work/active/assessment-library-practice-hub/*`, `.work/active/phase2-wayfinder/*` | Task and wayfinder records |

Deleted files (Phase 7):

| Path | Why |
|---|---|
| `apps/app/src/prototype/assessment-library/AssessmentLibraryPrototype.tsx` | Throwaway prototype, D-09 |
| `apps/app/src/prototype/assessment-library/assessment-library-fixtures.ts` | Same |
| `apps/app/src/prototype/assessment-library/assessment-library.css` | Same |

## Phases

### Phase 0: Open the task and lock the guardrails

**Status:** ☐ Not started
**Skills:** `work-journal-orchestrator`; read the rules named in the preamble.

Steps:

1. `git status --short` and record the unrelated dirty paths above; confirm nothing will be swept into this task.
2. Run `./full-app status full` (rule 10) and note which dependencies are up; do not start or stop anything another task may own.
3. Open the task with the work-journal-orchestrator: create `.work/active/assessment-library-practice-hub/` with `state.md`, a fresh `SCRATCHPAD.md`, and `plan/` (link this plan and a `VERIFICATION.md` seeded with the AC matrix from #81).
4. Add the STATUS.md row under Active.
5. Baseline the tree before any edit: `pnpm --filter app test`, `pnpm typecheck`, `pnpm lint`; record exact counts and any pre-existing failures in `SCRATCHPAD.md`.
6. Confirm the prototype still runs (or at least that its files are untouched) so parity checks in Phases 2-4 can compare against it before deletion.

Exit criteria: task folder exists, baseline recorded, no unrelated file touched.

### Phase 1: Library data layer (pure model plus hooks)

**Status:** ✅ Done 2026-09-28 (34/34 focused tests; full suite +4 over baseline with same 2 pre-existing flakes; OCR + thermo re-PASS after fixing every BLOCK/MAJOR/MINOR code finding).
**Skills:** `tdd`, `ponytail`. No UI in this phase.
**Depends on:** Phase 0.

Goal: one pure module and one hook that turn the event log into fully hydrated rows for both hubs and the material backlink.

Files:

- `apps/app/src/library/libraryModel.ts` (new)
- `apps/app/src/library/libraryModel.test.ts` (new)
- `apps/app/src/library/useLibraryRows.ts` (new)
- `apps/app/src/library/useLibraryRows.test.tsx` (new)

TDD sequence:

1. Write `libraryModel.test.ts` first (red) covering:
   - `listAssessmentPointers(events)`: latest `AssessmentCreated` wins per `assessmentId` (event `createdAt` tie-break by `id`), newest first, optional `materialId` filter, empty log.
   - `listPracticeRunEntries(events)`: one entry per `runId` built on `findPracticeRun`, newest `startedAt` first, finished attached, a finished event with no started event is ignored.
   - `buildAssessmentRow`: the full D-05 assessment table; warning reason is `${code}: ${message}` verbatim; score is the mean of latest graded attempts; total is `recipe.questionCount` while generating and `questions.length` when ready; family from `recipe.formats[0]` then `questions[0].format` then null.
   - `buildPracticeRunRow`: the full D-05 run table, including the legacy pointer without `families` (falls back to `mode`, per `plannedFamily`), `missingCount` note, and the unavailable-offline case.
   - `orderAssessmentRows`: generating first, then newest first.
   - `splitRunRows`: resume/history partition and ordering.
2. Implement `libraryModel.ts` until green.
   Reuse `findPracticeRun` and `buildPracticeRunModel` from `apps/app/src/pages/practice/practiceRunModel.ts`; reuse `buildReviewModel` and `problemStatus`; do not copy their logic.
3. Write `useLibraryRows.test.tsx` (red) with `EventStoreProvider userId="library-user"` (delete `StudyTracker_library-user` in `beforeEach`/`afterEach`, rule 32):
   - events appended through a real `createEventStore` show up as rows after hydration;
   - `getAssessment` resolves: rows are `ready`, envelopes are written to `assessmentContentCache`, attempts are merged through `refreshAttempts`;
   - `getAssessment` rejects and the cache has the envelope: row reads from cache;
   - `getAssessment` rejects and no cache: row is `Unavailable offline` and the page-level error count rises;
   - `reload()` re-attempts only failed ids;
   - generating envelopes poll on a fake timer and become ready;
   - `materialId` option filters both pointer lists;
   - titles come from one `listMaterials` call; a missing material falls back to "Material unavailable".
4. Implement `useLibraryRows.ts` until green.
   Implementation notes: `eventStore` and db come from `useEventStoreContext` (PracticeRun precedent); build the attempt flow once with `createAttemptFlow({ db, eventStore, transport: assessments.transport })`; hydrate with at most 4 in flight; cache envelopes through `flow.cacheAssessment`; reuse `mergeEnvelopes` for polls; clear every interval and guard every effect with a cancelled flag.

Verify:

```bash
pnpm --filter app exec vitest run src/library
pnpm --filter app test
pnpm typecheck
pnpm lint
```

Exit criteria: all focused tests green; full suite equals the Phase 0 baseline plus the new tests; review gate passed.

Review gate: OCR delegate subagent plus thermo-nuclear subagent on `apps/app/src/library/`.

### Phase 2: Shell plus the Assessments hub

**Status:** ✅ Done 2026-09-28 (focused 78/78 with refixes; full suite 1057 + 2 pre-existing flakes; OCR PASS + refix re-PASS; thermo re-PASS; browser-verified 1280/375 zero console errors, evidence in `.work/active/assessment-library-practice-hub/plan/evidence/phase2-*`).
**Skills:** `tdd`, `ponytail`, `impeccable` (load before any markup or CSS).
**Depends on:** Phase 1.

Goal: `/assessments` renders the full assessment library in the agreed card grid, with the Materials sub-nav, all honest states, and working actions.

Files:

- `apps/app/src/materials/MaterialsSubnav.test.tsx` (new)
- `apps/app/src/materials/MaterialsSubnav.tsx` (new)
- `apps/app/src/components/NavBar.test.tsx` (new)
- `apps/app/src/components/NavBar.tsx` (modified)
- `apps/app/src/library/LibraryCards.tsx` (new)
- `apps/app/src/library/library.css` (new)
- `apps/app/src/pages/assessments/AssessmentLibrary.test.tsx` (new)
- `apps/app/src/pages/assessments/AssessmentLibrary.tsx` (new)
- `apps/app/src/App.tsx` (modified)

TDD sequence:

1. Write `MaterialsSubnav.test.tsx` (red): three links with the right `to` values (`/materials`, `/assessments`, `/practice`), live counts from the event log, `aria-current="page"` on the active one, accessible nav label.
   Then implement `MaterialsSubnav.tsx` using `useLibraryCounts()` and `NavLink`s.
2. Write `NavBar.test.tsx` (red): the Materials tab is active at `/materials`, `/assessments`, `/assessments/:id`, and `/practice`, and not active at `/home`.
   Then change the Materials entry to a `prefixes` array and update `isActive` (keep every other tab single-prefix).
3. Write `AssessmentLibrary.test.tsx` (red) against real events plus `FakeAssessmentClient` and `FakeMaterialClient` (the AttemptTaker test mount pattern):
   - page head (mono-caps eyebrow, H1) and sub-nav render;
   - cards render title, mono meta (family, date, scope), tag, and score in the D-05 mapping;
   - generating row shows pulsing dots, `N of M ready`, and `Retry generation` calls `regenerateAssessment`;
   - failed row shows the warning code plus message verbatim and `Start a new run` links to `/materials/:primary/assessments/new`;
   - unreadable uncached row shows `Unavailable offline`, no action, and the card stays focusable;
   - empty log shows the first-run empty state with an accent CTA to `/materials`;
   - a failed hydration shows the error banner with a working Retry;
   - the whole card is keyboard-operable (Enter on the title link) and opens `/assessments/:id`.
4. Implement `LibraryCards.tsx` (shared card shell, `StateTag`, `GeneratingDots` honouring `prefers-reduced-motion`) and `AssessmentLibrary.tsx`.
   Card shape per the issue: serif title leading, mono meta line, tag, score or progress; at most one visible action per card; the whole card is the link.
   Use a stretched title link (relative card, link `::after { inset: 0 }`) with action buttons layered above, so no interactive element nests inside another (rule 11 vocabulary: roles and names first).
   Reuse `.materials-page`, `.materials-head`, `.materials-grid`, `.materials-empty`, `.banner attention`, and the `.tag` classes; put only genuinely new rules in `library.css`.
5. Add both routes in `App.tsx` inside the existing `ProtectedRoute > RequireOnboarding > AppShell` block, without the `/study` prefix (rule 12).
6. impeccable pass: page head rhythm, one accent (the empty-state CTA, or nothing when rows exist), 44 px targets, `:focus-visible` 2 px Warm Ink ring, static dots under reduced motion.
   Verify in the real browser at 1280 and 375 with `playwright-cli` against the managed runtime; fix anything that looks off, including unrelated pixel damage you introduced.

Verify:

```bash
pnpm --filter app exec vitest run src/library src/pages/assessments/AssessmentLibrary.test.tsx
pnpm --filter app test
pnpm typecheck
pnpm lint
```

Exit criteria: AC1's assessments half, AC2 (assessment rows and open path), AC5 for the assessments hub, AC6 polished at both widths; review gate passed.

Review gate: OCR delegate subagent plus thermo-nuclear subagent on the Phase 2 file list.

### Phase 3: Practice hub (Resume plus History)

**Status:** ✅ Done 2026-09-28 (focused 10/10 PracticeHub + 18/18 both hubs with refixes; full suite 1069 passed + 2 pre-existing TZ flakes; tsc + eslint clean; OCR PASS + refix re-PASS; thermo PASS + refix re-PASS; browser-verified 1280/375 zero console errors, no overflow, evidence in `.work/active/assessment-library-practice-hub/plan/evidence/phase3-*`).
**Skills:** `tdd`, `ponytail`, `impeccable`.
**Depends on:** Phase 1; its sub-nav reuses Phase 2's component.

Goal: `/practice` lists resumable runs first and finished history second, with honest per-problem progress and the shipped resume/summary routes.

Files:

- `apps/app/src/pages/practice/PracticeHub.test.tsx` (new)
- `apps/app/src/pages/practice/PracticeHub.tsx` (new)
- `apps/app/src/library/LibraryCards.tsx` (extend with `PracticeRunCard`)
- `apps/app/src/App.tsx` (route for `/practice`)

TDD sequence:

1. Write `PracticeHub.test.tsx` (red):
   - Resume section renders in-progress plus generating runs, newest first, with the topmost Resume button carrying `btn-accent` and the rest `btn-secondary`;
   - History renders completed, abandoned, and failed runs, newest first;
   - a completed run shows `Open summary` and links to `/materials/:primary/practice/:runId`;
   - an abandoned run shows its history note and has no action button;
   - a run with a terminally failed problem shows the reason verbatim and `Start a new run` to `/materials/:primary/practice`;
   - a still-generating run shows `N of M ready` with dots and no invented grade;
   - a partial run (`missingCount > 0`) shows the missing-count note;
   - the run card uses the legacy family fallback for a pointer without `families`;
   - empty log shows the empty state with an accent CTA to `/materials`.
2. Implement `PracticeRunCard` plus `PracticeHub.tsx`.
   `materialTitles` are passed down from the hook; when a title is missing use the D-08 fallback.
   Keep the single-accent rule: with rows, only the topmost Resume is `btn-accent`.
3. Add the `/practice` route next to `/assessments` in `App.tsx`.
4. impeccable pass and the same browser verification as Phase 2.

Verify: focused `pnpm --filter app exec vitest run src/pages/practice/PracticeHub.test.tsx`, then the full app suite, typecheck, and lint.

Exit criteria: AC1's practice half, AC3, AC5 for the practice hub, AC6 polished at both widths; review gate passed.

Review gate: OCR delegate subagent plus thermo-nuclear subagent on the Phase 3 file list.

### Phase 4: Material detail backlink

**Status:** ✅ Done 2026-09-28 (focused 74/74 with refixes; full suite 1077 passed + 2 pre-existing TZ flakes; tsc + eslint clean; OCR PASS-WITH-MINORS + refix applied; thermo BLOCK + refix applied; browser-verified 1280/375 zero console errors, no overflow, evidence in `.work/active/assessment-library-practice-hub/plan/evidence/phase4-*`).
**Skills:** `tdd`, `ponytail`, `impeccable`.
**Depends on:** Phase 1; visually consistent with Phases 2-3.

Goal: material detail carries an honest assessments plus practice-runs section below the roadmap "Used by" block, and the placeholder sentence is gone.

Files:

- `apps/app/src/library/MaterialLibrarySection.tsx` (new)
- `apps/app/src/pages/materials/MaterialDetail.tsx` (modified)
- `apps/app/src/pages/materials/MaterialDetail.test.tsx` (modified)

TDD sequence:

1. Extend `MaterialDetail.test.tsx` (red):
   - the new section renders this material's assessments (family, status or score, link to `/assessments/:id`) and practice runs (mode, progress or outcome, link to the shipped run route);
   - rows created by other materials never appear;
   - the section's empty copy is honest when the material has neither;
   - "Assessments will appear here once created." is gone while "Not attached to any roadmap yet." remains for the roadmap-only empty case;
   - the roadmap "Used by" block is otherwise untouched.
2. Implement `MaterialLibrarySection.tsx` using `useLibraryRows({ materialId })` and the pure row models; render the compact list from the prototype (`alb-backlink` markup), not the cards, to respect the approved backlink design.
3. Wire the section into `MaterialDetail.tsx` directly below the "Used by" block; edit only the placeholder sentence.
4. impeccable pass at 1280 and 375 (the section must not disturb the detail layout or overflow at 375).

Verify: focused `pnpm --filter app exec vitest run src/pages/materials/MaterialDetail.test.tsx`, then the full app suite, typecheck, and lint.

Exit criteria: AC4, AC6 for the backlink; review gate passed.

Review gate: OCR delegate subagent plus thermo-nuclear subagent on the Phase 4 file list.

### Phase 5: Cross-surface polish and accessibility pass

**Status:** ✅ Done 2026-09-28 (backlink-only polish: inline-style fold, 44px targets, aria-labelledby, tabular scores, rem title; browser-verified 1280/375 zero errors/no overflow/keyboard/reduced-motion, evidence in `plan/evidence/phase5-*`; focused 77/77, suite 1077 + 2 pre-existing TZ flakes; tsc + eslint clean; OCR PASS-WITH-MINORS + thermo PASS-WITH-MINORS, px finding fixed, rest explicitly deferred).
**Skills:** `impeccable`, `ponytail` (fix by subtraction, not by adding wrappers).
**Depends on:** Phases 2-4.

Goal: both hubs plus the backlink read as one Marginalia surface and survive a hostile audit at both widths.

Steps:

1. Load `impeccable` and audit the three surfaces together: type scale, spacing rhythm, tag vocabulary, meta-line mono consistency, card hover and focus states, 44 px targets, keyboard order, one accent per screen.
2. Browser pass with `playwright-cli` (rule 15) at 1280 and 375:
   - zero console errors on every visited surface;
   - no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`);
   - keyboard walk of both hubs (Tab to card, Enter opens, Tab to the action, action fires);
   - `prefers-reduced-motion` collapses the generating dots to static.
3. Fix findings; delete anything that exists only for the prototype or for a state that cannot occur.
4. Re-run the focused page tests and the full app suite.

Verify: same commands as Phase 4, plus the manual browser evidence recorded in `SCRATCHPAD.md` (width, URL, what was seen).

Exit criteria: AC5 and AC6 visually verified pre-E2E; review gate passed.

Review gate: OCR delegate subagent plus thermo-nuclear subagent on the full diff of Phases 2-5.

### Phase 6: Live E2E and full verification

**Status:** ✅ Done 2026-10-05 (live 2 passed 2.8m both widths with strengthened spec, suite 1077 + 2 pre-existing flakes, typecheck/lint/build green, OCR + thermo PASS-WITH-MINORS fixed in spec; detail in `.work/active/assessment-library-practice-hub/SCRATCHPAD.md` + `plan/VERIFICATION.md`)
**Skills:** rules 10, 15, 16; `tdd` still applies (write the spec scenarios as the test, then make them pass without weakening them).
**Depends on:** Phases 1-5 green.

Goal: one live spec proves the whole loop on the real stack at 1280 and 375, with cleanup and the request-id join.

Files:

- `e2e/assessment-library-live.spec.ts` (new)
- `.work/active/assessment-library-practice-hub/plan/VERIFICATION.md` (AC matrix, filled)
- `.work/active/assessment-library-practice-hub/plan/evidence/` (screenshots at both widths)

Runtime prerequisites (rule 10, rule 54):

```bash
./full-app status full
./full-app start full          # only if not already running
export HF_TOKEN=$(grep '^HF_TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
docker compose -f services/embedder/docker-compose.yml up -d
setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &
```

Export `E2E_LIVE_EMAIL` / `E2E_LIVE_PASSWORD` from `.work/specs/test-login-cred.txt` without printing them (rule 16).
Stop the sidecar after the run (rule 54).

Spec shape, modelled on `e2e/practice-run-live.spec.ts`:

- Module-level `test.skip(!EMAIL || !PASSWORD, ...)`; one `test.describe` per viewport with `test.use({ viewport })` inside that describe, and a `test.setTimeout` sized for generation plus grading.
- Delete assessments created on the frozen material inside the test window through PostgREST with the service-role key, and verify none remain (the practice-run-live cleanup function is the pattern); fail loudly when the key is missing.
- Desktop (1280x720) scenario:
  1. sign in; wait for the shell;
  2. generate an objective question on the frozen ACCA material (`80c8b138-b544-4095-8dc0-1c390ac70da2`), answer it, wait for the deterministic grade;
  3. leave to `/study/materials`, confirm the Materials sub-nav counts are visible;
  4. open `/study/assessments`, locate the created assessment by its link href, assert family, `Ready`, and the score, then click back into `/study/assessments/{id}` and confirm the shipped taking/review treatment renders (this is the user's original complaint, proven fixed);
  5. open the material detail and assert the backlink section lists that assessment and the placeholder sentence is absent;
  6. start a one-problem written practice run from the material, answer it, leave to `/study/practice`, assert it is in Resume, click Resume and confirm the run opens on its resume point, then finish the run and confirm it moves to History with a working `Open summary`;
  7. assert the desktop grid geometry (two cards share a row / card width well above the mobile width) so a leaked mobile viewport fails the run.
- Phone (375x812) scenario:
  1. sign in; generate and grade its own assessment; open `/study/practice` and `/study/assessments`;
  2. assert one-column layout, no horizontal overflow, and the sub-nav remains reachable;
  3. resume a one-problem run left in progress and confirm the resume point.
- Both scenarios: `watchErrors` fixture returns zero console errors; run `REDACTION_RE` (as in the practice-run-live spec) over every tracked response body and the page content after opening an assessment; grep the intelligence log for the `X-Request-ID` of one generation call and assert the backend line exists (`grepIntelligenceLog`).
- Save desktop and phone screenshots into the task evidence folder.

Run:

```bash
pnpm exec playwright test -c e2e/playwright.config.ts e2e/assessment-library-live.spec.ts --project=app --workers=1
```

Then the full verification battery and the AC matrix in `VERIFICATION.md`:

```bash
pnpm --filter app test
pnpm typecheck
pnpm lint
pnpm build
```

The service and Python packages are untouched; a backend suite run is optional evidence, not a gate.

Exit criteria: AC1-AC6 ticked in `VERIFICATION.md` with evidence paths; live spec green at both widths; review gate passed.

Review gate: OCR delegate subagent plus thermo-nuclear subagent on the spec and the full diff.

### Phase 7: Prototype removal and wayfinder exit (AC7)

**Status:** ✅ Done 2026-10-05 (prototype dir deleted 1364 lines + App.tsx DEV route removed 7 lines; build green with 0 prototype hits in dist; typecheck/lint clean; focused 82/82; suite 1077 + 2 pre-existing flakes; OCR PASS + thermo PASS-WITH-MINORS, both test-only, no fix; #81 resolution + 7/7 ACs + map #4 line + CLOSED)
**Skills:** `work-journal-orchestrator` for the wrap; rules 52 and the wayfinder exit protocol; `ponytail` for the deletion.
**Depends on:** Phase 6.

Steps:

1. Delete `apps/app/src/prototype/assessment-library/` (3 files) and remove the prototype import plus dev route from `App.tsx` (this reverts the uncommitted prototype modification).
2. `pnpm build`, then prove the prototype is gone from the production output (no `assessment-library-prototype` or prototype symbol under `apps/app/dist/`).
3. Run `graphify update .` to refresh the graph after the code changes (dirty `graphify-out/` is expected).
4. Wayfinder exit on #81:
   - post the resolution comment linking the plan, the live E2E evidence, and the verification record;
   - tick every acceptance criterion on the issue;
   - append the decision line to map #4 (GitHub) and to the local snapshot `.work/active/phase2-wayfinder/research/map-4.md` Decisions-so-far;
   - close #81.
5. Wrapping with the work-journal-orchestrator: distill `SCRATCHPAD.md` into `state.md`, write the final `VERIFICATION.md`, archive the task folder, flip the STATUS.md row from Active to Done, and update the phase2-wayfinder frontier line (only #49 remains).
6. Final whole-diff review gate, then stop: do not commit unless the human asks.

Exit criteria: AC7 complete; issue closed; STATUS, map snapshot, and archive consistent.

## Open questions

- Offline material titles fall back to "Material unavailable" (D-08).
  The durable fix is either a per-user title cache or an additive `materialTitles?: string[]` on the pointer payloads; both are follow-ups, not this ticket.
- `assessmentContentCache` gains its first production writer here.
  Extending writes to the taking/review/run screens would make offline reading work without a hub visit first; recorded as a follow-up because the issue forbids changing those screens beyond linking.
- Material detail's "Attach to assessment" picker still ends in a "next Phase 2 slice" stub banner (`MaterialDetail.tsx:515-530`).
  Pre-existing and out of scope, but do not mistake it for this ticket's work.
- `/practice/:runId` route convergence with #5 remains deferred; this ticket links into `/materials/:materialId/practice/:runId` by design (D-06).

## Out of scope

- Server list endpoint, new generation/grading/ingestion behavior, schema or Dexie version changes, new event kinds.
- Changes to the shipped taking, review, or run screens beyond linking to them.
- The prototype's original exploration of route convergence and server list shape; both are settled by #81.
- Anything under `college/`, `research/`, or `services/intelligence/`.

## References

- Issue #81 body (locked HITL decisions, UI spec, AC1-AC7) and prototype issue #80.
- Wayfinder map #4 Decision lines for #5 (App IA), #10 (persistence), #33/#34/#35 (prototype precedents).
- Rules: 10, 11, 12, 15, 16, 17, 30, 32, 33, 42, 52, 53.
- Code: `apps/app/src/pages/practice/practiceRunModel.ts`, `apps/app/src/pages/assessments/review/reviewModel.ts`, `apps/app/src/assessments/attemptFlow.ts`, `apps/app/src/materials/materials.css`, `apps/app/src/App.tsx:206-237`, `apps/app/src/components/NavBar.tsx:62-69`.
- Prototype (deleted in Phase 7): `apps/app/src/prototype/assessment-library/`.
- E2E models: `e2e/practice-run-live.spec.ts`, `e2e/material-library-live.spec.ts`, `e2e/fixtures.ts`.
- Planning conventions: `.work/plans/README.md`, `.work/plans/2026-09-28-coding-generation-context-residuals.md`.




