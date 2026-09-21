# State – issue-48-generation-quality-harness
_Spec: https://github.com/rings0fsaturn/study-planner/issues/48 (parent #32, map #4) · Plan: active/issue-48-generation-quality-harness/plan/ · STATUS row: issue-48 · Status: active · Updated: 2026-09-21_

## Current state & next
- Session 1 opened 2026-09-21. Branch `phase2/issue-48-generation-quality-harness` cut from `project/phase-2` at `dfa126e`; #48 claimed on GitHub.
- Plan agreed (see plan/PLAN.md). Harness = new `services/intelligence/scripts/eval_harness.py`; golds = #56 30-Q set **plus** new written/coding golds.
- P1 not started.
- Next: P1 skeleton (`eval_harness.py` + gold registry + dry-run flags + logging + unit tests).

## Done so far
- Step 0 branch hygiene: committed the #45 deliverable (`dfa126e`), pushed `phase2/issue-45-coding-practice-runs`, fast-forwarded + pushed `project/phase-2`.

## Flow trace
- #48 is unblocked (blocked-by #38 and #43 both CLOSED).
- Reusable assets: `services/intelligence/scripts/generation_probe.py` (probe helpers + 30-Q gold), `retrieval_probe.py` helpers, `contracts/phase2/generation-telemetry.schema.json`, `app/ingestion/telemetry.py:157` (`SupabaseTelemetrySink`), `app/generation/validation.py` (citation gates + `code_not_derivable`), `research/kt-bench/` (folds + ECE/AUC/cold-start metrics).
- Handoff debt: `archive/issue-45-coding-practice-runs/plan/VERIFICATION.md:55` - coding-suitability acceptance rate is #48's charter.

## Files affected
- none yet.

## Pitfalls & rules
- Offline only: evaluation stays outside the online generation hot path (AC3).
- Rule 42: one family per generation call; bounded concurrency (2), never unbounded fan-out.
- Rule 80: dry-run (`--limit`, one cheap mode) before any full run; resume-safe done-keys.
- Rule 17: `configure_logging()` + module logger + trace ids; no bare `print`/`basicConfig`.
- Never emit credentials, hidden grading content, or unredacted material into evidence (`sanitize`).

## Decisions in force
- Harness lives in a new `scripts/eval_harness.py`, reusing probe helpers rather than extending `generation_probe.py` (2026-09-21).
- Gold set v1 = #56 30-question multi-gold + 754-chunk corpus, extended with new written and coding golds (2026-09-21).
- Activation gate defaults off; the harness cannot block ordinary generation (2026-09-21).

## Open
- none
