# Scratchpad – issue-44-written-practice-runs · session 2026-09-15
_state.md: active/issue-44-written-practice-runs/state.md · Updated: 2026-09-15T00:00_

## Now / Next
- Doing: P0 prereq verification (READ-ONLY) — found a plan/parent mismatch, held before any mutation
- Next: get the user's call on which base to cut `phase2/issue-44-written-practice-runs` from, then run P0
- Blocked: P0 merge step — the plan's parent branch cannot satisfy P1's own step ("replace the fake `started` banner")

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
- 00:00 EDIT   .work/active/issue-44-written-practice-runs/SCRATCHPAD.md – seeded with P0 findings – verified
- 00:00 NEXT   surface the base-branch decision; do not run P0 branch operations until it is answered
