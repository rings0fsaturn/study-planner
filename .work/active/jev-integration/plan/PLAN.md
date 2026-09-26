# Jev slice-4 graduation: rubric Score-to-action flag queue (Phase B)

_Written: 2026-09-26 · Status: Not started · Issue: [#77](https://github.com/rings0fsaturn/study-planner/issues/77) · Map: [#69](https://github.com/rings0fsaturn/study-planner/issues/69) · Parent task: `.work/active/jev-integration/state.md` · Verification: `plan/VERIFICATION.md`_

## How to use this plan (read this first, agent)

This is an implementation plan, not a spec. Read the whole preamble before touching code.

1. **Read the decisions first.** D-01..D-05 are load-bearing and were confirmed with the user on 2026-09-26.
2. **Work one phase at a time.** A phase is done only when its own verification commands pass.
3. **Update the status marker in place** (`Not started` / `In progress` / `Blocked` / `Complete - <sha>`) as you go.
4. **Rules that apply to every phase:** 17 (trace_id on every new log line), 42 (server grade authoritative, failed terminal, nothing rubric-shaped reaches the browser), 35/36 (migration + RLS, `db push` before live verification), 80 (`--limit 2` dry run before any paid run; key-level $0.5 cap).
5. **Ponytail governs the diff.** Reuse `app/jev/measure.py::summarize_measurement`, the repo `_post` REST pattern, and the `jev_sweep_slice2.py` runner shape. The only new schema is the one table D-01 decides; no endpoint, no UI, no client change.
6. **The live stack is the source of truth.** Re-read `app/grading/worker.py` around `_jev_shadow_rubric` and `app/ingestion/repository.py` before editing; line numbers drift.

## TL;DR

#74 measured the rubric shadow (test agreement 0.974 @ cutoff 0.6, 39 test pairs, 0 malformed, p95 2.4 s) and every graduation bar is already PASS.
#77 locks the Score-to-action mapping and builds the disagreement-flag queue: a server-side, owner-scoped table the grading worker writes behind its own flag.
Grades are never auto-touched, and nothing rubric-shaped reaches the browser (rule 42).
The one measurement gap is the met class: the 75-pair corpus holds **met=5 / notmet=70**, so the top-up clause in the ticket fires before the cutoff/margin sweep is trusted.

## Evidence this builds on (do not re-measure)

| Ticket ask | Verdict | Source |
|---|---|---|
| #74 agreement | Test 0.974 @ 0.6 cutoff, train 0.90; 39 test pairs; 0 malformed; p95 2.4 s; autopsy 5/5; dashboard drift -1.9%; $0.042/Mtok | `evidence/rubric_rows.json`, `evidence/jev_measure_{train,test}.json` |
| #74 summarizer | `summarize_measurement(pairs, cutoff, margin)` already returns agreement, `n_review` band count, malformed rate, latency percentiles. The offline grid is free - Jev scores are already recorded. | `app/jev/measure.py` |
| Corpus reality | 20 rows / 75 criterion pairs / **met=5, notmet=70**. The met class is thin: the ticket's "topped up from post-09-16 attempts" clause fires. | `evidence/rubric_rows.json` (counted 2026-09-26) |
| Shadow hook | `_jev_shadow_rubric` (grading worker) runs one batched `decide()` after the grade composes, fails open, logs `jev_pairs` with `trace_id`. Today it is gated only by `JEV_SLICE1_ENABLED` read as `jev_shadow_enabled`. | `app/grading/worker.py` |
| Worker write path | The worker persists through the REST repo (`_post` into `rest/v1/<table>` with service headers); bulk inserts need a bare JSON array body (rule 36). | `app/ingestion/repository.py` |
| Migration slot | Next migration number is 033. | `apps/app/supabase/migrations/` |

## Decisions in force

| Id | Decision | Why |
|---|---|---|
| D-01 | **The flag queue is a server-side table** (`jev_review_flags`), owner-scoped, written by the grading worker behind `JEV_SLICE4_FLAGS` (default false). No API route, no browser exposure. One row per flagged question-criterion pair: criterion, Jev score, server `met`, truncated answer excerpt, `correlation_id`, `created_at`. | Answer excerpts in logs would be a redaction regression and logs are not a durable queue; a table keeps everything server-side and reviewable. Rule 42 is preserved by construction: nothing reads the table from the app. |
| D-02 | **Any-flag aggregation.** A criterion flags when the Jev verdict (`score >= cutoff`) disagrees with the server `met` OR the score sits inside the review band (`abs(score - cutoff) <= margin`). One flagged criterion queues the question. | Review is cheap and human; a single confident disagreement on a load-bearing criterion is exactly what a reviewer wants to see. The queue is advisory - grades are never touched. |
| D-03 | **Cutoff/margin sweep: cutoffs 0.5 / 0.6 / 0.7 x margins 0.05 / 0.10 / 0.15**, picked on train, reported on test, run offline over recorded scores (zero spend) after the met-class top-up. Train/test split stays by-question with no overlap, matching `rubric_rows.json`. | The recorded scores make the grid free; the top-up is the only paid measurement (post-09-16 written attempts). #74's 0.6 pick is the prior but the thin met class means it is re-picked, not rubber-stamped. |
| D-04 | **Two new fail-closed eval-harness gates block rollout:** `rubricAgreementMin` (test-split agreement at the picked cutoff) and `rubricMalformedMax`, declared in `eval_golds.json` thresholds and enforced by `evaluate_gates`. Existing families untouched - this is the grading path, not generation. | The harness is the rollout gate of record; without named gates the sweep evidence gates nothing. Fail-closed matches the existing families. |
| D-05 | **The offline calibration report is confirmed** as the #73 shadow's first consumer: one MD + JSON artifact under `plan/evidence/` with per-split agreement per cutoff-x-margin cell, band counts, and flagged pairs with answer excerpts and per-criterion verdicts. | It doubles as the human-review intake for calibration-corpus disagreements, and it is the durable record the gates read from. |

## Phases

### A - met-class top-up + cutoff/margin sweep (c)

_Status: Not started_

1. Count post-09-16 written attempts that carry a `rubricBreakdown` (service-role probe or repo query) and collect the met-bearing ones first. Target: at least 15 met pairs total (5 existing + top-up) before the pick is trusted; if live attempts cannot supply them, author met-bearing answers against existing written questions the same way `rubric_rows.json` rows were authored.
2. Extend the corpus: append top-up rows to a new `evidence/rubric_slice4_rows.json` (same row shape as `rubric_rows.json`: `answer`, `criteria`, `breakdown` with `score`/`met`, `split`), split by-question train/test with no overlap and disjoint from the existing test questions.
3. Record Jev scores for the top-up rows with the existing `scripts/jev_measure.py` runner (`--limit 2` dry run first, rule 80; spend stays inside the key-level $0.5 cap).
4. Commit `scripts/jev_sweep_slice4.py` in the `jev_sweep_slice2.py` shape: loads the merged corpus, reruns the 3x3 `RUBRIC_GRID` offline through `summarize_measurement` (zero spend), emits per-split summaries per cell and a train-pick/test-report recommendation.
5. Run the sweep, pick (cutoff, margin) on train, report on test. Record the pick as `RUBRIC_THRESHOLDS` values for Phase B.
6. Emit the D-05 calibration report (MD + JSON) from the same runner output; commit both under `plan/evidence/`.
7. Post the sweep + pick to #77.

### B - mapping + flag queue (TDD)

_Status: Not started_

1. **RED** `tests/test_jev_slice4_flags.py`: pure mapping tests - disagreement flag, review-band flag, no flag on confident agreement, any-flag aggregation across criteria, malformed pair never flags (fail-open), locked `RUBRIC_THRESHOLDS` declaration test.
2. **GREEN** `app/jev/questions.py`: declare `RUBRIC_THRESHOLDS = {"cutoff": <picked>, "margin": <picked>}` beside the existing threshold declarations (the #75 `SUITABILITY_ENFORCE_FAMILIES` / #76 `PASSAGE_ENFORCE_VERDICTS` precedent: one declaration, data-driven test).
3. **GREEN** `app/jev/measure.py`: add the pure mapping beside `summarize_measurement` (per-criterion verdict + any-flag aggregate; no I/O).
4. **GREEN** migration `033_jev_review_flags.sql`: table `jev_review_flags` (id, owner, assessment_id, question_id, attempt_id, criterion, jev_score, server_met, answer_excerpt, correlation_id, created_at), RLS enabled with `auth.uid() = owner` on both predicates (rule 35), owner+created_at index. Push with the rule 36 `db push` workflow.
5. **GREEN** `app/grading/worker.py`: config gains `jev_flags_enabled`; `_jev_shadow_rubric` runs when shadow OR flags is on; when flags are on, compute the mapping, and on any-flag insert one row per flagged criterion through a new repo method (`insert_jev_flag` or one bare-array bulk `_post`, rule 36). Every failure fails open with a `trace_id` log line; the answer text never reaches the log; the grade is never modified.
6. **GREEN** `app/ingestion/repository.py` (or the grading repo protocol): the insert method, same `_post` REST shape as `insert_question`.
7. **GREEN** `app/worker_main.py` + `.env.example`: read `JEV_SLICE4_FLAGS` (default false); build the Jev clients when any Jev flag is on.
8. **GREEN** `eval_golds.json` + `scripts/eval_harness.py::evaluate_gates`: add the D-04 rubric gates, fail-closed, one entry per breached gate.

### C - verification, review, close-out

_Status: Not started_

1. `/ecc:verification-loop`: targeted pytest (slice-4 + jev-adjacent suites), full backend against the 18-failure pre-existing baseline, ruff check + format.
2. `/ecc:code-review`.
3. Live flag-on check on the managed runtime: grade a real written attempt with `JEV_SLICE4_FLAGS=true`, confirm the queue rows (service-role select), confirm the grade is byte-identical to the flag-off grade, join by `correlation_id` via `./full-app logs intelligence --grep`, and confirm zero rows/zero log change with the flag off.
4. Shared-account hygiene: clean leftover test assessments before the live check (service-role delete, per the state.md pitfalls).
5. `plan/VERIFICATION.md`, scratchpad, `state.md`, STATUS row, ticket post; leave the local flag default documented as `false` in `.env.example`.

## Files

| File | Action | Why |
|---|---|---|
| `services/intelligence/app/jev/questions.py` | UPDATE | Declare `RUBRIC_THRESHOLDS` |
| `services/intelligence/app/jev/measure.py` | UPDATE | Pure Score-to-action mapping beside the summarizer |
| `services/intelligence/scripts/jev_sweep_slice4.py` | CREATE | Budget-guarded top-up runner + offline 3x3 grid + report emitter |
| `services/intelligence/app/grading/worker.py` | UPDATE | `jev_flags_enabled`, mapping call, queue insert, fail-open logging |
| `services/intelligence/app/ingestion/repository.py` | UPDATE | `insert_jev_flag(s)` REST method |
| `services/intelligence/app/worker_main.py` | UPDATE | Read `JEV_SLICE4_FLAGS`; build clients on any Jev flag |
| `services/intelligence/.env.example` | UPDATE | Document the flag (default false) |
| `services/intelligence/eval_golds.json` | UPDATE | `rubricAgreementMin` / `rubricMalformedMax` thresholds |
| `services/intelligence/scripts/eval_harness.py` | UPDATE | Evaluate the two new gates |
| `apps/app/supabase/migrations/033_jev_review_flags.sql` | CREATE | Queue table + RLS |
| `services/intelligence/tests/test_jev_slice4_flags.py` | CREATE | Mapping, aggregation, fail-open, locked-declaration tests |
| `.work/active/jev-integration/plan/evidence/rubric_slice4_rows.json` | CREATE | Top-up corpus rows |
| `.work/active/jev-integration/plan/evidence/jev_sweep_slice4_v1.json` | CREATE | Grid + split summaries + pick |
| `.work/active/jev-integration/plan/evidence/jev_calibration_report_v1.{json,md}` | CREATE | D-05 calibration report |

## Validation

```bash
# Phase A dry run first (rule 80), then the full top-up + grid
uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice4.py \
  --rows .work/active/jev-integration/plan/evidence/rubric_slice4_rows.json --limit 2

# from services/intelligence
uv run pytest tests/test_jev_slice4_flags.py tests/test_jev_measure.py \
  tests/test_jev.py tests/test_generation_jev_slice1.py -q
uv run pytest -q          # expect the same 18 pre-existing failures
uv run ruff check . && uv run ruff format --check .

# migration (rule 36, from apps/app/)
npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Met class stays thin even after top-up (few real met answers exist post-09-16) | Medium | Author met-bearing answers against existing questions as the fallback; report the met-class n honestly in the pick and never claim separation the n cannot support |
| Picked cutoff regresses against #74's 0.6 on the enlarged corpus | Low | 0.6 is the prior; a different pick must show better test agreement, not just train agreement |
| Queue insert failure breaks grading | Low | Fail-open: the insert is best-effort after the grade composes, wrapped exactly like the shadow hook, `trace_id` on the log line |
| Answer excerpts leak through logs | Low | Excerpts go only into the table column, truncated; the log line carries counts and ids only |
| Migration push flakiness (pooler dump + egress) | Medium | Rule 36: give the push minutes, read `--debug` before assuming failure, confirm via `supabase_migrations.schema_migrations` |
| Live run collides with shared-account leftovers | High | Clean before the live check (known open item in `state.md`) |

## Acceptance

- [ ] Met-class top-up recorded; 3x3 sweep run offline; (cutoff, margin) picked on train, reported on test; posted to #77.
- [ ] Calibration report (D-05) committed under `plan/evidence/`.
- [ ] Mapping + queue tests pass; full backend shows no new failures; ruff clean.
- [ ] Migration 033 pushed; RLS verified owner-scoped (service-role write works, authenticated cross-owner read returns nothing).
- [ ] `rubricAgreementMin` / `rubricMalformedMax` gates fail-closed in the harness.
- [ ] Live flag-on check: queue rows written, grade byte-identical, correlation-id log join clean, zero rows with the flag off.
- [ ] Evidence, `VERIFICATION.md`, `state.md`, and the STATUS row updated in the same session.
