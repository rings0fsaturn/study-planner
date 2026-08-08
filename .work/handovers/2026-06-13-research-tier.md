---
title: Research Tier (/research) — Session Handover
purpose: Give the next-session agent everything needed to write the implementation plan for building the offline Python research tier (synthetic generator + genuine algorithm comparison + KT benchmark + report wiring).
audience: agents
mode: transition
status: ready-to-plan
last_updated: 2026-06-13
related:
  - ../college/scope/research-build-plan.md
  - ../college/scope/archetype-preregistration.md
  - ../college/scope/research-tasklist.md
  - ../college/scope/research-decisions-and-findings.md
  - ../college/scope/asOfReview1/phase1-research-plan.md
  - ../college/scope/asOfReview1/pykt-and-knowledge-tracing.md
  - ../packages/py-progress/
  - ../packages/py-roadmap-engine/
  - ../packages/py-progress/openapi.yaml
---

## TL;DR

A full grill session (2026-06-13) designed the **`/research` tier** for the M.Tech project
"Adaptive Study Planning for Self-Directed Learners." Every architectural decision is made and
written down across four scope docs. **`/research` does not exist yet.** The next session's job
is to **write the implementation plan** that turns the master tracker
(`research-tasklist.md`, 8 phases / ~60 atomic tasks) into an executable, TDD-disciplined plan —
**not to write code yet.** The plan should land at `../plans/active/2026-06-13-research-tier.md`
(repo convention: `plans/YYYY-MM-DD-slug.md`).

The research tier is the offline Python layer evaluators grade: it generates synthetic learners
with known ground truth, runs a **genuine** (not rigged) multi-candidate comparison for each
Pillar-A component, benchmarks knowledge-tracing models on real public data (Eedi/POJ), and
auto-emits the report/journal tables and figures.

## Your task next session

Write `../plans/active/2026-06-13-research-tier.md` — an implementation plan to build the research tier.
It must:

1. **Follow the phase structure** in `college/scope/research-tasklist.md` (Phases 0→7,
   tracer-bullet ordering: scaffold → generator → one track end-to-end → fan out → KT →
   validation → outputs → closed-loop).
2. For each phase, specify: concrete file paths, the public functions/classes to create, the
   **TDD test list** (what proves each task done), acceptance criteria = the phase DoD, and
   dependencies. Mirror the depth of the prior Pillar-A plan
   (`../plans/active/2026-06-08-pillar-a-fastapi-backend.md`) and its phase-complete handovers.
