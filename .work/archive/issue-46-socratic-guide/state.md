# State – issue-46-socratic-guide
_Spec: https://github.com/rings0fsaturn/study-planner/issues/46 (parent #32, map #4) · local mirror specs/phase2-tickets/14-socratic-guide-gated-reveal.md · Plan: archive/issue-46-socratic-guide/plan/PLAN.md · STATUS row: issue-46-socratic-guide · Status: done · Updated: 2026-09-23_

## Current state & next
- **Done and closed 2026-09-23.** P1-P7 complete: backend, frontend, integration tests, build, live E2E at 1280 + 375, review findings fixed, #46 resolution posted + ACs ticked + issue closed, map #4 decision line added, task archived.
- Next: none for this task; #49 Phase 2 Integrated Verification is unblocked.

## Done so far
- Opened the task, claimed #46, wrote `plan/PLAN.md` (D-01..D-13) + `plan/VERIFICATION.md`.
- **P1 backend**: extracted `app/generation/factory.py`; added `stream_text` + `GenerationStreamError` to `openrouter_client.py`; added `steer_override` to `build_context`; added `GUIDE_PROMPT_TEMPLATE_VERSION="guide-v1"` + `build_guide_messages` to `prompts.py`. 71 tests green.
- **P2 backend**: `UserScopedClient.get_question` (public columns only); `app/routers/guide.py` (`POST /v1/guide/stream` SSE, `POST /v1/guide/reveal` gate); `forbidden:403` in `_STATUS_BY_CODE`; router included in `main.py`. 12 `test_guide_api.py` + 31 contract tests green.
- **P3 frontend**: `apps/app/src/guide/{types,guideClient,GuideProvider,usePracticeGuide,PracticeCoach}.ts(x)` + `practiceCoach.css` + `testing/fakeGuideClient.ts`; `GuideProvider` wired in `App.tsx`. 28 tests green.
- **P4 frontend**: optional `onWorkChange`/`onActiveLineChange`/`onAdvisoryResults` threaded `AnswerSlot -> AttemptTaker -> CodingTaker`; CodeMirror caret line + advisory results lifted; `PracticeRun` renders the coach + "I'm stuck" and wires the failed-test trigger.
- **P5a integration tests**: `PracticeRun.test.tsx` coach block - "I'm stuck" -> offer -> accept -> streamed hint; advisory visible-test failure fires the offer (Pyodide mocked); reveal gate stays closed without an attempt and opens after a graded retry (real `reveal` call + note). `AttemptTaker.test.tsx` - coding taps: `onActiveLineChange(1)` on mount, `onWorkChange` on a CodeMirror dispatch, `onAdvisoryResults` from a mocked advisory run.
- **P5b/P5c**: typecheck + lint + `pnpm --filter app build` green; full app suite 995 passed / 2 failed (known WSL TZ flakes).
- **P5d live E2E**: `e2e/practice-guide-live.spec.ts` passed at 1280 and 375 against the real stack (frozen ACCA material, real SSE hint stream via OpenRouter + GPU sidecar retrieval): request offer -> Nudge -> Hint -> Targeted -> Reveal (gated); closed gate without an attempt; after a graded attempt the gate opens and the worked step streams; redaction sweep clean; zero page errors; the browser `X-Request-ID` joined to 1 intelligence log line.
- **P6 review (two rounds)**: `impeccable detect` 0 findings; `open-code-review-delegate` + `thermo-nuclear-code-quality-review` run on the diff, then re-run on the fixes. Fixed round 1: coach reset on question change, StrictMode double-stream (side effect out of state updaters), `X-Request-ID` reuse across retries, truncated-stream error, retrieval degradation catches any failure (D-06), reveal attempt bound to the question (D-05), coding starter code reported as work, deduped `problemIsAnswerable`, CSS snapped to the DESIGN.md type ramp, coach role `region`. Fixed round 2: idle timer cleared on question change, `confirmReveal` bails if the question changed mid-gate, `coachWork`/`coachLine` reset per question (no stale work grounding the next hint), unexpected retrieval failures log a traceback, live E2E now enforces zero console errors, starter-code tap + retrieval-crash tests added. Re-verified: backend 15 guide tests, app 74 guide/practice/taker tests, typecheck/lint green, both live scenarios green.
- Gates: backend 107 passed; `pnpm --filter app typecheck`/`lint` green; full app suite 995/2 (TZ flakes); build green; both live E2E scenarios green.

