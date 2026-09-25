# State – jev-integration
_Spec: map #69 (https://github.com/rings0fsaturn/study-planner/issues/69) · Plan: active/jev-integration/plan/ · STATUS row: jev-integration · Status: active · Updated: 2026-09-24_

## Current state & next
- JevClient + question builders + unit tests + probe landed and verified 2026-09-24 (9/9 tests, ruff clean, live dry-run green).
- Slice-1 wiring implemented 2026-09-24 per #70 decisions (shared pre-gate, one flag, fail-open, middle-only citation): `JEV_SLICE1_ENABLED` (default off) + `GenerationWorker(jev=...)` + suitability pre-gate + worker-level citation adjudication; 10/10 new tests, 134 existing worker/validation/jev/coding green, ruff clean.
- Citation shadow-first implemented per #71 decisions (existing `JEV_SLICE1_ENABLED` flag, `AUTO_ACCEPT=0.8` held, confident rejects keep the soft warning with structured `jev_*` log fields; `citation_missing`/`malformed_output` split preserved for the post-#74 enforce flip): 11/11 slice-1 tests (new `says_nothing` shadow case), 145 worker/validation/jev/coding green, ruff clean. Live probe dry run blocked credential-side (`provider_credentials`, key present len 73 but API 401 x2, unrelated to the change - builders/client untouched).
- Live spend ~$0.0004 of the $0.5 budget (dashboard $0.0003 confirmed by user).
- #72 RAG scope closed 2026-09-24 (grilled + built same session): both slots staged with worker shadow first, shadow-first vs the sidecar, `JEV_SLICE2_TIMEOUT_MS=15000` ceiling on a dedicated client reusing `JEV_SLICE1_ENABLED`, top-by-relevance floor, one batched `decide()` per proceeded window; retrieval slot spec-only. 28/28 focused tests, 211 worker/validation/coding/jev green, ruff clean; probe dry run `provider_credentials` $0.00 (pre-existing). Uncommitted worktree.
- Next: #73 rubric runs parallel; #74 measurement waits on #73 after #72 closed; no live probe spent (builders unchanged).

## Done so far
- Plan-mode research: Jev primitives/confidence/API, OpenRouter Decisions + SystemOne surfaces, cost monitoring, cookbooks, jaggedness; app LLM + retrieval maps via explore agents.
- `app/jev/` package: `client.py` (typesafe_sdk wrapper, typed JevError, request_id logging, cost estimate) + `questions.py` (suitability/citation/passage/relevance/rubric builders + routers) + `tests/test_jev.py` (9/9 green).
- `scripts/jev_probe.py --limit 2` live-verified: passage include/exclude, citation verified@1.0, suitability derivable@1.0 + conservative review, relevance 0.96, rubric scores sane.
- Learned live: SystemOne surface returns no usage.cost/id/provider (docs describe Decisions shape); spend estimated at $0.042/Mtok via `estimate_cost_usd` + `JEV_PRICE_PER_MTOK`.
- Full backend suite: 726 passed; 18 failures all pre-existing/order-dependent (v1 goldens pass in isolation, retrieval-probe import fails on clean tree too).
- Slice-1 wiring (`GenerationWorkerConfig.jev_slice1_enabled` + `jev` duck-typed client, wired in `worker_main._build_generation_worker` only when the flag is on; off = zero `decide()` calls).
- Suitability pre-gate per window after widen, before prose: coding `not_derivable` rides the D-02 resample path to terminal `code_not_derivable`; objective/written stays advisory; every Jev failure fails open (log + proceed, never job-retryable).
- Citation middle-only adjudication after validate+repair: confident `supports` clears the soft warning, confident reject drops with the existing `citation_missing`/`malformed_output` split and no repair, rest keeps the soft warning; `validation.py` stays pure.

## Flow trace
1. All LLM prose flows through `OpenRouterGenerationClient` (services/intelligence/app/generation/openrouter_client.py:80), built by `factory.py:16` from `<PREFIX>_*` env vars.
2. Jev entry: `services/intelligence/app/jev/client.py::JevClient.from_env` reads `OPENROUTER_JEV_API_KEY` + `JEV_MODEL/_BASE_URL/_TIMEOUT_MS` (template in `.env.example`); SDK retries 429/5xx internally, wrapper classifies to typed codes.
3. Slices: suitability `app/jev/questions.py::suitability_questions` (Choice) + `route_suitability`; citations `citation_questions` (Choice) after free string-match; RAG `passage_questions` (4 Nouls) + `route_passage`; rerank `relevance_question` (Noul, sort desc); rubric `criterion_score_questions` (Score per criterion).
4. Probe: `services/intelligence/scripts/jev_probe.py --limit N --max-spend 0.40` loads `.env`, batches per state, aborts over budget.

