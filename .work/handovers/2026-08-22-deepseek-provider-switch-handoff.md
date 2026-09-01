# Handoff — Phase 2 provider switch: continue with #53 / #54

> Handoff prompt for the next wayfinder session. Tickets #52, #55, #56 are
> closed; the frontier is grilling ticket #53 (runtime settings) then #54
> (contract amendment), then #38 implementation planning.

<handoff_prompt>

<role>
You are an engineering agent operating the `/wayfinder` skill ("Work through the map" mode) for repository `study-planner-web`, working the GitHub tracker `rings0fsaturn/study-planner`. This session resolves exactly ONE decision ticket from Phase 2 map [#4](https://github.com/rings0fsaturn/study-planner/issues/4): claim it, resolve it, post the resolution comment, close it, append one decision line to map #4, update `.work/STATUS.md` if state changed, and stop. You are planning, not building — production implementation happens only if your ticket explicitly graduates an execution slice (create it as a new child issue; do not implement it).
</role>

<start_here>
1. Read `AGENTS.md`, then `.work/STATUS.md`, then the rules index `.agents/rules/README.agents.md` and every rule its index selects for your task (minimum: 52-github-cli-and-token, 53-wsl-dev-runtime, 54-gpu-inference-sidecar, 80-script-dry-run-before-full-runs).
2. Load map [#4](https://github.com/rings0fsaturn/study-planner/issues/4) body (low-res view). Check `git status --short` and preserve unrelated worktree changes.
3. Claim your ticket by assigning it to `rings0fsaturn` **before** any work (`gh issue edit <n> --repo rings0fsaturn/study-planner --add-assignee rings0fsaturn`).
</start_here>

<where_we_left_off>
Branch `phase2/issue-38`, latest commit `bc2ac05`. The DeepSeek provider-switch effort is fully charted and three tickets closed on 2026-08-22:

- **#52 Provision OpenRouter access** — CLOSED. `OPENROUTER_API_KEY` lives in `services/intelligence/.env` (never print/commit it; ~$2.33 credit left of $2.50). `GEMINI_API_KEY` stays: Gemini is retained ONLY as the embedding fallback. `docker-compose.yml` passes `OPENROUTER_API_KEY` to both `intelligence` and `ingestion-worker` by env reference.
- **#55 Research DeepSeek/OpenRouter mechanics** — CLOSED. Findings doc: `research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md`. NOTE: this file is still **untracked** in git while committed docs reference it — commit it early in your session.
- **#56 Probe DeepSeek × Qwen sidecar quality** — CLOSED. Evidence + report at `research/doc/deepseek-generation-probe/{raw.jsonl, contexts.json, summary.json, report.md}`; probe script `services/intelligence/scripts/generation_probe.py` (throwaway, 10 unit tests) + plan runbook `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/{PLAN.md, VERIFICATION.md}`.
</where_we_left_off>

<decisions_already_made>
Do not re-litigate these (map #4 records them):

1. **Sole generation provider**: `deepseek/deepseek-v4-flash-0731` via OpenRouter, called through the **OpenAI Python SDK** (`base_url="https://openrouter.ai/api/v1"`), behind a repository-owned **model-neutral interface** — no SDK types leak past the seam. Gemini chat removed outright; **Ollama fallback dropped** from spec #32 text. Gemini remains embeddings-fallback only.
2. **Reasoning OFF for objective question generation** (user decision from #56 evidence).
3. Contract pack must become **provider-neutral**: rewrite `services/intelligence/contracts/phase2/gemini/*` (request/response envelopes), regenerate fixtures, update `test_contracts.py`, `openapi.yaml` refs, `PIPELINES.md` wording, `TRACEABILITY.md`, `gemini/README.md`, and the `gemini_rubric` grader enum in `durable-events.schema.json` (free rename — zero graded events exist). Spec #32's "Gemini default + Ollama fallback" lines get amended too.
4. Out of scope for this effort: embeddings changes (Qwen sidecar primary / Gemini fallback stays), guide SSE + gated-reveal implementation (later slices inherit the amended envelopes), written-grading implementation, browser/app-package changes, LLM-faithfulness judging (deferred to harness #48).
</decisions_already_made>

<measured_evidence_for_53>
From the 395-record #56 probe (authoritative numbers in `research/doc/deepseek-generation-probe/report.md`) — the evidence #53 decides from. Pairs are S layer / R layer.

| Tier | contract-valid | citation-valid | gold-support (S) | p50 / p95 latency | >30 s calls |
|---|---|---|---|---|---|
| off | 96.7% / 100% | 93.1% / 86.7% | 72.4% | 4.0 s / 10.5 s; 4.8 s / 20.8 s | 0 / 0 |
| low | 90.0% / 96.8% | 85.2% / 86.7% | 77.8% | 16.5 s / 133.6 s; 14.6 s / 100.5 s | 9 / 10 |
| medium | 96.7% / 93.5% | 86.2% / 96.5% | 72.4% | 11.5 s / 40.9 s; 11.4 s / 40.0 s | 5 / 3 |
| high | 96.7% / 96.8% | 93.1% / 83.3% | 86.2% | 12.6 s / 30.6 s; 9.8 s / 102.3 s | 3 / 5 |
| xhigh | 100% / 96.8% | 100% / 93.3% | 83.3% | 15.0 s / 41.5 s; 6.1 s / 59.5 s | 6 / 4 |
| max | 96.7% / 96.8% | 89.7% / 93.3% | 75.9% | 11.8 s / 106.2 s; 6.6 s / 57.1 s | 5 / 5 |

Other hard facts: reasoning tokens are 78–101% of completion tokens on reasoning tiers (~2× cost); all six tiers accepted by OpenRouter routing (no tier ceiling); strict-schema enforcement **varies by routed endpoint** — 4/383 outputs drifted (options-as-objects, `question`/`answer`/`chunkIds` shapes) and one record carried garbage `chunkId`s → local schema re-validation is mandatory regardless of strict mode; `json_object` mode returns its own shape (**0% contract-valid**) → not a viable fallback without a transform/repair step; `reasoning_details` continuation accepted at medium/high/xhigh/max, failed once at `low`; S-vs-R delta negligible (Qwen-sidecar handoff costs ~nothing); total probe cost ~$0.17.

Catalog facts (#55): context 1.31 M advertised / 1.05 M endpoint-capped, max completion 384 K; pricing $0.08/M prompt, $0.18/M completion, $0.016/M cache-read; text-only modality.
</measured_evidence_for_53>

<ticket_53_brief>
Question: which runtime settings does the model-neutral generation interface ship with? Decisions to lock (evidence above):

- Reasoning effort per task: `off` for `assessment_generation` (already user-agreed); explicitly decide whether written grading / guide tasks get their own tiers later or default off until re-tested (recommendation recorded in #53's pointer comment: separate re-test before enabling).
- Timeout budget: the contract pack's `timeoutMs: 30000` const for generation vs measured reality (off-tier p50 ~4 s, zero breaches; reasoning tiers breach routinely). Decide keep-30s-for-off vs raise.
- Temperature/top_p pinning (probe left them unset → provider defaults; production interface should pin).
- Local schema validation after every response even with strict mode (endpoint drift measured) — make it a contract requirement.
- Retry/quota mapping onto `provider-error.schema.json` codes given OpenRouter shapes (`tier_rejected` 400s, 429 retry-after, 402 credits) and SDK `max_retries=0` + single app-level retry pattern from the probe.
- Telemetry fields: add reasoning-token counts to `generation-telemetry.schema.json` usage? Decide yes/no + shape.
- Env/config naming: `OPENROUTER_API_KEY` (already plumbed through compose) and any `GENERATION_*` settings names.

Record decisions in the resolution comment; close; map line. If any decision requires a contract change, note it as input to #54 rather than editing files.
</ticket_53_brief>

<ticket_54_brief>
Question: how exactly does the approved Gemini-shaped contract pack become internally consistent with the new provider reality? The planning-session lean (re-decidable): neutralize the existing `gemini/*` envelopes in place (rename dir to e.g. `provider/` or keep paths but generalize) rather than adding an `openrouter/` sibling — the README already calls the response envelope "provider-neutral" and nothing is implemented yet, so this is the cheapest moment. Decide:

- Envelope field mapping: OpenAI-style roles/finish reasons (`stop|length|content_filter|error` + `native_finish_reason`) → normalized outcome enums; refusal handling; usage incl. optional reasoning-token counts; where `require_parameters`/routing constraints live (adapter detail, not public contract).
- Whether the request envelope keeps Gemini-native fields (`responseSchema`, `responseMimeType`, `safetySettings`, `timeoutMs` const) or becomes neutral (a plain schema object, timeout budget per #53).
- Fixture regeneration: the six `generation-*.json` fixtures + manifest + `test_contracts.py` regenerated against captured DeepSeek shapes (`raw.jsonl` has sanitized real responses to seed them).
- Spec #32 text amendment + map #4 Notes wording.
- Scope boundary: decide + specify; graduate the file edits into a new implementation-slice ticket (child of #4/#38) rather than editing contracts yourself.
</ticket_54_brief>

<environment_gotchas>
- **gh CLI**: token from `.env.git.local` via `export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')`; wrap every call in a 5-attempt retry loop; transient api.github.com TLS/EOF failures are network flakiness, not config. `gh issue view` without `--json` dies on the Projects-classic GraphQL deprecation — always use `--json`.
- **Secrets**: never print/echo/log keys; keep values in shell variables. `OPENROUTER_API_KEY` in `services/intelligence/.env`; Supabase creds in the same file for probes.
- **WSL runtime** (rule 53): dotenv never overrides exported env vars — launch scripts with `env -u OPENROUTER_API_KEY -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY -u EMBEDDER_URL uv run --package intelligence python scripts/...` so the `.env` loader owns values. Vite doesn't watch `/mnt/d`. `pkill -f` can kill your own shell — use character classes or PIDs. Background processes need `setsid nohup ... &`.
- **GPU sidecar** (rule 54): demand-start only, burns ~2 cores while running. If any ticket work needs it: `docker compose -f services/embedder/docker-compose.yml up -d`, health-gate on `/health` (`cuda_available`, `loaded`, `reranker_loaded`), stop immediately after.
- **Rule 80**: minimal-scoped dry run of any script after every code edit before any full run; prefer offline checks first (import parse, ruff, unit tests, `--summarize`).
- **Git**: conventional commits with body + `Co-authored-by: GitHub Copilot using <your model name>`. Untracked `.work/active/tracker-19-aug/` is pre-existing unrelated work — leave it alone. Commit `research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md` (currently untracked but referenced by committed docs). Check new files for em/en dashes (repo convention).
</environment_gotchas>

<definition_of_done>
1. Ticket claimed (assignee set) before work started.
2. Decision(s) recorded as a resolution comment on the ticket; ticket closed.
3. Map #4 updated: one Decisions-so-far line; any fog graduated to new tickets (create-then-wire); nothing silently dropped.
4. `.work/STATUS.md` row added/updated in the same session if project state changed; `last_updated` bumped.
5. Any newly created implementation-slice ticket carries `## Parent` (spec #32 / map #4 / slice #38), labels `wayfinder:phase2` (+ type), and a `## Blocked by` section naming its real blockers.
6. Session stops after ONE ticket resolution. Next frontier after your session: the other grilling ticket, then #38 implementation planning.
</definition_of_done>

<do_not>
- Do not start implementing #38 or editing contract files (that belongs to the graduated slice from #54).
- Do not touch embeddings, browser code, guide SSE, written grading, or harness #48 (still blocked by #38+#43).
- Do not re-run the quality probe or spend API credits unless a decision genuinely needs new data — and then follow rule 80 (dry run first).
- Do not resolve more than one wayfinder ticket this session.
- Do not modify the immutable sections of any plan doc (Decisions log, preamble, TL;DR, out-of-scope).
</do_not>

</handoff_prompt>