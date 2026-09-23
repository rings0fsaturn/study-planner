# #35 - Prototype: Roadmap and Progress Feedback UX - decision & context record

**Ticket:** [rings0fsaturn/study-planner#35](https://github.com/rings0fsaturn/study-planner/issues/35) (`wayfinder:prototype`, `wayfinder:phase2`, `ready-for-agent`, CLOSED 2026-09-23) · local mirror `.work/specs/phase2-tickets/03-roadmap-feedback-prototype.md`
**Parent:** spec #32 · map #4 · downstream implementation: #47 (blocked by #11 + this prototype) · LLM feedback contract: #50 (blocked by this prototype)

## The question the prototype answers

How should mastery and adaptive recommendations surface in the Roadmap and Progress views - advisory signals, uncertainty, one-band difficulty movement, model-version context, stale/rebuildable feedback - without inventing a second mastery model or silently changing pinned roadmap bookings?

## Acceptance criteria (verbatim from the ticket)

- The prototype shows cold-start uncertainty, updated mastery, adaptive recommendation, stale projection, and rebuild states.
- The prototype clearly distinguishes advisory feedback from pinned roadmap decisions.
- The prototype is clickable at mobile and desktop widths and records the recommended choice for implementation.
- The prototype consumes the approved mastery and adaptive-recommendation vocabulary without redefining its algorithm.

## Already-locked surface decisions (map #4, ticket #21, resolved 2026-08-03)

Roadmap feedback is **advisory, versioned, and rebuildable**; mastery results surface back into roadmap and progress views; adaptive output never rewrites pinned bookings. The vocabulary was fixed by #15: concept-level BKT behind the #14 mastery interface, neutral cold start with uncertainty, one-band movement targeting ~0.7 expected correctness.

## Approved vocabulary the prototype must respect (map #15 / #43)

- `MODEL_VERSION = 'bkt-v1'` (`packages/progress/src/mastery.ts:13`).
- `MasteryProjection` { mastery, uncertainty, confidence, n, modelVersion, recentTrend? }.
- `DifficultyRecommendation` { currentBand, recommendedBand, targetExpectedCorrectness, modelVersion }; one band per step, target 0.7, cold start keeps the band.
- App reader wrapper: `apps/app/src/assessments/masteryBands.ts` (`DEFAULT_BAND = 3`, `bandGuidanceByMaterial`).
- Projection is **pure/stateless**: the same durable grades always rebuild to the same values. No server store, no `MasteryUpdated` event.

## HITL history on this ticket

| Date | Outcome |
|---|---|
| First review | Prototype reached from the Roadmap detail page via a dev-only "See learning feedback" link; raw mastery decimals and expected-correctness percentages rejected as the primary feedback; plain-language learner summaries preferred. |
| Second review | Need for an approved LLM-generated learner-feedback contract split out to #50. |
| Third review | **Variant B refined**: learner-facing summary first, "What we know" / "What we are watching" second, inspectable evidence trail third, advisory action + pinned boundary last; raw decimals not used in B. |
| Partial agreement | Working direction = **Variant B**; principle locked (plain language leads, decimals not primary); final visual polish + exact LLM presentation deferred. |
| **Final HITL pick (2026-09-23)** | **Variant B chosen for implementation.** |

## Variants compared

| Variant | Surface | Verdict |
|---|---|---|
| A - Advisory ribbon | Ribbon over the Roadmap/This-week view + mastery meter + advisory box | Rejected: the advisory layer reads as a banner on the plan rather than a learner-facing story, and the mastery meter leans on a bar proportion. |
| **B - Evidence ledger** | Learner story card → what we know / what we are watching → inspectable evidence trail → advisory action + pinned boundary | **Chosen.** |
| C - Progress canvas | A confidence line chart with a suggested next step | Rejected: the chart implies a measured trajectory the projection does not yet support, and it buries the evidence. |

## Recommendation for #47

> **HITL outcome:** the human (rings0fsaturn) reviewed the prototype live at desktop and mobile widths and chose **Variant B** on 2026-09-23.

- **Chosen variant:** **B - Evidence ledger**, the learner-facing learning story with an inspectable evidence trail.
- **Rationale:** the feature's job is to explain *why* the next step is suggested, not to display a score. B leads with plain language, then shows the reasoning ("what we know" / "what we are watching"), then the raw evidence a learner can inspect, and only then the advisory action next to the pinned roadmap it must not disturb. A's meter and C's chart both imply a precision the cold-start projection does not have.
- **Hierarchy carried into #47** (locked by HITL, in order):
  1. Learner-facing summary.
  2. "What we know" and "What we are watching".
  3. Inspectable evidence trail.
  4. Advisory action, then the pinned-roadmap boundary.
- **Boundary interaction carried into #47:** an explicit choice between **Keep roadmap** (use the suggestion in the next assessment only) and **Open replan** (review a new schedule before anything changes). The model never edits pinned sessions. In the prototype this choice is recorded to the URL + localStorage only; #47 must route it through the real roadmap/replan lifecycle instead.
- **Model context (technical, non-primary):** `modelVersion`, graded-observation count, uncertainty, current→recommended band, and target correctness belong behind a collapsed "Model context" disclosure. Raw mastery decimals and expected-correctness percentages must never be the primary learner UX.
- **States to implement:** cold-start uncertainty, updated mastery, adaptive recommendation, stale projection, rebuild. The prototype derives these from the real engine (a 4-observation prefix for stale/rebuilding, all 5 for updated), so a rebuild genuinely recomputes.
- **Vocabulary rule for #47:** consume `@study-tracker/progress` (`projectMastery`, `recommendBand`) and the `masteryBands` reader; never re-implement BKT or a second band model (rule 41).
- **Deferred to #50:** the exact LLM-generated feedback contract (input context, output schema, grounding/citation, model boundary, stale/rebuild, safety). #47 should not invent its own copy pipeline.
- **Evidence:** `plan/evidence/` (desktop 1280, mobile 375, mobile dialog); live walk 2026-09-23 with zero console errors, no horizontal overflow, and a reload-persistent recorded choice. Prototype (throwaway): `apps/app/src/prototype/roadmap-feedback/`, dev-only route `/study/roadmap-feedback-prototype`.
