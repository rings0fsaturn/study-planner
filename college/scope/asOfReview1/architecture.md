---
title: System Architecture (scope summary)
purpose: Summarise the three-tier architecture and the key source-of-truth decision
audience: candidate, future agents
status: approved
last_updated: 2026-06-05
related:
  - ../../../design/architecture.md
---

## Three tiers

| Tier | What | Notes |
|---|---|---|
| Offline research (`/research`) | Python: pyKT, pyBKT, scipy, scikit-learn, GPy. Synthetic generator + model comparison. | Produces trained models/params; runs offline only. |
| Intelligence Service | Python · FastAPI · Docker (Colima locally). Hosts all heavy ML for both pillars. | Single source of truth for the algorithms (evaluated code = shipped code). |
| Client | Local-first TS app (React/Vite, Dexie/IndexedDB). | Keeps raw data + trivial display derivations; works offline. |

**Supabase** acts as the data hub (auth, events DB, storage) between client and service.
**OpenAI (LLM)** is called by Pillar B (item generation, grading).

Phase split on the diagram: Pillar A (adaptation) is solid / Phase I; Pillar B
(verification) and the closed feedback loop are dashed / Phase II.

## Key decision: Python as the single source of truth

The algorithms must be in Python anyway for the research comparison (scipy/GPy/pyKT). To
avoid a second TypeScript implementation drifting from the evaluated one, **Python is the
single source of truth**, served via the FastAPI Intelligence Service. The product calls
it; results are cached locally so the dashboard still works offline. Trivial display
derivations (streak, minutes, up-next) and raw event storage stay client-side TS.

Trade-off accepted: the intelligence layer is server-computed (not pure local-first), but
the core log-a-session loop stays offline. The TS→Python migration of `packages/progress`
is a Phase-II task (deferred), not a Review-1 task.

## What the FastAPI service owns

The whole assessment subsystem (LLM item generation + answer evaluation + KT mastery) is
consolidated in FastAPI, plus the Pillar A statistical engines. Existing Supabase Edge
Functions keep what they already do (materials metadata). Production hosting of the FastAPI
backend is deferred (Colima is local-only; a container host is a Phase-II concern).

## Canonical diagram

The full Mermaid diagram (with Phase II greyed) lives at
[`../../../design/architecture.md`](../../../design/architecture.md) and a slide/report
variant at `../../mydeliverables/1st-Review/architecture-diagram.md`. The report figure
(`main.tex`, Proposed Methodology) is a commented placeholder pending TikZ conversion or a
PNG export of the Mermaid.

## See also

- [pykt-and-knowledge-tracing.md](./pykt-and-knowledge-tracing.md) — KT inference in the service.
- [phase1-research-plan.md](./phase1-research-plan.md) — the `/research` tier.