## Flow trace
1. Ticket #46 = Socratic Guide and Gated Reveal - `wayfinder:phase2`, `ready-for-agent`, OPEN (claimed); 4 ACs.
2. Wire contract (approved pack #22): `openapi.yaml` `/v1/guide/stream` (SSE, `HintFrame`) + `/v1/guide/reveal` (`GatedRevealAcknowledgement`); `provider/guide-hint-frame.schema.json`; `provider/gated-reveal-response.schema.json`.
3. Backend stream: `stream_guide` validates -> `client.get_question` (owner-scoped, public columns) -> `StreamingResponse(_frames(...))`. `_frames` retrieves chunks (`build_context(..., steer_override=question prompt + work + active line)`), builds `build_guide_messages`, then streams `start`/`citation`/`delta`/`done` (or `error`) with monotonic `sequence`.
4. Reveal: `reveal_guide` requires `confirmation: true` + an owned `attemptId` (found via `list_attempts(question.assessment_id)`); returns acknowledgement only.
5. Frontend: `HttpGuideClient.streamHint` parses SSE; `usePracticeGuide` owns triggers (`stuck`/`idle` 45 s/`failedRun`), the ladder, sequence dedup + `start` reset, retry-before-`done`, and the reveal gate call before `worked_step`; `PracticeCoach` renders the popover.
6. Tier mapping (D-02): UI Nudge/Hint/Targeted/Reveal (gated) <-> wire `nudge|concept|strategy|worked_step`.

## Files affected
- `services/intelligence/app/generation/factory.py` – new; shared `build_openrouter_adapter`.
- `services/intelligence/app/generation/openrouter_client.py` – `GenerationStreamError` + `stream_text` (plain-prose streaming, retry-before-first-delta).
- `services/intelligence/app/generation/context.py` – `steer_override` on `build_context`.
- `services/intelligence/app/generation/prompts.py` – `GUIDE_PROMPT_TEMPLATE_VERSION`, `GUIDE_TIERS`, `build_guide_messages`.
- `services/intelligence/app/worker_main.py` – import the factory (alias keeps `_build_openrouter_adapter`).
- `services/intelligence/app/userrest.py` – `get_question` (public columns).
- `services/intelligence/app/routers/serialization.py` – `forbidden:403`.
- `services/intelligence/app/routers/guide.py` – new; the stream + reveal endpoints.
- `services/intelligence/app/main.py` – include the guide router.
- `services/intelligence/tests/test_generation_{adapter,context,prompts}.py` + `test_guide_api.py` – new/extended.
- `apps/app/src/guide/*` – new module (types, client, provider, hook, coach, css, fake).
- `apps/app/src/App.tsx` – `GuideProvider`.
- `apps/app/src/pages/assessments/AssessmentDetail.tsx` (`AnswerSlot`) / `AttemptTaker.tsx` / `CodingTaker.tsx` – optional coach callbacks.
- `apps/app/src/pages/practice/PracticeRun.tsx` (+ `.test.tsx`) – coach context, "I'm stuck", render the coach.
- `apps/app/src/pages/assessments/AttemptTaker.test.tsx` – coding coach-tap test.
- `e2e/practice-guide-live.spec.ts` – new live E2E (1280 + 375).
- `.work/STATUS.md`, `.work/archive/issue-46-socratic-guide/**` – task record.

## Pitfalls & rules
- The guide stream is the first in-request provider call; the middleware logs time-to-first-byte, and an error after headers is delivered as an `error` frame (not a JSON response).
- The error frame schema is closed: no free-text `message` field (only `code`/`retryable`/`requestId`/`correlationId`/optional `retryAfterSeconds`).
- Rule 17: every failing guide path logs with `request_id`/`correlation_id`; the frontend mints one `X-Request-ID` per logical call and carries it on the typed error.
- Rule 22: guide fetch failures normalize to `GuideServiceError` (network/timeout/service/forbidden/...).
- Rule 54: live retrieval needs the demand-started GPU sidecar on :8200; stop it after.
- Rule 31/35: no Dexie bump, no Supabase migration (D-12).
- Hidden-content exclusion: question reads use `QUESTION_PUBLIC_COLUMNS` only; `answer_block` never reaches the prompt or the browser.
- `GuideProvider` imports `supabase` at module load, so any test that renders it must `vi.mock('../lib/supabase')`.

## Decisions in force
- D-01..D-13 in `plan/PLAN.md` (surface, tier vocabulary, streaming, reveal gate, ownership, retrieval, provider in-request, frontend client, work lifting, triggers, no events, no schema change, reveal body).
- D-03 streaming is real provider streaming; the chunked fallback was not needed.
- UI follows the impeccable brief: warm paper card + warm shadow (no border), Fraunces title, mono metadata, Fired Clay only on the primary action, Rust Ink only on the gated tier, three-dot loading, 44px mobile targets, reduced-motion honored.

## Open
- none (P7 complete: #46 resolution + ACs + close, map #4 decision line, task archived, STATUS flipped to Done).
- **Deferred / accepted (recorded, not blocking #46):**
  - `/v1/guide/stream` accepts `tier: worked_step` without a server-side attempt check; D-04 frames the reveal gate as a client obligation and the worked step is safe by construction (no `answer_block` in the prompt), so enforcing it server-side would need a contract change to the frozen pack #22. Revisit if the gate must be server-enforced.
  - `guideClient` is the fourth hand-rolled fetch error-normalizer/retry in the app (rule 22 asks for one canonical path); extracting a shared `lib/` helper is a cross-cutting change, out of #46 scope.
  - `openrouter_client.stream_text` duplicates the `generate` provider-retry matrix; extract a shared classifier when a provider change next touches both.
  - `guideRequested`/`guideCompleted` durable events not emitted in #46 (D-11); revisit if guide history must persist.
- PRE-EXISTING, out of scope: 5 `test_v1_integration.py` calibration golden failures + 2 `test_retrieval_probe.py` import failures + the 2 WSL TZ flakes in `seedTestData.test.ts`; confirmed on the base commit.
- #49 Phase 2 Integrated Verification stays blocked until #46 closes.
