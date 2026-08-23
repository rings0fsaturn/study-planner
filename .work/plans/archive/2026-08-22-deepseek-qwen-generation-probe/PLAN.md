# How to use this plan

> **You are the implementing agent.** This document is your runbook for one cohesive change to this codebase. Read this preamble in full before doing anything else.

## What you're holding

A phase-by-phase implementation plan. Each phase is a **vertical slice** designed so any one of them can be implemented by a fresh agent in a new context window, with only this document and the codebase as input.

## Your job

1. **Read the document header in full first** (TL;DR, Context, Decisions log, Files-touched index).
2. **Find your starting phase**: first `☐ Not started` whose dependencies are `✅ Complete`. Implement that phase only.
3. **Run prereq verification. If any fail, STOP** and surface to the human.
4. **Follow steps in order.** Code blocks are the actual code.
5. **If reality doesn't match the step — STOP.** Surface discrepancies; do not improvise.
6. **Run tests and post-verification.** All must pass before the phase is done.
7. **Update status and commit** the phase together with this plan file's status line.

## What you must NOT do

- Do not skip phases or implement multiple phases without surfacing for review.
- Do not modify the Decisions log, preamble, TL;DR, Open questions, Out-of-scope, or References.
- Do not re-plan or re-architect — surface instead.

## Status vocabulary

`☐ Not started` · `🟡 In progress` · `🛑 Blocked: <reason>` · `✅ Complete — <sha>`

---

# DeepSeek × Qwen-sidecar generation-quality probe (#56)

