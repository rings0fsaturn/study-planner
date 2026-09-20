# State – phase2-wayfinder
_Spec: GitHub map #4 (rings0fsaturn/study-planner) + specs/ · Plan: active/phase2-wayfinder/plan/ · STATUS row: phase2-wayfinder · Status: active · Updated: 2026-08-31_

## Current state & next
- Umbrella execution program for Phase 2 (map #4). Wave 0 frame (#5 App IA, #6 assessment types, #10 persistence) resolved + closed; execution now rides the #33–#49 ticket spine.
- Implementable: #36 material library (done + live-verified), #37 ingestion (done); #38 grounded assessment (done + live-verified, its own task). Provider prep #52–#56 closed; #57 contract neutralization landed.
- #62 scoped question generation (done 2026-09-20: AC1-AC6 + R1-R8, wayfinder exit run) and #63 roadmap material attachment (done 2026-09-20: AC1-AC7, wayfinder exit run) are closed.
- Open frontier: #45 Coding Practice Runs (unblocked by #44) · #35 Roadmap Feedback prototype (claimed) · #48 Generation Quality Harness · #12 inline-hint live guide (Wave 1) · #50 learner-feedback contract decision (blocked by #35).
- Next: #45 Coding Practice Runs (unblocked 2026-09-20 when #44 closed); #48 is the other unblocked ticket. No new ticket started in the 2026-09-20 review session by request.

## Done so far
- Charted the Phase 2 wayfinder map on GitHub Issues (map #4) 2026-07-31; locked 7 design decisions (destination = spec + working prototypes; tiered Socratic guidance; hybrid on-demand trigger; inline-hint surface; full RAG; full KT coupling; hybrid code execution).
- Wave 0 complete: #5 App IA (2026-07-31), #6 assessment types/formats/scoring (2026-08-01), #10 persistence & local-first fit (2026-08-01) — all resolved + closed; Dexie v5→v6, three-layer content split, question-grained attempts.
- #11 code sandbox → self-host Judge0 CE (2026-07-31); #17 async/infra pivot → pgmq (2026-08-02); #18 generation-quality harness, #19 material library UX, #20 assessment review UX resolved 2026-08-11; #22 contract pack.
- #13/#18, #15/#20 issue-number normalization on GitHub and .work 2026-08-13.
- Execution slices #36–#57 landed on the #33–#49 spine (see their own task rows in STATUS).

## Flow trace
- The GitHub map #4 is the canonical artifact; this folder indexes it. A local snapshot lives at active/phase2-wayfinder/research/map-4.md.
- Tickets carry `wayfinder:<type>` labels; the frontier is `gh issue list --label wayfinder:phase2 --state open` minus any open "Blocked by:" ref.
- Decision tickets (grilling + domain-modeling) resolve AFK-able research tickets and open one decision ticket per session. Claim a ticket by assigning it to yourself.

## Files affected
- active/phase2-wayfinder/plan/PLAN.md + VERIFICATION.md – charting runbook + running log.
- active/phase2-wayfinder/research/map-4.md – local snapshot of GitHub map #4.
- research/external/open-notebook-findings.md, research/external/code-sandbox-comparison.md – research subagent outputs referenced by the map.

## Pitfalls & rules
- Destination includes throwaway prototypes — de-risk the fuzzy #12 inline guide early; do not build RAG around unproven assumptions.
- Model-layer economics amended by #9 (2026-08-01): no Claude; cost-effective/accurate-enough on Google Gemini free tier; feature scope stays full.
- Capstone principle: build feature-rich and complete — no ship-fast/MVP/deferral tradeoffs.
- Async = pgmq (Kafka rejected); two Python services; frontend stays local-first and reads derived state over HTTP.

## Decisions in force
- Destination = spec + working prototypes (2026-07-31).
- Guidance = tiered Socratic, never hands over the answer (2026-07-31).
- Full RAG now + full KT/adaptation coupling (2026-07-31).
- Self-host Judge0 CE over HTTP; Piston fallback (2026-07-31).
- pgmq async, two Python services, Supabase Postgres single source of truth (2026-08-02).

## Open
- #12 Inline-hint live guide prototype (Wave 1, highest uncertainty, unblocks #16).
- Wave 2 AI infra trio #9→#7→#8 (unblocks #13).
- Wave 3 downstream #13→#14→#15→#16.
- #50 LLM learner-feedback contract decision (surfaced here, previously untracked).