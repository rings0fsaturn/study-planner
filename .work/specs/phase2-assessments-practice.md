# Phase 2 Assessments and LLM-Guided Practice

## Problem Statement

Learners can plan study and log sessions, but they cannot turn their materials into grounded assessments or receive guided, adaptive practice inside the product.

Generated questions must be traceable to the learner's own materials, support objective, written, and coding work, and avoid exposing answer keys or reference solutions to the browser.

Practice must give useful Socratic help without simply revealing answers.

Assessment outcomes must produce a consistent mastery observation that the knowledge-tracing and adaptive-difficulty research can consume, while remaining compatible with the existing local-first event history and sync model.

The system also needs an implementation-ready boundary between the React application, Supabase-owned content, the Intelligence Service, asynchronous ingestion and generation workers, and the TypeScript/Python engine implementations.

## Solution

Add two top-level application areas, Assessments and Practice, each with a Roadmaps-style hub and detail flow.

Materials become first-class server-owned library entities. A material can be attached to one or more assessments and practice runs, and its ingestion state controls whether grounded generation is available.

The Intelligence Service provides authenticated, owner-scoped APIs for ingestion status, grounded assessment generation, server-authoritative grading, code execution, Socratic guide streaming, gated reveals, mastery projection, and adaptive recommendations.

Assessment generation uses a two-stage plan-then-generate pipeline. It grounds each question in material full text when the context fits, otherwise uses topic-stratified chunk coverage and MMR. Every generated question carries citations and warnings, uses a typed format schema, and keeps hidden grading content server-side.

Practice supports configurable multi-question runs for written and coding problems. The learner receives line-aware, anchored hints through a tiered Socratic guide. Hints can be requested by the learner or offered after cheap signals such as idleness or a failed test, but reveal is a separate gated operation.

Every question attempt is graded by the server and becomes a normalized score plus per-skill binary observations. Mastery is a pure projection behind the agreed interface, with concept-level BKT and adaptive difficulty targeting approximately 0.7 expected correctness. Roadmap feedback is advisory, versioned, and rebuildable from durable grades.

## User Stories

