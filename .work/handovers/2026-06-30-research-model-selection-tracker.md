# Tracker — Research model selection (parallel workstream)

**Purpose:** a control/tracking baton so a parallel session can **drive and track the model-selection
decisions** that come out of the research re-run — distinct from the *implementation* plan (that lives in
`PLAN.md`/`VERIFICATION.md`). This doc owns the **"which model wins"** calls and the feedback loop back
into the design decisions.

**Update this doc** as runs complete: flip the gate statuses, log results, and when a gate resolves, push
the decision into `DECISIONS.md` (and the claims ledger).

---

## Companion docs (read these first)

- **Planning handoff (for Opus, the implementation plan):** `.work/handovers/2026-06-30-research-eta-model-selection.md`
  — contains the full harness map (generator, evaluators, candidate registries, run entrypoints) and the
  R1–R6 charter. Don't duplicate it here; this tracker references it.
- **Design SoT:** `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` (esp. **§5c** =
  the research workstream; **#3** = the ETA design this research proves).
- **Plan + log (once Opus writes them):** `.work/plans/active/2026-06-30-research-eta-model-selection/PLAN.md`
  + `VERIFICATION.md` — implementation phase tracking lives there; **decision tracking lives here.**
- **Claims ledger (where proven results get written for the dissertation):**
  `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`.
- **Harness:** `research/comparison/` (Makefile targets `make dataset | compare | compare-detection |
  compare-projection | sweep`; results → `research/results/{calibration,detection,projection,sweep}/*.json`,
  stamped by `generator_version`/`params_version_hash`).

## Current status (update me)

| Step | What | Status | Owner / where |
|---|---|---|---|
| Plan | Opus authors the R1–R6 implementation plan | ✅ | `plans/active/2026-06-30-research-eta-model-selection/PLAN.md` |
| R1 | Extend generator (planned-vs-chunk split; interrupted partials; ad-hoc cadence; bump `generator_version`) | ✅ | Codex — `synthetic-decoupled-9e6d48db2da8-seed0-n5400`, `generator_version 0.2.0` |
| R2 | Calibration regression (does `enriched_shrink`/`enriched_dual_prior` still win?) | ✅ | Codex → **gate G1 RESOLVED** (transfers) |
| R3 | Detection regression (does CUSUM null hold under new cadence?) | ✅ | Codex → **gate G2 RESOLVED** (keep CUSUM) |
| R4 | **ETA benchmark** (gp_ard vs analytic vs gp+analytic composite) | ✅ | Codex → **gate G3 RESOLVED** (#3 qualified) |
| R5 | Rigour parity (200 seeds / 9 archetypes / 3 bands / Holm / held-out) | ✅ | Codex — ledger + comparability doc + DECISIONS #3 flipped |
| R6 | Phase-5 N=1 real-data circularity guard | ⏸ DEFERRED | Rohit (real logs) → **gate G4 OPEN** (no real data yet) |

Status keys: ☐ not started · 🟡 running/partial · ✅ resolved · ⏸ deferred · 🛑 blocked.

> **Reconciled 2026-06-30 (Cowork/planner)** against `plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`
> (P0–R5 all reviewer-✅; R6 deferred). Canonical detail lives in that VERIFICATION.md, DECISIONS.md #3,
> and the claims ledger — this tracker indexes them. Edits left in the working tree for the native side to commit.

## The model-selection gates (the decisions this workstream exists to make)

Each gate has an explicit **win criterion** and an explicit **feedback action**. A result only becomes a
dissertation claim once it passes the criterion under R5 rigour.

**G1 — Calibrator.** ✅ **RESOLVED (R2, 2026-06-30) — the win TRANSFERS and holds with partials included.**
*Question:* under the new event mix (incl. partial-chunk throughput points, D8a), does
`enriched_shrink` (+ `enriched_dual_prior`) still beat baselines on `m_global` / `context_pred_mae`?
- **Win criterion:** Holm-significant **and** improved delta **and** holds on held-out archetypes + reality.
- **Result:** on decoupled `n5400` held-out, both `enriched_shrink` and `enriched_dual_prior` are Holm wins
  vs `hierarchical_bayes` in **12/12** `context_pred_mae` cells and **8/12** `recovery_mae` cells (up from
  11/12 and 6/12·2/12 on the frozen P0b anchor). One Holm-significant recovery loss at `max|night_owl`.
- **Feedback applied:** calibration **transfers** → keep `enriched_shrink`/`enriched_dual_prior`; inclusion
  policy = **include** partial-throughput points (no down-weight needed). Frame as "holds, not improves"
  (decoupled is a different DGP). Recorded in the claims ledger + `DECISIONS.md`.

**G2 — Detector.** ✅ **RESOLVED (R3, 2026-06-30) — keep CUSUM; the new cadence is MORE CUSUM-favoring.**
*Question:* does the CUSUM **robust-null** still hold when interrupted partials + ad-hoc arrivals add noise
(latency / false-alarm-rate frontier)?
- **Win criterion:** no candidate dominates CUSUM on the latency↔FAR frontier under rigour.
- **Result:** on decoupled `n5400` held-out, winner-by-shift is drift→`cusum`, **step→`cusum`** — the A4/P0b
  step→`page_hinkley` edge **disappears**. Only **3 cells** retain non-CUSUM Holm wins, all `fading_flame`
  drift (max/medium). No deployable detector displaces CUSUM overall.
- **Feedback applied:** **keep CUSUM.** State the verdict against the **A4/P0b shape** (not a pure-null
  strawman). Recorded in the claims ledger / comparability doc.

**G3 — ETA / projection (headline; unblocks #3).** ✅ **RESOLVED (R4, 2026-06-30) — #3 is QUALIFIED, not a
general win.** *Question:* which projection minimizes finish-date error while hitting coverage — `gp_ard`
(incumbent), `analytic_required_rate`, or the `gp+analytic` composite?
- **Win criterion:** best on `mean_abs_error_days` with `coverage ≈ 0.95` and acceptable sharpness,
  **paired-Holm significant vs `gp_ard`**, holding on held-out. Also decide: linear vs capacity-shaped
  reference line; cold-start fallback behaviour.
- **Result:** `gp_plus_analytic` beats `gp_ard` under held-out+Holm **on the SMALL band only** (all 4 small
  held-out cells — the cold-start regime), is **significantly worse on max** (4 Holm losses), and not
  significant on medium. `analytic_required_rate` has **0 Holm wins** anywhere. Oracles = upper bound only.
  R4b reference-line (linear vs capacity-shaped) **deferred** in the payload.
- **Feedback applied:** **#3 kept 🟡 QUALIFIED in `DECISIONS.md`** (NOT flipped to ✅) — the composite is a
  **cold-start / small-plan fallback layered on GP**, not a GP replacement; `gp_ard`/`conformal` remain the
  data-rich story (conformal = the coverage fix). Recorded in the claims ledger. Product can ship the
  composite; the dissertation must state the benefit as regime-specific. UI ETA visuals are unblocked on
  this basis (cold-start fallback semantics).

**G4 — Real-data sanity (circularity guard).** ⏸ **DEFERRED (R6, 2026-06-30) — OPEN, blocked on real N=1
data.** *Question:* do partial-chunk throughput + the chosen ETA behave sanely on Rohit's own N=1 logged
sessions (synthetic scoring is model-dependent)?
- **Win criterion:** face-validity overlay holds; no gross divergence from synthetic.
- **Status:** no real logged sessions exist yet, so the data-dependent core is **not run and not fabricated**.
  The partials "external-validity caveat" in the R5 claims ledger **carries this** until G4 runs — external
  validity of the new event types (esp. interrupted/partial throughput) rests on the synthetic generator alone.
- **Unblocks when:** real session logs are captured (Rohit's own usage via
  `research/comparison/scripts/capture_evidence.py`, or pilot users). Then run R6 as specified; add the
  external-validity note; if it diverges, caveat or revisit G3.

## How to read a run

- Results JSON per stage carries `rows` (per-learner), `paired_vs_incumbent` (delta, p_value, CI),
  `mc_correction` (Holm), `winners`, and a `_provenance` manifest. Trust **held-out + Holm-surviving**
  numbers; treat train-only or non-Holm wins as suggestive, not claimable (this is the A-series standard).
- Confirm the run's `generator_version`/`params_version_hash` matches the **extended** generator (R1), not a
  frozen A-series dataset — otherwise you're scoring the old world.

## Feedback loop (close it explicitly)

When a gate resolves: (1) log the result + dataset hash in this tracker; (2) update the matching
`DECISIONS.md` entry (esp. **flip #3 on G3**); (3) write the claim/caveat into the claims ledger; (4) flip the
`STATUS.md` research row. Leave doc edits in the working tree for the native side to commit.

## Running log (append dated entries)

- **2026-06-30** — Tracker created. Opus authoring the R1–R6 plan in parallel. No runs yet; all gates open.
  #3 remains 🟡 pending **G3 (R4)**.
- **2026-06-30 (later)** — **Synthetic arc COMPLETE.** Codex ran P0–R5; all reviewer-✅ in
  `plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`. Datasets: frozen anchor
  `synthetic-21c2cdabfa91-seed0-n5400` + new decoupled `synthetic-decoupled-9e6d48db2da8-seed0-n5400`
  (`generator_version 0.2.0`). Gate outcomes:
  - **G1 ✅** calibration transfers (`enriched_shrink`/`enriched_dual_prior`: context-pred 12/12, recovery
    8/12 Holm) — include partials.
  - **G2 ✅** keep CUSUM; new cadence more CUSUM-favoring (step→cusum; only 3 `fading_flame` drift cells
    keep non-CUSUM wins).
  - **G3 ✅** #3 **QUALIFIED**: `gp_plus_analytic` wins small-band/cold-start only, worse on max, `analytic`
    never wins. `DECISIONS.md` #3 = 🟡 QUALIFIED (cold-start fallback layered on GP, not a GP replacement).
  - **G4 ⏸ DEFERRED** — no real N=1 data; external-validity caveat carries it.
  Claims ledger (`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`) + comparability doc
  (`research/doc/2026-06-30-frozen-vs-decoupled-comparability.md`) written. **Next:** capture real N=1 logs
  → run R6/G4; UI ETA planning can proceed on the cold-start-fallback semantics; R4b reference-line still
  deferred.
