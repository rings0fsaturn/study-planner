# State – jev-integration
_Spec: map #69 (https://github.com/rings0fsaturn/study-planner/issues/69) · Plan: active/jev-integration/plan/ · STATUS row: jev-integration · Status: active · Updated: 2026-09-25_

## Current state & next
- **#75 slice-1 graduation is COMPLETE and closed 2026-09-25.** Enforce scope + bands locked, citation enforce flipped, family matrix tested, band report posted, evidence committed, live flag-on check passed on the managed runtime.
- **#76 Phase A (stress) is POSTED 2026-09-25** (comments 5834061427 Step-0 + 5834300948 distributions). Step-0 closed as window-composition false-negative wall; sweep v1 + offline grid + sidecar head-to-head + baseline all reported with a staging recommendation.
- The task stays **active**: this folder covers all of Jev-in-core (slices 1/2/4, tickets #70-#77). The folder is NOT archived yet - #76 Phase B and #77 are still open against it.
- Frontier: **#76 Phase B (enforce)** gated on Phase A posted UNVERIFIED-free. #77 rubric flag queue is queued last.
- Next: open #76 Phase B - resolve the conflict-routing gate (injection/contradicts order per conflict-01 evidence) with a premise-denying-heavy final split, then worker-filter enforce behind the top-by-relevance floor.

## Done so far
- **#76 Phase A posted (2026-09-25):** Step-0 closed as window-composition false-negative wall (7 distinct starved windows, all empty-steer; comment 5834061427); sweep v1 12 calls / 44 rows / $0.000964 / 0 errors, sweep prec 0.824 rec 0.933 starv 1/6, final prec 0.786 rec 0.846 starv 0/6; offline 12-cell grid holds defaults; head-to-head agree 27/40, Jev correct 9/13 disagreements, filter-then-rerank compose; durable baseline holds (0.60/0.7333/0.7033 vs 0.60/0.77/0.706); staging recommends worker filter first with defaults + floor (comment 5834300948). Commits `372b0aa` (summarizer), `de5ce5c` (Step-0 evidence), `359b4c3` (grid + rows), `ae4e1c9` (ticket post), `9ee40a1` (sweep evidence). Verification: jev-adjacent 57 passed; full backend 18 failed / 787 passed (same 18 pre-existing; +4 new slice-2 tests); ruff clean.
- **#75 B1 enforce-scope lock (2026-09-25, TDD, one commit per RED->GREEN):** `dd28420` RED family matrix + threshold lock (compile-time RED: `ImportError: cannot import name 'SUITABILITY_ENFORCE_FAMILIES'`); `f7c59f2` GREEN `SUITABILITY_ENFORCE_FAMILIES = frozenset({"coding"})` declared in `app/jev/questions.py` and read by `_jev_suitability_blocks` instead of a hardcoded `coding` bool; `fce91ec` test-fixture correction. 16/16 slice-1 tests, 94/94 jev-adjacent suites green, ruff check + format clean.
- **#75 evidence committed (2026-09-25, `3c63615`):** #74 `app/jev/measure.py` + `scripts/jev_measure.py` + `tests/test_jev_measure.py` + `plan/evidence/rubric_rows.json` + `jev_measure_{train,test}.json`; #75 raw sweep outputs `jev_sweep_slice1_{sweep-v1,sweep-v2,final-v1}.json`. All previously untracked.
- **#75 band report posted** to ticket 75 (comment 5828909475): per-cell per-family grids, separation evidence, v1-v2 diff, and the shadow->enforce flip list.
- **#75 live flag-on check PASSED (2026-09-25):** `JEV_SLICE1_ENABLED=true` verified in the worker `/proc/<pid>/environ`; coding generation on the codeless ACCA material judged `not_derivable` on all three D-02 windows (0.98 / 0.99 / 0.95), each firing the resample, terminal `code_not_derivable`; DB row `status=failed` with that warning; UI rendered the server's own reason; request-id join via `./full-app logs intelligence --grep <id>` returned the 202; 0 console errors.
- **Full backend suite (verbatim):** `18 failed, 783 passed in 33.63s`. All 18 are pre-existing - confirmed by stashing the change and reproducing the identical 7 failures in isolation on a clean tree (order-dependent v1-golden + `test_retrieval_probe`).
- **Off-frontier live E2E matrix (2026-09-25, operator-requested):** 2 code-heavy PDFs (grokking-algorithms, CSAPP_2016) x coding/objective/written through the real UI. **Jev blocked nothing on either PDF** - every suitability verdict landed in `review` (0.44-0.88), so the pre-gate never fired. The coding refusals came from DeepSeek's own `unsuitable` schema outcome (a separate gate). grokking coding then failed its own self-check (reference passed 7/9). CSAPP ingested for this: 1105 pages -> 2065 chunks, all GPU-embedded.
- #75 Phase A (2026-09-25): sweep v1 62 calls + v2 62 + final v1 54 = 178 calls, ~$0.0034, zero errors; suitability `@0.9/0.1` prec/rec 0.889 sweep and 0.875 final; citation `stands@0.8` prec 1.0 both splits.
- #75 B2 citation enforce flip (`24d8d96`): confident contradicted/unsupported with stands true drops with the existing `citation_missing` split and no second repair; `validation.py` untouched.
- #74 rubric threshold + cost measurement: test agree 0.974 @0.6, 39 pairs, 0 malformed, p95 2.4 s, autopsy 5/5, dashboard drift -1.9%, $0.042/Mtok holds.
- #70-#74 closed earlier: slice-1 wiring, citation shadow-first, slice-2 passage shadow, slice-4 rubric shadow.

## Flow trace
1. All LLM prose flows through `OpenRouterGenerationClient` (services/intelligence/app/generation/openrouter_client.py:80), built by `factory.py::build_openrouter_adapter` from `<PREFIX>_*` env vars.
2. Jev entry: `services/intelligence/app/jev/client.py::JevClient.from_env` reads `OPENROUTER_JEV_API_KEY` + `JEV_MODEL/_BASE_URL/_TIMEOUT_MS`; SDK retries 429/5xx internally, wrapper classifies to typed codes.
3. Slice-2 shadow path: `worker.py::_jev_classify_passages_shadow` (worker.py:843) builds `{"query": _steer(...), "passages": [...]}` and calls `batch_passage_questions(len)` on the `JEV_SLICE2` client (15 s); `_summarize_passage_shadow` (worker.py:208) routes via `route_batch_passage` and floors starved windows to top-by-relevance. A bare recipe (no skillTags, no scope) yields an empty steer (context.py:111-115) and the judge scores relevance against it.
4. Slice-2 sweep path (#76): `measure_slice2.summarize_passage` reruns `PASSAGE_GRID` (12 one-dim cells around the ticket defaults) offline over recorded Nouls with `windows` for starvation/floor math; `measure_slice1._scored/_latency` are reused, never reimplemented.
3. Slices: suitability `app/jev/questions.py::suitability_questions` (Choice) + `route_suitability`; citations `citation_questions` (Choice) after the free string-match; RAG `passage_questions` (4 Nouls) + `route_passage`; rerank `relevance_question` (Noul, sort desc); rubric `criterion_score_questions` (Score per criterion).
4. **Enforce scope (#75):** `SUITABILITY_ENFORCE_FAMILIES` in `app/jev/questions.py` is the single declaration of which families terminal-block; `_jev_suitability_blocks` (worker.py) reads it. The family matrix test is data-driven off the same set, so test and shipped scope cannot drift.
5. Slice-1 sweep (#75): `uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice1.py --rows <rows.json> --split sweep|final --prompt-variant v1|v2 --repeats 2 --max-spend 0.40`. The threshold grid reruns offline through `app/jev/measure_slice1.py` at zero extra spend.
6. Citation enforce path in the worker (`_jev_adjudicate_citations`): fires only when an accepted candidate carries a `citation_unverified` warning; regex-keys the warning back to a chunk id, one decide(), and on a confident reject returns `(None, [citation_missing])`.
7. **Generation context:** `app/generation/context.py` - `CONTEXT_TOP_K=5`; coding opts into a code-seeking window (`_code_seeking_context`), objective/written use `_spread_context`. Retrieval is `match_content_chunks` via RPC; the retrieval router's rerank is opt-in and not used by generation.
8. **Live E2E attribution technique:** slice `.dev/full-app/logs/worker.log` by byte offset before/after a UI action to attribute background-worker lines to a specific cell. A missing dependency (Piston down) surfaces as a *deferred* warning leaving the row `generating`, not failed.

## Files affected
- services/intelligence/app/jev/measure_slice2.py – #76 pure passage summarizer (`summarize_passage` + 12-cell `PASSAGE_GRID`); reuses `measure_slice1._scored/_latency`, never duplicates router logic.
- services/intelligence/tests/test_jev_slice2_measure.py – #76 4 offline tests (counts, starvation/floor, grid reruns, malformed/latency).
- .work/active/jev-integration/plan/evidence/ – #76 adds `slice2_rows.json` (44 rows: 8 windows x 5 + 4 authored conflict pairs), `jev_step0_starvation.json`, `jev_sweep_slice2_sweep-v1.json`, `jev_slice2_head2head-v1.json`.
- services/intelligence/app/jev/questions.py – adds `SUITABILITY_ENFORCE_FAMILIES = frozenset({"coding"})` (#75); builders + routers for slices 1+2+4.
- services/intelligence/app/generation/worker.py – `_jev_suitability_blocks` now takes `question_format` and reads the declared family set instead of a `coding` bool (#75 B1); slice-1 flag, suitability pre-gate, citation adjudication, passage shadow.
- services/intelligence/tests/test_generation_jev_slice1.py – adds the family matrix (data-driven off the scope), a written-family advisory case, and `test_locked_thresholds_and_enforce_scope` (#75 B1).
- services/intelligence/app/jev/measure.py + scripts/jev_measure.py + tests/test_jev_measure.py – #74 pure `summarize_measurement` + budget-guarded rubric runner + 6 offline tests (committed `3c63615`).
- services/intelligence/app/jev/measure_slice1.py – #75 pure sweep summarizer.
- services/intelligence/scripts/jev_sweep_slice1.py – #75 budget-guarded sweep runner.
- services/intelligence/tests/test_jev_slice1_measure.py – #75 9 offline tests.
- .work/active/jev-integration/plan/evidence/ – `slice1_rows.json` (58 rows), `rubric_rows.json`, `jev_measure_{train,test}.json`, `jev_sweep_slice1_{sweep-v1,sweep-v2,final-v1}.json`.
- services/intelligence/app/jev/client.py – typed-error wrapper; `app/jev/__init__.py`; `services/intelligence/pyproject.toml` (typesafe-sdk==0.7.1).
- services/intelligence/app/grading/worker.py – #73 rubric shadow (`jev_shadow_enabled` + `_summarize_rubric_shadow`).
- services/intelligence/app/worker_main.py – builds the Jev clients only when the flag is on.
- e2e/jev-family-matrix-live.spec.ts, e2e/jev-coding-rerun-live.spec.ts – session diagnostics (UNTRACKED, throwaway).
- e2e/pdf/CSAPP_2016.pdf, e2e/pdf/grokking-algorithms-2nd-edition-2nd_compress.pdf – operator-added fixtures (UNTRACKED; `e2e/pdf/*.pdf` is NOT gitignored, and the two older sample PDFs ARE tracked).
- .agents/skills/jev/SKILL.md – Jev dev/debug skill.
- .work/STATUS.md – jev-integration Active row.

## Pitfalls & rules
- Must keep API credentials server-side; never ship keys to the browser (Jev skill + rule 20 pattern).
- Must score passage relevance only against real scored-query steers: an empty `_steer` (bare recipe, no skillTags/scope) makes the shadow judge relevance against nothing and starves every window (#76 Step-0: kept=0/5 on all 7 distinct windows, yet the same chunks grounded generation and citation stands 0.96-1.00).
- Must keep the ticket 0.77/0.97 (788-chunk + reranker, 2026-08-15) separate from the harness retrieval arm (754-corpus dense: 0.60/0.77/0.706 gold tolerances); the arm cannot check the reranked number.
- Must decide the injection/contradicts order before conflict enforce: injection fires first, so a premise-denying passage scoring injection 0.77 routes exclude even with contradicts 0.96 (#76 conflict-01).
- Must compose Jev + sidecar as filter-then-rerank: Jev keeps generously (recall 0.85-0.93), the sidecar ranks; never let Jev reorder sidecar output (#76 head-to-head: agree 27/40, Jev correct 9/13 disagreements).
- Must attach request_id/trace_id on every new backend log line and route HTTP errors through `service_error` per 17-logging-and-tracing.agents.md.
- Must not change assessment contracts: one family per call, failed is terminal, `code_not_derivable` stays honest per 42-assessment-and-practice-generation.agents.md.
- Must dry-run operator/probe scripts with `--limit 2` before full runs per 80-script-dry-run-before-full-runs.agents.md.
- Jev jaggedness: no math/counting/dates in questions; one narrow judgment per question; small relevant state; thresholds tuned per question with the model version pinned.
- OpenRouter SystemOne returns TypeSafe-shaped responses only (no cost/id/provider); estimate spend, do not expect `usage.cost` (verified live 2026-09-24).
- **The suitability judge is coding-calibrated.** Now doubly confirmed (sweep + live E2E on 2 code-heavy PDFs): objective/written derivable rows read `not_derivable`, and on real books every family's verdict lands 0.44-0.88 so the pre-gate never fires. Never enforce those families without a clearing gate.
- **Jev and the provider's own refusal are separate gates.** On code-heavy prose the DeepSeek `unsuitable` schema outcome does the real refusal work while Jev stays advisory. Do not read a DeepSeek refusal as a Jev action.
- **The slice-2 passage shadow dropped 5/5 chunks in every one of the 6 live cells** (`kept=0/5`). It is log-only today, but if it ever goes enforce every generation loses its whole context. Investigate before #76 flips anything to enforce.
- v1 and v2 wording do not separate on this evidence; v1 holds. Do not flip the builder default on the strength of these grids.
- Run the sweep script from the repo root as `services/intelligence/scripts/jev_sweep_slice1.py`; a bare `scripts/` path fails under `uv run --package intelligence`.
- Full-suite v1 golden failures are order-dependent (pass in isolation); the retrieval-probe import failure pre-exists on a clean tree (re-verified 2026-09-25).
- Score answers carry `score` (0..top level), not `expectation`.
- `ruff format` may reflow untouched hunks in an edited file; keep the reflow rather than hand-reverting.
- `OPENROUTER_JEV_API_KEY` can expire server-side and every Jev path then answers `provider_credentials` with `retryable=false` and $0.00 spend; read it as key-specific, not a code fault.
- **Docker on this host:** the Windows `docker.exe` client produces containers whose host directory binds are EMPTY (GPU sidecar then falls back to CPU with `Cannot load librocdxg.so` + `undefined symbol: hsaKmtOpenKFD`); `docker desktop restart` does not fix it. Use the native `/usr/bin/docker` instead. See the `docker-host-bind-mount-diagnosis` skill.
- **Piston must be up for any coding generation** or the self-check *defers* (`provider_unavailable`) and the assessment stays `generating` with a retryable warning rather than failing. Start it with `docker compose --profile sandbox up -d piston` (native client).

## Decisions in force
- Decided #76 Phase A staging (2026-09-25): worker filter first with ticket defaults + top-by-relevance floor, retrieval slot stays spec-only; conflict routing stays shadow until the injection/contradicts order is decided on a premise-denying-heavy final split.
- Decided slices 1+2+4 first (suitability+citations, RAG/rerank fallback, rubric calibration); guardrails deferred (user, 2026-09-24).
- Decided official typesafe_sdk pointed at OpenRouter (`base_url=https://openrouter.ai/api`, model `jev-1.13` pinned) over thin httpx (user, 2026-09-24).
- Decided dedicated `OPENROUTER_JEV_API_KEY` from services/intelligence/.env (user, 2026-09-24); live halt at $0.40 estimated of the $0.5 budget.
- Decided slice-4 as a grading-path shadow first, graduation on #74 evidence (user, 2026-09-25): reuses `JEV_SLICE1_ENABLED`, 15 s ceiling; bar 0.80 agree / 30 pairs / <2% malformed / +/-20% spend.
- **Decided #75 (2026-09-25):** reporting stays on **v1** wording; suitability band `APPROVE_AT=0.9` / `BLOCK_AT=0.1`; citation band `AUTO_ACCEPT=0.8`; **suitability enforce is coding-only**, declared once as `SUITABILITY_ENFORCE_FAMILIES` and read by the worker so scope and test cannot drift. Widen only with fresh per-family evidence.
- Decided #75 B2 (2026-09-25): a confident citation reject drops with the existing `citation_missing` split and **no second repair**, keeping `validation.py` pure and the substring gate unchanged.
- Decided #75 live verification (2026-09-25): flag-on generation is verified through the managed runtime with a request-id log join, not by unit tests alone.

## Open
- Frontier: **#76 Phase B (enforce)** - resolve the conflict-routing gate (injection/contradicts order per conflict-01 evidence) with a premise-denying-heavy final split, then worker-filter enforce behind the top-by-relevance floor. Phase B starts only on Phase A posted UNVERIFIED-free.
- Queued last: **#77 rubric flag queue** (short cutoff/margin sweep on the 75-pair corpus, then a disagreement-flag queue; grades never auto-touched).
- **Untracked files at risk:** the two new `e2e/pdf/*.pdf` fixtures (7.3 MB) and the two throwaway `e2e/jev-*-live.spec.ts` diagnostics. `e2e/pdf` is not gitignored and the older sample PDFs are tracked, so the new ones are untracked-by-omission. Never run `git clean -fdx` at the repo root.
- **Shared-account hygiene:** the 2026-09-25 runs left test assessments behind (2 coding + the 6-cell matrix rows; one known stuck `generating` from the Piston-down window; user declined cleanup 2026-09-25, so Phase A scoped all sweep locators around existing rows). Clean before the next live run.
- GPU sidecar and Piston were demand-started for the session and have been stopped; restart per rule 54 only when embedding/rerank or coding grading is needed.
- Blocked: none.
- `client.models.list()` is unusable against OpenRouter; use the Models API directly if ever needed.
- Jev price on OpenRouter is not listed in the public models catalog; estimate held at the TypeSafe list $0.042/Mtok until the dashboard says otherwise.
