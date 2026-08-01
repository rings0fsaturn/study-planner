# Phase 2 wayfinder chart — Assessments + LLM-guided Practice

**Task id:** `2026-07-31-phase2-wayfinder`
**Type:** wayfinder charting (planning; destination = spec + working prototypes)
**Tracker:** GitHub Issues on `NotTheRealRohit/study-planner-web` (the map + tickets are the canonical artifact; this doc is the `.work/` index/pointer).
**Map:** [#9 Phase 2 map: Assessments + LLM-guided Practice](https://github.com/NotTheRealRohit/study-planner-web/issues/9)

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
8. Server sandbox (resolved, #16) — **self-host Judge0 CE** over HTTP; Piston = fallback.

**Out of scope:** multiplayer / peer features · voice / podcast · proctoring / anti-cheat.
**Reference:** `../../../../research/external/open-notebook-findings.md` (port, don't run) · `../../../../research/external/code-sandbox-comparison.md`.

## Execution order (waves)

Order is driven by the blocking graph + the capstone rule "de-risk the fuzzy part early". #16 already done.
Legend: ☐ open · ✅ done.

**Wave 0 — Frame (cheap, constrains everything)**
1. ✅ #10 App IA & navigation — where the features live; every later ticket references it. (resolved 2026-07-31: 2 tabs, material-scoped, path-param routes, local-first records + online generation)
2. ✅ #11 Assessment types, formats & scoring — self-contained schema decision; later unblocks #19. (resolved 2026-08-01: Question-atom + mixed-container Assessment; 3 families/closed format enum; unified `[0,1]`+per-skill-binary KT contract, τ≈0.6; difficulty 1..5 authored + reserved empirical slot)
3. ✅ #15 Persistence & local-first fit — the event/data-model spine everything must obey. (resolved 2026-08-01: three-layer split — pointer event + server-owned content rows + redacted `assessmentContentCache`; per-Question runId-grouped `QuestionAttempted`→`QuestionGraded` [retry = fresh KT observation]; all grading server-side; mastery = `masteryCache` projection [`MasteryUpdated` reserved for #19]; Dexie **v5→v6** adds the two cache tables only. **Wave 0 complete.**)

**Wave 1 — De-risk the centerpiece (runs in parallel with the rest)**
4. ☐ #17 Inline-hint live guide (prototype) — highest uncertainty; grounds the practice spec; unblocks #21.

**Wave 2 — AI infra trio (internal order matters)**
5. ☐ #14 AI backend home & streaming — the home all model calls assume.
6. ☐ #12 Content ingestion & storage — the content that gets chunked (fixes title-only gap).
7. ☐ #13 Vector store, embeddings & async jobs — consumes #12; picks the worker. Trio unblocks #18.

**Wave 3 — Downstream (open as upstream closes)**
8. ☐ #18 Grounded generation pipeline — needs #12 #13 #14.
9. ☐ #19 Grading → mastery signal — technically unblocked once #11 + #15 done (may pull earlier); placed here to follow the generation shape.
10. ☐ #20 KT model & adaptive-difficulty loop — needs #19.
11. ☐ #21 Practice session model — needs the #17 prototype.

**Parallel tracks** (if running concurrent sessions): (A) #10/#11 product framing · (B) #17 prototype · (C) #14→#12→#13 infra chain. They converge at #18/#19.

**Why not pure foundation-first:** destination includes prototypes, and #17 (the inline guide) is the biggest unknown most likely to reshape the spec — prove it before building RAG around assumptions.

## Tickets

### Frontier (takeable now)

| # | Ticket | Type | Wave | Status |
|---|---|---|---|---|
| [#10](https://github.com/NotTheRealRohit/study-planner-web/issues/10) | App IA & navigation for Assessments + Practice | grilling | 0 | ✅ closed |
| [#11](https://github.com/NotTheRealRohit/study-planner-web/issues/11) | Assessment types, formats & scoring spec | grilling | 0 | ✅ closed |
| [#12](https://github.com/NotTheRealRohit/study-planner-web/issues/12) | Content ingestion & storage design | grilling | 2 | ☐ open |
| [#13](https://github.com/NotTheRealRohit/study-planner-web/issues/13) | Vector store, embeddings & async job mechanism | grilling | 2 | ☐ open |
| [#14](https://github.com/NotTheRealRohit/study-planner-web/issues/14) | AI backend home & streaming | grilling | 2 | ☐ open |
| [#15](https://github.com/NotTheRealRohit/study-planner-web/issues/15) | Persistence & local-first fit | grilling | 0 | ✅ closed |
| [#16](https://github.com/NotTheRealRohit/study-planner-web/issues/16) | Code execution sandbox selection | research | — | ✅ closed — Judge0 CE |
| [#17](https://github.com/NotTheRealRohit/study-planner-web/issues/17) | Inline-hint live guide (prototype) | prototype | 1 | ☐ open |

### Blocked (wired, wait for upstream)

| # | Ticket | Type | Wave | Blocked by |
|---|---|---|---|---|
| [#18](https://github.com/NotTheRealRohit/study-planner-web/issues/18) | Grounded assessment-generation pipeline | grilling | 3 | #12 #13 #14 |
| [#19](https://github.com/NotTheRealRohit/study-planner-web/issues/19) | Grading → mastery signal mapping | grilling | 3 | #11 #15 |
| [#20](https://github.com/NotTheRealRohit/study-planner-web/issues/20) | KT model & adaptive-difficulty loop | grilling | 3 | #19 |
| [#21](https://github.com/NotTheRealRohit/study-planner-web/issues/21) | Practice session model (written + coding) | grilling | 3 | #17 |

### Fog (not yet specified) / see map

Spaced-repetition scheduling · roadmap-feedback UX · capstone evaluation & metrics · prompt architecture + injection safety · material library/detail surface (surfaced by #10) · assessment feedback/review surface (surfaced by #11) · content cache lifecycle/eviction (surfaced by #15).

## How to continue

Run `/wayfinder 9` (optionally naming a ticket). One decision ticket per session; research tickets may resolve AFK. Frontier query: `gh issue list --label wayfinder:phase2 --state open`. Claim a ticket by assigning it to yourself first.
