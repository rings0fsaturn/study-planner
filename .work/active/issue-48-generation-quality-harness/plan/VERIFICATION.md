# Verification – #48 Generation Quality Evaluation Harness

_Evidence: `research/doc/generation-quality-harness/` (report.md, summary.json, live.json)._

## P1 - Harness skeleton

- `uv run ruff check scripts/eval_harness.py tests/test_eval_harness.py` -> clean.
- `uv run ruff format --check` -> clean.
- `uv run pytest tests/test_eval_harness.py -q` -> 11 passed.
- `--verify-golds` -> `resolved gold snippets against 754 corpus chunks`; registry healthy (version 1).
- Gold registry pins: corpus material + 754 chunks + sidecar, 3 kt-bench fold hashes, attempt gate K=5, judge model, baselines, thresholds.
- No hot-path change: only `services/intelligence/scripts/`, `services/intelligence/tests/`, `research/doc/generation-quality-harness/` are new.

## P2 - Six metrics

- Objective (recorded #56 evidence, n=180): schema_valid 0.9611, citation_valid 0.9133, gold_support 0.7803, copy_through 0.0231, near_dup_rate 0.0044.
- Groundedness (offline LLM judge, 30 items): 0.8667 answerable.
- Retrieval (live sidecar arm, 30 gold queries): recall@1 0.60, recall@3 0.7333, recall@5 0.8667, MRR 0.7033. Hybrid and dense rank identically on this query set.
- Difficulty calibration: 1 question met the K=5 gate, all authored band 3 -> only one distinct band, so the metric reports `unmeasured` (honest; a curve needs two bands).
- Diversity/dedup: near_dup_rate 0.0044, distractor mean cosine 0.4116, option position entropy 1.3042.
- Mastery candidates (94 observations, 35 sequences): bkt-v1 ECE 0.1604 / AUC 0.8884 vs running-proportion ECE 0.1968 / AUC 0.8886.
- Coding suitability: 4 attempts, 3 judged, 3 `code_not_derivable` -> derivable rate 0.0. Gold disagreement: `grokking-algorithms` (code-bearing) expected derivable but refused 3/3; the refusals name front-matter/retrieval, not the material's nature.
- Written golds (6) and coding golds (3) authored; all written snippets resolve to real corpus chunks.

## P3 - Gates + report

- Thresholds explicit in `eval_golds.json` with a `baselines` provenance block.
- Activation gate default off: `--summarize` with 2 breached gates exited 0.
- Fail-closed confirmed: `--summarize --activate` exited 1 and named the failing gates.
- Report written to `research/doc/generation-quality-harness/report.md` + `summary.json`; live arms cached to `live.json` so a plain `--summarize` reproduces the last full report (verified: `reusing cached live arms: groundedness, retrieval`).

## P4 - Telemetry input

- Redacted read only: `generation_telemetry` selects task/outcome/counts/repair flag. 184 records, acceptance 0.7663, repair rate 0.0435.
- No `hidden_block`, answer key, reference solution, or raw material text is selected or emitted.

## P5 - Verification sweep

- `uv run pytest tests/test_eval_harness.py -q` -> 11 passed.
- `uv run pytest tests/ -q` -> 693 passed, 7 failed. All 7 are pre-existing and unrelated to this change:
  - `test_retrieval_probe.py` (2): `ModuleNotFoundError: No module named 'services'` (stale import path in the test, fails identically from the repo root).
  - `test_v1_integration.py` calibration goldens (5): time-of-day golden mismatch (evening vs afternoon), the known TZ flake class.
- `uv run ruff check scripts/ tests/` -> clean (fixed a pre-existing import-sort in `tests/test_grading_grader.py`).
- Sidecar started on demand for the retrieval arm and stopped after (rule 54).

## Deliberate deferrals

- Rerank ablation is not built: the retrieval arm measures recall@k/MRR (AC2) and hybrid/dense rank identically here, so a rerank arm would not change a gate. Add when rerank wiring changes.
- No browser E2E: the harness has no UI.

## AC ledger

| AC | Status | Evidence |
|---|---|---|
| AC1 explicit + reproducible golds/folds/K/thresholds | met | `eval_golds.json` (folds hashed, K=5, thresholds + baselines); `--verify-golds` resolves all written snippets against the 754-chunk corpus |
| AC2 six metric families measured | met | report.md sections objective / groundedness / retrieval / difficulty / diversity / mastery / coding |
| AC3 redacted telemetry, default-off activation gate | met | telemetry reader selects counts only; `--summarize` exit 0 with gates breached, `--activate` exit 1 |
| AC4 fail-closed + actionable results | met | `evaluate_gates` returns metric + observed + threshold + message; report lists the coding-suitability disagreement with the material named |
