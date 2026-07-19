# Handoff → Codex: Pillar-A rigour & extensions

**Date:** 2026-06-17 · **From:** Cowork planning/review agent · **For:** Codex (gpt-5.5)
**Baseline:** HEAD `26c31b2`, branch `project/phase-1`, clean working tree.

## What you're implementing

Harden Pillar A of the `/research` tier so the synthetic-data result becomes thesis-grade. Two
known defects to fix and several rigour gaps to close. The full runbook is the plan — read it; this
is just the entry point and the rules of engagement.

- **Plan (source of truth):** [`../plans/active/2026-06-14-pillar-a-rigour.md`](../plans/active/2026-06-14-pillar-a-rigour.md)
- **Verification (your scorecard):** [`../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md`](../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md)
- **Direction note (the "why"):** [`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md)
- **The spine you reuse:** [`../plans/active/2026-06-13-research-tier-2-pillar-a-fanout.md`](../plans/active/2026-06-13-research-tier-2-pillar-a-fanout.md)

## Step 0 — before any code: commit these planning docs

Cowork cannot commit in this sandbox, so the planning docs are sitting uncommitted in your working
tree. Establish the baseline first so later diffs are meaningful:

```bash
git add ../plans/active/2026-06-14-pillar-a-rigour.md ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md 2026-06-17-pillar-a-rigour-codex-handoff.md
git commit -m "docs(plan): add pillar-a-rigour verification + handoff"
```

## How to work this plan

1. **Start at Phase A0** and go in order — A0 → A1 → A2 → A3 → A4 → A5. Do not skip; later phases
   assume earlier ones (A3 scores the A1/A2 candidates; A4 is scored under A3's protocol; A5 re-runs
   the whole contest). A1 and A2 both only need A0, so they can be done in either order.
2. For each phase: run its **"Verification (run BEFORE starting)"** block — **if any fails, STOP and
   surface.** Follow the steps. Run the **"Verification (DONE)"** block + tests; all must pass.
3. **After each phase:** set the phase `Status:` in the plan to `✅ Complete — <sha>`, then fill your
   section of `VERIFICATION.md` (files changed, commit SHA, what you did, deviations + why,
   self-check vs the phase's acceptance criteria). Commit the code + plan + verification together.
4. **Expect review.** A phase is **not done** until the reviewer marks it `✅ Verified` in
   `VERIFICATION.md`. Change requests may follow; resolve them in the phase's Resolution block.

## Environment & commands

```bash
export PATH="$HOME/.local/bin:$PATH"        # uv lives here; Bash resets env per call
uv run --package research-comparison pytest research/comparison/tests -q
uv run --package research-comparison python -m research_comparison.runners.<track>   # calibration|detection|projection|scheduling|sweep
```

Two environments stay separate (decision #15): the clean `uv` member `research/comparison` (all this
work) and the isolated `research/kt-bench`. **Do not touch kt-bench here.**

## Guardrails (read before you start)

- **Do not cross the KT streams (§0 of the plan).** The KT benchmark is irrelevant to Pillar A —
  different target/data/metric. Spend zero KT effort here. KT is a separate plan
  ([`../plans/active/2026-06-14-kt-realdata-integration.md`](../plans/active/2026-06-14-kt-realdata-integration.md)).
- **Additive only.** New candidates never replace a shipped one; keep `gp_ard` and the calibration
  incumbent in the contest so the before/after stays visible.
- **Circularity guard (D-A4).** Any tunable hyperparameter is tuned **only** on the held-out *train*
  archetypes (A3's `heldout_archetype_split`), never on the cells used to declare winners.
- **Never move the frozen regime toward a winner.** Params hash `e716cd12dddc`, seed 0 stay frozen;
  range changes are recorded in pre-reg §10, never candidate-favouring values. New regimes (A5) get a
  **new `dataset_id`**, alongside the frozen one.
- **`gp.py` default path is sacred.** The GP-t/AR(1) variant (A1) goes behind a flag; the shipped
  `gp_regression` default must be unchanged.
- **Upper bounds are not winners.** `ruptures` (detection) and CP-SAT/OR-Tools (scheduling) are
  labelled `upper_bound` and excluded from deployable-winner selection. OR-Tools is an *optional*
  dependency — CP-SAT must skip gracefully when it's absent (OQ-A3).

## What's already true (verified 2026-06-17, so you don't re-discover it)

- The plan's evidence checks out against the code: GP is homoscedastic with no AR(1)
  (`gp.py:129-138,197`; `GP_NOISE_RATIO=0.20`, `GP_EXTRAPOLATION_CI_INFLATION=1.5`); the calibration
  incumbent collapses to `globalPosterior.mean` (`baselines/calibration.py:46`); `infer_day_of_week`
  does not exist yet; generator truth is `m_global·ρ·τ·ν` with `AR1_PHI=0.30`.
- The Part-2 spine exists: `runners/{calibration,detection,projection,scheduling,sweep}.py`,
  `metrics/{paired,aggregate,coverage,...}.py`, `plots/{projection_reliability,robustness_heatmap,...}.py`,
  and all four track result JSONs + `sweep_results.json` under `research/results/`.
- `projection_reliability.pdf` and `robustness_heatmap.pdf` **already exist** (from Phase 3) — A1/A4
  must **regenerate** them (the reviewer checks they changed, not just that they exist).
- Today's headline numbers to beat: projection `gp_ard` coverage **0.20/0.32/0.44** (max/medium/small)
  vs nominal 0.95; calibration `hierarchical_bayes` **ties** `pooled_bayes` (Δ≈1e-17, p≈0.42–0.67).

## Heads-up on effort / risk

- **A1 is the headline fix** (red→green coverage) and the cheapest win — do it well first.
- **A5 is the heaviest and most open** (real engagement data + generator rewrite; open question OQ-A4
  on which dataset). Reasonable to treat A5 as its own session. If a real fork appears (dataset
  choice, proxy mapping), surface it rather than guessing.
- If reality contradicts a plan step, **STOP and surface** — set the phase `🛑 Blocked: <reason>`,
  fill the Notes block, hand back. Don't re-plan or improvise.

## Reviewer note (location choice)

`VERIFICATION.md` is a **sibling file** (`…-pillar-a-rigour-VERIFICATION.md`), not a
`plans/<slug>/` directory, because the plan already ships as a single file referenced by three other
docs. Keep them paired.
