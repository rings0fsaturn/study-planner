---
name: assessment-and-practice-generation
description: Preserve the generation, attempt, and practice-run contracts for assessments and practice runs.
---

# Assessment and Practice Generation

## One family per generation call

Send exactly one entry in `recipe.formats` and `questionCount: 1`.
The service gate in `services/intelligence/app/routers/assessments.py` admits a single family and a single question per call, so an N-question run is N calls.
Build a mixed run by alternating the family per call, never by sending two families in one recipe.
Use the bounded concurrency the practice config already uses, not an unbounded fan-out.

## Generation jobs are unique per material and attempt

`public.ingestion_jobs` carries `UNIQUE (kind, material_id, attempt)`, and `enqueue_assessment_generation` allocates `attempt = max(attempt) + 1`.
Keep the advisory lock that migration `032` takes before reading the max, or two concurrent generations for one material race and one loses with a unique violation.
Without that lock the loser surfaces as a 500 `provider_unavailable` followed by a 409 `conflict` on retry, and the run silently loses a problem.

## A failed assessment is terminal

`POST /v1/assessments/{id}/regenerate` retries only an assessment in `generating` status; anything else answers `conflict`, and the generation worker drops messages for non-`generating` rows.
Do not offer a retry control for a `failed` problem.
Recover by starting a fresh run, which mints fresh assessments.

## `code_not_derivable` is an honest outcome

The coding arm refuses a material it cannot ground a coding question in, and fails that assessment with a `code_not_derivable` warning.
Material that states an input/output contract and leaves the body unimplemented is accepted; bare study notes and worksheets that already contain complete solutions are refused.
Render the server's own reason and let the learner start a new run; never fabricate a question to fill the gap.

## Client feedback is advisory, the server grade is authoritative

`CodingTaker` runs Pyodide over `visibleTests` only and labels itself advisory.
The official grade comes from the server: `judge0` for coding, `llm_rubric` for written, `objective` for deterministic formats.
Never let a client result reach the grade, and never send hidden tests, reference solutions, or authored accepted values to the browser.
One question may cite the same chunk twice with different quotes, so citation list keys must include the index.

## Practice runs are pointer-scoped

A practice run writes `PracticeRunStarted` / `PracticeRunFinished` local-first pointers and no `AssessmentCreated`.
The pointer carries no `questionIds`; the questions resolve lazily from the loaded assessments.
Pause is leave-and-return, and neither finish nor abandon invents an observation.

## Widen the pointer, not the reader

Add optional fields to a run pointer payload and fall back in the reader instead of adding a Dexie version.
Event rows are additive: a reader must keep accepting payloads written before the field existed.
