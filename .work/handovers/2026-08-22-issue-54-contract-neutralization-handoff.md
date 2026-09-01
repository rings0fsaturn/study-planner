# Handoff - Phase 2 contract neutralization: resolve #54

> Handoff prompt for the next wayfinder session. Tickets #52, #55, #56, #53 are
> closed; the frontier is grilling ticket #54 (provider-neutral contract pack),
> then #38 implementation planning.

<handoff_prompt>

<role>
You are an engineering agent operating the `/wayfinder` skill ("Work through the
map" mode) for repository `study-planner-web`, working the GitHub tracker
`rings0fsaturn/study-planner`. This session resolves exactly ONE decision
ticket from Phase 2 map [#4](https://github.com/rings0fsaturn/study-planner/issues/4):
claim it, resolve it, post the resolution comment, close it, append one decision
line to map #4, update `.work/STATUS.md` if state changed, and stop. You are
planning, not building: production implementation happens only via a graduated
slice. Create the contract-edit work as a NEW child issue of #4/#38 and do not
edit any contract files yourself.
</role>

<start_here>
1. Read `AGENTS.md`, then `.work/STATUS.md`, then the rules index
   `.agents/rules/README.agents.md` and every rule its index selects for your
   task (minimum: 52-github-cli-and-token, 53-wsl-dev-runtime,
   80-script-dry-run-before-full-runs).
2. Load map [#4](https://github.com/rings0fsaturn/study-planner/issues/4) body
   (low-res view). Check `git status --short` and preserve unrelated worktree
   changes.
3. Claim ticket #54 by assigning it to `rings0fsaturn` BEFORE any work
   (`gh issue edit 54 --repo rings0fsaturn/study-planner --add-assignee rings0fsaturn`).
</start_here>

<where_we_left_off>
Branch `phase2/issue-38`, latest commit `f25dd42`. The DeepSeek provider-switch
effort has four of five tickets closed on 2026-08-22:

- **#52 Provision OpenRouter access** - CLOSED. `OPENROUTER_API_KEY` lives in
  `services/intelligence/.env` (never print/commit it; ~$2 credit remaining).
  Compose passes it to both `intelligence` and `ingestion-worker` by env
  reference.
- **#55 Research DeepSeek/OpenRouter mechanics** - CLOSED. Findings committed
  at `research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md`.
- **#56 Probe DeepSeek x Qwen sidecar quality** - CLOSED. Evidence + report at
  `research/doc/deepseek-generation-probe/{raw.jsonl, contexts.json,
  summary.json, report.md}`; probe script
  `services/intelligence/scripts/generation_probe.py` (10 unit tests); runbook
  under `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/`.
- **#53 Generation runtime settings** - CLOSED. Resolution comment records the
  eight locked runtime decisions (below) and maps the reasoning-re-test
  obligations onto slices [#41](https://github.com/rings0fsaturn/study-planner/issues/41)
  (written_grading) and [#46](https://github.com/rings0fsaturn/study-planner/issues/46)
  (guide_hint/guide_reveal) via cross-reference comments on those tickets.

Map #4 fog already records that the provider seam has only #54 open.
</where_we_left_off>

<decisions_already_made>
Do not re-litigate these (map #4 records them):

Standing provider decisions:
1. Sole generation provider: `deepseek/deepseek-v4-flash-0731` via OpenRouter,
   called through the OpenAI Python SDK
   (`base_url="https://openrouter.ai/api/v1"`), behind a repository-owned
   model-neutral interface. No SDK types leak past the seam. Gemini chat
   removed outright; Ollama fallback dropped from spec #32 text. Gemini remains
   embeddings-fallback only.
2. Reasoning OFF for objective question generation (#56 evidence).

#53 runtime decisions that constrain the contract shapes (resolution comment
on #53 is authoritative):
3. Reasoning effort is an explicit neutral knob defaulting off for every task;
   written_grading / guide tasks flip on only after a probe re-test.
4. Timeout becomes per-task config `GENERATION_TIMEOUT_MS` (30 s default for
   assessment_generation), replacing the single `timeoutMs: 30000` const.
5. Output budget `GENERATION_MAX_OUTPUT_TOKENS`, default 4096.
6. Temperature pinned at 0.3; top_p omitted; no seed pinning.
7. Local schema validation after EVERY response regardless of strict mode or
   require_parameters: a contract requirement, not adapter folklore.
8. Retry matrix: SDK `max_retries=0`; exactly ONE application-level retry for
   retryable classes (rate_limited honoring Retry-After capped at 60 s,
   provider_unavailable, provider_timeout); never retry credentials, quota, or
   safety outcomes; malformed output follows #13's one-repair-else-drop rule;
   a NEW non-retryable `unsupported_request` code joins the provider-error
   enum for capability/tier-rejection 400s.
9. Optional integer `reasoningTokens` field joins
   `generation-telemetry.schema.json` (from
   `completion_tokens_details.reasoning_tokens`, omitted when absent).
10. Env naming: keep `OPENROUTER_API_KEY`; add `GENERATION_MODEL`,
    `GENERATION_BASE_URL`, `GENERATION_TIMEOUT_MS`,
    `GENERATION_MAX_OUTPUT_TOKENS`, `GENERATION_TEMPERATURE`,
    `GENERATION_REASONING_EFFORT`.
</decisions_already_made>

<ticket_54_brief>
Question: how does the approved Gemini-shaped contract pack become internally
consistent with the new provider reality while preserving the public normalized
boundary?

Planning-session lean (re-decidable on the ticket): neutralize the existing
`services/intelligence/contracts/phase2/gemini/*` envelopes IN PLACE (rename
the dir to e.g. `provider/` or keep paths but generalize) rather than adding an
`openrouter/` sibling. The README already calls the response envelope
provider-neutral and nothing is implemented yet, so this is the cheapest
moment. Decide:

- Envelope field mapping: OpenAI-style roles and finish reasons
  (`stop|length|content_filter|error` plus `native_finish_reason`) mapped onto
  the normalized outcome enums; refusal handling (`message.refusal`); usage
  incl. optional reasoning-token counts; where `require_parameters` and routing
  constraints live (adapter detail, not public contract); placement of the new
  `unsupported_request` error code.
- Whether the request envelope keeps Gemini-native fields (`responseSchema`
  OBJECT shape, `responseMimeType`, `safetySettings`, `timeoutMs` const) or
  becomes neutral (a plain JSON Schema object; per-task timeout and token
  budgets per #53; sampling reflecting temperature-only pinning).
- Embeddings scope note: `gemini/embedding-request.schema.json` legitimately
  stays Gemini-shaped because Gemini remains the embeddings fallback; decide
  explicitly whether it stays put, moves, or gets a README note rather than
  blanket-renaming the whole dir.
- Fixture regeneration approach: the six `generation-*.json` fixtures +
  `manifest.json` + `tests/test_contracts.py` regenerated against captured
  DeepSeek shapes (`research/doc/deepseek-generation-probe/raw.jsonl` holds
  sanitized real responses to seed them); touch affected written-grading and
  guide fixtures only where envelope shapes change there.
- Mechanical refactors to specify: `openapi.yaml` refs, `PIPELINES.md` wording,
  `TRACEABILITY.md`, the gemini dir README, and the `gemini_rubric` grader enum
  in `durable-events.schema.json` (free rename; zero graded events exist).
- Spec #32 text amendment (replace the Gemini-default/Ollama-fallback policy)
  and map #4 Notes wording.
- Scope boundary: decide and specify everything above, then GRADUATE the file
  edits into ONE new implementation-slice ticket (child of #4/#38; labels
  `wayfinder:phase2` plus a type label; a `## Parent` section naming spec #32 /
  map #4 / slice #38; a `## Blocked by` section naming real blockers) rather
  than editing contracts yourself.
</ticket_54_brief>

<environment_gotchas>
- **gh CLI**: token from `.env.git.local` via
  `export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')`;
  wrap every call in a 5-attempt retry loop; transient api.github.com TLS/EOF
  failures are network flakiness, not config. `gh issue view` without `--json`
  can die on GraphQL deprecation; prefer `--json`.
- **Secrets**: never print/echo/log keys; keep values in shell variables.
  `OPENROUTER_API_KEY` in `services/intelligence/.env`.
- **WSL runtime** (rule 53): dotenv never overrides exported env vars; launch
  scripts with `env -u OPENROUTER_API_KEY ... uv run --package intelligence ...`
  so the `.env` loader owns values. Vite does not watch `/mnt/d`. `pkill -f`
  can kill your own shell; use character classes or PIDs.
- **Rule 80**: dry-run any script after every code edit before full runs;
  prefer offline checks (python parse, ruff, unit tests). Contract-test runs
  are offline: run `uv run --package intelligence pytest
  services/intelligence/contracts/phase2/tests/test_contracts.py` style checks
  with no API key.
- **Git**: conventional commits with body +
  `Co-authored-by: GitHub Copilot using <your model name>`. Untracked
  `.work/active/tracker-19-aug/` and `college/mydeliverables/phase2-review-2/`
  are pre-existing unrelated work; leave them alone. Check NEW files for em/en
  dash characters (repo convention).
</environment_gotchas>

<definition_of_done>
1. Ticket claimed (assignee set) before work started.
2. Decision(s) recorded as a resolution comment on #54; ticket closed.
3. Map #4 updated: one Decisions-so-far line; the provider-seam fog entry fully
   resolved (annotate or remove it once #54 closes); nothing silently dropped.
4. The graduated implementation-slice ticket carries `## Parent` (spec #32 /
   map #4 / slice #38), labels `wayfinder:phase2` (+ type), and a
   `## Blocked by` section naming its real blockers.
5. `.work/STATUS.md` row added/updated in the same session; `last_updated`
   bumped.
6. Session stops after ONE ticket resolution. Next frontier: #38
   implementation planning against the amended contracts.
</definition_of_done>

<do_not>
- Do not edit any contract files, fixtures, manifests, or tests yourself; that
  belongs to the graduated slice.
- Do not start implementing #38.
- Do not touch embeddings behavior, browser code, guide SSE, written grading,
  or harness #48.
- Do not re-run the quality probe or spend API credits; the evidence base is
  complete for this decision.
- Do not resolve more than one wayfinder ticket this session.
- Do not modify the immutable sections of any plan doc (Decisions log,
  preamble, TL;DR, out-of-scope).
</do_not>

</handoff_prompt>