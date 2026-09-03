# #34 — Prototype: Assessment Review and Feedback UX — decision & context record

**Ticket:** [rings0fsaturn/study-planner#34](https://github.com/rings0fsaturn/study-planner/issues/34) (`wayfinder:prototype`, `wayfinder:phase2`, `ready-for-agent`, OPEN, no blockers) · local mirror `.work/specs/phase2-tickets/02-assessment-review-prototype.md`
**Parent:** spec #32 · map #4 · downstream implementation: #40 (blocked by #39 + this prototype)

## The question the prototype answers

How should graded results — rubric breakdowns, per-test-case tables, per-question explanations — render in the `/assessments/:id` review view, such that the same shared question-review primitives also serve Practice (#16)?

## Acceptance criteria (verbatim from the ticket)

- Covers summary, question navigation, objective feedback, written rubric feedback, coding test-case feedback, warnings, and partial states.
- Covers per-question and whole-assessment retry while showing prior attempts remain preserved.
- Clickable at mobile and desktop widths and records the recommended choice for implementation.
- Never displays hidden answers, rubrics, reference solutions, or hidden tests as client content.

## Already-locked surface decisions (map #4, ticket #20, resolved 2026-08-11)

Summary-led, mistake-oriented · compact responsive question navigation · progressive disclosure · family-specific feedback treatments (objective / written / coding) · expandable source evidence (citations) · per-question + whole-assessment retry with preserved attempt history · honest pending/partial/failed states · equal question weighting with family breakdown · accessible state communication · shared question-review primitives for Practice.

## Grading semantics the prototype must respect visually (map #10/#6)

- Every attempt reduces to `score ∈ [0,1]` + per-skill binary `correct` (≥ τ ≈ 0.6) = the KT observation.
- Retry = a fresh observation (new `attemptId`), never an overwrite.
- Hidden content (answers, rubrics, reference solutions, tests) stays server-only; the redacted client view never carries it.

## Contract shapes to mock against

From `services/intelligence/contracts/phase2/openapi.yaml` (mirrored at `apps/app/src/assessments/types.ts`):

- `Assessment` { id, ownerId, materialIds, status: generating|ready|partial|failed, questions[], warnings[], groundingStale, createdAt }
- `Question` { id, assessmentId, materialId, format, prompt, options[], skillTags[], authoredDifficulty, citations[] }
- `QuestionGraded` { attemptId, questionId, materialId, score, correct, perSkill[], explanation, grader: objective|llm_rubric|judge0, modelVersion, gradedAt }
- `PerSkillObservation` { skillTag, score, correct, confidence? }

## Fixture content to lift (services/intelligence/contracts/phase2/fixtures/)

| Fixture | Supplies |
|---|---|
| `generation-success.json` | objective MCQ stem/options/citations (chunkId + quote), skillTags, difficulty 3 |
| `generation-partial.json` | truncated-length case (finishReason length → partial state vocabulary) |
| `written-grading.json` | rubric feedback copy, score 0.75, perSkill |
| `execution-pass.json` | compile not_run, runtime pass, score 1, publicFeedback |
| `execution-compile-failure.json` | compile_error, stderr excerpt, score 0 |

## Mock state matrix (from plan/PLAN.md D-04)

| state | content |
|---|---|
| ready | 3 mixed questions, 1 attempt, score 0.67 |
| partial | 2/3 graded, 1 processing, citation_missing warning |
| processing | all submitted, none graded |
| failed | safety_block warning, 0 questions, whole-retry |
| retried | question with attempts #1 (0.33) + #2 (1.0), whole-assessment timeline |

## Plan pointer

Implementation runbook: `../plan/PLAN.md` · running verification: `../plan/VERIFICATION.md` · evidence screenshots land in `../plan/evidence/`.

## Recommendation for #40

> **Filled only after the HITL grill (wayfinder rule: the agent never decides the recommendation alone).**
> **HITL outcome:** the human (rings0fsaturn) drove the prototype live at both viewports and chose **Split-pane** on 2026-09-03.

- **Chosen variant:** **B — persistent split-pane** (280px question-navigator rail + summary/feedback pane on desktop ≥1024px; below 1024px B collapses to the same single-column + sticky horizontal strip as A, so mobile needs no separate decision).
- **Rationale:** the review surface is mistake-oriented (#20): the persistent rail keeps the question navigator always visible on desktop, so hopping between mistakes costs no scroll and the position context never disappears. Variant A's drawer buries the navigator in the scroll flow, and multi-attempt histories make the single column long (the full-page mobile capture is ~1500px for one question). Mobile parity is identical either way, so B wins on desktop at zero mobile cost.
- **Interaction notes carried into #40:**
  - Attempt history renders oldest → latest as stacked `AttemptCard`s inside the question panel; the latest attempt is expanded by default, prior attempts collapse to a one-line header (status tag + score + time) but stay expandable. Never delete or overwrite an attempt row (map #10: retry = fresh observation).
  - Per-question retry appends a queued attempt with an `aria-busy` skeleton and the state copy "New attempt queued — previous attempt kept (Attempt #N · score X)". While the latest attempt is queued/grading, the retry control is hidden (honest state — no double-queue).
  - Whole-assessment retry lives in the summary band header ("Retry assessment", `btn-secondary btn-sm`); it appends a new attempt-timeline entry and the prior timeline collapses into a `<details>` — "Previous attempt timeline — N attempts · last score X" — which stays present and expandable.
  - Failed assessments retry from the empty card ("Retry assessment" + "Attempt #N — started … · grading in flight" line); `safety_block` and other warnings persist across the retry.
  - `QuestionReviewCard` takes `(question, attempt)` — one card per attempt — which is the shape Practice (#16) reuses.
  - Keep the navigator `role="tablist"` with `aria-current` + arrow keys, and keep warnings as `role="status"` with jump-to-question.
- **Copy corrections:** none surfaced during the grill; the queued/attempt vocabulary read as intended.
- **Evidence:** `plan/evidence/` (7 PNGs, both variants × both viewports + retry states); live walk 2026-09-03 with zero console errors. Prototype (throwaway): `apps/app/src/prototype/assessment-review/`, dev-only route `/study/assessment-review-prototype`.