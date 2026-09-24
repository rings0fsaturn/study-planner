# #50 Decisions - LLM-generated learner feedback contract

_Source: HITL grilling round 1, 2026-09-24. All six recommendations accepted by the user._
_Ticket: Decision: LLM-generated learner feedback contract (#50). Seam: `FeedbackCopyProvider` from #47._

## D-01 Provider boundary = server endpoint, OpenRouter-backed
- New JWT-verified Intelligence endpoint (planned path `POST /v1/feedback/copy`), owner-scoped to the roadmap's materials.
- Model plane: OpenRouter `https://openrouter.ai/api/v1/chat/completions`, model `meta/muse-spark-1.3-contributor` (configurable; not Gemini).
- Reuse the neutralized generation adapter rules: OpenAI-style `messages[]`, plain JSON Schema response, `max_retries=0` plus exactly one app-level retry for retryable classes (rate limit honoring `Retry-After` capped at 60 s, provider unavailability, provider deadline), per-task timeout 30 s.
- Rule 17: mint one `X-Request-ID` per logical call, reuse across the single retry, log every request/error with `request_id`, surface the id on the typed error, route errors through `service_error`.
- Rule 22: the app client exposes typed errors only (timeout / service / conflict), centralized normalization, no raw `AbortError`/`TypeError`/unknown leaks.
- No browser-to-OpenRouter calls; the key stays server-side in `services/intelligence/.env`.

## D-02 Input allowlist = whole `FeedbackCopyInput` as the ceiling
- Allowed: `state`, `materialTitles`, `projections` (mastery, uncertainty, confidence, n, trend, modelVersion per material+skill), `recommendation` (currentBand, recommendedBand, targetExpectedCorrectness, modelVersion), `evidence` rows (materialId, skillTag, observations, read, trend).
- Never in the prompt: raw chunk text, full material text, answer keys, rubrics, reference solutions, hidden tests.
- Titles and skillTags are untrusted-as-data (prompt-injection rule from #9): delimited, never interpreted as instructions.
- Rationale: the seam already passes the whole input; deciding the prompt needs no seam change.

## D-03 Output schema = exact `FeedbackCopy`, validated, one repair else static
- Fields unchanged: `summary`, `knowTitle`, `knowBody`, `watchTitle`, `watchBody`, `advisory`, `advisoryNote`, `source` (model version once LLM-backed).
- Local schema validation after every response; one repair attempt, else fall back to `staticFeedbackCopy` for that render.
- No UI change required to swap static for LLM. No second citation channel in the output.

## D-04 Grounding = titles + evidence-row links only
- The copy may reference material titles and the evidence-trail rows (which link to `/materials/:id`). No chunk quotes, no invented materials or skills, no raw decimals or percentages leading.
- Raw mastery decimals and expected-correctness live only behind the collapsed Model context (HITL #35 constraint, unchanged).
- Every copy must answer: what changed, why the next step is suggested, what evidence is still missing.

## D-05 Stale/rebuild + failure policy = staged, never blocking
- LLM runs only on `updated`. `cold` renders the static cold template (honest "not enough evidence yet", no wasted call).
- `stale` renders the static stale copy with the rebuild offer; the recommendation is paused until rebuild adopts the fresh projection.
- `rebuilding` renders the static rebuilding copy.
- Any provider failure, timeout, or validation failure renders `staticFeedbackCopy`, logs with `request_id`, and never blocks the section.

## D-06 Advisory-only + safety locks confirmed
- Keep = acknowledgement only (the one-band guidance already feeds the next Adaptive run via `bandGuidanceByMaterial`); Open replan = navigate `/replan`. The copy layer never writes bookings or events.
- Every call bound to an owned roadmap/material set; no free prompt, no arbitrary text.
- Budgets: free-tier rate limits plus circuit breaker; telemetry redacted (counts, bands, latencies, model version; never raw material text).

## Glossary (domain-modeling)
- projection: per-(material, skill) numbers from the stateless mastery endpoint.
- headline: highest-mastery observed projection, drives the band recommendation.
- recommendation: one-band difficulty move toward ~0.7 expected correctness.
- evidence: capped (5), case-collapsed, inspectable rows behind the story.
- copy: learner-facing words in the locked Variant B hierarchy order.
- source: `static` now, model version once the LLM provider lands.

## Handoff
- Implementation (new ticket, not this one): endpoint + Jinja prompt template (versioned, e.g. `feedback-v1`) + app client method + provider swap + contract tests + live E2E at 1280/375.
- #49 Integrated Verification stays unblocked and independent of this decision.