3. **Respect every settled decision** in `research-decisions-and-findings.md` (#1–19) — do not
   re-open them. Use the frozen parameters in `archetype-preregistration.md` verbatim.
4. Call out the **tracer-bullet milestone** (Phases 0–2 = one track, calibration, end-to-end)
   as the first shippable increment.

Do **not** start implementing in that session unless the user asks — produce the plan, get it
reviewed.

## Required reading (in order)

1. `college/scope/research-build-plan.md` — the full design + rationale (read first; it is the spec).
2. `college/scope/research-decisions-and-findings.md` — decisions + rejected alternatives + **code-verified facts** (pace semantics, py-progress API, repo state). Read before assuming anything about the code.
3. `college/scope/archetype-preregistration.md` — the frozen generator numbers (Phases 1 & 3 consume these).
4. `college/scope/research-tasklist.md` — the 8-phase master tracker the plan is built from.
5. `college/scope/asOfReview1/` — upstream project context (thesis, pillars, datasets, pyKT).
6. `../plans/active/2026-06-08-pillar-a-fastapi-backend.md` + `handovers/2026-06-08-pillar-a-*.md` — **format template** for how plans/phases are written in this repo (the TS→Python port followed the same phase/DoD/handover discipline).

## Repo state snapshot

**Exists (Python):** `packages/py-progress` (Bayesian calibration, CUSUM, hand-rolled GP,
Kalman, streak — numpy-only, pure importable functions), `packages/py-roadmap-engine` (scheduler),
`services/intelligence` (FastAPI thin wrapper). `uv` workspace, Python ≥3.12, `uv.lock` present.
**No conda, no torch.** Ruff configured.

**Does NOT exist:** `/research` (the whole tier — generator, baselines, metrics harness, KT
bench, results, report wiring). This is greenfield.

**Report:** `college/mydeliverables/1st-Review/report/main.tex` (LaTeX/TinyTeX, manual bib,
vector-PDF figures). Phase 6 wires generated artifacts into it.

## Key technical facts the plan must respect

(Full detail in `research-decisions-and-findings.md` §"Verified technical findings".)

- Engines model `pace_ratio = activeMinutes / plannedMinutes` **literally** — do not invert the
  OpenAPI "longer" prose. Convention: `r>1` over-runs, `r<1` under budget.
- `/research` **imports** `py-progress` / `py-roadmap-engine` (single source of truth);
  baselines (SMA, EWMA, CSD, linear, DP, rule-based) are research-only. The GP candidate is
  py-progress's own GP — do **not** add GPy.
- Generator emits `SessionEvent`-shaped records (schema in `packages/py-progress/openapi.yaml`).
- **Two environments:** clean `uv` workspace member `research/comparison/` (imports py-progress)
  + isolated `research/kt-bench/` (pinned torch + pyKT, NOT a workspace member, NOT in `uv.lock`).
  Seam = `results/kt/*.json` (read, never import pyKT).
- Reproducibility: seed + manifest + version-hash stamped into every artifact.

## Settled vs open

**Settled:** all architecture, methodology, metrics, candidate rosters, generator spec, frozen
parameters, repo layout, KT protocol, validation scope, output wiring (decisions #1–19).

**Open (note in the plan, don't block on):**
- Exact build-effort/time estimates per phase (the plan should add these).
- Target journal venue specifics (LAK / EDM / IEEE TLT class — venue-agnostic for now).
- **Real-session logging is an ongoing collection task** (Phase 5) — flag that it should start
  immediately so the N=1 case study is real by R3.

## Conventions & gotchas

- **TDD throughout** — generator tests must prove the oracle recovers planted ground truth;
  determinism-by-seed is a test. Match py-progress's existing test style (`packages/py-progress/tests`).
- **uv workspace:** register `research/comparison` as a member in root `pyproject.toml`; add deps
  there. Keep `kt-bench` out of the workspace and out of `uv.lock`.
- **Ruff** (E,F,I,UP; line-length 100) applies to the new package.
- **Single source of truth:** never copy an engine into `/research`; import it.
- **Report wiring (Phase 6):** LaTeX via TinyTeX — see `.cursor/rules/latex-report-build.md`
  (toolchain on PATH) and `flow-diagram-tikz-gen.md` (vector-PDF discipline). Figures are
  matplotlib → vector PDF; tables are booktabs `.tex` `\input`-ed into `main.tex`.
- **kt-bench torch env** may need the Colima/registry pattern — see
  `.cursor/rules/docker-colima-setup.md` and `pnpm-build-registry.md` for the corporate-mirror
  approach if pulls fail.
- Root `AGENTS.md` carry the broader repo norms.

## Suggested shape of the implementation plan

Phase-by-phase (mirroring the tracker), each phase a section with: **Goal · file paths ·
functions/classes · TDD test list · acceptance criteria (=DoD) · dependencies · est. effort**.
Lead with the **tracer bullet** (Phases 0–2) as Milestone 1, then fan-out (Phase 3) as
Milestone 2, KT (Phase 4) as a parallel track, then validation + outputs. Keep the closed-loop
(Phase 7) explicitly "built, not revealed in Phase I."

## First concrete step next session

Read the four scope docs (above), then draft `../plans/active/2026-06-13-research-tier.md` starting with
Phase 0 (scaffolding: `research/` tree, `uv` workspace member, deps, `import py_progress`
working, Makefile + provenance stamp) — the smallest increment that makes the pipeline runnable.
