# VERIFICATION - issue-46-socratic-guide

Ticket: [rings0fsaturn/study-planner#46](https://github.com/rings0fsaturn/study-planner/issues/46) · Started 2026-09-23

## Acceptance criteria

| AC | Where it is satisfied | Evidence |
|---|---|---|
| Learner request, idle, and failed-test triggers offer help without forcing it. | `usePracticeGuide` trigger machine (`idle`/`stuck`/`failedRun`); `offer()` only moves `idle -> offered` and never interrupts an active hint; `PracticeCoach` renders offered/active/dismissed. | Unit: `usePracticeGuide.test.tsx`, `PracticeCoach.test.tsx`, `PracticeRun.test.tsx` (request offer + advisory-failure offer). Live: request offer at 1280 + 375; the offer precedes the first provider call. |
| Stream frames are ordered, resumable before completion, and rendered without duplicate sequence numbers. | SSE frames `start`/`citation`/`delta`/`done`/`error` with monotonic `sequence`; client dedups by sequence, resets on `start`, retries before `done`, and treats a stream that closes without `done` as truncated. One `X-Request-ID` per logical call, reused across the retry. | Unit: `guideClient.test.ts` (ordering, dedup, resume, header reuse), `usePracticeGuide.test.tsx` (dedup, retry-reset, truncated), `test_guide_api.py` (frame order + monotonic sequence). Live: real SSE stream + request-id log join. |
| The guide follows `nudge -> hint -> targeted -> gated-reveal` and remains anchored to the active line. | UI ladder labels Nudge/Hint/Targeted/Reveal (gated) mapped to wire `nudge|concept|strategy|worked_step`; `activeLine` rides `GuideRequest` and the popover header shows it; `CodingTaker` lifts the CodeMirror caret line (and its starter code as work). | Unit: `usePracticeGuide.test.tsx` (escalation stops at the gate, StrictMode single-fire, question-scoped reset), `AttemptTaker.test.tsx` (caret + work + advisory taps). Live: Nudge -> Hint -> Targeted -> Reveal (gated) at 1280 + 375. |
| Reveal gating, ownership, prompt injection boundaries, hidden-content exclusion, and reconnect behavior are tested. | `/v1/guide/reveal` requires `confirmation: true` + an owned attempt **bound to the question** (else 403); question reads use public columns only (no `answer_block`); retrieval failure degrades to no citations; material delimited as untrusted data. | Unit: `test_guide_api.py` (403 paths, sibling-question rejection, owner 404, public-column select proof), `test_generation_prompts.py` (injection delimiting, no answer leak). Live: closed gate without an attempt, open gate + streamed worked step after a graded attempt, redaction sweep over the DOM. |

## Gates

| Gate | Result |
|---|---|
| `uv run --package intelligence pytest contracts/phase2/tests/test_contracts.py tests/test_guide_api.py tests/test_generation_{adapter,context,prompts}.py` | 107 passed (2026-09-23) |
| Service suite (`services/intelligence/tests`) | 724 passed, 8 failed - 5 `test_v1_integration` calibration golden drift + 2 `test_retrieval_probe` import + 1 rate-limit accumulation; all confirmed pre-existing on the base commit (stash check) |
| `pnpm --filter app typecheck` | green (2026-09-23) |
| `pnpm --filter app lint` | green (2026-09-23) |
| `pnpm --filter app test` | 995 passed / 2 failed - the known WSL TZ flakes in `src/dev/seedTestData.test.ts` (green under `--pool=forks`); guide + `PracticeRun.test.tsx` + `AttemptTaker.test.tsx` 74/74 |
| `pnpm --filter app build` | green (2026-09-23) |
| `impeccable detect` on `PracticeCoach.tsx` + `practiceCoach.css` + `PracticeRun.tsx` | 0 findings (2026-09-23) |
| Live E2E `e2e/practice-guide-live.spec.ts` (desktop 1280) | passed (2026-09-23); request id `90e3ff7c-...` joined to 1 intelligence log line |
| Live E2E `e2e/practice-guide-live.spec.ts` (phone 375) | passed (2026-09-23) |

## Live walk (2026-09-23)

- `./full-app start full` (service + app + worker) + GPU sidecar on :8200 (`cuda:0`, RX 9070 XT) + OpenRouter key.
- Frozen ACCA material `80c8b138-...`; a 2-problem written run per viewport; assessments cleaned by `created_at` window via PostgREST.
- Desktop: explicit request offer -> real SSE nudge -> Hint -> Targeted -> Reveal (gated) with the closed-gate note (no attempt) -> answer problem 1 -> retry -> climb -> gate opens -> worked step streams; redaction sweep clean; the browser's `X-Request-ID` joined to the service log; zero page errors.
- Phone 375: request offer + real stream + ladder + closed gate; zero horizontal overflow; coach spans the width.
- GPU sidecar stopped after the run (rule 54).

## Log

- 2026-09-23: task opened, #46 claimed, plan + decisions locked (D-01..D-13).
- 2026-09-23: P1 (backend prompts/adapter/context) + P2 (guide router/reveal gate) done; service tests green.
- 2026-09-23: P3 (guide module + coach) + P4 (work/active-line/failed-test lifting) done; app typecheck/lint green, 28 guide tests + 22 PracticeRun tests green.
- 2026-09-23: session ended before P5 finishing tests / live E2E / review / wayfinder exit; checklist in `SCRATCHPAD.md`.
- 2026-09-23: P5a/P5b integration tests added; P5c build green; P5d live E2E green at both viewports.
- 2026-09-23: P6 review (open-code-review-delegate + thermo-nuclear + impeccable detect); fixed: coach reset on question change, StrictMode double-stream, request-id reuse across retries, truncated-stream error, retrieval degradation catch, attempt-bound-to-question gate, coding starter work tap, deduped answerable predicate, CSS type-ramp, region role. Deferred (documented in `state.md`): stream-tier gate enforcement, shared error-normalizer extraction, stream_text retry-matrix extraction.
- 2026-09-23: P6 review re-run on the fixes; fixed round 2: idle timer cleared on question change, `confirmReveal` question-change guard, per-question `coachWork`/`coachLine` reset, traceback on unexpected retrieval failure, live E2E enforces zero console errors, starter-code tap + retrieval-crash tests. Live E2E re-run green at 1280 + 375 (request id `fafa929f-...` joined to 1 intelligence log line).
