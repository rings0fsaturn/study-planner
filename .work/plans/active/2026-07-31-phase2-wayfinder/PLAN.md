# Phase 2 wayfinder chart — Assessments + LLM-guided Practice

**Task id:** `2026-07-31-phase2-wayfinder`
**Type:** wayfinder charting (planning; destination = spec + working prototypes)
**Tracker:** GitHub Issues on `rings0fsaturn/study-planner` (the map + tickets are the canonical artifact; this doc is the `.work/` index/pointer).
**Map:** [#4 Phase 2 map: Assessments + LLM-guided Practice](https://github.com/rings0fsaturn/study-planner/issues/4)

> This is an M.Tech **capstone**: build feature-rich and complete — no ship-fast / MVP / deferral tradeoffs.

## Destination

A validated, feature-rich Phase 2 spec — Assessments (quiz / written / coding) plus an LLM-guided Practice area — **RAG-grounded** and **coupled to the knowledge-tracing / adaptation research pillar**, backed by **working throwaway prototypes** of the risky parts (above all the inline-hint live guide). Output: a spec ready for implementation planning.

## Decisions locked during charting (grilling)

1. Destination shape — spec **+ working prototypes** (execution rides into the map).
2. Guidance style — **tiered Socratic**; the guide never hands over the answer.
3. When it helps — **hybrid on-demand**: user asks + cheap signals (idle timer, failed test run) that *offer* a hint.
4. Moment-to-moment surface — **inline hints** (Copilot/Cursor UX, but ghost text is a hint/question, never finished code/prose).
5. Content grounding — **full RAG now**: ingestion + chunking + embeddings + pgvector + async worker.
6. Research coupling — **fully couple to KT/adaptation**: outcomes → mastery signal → adaptive difficulty → roadmap feedback.
7. Code execution — **hybrid**: client-side (Pyodide/JS) instant feedback + server sandbox for authoritative grading.
8. Server sandbox (resolved, #11) — **self-host Judge0 CE** over HTTP; Piston = fallback.

**Out of scope:** multiplayer / peer features · voice / podcast · proctoring / anti-cheat.
**Reference:** `../../../../research/external/open-notebook-findings.md` (port, don't run) · `../../../../research/external/code-sandbox-comparison.md`.

## Execution order (waves)

Order is driven by the blocking graph + the capstone rule "de-risk the fuzzy part early". #11 already done.
Legend: ☐ open · ✅ done.

**Wave 0 — Frame (cheap, constrains everything)**
1. ✅ #5 App IA & navigation — where the features live; every later ticket references it. (resolved 2026-07-31: 2 tabs, material-scoped, path-param routes, local-first records + online generation)
2. ✅ #6 Assessment types, formats & scoring — self-contained schema decision; later unblocks #14. (resolved 2026-08-01: Question-atom + mixed-container Assessment; 3 families/closed format enum; unified `[0,1]`+per-skill-binary KT contract, τ≈0.6; difficulty 1..5 authored + reserved empirical slot)
3. ✅ #10 Persistence & local-first fit — the event/data-model spine everything must obey. (resolved 2026-08-01: three-layer split — pointer event + server-owned content rows + redacted `assessmentContentCache`; per-Question runId-grouped `QuestionAttempted`→`QuestionGraded` [retry = fresh KT observation]; all grading server-side; mastery = `masteryCache` projection [`MasteryUpdated` reserved for #14]; Dexie **v5→v6** adds the two cache tables only. **Wave 0 complete.**)

**Wave 1 — De-risk the centerpiece (runs in parallel with the rest)**
4. ☐ #12 Inline-hint live guide (prototype) — highest uncertainty; grounds the practice spec; unblocks #16.

**Wave 2 — AI infra trio (internal order matters)**
5. ☐ #9 AI backend home & streaming — the home all model calls assume.
6. ☐ #7 Content ingestion & storage — the content that gets chunked (fixes title-only gap).
7. ☐ #8 Vector store, embeddings & async jobs — consumes #7; picks the worker. Trio unblocks #13.

**Wave 3 — Downstream (open as upstream closes)**
8. ☐ #13 Grounded generation pipeline — needs #7 #8 #9.
9. ☐ #14 Grading → mastery signal — technically unblocked once #6 + #10 done (may pull earlier); placed here to follow the generation shape.
10. ☐ #15 KT model & adaptive-difficulty loop — needs #14.
11. ☐ #16 Practice session model — needs the #12 prototype.

**Parallel tracks** (if running concurrent sessions): (A) #5/#6 product framing · (B) #12 prototype · (C) #9→#7→#8 infra chain. They converge at #13/#14.

**Why not pure foundation-first:** destination includes prototypes, and #12 (the inline guide) is the biggest unknown most likely to reshape the spec — prove it before building RAG around assumptions.

## Tickets

### Frontier (takeable now)

| # | Ticket | Type | Wave | Status |
|---|---|---|---|---|
| [#5](https://github.com/rings0fsaturn/study-planner/issues/5) | App IA & navigation for Assessments + Practice | grilling | 0 | ✅ closed |
| [#6](https://github.com/rings0fsaturn/study-planner/issues/6) | Assessment types, formats & scoring spec | grilling | 0 | ✅ closed |
| [#7](https://github.com/rings0fsaturn/study-planner/issues/7) | Content ingestion & storage design | grilling | 2 | ☐ open |
| [#8](https://github.com/rings0fsaturn/study-planner/issues/8) | Vector store, embeddings & async job mechanism | grilling | 2 | ☐ open |
| [#9](https://github.com/rings0fsaturn/study-planner/issues/9) | AI backend home & streaming | grilling | 2 | ☐ open |
| [#10](https://github.com/rings0fsaturn/study-planner/issues/10) | Persistence & local-first fit | grilling | 0 | ✅ closed |
| [#11](https://github.com/rings0fsaturn/study-planner/issues/11) | Code execution sandbox selection | research | — | ✅ closed — Judge0 CE |
| [#12](https://github.com/rings0fsaturn/study-planner/issues/12) | Inline-hint live guide (prototype) | prototype | 1 | ☐ open |

### Blocked (wired, wait for upstream)

| # | Ticket | Type | Wave | Blocked by |
|---|---|---|---|---|
| [#13](https://github.com/rings0fsaturn/study-planner/issues/13) | Grounded assessment-generation pipeline | grilling | 3 | #7 #8 #9 |
| [#14](https://github.com/rings0fsaturn/study-planner/issues/14) | Grading → mastery signal mapping | grilling | 3 | #6 #10 |
| [#15](https://github.com/rings0fsaturn/study-planner/issues/15) | KT model & adaptive-difficulty loop | grilling | 3 | #14 |
| [#16](https://github.com/rings0fsaturn/study-planner/issues/16) | Practice session model (written + coding) | grilling | 3 | #12 |

### Fog (not yet specified) / see map

Spaced-repetition scheduling · roadmap-feedback UX · capstone evaluation & metrics · prompt architecture + injection safety · material library/detail surface (surfaced by #5) · assessment feedback/review surface (surfaced by #6) · content cache lifecycle/eviction (surfaced by #10).

## How to continue

Run `/wayfinder 4` (optionally naming a ticket). One decision ticket per session; research tickets may resolve AFK. Frontier query: `gh issue list --label wayfinder:phase2 --state open`. Claim a ticket by assigning it to yourself first.
