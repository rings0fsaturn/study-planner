# State – jev-integration
_Spec: map #69 (https://github.com/rings0fsaturn/study-planner/issues/69) · Plan: active/jev-integration/plan/ · STATUS row: jev-integration · Status: active · Updated: 2026-09-25_

## Current state & next
- Slices #70-#74 are closed; the frontier is **#75 slice-1 graduation**, mid-flight.
- #75 Phase A (evidence + sweep) and the **B2 citation enforce flip** are DONE and committed; #75 B1 (family matrix test, enforce scope + threshold lock) is the next piece of code.
- TDD checkpoints on `project/phase-2`: `e8adb9e` summarizer (RED then GREEN), `3413884` variant kwarg, `1f2af11` sweep runner, `2da3ec0` evidence rows, `24d8d96` citation enforce.
- Key measurement: the suitability judge is **coding-calibrated** (sweep v1 coding 9/9; objective/written derivable rows read `not_derivable` at 0.64-0.96), so suitability enforce stays **coding-only** unless the family gate clears; v1 vs v2 wording showed **no separation** (identical grids but one borderline flip), so final reporting stays on **v1**.
- Band candidates: suitability `APPROVE_AT=0.9` / `BLOCK_AT=0.1` (prec/rec 0.889 sweep, 0.875 final; jitter_max 0.07 sweep / 0.2 final; flip 0.0); citation `AUTO_ACCEPT=0.8` (prec 1.0 sweep + final; rec 1.0 sweep / 0.75 final).
- Next: add the family matrix test (objective/written advisory, coding enforces), lock enforce scope + thresholds + variant, run the full backend suite + ruff, then post the #75 band report.

## Done so far
- Plan-mode research: Jev primitives/confidence/API, OpenRouter Decisions + SystemOne surfaces, cost monitoring, cookbooks, jaggedness; app LLM + retrieval maps via explore agents.
- `app/jev/` package: `client.py` (typesafe_sdk wrapper, typed JevError, request_id logging, cost estimate) + `questions.py` (suitability/citation/passage/relevance/rubric builders + routers) + `tests/test_jev.py` (9/9 green).
- `scripts/jev_probe.py --limit 2` live-verified: passage include/exclude, citation verified@1.0, suitability derivable@1.0 + conservative review, relevance 0.96, rubric sane.
- Learned live: SystemOne surface returns no usage.cost/id/provider (docs describe Decisions shape); spend estimated at $0.042/Mtok via `estimate_cost_usd` + `JEV_PRICE_PER_MTOK`.
- #70-#74 all closed: slice-1 wiring (`JEV_SLICE1_ENABLED`, suitability pre-gate, citation adjudication), citation shadow-first, slice-2 passage shadow (spec-only retrieval slot), slice-4 rubric shadow, and the #74 rubric threshold + cost measurement (test agree 0.974 @0.6, 39 pairs, 0 malformed, p95 2.4 s, autopsy 5/5, dashboard drift -1.9%, $0.042/Mtok holds).
- #75 A1 evidence rows committed 2026-09-25 (`2da3ec0`): `plan/evidence/slice1_rows.json`, 58 rows (suitability 17 sweep / 15 final across coding/objective/written x derivable/not_derivable incl. codeless + solved worksheets + borderline, joined window <= 4000 chars; citation 14 sweep / 12 final exact/paraphrase/off-context/missing-quote/uncertain, `citation_missing`/`malformed_output` excluded); split by material (`mat-sweep-*` vs `mat-final-*`), zero chunk/claim overlap across splits, zero overlap with #74 qids, bias declared in the evidence note; sweep `--limit 2` dry run GREEN before the full run.
- #75 A2 summarizer + variant + runner committed 2026-09-25: `e8adb9e` pure `app/jev/measure_slice1.py` (offline suitability/citation grids with jitter/flip/malformed/latency, RED import error then GREEN); `3413884` optional `variant` kwarg on `suitability_questions()`/`citation_questions()` defaulting to v1 current wording with v2 narrow rewording, callers stable; `1f2af11` budget-guarded `scripts/jev_sweep_slice1.py` (`--rows/--split/--prompt-variant/--repeats/--limit/--max-spend`, one decide() per row per variant per repeat, 9-cell suitability + 3-cell citation grids offline at zero extra spend). 21/21 slice1+jev tests green, ruff check + format clean.
- #75 Phase A sweeps measured 2026-09-25: sweep v1 62 calls $0.001176 + sweep v2 62 calls $0.001187 + final v1 54 calls $0.001009 (178 calls, ~$0.0034, zero errors, p50 ~610-645 ms); suitability `@0.9/0.1` prec/rec 0.889 sweep and 0.875 final, review band 9-10 rows, jitter_max 0.07 sweep / 0.2 final, flip 0.0; citation `stands@0.8` prec 1.0/rec 1.0 sweep and 1.0/0.75 final; the v1-v2 diff is one borderline row only (`s-sweep-coding-borderline-01`: derivable@0.71 v1 vs not_derivable@0.17 v2). Raw outputs saved as `plan/evidence/jev_sweep_slice1_{sweep-v1,sweep-v2,final-v1}.json` (untracked; commit with the ticket report).
- #75 B2 citation enforce flip committed 2026-09-25 (`24d8d96`): confident contradicted/unsupported with stands true returns `accepted=None` with the existing `citation_missing` split and no second repair (the caller only repairs `malformed_output`); supports clearing, low-confidence keep, and Jev-error fail-open unchanged; `validation.py` untouched; 11/11 slice-1 tests + 173 worker/validation/jev/coding suites green, ruff clean.
- #74 evidence still untracked alongside the #75 sweep outputs: `app/jev/measure.py`, `scripts/jev_measure.py`, `tests/test_jev_measure.py`, `plan/evidence/rubric_rows.json`, `plan/evidence/jev_measure_{train,test}.json`.

