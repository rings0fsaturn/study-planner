---
title: "Research handover → UI implementation planning (model verdicts + ETA semantics)"
date: 2026-07-01
author: Cowork/planner
audience: the session writing the material/session-decoupling implementation plan(s)
status: synthetic re-validation COMPLETE (R1–R5 reviewer-✅); R6/G4 (real N=1) DEFERRED
supersedes: nothing — complements the UI planning handoff (handovers/2026-06-30-ui-planning-handoff.md)
---

# Research verdicts for UI implementation planning

**Why this doc exists.** The research re-validation arc that gated the material/session-decoupling
redesign is finished and reviewer-verified. This baton translates the three algorithm verdicts into the
form an implementation-plan author needs: *which model to use, with what semantics, what to display, and
what to caveat.* It is an index over the canonical sources — **on any conflict, the canonical file wins**
(links in §6). Ground the impl plan in those, cite them by name.

**One-line state:** the decoupled model does **not** break the dissertation's algorithms — calibration and
detection transfer cleanly; the ETA composite (design decision **#3**) is **QUALIFIED to the cold-start /
small-plan regime only**, so build it as a fallback layered on GP, not a GP replacement.

---

## 1. The three verdicts (what the impl plan must assume)

### G1 — Calibration ✅ TRANSFERS (keep `enriched_shrink`)
- Moving `planned` from slot-chunk to **material throughput**, and adding interrupted-partial throughput
  points, does **not** break the calibrator. `enriched_shrink` / `enriched_dual_prior` still beat
  `hierarchical_bayes` under held-out + Holm (context-pred **12/12** cells; recovery **8/12**).
- **Inclusion policy = INCLUDE partial-chunk throughput points** (no down-weighting). This is a resolved
  decision (OQ-1), not an open choice.
- **Implementation impact:** minimal/none new — production calibration is already wired via the
  Intelligence Service (this is the ✅ *enriched_shrink production integration* workstream). The impl plan
  should keep feeding throughput points (including partials) into the existing calibration path.
- **Caveat to preserve in UI copy / dissertation, not to "fix":** frame as *"holds"*, not *"improves"*
  (decoupled is a different DGP). One persistent weak cell: `max | night_owl` recovery.

### G2 — Detection ✅ KEEP CUSUM
- Under the noisier decoupled cadence the result is *more* CUSUM-favoring: winner is drift→`cusum`,
  **step→`cusum`** (the prior `page_hinkley` step-edge disappears). Only 3 `fading_flame` drift cells
  retain non-CUSUM Holm wins.
- **Implementation impact:** no detector swap. If the UI surfaces "your pace shifted" / replan-suggestion
  signals, they ride on **CUSUM** as before. State any dissertation verdict against the **A4/P0b shape**,
  not a pure-null strawman.

### G3 — ETA / projection ✅ #3 is QUALIFIED (the load-bearing one for UI)
- `gp_plus_analytic` (the proposed composite) beats the `gp_ard` incumbent under held-out + Holm **on the
  SMALL band only** — i.e. the low-data / cold-start regime the analytic fallback is designed for. It is
  **significantly worse on max**, not significant on medium. Pure `analytic_required_rate` **never wins**.
- **Therefore #3 is a cold-start / small-plan FALLBACK layered on GP — NOT a general GP replacement.**
  `DECISIONS.md #3` is locked at **🟡 QUALIFIED** with exactly this wording; do not implement it as "the
  new ETA engine."
- **Product is cleared to ship the composite** as: GP everywhere, analytic fallback at cold start. The
  dissertation states the benefit as **regime-specific**.

---

## 2. ETA composite — the exact semantics to build to

The research reference implementation lives in the harness (see §6 for paths); the app-side ETA wiring is
**net-new** (see §3). The impl plan should mirror this behaviour, not invent its own:

- **Base estimator:** GP extrapolation of the material-done curve (`gp_ard`) remains the finish-date base.
- **Composite `gp_plus_analytic` switch logic (reference impl):**
  1. **Cold start** — when `sessions < COLD_START_N` (**COLD_START_N = 5** in the reference impl) → use the
     **analytic required-rate** estimate.
  2. **GP non-crossing rescue** — when the GP-predicted finish reaches/exceeds the horizon end
     (`gp_finish >= horizon_end_date`, i.e. GP fails to cross the target) → fall back to analytic.
  3. **Otherwise** → GP point estimate + confidence interval.
- **Analytic required-rate** is computed in **actual-minutes currency** (`consumed_actual / elapsed_days`
  for effective daily rate; `remaining_actual / effective_daily` for days-left). **No throughput-factor
  multiplication** — do not re-apply pace (that would double-count).
- **Coverage:** GP/`conformal` remain the data-rich story; **`conformal` is the coverage fix** if the UI
  needs calibrated intervals on richer plans. Don't present raw GP intervals as calibrated on small data.
- **Labelling:** finish-date / ETA labels shown to the user should be **provisional** (per DECISIONS.md,
  finish-date estimate labels flagged provisional). At cold start especially, the estimate is a fallback.

---

## 3. Product-side reality the impl plan must not miss

- **Finish-date / ETA is NOT currently wired through the app.** Today only **calibration** flows through the
  Intelligence Service (D-03). Projection/finish-date wiring is the open **OQ-01** — so ETA is a
  **net-new** implementation surface, not a modification of an existing path.
- Whatever gets built should route through the same **Python-backed Intelligence Service** seam the roadmap
  work already established (the verified `replanRoadmap` → `POST /v1/roadmap/regenerate` pattern is the
  precedent for Python-routed calls). Confirm the endpoint/contract shape against the service before the
  plan asserts it.
- **OQ-03** (Intelligence Service deploy + auth + CORS for production) still gates *production* ETA, same as
  it gates the roadmap replan UI. Local/dev is fine.

---

## 4. What is NOT proven / still open (do not overclaim in the plan)

- **G4 / R6 — real-data circularity guard: DEFERRED, still OPEN.** No real N=1 logged sessions exist yet, so
  every ETA/partial-throughput result rests on the **synthetic generator alone**. The claims-ledger
  external-validity caveat carries this. UI copy must not imply the ETA is validated on real usage.
  → Unblocks when real logs are captured (`research/comparison/scripts/capture_evidence.py`, or pilot users).
- **R4b — reference / "ideal" line: DEFERRED.** Linear-to-deadline vs capacity-shaped was logged as
  deferred, not decided. If the UI draws an ideal/target burn-up line, flag that choice as **unresolved**
  and don't hard-code a justification the research doesn't yet support.
- The `analytic_required_rate` standalone candidate is **not** a shippable estimator (0 Holm wins) — only
  the **composite** is. Don't expose the raw analytic path as its own mode.

---

## 5. Suggested entry point for the impl-plan session

1. Read `DECISIONS.md` (esp. **#3**, and D-01…D-11 for the decoupled event model:
   `SessionBooked`/`BookingEdited`/`BookingCleared`, read-time adapter, dial UX).
2. Read the **UI planning handoff** (`handovers/2026-06-30-ui-planning-handoff.md`) — that session's UI
   decisions are the other half of the input.
3. Take §2 (ETA semantics) + §3 (product reality) from this doc as the research contract for the ETA slice.
4. Write the plan to `plans/active/<date>-<slug>/PLAN.md` + pre-filled `VERIFICATION.md` per the
   `write-implementation-plan` format; phase the ETA-composite wiring as its own vertical slice, gated
   behind the OQ-01/OQ-03 service seam. Keep the "provisional label" + "cold-start fallback, not GP
   replacement" constraints as acceptance criteria so they can't silently drift.

---

## 6. Canonical sources (these win over this baton)

- **Verification log (per-phase, reviewer-signed):**
  `plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md` — R4 §"HEADLINE VERDICT" is the #3
  decision; forecaster code re-checked at commit `7f97a3c`.
- **Design decisions (SoT for #3 + the decoupled event model):**
  `plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` (#3 = 🟡 QUALIFIED).
- **Claims ledger (dissertation-grade wording + caveats):**
  `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`
  ("Material/session decoupling validation (R2–R4)" section).
- **Frozen-vs-decoupled comparability:** `research/doc/2026-06-30-frozen-vs-decoupled-comparability.md`.
- **Gate tracker (indexes the above):** `handovers/2026-06-30-research-model-selection-tracker.md`.
- **Research reference impl for the ETA forecasters:**
  `research/comparison/src/research_comparison/baselines/projection.py`
  (`forecast_analytic_required_rate`, `forecast_gp_plus_analytic_finish`) and
  `research/comparison/src/research_comparison/runners/projection.py`
  (registered as `analytic_required_rate`, `gp_plus_analytic`). **Verify these names/signatures against the
  code before the plan hard-codes them.**
- **Datasets:** frozen A-series anchor `synthetic-21c2cdabfa91-seed0-n5400`; new decoupled
  `synthetic-decoupled-9e6d48db2da8-seed0-n5400` (`generator_version 0.2.0`). A-series untouched.

*Left in the working tree for the native side to commit (Cowork does not commit).*
