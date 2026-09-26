# Verification - jev-integration #77 (slice-4 rubric Score-to-action flag queue)

_Issue [#77](https://github.com/rings0fsaturn/study-planner/issues/77) (map [#69](https://github.com/rings0fsaturn/study-planner/issues/69)) · Verified 2026-09-26 · Plan: `plan/PLAN.md` · Supersedes the #76 section this file previously carried (that record lives in git history at `a62c796` and in `state.md`)._

## Summary

The slice-4 rubric path graduated from the #73 log-only shadow into a server-side review queue.
The cutoff/margin pick was re-run on an enlarged corpus and **the #74 prior holds** (`0.6` / `0.10`), because the train-favoured cutoff loses on the test split - the exact risk #77's register named.
Grades are never touched and nothing rubric-shaped reaches the browser.

## AC ledger

| AC | Verdict | Evidence |
|---|---|---|
| Met-class top-up recorded | PASS (with a recorded substitution) | The ticket's source, "post-09-16 attempts", is **empty**: a service-role probe on 2026-09-26 finds 39 attempts (20 written / 19 objective, one owner) and **none after `2026-09-16T03:29`**; all 20 rubric-bearing attempts are the corpus itself. The plan's fallback fired: 6 answers authored against existing written questions' rubric criteria and submitted through the real `submit_assessment_attempt` path, so each `breakdown` is a **real server `llm_rubric` grade**. 6 rows / 20 new met pairs, 0 errors. Corpus: `plan/evidence/rubric_slice4_rows.json`. |
| 3x3 sweep run offline | PASS | `--replay` re-grids the recorded calls at zero spend. Train 56 pairs (23 met) / test 39 pairs (2 met). Grid in `plan/evidence/jev_sweep_slice4_v1.json`. |
| (cutoff, margin) picked on train, reported on test | PASS (prior retained) | Train favours `0.7`/`0.05` (0.9286 vs `0.6`'s 0.9107), but **test contradicts it**: at 0.7 test agreement falls to 0.9487 and `agree_met` collapses to 0.5, while `0.6` separates the met class perfectly (0.9744, `agree_met` 1.0). Per the plan's risk rule - "a different pick must show better test agreement, not just train agreement" - the prior `0.6`/`0.10` ships. Recorded as `effective` with an explicit `caution` in the sweep output. |
| Calibration report (D-05) | PASS | `plan/evidence/jev_calibration_report_v1.{json,md}`: per-split summaries at the pick, the full 3x3 grid per split, and every flagged criterion with its reason, Jev score, server `met` and answer excerpt (7 flagged). |
| Mapping + queue tests pass | PASS | 20 slice-4 tests in `tests/test_jev_slice4_flags.py` (mapping, band edges, any-flag aggregation, malformed-pair fail-open, locked declaration, worker wiring, excerpt, insert fail-open). |
| Full backend shows no new failures | PASS | See the counts below; failure set is the same pre-existing set. |
| ruff clean | PASS | `uv run ruff check .` -> "All checks passed!"; the 9 touched files are `ruff format` clean. |
| Migration 033 pushed | PASS | `db push --dry-run` listed only `033_jev_review_flags.sql`; the push applied it. Live column and policy checks below. |
| RLS verified owner-scoped | PASS | Service-role write/read/delete round-trip works; owner sees the row, a different user sees 0. Details below. |
| `rubricAgreementMin` / `rubricMalformedMax` gates fail-closed | PASS | Gates read the committed report (`rubric_evidence`), which returns live values (agreement 0.9744 >= 0.9, malformed 0.0 <= 0.02). Missing report / null values breach, proven by `test_rubric_gates_breach_on_low_agreement_and_high_malformed`. |
| Live flag-on check | PASS | See "Live run". |
| Zero rows / zero log change with the flag off | PASS | `test_flags_off_makes_zero_jev_calls_and_writes_nothing` (zero decide calls, zero inserts, grade still `graded`). |

## Phase A: the met-class top-up

| Step | Result |
|---|---|
| Live-attempt probe | 39 attempts, 1 owner, 0 after `2026-09-16`; the top-up source the ticket named does not exist |
| Authored answers submitted | 6 rows (`0e61c0c8`, `3379ec6b`, `255cd429`, `3d250ddd`, `1cd46c52`, `51ca4b39`), one batched `decide()`-free server grade each |
| Met pairs | 20 of 20 criteria met (the authored answers are deliberately strong) |
| Spend | Jev recording for the whole merged corpus: $0.000794, 0 errors |
| Rule 80 | `--limit 2` dry run before both the top-up and the sweep |

**Honest limits of this evidence.** The 20 new met pairs are *authored*, so they are easier than real learner answers and they all sit on **train** by construction - which is why the test split's met class stayed at 2 pairs and why the test column is the only one that could falsify the pick. It did. The top-up therefore did exactly the job the ticket needed (a thicker train met class to sweep against) without letting synthetic rows decide the shipped cutoff.

## Phase A: the sweep

| Split | rows | pairs | met pairs |
|---|---|---|---|
| train | 16 | 56 | 23 |
| test | 10 | 39 | 2 |

| cutoff | train agreement | test agreement | test agree_met |
|---|---|---|---|
| 0.5 | 0.8750 | 0.8718 | 1.0 |
| 0.6 | 0.9107 | **0.9744** | **1.0** |
| 0.7 | **0.9286** | 0.9487 | 0.5 |

Train alone would ship `0.7`; the test split says the prior `0.6` is the honest reading, and the `agree_met` collapse at 0.7 (1.0 -> 0.5) is the sharper signal - at 0.7 the queue would disagree with the server on the very class the band exists to protect.

## Live run

Two defects were found **only** by running this live, and both are the reason the plan puts the live check last.

### Defect 1: a lazy import outside the fail-open guard wedged grading

The first live flag-on attempt raised `ImportError` from `_queue_jev_flags`.
The `from app.jev.measure import map_scores` sat **outside** the `try`, so the exception escaped `_grade_written`, propagated to `run_once`'s generic handler, and left the attempt `queued` with **no grade at all** - a direct violation of the contract "the grade is never modified".

The trigger was self-inflicted (my own `git stash` experiment reverted `measure.py` under the still-running worker, and a lazy import re-reads disk at call time), but the defect is real and reachable by any import-time fault.
Fixed by moving every import inside its guard; two regression tests added (`test_insert_fault_never_reaches_the_composed_grade`, `test_missing_flag_insert_method_fails_open`).

### Defect 2: every insert answered 400 on the NOT NULL primary key

With the guard fixed, insertion still failed silently as `provider_unavailable` - the fail-open swallowed a **400/23502**.
Cause: the row never carried `id`, and the table's TEXT primary key is NOT NULL.
Reproduced directly against PostgREST: `WITHOUT id -> 400 null value in column "id"`, `WITH id -> 201`.
Fixed by minting `id` client-side (the codebase convention: every TEXT-id table here is filled by the service); a test now asserts the row carries an id.

This one is the stronger argument for the live check: the unit suite was fully green, the table was correct, and RLS was proven - yet the queue would have stayed **empty forever** in production.

### Results after both fixes

| Step | Result |
|---|---|
| Flag state | `JEV_SLICE4_FLAGS=true` in the gitignored `services/intelligence/.env` (backup taken **outside** the repo), verified in the live worker's `/proc/<pid>/environ` alongside `JEV_SLICE1_ENABLED` and `JEV_SLICE2_ENFORCE` |
| Flag-on grade | A real written attempt graded `llm_rubric`, `score 0.84`, breakdown `[True, True, False]` - **no wedge** |
| Flag-on queue write | Resubmitting a corpus answer known to be flagged produced exactly **1 row** (`review_band`, `jev_score 0.55`, `server_met False`, 216-char excerpt) |
| Log join | `./full-app logs intelligence --grep` style join on the correlation id returns the whole trail: `jev.client` decide -> `jev ok` -> `grading.worker` shadow pairs -> `jev flag queue queued=1/3`, all under `trace_id=jev-slice4-flagproof-16cd2626` |
| Flag-off parity | Same answer with the flag off: **0 rows**, and the flag-queue log-line count is **unchanged (2 -> 2)** - zero log change |
| Migration live check | `033` applied; `rowsecurity = true` on `pg_tables`; both policies carry `auth.uid() = owner` on the read predicate |
| Service-role write/read | `POST` 201, `SELECT` 200 with the row, `DELETE` 204, re-`SELECT` `[]` |
| Owner vs other-user read | In SQL with `set local role authenticated` + JWT claims: the owner's `sub` sees **1**, a different `sub` sees **0** |
| Authenticated anon-key read | `200 []` - RLS filters it; the table carries Supabase's default grants (`anon`/`authenticated` hold full table privileges exactly as `assessments`/`question_attempts` do), so **RLS is the sole gate**, not the GRANT list. The migration comment states this explicitly |
| Probe hygiene | All probe flag rows and probe attempts deleted; `jev_review_flags` row count **0**, attempts back to the 45 pre-session rows |

### A self-inflicted detour worth recording

After the fixes, `./full-app status` reported `health=unhealthy` and a stale pid, and starts appeared to fail with `ELIFECYCLE Command failed`.
The service was in fact **healthy the whole time** (`curl /health` -> `{"status":"ok"}`); the reports were a stale state file.
The `Address already in use` error came from my own foreground diagnostic run, which could not bind the port the healthy service already held - I created the error I then chased, and only caught it by reading the health endpoint instead of trusting `status`.
Lesson: check `/health` before concluding a managed service is down.

## Offline verification (run 2026-09-26)

| Check | Command | Result |
|---|---|---|
| Slice-4 suites | `uv run pytest tests/test_jev_slice4_flags.py tests/test_jev_slice4_sweep.py -q` | **29 passed** |
| Jev-adjacent suites | `uv run pytest` over the 11 jev/grading/eval files | **134 passed** |
| Full backend | `uv run pytest -q` | **7 failed / 838 passed**; the 7 are the pre-existing set (5 order-dependent `v1_integration` goldens + 2 `test_retrieval_probe` import failures), unchanged from the stashed-tree baseline |
| Lint | `uv run ruff check .` | "All checks passed!" |
| Format | `uv run ruff format --check` on the 9 touched files | clean |
| Gates read live values | `python -c "eh.rubric_evidence(eh.load_golds())"` | `{'agreement': 0.9743589743589743, 'malformed_rate': 0.0, 'cutoff': 0.6, 'margin': 0.1, ...}` |

### The 18-vs-7 failure count (recorded so it is not re-diagnosed)

The same tree reports **18 failed / 825 passed** in one run and **7 failed / 838 passed** in another.
The cause is `pytest-randomly`, not the change: under some orderings the `v1_integration` golden fixtures re-seed shared state and fail as a block.
Both counts contain the identical pre-existing failure set; the pass count differs by exactly the cascaded goldens.
`state.md` has recorded "the same 18 pre-existing failures" since #75, which is one of those orderings.

## Design decisions that differ from the plan's first reading

| Plan text | What shipped | Why |
|---|---|---|
| "count post-09-16 attempts ... if live attempts cannot supply them, author met-bearing answers" | Authored answers **submitted through the production path**, not hand-written rows | Weaker evidence would have been a hand-authored `breakdown`; submitting on the real path makes every row a real server grade, which is the strongest reading of "the same way `rubric_rows.json` rows were authored" |
| "insert one row per flagged criterion through a new repo method (`insert_jev_flag` or one bare-array bulk `_post`)" | `insert_jev_flags(rows)` - the bulk form | One insert per attempt instead of N; the unique index `(attempt_id, criterion)` makes a redelivered message idempotent |
| Files table lists only `jev_sweep_slice4.py` as CREATE | Also committed `jev_slice4_topup.py` | User decision: the corpus is otherwise not reproducible. Matches the slice-1/slice-2 precedent that every sweep runner is durable |
| "RUBRIC_THRESHOLDS = {cutoff: <picked>, margin: <picked>}" | Declared, then **kept at the prior after the sweep** | The sweep's own caution fired; shipping 0.7 would have contradicted the test split |

## Acceptance

- [x] Met-class top-up recorded (20 new met pairs, real server grades); 3x3 sweep run offline; pick reported (prior retained, with the caution recorded).
- [x] Calibration report (D-05) committed under `plan/evidence/`.
- [x] Mapping + queue tests pass; full backend shows no new failures; ruff clean.
- [x] Migration 033 pushed; RLS verified owner-scoped (service-role write works, cross-owner read returns nothing).
- [x] `rubricAgreementMin` / `rubricMalformedMax` gates fail-closed in the harness.
- [x] Live flag-on check: flag verified in the worker env, RLS proven live, zero rows with the flag off, probe rows cleaned.
- [x] Evidence, `VERIFICATION.md`, `state.md`, and the STATUS row updated in the same session.

## Open items handed off

- **The queue has no reader.** Nothing lists `jev_review_flags`, by design (D-01: no route, no browser exposure). A reviewer reads through the service role. Building that surface is a follow-up, not part of #77.
- **Test met class is still 2 pairs.** The authored top-up went to train on purpose, so the *test* column remains thin. More real met-bearing written attempts are the only honest way to thicken it.
- **#78 / #79** remain open (retrieval insertion point; reranked-754 baseline).
