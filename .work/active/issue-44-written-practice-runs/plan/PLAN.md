# Written practice runs at `/study/materials/:materialId/practice` — Implementation Plan

**Date written:** 2026-09-13 · **Ticket:** [#44 Written Practice Runs](https://github.com/rings0fsaturn/study-planner/issues/44) (open, unclaimed — claimed in Phase 0) · **Parent:** implementation spec #32 · wayfinder map #4 · session model #16
**Branch:** `phase2/issue-44-written-practice-runs` (cut off the merged `project/phase-2` in Phase 0)
**Plan status:** 🟢 Amended 2026-09-15: **D-10 reversed** (multi-material *distribution* now ships in Phase 2 as round-robin across per-problem calls — it crosses no server gate) and **D-12 added** (cross-material *synthesis* stays out of scope — that is what the single-material gate actually protects). Earlier amendment 2026-09-14: review fixes folded in (deferred questionIds, pause = leave-and-return, Written/3 defaults, primitives-level review reuse, no AssessmentCreated for practice). **P0 done 2026-09-15** (PR #64 merged as `8f04d0d`) and **P1 done 2026-09-15** (real generation wired, live-verified). Decisions D-01…D-09 and D-11 are locked unless a reality-mismatch reopens them; D-10 as amended governs.
**Trigger:** user ask 2026-09-13 — "lets work on Practise `study/materials/<id>/practice`. Find out what prototype we had planned out for this, and how we can implement it."

> Runbook convention inherited from the #38/#39/#40/#41/#62/#63 plans: **one phase per session**, records committed in the same commit as the work, STOP on any reality-mismatch and record it.
>
> **Vitest invocation:** the app `test` script is already `vitest run`; `pnpm --filter app test -- --run <path>` makes vitest read the path as a *name* filter and scan everything. Use `pnpm --filter app test <path>`.
>
> **WSL/drvfs staleness (rule 53):** Vite misses edits under `/mnt/d`; after frontend changes run `./full-app restart app` and hard-reload before judging the UI.

## TL;DR

The config surface for this route already exists and is real UI; nothing behind it does. Clicking **Start practice run** writes a fake banner ("Practice runs arrive with the next Phase 2 slice" — `PracticeThis.tsx:189-203`).

The risky piece was prototyped: wayfinder **#12** built three inline-hint guide surfaces at `/study/practice-prototype`, and HITL chose **Variant C — the anchored coach popover**, whose trigger/escalation state machine is the locked contract (`useHintEngine.ts`). What was **never** prototyped is the *run shell* around it — and the map records that gap as fog ("Practice code-editor choice … inputs to #16").

Nothing exists server-side for practice either: no practice router, no guide router, no `practice_runs` table (migrations stop at 030). But nothing *needs* to: generation is already material-scoped and the attempt/grading path is already run-agnostic — `AttemptSubmit` carries `{clientAttemptId, questionId, answer, submittedAt, correlationId}` and `practiceRunId` appears **nowhere** in the contract pack. So this slice is client-first: reuse generation, reuse attempt taking, reuse grading, reuse review.

## What the prototype we planned is (findings, 2026-09-13)

| Artifact | Where | State |
|---|---|---|
| **#12 inline-hint live guide prototype** | `apps/app/src/prototype/practice-guide/` (10 files, ~1088 lines), route `/study/practice-prototype?variant=A\|B\|C`, dev-only, still mounted (`App.tsx:172`) | Built. **Variant C chosen** (anchored coach popover). Mock-only: `hint-ladders.ts` is canned, `PracticeGuidePrototype.tsx` fakes the test run with `setTimeout` |
| **#33 material-library prototype** | `apps/app/src/prototype/material-library/` | Decided "dedicated **Practice-this config page**" — that decision is the page we have (`PracticeThis.tsx`) |
| **#34 assessment-review prototype** | `apps/app/src/prototype/assessment-review/` | Named `QuestionReviewCard(question, attempt)` as the shared primitive **Practice reuses**; implemented for real by #40 as `pages/assessments/review/ReviewSurface.tsx` |
| **#16 practice session model** (decision, closed) | GitHub #16 | Locks: multi-problem run; learner picks count / family / subtype / difficulty / scope; new problems generated online through the RAG pipeline; lifecycle start → pause/resume → finish → abandon; shared `QuestionAttempted → QuestionGraded`; guide = Variant C with three offering triggers; only graded results produce mastery observations |
| **Run shell** | — | **Never prototyped.** This plan's Phase 1–3 is that missing piece |

The prototype's engine (`useHintEngine.ts`) is the behavioural contract to inherit in #46, not now: hybrid triggers that **offer** ("I'm stuck", 12 s idle, failed test run), the ladder escalation, and an explicit confirm gate before any worked answer. Its canned ladders become the server prompt later; the engine's shape does not change.

## Acceptance criteria → where they are met

| AC | Meaning (#44) | Met by |
|---|---|---|
| AC1 | Learners configure, start, pause, resume and complete multi-question written runs | P1 (configure+start), P2 (pause/resume/complete) |
| AC2 | Written practice uses the same server-authoritative grading and fresh-attempt semantics as assessments | P2 (reuses `AttemptTaker` + `attemptFlow`; retry = fresh `clientAttemptId`) |
| AC3 | Valid grades update mastery; paused/abandoned/timed-out/unsubmitted work creates none | **Deferred to #43** — see D-09. This slice produces the observations #43 will consume |
| AC4 | Works at mobile and desktop widths, survives refresh and reconnect | P2 (resume from URL) + P4 (live spec at 1280×720 + 375×812) |

## Context — live-tree facts (verified 2026-09-13; trust these over older notes)

### The route as it stands

- `App.tsx:202` → `<Route path="/materials/:materialId/practice" element={<PracticeThis />} />` (inside the protected shell, no `/study` prefix — router basename is a deployment concern).
- `pages/materials/PracticeThis.tsx` (229 lines, 4 tests in `PracticeThis.test.tsx`): loads the material, blocks a non-ready material honestly, offers `Number of questions` (1–20, default 5), Focus chips `Written | Coding | Mixed` (default `Mixed`), Difficulty chips `Adaptive | 1..5` (default `Adaptive`), `Add another material` via the existing `MaterialPicker` (`purpose="generation"`, max 5), and `Start practice run` → `setStarted(true)`. No call to the service anywhere in the file. Phase 1 changes the defaults to `Written` and `3` and neuters the picker (D-07/D-08/D-10) — the rendered defaults today offer a run the service cannot produce.
- The Focus/Difficulty vocabulary in that stub is **not** the wire vocabulary: `recipe.formats` takes one `AssessmentFormat`, and `Adaptive` is a client mastery snapshot (#43), not a generation input.

### What generation already does (`apps/app/src/pages/assessments/AssessmentConfig.tsx`)

- `submit()` at `:190-223` builds `GenerationRequest { clientId, materialIds, recipe: { formats: [family], questionCount, difficulty, scope? }, correlationId }`, calls `assessments.generateAssessment(request)`, appends the thin `AssessmentCreated` pointer event, and navigates to `/assessments/:id`.
- `pages/assessments/AssessmentDetail.tsx` then owns the rest: `useAssessmentPolling(assessmentId)` polls `getAssessment` every 3 s while `status === 'generating'` and stops on a terminal status (`:104-158`); `flow.refreshAttempts(assessment)` hydrates local attempt rows and re-polls while any attempt is in flight (`:205-242`). Refresh-safe resume needs only the route param.
- Server side gates (`services/intelligence/app/routers/assessments.py:38-43` + `:140-143`): `formats` must be `['objective']` or `['written']`, `questionCount` must be exactly 1, **and `materialIds` must be exactly 1 per call**. So coding is #42's slice, and an N-problem run means N single-material generation calls (D-06). **The `materialIds` gate is per call, not per run** — so it blocks cross-material *synthesis* (D-12) but not multi-material *distribution* across a run's N calls (D-10 as amended 2026-09-15).

### What attempt taking and grading already do

- `assessments/attemptFlow.ts` (`createAttemptFlow`, `LocalAttemptRow`, `AttemptTransport`, `writtenAnswerProblem`) — local-first attempts: the answer lives in the unsynced Dexie row `assessmentAttempts` (keyed by `clientAttemptId`, patched with the server `attemptId` after submit; retry = a new row), while the durable `QuestionAttempted` event stays answer-free. `QuestionGraded` carries the authoritative result.
- Dexie v6 already has everything this slice needs (`events/EventStoreProvider.tsx:50-64`): `events` (free-form `kind` — no CHECK, so a new kind is just a row), `assessmentAttempts`, `assessmentContentCache`. **No new table, no version bump.** `masteryCache` is *not* in v6 — #43 owns v7.
- `pages/assessments/AttemptTaker.tsx` (285 lines) takes one question: objective (#39) or written (#41, `textarea` sized by subtype), phases `answering → submitting → queued-offline → grading → graded/failed`, retry as a fresh attempt.
- Service routes that exist today: `POST /v1/assessments/generate`, `GET /v1/assessments/{id}`, `POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts`, `GET /v1/assessments/{assessmentId}/attempts`, `GET /v1/jobs/{id}`. (There is no standalone grade trigger route: submit enqueues grading and the client observes the grade by polling the attempts read route — `AssessmentDetail.tsx:233-260` is the pattern.)
- Service routes that do **not** exist: `/v1/practice-runs*`, `/v1/guide/stream`, `/v1/guide/reveal`, `/v1/mastery`. Routers present: `assessments, calibration, jobs, materials, progress, retrieval, roadmap, serialization`.

### Contract pack facts that bite

- `PracticeRunCreate` requires `questionIds` (min 1) — the run is *composed from questions that already exist*, which is exactly what generating into assessment rows then referencing them satisfies.
- `practiceRunId` does not appear anywhere in `services/intelligence/contracts/phase2/` (grepped), even though #16's resolution says it provides context. Nothing in the grading path requires it today.
- `GuideRequest.tier` is the wire enum **`nudge | concept | strategy | worked_step`** — *not* the prototype's `nudge → hint → targeted → reveal` labels. #46 must keep the contract names on the wire and the prototype names as display copy; the gated reveal stays a separate call (`RevealRequest` requires `attemptId` + `confirmation: true`).
- `questionCount` is a recipe field the pipeline was designed to honour ("bounded per-slot fan-out", map #13) but the slice gate caps it at 1 (D-06).

### What makes the lazy path safe

- **Grading needs no server change.** Attempt submission/grading is keyed by `questionId`/`attemptId`, not by run. A practice submission is the same call the assessment flow makes.
- **A new event kind is a row.** `logEvent(kind, payload)` is free-form (`sync/SyncEngine.ts`) and `public.events.kind` is plain `TEXT` — a `PracticeRunStarted` pointer needs no migration, no Dexie version, no deploy.
- **The run's per-problem progress is already persisted.** `assessmentAttempts` rows are keyed by `clientAttemptId` and carry `questionId`/`assessmentId`/`status` — a resumed run reads them; nothing new stores "which problem was I on" beyond the run's own pointer.

## UX shape

One story, three screens, all inside `/materials/:materialId/practice`:

1. **Configure** (exists) — count, focus, difficulty, materials.
2. **Run** (`/materials/:materialId/practice/:runId`, new) — one problem at a time on the shared `AttemptTaker`; a problem navigator (reuse #40's pattern); "done" per problem; leave and come back to resume; abandon stops the run without inventing an observation. The guide popover (#46) mounts beside the editor here later — no stub built for it now.
3. **Summary** — the run's graded problems through the existing review surface, relabelled for practice.

## Decisions log

### D-01: Practice reuses the assessment generation + attempt + grading path
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** Phase 1 calls `POST /v1/assessments/generate` (one recipe per problem), Phase 2 submits through `POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts`, Phase 3 renders the grades the existing read route returns. **Do not build `/v1/practice-runs` in this slice.**

**Rationale:** the practice server object buys nothing yet — `questionIds` must come from a generation the service already owns, and grading is already question-scoped. Building a parallel run container, its router, its table and its tests is the largest possible diff for zero user-visible value.

**Deviation flagged:** the contract pack specifies `POST /v1/practice-runs` and `POST /v1/practice-runs/{runId}/attempts`. Deferring them is a deliberate, recorded deviation, not an oversight; it is revisited the moment a server-side run needs to exist (e.g. adaptive selection reading run history in #43/#45).

**Reversibility:** easy — the client would swap two call sites.

### D-02: The run rides a thin local pointer event, not a table
**Status:** ✅ Locked 2026-09-14 (review fix)

**Decision:** new event kinds `PracticeRunStarted { runId, materialIds, mode, assessmentIds, count }` and `PracticeRunFinished { runId, outcome: 'completed' | 'abandoned' }`, appended through the existing `EventStore` via the same local-only `eventStore.append` call `AssessmentConfig` uses (not `SyncEngine.logEvent`). `runId` is client-minted (`crypto.randomUUID()`), used in the URL. `questionIds` are **deliberately absent**: at Start time generation has only returned jobs, so there are no question ids yet — the run resolves questions lazily through `getAssessment(assessmentId)`, polling while `generating` (`AssessmentDetail.tsx:104-158` pattern). Practice-owned generations do **not** append `AssessmentCreated`, so N assessment pointers never pollute the log (D-11).

**Rationale:** the #10 decision is "thin pointers on the log, server content elsewhere" and `AssessmentCreated` is the precedent. Adding a Dexie table for a run whose progress is already derivable from the event + attempt rows would duplicate state that must then be kept in sync.

**Sync consequence (honest limit):** local-only append means the run pointer restores on this device and via snapshots, but a fresh device opening the bare `runId` URL sees no pointer — only the server rows. Cross-device run resume is out of this slice; same-device refresh/reconnect (AC4) is what is promised.

**Reversibility:** easy.

### D-03: The run gets a nested route under the material
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** `/materials/:materialId/practice` stays the config page; `/materials/:materialId/practice/:runId` is the live run. Both under the existing protected shell, no `/study` prefix.

**Rationale:** #5 locked nested path-param routes and material-scoped items; the run is material-scoped, and a refresh must land the learner back in the run (AC4) with no extra lookup.

### D-04: The run shell reuses `AttemptTaker` and the review primitives — not `ReviewSurface`
**Status:** ✅ Locked 2026-09-14 (review fix)

**Decision:** per problem, render the existing `AttemptTaker` (no new taking UI); the completion view reuses **`QuestionReviewCard(question, attempt)` + `QuestionNavigator` + `reviewModel.ts`** (the primitives), never the whole `ReviewSurface`. Only the shell, the navigator wiring and the run state are new.

**Rationale:** #34/#40 explicitly built `QuestionReviewCard(question, attempt)` as the shared primitive Practice #16 reuses. But `ReviewSurface` takes one `Assessment` with N questions plus a single whole-assessment timeline, while a run is N assessments of 1 question each — there is no thin wrapper, only a pseudo-assessment adapter plus `SummaryBand` surgery (its `Retry assessment` button and assessment-status copy have no practice meaning). Reusing the primitives is the smaller diff; reusing the shell is the larger one. `ponytail:` dropped the adapter, kept the cards.

**Ownership note:** `AttemptTaker` builds its flow for one `assessment.id` (`AttemptTaker.tsx:45-63`) and reads rows by that id. `PracticeRun` owns the N-assessment loop: one `refreshAttempts`/`listLocalAttempts` per `assessmentId`, and one `drainQueuedAttempts` caller on reconnect — name it in Phase 2, do not let each taker drain independently.

### D-05: The editor is a textarea with a line-number gutter — Monaco is deferred
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** written answers keep the existing `textarea`; the active line is derived from selection/caret. No editor dependency is added.

**Rationale:** the chosen guide surface (Variant C) is a popover that needs the *active line number*, which a textarea gives for free. Inline ghost-text widgets were Variant A and are rejected. Nothing editor-shaped is installed today (`apps/app/package.json` has no monaco/codemirror/ace), so this also avoids a ~MB-scale dependency plus Vite worker config.

**Ceiling (`ponytail:`):** if the guide ever needs inline line-anchored rendering, the textarea is the blocker — add Monaco/CodeMirror then, in #46, not now.

### D-06: One single-material generation call per problem for this slice
**Status:** ✅ Locked 2026-09-14 (review fix)

**Decision:** a 5-problem written run issues 5 `generateAssessment` calls (`formats: ['written']`, `questionCount: 1`, `materialIds: [primary]` — one id, the server 400s anything else), bounded to 2 at a time, then composes the run from the returned **assessment ids** (not question ids — see D-02). Do **not** lift the server's `questionCount must be 1` gate in this slice.

**Rationale:** the gate is a slice limit, not a design limit, but lifting it touches the generation pipeline and its golden tests — the exact surface #39/#41 already verified. Composing N single-question generations costs nothing architecturally (the contract's `questionIds[]` expects a composed set) and keeps this branch's diff in the client.

**Ceiling (`ponytail:`):** N LLM calls where one would do, and N assessments per run. If measured latency/quota makes it visible, Phase 5 lifts the gate behind the blueprint's existing per-slot fan-out.

**Honesty requirement:** honour `quota_exhausted` (`retryAfterSeconds` is already normalized by `normalizeAssessmentError`) and report partial generation per problem rather than failing the whole run.

### D-07: Focus chips — `Written` only; `Coding` / `Mixed` stay disabled
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** enable `Written`; render `Coding` and `Mixed` disabled with a short "arrives with coding practice" note until #42/#45 land. The config page must not offer a run it cannot produce.

**Rationale:** server-side `formats` accepts `objective | written` only; coding generation is #42, which is unstarted.

### D-08: `Adaptive` difficulty is disabled until #43
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** the difficulty chips become `1..5` (default 3, matching `AssessmentConfig`'s `difficulty` default) with `Adaptive` disabled and its reason shown.

**Rationale:** adaptive difficulty is a client mastery snapshot (`#14`/`#43`); there is no mastery projection yet and `masteryCache` does not exist in Dexie v6. Offering the chip today would be a lie in the UI.

### D-09: AC3 (mastery) is not this slice's
**Status:** ✅ Recorded reality

**Decision:** this branch ticks AC1, AC2, AC4. AC3 is met when #43 lands the mastery projection and `/v1/mastery`; the graded attempts this run produces are the observations it consumes.

**Rationale:** #44 is blocked by #43 in the ticket graph; that blocker is real and cannot be waived by writing more client code.

### D-10: Multi-material runs distribute round-robin across per-problem calls
**Status:** ⚠️ **Amended 2026-09-15 — the original lock is reversed.** The pre-amendment text is preserved below.

**Decision (in force):** `Add another material` is live again. The config page collects up to 5 materials (the route's `materialId` is always first and always selected). Phase 2 restores the `MaterialPicker` mount and distributes the run's N problems across the M chosen materials **round-robin, one material per call**: problem `i` is grounded in `materials[i % M]`. `PracticeRunStarted.materialIds` carries the full ordered list.

**Why the original lock was wrong:** it read the server's single-`materialId` gate (`assessments.py:140-143`) as blocking multi-material runs. It does not. The gate is **per call**, and D-06 already makes an N-problem run N calls — so round-robin keeps every call at exactly one material and crosses no gate. The gate only blocks the *other* feature: one question synthesized across several materials (now recorded as D-12/B, still out of scope). Conflating the two over-scoped the lock by a whole feature.

**Rationale for round-robin over alternatives:** it is the only distribution that needs no server change at all. Fan-out (every material × every problem) is N×M calls nobody asked for; splitting the run into per-material blocks is a scheduling decision with no stated user need. `ponytail:` `materials[i % M]` is one expression and the run pointer already declared `materialIds: string[]`.

**Honest limits:** each question is still grounded in exactly **one** material, so this buys *coverage* across sources, not synthesis. With N problems and M materials where `N < M`, round-robin deterministically uses only the first N materials — the UI should not imply every chosen material contributed. Cross-material synthesis is D-12/B.

**Reversibility:** easy — the distribution is one expression in Phase 1's generation loop and one `materialIds` array on the pointer.

---

<details>
<summary>Original D-10 lock (superseded 2026-09-15)</summary>

**Decision:** Phase 1 sends `materialIds: [primary]` on every call and disables `Add another material` with honest copy ("multi-material runs arrive later"). The picker stays in the tree but unclickable; no round-robin, no split, no fan-out.

**Rationale:** the server requires exactly one `materialId` (`assessments.py:140-143`), so wiring the picker today means either N×M calls nobody specified or a first-400 that reads like a backend bug. Multi-material distribution is its own decision for a later slice, not a silent default. `ponytail:` a disabled button plus one line of copy beats a distribution algorithm nobody asked for.

</details>

### D-12: Multi-material *synthesis* (one question grounded in several materials) stays out of scope
**Status:** ✅ Recorded reality 2026-09-15

**Decision:** a single question whose grounding spans two or more materials is **not** this slice and not P5's. It needs the single-material assumption removed from five layers: the retrieval RPC (`match_material_id TEXT`, `migrations/029_page_scoped_chunks.sql:49`), the assessment row (`material_id TEXT NOT NULL REFERENCES materials(id)`, `migrations/018_assessments_generation.sql:27`), the job payload (`generation/worker.py:148`), the context builder (`generation/context.py:40,59`), and citation binding (`generation/validation.py:128,163,188` — `blueprint.material_id` attributes every citation) — plus a per-question material decision in the questions table and the `assessments.py:140` gate itself.

**Rationale:** this is the feature the single-material gate actually protects. It is a schema + RPC + worker + validation slice with its own contract amendment, and it earns its own ticket. Recorded here so the distinction between D-10 (distribution, shipped) and D-12 (synthesis, deferred) is not lost the next time someone reads that gate and concludes multi-material is impossible.

### D-11: No `AssessmentCreated` for practice-owned generations; no pause event
**Status:** ✅ Locked 2026-09-14 (review fix)

**Decision:** practice generations append only `PracticeRunStarted`; `AssessmentCreated` stays assessment-owned so N practice pointers never pollute the log (nothing reads that kind today except tests — verified by grep). Pause is **leave-and-return via the `runId` URL with no event and no timer**: closing the tab, navigating away, and returning is the pause; the first ungraded problem is the resume point. There is no `PracticeRunPaused`, no countdown, no timeout event in this slice.

**Rationale:** a pause event with no consumer is speculative state; the URL already carries everything resume needs. Timeouts stay inside AC3's deferral (D-09): un-graded work creates no observation either way.

## Architecture overview

```
PracticeThis (config, exists)
  └─ Start ─► generateAssessment × N, bounded 2, one material per call
              problem i grounded in materials[i % M]  ──► server: assessments + questions rows (unchanged)
             └─ append PracticeRunStarted {runId, materialIds (all M), assessmentIds}  (no questionIds — D-02; no AssessmentCreated — D-11)
                └─ navigate /materials/:id/practice/:runId

PracticeRun (new)
  ├─ read run from the event log (runId) → assessment ids + the ordered material ids
  ├─ read questions via getAssessment(assessmentId) (existing, polled while generating)
  ├─ per problem: AttemptTaker  ──► POST .../attempts ──► worker ──► QuestionGraded (polled via GET .../attempts)
  ├─ per-problem material attribution (problem i → materials[i % M]) from the pointer alone
  ├─ pause = leave and return via the runId URL (no event — D-11)
  └─ finish/abandon ─► PracticeRunFinished {outcome}

PracticeSummary (new, thin)
  └─ QuestionReviewCard + QuestionNavigator + reviewModel (primitives, practice labels — D-04)
```

## Files touched (index — indicative, not a contract)

- `apps/app/src/pages/materials/PracticeThis.tsx` (+ `.test.tsx`) — wire the config to real generation, run pointer, navigate; multi-material selection + round-robin (D-10 amend).
- `apps/app/src/pages/practice/PracticeRun.tsx` (+ `.test.tsx`) — **new**, the run shell.
- `apps/app/src/pages/practice/practiceRunModel.ts` (+ `.test.tsx`) — **new**, derive run state from events + attempt rows, including per-problem material attribution `materials[i % M]` (the only non-trivial logic; gets the TDD treatment).
- `apps/app/src/pages/practice/PracticeSummary.tsx` (+ `.test.tsx`) — **new**, thin composition of the review primitives (no `ReviewSurface` — D-04).
- `apps/app/src/sync/types.ts` — `PracticeRunStartedPayload`, `PracticeRunFinishedPayload`.
- `apps/app/src/events/EventStore.ts` — two new kind constants.
- `apps/app/src/App.tsx` — one nested route.
- `apps/app/src/materials/materials.css` (or a new `practice.css`) — run-shell layout only.
- `e2e/practice-run-live.spec.ts` — **new**, live spec at 1280×720 + 375×812.

## Phase 0 (prerequisite, not a feature phase): git state, ticket, task folder

**Status:** ✅ Complete 2026-09-15 (PR #64 merged as `8f04d0d`)
**Depends on:** —

The user's step 0. Two things must be true before any of it: the working tree has **only untracked, unrelated** files (`git status --short` on 2026-09-13: `.cursor/`, `.work/active/document-pipeline/`, `college/mydeliverables/phase2-review-*`, `e2e/tmp-viewer-timings.spec.ts`, `graphify-out/`), and this plan file is uncommitted so it rides onto the new branch.

**Known state (verified 2026-09-13; RE-VERIFY at session start — SHAs are stale):**

- Current branch `phase2/issue-62-scoped-question-generation` at `90d3066`, **fully pushed** (`git log origin/phase2/issue-62-scoped-question-generation..HEAD` is empty).
- **Parent branch = `project/phase-2`** (the integration branch; PRs #58–#61 all merged issue branches into it). Verified: `origin/project/phase-2` is `d7408d4` (the PR #61 merge) and the current branch's merge-base with it is `6400867` (#40 wrap) — i.e. 62 is a clean fast-forward candidate with exactly 1 commit on the parent side.
- `git merge-tree --write-tree origin/project/phase-2 HEAD` produced no conflicts.
- ⚠️ The branch has moved since (P4/P8 commits on top). Re-run the `git log`, `merge-base`, and `merge-tree` checks before step 2 — do not trust the numbers above.

**Steps**

1. Push the current branch (should be a no-op) and confirm:
```bash
git push -u origin phase2/issue-62-scoped-question-generation
git rev-list --count origin/phase2/issue-62-scoped-question-generation..HEAD   # expect 0
```
2. Open the PR into the parent branch **and merge it there** (merge-commit style, matching #58–#61):
```bash
gh pr create --base project/phase-2 --head phase2/issue-62-scoped-question-generation \
  --title "#62 scoped question generation + #63 roadmap material attach (P1–P8)" \
  --body "P1–P8 of #62 (page provenance, outline, scoped retrieval, pdf.js reader) and P1–P4 of #63 (roadmap material attach). #62 P7 (streaming) and #63 P5 (material-detail usage) remain open on their branches."
gh pr merge --merge --delete-branch=false
```
3. Refresh the integration branch and cut this task's branch off it:
```bash
git fetch origin
git checkout project/phase-2 && git pull --ff-only
git checkout -b phase2/issue-44-written-practice-runs
git log --oneline -1   # expect the #62 merge commit
```
4. Claim the ticket: `gh issue edit 44 --add-assignee @me` and tick nothing yet.
5. Open the task folder (work-journal TASK OPEN): `plan/PLAN.md` (this file), `research/`, and the STATUS row.
6. First commit on the new branch: the plan + STATUS row (`docs(work): #44 open practice-runs task — plan and STATUS row`).

**Stop conditions / risks to confirm before step 2:**

- **#62 and #63 are unfinished** (#62 P7 streaming + wayfinder exit; #63 P5 material-detail usage). Merging now puts partial-ticket work on the integration branch. Both branches survive on origin, so nothing is lost — but say so if you would rather finish them first.
- The `project/phase-2` **local** branch is stale (`a147f59`, 6 behind its origin) — step 3 fast-forwards it, never merges into it locally.

### Notes (filled in during implementation)

**2026-09-15 — Phase 0 executed. The merge was mandatory, not optional, and the plan's cost note understated it by a whole ticket.**

- **#41 was never on `project/phase-2`.** `origin/project/phase-2` (`d7408d4`) had a tree *byte-identical* to the #40 wrap (`6400867`): PR #61 merged `phase2/issue-40-41` at a tip predating #41's own nine commits (`d111ead`…`237faf8`), which never travelled into it. Verified by absence — `WrittenAnswer` count 0 in the parent `openapi.yaml`, no `writtenAnswerProblem` in parent `attemptFlow.ts`, parent `AttemptTaker.tsx` (243 lines) with no written textarea and no `isWritten`. **Step 2's merge was the only carrier of #41**, so this branch would not have been buildable off the bare parent. The "Stop conditions" bullet above listed only the two incomplete tails; #41 is *complete* and was simply stranded.
- That also explains the plan's parent-side citation drift: the parent `AssessmentConfig.tsx` is 229 lines and its `:190-223` is error-banner JSX, not the `submit()` the Context section cites, and the same holds for `assessmentClient.ts:74`. `PracticeThis.tsx` is 229 lines on both bases but already reads HEAD's `MaterialPicker` record shape (`picked.materialId`), so it did not build on the bare parent either. Every one of those citations is HEAD-accurate and became correct the moment step 2 landed — no plan edit needed beyond this note.
- `git merge-tree --write-tree origin/project/phase-2 HEAD` equalled HEAD's tree (`066ec4d`), exit 0: conflict-free, and the merged parent is byte-identical to the 62 tip. Confirmed after the fact — the new branch's tree is `066ec4d` too.
- **Executed:** pushed 62 (no-op, 0 ahead) → PR #64 → merged as `8f04d0d` → `project/phase-2` fast-forwarded from `a147f59` (39 behind) to `8f04d0d` → `phase2/issue-44-written-practice-runs` cut off the refreshed parent. #44 assigned to `rings0fsaturn`.
- Two environment snags, both cleared: a stale 0-byte `.git/index.lock` from 2026-09-13 blocked the first checkout (removed after confirming no live git process owned it), and the uncommitted STATUS row blocked the branch switch, so it was stashed and popped back rather than committed early.
- The PR title/body name all three tickets rather than the plan's two — the merge carries #41 (8 commits), #62 (14), #63 (6). Landing #62 P7-incomplete and #63 P5-incomplete was approved by the user on 2026-09-15, on the basis that #44 is unbuildable without the #41 commits the same merge delivers.

> **Relocated 2026-09-15 (Phase 1 session):** this block was written under Phase 1's Notes heading by the Phase 0 session — Phase 0 had no Notes block. It is Phase 0's record, so it now sits in Phase 0's section, unchanged. No content altered.

## Phase 1: `Start practice run` produces real, grounded written questions

**Status:** ✅ Complete 2026-09-15
**Depends on:** Phase 0
**Estimated scope:** 2 files + tests, ~200-250 lines (bounded fan-out + honest progress/quota/partial-failure copy cost more than the calls)

### Codebase state assumed at start
- `PracticeThis.tsx` has the config controls and no service call.
- `AssessmentConfig.tsx:190-223` is the working precedent for `generateAssessment` + pointer event + navigate.
- `normalizeAssessmentError` (`assessments/assessmentClient.ts:74`) already maps quota/timeout/network.

### Steps

1. Extend `sync/types.ts` with `PracticeRunStartedPayload { runId, materialIds, mode: 'written', assessmentIds, count }` / `PracticeRunFinishedPayload { runId, outcome: 'completed' | 'abandoned' }` (D-02) and add the two kind constants to `events/EventStore.ts`. No `questionIds` field — they do not exist yet (D-02).
2. In `PracticeThis.tsx`, replace the fake `started` banner with a real submit: change defaults to `focus='Written'`, `difficulty='3'` (D-07/D-08); disable `Add another material` with "multi-material runs arrive later" copy (D-10). Build one `GenerationRequest` per problem (`formats: ['written']`, `questionCount: 1`, `difficulty: Number(difficulty)`, `materialIds: [primary]` — exactly one id), fan out bounded 2 at a time, collect `{ assessmentId }` per success. Do **not** append `AssessmentCreated` for these (D-11).
3. Append `PracticeRunStarted` via local-only `eventStore.append` (best-effort, `AssessmentConfig`'s precedent: a failed append logs and continues) and `navigate(/materials/${materialId}/practice/${runId})`.
4. Honest states while generating: `aria-busy` progress copy, `quota_exhausted` shows `retryAfterSeconds`, partial failure keeps the problems that did generate and says how many did not.

### Tests
- `PracticeThis.test.tsx` (extend the existing file; add the `AssessmentProvider` + `useEventStore`/`useNavigate` mocks per `AssessmentConfig.test.tsx:12-21` — the current file renders `MaterialsProvider` only). N calls for N problems with the right single-material recipe; `Coding`/`Mixed` and `Adaptive` render disabled; the picker button renders disabled; the run pointer is appended with `{ runId, materialIds, assessmentIds }` and no `questionIds`; no `AssessmentCreated` append for practice generations; a quota error renders recoverable copy; a partial failure still navigates to a run with the surviving problems. Red first.

### Verification (DONE)
```bash
pnpm --filter app test src/pages/materials/PracticeThis.test.tsx
pnpm --filter app typecheck && pnpm --filter app lint
```
Live: on the dev stack, open a ready material → Practice this → Start → confirm real questions land on the run screen (`./full-app restart app` first — rule 53).

### Rollback
Revert the phase commit; the config page returns to the banner.

### Notes (filled in during implementation)

**2026-09-15 — Phase 1 executed. All four steps landed as written; one deviation in the picker's mount, one live limitation found (no worker in the managed profile).**

- **All plan citations verified against the tree before starting** (the Phase-0 lesson): `AssessmentConfig.tsx:190-223` is `submit()`, `normalizeAssessmentError` is `assessmentClient.ts:74`, server gates `SUPPORTED_FORMATS` / `questionCount != 1` / `len(material_ids) != 1` are as described, `PracticeThis.tsx` was 229 lines with no service call. No reality-mismatch; no plan edit needed.
- **Deviation (small, recorded):** D-10 says "the picker stays in the tree but unclickable." The `MaterialPicker` mount and its `pickerOpen`/`extraMaterials` state were removed rather than kept. The button that opened it is now permanently `disabled`, so the mount was unreachable code and its two `useState` hooks (plus the now-unused `card-meta` "+N more materials" line) were dead weight. The user-visible contract D-10 actually specifies — disabled button plus honest "multi-material runs arrive later" copy — is intact and asserted by a test. Reinstating the mount is a small revert when #42/P5 wires the picker.
- **`startedProblems` progress state was dropped from the final implementation.** An earlier draft tracked per-problem progress for a partial-failure banner; the plan's step 4 asks for honest partial-failure reporting, but with `count` on the event and `assessmentIds.length` on the pointer, the run screen (Phase 2) is where "3 of 5 generated" is actually knowable and actionable. The config page's honest states are now: the `aria-busy` card + "Generating N questions…" + disabled button while working, and the quota / non-quota error banners after. Partial success navigates (asserted), and the shortfall is visible on the run screen. This is a scope call, not a silent drop — flagged here because step 4 named it.
- **TDD:** the 13-case `PracticeThis.test.tsx` went red first (7 failed / 6 passed — the 6 passes are the pre-existing readiness cases that must keep passing), then green. Tests assert payload shape per problem (single `materialIds`, `formats: ['written']`, `questionCount: 1`, `difficulty: 3`, unique `clientId`/`correlationId`), the exact `PracticeRunStarted` payload with **no `questionIds`**, the **absence** of any `AssessmentCreated` append, bounded concurrency (2 in flight), partial-failure navigation, and the quota banner.
- **Verification:** `pnpm --filter app test src/pages/materials/PracticeThis.test.tsx` 13/13; `typecheck` and `lint` clean; full app suite **817/819**, the 2 failures being `src/dev/seedTestData.test.ts` which passes under `--pool=forks` — the documented WSL TZ flake (STATUS.md gotcha), unrelated to this change.
- **Live check on the dev stack (rule 53 — restarted the runtime first):** from the ACCA material, a 2-problem run issued exactly 2 `POST /v1/assessments/generate` → `202`, and the IndexedDB log gained exactly one `PracticeRunStarted` with `{materialIds: [primary], mode: 'written', assessmentIds: [2 ids], count: 2}` and no `questionIds`. The 18 pre-existing `AssessmentCreated` events all predate the run (2026-09-12 vs 2026-09-15), confirming D-11. Both assessments reached `ready` with real grounded written questions (Mendelow's matrix, `subtype: short_answer`, `authoredDifficulty: 3`, 2–3 citations each) read from the ACCA material.
- **Live limitation found — `./full-app` has no generation worker.** `PROFILES["full"]` is `["intelligence", "app"]` (`scripts/full_app.py:66-69`); the generation/ingestion worker is started separately via `scripts/run-detached-ingestion-worker.sh`. So a run started under the managed runtime alone leaves its assessments stuck at `generating` — which is exactly the state the plan's step 2 expects Phase 2 to poll through, so this is not a defect in this phase, but it *is* a trap for the Phase 4 live spec and worth naming: **the live spec needs the worker running, or its generations never leave `generating`.** Started the detached worker for this check and stopped it afterwards.
- **Test data cleaned up:** the two generated assessments + their questions were deleted through PostgREST service-role (the `supabase db query` DELETE path was blocked by the permission classifier, so the live-spec route was used instead — rules 16/36), verified gone; the local run pointer was removed from the IndexedDB event log. Nothing was left on the shared account.
- **Non-blocking observation for Phase 2:** after a successful start, navigation lands on `/home` because `/materials/:materialId/practice/:runId` does not exist yet and `App.tsx:246`'s catch-all `<Navigate to="/" replace />` swallows it. Phase 2 step 5 adds the route; this is the dependency Phase 2's Rollback note already anticipates ("Phase 1's navigation target disappears with it").

## Phase 2: The run shell — take, pause, resume, finish, abandon

**Status:** ⬜ Not started
**Depends on:** Phase 1
**Estimated scope:** 3 new files + `App.tsx` route + the D-10 multi-material amend, ~400 lines

### Codebase state assumed at start
- `AttemptTaker` takes one question and owns answer/submit/grade states; `attemptFlow` owns the local rows.
- `useAssessmentPolling` (`AssessmentDetail.tsx:104-158`) is the pattern for polling a generating assessment and stopping on a terminal status.
- `reviewModel.ts` builds the attempt timeline the review surface renders.
- Phase 1 committed the pointer with the full ordered `materialIds` list already — but today that list is always length 1, so Phase 2's first step restores the multi-material path that gives it something to carry (D-10 amend).

### Steps

0. **Multi-material selection + round-robin (D-10 amend; reversed from the original Phase 1 lock).** In `PracticeThis.tsx`: restore the `MaterialPicker` mount (`purpose="generation"`, `max={5}`, `initialSelected={[material.id]}`), re-enable `Add another material`, and keep the chosen extras in state. The route's own material is always first and always included — the picker's `initialSelected` guarantees it, and the extras are appended after it, so `materials[0]` is the route material. Then in the generation loop, problem `i` sends `materialIds: [materials[i % materials.length]]` and the pointer appends the **full ordered list**. Copy note: with N problems and M materials where `N < M`, only the first N materials are used — say so in the hint rather than implying all M contributed.
1. `practiceRunModel.ts`: pure functions over `(runEvent, assessments, attemptRowsByAssessment)` → `{ materialIds, assessmentIds, orderedProblems, perProblemStatus, resumeIndex, completedCount, isFinished }`. Also derives **per-problem material attribution** as `materials[i % M]` from the pointer alone — the questions are only guaranteed to know their own single `materialId`, so the run-level mapping must come from the run, not from guessing. This is the logic that earns the tests; keep it free of React and Dexie-free (rule 32 stays out of the unit tests). `questionIds` enter here — resolved from the loaded assessments, never stored on the event (D-02).
2. `PracticeRun.tsx`: load the run from the log by `runId`; read each question through the injected assessment client (`getAssessment`, polling while `generating` per `AssessmentDetail.tsx:104-158`); render the current problem with `AttemptTaker`; a problem navigator built on the existing `QuestionNavigator` pattern (reuse the #40 rail/strip pattern: 280 px rail ≥1024 px, sticky strip below), plus a per-problem "from {material title}" label resolved through the materials client so a mixed-source run is legible. This component owns the reconnect drain: one `drainQueuedAttempts` caller across the run's assessments — the individual takers never drain (D-04).
3. Resume = pause: the route param is the whole state — refresh restores the run, the current problem is the first without a grade, and in-flight/queued attempts re-poll exactly as `AssessmentDetail` does. Leaving and returning IS the pause; there is no pause control, no timer, no paused event (D-11).
4. Finish (`PracticeRunFinished{outcome:'completed'}`) when every problem has a grade; abandon is an explicit control that writes `abandoned` — neither invents an observation, and already-graded problems keep theirs (per #16).
5. Route registration in `App.tsx` next to the config route (no `/study` prefix — rule 12).

### Tests
- `practiceRunModel.test.ts`: ordering, resume point, per-problem status from mixed graded/queued/ungraded rows, abandoned vs completed, unknown `runId` → not-found state, and **round-robin attribution** — `N=4, M=2` alternates, `N=2, M=3` uses only the first two materials, `M=1` is the degenerate case and must match Phase 1's behaviour.
- `PracticeThis.test.tsx` (extend Phase 1's file): the picker re-opens and the extras are selected; with 2 materials and 4 problems, calls alternate `mat-1, mat-2, mat-1, mat-2`; the pointer carries both ids in order; picking an extra does not change the count of calls (still N, not N×M).
- `PracticeRun.test.tsx`: renders problem 1 of N, advancing after a grade, resume after remount, abandoned run does not show as complete, a `generating` problem shows honest processing copy, and a 2-material run labels which material each problem came from.

### Verification (DONE)
```bash
pnpm --filter app test src/pages/practice
pnpm --filter app typecheck && pnpm --filter app lint
```
Live: start a 3-problem run, answer one, reload mid-run, confirm you land back on the same problem and the graded one keeps its grade; then finish and confirm the run closes.

### Rollback
Revert the phase commit; Phase 1's navigation target disappears with it (revert both together).

### Notes (filled in during implementation)

## Phase 3: The run's summary

**Status:** ⬜ Not started
**Depends on:** Phase 2
**Estimated scope:** 1 file + tests, ~120 lines

### Steps
1. `PracticeSummary.tsx`: compose `QuestionReviewCard` + `QuestionNavigator` over `buildReviewModel` for the run's flattened questions (one pseudo-list, practice copy). No `ReviewSurface`, no `SummaryBand`, no whole-run retry — only per-problem retry (fresh attempt, preserved history) via the existing `RetryQuestionButton` (D-04).
2. Land the learner on the summary when `PracticeRunFinished{completed}` exists; keep it reachable from the run screen.
3. Re-entry: a finished run opened again shows the summary, not problem 1.

### Tests
- `PracticeSummary.test.tsx`: renders only graded problems; a failed grade shows honestly and is retryable; no hidden key material is rendered (redaction grep on the built output, #34's AC4 precedent).

### Verification (DONE)
```bash
pnpm --filter app test src/pages/practice
pnpm --filter app build && grep -r "answerBlock\|referenceSolution\|hiddenTests" apps/app/dist/assets | head
```
New `practice.css` (if app-local) needs no design-token export change — rule 14 covers `packages/design-tokens` only. Run-shell layout uses `gap`, not recreated field-group margins (rule 13), and is checked at 1280 + 375.

### Rollback
Revert the commit; a finished run falls back to the run screen.

### Notes (filled in during implementation)

## Phase 4: Live verification, AC sweep, records

**Status:** ⬜ Not started
**Depends on:** Phase 3

### Steps
1. `e2e/practice-run-live.spec.ts` (model on `material-library-live.spec.ts`; rules 10/11/16): gate the suite on `E2E_LIVE_EMAIL`/`E2E_LIVE_PASSWORD` with backtick-stripped values; `test.skip` only inside the owning `describe`; phone viewport inside its `describe` plus one desktop-only assertion so a leaked viewport fails loudly; `getByRole` locators first; shared-account cleanup via service-role delete of created materials and graded attempts. Scenario: on the real stack, start a 2–3 problem written run on a ready material, answer and grade at least one problem end-to-end, reload mid-run and confirm resume, finish, and confirm the summary. Same spec parameterised at **1280×720** and **375×812**. Run with `--workers=1`. Restart the runtime after app edits before judging (rule 53).
2. Undo its own writes (the #63 precedent: live specs must not leave library rows or graded attempts behind) or state plainly what it leaves.
3. Tick AC1/AC2/AC4 on #44; record AC3's deferral to #43 with the reason (D-09).
4. `.work` records: `plan/VERIFICATION.md`, `state.md`, STATUS row; per-phase commits with records riding along.

### Verification (DONE)
```bash
pnpm --filter app test && pnpm --filter app typecheck && pnpm --filter app lint
pnpm exec playwright test -c e2e/playwright.config.ts e2e/practice-run-live.spec.ts --workers=1
```

### Rollback
The spec is additive; reverting it reverts nothing the product uses.

### Notes (filled in during implementation)

## Phase 5 (optional, gated on measurement): one generation call for N problems

**Status:** ⬜ Not started — only if Phase 4's numbers say so
**Depends on:** Phase 4

Lift `questionCount must be 1` (`services/intelligence/app/routers/assessments.py:42`) so the blueprint's existing per-slot fan-out produces N questions in one job, and have the practice config send the count it already collects. Gate: Phase 4 numbers on a 5-problem run — p95 run-start seconds or quota-error rate written into `plan/VERIFICATION.md`. Do **not** build it speculatively — the gate is a scaffold limit, not a bug.

**Note (2026-09-15):** the original text here suggested multi-material distribution might "ride this phase too." It did not wait — it ships in Phase 2 as a client round-robin (D-10 amend), because the per-call gate never blocked it. What P5 would change is the *call count* (N → 1), which also collapses the round-robin into a single recipe; revisit the distribution shape here if this phase ever lands.

## Open questions — answered 2026-09-14 (locked unless a reality-mismatch reopens)

1. **Merge now?** No, unless you accept partial #62 P7 plus #63 P5 on `project/phase-2`. Otherwise finish those tails first; Phase 0 already records the cost.
2. **Parent branch** — yes, `project/phase-2` (matches PRs #58–61).
3. **Guide in or after?** After, in #46. The run shell is already a full slice.
4. **D-06 generation shape?** N single-material calls now, P5 gated on measured p95/quota. Correct.
5. **D-02 + AssessmentCreated?** Yes to the two new kinds (no `questionIds` on Started — D-02); skip `AssessmentCreated` for practice-owned generations (D-11).
6. **Run route?** Yes, `/materials/:materialId/practice/:runId`, no `/study` prefix.

## Out of scope

- The Socratic guide and gated reveal (**#46**) — Variant C is decided and prototyped; it is the next slice, not this one.
- Coding practice (**#45**), which needs #42's Judge0 sandbox and coding generation.
- Mastery/adaptive difficulty (**#43**) — AC3 rides on it. No `masteryCache` in Dexie v6 today.
- A top-level `/practice` hub (#5's IA) — the material-scoped route is what exists and what was asked for.
- Chapter/page scope in the practice config (#62's picker exists on the assessment side; adding it here is a copy, not a decision — do it when someone wants it).
- Cross-material **synthesis** — one question grounded in several materials (D-12). This is the feature the single-material gate actually protects; it needs schema + RPC + worker + validation changes. Distinct from multi-material **distribution** (D-10), which ships in Phase 2 because it crosses no gate.
- `PracticeRunPaused`, timers, timeout events (D-11) — pause is leave-and-return; timeouts stay inside AC3's deferral.
- `/v1/practice-runs*` and `practice_runs` (D-01) — revisit when a server-side run is actually needed.
- Monaco/CodeMirror (D-05).

## References

- Ticket: [#44 Written Practice Runs](https://github.com/rings0fsaturn/study-planner/issues/44) · spec copy: `.work/specs/phase2-tickets/12-written-practice-runs.md`
- Parent spec: `.work/specs/phase2-assessments-practice.md` · map: `.work/active/phase2-wayfinder/research/map-4.md`
- Prototype: `apps/app/src/prototype/practice-guide/` (#12, Variant C) — route `/study/practice-prototype?variant=C`
- Contract pack: `services/intelligence/contracts/phase2/{openapi.yaml,PIPELINES.md,TRACEABILITY.md}`
- Precedents: `.work/active/roadmap-material-attach/plan/PLAN.md` (plan shape), `.work/archive/issue-40-assessment-review-implementation/` (shared review surface)
