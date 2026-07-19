---
title: Research Tier — Decisions, Rationale & Verified Findings
purpose: Capture the WHY behind each research-tier decision (with the rejected alternative) and the code-verified technical facts, so a future agent does not re-litigate settled questions or re-discover the repo state.
audience: future agents (esp. the one writing the implementation plan)
status: reference
last_updated: 2026-06-13
related:
  - ./research-build-plan.md
  - ./archetype-preregistration.md
  - ./research-tasklist.md
---

## Decision log (decision → rationale → rejected alternative)

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| 1 | Build the full pipeline now; R2/R3 is a *presentation* gate | "Finish early, reveal what's needed." De-risks later reviews | Build only R2 scope first |
| 2 | `/research` **imports** `py-progress` as a peer candidate | Single source of truth (evaluated = shipped); a fix re-grades both | Reimplement engines in `/research` (drift risk) |
| 3 | Genuine comparison; incumbents are peers, winner deploys | Candidate's explicit instruction — not rigged to make incumbents win | Treat py-progress as the "treatment" to defend |
| 4 | Single-learner online/streaming; compare across N archetypes | Matches the product + the thesis; no population to train on | Cross-learner train/test split |
| 5 | K≈40 Monte-Carlo seeds + paired tests | Error bars; one seed lets noise pick the winner (non-genuine) | Single seeded sequence per archetype |
| 6 | Neutral generator: ground truth from a different family than any candidate | Stops a model recovering its own assumptions (circularity defence) | Convenient Gaussian/linear truth |
| 7 | 3 length bands (Small/Medium/Max); power from replication not history | Realism *is* the constraint — real learners have few sessions | Long sequences for cleaner stats |
| 8 | Factor: length=columns, archetype=rows, material-mix *inside* learners | Keeps the result grid 3×6 and readable; cold-start is the length axis | Full factorial (3×6×4×40 = 2,880 cells) |
| 9 | Metrics test the thesis (CI coverage, latency@FA, adherence+churn, cold-start AUC, ECE) | Point accuracy is table stakes; thesis = calibrated uncertainty + verification | MAE/AUC as headline |
| 10 | Deploy the **cold-start (small/medium) winner**; Max = caveat | Learners live in cold-start nearly the whole journey | Pick the all-bands-aggregate winner |
| 11 | Both shift types (step + drift), labelled; detection scored per type | Steps-only would let CUSUM win by construction | Abrupt steps only |
| 12 | Neutral capacity planner for `plannedMinutes` (not a scheduler) | Calibration/projection mustn't inherit a scheduler's bias | Use the production scheduler |
| 13 | Skip/partial/manual adherence model | Real learners miss days; makes adherence metrics meaningful; deepens cold-start | Clean execution (every slot → 1 session) |
| 14 | Literature-grounded + pre-registered + sensitivity-swept params + oracle baseline | Converts "you cherry-picked" into a methods strength | Single hand-set values |
| 15 | Two environments, artifact boundary (clean uv + isolated `kt-bench`) | pyKT is torch/wandb/conda CLI — would contaminate the clean workspace | One unified environment |
| 16 | KT: full-seq AUC + cold-start curve on **shared splits**; pyBKT uses pyKT's folds | Cold-start tests the project; shared folds make BKT-vs-deep fair | Standard full-seq AUC only |
| 17 | N=1 = face-validity + feasibility case study + sweep-bound info; no perf claims | Single subject can't prove performance; stays bulletproof | Real-data algorithm comparison |
| 18 | Outputs fully auto-generated (`results/*.json` → `\input` `.tex` + vector PDF) | No transcription drift between report/journal/re-runs | Hand-place numbers |
| 19 | Closed loop built now, revealed Phase II | The verified closed loop is the headline novelty | Report closed-vs-open in Phase I |

## Verified technical findings (from code, 2026-06-13)

- **Pace semantics:** engines model `pace_ratio = activeMinutes / plannedMinutes` **literally**
  (`packages/py-progress/src/py_progress/bayesian.py` L89; `cusum.py` L84). The OpenAPI prose
  ("0.8 = 25% longer") is loose wording — **do not invert**. Convention frozen in the
  pre-registration: `r>1` = over-runs slot, `r<1` = under budget.
- **`py-progress` is pure importable functions** (no HTTP needed). `__init__.py` exports:
  `compute_calibration`, `compute_progress`, `get_prompt_detail`, `compute_hierarchical_model`,
  `update_posterior`, `run_cusum`, `detect_regime_shifts`, `analyze_trend`, `gp_regression`,
  `fit_burn_up_gp`, `cholesky_decompose/solve`, `run_kalman_on_phase`, `calculate_streak`,
  `build_streak_grid`, + config constants. The FastAPI service (`services/intelligence`) is a
  thin wrapper.
- **Calibration internals:** Normal-Normal conjugate (`update_posterior`), prior mean 1.0 /
  var 0.1, observation variance = empirical sample variance; hierarchy global→role→context;
  role/context buckets need ≥`MIN_SESSIONS_PER_BUCKET` (3) sessions. Batch over full history
  (call repeatedly as history grows for the prequential protocol).
- **CUSUM:** two-sided, `k = CUSUM_SLACK_FACTOR·std`, `h = CUSUM_THRESHOLD_FACTOR·std`,
  reference = Bayesian posterior mean; resets on breakpoint.
- **GP:** hand-rolled (numpy + manual Cholesky) in `gp.py` — **this is the GP candidate**; do
  not add GPy.
- **Scheduler:** `packages/py-roadmap-engine` (Python port of the TS roadmap engine) is the
  greedy/constraint scheduling candidate.
- **Session schema (`SessionEvent`):** `date, source(active|manual), plannedMinutes,
  activeMinutes, duration, materialRole(anchor|foundation|practice), startedAt, sessionId`.
  Full field semantics in `packages/py-progress/openapi.yaml`.
- **Tooling:** `uv` workspace (root `pyproject.toml`), Python ≥3.12; `py-progress` depends only
  on `numpy`; `intelligence` on FastAPI. **No conda, no torch anywhere.** `uv.lock` present.
  Ruff configured (E,F,I,UP; line-length 100).
- **Report:** LaTeX via **TinyTeX** at `college/mydeliverables/1st-Review/report/main.tex`,
  manual `thebibliography`, vector-PDF figures (see `.agents/rules/60-latex-report-build.agents.md`
  and `.agents/rules/61-tikz-flow-diagrams.agents.md`).
- **`/research` does not exist yet.** Existing Python: `packages/py-progress`,
  `packages/py-roadmap-engine`, `services/intelligence`.

## Do-not-re-litigate list

Decisions #1–19 above are settled. If new information forces a change, record it as an
amendment in `archetype-preregistration.md` §10 (for params) or as a dated note in
`research-build-plan.md`, with the reason — do not silently reverse.
