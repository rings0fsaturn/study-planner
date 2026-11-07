# Session prompt — Chapter 6 screenshot capture + wiring (generated 2026-10-22 via prompt-optimizer)

Capture running-app screenshots evidencing Ch6 Results and Discussion (6.1-6.4, one surface per claim) and wire them into `chapters/06-results.tex`.

First read, in order:
- `.work/active/phase2-report/AGENTS.md` (task-local protocol, build recipe, gotchas; note the front-matter and never-build-in-place rules added 2026-10-22)
- `.work/STATUS.md` (find the phase2-report row)
- `.work/active/phase2-report/state.md` (single live Next at the top)
- `.work/active/phase2-report/plan/GRILL.md` (Q1-Q37 + G1 all RESOLVED; never re-open them; numbering continues at Q38)
- `.work/active/phase2-report/plan/CHAPTERS.md` (pinned 6.1-6.5 split)
- `.work/active/phase2-report/SCRATCHPAD.md` (running log)
- `college/mydeliverables/Phase-2-report/phase2-report/chapters/06-results.tex` (draft anchors if drafted; if not, the screenshots ground the grill)
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/06-results.tex` (results prose plus float habits only, read-only source)
- Existing `college/mydeliverables/Phase-2-report/phase2-report/screenshots/` PNGs (Ch5 surfaces; never reuse them as Ch6 evidence)
- Rules `10-runtime-and-e2e`, `15-playwright-cli`, `16-live-e2e-authoring` (managed runtime with health checks, `playwright-cli` with `LD_LIBRARY_PATH` plus `--browser=chromium`, ready-state waits, viewport scoping, shared-account cleanup)
- Test credentials in `.work/specs/test-login-cred.txt` (CRLF-safe extraction into env vars, never print values, never commit them)

Grill first following the task protocol: exactly one question at a time, each with your recommendation and why, waiting for the answer.
Record every question and answer in `plan/GRILL.md` (Q38 onward), plus `state.md` and `SCRATCHPAD.md`, as you go.
Likely grill territory (do not batch; ask one at a time): which live surface evidences each of 6.1-6.4; figures versus tables for the metric comparisons; whether 6.4 synthetic-longitudinal plots are generated artifacts wired as figures rather than app screenshots.
Candidate screens (verify against live `apps/app/src/App.tsx` routes before recommending): 6.1 generation output (assessment review with server grade visible, hidden tests and reference solutions never on screen); 6.2 live verification (graded review plus practice-run summary); 6.3 closed-loop verdict (roadmap evidence ledger plus replan); 6.4 whatever surface renders the synthetic validation, or a generated plot if no surface does.

Capture with `./full-app start full` and the rule-10 health checks (service, app, sidecar `:8200`, Piston `:2000`).
Restart the runtime after any source edit before capturing (rule 53 stale Vite on `/mnt/d`).
Sign in with the shared dev account, capture, then delete created materials so the account stays clean for the next run.
Save PNGs to `college/mydeliverables/Phase-2-report/phase2-report/screenshots/` alongside the Ch5 shots.
Wire each screenshot with the Phase-1 include shape (`\includegraphics[width=0.85\linewidth, height=0.42\textheight, keepaspectratio]{screenshots/...}`), keeping captions, labels, and bibliography verbatim per G1.
Body prose changes need grill clearance; any screenshot sentence is new prose.

Build in `/tmp` only (copy the screenshots along; never build in the repo dir, 2026-10-22 lesson), gate on 0 errors and 0 undefined, rasterize-check each new figure with `pdftoppm` plus Read, refresh the beside-`main.tex` review PDF, update the STATUS row.

Do not:
- Re-open settled questions (Q1-Q37 + G1)
- Batch multiple grill questions in one message
- Print secrets or commit credentials, screenshots of credentials, or tokens
- Reuse Phase-1 or Ch5 screenshots as Ch6 evidence
- Touch the cover or certificate front matter (settled 2026-10-22)
- Edit files under `college/` beyond `phase2-report/screenshots/`, `chapters/06-results.tex`, Appendix Ch6 tables and figures, and bibliography appends until asked
- Commit (no commit requested)
