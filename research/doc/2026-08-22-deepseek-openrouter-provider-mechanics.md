# DeepSeek V4 Flash 0731 via OpenRouter - Provider Mechanics

- Date: 2026-08-22
- Ticket: `rings0fsaturn/study-planner#55`
- Scope: OpenRouter Chat Completions with the OpenAI Python SDK
- Model slug: `deepseek/deepseek-v4-flash-0731`
- Evidence: official OpenRouter documentation, official OpenAI Python SDK source, and the unauthenticated live OpenRouter model catalog and model page
- Live inference status: not run. The operator environment did not expose an OpenRouter key, so no prompt or inference response was sent.

## Executive Findings

1. The slug is currently live in the OpenRouter catalog. It is a text-in/text-out model with `response_format`, `structured_outputs`, `reasoning`, `reasoning_effort`, tools, and `include_reasoning` listed as supported parameters.
2. Use the OpenAI Python client with `base_url="https://openrouter.ai/api/v1"` and the OpenRouter key as `api_key`. Pass OpenRouter-only request fields through `extra_body`; the official OpenRouter Python examples use this pattern for reasoning.
3. Prefer strict `json_schema` for assessment generation. Use `json_object` only as a compatibility fallback, and validate the resulting object locally because JSON mode does not enforce a schema.
4. Provider support is endpoint-specific. Use `provider: {"require_parameters": true}` when strict structured output is a requirement; otherwise routing may select an endpoint that ignores or translates a parameter.
5. Reasoning is output-token usage and is billed. Preserve `message.reasoning_details` exactly when replaying Chat Completions history. The live catalog advertises reasoning support, but the exact interaction between reasoning and strict JSON must be confirmed by the quality probe in ticket #56.
6. Do not set a single permanent latency, price, provider count, or effective context limit from today's model page. OpenRouter routes among providers and the live catalog and page already show different aggregate and endpoint-level values.

## Exact Model And Live Catalog

The live request was:

```text
GET https://openrouter.ai/api/v1/models
```

The selected record was sanitized to remove no user or credential data:

```json
{
  "id": "deepseek/deepseek-v4-flash-0731",
  "name": "DeepSeek: DeepSeek V4 Flash 0731",
  "context_length": 1310720,
  "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
  "pricing": {
    "prompt": "0.00000008",
    "completion": "0.00000018",
    "input_cache_read": "0.000000016"
  },
  "top_provider": {
    "context_length": 1048576,
    "max_completion_tokens": 384000,
    "is_moderated": false
  },
  "supported_parameters": [
    "include_reasoning", "reasoning", "reasoning_effort", "response_format",
    "structured_outputs", "max_tokens", "tools", "tool_choice", "temperature"
  ]
}
```

The values above are a point-in-time catalog observation. The model page currently describes the model as released 2026-07-31, with 13B active parameters out of 284B total, and shows provider-specific latency, throughput, uptime, and pricing. Its aggregate page values are not the same as every endpoint's values. The effective request limit is the selected endpoint's limit, not necessarily the top-level `context_length`.

Sources:

