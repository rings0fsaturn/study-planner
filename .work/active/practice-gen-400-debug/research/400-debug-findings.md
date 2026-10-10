# Practice-run 400 debug - findings (2026-10-07)

## Reported symptom
- URL: `/study/materials/be7e88a0-909e-4db2-8a15-a14510165027/practice/f020fc68-f00d-4ae1-85db-3477d09a97f4`
- Screen: `Generation was interrupted` + `Error code: 400 - {'error': {'message': 'Provider returned error', 'code': 400, 'metadata': {'raw': '{"error":{"code":"invalid_request_error","message":"The request was rejected. Possible causes: input exceeds the model\'s maximum context length, or the request contains invalid parameters."}}', ...`
- Rule 42: a `failed` assessment is terminal; here the row stays `generating` with a warning, so the UI shows the interrupted banner with Retry.

## Point of failure (proved)
1. `apps/app/src/pages/practice/PracticeRun.tsx:526` renders `warnings[].message` joined. The message is the worker-stored adapter string, so the raw SDK text reaches the screen.
2. `services/intelligence/app/generation/openrouter_client.py:158-178` (`generate`): only `429` and `>=500` (plus timeout/connection) get the one application-level retry. A `400` falls straight to `_classify_status`.
3. `_classify_status` (`openrouter_client.py:333-345`): any `400` without "effort"/"reasoning" in the text returns `("provider_error","provider_error",False)` - non-retryable.
4. `services/intelligence/app/generation/worker.py:763-794`: `quota_failure/timeout/provider_error` marks the job `failed` (with that retryable flag) and leaves the assessment `generating` with `[{code, message}]`. The queue message is acked, so there is no automatic retry.
5. `_message` (`openrouter_client.py:365-367`) truncates to `str(exc)[:300]`, which is why the DB warning is exactly 300 chars and drops `provider_name` / `provider_error_code`.

## Live identity (proved with code, no assumptions)
- Material `be7e88a0` = CSAPP 2016 PDF, 1105 pages, 2065 chunks in `content_chunks` (listing pages at 1000, `context.py:44`).
- Assessment `7084b42a-fda2-4150-89a6-c70dc6c09784` in Supabase: same `material_id`, `recipe {formats:[coding], difficulty:3, questionCount:1}`, `status generating`, `warnings[0].code provider_error`, `message len 300` starting `Error code: 400 - ...` - byte-identical family to the screenshot.
- Same material/minute: 2 coding `ready` + 3 coding `generating/provider_error` (assessments `3719f083,6e621b2f` ready vs `7084b42a,431e4ba9,ff4079fb` generating). Same model, same schema shape, different windows - so not a static bad-model or static bad-schema.

## Hypothesis tests (executed)
- H1 "input exceeds max context": DISPROVED. Rebuilt the exact worker window with `code_proximity` picks (`context.py` + `prompts.build_coding_messages`): window-1 = 7617 chars, window-3 = 6759 chars (~1900 prompt tokens on success: `prompt_tokens 1927`). Far below any DeepSeek context window. Window-3 is SMALLER than window-1 yet window-3 is the one that 400'd.
- H2 "deterministic invalid params (e.g. coding `oneOf` root vs strict)": DISPROVED as the sole cause. `coding_schema` root is `oneOf` (vs `mcq`/`written` root `object`), which is strict-suspicious, but the identical coding payload returned `ok` on the immediate retry (w3 try1/try2 `ok` after try0 `400`). A static param error cannot succeed on retry.
- H3 "transient downstream provider rejection": PROVED. Direct raw-client loop on the w3 payload: attempt 0 `ok` (`finish stop`), attempt 1 `400` with full body `provider_name Sail Research`, `provider_error_code invalid_request_error`, same generic raw message. Adapter-level loop on the same payload: try0 `provider_error`, try1 `ok`, try2 `ok`. Identical bytes fail then succeed - the 400 is transient routing/provider capacity, not content.
- H4 "adapter does not retry 400": PROVED by source (`generate:33` retries only `429 or >=500`) plus the live try0-fail/try1-ok pair: the retry that would have saved the job exists for 5xx but not for this 400.

## How to recreate (cheap dry-run, rule 80)
1. `./full-app status full` (worker healthy).
2. Material `be7e88a0` (CSAPP, 2065 chunks). Recipe coding, no skillTags/scope (spread + `code_seeking`).
3. Rebuild windows with `code_proximity` top-pick per band, excluding prior window ids (see `worker.py:419-424,521-532` resample). Window-3 ordinals on 2026-10-07: `[172,472,951,1263,1681]` (drifts as chunks grow).
4. `build_coding_messages` + `coding_schema(chunk_ids)` + `build_openrouter_adapter("GENERATION","grounded_mcq").generate` 3x. Expect intermittent `provider_error/provider_error retryable False` with `Error code: 400 - ...Provider returned error...Sail Research` truncated to 300 chars, then `ok` on retry. No full-run needed; 1-3 calls reproduce.
5. DB check (service key, no secrets printed): `assessments` row stays `generating` with `warnings[0].code provider_error`; `ingestion_jobs` row `failed`.

## Fix (proposed, not yet applied)
- Primary: retry a `400/provider_error` once in `OpenRouterGenerationClient.generate` (and `stream_text` for the guide), same `RETRY_DELAY_SECONDS` budget as 5xx. Rationale: OpenRouter uses 400 for transient downstream `invalid_request_error` (proved above); one bounded retry converts the observed try0-fail/try1-ok into a single `ok` with no queue churn. A truly bad request still fails after the second attempt with the same terminal path, so worst cost is one extra call.
- Observability: log/store `provider_name` + `provider_error_code` alongside the truncated message (rule 17, `trace_id`), and stop surfacing raw `Error code: 400 - {...}` to learners (map to a short honest warning; keep raw in logs/telemetry only).
- Optional: surface `retryable=True` for transient-400 so a second failure still leaves an honest retry path instead of a dead `generating` row that only a fresh run can escape (rule 42 keeps `failed` terminal; this case never reaches `failed`, it parks in `generating`).

## Similar problems that will arise
- Same 400 no-retry in `stream_text` (guide arm), feedback copy (`POST /v1/feedback/copy`), and grading arms - all share `openrouter_client` + `_classify_status`. Any transient Sail Research (or next routed provider) 400 hits them the same way.
- Same truncation everywhere `_message` is used: every 400 loses the provider name, so the next debug starts blind again.
- Same `generating`-forever UX: any non-retryable provider error parks the assessment in `generating` with a raw warning; the learner sees JSON-ish text and only "Retry generation" (which 409s once the row flips) or "Start a new run".
- Coding on prose-heavy material (`has_code false`, e.g. CSAPP): burns up to 3 LLM windows of unsuitable/refusal spend before a transient 400 kills the last window. A pre-flight `has_code` hint or earlier abort would save spend.
- `oneOf` strict risk remains latent: coding is the only arm with a non-object schema root. It passes today (proved `ok`), but the next strict-enforcing provider may reject it deterministically. A contract test asserting strict-compatibility per arm would catch it before live.
