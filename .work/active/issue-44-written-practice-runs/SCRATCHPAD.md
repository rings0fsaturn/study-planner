# Scratchpad – issue-44-written-practice-runs · session 2026-09-15
_state.md: active/issue-44-written-practice-runs/state.md · Updated: 2026-09-15T03:10_

## Now / Next
- Doing: Phase 2 step 0 COMPLETE 2026-09-15 (commit `a9ce527`) — multi-material round-robin, live-verified with 2 materials / 4 problems
- Next: Phase 2 steps 1–5 — the run shell (`practiceRunModel.ts`, `PracticeRun.tsx`, `App.tsx` route)
- Blocked: none

## Session log
- 00:00 FOUND  62 branch is fully pushed; origin/62 == HEAD == 90d3066; 0 commits ahead. `90d3066`.
- 00:00 FOUND  origin/project/phase-2 = d7408d4, and its tree is IDENTICAL to the #40 wrap tree 6400867 — the PR #61 merge added nothing. No #41 code on the parent.
- 00:00 FOUND  `git merge-base --is-ancestor 62fb1ac origin/project/phase-2` = NO. PR #61 merged `phase2/issue-40-41` at its own 6400867-era tip and did NOT carry the 9 later #41 commits (d111ead…237faf8). So #41 (written assessments) is absent from `project/phase-2`.
- 00:00 FOUND  HEAD is a linear descendant of `origin/phase2/issue-40-41` (merge-base == 237faf8 == its tip, 23 ahead / 0 behind). The #41 code therefore exists ONLY on the 62/63 branch chain.
- 00:00 FOUND  `origin/project/phase-2..HEAD` = 32 commits / 162 files, tallied #62=14, #41=8, #63=6, plus 4 untagged (merge + 2 docs/rules + graphify). The P0 merge is what delivers #41 to the parent — the plan's stated cost omits #41 entirely.
- 00:00 FOUND  `git merge-tree --write-tree origin/project/phase-2 HEAD` == HEAD tree (066ec4d) exactly, exit 0. Merge is conflict-free and a tree no-op for HEAD, so cutting P0's branch off the parent after the merge yields byte-identical content to HEAD.
- 00:00 FOUND  Parent `AttemptTaker.tsx` (243 lines) has NO written support (`isWritten` absent, no textarea); HEAD (285 lines) does. Parent `attemptFlow.ts` has no `writtenAnswerProblem`. Parent `openapi.yaml` has 0 `WrittenAnswer`. Written practice is unbuildable on the parent without the #41 commits.
- 00:00 FOUND  Parent `AssessmentConfig.tsx` is 229 lines, not 399; its `:190-223` is the error-banner JSX, not `submit()`. The plan's `:190-223` citation, `normalizeAssessmentError` at `assessmentClient.ts:74`, and defaults (`Written`/`3`) all describe HEAD. `PracticeThis.tsx` is 229 lines on both and already reads HEAD's `MaterialPicker` record shape (`picked.materialId`), so it does not build on the parent either.
- 00:00 FOUND  `QuestionReviewCard` / `QuestionNavigator` are named exports inside `review/ReviewSurface.tsx` (`:516`, `:259`) — not separate files, and `useAssessmentPolling` is a hook inside `AssessmentDetail.tsx` (`:104-158`). False alarm on my first grep; D-04 is accurate as written.
- 00:00 FOUND  `App.tsx:202` = the practice route and `:172` = the prototype route on HEAD, exactly as the plan cites; parent `:202` is a bare `<Route`. Plan line numbers are HEAD-accurate.
- 00:00 FOUND  Prototype route is `/practice-prototype`, not the `/study/practice-prototype` the plan's TL;DR and References write (rule 12 — no `/study` prefix in router paths).
- 00:00 FOUND  PRs #58–#61 are all MERGED into project/phase-2. There is no open PR for 62/63.
- 00:00 FOUND  #41, #62, #63 all still OPEN with 0 ticked boxes despite the #62/#63 state docs claiming ACs ticked — the GitHub boxes were never set.
- 00:00 FOUND  Untracked leftovers: `.claude/` (`.claude/rules` + `.claude/skills` are symlinks to `../.agents/rules|skills`; only `settings.local.json` is gitignored), `.cursor/`, `graphify-out/`, `e2e/tmp-viewer-timings.spec.ts`, `college/mydeliverables/phase2-review-3/`, `.work/active/document-pipeline/`. A blanket `git add -A` would commit all of it. `.work/active/issue-44-written-practice-runs/` is untracked and must be included.
- 00:00 DECIDED  Held every P0 mutation (no push, no PR, no merge, no branch, no claim, no commit) pending the user's call, because the merge lands #41's completed work and P0 is the plan's explicitly user-owned step.
- 00:00 DECIDED  User chose "Merge 62 as written" — run P0 verbatim, accepting #41-complete + #62 P7-incomplete + #63 P5-incomplete on the integration branch, because #44 is unbuildable without the #41 commits that merge carries.
- 02:14 DONE   P0 step 1: `git push -u origin phase2/issue-62-scoped-question-generation` — no-op, 0 unpushed.
- 02:17 DONE   P0 step 2: PR #64 opened (title/body name #41, #62, #63) and merged as `8f04d0d` with `--merge --delete-branch=false`.
- 02:20 DONE   P0 step 3: stashed the STATUS row, checked out `project/phase-2`, `pull --ff-only` a147f59→8f04d0d (39 commits), cut `phase2/issue-44-written-practice-runs`, popped the stash back. New branch tree `066ec4d` == 62 tip tree — identical, as predicted.
- 02:22 DONE   P0 step 4: `gh issue edit 44 --add-assignee @me` → assignees=rings0fsaturn.
- 02:25 DONE   P0 step 5-6: plan + `state.md` + `SCRATCHPAD.md` + STATUS row committed as `3787684`; only those 4 files staged, the unrelated untracked dirs left alone.
- 02:26 FOUND  Two snags cleared: a stale 0-byte `.git/index.lock` (2026-09-13) blocked the first checkout — removed after `ps` showed no live git process; the uncommitted STATUS row blocked the branch switch — stashed and popped, not committed early.
- 02:27 EDIT   plan/PLAN.md – Phase 0 marked ✅ Complete 2026-09-15, header status bumped, full Notes block added (the #41 finding + both snags) – verified
- 02:28 NEXT   Phase 1 — flip defaults to Written/3, neuter the picker, N single-material generation calls bounded 2, append PracticeRunStarted, navigate
- 02:33 FOUND  Phase-1 "codebase state assumed at start" verified against the tree: `AssessmentConfig.tsx:190-223` IS `submit()`, `normalizeAssessmentError` at `assessmentClient.ts:74`, `PracticeThis.tsx` 229 lines with no service call, server gates `SUPPORTED_FORMATS`/`questionCount != 1`/`len(material_ids) != 1`. No reality-mismatch; plan citations HEAD-accurate.
- 02:34 EDIT   apps/app/src/sync/types.ts – added `PracticeRunStartedPayload` (no questionIds) + `PracticeRunFinishedPayload` – typechecked
- 02:34 EDIT   apps/app/src/events/EventStore.ts – added `PRACTICE_RUN_STARTED` / `PRACTICE_RUN_FINISHED` kind constants – typechecked
- 02:36 TEST   PracticeThis.test.tsx rewritten red-first (13 cases); red run = 7 failed / 6 passed as intended
- 02:39 DONE   PracticeThis.tsx wired to real generation: Written/3 defaults, Coding/Mixed/Adaptive disabled, picker disabled, N single-material calls bounded 2, PracticeRunStarted append, navigate to the run URL. 13/13 green.
- 02:41 DONE   `pnpm --filter app typecheck` clean; `pnpm --filter app lint` clean
- 02:50 VERIFIED Full suite 817/819; the 2 failures are `src/dev/seedTestData.test.ts` and pass under `--pool=forks` — the documented WSL TZ flake, not this change.
- 02:51 DECIDED Kept the disabled `Add another material` button but dropped the unmounted `MaterialPicker` + its `pickerOpen`/`extraMaterials` state (D-10's literal "picker stays in the tree"). The button can never open it, so the mount was unreachable dead code; the user-visible contract (disabled + honest copy) is intact. Flagged in the phase Notes.
- 02:52 NEXT   Live check on the dev stack: Start must issue real generation calls, append the pointer, and navigate
- 05:00 DECIDED User asked what it would take to bring back `Add another material`. Split the ask in two: (A) multi-material *distribution* across a run's problems — no server change, ~30 lines; (B) cross-material *synthesis* (one question grounded in several materials) — needs RPC + schema + worker + validation. User chose A.
- 05:02 FOUND  D-10's original lock misread the server gate: `assessments.py:140` rejects `len(material_ids) != 1` **per call**, not per run, and D-06 already makes an N-problem run N calls. So round-robin crosses no gate. The gate only protects synthesis (now D-12). Conflated the two by a whole feature.
- 05:05 EDIT   plan/PLAN.md – D-10 reversed (original lock preserved in a collapsed <details>), D-12 added for synthesis with the five-layer cost table, architecture + files index + out-of-scope + P5 note + Context line 55 all corrected – verified
- 05:15 TEST   PracticeThis.test.tsx – 4 multi-material cases written red-first (round-robin, pointer carries full ordered list, N<M uses first N, unused-material warning); replaced the obsolete "picker disabled" case. Red: 4 failed / 12 passed.
- 05:30 DONE   PracticeThis.tsx – picker restored (max 5), `runMaterials = [routeMaterial, ...extras]` primary-first, `materials[i % M]` round-robin, pointer carries the full list, unused-material hint. 16/16 green.
- 05:33 DONE   typecheck + lint clean
- 05:40 FOUND  Live picker trap for Phase 4: `MaterialPicker` checkboxes are `className="sr-only"`, so a role/ref click cannot select — drive it via `page.locator('label.checkbox-row', { hasText }).click()`. A live spec copying the assessment-side interaction will silently fail to select.
- 05:41 VERIFIED Live 2 materials x 4 problems: exactly 4 generation calls (not 8), assessments alternating materialId, pointer `materialIds: [primary, second]` ordered, all 4 `ready` as written questions with 2-3 citations from their own source.
- 05:43 VERIFIED Full suite 820/822 (the same 2 seedTestData WSL TZ failures).
- 05:45 DONE   Cleanup: 4 assessments + questions deleted via PostgREST (verified absent), local run pointer removed, worker stopped.
- 05:50 DONE   Committed `a9ce527`; plan Phase 2 marked 🟡 In progress (step 0 done, run shell next).
- 05:52 NEXT   Phase 2 steps 1-5: practiceRunModel.ts (TDD), PracticeRun.tsx, App.tsx route
