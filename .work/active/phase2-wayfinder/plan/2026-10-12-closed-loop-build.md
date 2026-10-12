# Closed-loop build plan — Phase 2 final work
_State: `active/phase2-wayfinder/state.md` · Grill: Q1–Q14 locked (see SCRATCHPAD.md) · Status: ready for build · Date: 2026-10-12_

## Locked decisions driving this plan

Q1 `(materialId, skillTag)` key · Q2 Jev judgment + code router, prose on feedback arm ·
Q3 3-way `hold/reprioritize/suggest_replan` · Q4 fire on roadmap entry, updated-only ·
Q5 replan deep-link, no presets · Q6 new `POST /v1/loop/decision` on JEV key ·
Q7 session memo on input hash · Q8 params never lead, one batched LLM translation ·
Q9 fold into `feedback/copy` ceiling (`feedback-v2`, output stays 7 fields) ·
Q10 posture included (probe-proven) · loop v1 questions locked (A/B evidence) ·
Q11 wire `masterySnapshot` · Q12 wire recommendations with local fallback ·
Q13 regenerate app-seam deleted (server half open, issue #021) ·
Q14 thresholds frozen; `sweep_evidence_floor` picks table-backed splits later.

## Cross-cutting rules

- Rule 17: every new failure path logs with `request_id`/`trace_id` and returns
  through `service_error`; no silent `except`.
- Rule 22: new client methods expose typed errors only (AbortError/TypeError/unknown
  normalized); `X-Request-ID` on every intelligence call.
- Rule 42: generation contract untouched (one family per call, failed terminal,
  `code_not_derivable` honest); snapshot steers within it, never around it.
- No Dexie version (loop memo is session-only), no `MasteryUpdated` event, no
  booking writes (advisory boundary holds; `/replan` Apply stays explicit).
- Rule 80: probe/smoke before any spend beyond cents; `jev-1.13` pinned.

## Slice 1 — `POST /v1/loop/decision` (server)

- Files: new `services/intelligence/app/routers/loop.py` (validate state ceiling,
  owner-scope every material id, caps mirroring feedback `_MAX_*`); `JevClient.decide`
  with `loop_questions()`; `route_loop_action`; typed `service_error` on any
  failure; info log with `request_id`, choice, confidence, sufficiency, tokens,
  model (the future sweep's log shape).
- State ceiling: `signals[]` + `evidence_summary` + `posture` (v1 shapes); titles
  and skill tags delimited as untrusted data; no chunk text, answers, rubrics,
  or hidden tests (they never enter the request).
- Router pins the lock: floor `LOOP_EVIDENCE_SUFFICIENT_MIN` 0.5, fail-closed
  hold on guard/low/middle/unknown; correct the three `Loop v0 draft
  (unlocked)` docstrings to v1-locked in the same change.
- Tests (`tests/test_loop_decision.py`, no network): ceiling validation rejects
  (bad shape, over caps, unowned material), fake-JevClient verdict mapping
  (three choices + guard-hold + mid-hold + unknown-hold), failure maps to typed
  error, `X-Request-ID` echoed.
- Verify: `pytest tests/test_loop_decision.py`, `ruff check`, one live smoke
  (`~$0.0001`, tokens + verdict only).

## Slice 2 — client + `useLoopDecision` hook (app)

- Files: `assessmentClient.getLoopDecision` (Rule-22 errors, `X-Request-ID` +
  `Idempotency-Key` like `getFeedbackCopy`); new `roadmap/feedback/useLoopDecision.ts`
  (fires on updated-state entry only, session memo keyed on hash of exact input
  + modelVersion, failures resolve to null so static copy renders, never throws).
- Loop input-builder (owned here, nothing else builds it): pure
  `buildLoopInput(projections, evidence, posture)` returning canonical JSON
  (`signals[]`, code-computed `evidence_summary` totals, `posture` from the
  progress projection); the memo hashes exactly this object, so the hash is
  defined by construction.
- Transition subscription (Q4): the hook subscribes to feedback-state
  transitions, not mount only — post-Rebuild stale-to-updated without remount
  refires the memo-checked call.
- Verdict-to-action wiring (Q3/Q5, owned here): the hook returns the routed
  verdict; `RoadmapFeedbackSection` conditions on it — `reprioritize` reorders
  up-next + ledger within current bookings, `suggest_replan` routes Open to
  `/replan` (deep-link, no presets), `hold` renders static copy.
- Tests: hook with fake client (verdict pass-through, failure-to-null,
  same-hash dedupe, hash-change refire); error normalization triple
  (AbortError/TypeError/unknown value).
- Verify: focused vitest, `tsc --noEmit`, eslint.

## Slice 3 — `feedback-v2` (server template + validation)

- Files: `prompts.py` (verdict input line via `_feedback verdict` helper mirroring
  `_feedback_signal_line`, plain-words system rule, version bump
  `feedback-v1` → `feedback-v2`); `routers/feedback.py` `_validate` accepts
  optional `loopDecision` (`verdict` enum + `confidence` 0..1).
- Contract: output stays the 7 fields; verdict reshapes `advisory`/`advisoryNote`
  only. STE wording reviewed with the style skill before locking lines.
- Repair threading: the verdict line goes through both `build_feedback_messages`
  calls (initial + repair) so a repair never regresses to v1 words.
- Tests: 7-field shape unchanged, verdict-in → advisory mentions order/replan
  plainly with zero numbers/names, no-verdict → identical to v1, repair +
  static fallback intact.
- Verify: `pytest tests/test_feedback_copy.py`, ruff, re-run the accepted
  sample (reprioritize case) through the new template.

## Slice 4 — `masterySnapshot` wiring (Q11)

- Files: `PracticeThis.tsx` sends the snapshot it already builds guidance from;
  `generation/models.py` accepts it; `routers/assessments.py` validation admits
  it; the worker threads it to blueprint construction (absent snapshot logs +
  proceeds legacy, so old callers never break); blueprint steers per-skill
  difficulty/topics within the one-family-per-call gate.
- Steering rule (concrete, gate-compatible): the single-question blueprint picks
  its band by the weakest in-scope skill tag, topics prefer weakest-tagged
  coverage; family mix, counts, and refusal behavior unchanged.
- Tests: client sends snapshot entries matching cache; server accepts + steers
  (unit on blueprint with/without snapshot); generation contract tests untouched
  and green (rule 42: family gate, terminal-failed, honest refusal all hold).
- Verify: backend generation tests, app practice tests, `tsc`, eslint, ruff.

## Slice 5 — recommendations wiring (Q12)

- Files: client `getRecommendations(materialId?, skillTag?, currentBand?)`
  matching the server query params with `X-Request-ID`; Adaptive path tries
  server first, falls back to local `recommendBand` offline; server
  `AdaptiveRecommendation` becomes the consumed shape (TS name reconciled via
  alias, no churn).
- Tests: online uses server value; offline/timeout falls back local; parity
  goldens still agree (existing suite).
- Verify: focused vitest, `tsc`, eslint.

## Slice 6 — verification + wrap

- Full: app suite, backend suite, `pnpm typecheck`, `pnpm lint`, both builds.
- Live E2E (request-id join, 1280 + 375, zero console errors): grade → cache
  refresh → roadmap `updated` → verdict → batched copy → Keep stays /
  Open reaches `/replan`; forced-500 shows static copy; shared account cleaned.
- Session-end distill (`state.md`), STATUS refresh, wayfinder exit for #49
  when its ACs tick.