- [OpenRouter model catalog API](https://openrouter.ai/api/v1/models)
- [OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-flash-0731)
- [OpenRouter API overview, model routing](https://openrouter.ai/docs/api/reference/overview)

## OpenAI Python SDK Configuration

The supported shape is:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="<from operator environment>",
)
```

`base_url` is a constructor argument in the official Python SDK. The SDK appends a trailing slash and resolves relative resource paths against it, so the `/v1` suffix belongs in the configured base URL. The SDK also accepts `OPENAI_BASE_URL` and `OPENAI_API_KEY` as its standard environment fallbacks. OpenRouter's docs show the OpenRouter key passed explicitly and use `extra_body={"reasoning": ...}` for Chat Completions.

OpenRouter fields that are not part of the OpenAI SDK's generated request type should be sent with `extra_body`, for example:

```python
response = client.chat.completions.create(
    model="deepseek/deepseek-v4-flash-0731",
    messages=[{"role": "user", "content": "..."}],
    extra_body={"reasoning": {"enabled": True}},
)
```

The SDK's built-in transport retries are relevant but not sufficient as the application contract: the current source retries 408, 409, 429, and 5xx responses, honors `retry-after-ms` and `Retry-After` when reasonable, and raises `RateLimitError` after exhaustion. Set `max_retries` deliberately so this does not multiply an application retry loop.

Sources:

- [OpenRouter reasoning guide, Python OpenAI SDK example](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
- [OpenAI Python `_client.py`](https://github.com/openai/openai-python/blob/main/src/openai/_client.py)
- [OpenAI Python `_base_client.py`](https://github.com/openai/openai-python/blob/main/src/openai/_base_client.py)
- [OpenAI Python exceptions](https://github.com/openai/openai-python/blob/main/src/openai/_exceptions.py)
- [OpenAI Python README, HTTP client and base URL](https://github.com/openai/openai-python/blob/main/README.md)

## Structured Output Modes

### Strict JSON Schema

OpenRouter accepts the Chat Completions form:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "assessment_questions",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {"questions": {"type": "array"}},
        "required": ["questions"],
        "additionalProperties": false
      }
    }
  }
}
```

OpenRouter documents strict mode as schema enforcement, but explicitly warns that enforcement varies by endpoint. Some providers enforce natively; others translate the schema or treat it as a strong hint. `require_parameters: true` is therefore required when the application cannot accept a provider that ignores or weakens `response_format`.

OpenAI's Structured Outputs documentation makes the same distinction: `json_schema` provides schema adherence on compatible models, while a refusal or an incomplete generation can still produce a result that is not schema-shaped. The application must check the refusal and finish state before parsing.

### JSON Object Mode

```json
{"response_format": {"type": "json_object"}}
```

This requests valid JSON but does not enforce keys, types, enums, or required fields. The prompt must also explicitly tell the model to produce JSON. Use this only as a deliberately weaker fallback, followed by JSON parsing and application-schema validation.

The DeepSeek catalog advertises both `response_format` and `structured_outputs`. This is catalog capability evidence, not proof that every routed provider handles every schema equally. Ticket #56 must exercise the exact assessment schema through the selected routing policy.

Sources:

- [OpenRouter Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter API overview, response format](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter provider selection and `require_parameters`](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## Reasoning And Continuation

OpenRouter's normalized request is:

```json
{
  "reasoning": {
    "enabled": true,
    "effort": "medium",
    "exclude": false
  }
}
```

`effort` and `max_tokens` are alternative controls, not a pair that should be sent blindly. `exclude: true` keeps reasoning internal and removes it from the returned message. Reasoning tokens count as completion/output tokens for billing. The catalog also lists the legacy `include_reasoning` field; use the unified `reasoning` object for new code.

For Chat Completions, the sanitized continuation shape is:

```json
{
  "role": "assistant",
  "content": "<assistant content>",
  "reasoning_details": [
    {
      "type": "reasoning.summary",
      "summary": "<sanitized summary>",
      "id": "<opaque id>",
      "format": "<provider format>",
      "index": 0
    }
  ]
}
```

On a follow-up request, pass the complete `reasoning_details` array back unchanged. Do not reorder, edit, summarize, or selectively drop blocks. OpenRouter documents this as necessary for reasoning continuity, especially around tool calls. In streaming responses the details occur in `choices[].delta.reasoning_details`; in non-streaming responses they occur in `choices[].message.reasoning_details`.

There was no authenticated live inference probe in this ticket, so the exact DeepSeek response detail types and whether a particular provider emits them remain UNCONFIRMED. The #56 harness must record presence and shape without persisting reasoning text or private prompts.

Source: [OpenRouter Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)

## Finish, Refusal, Safety, And Parsing

OpenRouter normalizes Chat Completions `finish_reason` to `tool_calls`, `stop`, `length`, `content_filter`, or `error`, while retaining the provider value in `native_finish_reason`. A successful response can therefore still require application handling when it ends with `length`, `content_filter`, or `error`.

The documented normalized completion shape is:

```json
{
  "choices": [{
    "finish_reason": "stop",
    "native_finish_reason": "<provider value or null>",
    "message": {"role": "assistant", "content": "<sanitized content>"}
  }],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "completion_tokens_details": {"reasoning_tokens": 0}
  }
}
```

OpenAI documents `message.refusal` as the explicit refusal branch for structured outputs. A refusal is not required to match the supplied schema. For this DeepSeek route, treat `message.refusal`, null content, `content_filter`, `error`, and `length` as non-success outcomes until the #56 live probe confirms the provider's actual behavior. Do not attempt to parse a refusal or truncated JSON as the assessment object.

OpenRouter also distinguishes pre-stream HTTP failures from mid-stream failures. After HTTP 200 and partial SSE output, failover is no longer possible; the stream terminates with an in-band error event and `finish_reason: "error"`.

Sources:

- [OpenRouter API overview, response and finish reasons](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)
- [OpenAI Structured Outputs, refusals and incomplete responses](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Python ChatCompletion message type](https://github.com/openai/openai-python/blob/main/src/openai/types/chat/chat_completion_message.py)

## HTTP Errors, 429, And Retry Metadata

The standard pre-stream error envelope is:

```json
{
  "error": {
    "code": 429,
    "message": "<sanitized message>",
    "metadata": {
      "error_type": "rate_limit_exceeded",
      "provider_code": "<optional provider code>"
    }
  }
}
```

OpenRouter documents 400, 401, 402, 403, 408, 429, 502, and 503 as relevant API errors. A 429 can be an OpenRouter platform limit, DDoS protection, or an upstream provider limit. On platform rate limits, the error may include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. When all attempted providers provide a retry hint, `Retry-After` may also be present. Honor `Retry-After` when present; otherwise use bounded exponential backoff with jitter and a cap.

The OpenAI Python SDK retries 429 and 5xx responses by default and parses `retry-after-ms`, `Retry-After` seconds, and HTTP-date forms. Its current implementation accepts a server delay up to 60 seconds before falling back to exponential backoff. Application code should still preserve the metadata and avoid retrying non-transient 400, 401, 403, 402, and model-not-found errors.

For `stream: true`, an error after the first bytes is not a new HTTP 429. It is an SSE event with a top-level error and a choice whose `finish_reason` is `error`. The caller must treat the generated result as incomplete and must not transparently replay it as if no output had been delivered.

Sources:

- [OpenRouter limits and rate limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)
- [OpenAI Python retry implementation](https://github.com/openai/openai-python/blob/main/src/openai/_base_client.py)
- [OpenAI Python exception hierarchy](https://github.com/openai/openai-python/blob/main/src/openai/_exceptions.py)

## Context, Latency, Pricing, And Rate Limits

| Concern | Verified observation or rule | Implementation implication |
|---|---|---|
| Context | Catalog `context_length`: 1,310,720; current top provider: 1,048,576; top provider `max_completion_tokens`: 384,000 | Budget against the selected endpoint and reserve output/reasoning space. Do not hard-code the aggregate value as the usable request limit. |
| Input/output | Text only in the live catalog | Do not assume image, audio, or PDF input support for this slug. |
| Price | Catalog snapshot: $0.08/M prompt, $0.18/M completion, $0.016/M cached input; model page shows provider-specific prices and current aggregate values | Record usage and model/provider identifiers from responses. Treat cost estimates as dynamic. Reasoning increases completion-token cost. |
| Latency | Model page reports provider-specific P50 latency and throughput, with materially different values by provider | Use measured p50/p95 from #56, not a documentation or page headline, for the 30-second generation decision. |
| Platform rate limits | OpenRouter's documented free limits apply to model IDs ending `:free`: 20 RPM and 50 RPD below $10 lifetime credits, or 20 RPM and 1,000 RPD after that threshold | The exact paid slug is not a `:free` variant. Still handle upstream 429s, DDoS protection, and provider capacity errors. No fixed paid-model RPM guarantee was established. |
| Fallback | OpenRouter can try other providers after 5xx or rate limiting if routing preferences allow | Keep fallbacks enabled unless endpoint capability or privacy constraints require pinning. Use `require_parameters` for strict JSON. |

Sources:

- [Live OpenRouter catalog](https://openrouter.ai/api/v1/models)
- [Live OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-flash-0731)
- [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter API overview](https://openrouter.ai/docs/api/reference/overview)

## Ticket Implications

### #54 - Amend Phase 2 contracts

The contract should become provider-neutral and model-independent. It should carry the parsed assessment result plus explicit outcomes for refusal, truncation, content filtering, provider error, and retry exhaustion. Keep OpenRouter request details behind the provider adapter. Include usage counts, optional reasoning-token counts, normalized `finish_reason`, and opaque provider metadata only where the public contract needs it. Do not expose an OpenAI SDK object or raw reasoning blocks as the application domain object.

Use strict `json_schema` as the primary generation mode and make `json_object` a named fallback with local validation. Require provider capability filtering when strictness is mandatory.

### #56 - DeepSeek and Qwen generation-quality probe

Run the same grounded inputs with reasoning enabled and disabled. Record schema validity, refusal/truncation/content-filter outcomes, citation validity, groundedness, latency p50/p95, prompt/completion/reasoning token counts, and observed cost. Run with the exact slug and record the routed provider and model from the response, without recording prompts, answer text, reasoning text, or hidden evaluation content.

The probe must test strict schema plus reasoning together, strict schema without reasoning, and JSON-object fallback. It must verify that a continuation containing untouched `reasoning_details` is accepted. Start with a conservative output budget that leaves room for reasoning; a 30-second timeout remains an assumption to validate rather than a provider guarantee.

### #53 - Decide generation runtime settings

Do not resolve the default from catalog price or model-page latency alone. The decision should use #56's quality and measured latency data. A likely safe baseline is strict schema, `require_parameters: true`, bounded output tokens, explicit timeout, SDK retries disabled or coordinated with one application retry layer, and reasoning enabled only if the quality gain justifies its output-token cost and latency. The exact effort level remains open until the probe.

## Verification Record

- `curl`/Python catalog probe: passed; exact slug found and sanitized capability metadata recorded above.
- Model-page fetch: passed; page and provider sections inspected.
- Official documentation fetches: passed for OpenRouter API overview, structured outputs, reasoning, limits, errors, and provider selection.
- Official SDK source fetches: passed for `_client.py`, `_base_client.py`, `_exceptions.py`, and ChatCompletion message types.
- Authenticated inference probe: not run because no OpenRouter key was available in the operator environment.
- Repository production tests: not run; no production code was modified.
- Worktree note: pre-existing `docker-compose.yml` modification and `.work/active/tracker-19-aug/` were left untouched.