## Files affected
- services/intelligence/app/jev/__init__.py, client.py, questions.py – Jev adapter + builders (new); #72 adds the batched passage builder + shared `_route_nouls` core + `from_env` timeout default.
- services/intelligence/tests/test_jev.py – 9 offline tests with fake SDK client (new).
- services/intelligence/scripts/jev_probe.py – budget-guarded live probe (new).
- services/intelligence/pyproject.toml – added typesafe-sdk==0.7.1 (+tenacity transitive).
- services/intelligence/.env.example – OPENROUTER_JEV_API_KEY + JEV_MODEL/BASE_URL/TIMEOUT_MS/PRICE_PER_MTOK template.
- services/intelligence/.env.example – JEV_SLICE1_ENABLED=false (slice-1 gate, default off).
- services/intelligence/app/generation/worker.py – slice-1 flag, suitability pre-gate, citation adjudication.
- services/intelligence/app/worker_main.py – builds JevClient only when the flag is on.
- services/intelligence/tests/test_generation_jev_slice1.py – 10 offline tests (flag-off parity, pre-gate, adjudication).
- .work/STATUS.md – jev-integration Active row.
- .agents/skills/jev/SKILL.md – Jev dev/debug skill (visible via .claude/skills symlink + .opencode/skills/jev copy).
- services/intelligence/app/generation/worker.py – #71 shadow branch + structured verdict log fields.
- services/intelligence/app/generation/worker.py – #72 passage shadow (`_summarize_passage_shadow` pure + `_jev_classify_passages_shadow` log-only hook, `jev_slice2` client).
- services/intelligence/app/worker_main.py – #72 second client (`JEV_SLICE2_TIMEOUT_MS`, default 15000).
- services/intelligence/.env.example – #72 `JEV_SLICE2_TIMEOUT_MS=15000` template.
- services/intelligence/tests/test_generation_jev_slice1.py – #71 shadow tests (contradicts + says_nothing).

## Pitfalls & rules
- Must keep API credentials server-side; never ship keys to the browser (Jev skill + rule 20 pattern).
- Must attach request_id/trace_id on every new backend log line and route HTTP errors through service_error per 17-logging-and-tracing.agents.md.
- Must not change assessment contracts: one family per call, failed is terminal, code_not_derivable stays honest per 42-assessment-and-practice-generation.agents.md.
- Must dry-run operator/probe scripts with --limit 2 before full runs per 80-script-dry-run-before-full-runs.agents.md.
- Jev jaggedness: no math/counting/dates in questions; one narrow judgment per question; small relevant state; thresholds tuned per question + pinned model version.
- OpenRouter SystemOne returns TypeSafe-shaped responses only (no cost/id/provider); estimate spend, do not expect usage.cost (verified live 2026-09-24).
- Full-suite v1 golden failures are order-dependent (pass in isolation); retrieval-probe import failure pre-exists on clean tree (verified 2026-09-24).

## Decisions in force
- Decided slices 1+2+4 first (suitability+citations, RAG/rerank fallback, rubric calibration); guardrails deferred (user, 2026-09-24).
- Decided official typesafe_sdk pointed at OpenRouter (`base_url=https://openrouter.ai/api`, model `jev-1.13` pinned) over thin httpx (user, 2026-09-24).
- Decided dedicated `OPENROUTER_JEV_API_KEY` from services/intelligence/.env (user, 2026-09-24); live halt at $0.40 estimated of the $0.5 budget.

## Open
- Frontier: #72 resolved + closed 2026-09-24 (grilled, built, resolution comment, map #69 Decisions-so-far line) + #73 rubric calibration (grilling, unblocked, parallel).
- Blocked: #74 measurement task on #73 (passage rows unblocked by #72; rubric rows depend on #73).
- `client.models.list()` unusable against OpenRouter (documented SDK wrinkle); use Models API directly if ever needed.
- Jev price on OpenRouter not listed in the public models catalog (458 entries, no typesafe entry 2026-09-24); estimate held at TypeSafe list $0.042/Mtok until dashboard says otherwise.
