# Scratchpad – issue-42-coding-assessment-sandbox-grading · session 2026-09-19
_state.md: active/issue-42-coding-assessment-sandbox-grading/state.md · Updated: 2026-09-19T03:3x_

## Now / Next

- Doing: P4 close-out — code complete, gates green, live pass done, records + commit this session.
- Next: P5 — durable `e2e/coding-assessment-live.spec.ts` (seed rows per `plan/VERIFICATION.md` "P5 notes"), AC sweep (AC4), wayfinder exit.
- Blocked: none.

## Session log

- 03:0x START  P4 remainder: P4a output_prediction taker, P4b hardening, P4c gates, P4d vision pass, P4e records.
- 03:0x DECIDED (user rulings) distinct `output_prediction` UI (read-only snippet + numeric input); full vision pass at 1280 + 375; main-bundle growth is a gate.
- 03:1x EDIT   `OutputPredictionTaker.tsx` + `predictionAnswerProblem`/`submitPredictionAttempt`; `AttemptTaker` third branch with grader `objective` for predictions; `ReviewSurface` snippet + prediction rendering.
- 03:1x FOUND  advisory runner used a `solve(stdin_literal)` harness and verbatim stdout compare while the sandbox runs the whole program with stdin piped and normalized stdout. Rewrote `advisoryRunner.ts` to the sandbox model (`sys.stdin = io.StringIO`, fresh `__main__`, `normalizeOutput`); 5 unit cases incl. the normalization case.
- 03:1x FOUND  `recordGrade` could return `undefined` when Dexie closes mid-poll (unhandled rejection in the full suite; reachable on user switch). `pollGrade` contract now holds via an `EMPTY_ROW` fallback.
- 03:1x EDIT   `basicSetup` (autocompletion/lint) replaced with the explicit D-06 extension list; hidden textarea fallback deleted; `codemirror` meta dropped for `@codemirror/commands` + `@codemirror/language` (pnpm install, symlink layout intact).
- 03:1x GATES  114 focused; full suite 902/904 (2 documented WSL TZ flakes, pass with `--pool=forks`); typecheck/lint/build green.
- 03:1x GATES  bundle measured vs `080d96b` worktree build: main 1,182.59 → 1,188.07 kB (+5.48 kB), CodeMirror 377.05 kB lazy + Pyodide 14.46 kB lazy, main chunk grep-verified free of both; PdfViewer unchanged.
- 03:1x LIVE   seeded `p4-vision-*` material + 3 assessments (service-role PostgREST); real stack (managed runtime + Piston demand-started) desktop coding flow, desktop output_prediction, phone 375 coding flow: 3/3 pass, console clean.
- 03:1x FIXED  vision-pass defects: "Objective assessment" heading for coding (`AssessmentDetail`), `.t-mono-sm` uppercase rewriting code blocks, 420px editor cap, full-width prediction input; evidence in `plan/evidence/`.
- 03:3x CLEAN  seed rows deleted (cascade verified), temp spec + seed script removed, Piston stopped, runtime left running.
- 03:3x RECORDS `plan/VERIFICATION.md` written; `state.md` + `STATUS.md` updated; em/en dashes removed from all P4-added lines.

## Carry-forward

- P5 seed recipe (row shapes, service-role inserts, cleanup) is in `plan/VERIFICATION.md`.
- Playwright CodeMirror typing: `insertText`, never per-key `type()`.
- `./full-app restart full` before any post-edit screenshot (CSS too).
