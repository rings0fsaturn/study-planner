---
name: jev
description: "Use when writing, debugging, or reviewing Jev (TypeSafe System One) judgment code in this repo. Triggers: Jev questions/answers, Choice/Noul/Score builders, JevClient, suitability/citation/passage/rubric judgments, rerank fallback, jev_probe runs, OPENROUTER_JEV_API_KEY, typesafe_sdk, confidence thresholds, System One API, Decisions API."
metadata:
  author: study-planner-web
  version: "0.1.0"
---

# Jev in this repo

Jev (`jev-1.13`, pinned, never `jev-latest`) is a System One decision model reached
through OpenRouter. It answers typed questions with probabilities; it never writes
prose. All repo Jev code lives in `services/intelligence/app/jev/` (`client.py` is the
`typesafe_sdk` wrapper, `questions.py` holds pure builders + routers). Live task record:
`.work/active/jev-integration/state.md`.

## Fetch the live docs first

Docs drift; training memory does not cover Jev. Before designing questions or touching
the client, fetch what you need:

- Index: `https://docs.typesafe.ai/llms.txt` lists every TypeSafe page.
- Any TypeSafe page as Markdown: append `.md` to its path, e.g.
  `https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md`,
  `https://docs.typesafe.ai/primitives.md`, `https://docs.typesafe.ai/confidence.md`,
  `https://docs.typesafe.ai/api.md`, `https://docs.typesafe.ai/models.md`,
  `https://docs.typesafe.ai/cookbooks/rerank_typesafe.md`,
  `https://docs.typesafe.ai/cookbooks/citation_check.md`,
  `https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md`,
  `https://docs.typesafe.ai/cookbooks/llm_guardrails.md`,
  `https://docs.typesafe.ai/model-jaggedness/jev-1.13.md`.
- OpenRouter side: tutorial `https://openrouter.ai/docs/guides/community/jev-tutorial.md`,
  hub `https://openrouter.ai/docs/guides/community/jev.md`, SDK guide
  `https://openrouter.ai/docs/guides/community/typesafe-sdk.md`, SystemOne schema
  `https://openrouter.ai/docs/api/api-reference/systemone/submit-a-system-one-request.md`.
- Cookbooks for cost-verified patterns: `gate-tool-calls-with-jev` and
  `jev-verified-cascade` under `https://openrouter.ai/docs/cookbook/`.

## Writing Jev code

- Builders stay pure and dependency-free in `app/jev/questions.py` (plain dicts; the SDK
  accepts dict form). One narrow judgment per question; complete meaning in
  `instructions` (question IDs are never sent to the model).
- Reference state fields with backticked paths (`` `passage` ``, `` `ticket.messages[0].text` ``).
- Choice criteria need contrast: what it is, what it is not for, examples. Score levels
  must be concrete situations, used only for threshold pass/fail, never exact magnitudes.
- Batch every independent question over one state into a single `decide()` call,
  including speculative ones (Speculative fan-out). Extra questions cost tokens, not latency.
- Route on probabilities in code, never in prompts: `APPROVE_AT=0.9`, `BLOCK_AT=0.1`,
  `AUTO_ACCEPT=0.8` are starting points; retune per question on app data with the model
  pinned. Noul has no confidence; Choice/Score confidence measures distribution peak, not
  permission to act.
- Keep keys server-side: `OPENROUTER_JEV_API_KEY` in gitignored
  `services/intelligence/.env` only (template in `.env.example` with `JEV_MODEL`,
  `JEV_BASE_URL`, `JEV_TIMEOUT_MS`, `JEV_PRICE_PER_MTOK`). Never send keys to the browser.
- New failure paths need a log line with `request_id`/`trace_id` in `extra` and must go
  through `service_error` at HTTP boundaries (rule 17). Never swallow exceptions silently.
- Never change assessment contracts alongside Jev work: one family per call, failed is
  terminal, `code_not_derivable` stays honest (rule 42).

## Debugging

Failure taxonomy from `JevClient.decide()` (code, retryable): `provider_credentials`
(False), `quota_failure` (True), `timeout` (True), `provider_unavailable` (True),
`malformed` (False, includes the missing-answer guard), `provider_error` (False).
SDK retries 429/5xx internally before these surface.

- Wrong answer: inspect exact state, questions, criteria, and probabilities. Usual causes
  in order: state too large/irrelevant (filter first), two judgments hiding in one
  question (split), math/counting/dates asked of the model (move to code), contradictory
  instruction vs criteria, missing no-match option, thresholds tuned on another primitive
  or model version. See `model-jaggedness/jev-1.13` for the full list.
- Flaky verdict near a boundary: probabilities move ~0.08 run to run; keep approve/block
  bands far apart and send the middle to review.
- `client.models.list()` is rejected against OpenRouter (Models API shape mismatch); use
  the Models API directly if a listing is ever needed.
- Verify in this order: unit tests with fake SDK client (`tests/test_jev.py` pattern, no
  network) → `ruff check` + `ruff format --check` → probe dry run below → dashboard.

## Spending and probing

- The SystemOne surface returns no `usage.cost` (TypeSafe response shape only); spend is
  estimated at `JEV_PRICE_PER_MTOK` ($0.042/Mtok input, output free) via
  `estimate_cost_usd`. Confirm totals on the OpenRouter Activity dashboard.
- Rule 80 applies: `uv run --package intelligence python scripts/jev_probe.py --limit 2`
  before any larger run; the probe aborts past `--max-spend` (default $0.40). After any
  code edit, repeat the dry run. Never print key values; the probe only reports token
  counts and estimated cost.
- Jev is absent from OpenRouter's public models catalog, so its price is not API
  retrievable; hold the TypeSafe list price until the dashboard says otherwise.