## Flow trace
1. All LLM prose flows through `OpenRouterGenerationClient` (services/intelligence/app/generation/openrouter_client.py:80), built by `factory.py:16` from `<PREFIX>_*` env vars.
2. Jev entry: `services/intelligence/app/jev/client.py::JevClient.from_env` reads `OPENROUTER_JEV_API_KEY` + `JEV_MODEL/_BASE_URL/_TIMEOUT_MS` (template in `.env.example`); SDK retries 429/5xx internally, wrapper classifies to typed codes.
3. Slices: suitability `app/jev/questions.py::suitability_questions` (Choice) + `route_suitability`; citations `citation_questions` (Choice) after the free string-match; RAG `passage_questions` (4 Nouls) + `route_passage`; rerank `relevance_question` (Noul, sort desc); rubric `criterion_score_questions` (Score per criterion).
4. Probe: `services/intelligence/scripts/jev_probe.py --limit N --max-spend 0.40` loads `.env`, batches per state, aborts over budget.
5. Rubric shadow: `app/grading/worker.py::_jev_shadow_rubric` runs one batched `criterion_score_questions` decide() after `grade_written` composes; `_summarize_rubric_shadow` (pure) normalizes Score `score`/2 onto 0..1 and marks agree vs `CORRECT_THRESHOLD` (0.6); the client is built in `worker_main._build_grading_worker` only when `JEV_SLICE1_ENABLED` is on.
6. Slice-1 sweep (#75): run from the repo root as `uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice1.py --rows .work/active/jev-integration/plan/evidence/slice1_rows.json --split sweep|final --prompt-variant v1|v2 --repeats 2 --max-spend 0.40`. One decide() per row per variant per repeat; the threshold grid reruns offline through `app/jev/measure_slice1.py` at zero extra spend. Suitability state is the joined window capped at 4000 chars; citation state is `{claim, section}` from the uncertain middle only.
7. Citation enforce path in the worker (`app/generation/worker.py::_jev_adjudicate_citations`): fires only when an accepted candidate carries a `citation_unverified` warning (string-match misses never enter), regex-keys the warning back to a chunk id, calls one decide(), and on a confident reject returns `(None, [citation_missing])`; the caller then fails the assessment because only `malformed_output` is repairable.

## Files affected
- services/intelligence/app/jev/__init__.py, client.py, questions.py – Jev adapter + builders; #72 adds the batched passage builder + shared `_route_nouls` core + `from_env` timeout default; #75 adds the optional `variant` kwarg (v1 current, v2 narrow rewording).
- services/intelligence/tests/test_jev.py – 9 offline tests with a fake SDK client.
- services/intelligence/scripts/jev_probe.py – budget-guarded live probe.
- services/intelligence/pyproject.toml – added typesafe-sdk==0.7.1 (+tenacity transitive).
- services/intelligence/.env.example – OPENROUTER_JEV_API_KEY + JEV_MODEL/BASE_URL/TIMEOUT_MS/PRICE_PER_MTOK + JEV_SLICE1_ENABLED=false + JEV_SLICE2_TIMEOUT_MS=15000.
- services/intelligence/app/generation/worker.py – slice-1 flag, suitability pre-gate, citation adjudication; #71 shadow branch + structured `jev_*` verdict log fields; #72 passage shadow; #75 citation enforce (confident reject drops with `citation_missing`, no second repair).
- services/intelligence/app/worker_main.py – builds the Jev client only when the flag is on; #72 second client (`JEV_SLICE2_TIMEOUT_MS`, default 15000); #73 grading shadow client (flag-gated).
- services/intelligence/tests/test_generation_jev_slice1.py – #70 pre-gate/adjudication tests; #71 shadow tests; #75 enforce drop tests (contradicts + says_nothing drop, adapter call count unchanged).
- services/intelligence/app/grading/worker.py – #73 `jev_shadow_enabled` + duck-typed `jev` + `_summarize_rubric_shadow` pure + `_jev_shadow_rubric` log-only hook.
- services/intelligence/tests/test_grading_jev_rubric_shadow.py – #73 5 offline tests (flag-off, pairs, fail-open, unscored, agree).
- services/intelligence/app/jev/measure.py + scripts/jev_measure.py + tests/test_jev_measure.py – #74 pure `summarize_measurement` + budget-guarded rubric runner + 6 offline tests (all still UNTRACKED).
- .work/active/jev-integration/plan/evidence/rubric_rows.json + jev_measure_{train,test}.json – #74 evidence (UNTRACKED).
- services/intelligence/app/jev/measure_slice1.py – #75 pure sweep summarizer (approve/review/block counts, confident-reject precision/recall, jitter mean/max, flip rate, malformed rate, latency p50/p95).
- services/intelligence/scripts/jev_sweep_slice1.py – #75 budget-guarded sweep runner (one decide() per row per variant per repeat, fail-open unscored, offline grids).
- services/intelligence/tests/test_jev_slice1_measure.py – #75 9 offline tests (summarizer math, variant default, runner wiring with the shared `ScriptJev`).
- .work/active/jev-integration/plan/evidence/slice1_rows.json – #75 58 fresh rows, split by material, bias declared.
- .work/active/jev-integration/plan/evidence/jev_sweep_slice1_{sweep-v1,sweep-v2,final-v1}.json – #75 raw sweep outputs (UNTRACKED; commit with the ticket report).
- .work/STATUS.md – jev-integration Active row.
- .agents/skills/jev/SKILL.md – Jev dev/debug skill (visible via the `.claude/skills` symlink + `.opencode/skills/jev` copy).

## Pitfalls & rules
- Must keep API credentials server-side; never ship keys to the browser (Jev skill + rule 20 pattern).
- Must attach request_id/trace_id on every new backend log line and route HTTP errors through `service_error` per 17-logging-and-tracing.agents.md.
- Must not change assessment contracts: one family per call, failed is terminal, `code_not_derivable` stays honest per 42-assessment-and-practice-generation.agents.md.
- Must dry-run operator/probe scripts with `--limit 2` before full runs per 80-script-dry-run-before-full-runs.agents.md.
- Jev jaggedness: no math/counting/dates in questions; one narrow judgment per question; small relevant state; thresholds tuned per question with the model version pinned.
- OpenRouter SystemOne returns TypeSafe-shaped responses only (no cost/id/provider); estimate spend, do not expect `usage.cost` (verified live 2026-09-24).
- The suitability judge is coding-calibrated: objective/written derivable rows read as `not_derivable` at 0.64-0.96, so never enforce those families without a clearing gate (found 2026-09-25, sweep v1 + final-v1).
- v1 and v2 wording do not separate on this evidence; do not flip the builder default on the strength of these grids (found 2026-09-25).
- Run the sweep script from the repo root as `services/intelligence/scripts/jev_sweep_slice1.py`; a bare `scripts/` path fails under `uv run --package intelligence` (found 2026-09-25).
- Full-suite v1 golden failures are order-dependent (pass in isolation); the retrieval-probe import failure pre-exists on a clean tree (verified 2026-09-24-25).
- Score answers carry `score` (0..top level), not `expectation`: live docs beat memory and stale docstrings (found 2026-09-25, questions.py fixed).
- `ruff format` may reflow untouched hunks in an edited file; keep the reflow (file ends format-clean) rather than hand-reverting.
- `OPENROUTER_JEV_API_KEY` can expire server-side and every Jev path then answers `provider_credentials` with `retryable=false` and $0.00 spend; a direct `/auth/key` probe returns 401 "API key expired" while the sibling `OPENROUTER_API_KEY` stays valid, so read it as key-specific rather than a code fault (found and fixed 2026-09-25).

## Decisions in force
- Decided slices 1+2+4 first (suitability+citations, RAG/rerank fallback, rubric calibration); guardrails deferred (user, 2026-09-24).
- Decided official typesafe_sdk pointed at OpenRouter (`base_url=https://openrouter.ai/api`, model `jev-1.13` pinned) over thin httpx (user, 2026-09-24).
- Decided dedicated `OPENROUTER_JEV_API_KEY` from services/intelligence/.env (user, 2026-09-24); live halt at $0.40 estimated of the $0.5 budget.
- Decided slice-4 as a grading-path shadow first, graduation on #74 evidence (user, 2026-09-25): reuses `JEV_SLICE1_ENABLED`, 15 s ceiling; graduation bar 0.80 agree / 30 pairs / <2% malformed / +/-20% spend.
- Decided #75 interim (2026-09-25): final reporting stays on **v1** wording (no separation vs v2); suitability band candidate `0.9/0.1` and citation band candidate `stands@0.8`; **suitability enforce stays coding-only** with objective/written advisory until a family gate clears.
- Decided #75 B2 (2026-09-25): a confident citation reject drops with the existing `citation_missing` split and **no second repair**, keeping `validation.py` pure and the substring gate unchanged.

## Open
- Frontier: **#75 slice-1 graduation remainder** - add the family matrix test (objective/written advisory, coding enforces), lock enforce scope + thresholds + variant, run the full backend suite + `ruff check`/`ruff format --check`, post the per-cell band report with separation evidence to the ticket, then commit the still-untracked #74/#75 evidence with that report.
- Live verification for #75 still owed: flag-on generation through the managed runtime with a request-id log join (start `./full-app`, then `./full-app logs intelligence --grep <request-id>`), and confirm coding codeless material refuses via resample while citation drops behave.
- Sequenced after #75: #76 RAG staged enforce (shares `worker.py`); queued last: #77 rubric flag queue.
- Blocked: none.
- `client.models.list()` is unusable against OpenRouter (documented SDK wrinkle); use the Models API directly if ever needed.
- Jev price on OpenRouter is not listed in the public models catalog (458 entries, no typesafe entry 2026-09-24); estimate held at the TypeSafe list $0.042/Mtok until the dashboard says otherwise.
