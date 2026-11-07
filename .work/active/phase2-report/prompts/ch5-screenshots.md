# Session prompt — Chapter 5 screenshot capture + wiring (generated 2026-10-20 via prompt-optimizer)

Capture running-app screenshots for 5.5 (one surface per 5.5.1-5.5.5) and wire them into `chapters/05-implementation.tex`.

First read, in order:
- `.work/active/phase2-report/AGENTS.md` (task-local protocol, build recipe, gotchas; note the anchor, workdir, log-gate, and pdftoppm rules added 2026-10-20)
- `.work/STATUS.md` (find the phase2-report row)
- `.work/active/phase2-report/state.md` (single live Next at the top)
- `.work/active/phase2-report/plan/GRILL.md` (Q1-Q31 + G1 all RESOLVED; never re-open them; numbering continues at Q32)
- `.work/active/phase2-report/plan/CHAPTERS.md` (pinned 5.1-5.5 split)
- `.work/active/phase2-report/SCRATCHPAD.md` (running log, including the flow-figure decision)
- `college/mydeliverables/Phase-2-report/phase2-report/chapters/05-implementation.tex` (the five `fig:appflow1-5` anchors, captions, and ref sentences the screenshots join)
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/05-implementation.tex` (screenshot wiring shape only: `\includegraphics[width=0.85\linewidth, height=0.42\textheight, keepaspectratio]{screenshots/...}`)
- Rules `10-runtime-and-e2e`, `15-playwright-cli`, `16-live-e2e-authoring` (managed runtime with health checks, `playwright-cli` with `LD_LIBRARY_PATH` plus `--browser=chromium`, ready-state waits, viewport scoping, shared-account cleanup)
- Test credentials in `.work/specs/test-login-cred.txt` (CRLF-safe extraction into env vars, never print values, never commit them)

Grill first following the task protocol: exactly one question at a time, each with your recommendation and why, waiting for the answer.
Record every question and answer in `plan/GRILL.md` (Q32 onward), plus `state.md` and `SCRATCHPAD.md`, as you go.
Likely grill territory (do not batch; ask one at a time): keep the flow figures alongside the screenshots or replace them; desktop width only or desktop plus a phone viewport; the exact screen per subsection.
Candidate screens (verify against live `apps/app/src/App.tsx` routes before recommending): 5.5.1 library (`/materials`, ready cards); 5.5.2 assessment config (`/materials/:materialId/assessments/new`) or library (`/assessments`); 5.5.3 graded review (`/assessments/:assessmentId`); 5.5.4 practice hub (`/practice`) with the coach popover open; 5.5.5 roadmap evidence ledger plus replan.

Capture with `./full-app start full` and the rule-10 health checks (service, app, sidecar `:8200`, Piston `:2000`).
Restart the runtime after any source edit before capturing (rule 53 stale Vite on `/mnt/d`).
Sign in with the shared dev account, capture, then delete created materials so the account stays clean for the next run.
Save PNGs to `college/mydeliverables/Phase-2-report/phase2-report/screenshots/` (new tracked dir).
Wire each screenshot with the Phase-1 include shape beside its flow figure (or in place of it, per the grill), keeping captions, labels, and bibliography verbatim per G1.
Body prose changes need grill clearance; the ref sentences already point at the flow figures, so any screenshot sentence is new prose.

Build in `/tmp` only (copy the screenshots along), gate on 0 errors and 0 undefined, rasterize-check each new figure with `pdftoppm` plus Read, refresh the beside-`main.tex` review PDF, update the STATUS row.

Do not:
- Re-open settled questions (Q1-Q31 + G1)
- Batch multiple grill questions in one message
- Print secrets or commit credentials, screenshots of credentials, or tokens
- Reuse Phase-1 screenshots (they show the Phase-1 UI, not the Phase-2 surfaces)
- Edit files under `college/` beyond `phase2-report/screenshots/`, `chapters/05-implementation.tex`, and bibliography appends until asked
- Commit (no commit requested)