**Slug:** `2026-08-22-deepseek-qwen-generation-probe`
**Date written:** 2026-08-22
**Author:** ox-alpha + user (wayfinder planning session)
**Plan status:** In execution
**Upstream:** [#56](https://github.com/rings0fsaturn/study-planner/issues/56) · parent map [#4](https://github.com/rings0fsaturn/study-planner/issues/4) · feeds grilling ticket [#53](https://github.com/rings0fsaturn/study-planner/issues/53)

## TL;DR

Build a throwaway offline probe (`generation_probe.py`) that measures how well `deepseek/deepseek-v4-flash-0731` (via OpenRouter, OpenAI Python SDK) authors grounded multiple-choice questions from contexts retrieved by the current Qwen3 sidecar pipeline. It sweeps the full reasoning-effort ladder (off → low → medium → high → xhigh → max) over two context layers (retrieval-driven "seeded", corpus-sampled "random"), plus a JSON-object fallback arm and a reasoning-continuation check, recording validity, grounding, craft, diversity, latency, token, and cost metrics. Results land in `research/doc/deepseek-generation-probe/`, then ticket #56 closes with a resolution comment and the measured inputs are handed to #53. No production code changes beyond adding the `openai` dependency and the throwaway script.

## Context & background

Phase 2 generation (#38) will call an LLM through a provider-neutral interface; the provider decision was charted on map #4: DeepSeek via OpenRouter replaces Gemini outright for chat models ([#55](https://github.com/rings0fsaturn/study-planner/issues/55) banked the mechanics). Before locking runtime settings (#53), the user requires measured evidence comparing reasoning tiers and validating the DeepSeek × Qwen-sidecar seam end-to-end. The dev corpus (572-page textbook, material `80c8b138-b544-4095-8dc0-1c390ac70da2`, 754 chunks, `qwen-sidecar`, ready) and the 30-question multi-gold set exist from the retrieval-quality program. This plan executes wayfinder task ticket #56 only.

**Support docs:**

- Research findings (wire shapes, errors, continuation): [`research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md`](../../../research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md)
- Retrieval methodology to reuse: [`services/intelligence/scripts/retrieval_probe.py`](../../../services/intelligence/scripts/retrieval_probe.py)
- Question contract intent: [`services/intelligence/contracts/phase2/question-slot.schema.json`](../../../services/intelligence/contracts/phase2/question-slot.schema.json)
- Sidecar ops: `.agents/rules/54-gpu-inference-sidecar.agents.md`; WSL/env quirks: `.agents/rules/53-wsl-dev-runtime.agents.md`

## Decisions log

### D-01: Sole provider = DeepSeek via OpenRouter through `openai` Python SDK
**Status:** ✅ Agreed
**Context:** Gemini hit free-tier limits; provider replaced outright per charting decision on map #4.
**Decision:** All probe calls go through `openai.OpenAI(base_url="https://openrouter.ai/api/v1")` with `OPENROUTER_API_KEY` from `services/intelligence/.env`.
**Rationale:** User mandate; SDK gives typed retries/errors we deliberately coordinate (D-08).
**Alternatives considered:** httpx hand-rolled client → rejected: user specified SDK; also SDK behavior itself is under evaluation.
**Reversibility:** easy — probe is throwaway.

### D-02: Two evaluation layers (seeded + random)
**Status:** ✅ Agreed
**Context:** User challenged gold-set reuse: it was built for retrieval quality, so using it alone conflates retrieval noise with generation quality.
**Decision:** Layer S (seeded): 30 gold questions drive retrieval → generation (pipeline-realistic, imperfect retrievals included; snippets serve as support oracle). Layer R (random): 30 contexts sampled deterministically directly from the 754-chunk corpus (isolates generation from retrieval).
**Rationale:** S-vs-R delta quantifies the sidecar handoff cost; R isolates model craft.
**User pushback:** user asked "is the gold set actually good for the DeepSeek test?" → resolved by this split.
**Reversibility:** easy.

### D-03: Full reasoning ladder, inclusive
**Status:** ✅ Agreed
**Context:** Runtime reasoning default must be chosen from evidence, not preset.
**Decision:** Effort tiers swept exhaustively: `off, low, medium, high, xhigh, max`. Tiers rejected by the routed provider are recorded gracefully (400-taxonomy) and skipped.
**Rationale:** User explicitly requested all tiers between none and max.
**Alternatives considered:** two-extremes-only sweep → rejected by user clarification.
**Reversibility:** easy.

### D-04: Strict `json_schema` primary; `json_object` fallback arm
**Status:** ✅ Agreed
**Context:** Production needs schema-valid structured output.
**Decision:** Arms E0–E5 use `response_format json_schema strict:true` plus `extra_body.provider.require_parameters=true`. Arm C runs `json_object` (reasoning off, layer R only) with local schema validation and failure-mode tally.
**Rationale:** Per #55 findings: enforcement varies by endpoint; require_parameters pins capability. C validates the documented fallback path.
**Reversibility:** easy.

### D-05: Replicate retrieval via direct RPC, not `/v1/retrieval/search`
**Status:** ✅ Agreed
**Context:** The HTTP endpoint requires a user JWT; the probe is operator-run.
**Decision:** Import `load_env_file`, `embed_query_sidecar`, `fetch_chunks`, `rank_with_rpc` from `scripts/retrieval_probe.py` and call `match_content_chunks` with `query_text` (hybrid) exactly like the frozen methodology (dense+BM25 RRF k=60, top_k=50 fetched, top-5 used as context).
**Rationale:** Byte-identical retrieval semantics to prior measurements; avoids auth machinery.
**Alternatives considered:** calling the endpoint with a password-grant token → rejected: unnecessary coupling and credential surface.
**Reversibility:** easy.

### D-06: Evidence layout + crash-resume
**Status:** ✅ Agreed
**Context:** ~400 calls can be interrupted; rerunning costs money.
**Decision:** Append each result as one JSON line to `research/doc/deepseek-generation-probe/raw.jsonl` keyed by `(layer, tier, index)`; reruns skip keys already present. Final artifacts: `summary.json` + `report.md` in the same directory.
**Rationale:** Idempotent resume; evidence co-located with other dated research docs.
**Reversibility:** easy.

### D-07: No secrets, no prompts persisted
**Status:** ✅ Agreed
**Context:** Repo security conventions.
**Decision:** Key read from env only, never printed/logged/committed. Raw prompts are NOT stored; stored records contain sanitized generated outputs, chunk ids, metrics, and provider metadata (model, routed provider echo, finish reasons, usage). Generated question content may be stored (source is a public textbook).
**Reversibility:** easy.

### D-08: One retry layer, bounded concurrency
**Status:** ✅ Agreed
**Context:** SDK default retries would multiply app retries (#55 finding); higher tiers can run minutes.
**Decision:** `OpenAI(max_retries=0)`; application performs at most 1 retry for 429/5xx with jittered backoff (2 s, 8 s). `ThreadPoolExecutor(max_workers=6)`; per-call timeout 180 s (timeout ⇒ outcome `timeout`, not crash).
**Reversibility:** easy.

### D-09: Difficulty = self-assessed distribution only
**Status:** ✅ Agreed
**Context:** Gold set has no difficulty labels.
**Decision:** Record the model's self-assessed band (1–5) distribution per arm; true calibration is deferred to harness #48.
**Reversibility:** easy.

## Files touched (index)

| Path | Change | Phase | Purpose |
|---|---|---|---|
| `services/intelligence/pyproject.toml` | modify | 2 | add `openai` dependency |
| `uv.lock` | regenerate | 2 | lockfile sync |
| `services/intelligence/scripts/generation_probe.py` | new | 2–4 | the throwaway probe |
| `services/intelligence/tests/test_generation_probe.py` | new | 3 | pure-function unit tests |
| `research/doc/deepseek-generation-probe/raw.jsonl` | generated | 5 | one line per call (sanitized) |
| `research/doc/deepseek-generation-probe/contexts.json` | generated | 2/5 | retrieved/sampled contexts cache |
| `research/doc/deepseek-generation-probe/summary.json` | generated | 6 | aggregated metrics |
| `research/doc/deepseek-generation-probe/report.md` | generated | 6 | human-readable findings |
| `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/PLAN.md` | new | 0 | this plan |
| `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/VERIFICATION.md` | new | 0 | per-phase verification log |
| `.work/STATUS.md` | modify | 6 | Done row + last_updated |

External (not files): claim/close GitHub #56; map #4 decision line; pointer comment on #53.

---

## Phases

### Phase 1: Claim ticket and stand up the runtime

**Status:** ✅ Complete — 89dde1d (plan docs commit; runtime verified in-session)
**Depends on:** none — can start immediately
**Estimated scope:** 0 files, ops only

#### Codebase state assumed at start
- `services/intelligence/.env` contains non-empty `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMBEDDER_URL`, `OPENROUTER_API_KEY`.

#### Verification (run BEFORE starting)
```bash
for v in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY EMBEDDER_URL OPENROUTER_API_KEY; do grep -c "^${v}=..*" services/intelligence/.env; done   # four lines of >=1
curl -s https://openrouter.ai/api/v1/models | python3 -c "import json,sys;print('deepseek/deepseek-v4-flash-0731' in [m['id'] for m in json.load(sys.stdin)['data']])"   # True
```

#### Steps
1. Claim GitHub #56 (assignee `rings0fsaturn`) before any work.
2. Start the GPU sidecar demand-style (rule 54) and wait for healthy GPU state.
3. Check credit headroom (must be > $0.50); record balance in VERIFICATION.md. Never print the key.

#### Verification (DONE)
- `#56` shows assignee; `/health` returned `cuda_available: true`.

#### Rollback
`docker compose -f services/embedder/docker-compose.yml stop`. Unassign ticket only if abandoning.

---

### Phase 2: Dependency + probe skeleton with retrieval and sampling

**Status:** ☐ Not started
**Depends on:** Phase 1
**Estimated scope:** ~2 files, ~250 lines

#### Codebase state assumed at start
- `scripts/retrieval_probe.py` exports `load_env_file`, `embed_query_sidecar`, `fetch_chunks`, `rank_with_rpc`; module imports only stdlib+httpx at top level.

#### Steps
1. `uv add --package intelligence "openai>=1"`
2. Create `services/intelligence/scripts/generation_probe.py` with constants, imports, retrieval reuse, deterministic sampler, JSONL store, CLI.
3. Deterministic layer-R sampler: fetch all embedded chunk ids once via `fetch_chunks`, sort by `ordinal`, split into 30 contiguous bands, pick one chunk per band with `random.Random(SEED)`; single-chunk contexts.
4. JSONL store: `load_done_keys() -> set[tuple]`; `append_result(record)` append + flush.
5. CLI: `--tiers`, `--layers` (S,R,C), `--limit N`, `--concurrency` (default 6); retrieve contexts cached to `contexts.json`.
6. Sanity: module imports without side effects.

#### Verification (DONE)
```bash
uv add --package intelligence "openai>=1" && git diff --stat uv.lock | wc -l   # >0
python3 -c "import ast,pathlib; ast.parse(pathlib.Path('services/intelligence/scripts/generation_probe.py').read_text()); print('syntax OK')"
```

#### Rollback
`git checkout -- services/intelligence/pyproject.toml uv.lock`; delete the new script.

---

### Phase 3: Provider client, error taxonomy, metrics, and tests

**Status:** ☐ Not started
**Depends on:** Phase 2
**Estimated scope:** ~1–2 files, ~300 lines

#### Codebase state assumed at start
- `generation_probe.py` exists with constants/sampler/store; `openai` importable inside the intelligence package env.

#### Steps
1. Request builders: `reasoning_extra(tier)`, `build_kwargs(tier, messages)` (strict `json_schema` + `require_parameters`; arm C `json_object`; `max_tokens=12000`; `seed=SEED`; `timeout=180`).
2. Client factory: `OpenAI(base_url=BASE_URL, api_key=require_key(), max_retries=0)`; key from env only.
3. Prompts: `SYSTEM` (grounded rules, synthesis-over-copy), `USER_SEEDED` (with topic steer), `USER_RANDOM`; chunk blocks `<chunk id="...">text</chunk>` truncated to 2400 chars.
4. Call wrapper with outcome taxonomy (`ok | truncated | refusal | content_filter | provider_error | tier_rejected | rate_limited | credit_or_auth | timeout | malformed_json`); one app retry for 429/5xx; record `{key, outcome, finish_reason, native_finish_reason, latency_ms, usage, routed provider echo, parsed_ok, mcq, error sanitized}`; sanitizer strips `sk-or-` values.
5. Continuation check per tier (low..max): replay assistant message with `reasoning_details` unmodified + "Are you sure? Think carefully."
6. Pure metric functions: schema_valid_rate, citation_valid_rate, gold_support_rate (S), copy_through_rate (12-word shingles), option_position_counts, distractor_mean_cosine, near_dup_rate (>=0.95), latency_p50_p95, token_cost_summary, difficulty_distribution, json_mode_failure_modes. Embed stems/options during run (store vectors in records) so summarize stays offline.

#### Tests
Create `services/intelligence/tests/test_generation_probe.py` covering: finish-reason/HTTP classification, tier-rejected detection, build_kwargs strict vs json mode, citation/gold-support/copy-through math, near-dup and position histogram, sanitizer redaction. Run: `uv run --package intelligence pytest services/intelligence/tests/test_generation_probe.py -q`.

#### Verification (DONE)
```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_probe.py -q   # all pass
uv run ruff check services/intelligence/scripts/generation_probe.py services/intelligence/tests/test_generation_probe.py   # clean
rg -n '[–—]' services/intelligence/scripts/generation_probe.py   # no matches
```

#### Rollback
Delete the two new files; `git checkout -- pyproject.toml uv.lock`.

---

### Phase 4: Live smoke run (cost-and-shape gate)

**Status:** ☐ Not started
**Depends on:** Phase 3 (sidecar already up from Phase 1)
**Estimated scope:** 0 new files; produces smoke evidence

#### Steps
1. `cd services/intelligence && env -u OPENROUTER_API_KEY uv run --package intelligence python scripts/generation_probe.py --layers S,R --tiers off --limit 2 --concurrency 2` (clean shell env per rule 53).
2. Inspect `raw.jsonl`: every record classified, plausible latencies, reasoning==0 for off tier, parsed_ok for ok rows, citations ⊆ provided ids. Project full-run cost; abort + surface if > $1.00.
3. Delete `raw.jsonl` after smoke (keep `contexts.json`).

#### Verification (DONE)
- 4 smoke calls classified; cost projection recorded in VERIFICATION.md.

#### Rollback
Nothing persistent outside `research/doc/deepseek-generation-probe/`.

---

### Phase 5: Full-ladder run

**Status:** ☐ Not started
**Depends on:** Phase 4
**Estimated scope:** evidence files only; wall-clock ~15–60 min

#### Steps
1. Confirm sidecar healthy. Run the matrix (S,R × off,low,medium,high,xhigh,max; then C × json). Resume-safe via done-keys.
2. `credit_or_auth` outcomes → STOP, surface to human.
3. Immediately after completion, stop the sidecar (rule 54).

#### Verification (DONE)
```bash
wc -l research/doc/deepseek-generation-probe/raw.jsonl   # >= 390 expected keys (fewer only if tiers rejected)
python3 - <<'EOF'
import json,pathlib
rows=[json.loads(l) for l in pathlib.Path("research/doc/deepseek-generation-probe/raw.jsonl").read_text().splitlines()]
print({o:sum(r["outcome"]==o for r in rows) for o in {r["outcome"] for r in rows}})
EOF
docker ps --filter name=embedder --format '{{.Names}} {{.Status}}'   # sidecar stopped/exited
```

#### Rollback
`raw.jsonl` is append-only evidence; partial runs resume, never corrupt.

---

### Phase 6: Report, close the ticket, feed #53

**Status:** ☐ Not started
**Depends on:** Phase 5
**Estimated scope:** 3 generated/edited files + GitHub updates

#### Steps
1. `--summarize` (offline): aggregates metrics per (layer, tier) into `summary.json` + `report.md`. Required tables: validity per tier; grounding (gold-support % S, copy-through %); craft/diversity (option histogram, distractor cosine, near-dup %, skillTag vocab); difficulty distribution; economics/latency (p50/p95 vs the 30 s budget, reasoning-token share curve, total cost); continuation acceptance; S-vs-R delta section.
2. Review the report with the human (HITL gate — do not close #56 before this).
3. Post resolution comment on #56, close it, append one Decisions-so-far line to map #4.
4. Comment on #53 linking `report.md`.
5. Update `.work/STATUS.md` (last_updated + Done row); fill VERIFICATION.md; mark phase Status lines ✅ with commit shas.

#### Verification (DONE)
```bash
test -s research/doc/deepseek-generation-probe/report.md && echo report-present
git diff --check
export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
gh issue view 56 --repo rings0fsaturn/study-planner --json state --jq .state   # CLOSED
```

#### Rollback
Report/evidence are additive; GitHub closure can be reopened if the human rejects findings.

---

## Open questions

### OQ-01: Are `xhigh`/`max` accepted by the routed providers?
**Why deferred:** Only discoverable empirically; the catalog doesn't enumerate accepted effort enums per endpoint.
**Triggers:** Any `tier_rejected` outcomes in Phase 5 — they become a headline finding, not a blocker.
**Owner/resolution:** The probe itself; results feed #53.
**Cross-ref:** D-03.

### OQ-02: Exact spelling of mid tiers (`medium` vs `med`)
**Why deferred:** Docs say `low|medium|high`; user shorthand "med/xhigh/max" mapped to the documented enum plus empirical extras.
**Triggers:** 400 errors naming the parameter during smoke.
**Owner/resolution:** Probe records the raw provider message per rejection.

## Out of scope

- **Production interface/contract changes** — owned by grilling ticket #54; the probe is measurement-only.
- **Written grading, guide SSE, browser changes, embedding changes** — later slices per map #4 out-of-scope notes.
- **LLM-faithfulness groundedness judging** — deferred to harness #48; online proxy here is citation-id validity + gold-snippet support.
- **Difficulty calibration against labels** — no gold difficulty exists (D-09).

## References

- Ticket #55 findings (SDK config, strict-schema caveats, continuation shape, error envelopes) — `research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md`
- Retrieval methodology + reusable helpers — `services/intelligence/scripts/retrieval_probe.py`
- Gold question set — `services/intelligence/scripts/probe_questions.json` (30 items: `label/question/answerSnippet[/altSnippets]`)
- Hybrid retrieval semantics — `services/intelligence/app/routers/retrieval.py:27`
- GPU sidecar lifecycle — `.agents/rules/54-gpu-inference-sidecar.agents.md`; WSL env/process quirks — `.agents/rules/53-wsl-dev-runtime.agents.md`
- Prior evidence-folder precedent — `.work/plans/archive/2026-08-17-sidecar-embed-live-e2e/evidence/`