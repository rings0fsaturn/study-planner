# PLAN - issue-46-socratic-guide (#46 Socratic Guide and Gated Reveal)

Ticket: [rings0fsaturn/study-planner#46](https://github.com/rings0fsaturn/study-planner/issues/46) (`wayfinder:phase2`, `ready-for-agent`)
Parent: spec #32 · map #4 · local mirror `specs/phase2-tickets/14-socratic-guide-gated-reveal.md`
Upstream: prototype #12 (inline-hint live guide, Variant C chosen) · written runs #44 (CLOSED) · coding runs #45 (CLOSED)
Contract: `services/intelligence/contracts/phase2/` (approved pack #22) - `provider/guide-hint-frame.schema.json`, `provider/gated-reveal-response.schema.json`, `openapi.yaml` `/v1/guide/stream` + `/v1/guide/reveal`

## Acceptance criteria (verbatim)
- [ ] Learner request, idle, and failed-test triggers offer help without forcing it.
- [ ] Stream frames are ordered, resumable before completion, and rendered without duplicate sequence numbers.
- [ ] The guide follows `nudge -> hint -> targeted -> gated-reveal` and remains anchored to the active line.
- [ ] Reveal gating, ownership, prompt injection boundaries, hidden-content exclusion, and reconnect behavior are tested.

## Locked decisions
- **D-01 Surface:** the coach lives inside the practice run (`PracticeRun.tsx`, route `/materials/:materialId/practice/:runId`). No new route. Production port of prototype Variant C (fixed corner popover that shows the active line), not the throwaway prototype file.
- **D-02 Tier vocabulary:** wire tiers are the approved contract enum `nudge | concept | strategy | worked_step` (`openapi.yaml:169`). UI labels are the ticket's words - Nudge / Hint / Targeted / Reveal (gated) - matching the prototype `KindChip`. Mapping: nudge->nudge, hint->concept, targeted->strategy, gated-reveal->worked_step. The contract is authoritative on the wire; the ticket prose is the UI vocabulary.
- **D-03 Streaming:** `/v1/guide/stream` is a real SSE endpoint (`StreamingResponse`, `text/event-stream`) and runs the provider **in-request** (the contract's 200-direct shape; the first in-request generation in the service). Hints are plain-prose streamed completions grounded in retrieved chunks; citations ride separate `citation` frames from the retrieved chunks. Frame order: exactly one `start`, then zero or more `citation`/`delta`, then exactly one `done` or `error`. `sequence` is monotonic from 0; `correlationId` is the request correlation id. **Contingency:** if true provider streaming proves unreliable in the P1 dry run, fall back to chunked delivery of a completed non-streamed response (same frames, same contract) and record it.
- **D-04 Reveal gate:** `/v1/guide/reveal` is the gate plus a durable acknowledgement only - it returns `GatedRevealAcknowledgement` and never hidden content. It requires `confirmation: true` and an owned `attemptId` bound to the question. The concrete `worked_step` content streams through `/v1/guide/stream` and is safe by construction (the prompt never sees `answer_block`). The client must pass the gate before requesting the `worked_step` tier or rendering a reveal body. Gate denial is `403`.
- **D-05 Ownership:** `/v1/guide/stream` resolves the question through a new `UserScopedClient.get_question(question_id)` selecting `QUESTION_PUBLIC_COLUMNS` only (RLS owner-scoped; `answer_block` never returned). `/v1/guide/reveal` resolves the question for its `assessment_id`, then `list_attempts(assessment_id)` to prove the attempt is owned. Unknown/foreign question -> `404`; foreign attempt or missing confirmation -> `403`.
- **D-06 Retrieval:** reuse `embed_queries` + the `match_content_chunks` RPC. Add an optional `steer_override` to `app/generation/context.py:build_context` and call it with a guide steer built from the question prompt + a learner-work snippet + the active line. Material = the question's `material_id`. Retrieval failure degrades to no citations and logs with `request_id`; it never blocks the hint.
- **D-07 Provider in-request:** extract the adapter factory (`worker_main.py:_build_openrouter_adapter`) into `app/generation/factory.py` so both the worker and the guide router build the client from env. Guide tasks use `GUIDE_*` knobs with `GENERATION_*` fallbacks; reasoning off (#53 obligation carried by ticket #46).
- **D-08 Frontend client:** new `apps/app/src/guide/` module: `guideClient.ts` (types, `GuideClientLike`, `HttpGuideClient`, `normalizeGuideError`, `GuideServiceError`), `GuideProvider.tsx` + `useGuideClient()`, `usePracticeGuide.ts` (trigger machine + stream consumer + reveal gate), `PracticeCoach.tsx` + `practiceCoach.css`. `GuideProvider` slots next to `AssessmentProvider` in `App.tsx`.
- **D-09 Work/active-line lifting:** thread optional callbacks `AnswerSlot -> AttemptTaker -> CodingTaker`: `onWorkChange?(work)`, `onActiveLineChange?(line)`, `onAdvisoryResults?(results)`. All optional, so `AssessmentDetail` is unaffected. `PracticeRun` holds the work context and passes it to the coach.
- **D-10 Triggers:** idle (45 s timer, armed only while answering), stuck (explicit button), failed-test (coding advisory results or server `grade.testCases` with a failure). Offer-never-force: an `offered` state never interrupts an active hint.
- **D-11 No durable events in #46:** the guide writes no `GuideRequested`/`GuideCompleted` events (the ACs do not require them; the prototype recorded its own choice without an event). `durable-events.schema.json` already declares the payloads; emission is deferred and recorded in Open.
- **D-12 No schema change:** no Supabase migration, no Dexie version. The guide is stateless in-request; only reads.
- **D-13 Reveal body:** the `worked_step` hint is LLM-generated prose grounded in the material, framed "a reference to check against, not to paste". The authored reference solution / hidden tests are never sent to the model or the browser.

## Phases

### P1 - backend: prompts, adapter streaming, retrieval steer
- `app/generation/prompts.py`: `GUIDE_PROMPT_TEMPLATE_VERSION = "guide-v1"`, per-tier system/user templates. Socratic only; never hands the answer; untrusted material delimited as data; no `answer_block` in context. `build_guide_messages(question, tier, work, active_line, chunks)`.
- `app/generation/openrouter_client.py`: add `stream_text(messages, *, request_id, correlation_id)` yielding text deltas + a final usage/outcome. Reuse `_error_envelope`, `FINISH_TO_OUTCOME`, the one-retry rule.
- `app/generation/context.py`: optional `steer_override` on `build_context`.
- `app/generation/factory.py`: move `build_openrouter_adapter(prefix, schema_name)` here; `worker_main.py` imports it.
- Tests: `test_generation_prompts.py` (guide prompt shape, no answer leak), `test_generation_adapter.py` (stream deltas + error mapping), `test_generation_context.py` (steer override).

### P2 - backend: guide router + owner-scoped question getter
- `app/userrest.py`: `get_question(question_id)` selecting `QUESTION_PUBLIC_COLUMNS`.
- `app/routers/guide.py`: `POST /v1/guide/stream` (SSE generator) and `POST /v1/guide/reveal` (gate).
- `app/main.py`: include the guide router under `_V1_DEPENDENCIES`.
- Frames: `start`/`citation`/`delta`/`done`, `error` on failure; `X-Request-ID` echoed; structured logs with `request_id`/`trace_id`; best-effort telemetry.
- Tests: `tests/test_guide_api.py` - auth, owner 404, frame ordering + monotonic sequence, error frame, hidden-content exclusion, injection delimiting, reveal 403 (no/false confirmation, foreign attempt) + 200 acknowledgement, attempt ownership.

### P3 - frontend: guide client + provider + hook + coach
- `apps/app/src/guide/guideClient.ts` - `GuideClientLike` (`streamHint`, `reveal`), `HttpGuideClient` (token provider, `X-Request-ID` per logical call, timeout, retry-before-done, typed errors), SSE frame parser.
- `apps/app/src/guide/GuideProvider.tsx` + `useGuideClient()`.
- `apps/app/src/guide/usePracticeGuide.ts` - idle/stuck/failed-test trigger machine, tier escalation, stream consume with sequence dedup + `start` reset + retry-before-`done`, reveal gate call before `worked_step`.
- `apps/app/src/guide/PracticeCoach.tsx` + `practiceCoach.css` - Marginalia popover (header with active line, tier chip + ladder dots, hint bubble, Go deeper, Reveal gate dialog, dismiss).
- Tests: `guideClient.test.ts` (frame parsing, dedup, error normalization), `usePracticeGuide.test.tsx` (triggers, escalation, gate, reconnect), `PracticeCoach.test.tsx` (render states, offer-never-force, no reveal before gate).

### P4 - frontend: lift work context from the takers
- `pages/assessments/AssessmentDetail.tsx` `AnswerSlot`: pass through optional callbacks.
- `pages/assessments/AttemptTaker.tsx`: `onWorkChange`, thread to `CodingTaker`; expose written/objective work.
- `pages/assessments/CodingTaker.tsx`: `onWorkChange`, `onActiveLineChange` (CodeMirror selection listener), `onAdvisoryResults`.
- `pages/practice/PracticeRun.tsx`: hold `workContext`, render `<PracticeCoach>`; wire `GuideProvider` in `App.tsx`.
- Tests: `AttemptTaker.test.tsx` / `CodingTaker` (callbacks fire), `PracticeRun.test.tsx` (coach mounts, triggers wired).

### P5 - verification
- Service: `uv run pytest services/intelligence/tests/test_guide_api.py ...` + contracts `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py`.
- App: `pnpm --filter app typecheck`, `pnpm --filter app lint`, `pnpm --filter app test`, `pnpm --filter app build`.
- Live: `./full-app restart full`; GPU sidecar up on :8200 (query embeddings, rule 54) + OpenRouter key; a ready material + practice run; request/idle/failed-test offers; tier escalation; gated reveal; reconnect-before-done; redaction sweep; console clean; 1280 + 375. Stop the sidecar after.
- Record the request-id join (`./full-app logs intelligence --grep <request-id>`).

### P6 - review
- `impeccable` pass on `PracticeCoach` (Marginalia, mobile + desktop).
- `open-code-review-delegate` + `thermo-nuclear-code-quality-review` on the diff; fix findings.

### P7 - wayfinder exit
- Resolution comment on #46, tick ACs, close; append the Decisions-so-far line on map #4 + local snapshot; archive the task folder; flip STATUS to Done.

## Verification commands
```bash
uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py
uv run pytest services/intelligence/tests/test_guide_api.py
pnpm --filter app typecheck
pnpm --filter app lint
pnpm --filter app test
pnpm --filter app build
pnpm exec playwright test -c e2e/playwright.config.ts --project=app e2e/practice-guide-live.spec.ts --reporter=list
```

## Risks
- In-request provider streaming is new infrastructure (no precedent in the service); the P1 dry run de-risks it, with a chunked fallback (D-03).
- Lifting work/active-line/failed-test state must stay backward compatible for `AssessmentDetail` (all callbacks optional).
- Live verification needs the demand-started GPU sidecar; a stopped sidecar makes retrieval fail (degrade to no citations, not a hint failure).
- Hidden-content exclusion must be proven by test at both the service (no `answer_block` on the wire) and the browser (no hidden content in DOM).
