# Scratchpad – issue-42-coding-assessment-sandbox-grading · session 2026-09-16

_state.md: active/issue-42-coding-assessment-sandbox-grading/state.md · Updated: 2026-09-16T07:40_

## Now / Next

- Doing: P1 landed and verified (contracts 28/28, router 45/45, 031 pushed + live probe green); records + commit in progress
- Next: commit P1 (work + .work records), then P2 (Judge0 compose + grading arm)
- Blocked: none

## Session log

- 00:00 DECIDED rounds 1+2 locked with the user (all-4-subtypes, Judge0 compose Python-only, Pyodide advisory, hybrid gate + LLM reasoning, fail-closed normalization, minimal CodeMirror, silent judge, live-spec gate)
- 00:00 DONE   plan/PLAN.md written (P0–P5, AC map, live-tree context with file:line, D-01…D-11, logging per phase, rollback notes)
- 00:00 DONE   state.md seeded, STATUS row added
- 00:00 NEXT   P0: cut phase2/issue-42-coding-sandbox-grading off refreshed project/phase-2
- 06:15 DECIDED base = merged #44 per user ("merge 44 into phase-2, defer P5"); session scope P0+P1
- 06:20 DONE   PR #65 opened + merged (#44 P1–P4 → project/phase-2 at 3844f72; #44 P5 deferred per user)
- 06:21 DONE   branch cut: phase2/issue-42-coding-sandbox-grading off 3844f72; plan + STATUS row committed (a7f66e2)
- 06:25 FOUND  `_ungradable`/retryable-vs-terminal live in grading/worker.py, not rubric_grader.py (plan text ambiguous); PracticeThis.tsx is pages/materials/ not pages/assessments/
- 06:30 EDIT   031_coding_questions_and_code_signal.sql – new: questions language/starter_code/visible_tests + widened subtype CHECK + grant; RPCs re-created (028 body + coding cols; submit gate IN objective/written/coding); materials has_code/code_languages + server-owned guard extended – verified (dry-run, pushed, live probes)
- 06:35 EDIT   openapi.yaml – CodingAnswer (python-only), VisibleTestCase, TestCaseResult, Question coding fields, QuestionGraded.testCases, AttemptRecord.answer oneOf += coding; drive-by: regenerate path gained IdempotencyKey (pre-existing gap from #44 merge) – verified
- 06:35 FOUND  PyYAML flow-mapping plain scalars truncate at `, ` – descriptions silently corrupt; reworded without comma-space
- 06:35 EDIT   test_contracts.py – 8 new coding tests (28 passed); fixtures coding-question/coding-attempt-record/coding-attempt-submit.json – verified
- 06:40 EDIT   userrest.py QUESTION_PUBLIC_COLUMNS += 3; routers/assessments.py SUPPORTED_FORMATS += coding, _question serializes coding cols, submit stub 400s coding-shaped answers (validation_failed "coding grading lands in P2"); fake client gate widened – verified (45 passed)
- 06:50 FOUND  5 pre-existing failures in test_v1_integration.py (calibration golden-fixture drift, fail on base tree too — progress package, not P1); ruff E501 + format drift pre-existed on 4 touched files; ruff check clean now, formatter left alone (noise)
- 07:00 BLOCKED migration push · stale SUPABASE_ACCESS_TOKEN (401 × 3 probes on api.supabase.com)
- 07:10 UNBLOCKED migration push · user minted fresh sbp_ token; probe 200
- 07:15 DONE   031 pushed (dry-run then real); live probe green: coding row insert (service-role), auth read shows language/starter_code/visible_tests, answer_block 403, has_code guard 403, has_code/code_languages columns present; RPC bodies verified via db query (uuid cast + coding gate); probe rows cleaned (204, cascade verified)
- 07:40 DONE   backend suite 594 passed / 5 failed (all 5 pre-existing calibration)
- 07:40 NEXT   commit P1, then P2: Judge0 compose + judge0_client + coding_grader + worker dispatch
