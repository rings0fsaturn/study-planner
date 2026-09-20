# State – issue-43-mastery-adaptive-difficulty

_Spec: GitHub #43 (copy: specs/phase2-tickets/11-mastery-adaptive-difficulty.md, parent #32, map #4) · Plan: active/issue-43-mastery-adaptive-difficulty/plan/ · STATUS row: issue-43-mastery-adaptive-difficulty · Status: active · Updated: 2026-09-20_

## Current state & next

- Ticket #43 claimed 2026-09-20 (assigned `rings0fsaturn`); task folder opened; #41 exit completed as the prereq (closed, archived).
- Scope per user decisions (2026-09-20): concept-level BKT directly behind the #14 interface; BKT params chosen by a small offline bake-off on existing evidence (fallback = pinned defaults with `modelVersion` bump if data is too thin); minimal UI in #43 (projection + one-band ~0.7 recommendation contract; the full advisory surface belongs to #47).
- Mastery is a stateless owner-scoped projection: no server store, no migration, no `MasteryUpdated` event (map #4 #14/#15).
- Next: P1 – the BKT parameter bake-off; pin constants + `modelVersion`.

## Done so far

- 2026-09-20: P0 – #41 wayfinder exit (resolution comment, close, map #4 line incl. the missing #39/#40/#42 lines, STATUS flip, folder archived, commit `575f5c7`); #43 claimed on GitHub; task folder + STATUS row opened.

## Flow trace

- Contract seam: `/v1/mastery` GET returns `MasteryProjection[]` (`services/intelligence/contracts/phase2/openapi.yaml:87-92,159`); `GenerationRequest.masterySnapshotVersion` exists (`openapi.yaml:143`) but the snapshot payload seam is undefined; `AdaptiveRecommendation` is named in `PIPELINES.md:72-76` but has no schema.
- Observation input: `QuestionGraded.perSkill[]` (`PerSkillObservation` = skillTag + score + correct, `openapi.yaml:158`); grading already emits per-skill observations via `per_skill_observations` (`services/intelligence/app/grading/grader.py`, tau ~0.6).
- No mastery code exists anywhere: no BKT in `packages/py-progress/`, no TS mirror in `packages/progress/`, no `masteryCache` in Dexie (v6 ends at `assessmentAttempts`/`assessmentContentCache`, `apps/app/src/events/EventStoreProvider.tsx:50-63`); #44 state confirms #43 owns Dexie v7.
- Downstream: #44 AC3 deferred to #43 (D-09); #47 blocked on #43.

## Files affected

- none yet

## Pitfalls & rules

- Must honor map #4 capstone principle: feature-rich and complete, no MVP deferral.
- Redaction: mastery projections are derived public numbers; they must not leak hidden blocks (they cannot - input is only `QuestionGraded` public fields).
- Per #14: `p` in [0,1], uncertainty/confidence, cold-start neutral and uncertain; mastery threshold-independent (tau 0.6 affects `correct` only).
- Per #15: concept-level BKT, immediate updates, one-band movement, ~0.7 target, advisory + rebuildable, `modelVersion` on every output.
- Parity: TS mirror and Python authority must stay aligned through shared fixtures and parity tests.
- No parallel mastery model: the client supplies a mastery snapshot to generation (`masterySnapshotVersion`); the server never stores mastery.

## Decisions in force

- BKT direct, not the #14 Bayesian baseline first (user 2026-09-20).
- BKT params from a small offline bake-off on existing evidence; fall back to pinned defaults + `modelVersion` bump if data is too thin (user 2026-09-20).
- Minimal UI in #43; advisory surface (mastery meters, roadmap feedback) belongs to #47 (user 2026-09-20).

## Open

- none