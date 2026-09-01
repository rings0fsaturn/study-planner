# State – issue-38-grounded-objective-assessment
_Spec: specs/phase2-tickets/06-single-grounded-objective-assessment.md (ticket #38, parent #32, map #4) · Plan: archive/issue-38-grounded-objective-assessment/plan/ · STATUS row: issue-38-grounded-objective-assessment · Status: done · Updated: 2026-08-31_

## Current state & next
- Implemented + live-verified 2026-08-23: Single Grounded Objective Assessment shipped end to end.
- Plan status: ✅ Complete — P0 `1f950ed`,`ae11c8a`,`98a3b12` · P1 `2494ede` · P2 `8c64f18` · P3 `a782e3e` · P4 `2c42c1c` · P5 `4e45e0e` · P6 `b76c31d` · P7 live-verified.
- Migration to work-journal layout 2026-08-31: folder rebuilt as active/<id>/{state.md,SCRATCHPAD.md,plan/}; STATUS now one row + Detail pointer. No code change.
- WRAP completed 2026-08-31: research/ and prompts/ empty (nothing to promote); SCRATCHPAD reset then removed; folder archived to archive/issue-38-grounded-objective-assessment/; STATUS row flipped to Done.

## Done so far
- P0: prerequisite #57 contract neutralization landed (`gemini/` → `provider/`, OpenAI-style envelopes, two review rounds) — `1f950ed`,`ae11c8a`,`98a3b12`.
- P1: migrations 018–022 (assessments/questions, service-role-only answer_block, generation jobs, enqueue RPC, column-grant revoke); job-kind serialization — `2494ede`.
- P2: generation domain (D-08 adapter matrix, one-repair validation, retrieval-driven RAG context) — `8c64f18`.
- P3: threaded two-arm worker + `retry_after_seconds` (migration 019) — `a782e3e`.
- P4: `POST /v1/assessments/generate` + redacted `GET /v1/assessments/{id}` — `2c42c1c`.
- P5: typed AssessmentClient (rule 22), AssessmentProvider, AssessmentCreated pointer event (no Dexie bump) — `4e45e0e`.
- P6: config + detail UI with polling/retry/resume, ready-only entry gate — `b76c31d`.
- P7: live E2E desktop 13 s + mobile 5 s, zero console errors; screenshots in plan/evidence/. Service 391(+16)/7 pre-existing golden; app 699/699; contracts 12/12 — live-verified.
- Post-review hardening round (thermo-nuclear): clear-before-set poll, failure banner, atomic `complete_assessment_generation` RPC (migrations 023/024), citation-drop alias, one `_failure` helper, 409 body-code parsing — `1149649`.

## Flow trace
- Learner picks a ready, owner-scoped material → configures one objective question + difficulty band → `POST /v1/assessments/generate` returns a durable AsyncJob (`kind: generation`).
- Worker generates one grounded MCQ via DeepSeek/OpenRouter behind #54 provider-neutral envelopes, retrieval-driven from `match_content_chunks` (hybrid, query_text).
- Answer keys stay server-only (`answer_block`): column grant revoke (migration 022) → authenticated gets 403 live; redacted GET carries no answer/answerBlock/correctIndex.
- App polls/resumes from the job; `AssessmentCreated` pointer event appends through the existing sync path; ready gate on Material detail.

## Files affected
- services/intelligence/migrations/* – 018 (assessments/generation) · 019 (retry_after_seconds) · 020/021 (RPC row shape + attempt pick) · 022 (column-grant revoke) · 023/024 (atomic accept RPC) – remote schema.
- services/intelligence/app/generation/ – adapter, validation, prompts, context, worker, repo (GenerationRepo protocol).
- services/intelligence/app/routers/assessments.py – generate + redacted get endpoints.
- apps/app/src/assessments/ – AssessmentClient, AssessmentProvider, config + detail UI.
- apps/app/src/events/EventStore.ts + sync/types.ts – AssessmentCreated kind/payload (no Dexie bump).

## Pitfalls & rules
- Must REVOKE ALL FROM anon, authenticated + re-grant public columns for answer_block isolation (migration 022) — Supabase default ACL outranks a column grant (real AC-3 hole).
- `match_content_chunks` must pass `query_text` (4-arg hybrid overload) or the call is PGRST203-ambiguous live.
- `length` maps to `malformed_output` per D-08, not `partial` (partial reserved for multi-question slices); temperature const 0.3 vs GENERATION_TEMPERATURE is a runtime knob outside the contract envelope.
- jsonb columns must be stored as real JSON values, not JSON strings (live bug `de53049`).
- Clear-before-set on the detail-page poll so it stops on terminal status (live bug).
- Never migrate an already-applied migration (rule 35): additive 019–024 follow-ups were separate migrations.

## Decisions in force
- DeepSeek via OpenRouter is the sole generation provider (#52/#55 closed); reasoning off for objective generation (#53/#56) — 2026-08-22.
- Service-side-only grading, answer keys never reach browser/event-log/telemetry (max-integrity option) — 2026-08-01.
- Provider-neutral envelopes (messages[], responseSchema, flattening) from #54 — 2026-08-22.
- Kept `assessmentContentCache` redacted + mastery as a derived `masteryCache` projection (from wayfinder #10) — 2026-08-01.

## Open
- The plan's REST plumbing + test-double duplication (userrest/repository, api fakes) was flagged as a follow-up cleanup, not blocking — still open.