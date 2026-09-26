# Jev slice-2 graduation (Phase B): worker passage filter in enforce

_Written: 2026-09-26 · Status: Complete - 575190b · Issue: [#76](https://github.com/rings0fsaturn/study-planner/issues/76) · Map: [#69](https://github.com/rings0fsaturn/study-planner/issues/69) · Parent task: `.work/active/jev-integration/state.md` · Verification: `plan/VERIFICATION.md`_

## How to use this plan (read this first, agent)

This is an implementation plan, not a spec. Read the whole preamble before touching code.

1. **Read the decisions first.** D-01..D-05 are load-bearing and were confirmed with the user on 2026-09-26.
2. **Work one phase at a time.** A phase is done only when its own verification commands pass.
3. **Update the status marker in place** (`Not started` / `In progress` / `Blocked` / `Complete - <sha>`) as you go.
4. **Rules that apply to every phase:** 17 (request_id/trace_id), 42 (assessment contracts), 80 (`--limit 2` dry run before any paid run), 54 (demand-start the sidecar only when embedding is needed).
5. **Ponytail governs the diff.** Extend the existing shadow hook, the existing summarizer, and the existing sweep-runner shape. No new table, column, endpoint, or UI.
6. **The live stack is the source of truth.** Re-read `worker.py` around the hook before editing; line numbers drift.

## TL;DR

Slices 1 (suitability + citation) and 2's evidence are done. #76 Phase A measured the slice-2 passage shadow on 44 real rows and recommended staging: **worker filter first, with the ticket defaults and a top-by-relevance floor; the retrieval slot stays spec-only.**

Phase B does two things:

1. Closes the one gate Phase A left open - what happens to a `conflicting_evidence` passage - on a premise-denying-heavy split.
2. Turns the log-only passage shadow into an enforced filter behind a new flag, with the anti-starvation floor as the safety valve.

## Phase A evidence this builds on (do not re-measure)

| Ticket ask | Verdict | Source |
|---|---|---|
| (a) thresholds per Noul | Defaults hold on both splits across a 12-cell grid. Locked: `injection_max 0.70` / `contradicts_min 0.70` / `relevant_min 0.45` / `evidence_min 0.55`. | `evidence/jev_sweep_slice2_sweep-v1.json`, `PASSAGE_GRID` |
| (b) prompt variants locked | No v2 wording exists for slice 2, and `batch_passage_questions` is derived from `passage_questions` (`app/jev/questions.py`), so batched and single shapes cannot drift. Lock v1 as-is. | `app/jev/questions.py` |
| (c) staging | Worker filter first (filter + floor); retrieval slot spec-only. | `#76` comment 5834300948 |
| (d) sidecar relation | agree 27/40; on disagreements Jev correct 9/13; compose is filter-then-rerank, never Jev reorder of the sidecar. | `evidence/jev_slice2_head2head-v1.json` |
| (e) latency | p50 ~650 ms / p95 ~1127 ms vs the 15 s client ceiling and the 90 s visibility window. Locked. | `evidence/jev_sweep_slice2_sweep-v1.json` |

Measured rates at enforce-relevant settings: sweep precision 0.824 / recall 0.933, final 0.786 / 0.846; starvation 1/6 sweep, 0/6 final; floor 1/6 sweep, 0/6 final; 0 malformed.

## Decisions in force

| Id | Decision | Why |
|---|---|---|
| D-01 | **A `conflicting_evidence` passage does NOT reach the generation prompt.** The enforce keep-set is `include` only. | A passage denying the query premise must never ground a question. It also makes the injection/contradicts order irrelevant to the applied set, so `injection_max` stays at 0.70 and no injection defense is loosened. The verdict is still logged as the reason. |
| D-02 | **One declaration:** `PASSAGE_ENFORCE_VERDICTS` in `app/jev/questions.py`, read by both the summarizer and the filter, with a data-driven test. | The #75 `SUITABILITY_ENFORCE_FAMILIES` precedent: scope and test cannot drift. |
| D-03 | **A new env flag `JEV_SLICE2_ENFORCE` (default false)** gates the filter; the shadow keeps running under `JEV_SLICE1_ENABLED`. | Flipping slice 1 off must not silently disable the filter, and the filter must roll back on its own. |
| D-04 | **The anti-starvation floor skips injection-flagged chunks**, falling back to the whole window only when none qualify. | Without this the floor can resurrect exactly the passage the injection judge rejected, defeating the security arm at the moment it matters. |
| D-05 | **The conflict gate gets its own premise-denying-heavy split** (12 authored pairs, 6 sweep / 6 final) before enforce ships, and the slice-2 sweep runner is committed. | `injection_max` is a security threshold; recovering conflict-01 by loosening it is not defensible on n=4 rows, and Phase A's sweep runner was never committed, so its evidence is not reproducible. |

## Phases

### B1 - conflict-routing gate: premise-denying-heavy split + decision

_Status: Complete - 99f409b_

1. Author `plan/evidence/slice2_conflict_rows.json`: 12 authored premise-denying pairs (6 sweep / 6 final) grounded in the real corpus already used by Phase A, each declaring the source chunk whose claim it denies. Hand-labeled `conflicting_evidence` before any call.
2. Commit `scripts/jev_sweep_slice2.py`: budget-guarded runner in the `jev_sweep_slice1.py` shape, reusing `measure_slice2.summarize_passage` and `PASSAGE_GRID`, emitting per-split summaries and the grid so the artifact is self-contained. One batched `decide()` per row via `batch_passage_questions(1)` - the same builder the worker enforce path uses.
3. Rule 80: `--limit 2` dry run first, inspect records, then the full split.
4. Post the split + the D-01 decision to #76.

### B2 - worker-filter enforce (TDD)

_Status: Complete - 76b139e (RED), 575190b (GREEN), a31f25e (review follow-up)_

1. **RED** `tests/test_generation_jev_slice2.py`: dropped chunks absent from the built messages, the floor keeps exactly the top-by-relevance chunk, the floor never resurrects an injection-flagged chunk, fail-open on `JevError`, `conflicting_evidence` not kept, locked declaration, flag-on-without-client inert.
2. **GREEN** `app/jev/questions.py`: declare `PASSAGE_ENFORCE_VERDICTS = frozenset({"include"})` beside `PASSAGE_THRESHOLDS`.
3. **GREEN** `app/generation/worker.py`: rename the hook to `_jev_filter_passages`, return the applied chunks, drop by the declared set, floor per D-04, and recompute `context_ids` / `chunk_texts` after filtering so `mcq_schema`'s citation enum and `validate` see only kept ids.
4. **GREEN** `app/worker_main.py` + `.env.example`: read `JEV_SLICE2_ENFORCE`; build the Jev clients when either flag is on.

### B3 - verification, review, close-out

_Status: Complete - fd2e7ca_

1. `/ecc:verification-loop`: targeted pytest, full backend against the 18-failure pre-existing baseline, ruff check + format.
2. `/ecc:code-review`.
3. Live flag-on generation on the managed runtime with a request-id log join; confirm the applied set, the floor behavior, and a `ready` question; confirm zero change with the flag off.
4. `plan/VERIFICATION.md`, scratchpad, `state.md`, STATUS row, ticket post.

## Files

| File | Action | Why |
|---|---|---|
| `services/intelligence/app/jev/questions.py` | UPDATE | Declare `PASSAGE_ENFORCE_VERDICTS` |
| `services/intelligence/app/generation/worker.py` | UPDATE | Config flag; filter returns applied chunks; floor; recompute context ids |
| `services/intelligence/app/worker_main.py` | UPDATE | Read the flag; build clients when either flag is on |
| `services/intelligence/.env.example` | UPDATE | Document the flag |
| `services/intelligence/tests/test_generation_jev_slice2.py` | UPDATE | Enforce tests + locked declaration |
| `services/intelligence/scripts/jev_sweep_slice2.py` | CREATE | Budget-guarded conflict-split runner |
| `.work/active/jev-integration/plan/evidence/slice2_conflict_rows.json` | CREATE | 12 authored premise-denying pairs |
| `.work/active/jev-integration/plan/evidence/jev_sweep_slice2_conflict-v1.json` | CREATE | Recorded Nouls + split summaries + grid |

## Validation

```bash
# from the repo root (rule 80 dry run first)
uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice2.py \
  --rows .work/active/jev-integration/plan/evidence/slice2_conflict_rows.json --split sweep --limit 2

# from services/intelligence
uv run pytest tests/test_generation_jev_slice2.py tests/test_generation_jev_slice1.py \
  tests/test_jev.py tests/test_jev_slice2_measure.py -q
uv run pytest -q          # expect the same 18 pre-existing failures
uv run ruff check . && uv run ruff format --check .
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Enforce drops true includes (final-split recall 0.846) and thins real generation context | Medium | Flag default-off; the floor guarantees at least one chunk; live verify a real generation; log retrieved vs applied counts so a regression is diagnosable |
| Decision made on too little conflict evidence | Medium | D-05's 12 authored pairs, hand-labeled, recorded before the decision is written |
| Loosening `injection_max` to keep premise-deniers | - | Avoided by D-01 |
| Live run collides with shared-account leftovers | High | Clean leftovers before the live check |
| Frozen retrieval baseline regresses | Low | Worker-only change; the retrieval path is untouched, so the baseline cannot move |

## Acceptance

- [x] Conflict split recorded, decision posted to #76 with D-01 as the answer (comment 5842297344).
- [x] Enforce tests pass; the full backend suite shows no new failures; ruff clean (84 targeted; 18 pre-existing / 799 passed, failure set byte-identical to baseline).
- [x] Live flag-on generation verified with a request-id log join; flag-off behavior unchanged (steered `kept=5/5 applied=5 ready`; empty-steer floor to `applied=1 ready`; joined by `correlationId`).
- [x] Evidence, `VERIFICATION.md`, `state.md`, and the STATUS row updated in the same session (fd2e7ca).

**Baseline AC substitution (recorded, not silently ticked).** #76's body asked for an `r@1 0.77 / r@3 0.97` spot-check via the eval harness. That is unsatisfiable: those are the retired 788-chunk + Qwen3-reranker numbers from 2026-08-15, and the harness measures the 754-chunk corpus with no rerank path. The substitution is the harness's durable baseline `r@1 0.60 / r@3 0.7333 / MRR 0.7033` against gates `recall3 0.7 / mrr 0.67`, which holds. Re-measuring a reranked baseline on 754 is tracked as a follow-up ticket.