1. As a learner, I want to open an Assessments hub, so that I can find all assessments relevant to my study materials.
2. As a learner, I want to open a Practice hub, so that I can start guided work without navigating through unrelated roadmap screens.
3. As a learner, I want Assessments and Practice to use nested path-based routes, so that I can refresh or share an in-app location without losing context.
4. As a mobile learner, I want the new areas to fit the existing six-tab mobile navigation, so that the primary navigation remains usable on a small screen.
5. As a mobile learner, I want Settings to remain available from the header menu, so that the bottom navigation does not become crowded.
6. As a learner, I want to create a material in a library, so that I can reuse it across roadmaps, assessments, and practice.
7. As a learner, I want to add a material from a file, URL, text source, or YouTube source, so that I can study from the content I already have.
8. As a learner, I want to see extraction, chunking, embedding, ready, and failed states, so that I know whether grounded generation is available.
9. As a learner, I want to retry a failed material ingestion, so that a temporary failure does not force me to recreate the material.
10. As a learner, I want to replace a material while keeping its identity, so that dependent references remain understandable and can be marked stale.
11. As a learner, I want to archive and restore materials, so that the library stays manageable without losing history.
12. As a learner, I want to attach one or more materials to an assessment, so that questions can be grounded in a deliberate source set.
13. As a learner, I want to select materials from a responsive picker, so that multi-material selection works on both mobile and desktop.
14. As a learner, I want contentless planning materials to remain usable for planning, so that an assessment can be prepared before ingestion is complete.
15. As a learner, I want generation to be enabled only when required materials are ready, so that I do not receive ungrounded content.
16. As a learner, I want to configure the number and family mix of questions, so that an assessment fits my goal and available time.
17. As a learner, I want one assessment to contain mixed question families, so that a single run can test different kinds of understanding.
18. As a learner, I want objective questions such as multiple choice, true/false, cloze, and numeric questions, so that basic knowledge can be checked efficiently.
19. As a learner, I want written short-answer and long-form questions, so that I can demonstrate explanation and reasoning.
20. As a learner, I want coding questions for implementation, debugging, output prediction, and code completion, so that I can practise applied programming skills.
21. As a learner, I want every generated question to cite its source material, so that I can verify what the question is testing.
22. As a learner, I want warnings when grounding or generation is partial, so that I can judge the reliability of an assessment.
23. As a learner, I want generation to continue per question when safe, so that one failed question does not discard a useful assessment.
24. As a learner, I want generation to resume from a durable job, so that a network interruption does not require starting over.
25. As a learner, I want to take an assessment offline when its redacted content cache is available, so that reading and answering are not blocked by temporary connectivity loss.
26. As a learner, I want hidden answers, rubrics, reference solutions, and tests to stay off the client, so that the assessment remains valid.
27. As a learner, I want each question attempt to be recorded separately, so that retries remain honest observations rather than overwriting history.
28. As a learner, I want an attempt to be queued while offline, so that my work is not lost when grading cannot happen immediately.
29. As a learner, I want the server to grade every family consistently, so that objective, written, and coding outcomes share one understandable result model.
30. As a learner, I want a normalized score from zero to one, so that results can be compared across question families.
31. As a learner, I want to see which skills were correct or incorrect, so that feedback is actionable rather than only a single total score.
32. As a learner, I want written feedback with rubric criteria, explanation, citations, and warnings, so that I understand how my answer was evaluated.
33. As a learner, I want coding feedback with compilation and test-case outcomes, so that I can distinguish syntax, runtime, and logic failures.
34. As a learner, I want assessment results summarized before the question-by-question review, so that I can understand the outcome quickly.
35. As a learner, I want a responsive question navigator, so that I can move through review efficiently on mobile and desktop.
36. As a learner, I want to retry one question or the whole assessment, so that I can act on feedback without losing prior attempts.
37. As a learner, I want incomplete or still-processing results to be shown honestly, so that the interface never implies that grading is finished when it is not.
38. As a learner, I want to start a configurable Practice run, so that I can choose a focused set of written or coding problems.
39. As a learner, I want Practice runs to be resumable, so that leaving the app does not discard my place.
40. As a learner, I want the same written and coding shell to support multiple problems, so that the interaction remains consistent across a run.
41. As a learner, I want instant client-side code feedback where safe, so that simple errors are visible without waiting for the server.
42. As a learner, I want authoritative server-side execution for grading, so that client-side execution cannot determine the official result.
43. As a learner, I want server execution to support multiple languages in an isolated sandbox, so that coding practice is broadly useful without exposing the service.
44. As a learner, I want to request a hint when I am stuck, so that I can continue without immediately seeing the solution.
45. As a learner, I want the guide to offer a hint after an idle period or failed test, so that help appears when it is likely to be useful without interrupting me aggressively.
46. As a learner, I want hints anchored to the active line and aware of the line I am reading, so that guidance applies to my current reasoning.
47. As a learner, I want hints to progress from nudge to hint to targeted guidance, so that I retain ownership of the solution.
48. As a learner, I want a gated reveal only after the guide's conditions are met, so that the system does not accidentally give away the answer.
49. As a learner, I want guide responses to stream progressively, so that I can read useful guidance without waiting for the entire response.
50. As a learner, I want guide context limited to my question, answer, active line, and authorized material chunks, so that private or unrelated content is not sent to the model.
51. As a learner, I want a mastery projection after grading, so that the product can represent what I currently understand.
52. As a learner, I want uncertain cold-start mastery values, so that the system does not pretend to know my ability before evidence exists.
53. As a learner, I want mastery to update immediately from each valid observation, so that later practice can adapt to recent work.
54. As a learner, I want adaptive difficulty to move by one band, so that questions become more challenging without sudden jumps.
55. As a learner, I want adaptive selection to target roughly 0.7 expected correctness, so that practice is challenging but achievable.
56. As a learner, I want roadmap and progress feedback to show mastery and adaptive recommendations as advisory, so that recommendations do not silently rewrite my plan.
57. As a learner, I want all generated and graded content to be scoped to my authenticated account, so that another user cannot access my materials or results.
58. As a learner, I want rate limits and provider failures to produce clear recoverable states, so that free-tier limits do not look like data loss.
59. As a learner, I want the system to avoid accepting arbitrary free-form model prompts, so that model use is bound to an owned assessment, material, attempt, or practice run.
60. As a developer, I want one approved contract pack for objects, APIs, events, transformations, and fixtures, so that TypeScript and Python implementations remain aligned.
61. As a developer, I want normalized provider errors and request identities, so that retries and support diagnostics are deterministic.
62. As a researcher, I want redacted generation telemetry and an offline evaluation harness, so that groundedness, difficulty calibration, diversity, deduplication, and mastery estimators can be evaluated without adding evaluation to the hot path.

## Implementation Decisions

