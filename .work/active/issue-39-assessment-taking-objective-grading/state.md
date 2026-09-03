# State – issue-39-assessment-taking-objective-grading
_Spec: specs/phase2-tickets/07-assessment-taking-objective-grading.md (ticket #39, parent #32, map #4) · Plan: active/issue-39-assessment-taking-objective-grading/plan/ · STATUS row: issue-39-assessment-taking-objective-grading · Status: active · Updated: 2026-09-03_

## Current state & next
- Ticket **Assessment Taking and Objective Grading** (#39) claimed 2026-09-03 (assignee `rings0fsaturn`, verified via gh); branch `phase2/issue-39` created off `origin/project/phase-2` at `f83b8c1` (post-#59 merge) and pushed.
- Task folder opened via work-journal (this folder + STATUS Active row); global wayfinder skill governs the tracker flow; project work-journal-orchestrator governs these records.
- Codebase surface verified first-hand (dispatched inspector died on 524s) → `research/implementation-surface-39.md`; key gap found: no assessment-attempt submission route exists in openapi — the slice amends the contract.
- `plan/PLAN.md` written (7 decisions, 6 phases); `plan/VERIFICATION.md` skeleton with AC tick-down.
- Next: **Phase 1 — contract amendment** (openapi + fixtures + contracts test), then P2 migration 025 + grading arm.

## Done so far
- #34 prototype branch committed (3 commits), PR #59 merged into `project/phase-2` (2026-09-03), #34 closed on GitHub with resolution comment.
- #39 claimed (was unassigned), branch created fresh from the updated parent, task folder + STATUS row opened.

## Flow trace
1. Ticket #39 scope (verified from the issue body): assessment taking for the grounded objective Question — answer online or from the redacted offline cache, record a local attempt, queue offline, receive authoritative normalized grading after connection.
2. Acceptance criteria: AC1 cache holds only envelope + visible payload; AC2 approved per-question event + retry identity semantics; AC3 objective grading returns normalized score + per-skill observations without exposing hidden answers; AC4 offline append, queue, retry, fresh-device restore, account switching, and event order tested.
3. Sole blocker #38 (Single Grounded Objective Assessment) closed 2026-08-23 — unblocked. Its live code: generation + single-objective detail surface (`apps/app/src/pages/assessments/AssessmentDetail.tsx`), contracts mirrored in `apps/app/src/assessments/types.ts`.
4. Downstream consumers: #40 (review — consumes the #34 prototype), #41 (written), #42 (coding), #43 (mastery) all block on this ticket; #44/#48 block on #39+#43.
5. Persistence semantics per map #10 (decision ticket, closed): attempts are per-Question, runId-grouped, `QuestionAttempted`→`QuestionGraded` 1:1 via `attemptId`; retry = fresh observation (new attemptId, never overwrite); grading is server-side only (no answer keys client-side); attempts queue offline, grades land on reconnect.

## Files affected
- `.work/active/issue-39-assessment-taking-objective-grading/` – task folder (plan/, prompts/, research/) – planning home.
- `.work/STATUS.md` – Active row added for this task; phase2-wayfinder frontier line updated.

## Pitfalls & rules
- AC1 is structural: `assessmentContentCache` (if built here) must hold envelope + visible payload only — never `hidden_block` (map #10/#13; same redaction discipline as the #34 grep gate).
- AC2: attempt events follow map #10 exactly — per-question, 1:1 attemptId pairing, retry = new attemptId; do not invent new event kinds beyond what the contract pack defines.
- AC3: grading is authoritative server-side; the client never self-grades, never sees correctIndex/answerBlock; normalized score ∈ [0,1] + perSkill binary correct (≥ τ ≈ 0.6).
- AC4 test matrix is the heavy lift: offline append, queue, retry, fresh-device restore, account switching, event order — mirror the existing Dexie/sync test patterns (rules 30–35) rather than inventing new harnesses.
- WSL runtime quirks (rule 53): restart the managed runtime before browser verification; TZ-sensitive vitest tests need `--pool=forks`.
- Wayfinder: one ticket per session; record the resolution (comment + close + map pointer) only when the ACs are verifiably met.

## Decisions in force
- none yet — planning in progress (2026-09-03)

## Open
- `plan/PLAN.md` not yet written — waiting on the codebase-inspection report (subagent in flight).
- Uncommitted: task folder + STATUS row (commit with the plan).
