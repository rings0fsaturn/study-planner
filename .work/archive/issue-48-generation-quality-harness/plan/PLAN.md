# Plan – #48 Generation Quality Evaluation Harness

_Spec: https://github.com/rings0fsaturn/study-planner/issues/48 · Parent: #32 · Map: #4 · Opened: 2026-09-21_

## Acceptance criteria (from #48)

1. Gold samples, shared folds, attempt-count gates, and activation thresholds are explicit and reproducible.
2. Groundedness, retrieval, difficulty, diversity, deduplication, and mastery candidates are measured.
3. The harness uses redacted telemetry and cannot block ordinary generation unless an explicit activation gate is enabled.
4. Failure to meet a gate fails closed and produces actionable results.

## Step 0 - Branch hygiene (done)

1. Commit the uncommitted #45 deliverable on `phase2/issue-45-coding-practice-runs`.
2. Push the branch; fast-forward `project/phase-2`; push `project/phase-2`.
3. Cut `phase2/issue-48-generation-quality-harness` from `project/phase-2`.
4. Claim #48 on GitHub before any work.

## P1 - Harness skeleton (offline, hot path untouched)

- New `services/intelligence/scripts/eval_harness.py`, reusing `generation_probe.py` / `retrieval_probe.py` helpers.
- Gold registry: pins the #56 30-question multi-gold set, corpus material id, and the kt-bench fold hash.
- `--limit` / `--tiers` / `--layers` dry-run flags per rule 80.
- `configure_logging()` + module logger + trace ids per rule 17; `sanitize()` on all evidence.
- Unit tests for pure metric functions next to `services/intelligence/tests/`.

## P2 - Six metrics (+ full-family golds)

- Groundedness: offline LLM-judge ("answerable purely from its cited chunks?") over the gold sample.
- Retrieval: recall@k / MRR + rerank ablation on the 754-chunk corpus, via existing probe helpers.
- Difficulty calibration: authored 1..5 vs `observedDifficulty` from `question_attempts`; name K (attempt-count gate).
- Dedup / diversity: pairwise similarity redundancy rate per assessment set.
- Mastery arm: rows consumable by `research/kt-bench` folds (ECE / AUC / cold-start-k); baseline-vs-BKT on one seam.
- Coding suitability: `code_not_derivable` acceptance rate over a code-bearing battery (the #45 handoff debt), plus new written/coding golds with validated citations.

Rule 42 throughout: one family per call, bounded concurrency 2.

## P3 - Gates + actionable report

- Explicit thresholds artifact (gold version, fold hash, K, per-metric activation thresholds).
- JSON + Markdown report under `research/doc/generation-quality-harness/`; resume-safe (done-keys, append-only).
- Activation gate = env knob, default off; gate failure fails closed with the failing slice named.

## P4 - Telemetry input (redacted only)

- Read `generation_telemetry` rows via service-role script access; never touch `hidden_block`, answer keys, or reference solutions.
- No new table, no migration, no app-package change.

## P5 - Verification

- `ruff check` + `ruff format --check`; unit tests; dry-run (`--limit 2`, one cheap tier); offline report mode on existing #56 evidence; full-matrix run.
- Confirm no hot-path diff (`git diff --stat` shows only `scripts/`, `tests/`, `research/doc/`).
- No browser E2E (no UI change); `./full-app` untouched.

## P6 - Wayfinder exit

- Resolution comment on #48 -> close -> append Decisions-so-far line to map #4 -> STATUS row + `active/phase2-wayfinder/state.md` -> archive the task folder.

## Review gates

- Ponytail guides every diff: reuse before new, shortest diff, `ponytail:` comments for deliberate ceilings.
- Open-code-review (delegate mode) reviews the session diff before wrap.