- The Phase 2 contract pack is the implementation authority for public objects, endpoint behavior, provider envelopes, durable events, transformation objects, telemetry, fixtures, and validation.
- Assessments and Practice are two top-level application areas inside the existing protected, onboarding-gated React shell. Their records are local-first where the product contract requires it, and generation or grading is online-only when server authority is required.
- A Question is the gradeable atom. An Assessment is a material-scoped container of one or more mixed-format Questions.
- The closed format families are objective (`mcq`, `multi_select`, `true_false`, `cloze`, `numeric`), written (`short_answer`, `long_form`), and coding (`implement_fn`, `debug`, `output_prediction`, `complete_code`).
- Objective grading is automatic, written grading uses an LLM rubric, and coding grading uses the isolated server sandbox. All official grading remains server-side.
- Every graded attempt produces `score` in `[0,1]` and per-skill binary `correct` observations. A correct observation uses the agreed threshold near `0.6`; mastery itself is threshold-independent.
- Authored difficulty is an integer band from 1 to 5. Observed difficulty remains a reserved field for the evaluation and adaptation work.
- Materials are first-class server-owned library entities. One material represents one ingested body. Multi-source assessments attach multiple materials and preserve separate material-scoped knowledge signals.
- Material creation and storage follow the approved trigger-driven ingestion design. The lifecycle is `pending -> extracting -> chunking -> embedding -> ready`, with `failed` and explicit retry/recovery behavior. Partial extraction may remain displayable, but RAG generation requires `ready`.
- The ingestion worker owns deterministic extraction, cleaning, chunking, and transcript handling. The Intelligence Service owns model calls, embeddings, generation, grading, and guide behavior. The frontend does not talk to the queue or event bus.
- Asynchronous work uses pgmq stage queues with Postgres as the source of truth. The approved topology uses an Ingestion worker-only service and an Intelligence API-plus-worker service.
- Content tables, generated artifacts, hidden grading blocks, jobs, and owner-scoped service objects remain server-owned. The event log contains thin pointer events rather than raw generated content.
- Dexie stores only redacted client caches. Assessment cache content includes the envelope and visible payload but never hidden answers, rubrics, reference solutions, or hidden tests. Mastery cache is a derived non-synced projection.
- Assessment creation appends the thin local-first pointer event and uses the server-owned assessment row as the generation and resume anchor. New attempt events are per Question, grouped by `runId`, and linked one-to-one by `attemptId` from `QuestionAttempted` to `QuestionGraded`.
- Retry creates a fresh attempt and a fresh KT observation. Existing event history is never rewritten.
- Generation uses a two-stage plan-then-generate topology with bounded per-slot fan-out. It prefers full material text when it fits the context budget, otherwise uses topic-stratified coverage sampling and MMR. Similarity retrieval is reserved for targeted topic slots.
- Generation uses typed per-format response schemas, citation-id verification, structural validation, deduplication, one repair attempt, coding self-checks, warning envelopes, and safe dropping of invalid slots rather than padding with ungrounded questions.
- The client supplies a mastery snapshot to generation. The server does not create a parallel mastery store for adaptive selection.
- The Intelligence Service is the only model boundary. Gemini is the default cost-effective provider on the free tier behind a provider abstraction, with a local Ollama fallback. Prompts are versioned Jinja templates, untrusted inputs are delimited as data, and native response schemas are used.
- Guide hints stream over authenticated `fetch` response streams using provider-neutral SSE frames. EventSource is not used because header authentication is required. A gated reveal is a separate request and returns only safe acknowledgement/explanation, never hidden content.
- Guide behavior is a line-aware anchored coach popover. The ladder is `nudge -> hint -> targeted -> gated-reveal`; copy orients the learner and asks a Socratic question rather than being cryptic. Triggers are learner request, idle signal, or failed test, and all triggers offer help rather than force it.
- Code execution supports hybrid client feedback and authoritative server execution. Judge0 CE is the selected server sandbox, with Piston retained only as a fallback option.
- Mastery is exposed as a stateless projection behind the agreed interface. Production uses concept-level BKT behind that interface, with immediate updates, neutral uncertain cold start, and per-skill observations. The TypeScript mirror and Python authority must remain behaviorally aligned through shared fixtures and parity tests.
- Adaptive recommendations move one difficulty band at a time, target approximately 0.7 expected correctness, and produce advisory versioned roadmap signals that can be rebuilt from durable grades.
- The generation-quality evaluation harness remains offline and evaluates groundedness, difficulty calibration, deduplication/diversity, retrieval behavior, and mastery-estimator candidates using explicit gold samples, attempt counts, shared folds, and activation gates.
- Every HTTP request carries `X-Request-ID`; related work uses `correlationId`; mutations require `Idempotency-Key`; local retries retain `clientAttemptId`.
- All remote reads and writes, storage paths, jobs, caches, generated content, and grading results are owner-scoped. Hidden content is protected at the database column/API boundary, not only by UI omission.

