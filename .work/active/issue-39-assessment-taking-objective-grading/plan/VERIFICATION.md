# VERIFICATION — issue-39-assessment-taking-objective-grading

Running verification log for #39 (Assessment Taking and Objective Grading). Canonical ticket: GitHub [#39](https://github.com/rings0fsaturn/study-planner/issues/39); runbook: `plan/PLAN.md`.

## Status

| Item | State |
|---|---|
| Ticket #39 claimed (assignee `rings0fsaturn`) | ✅ done 2026-09-03 |
| Branch `phase2/issue-39` off `origin/project/phase-2` @ `f83b8c1` | ✅ done 2026-09-03 |
| Task folder + STATUS row + state.md bootstrap | ✅ done 2026-09-03 |
| Codebase surface verified → `research/implementation-surface-39.md` | ✅ done 2026-09-03 (first-hand; dispatched inspector died on 524s) |
| plan/PLAN.md (7 decisions, 6 phases, TDD seams) | ✅ done 2026-09-03 |
| Phase 1 — contract amendment (openapi + fixtures + contracts test) | ✅ done 2026-09-03 (15/15) |
| Phase 2 — migration 025 + grading domain + worker arm | ✅ done 2026-09-03 (grader 9/9, worker 7/7) |
| Phase 3 — service API routes | ✅ done 2026-09-03 (routes tests green; domain 48/48 incl. contracts) |
| Phase 4 — client data layer (Dexie v6, clients, offline queue) | ✅ done 2026-09-03 (14/14) |
| Phase 5 — taking UI | 🟡 in progress — AttemptTaker wired; UI tests 1/3 (2 timeouts, leads recorded) |
| Phase 6 — verification sweep + live pass + AC tick-down | ☐ not started |
| AC1 cache envelope+visible-payload only (grep gate) | ☐ pending (P6) |
| AC2 per-question event + retry identity semantics | ☐ pending (P4/P6) |
| AC3 normalized score + perSkill, hidden answers never exposed | ☐ pending (P3/P6) |
| AC4 offline/queue/retry/restore/account-switch/event-order tests | ☐ pending (P4/P6) |
| Wayfinder resolution: comment + close #39 + map #4 line | ☐ pending |

## Log

- **2026-09-03** Planning session. #34 branch merged (PR #59) and #34 closed; `phase2/issue-39` created off the updated parent. Ticket #39 claimed on GitHub (verified). Task opened via work-journal + global wayfinder flow (claim → resolve → record). Codebase inspection: dispatched subagent died after ~49 min on upstream 524s; the load-bearing seams were verified first-hand instead and recorded in `research/implementation-surface-39.md` (contract gap: no assessment-attempt submission route exists — AttemptSubmit is practice-run-only; durable QuestionAttempted payload has no answer field; Dexie at version(5); no attempts table; two-arm worker ready for a grading arm). plan/PLAN.md written: 7 decisions (server-owned attempts table, contract amendment, deterministic grading via third arm, Dexie v6 tables, spine-driven event flow, lean honest UI, restore via existing machinery), 6 phases with per-phase verification. Next: Phase 1 (contract amendment).
- **2026-09-03** Phases 1–4 implemented + verified (TDD, tests-first each seam). P1 contract amendment: openapi assessment-attempt routes/schemas + 4 fixtures + 3 contracts tests (15/15). P2: migration 025 (question_attempts + RLS + assessment_grade queue + submit_assessment_attempt/complete_attempt_grading RPCs), app/grading/grader.py (deterministic, 9/9), app/grading/worker.py (third arm, 7/7), repo methods, worker_main three arms. P3: service routes (submit 201/200-replay, list) + UserScopedClient RPC path + 5 route tests; my-domain suite 48/48 (api+grader+worker+contracts). P4: Dexie v6 (assessmentAttempts by clientAttemptId + assessmentContentCache), event constants + schema-exact payloads, AssessmentClient submit/list + transport DI, attemptFlow.ts coordinator; 14/14. Noted 7 pre-existing failures (calibration ×5 + sidecar probe ×2) are unrelated (verified via stash). Phase 5 started: AttemptTaker wired into AssessmentDetail; UI tests 1/3 (2 timeout — db-connection contention + poll budget; leads in state.md). Session ended mid-P5; next session resumes there.