## Testing Decisions

- Tests must assert observable contracts and user-visible behavior, not component implementation details or provider internals.
- The highest seam is the approved contract pack: validate OpenAPI and JSON Schemas against representative success, partial, timeout, provider-error, safety-block, execution, guide-stream, reveal, and grading fixtures.
- Service tests must cover owner scoping, authentication, request identity, idempotency, normalized provider errors, job lifecycle, retry behavior, hidden-content exclusion, citation validation, grading normalization, and sandbox timeout/failure behavior.
- Pipeline tests must cover deterministic extraction and chunking, idempotent embedding resume, queue redelivery, backpressure, full-text versus sampled grounding, MMR coverage, per-slot generation, repair/drop behavior, deduplication, and coding self-checks.
- TypeScript and Python parity tests must cover the mastery interface, BKT update behavior, neutral cold start, difficulty recommendation bounds, and rebuildability from durable grades.
- App unit tests should exercise the existing Auth, EventStore, SyncProvider, and local cache seams through dependency injection and constructor/provider fakes, following the repository's existing provider and fake-IndexedDB patterns.
- App behavior tests must cover assessment creation, material picker filtering, generation readiness, partial-generation rendering, offline cache access, offline attempt queueing, account isolation, account switching, resume after refresh, retry semantics, and event order.
- Review and Practice UI tests must use accessible roles and labels, scoped application locators, and stable test IDs only where user-facing locators are insufficient.
- Practice tests must cover the run lifecycle, written and coding shells, active-line anchoring, learner-requested and offered hints, streamed deltas, tier progression, reveal gating, no-answer leakage, client/server execution distinction, and reconnect behavior.
- Responsive browser coverage must include the existing mobile-first viewport and a desktop viewport for hubs, pickers, assessment review, Practice editor, guide popover, status states, and question navigation.
- End-to-end coverage must verify the authenticated journey from material selection through generation, taking, grading, review, retry, Practice hinting, mastery projection, and roadmap recommendation. The test environment must use hermetic user data and avoid production credentials.
- Offline and restore tests must verify local append authority, queued remote work, retry after failure, fresh-device restore, account switching, and preservation of newer local history.
- Security tests must prove that another user cannot read materials, chunks, jobs, assessment content, attempts, hidden blocks, or public service objects, and that raw event-log data and arbitrary model prompts are not exposed.
- Evaluation tests must remain outside the generation hot path and should fail closed when a gold sample, shared fold, or minimum attempt gate is not met.

## Out of Scope

- Multiplayer, peer review, collaborative practice, and competitive leaderboards.
- Voice, audio, podcast generation, and proctoring.
- Anonymous unmoderated posting or community features unrelated to Assessments and Practice.
- Platform posting APIs and social distribution integrations.
- Client-side authoritative grading or shipping answer keys, rubrics, reference solutions, or hidden tests.
- A parallel mastery model or a second server-side mastery store.
- Replacing the existing local-first event and sync spine with a frontend-facing message bus.
- Putting raw generated content or raw provider payloads into durable product events.
- Evaluation logic in the online generation hot path.
- Spaced-repetition scheduling for when to reassess; this spec covers mastery and adaptive difficulty, not scheduling intervals.
- Final UI decisions for the material library, assessment review, or roadmap-feedback surfaces beyond the contracts and already-resolved interaction principles. Those surfaces require their own implementation decisions or prototypes where the map leaves them open.

## Further Notes

- The Phase 2 map and its resolved decision tickets are the rationale source for this spec. The approved contract pack is the implementation-facing source of truth.
- This spec intentionally preserves full capstone scope. It does not convert unresolved complexity into an MVP deferral.
- The existing roadmap and progress engines remain owners of reusable roadmap and projection logic. Assessment and Practice components must call those boundaries rather than duplicate booking, mastery, or projection algorithms.
- The first implementation tickets should be generated from this spec in dependency order, beginning with shared service/content boundaries and the smallest vertical slice that proves a learner can select a ready material, generate one grounded question, answer it, receive an authoritative grade, and see the resulting mastery observation.
