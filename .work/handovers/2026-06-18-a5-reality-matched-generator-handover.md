# Handover → Codex (new session): Phase A5 — reality-matched generator + external validity (PA+.7)

**Date:** 2026-06-18 · **From:** Cowork planning/review agent · **For:** a fresh Codex (gpt-5.5) session
**Plan:** [`../plans/active/2026-06-14-pillar-a-rigour.md`](../plans/active/2026-06-14-pillar-a-rigour.md) · **Checklist (your scorecard):** [`../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md`](../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md) → criteria **A5.1–A5.5** · **Decisions:** D-A5 (the plan), OQ-A4 (dataset resolved → OULAD).

> You are the **implementing** agent. The plan is the source of truth; this is your entry point + rules of engagement. Read the plan's operating-manual preamble, then Phase A5, D-A5, and OQ-A4 (resolved). Don't re-plan — if reality contradicts a step or a real fork appears, set the phase `🛑 Blocked: <reason>` and hand back. **A5 is the largest and most open phase; surfacing a fork beats improvising.**

## Orientation (this repo's workflow)

- Two environments, hard split: the **clean `uv` workspace `research/comparison`** (all your work) imports `py-progress`/`py-roadmap-engine` as peer candidates; `research/kt-bench` is **off-limits**.
- Plan-driven + reviewed: you implement, fill your section of `VERIFICATION.md`, commit, reviewer checks the diff. **A phase is not done until the reviewer marks it `✅ Verified`.**
- Phases A0–A4 are `✅ Verified` (test execution independently confirmed). A5 is the last phase. The A3 rigour protocol (`research/comparison/src/research_comparison/runners/rigour.py`: 200-seed dataset, held-out scoring, bootstrap CIs, Holm/BH) is what you re-run the contest under — **reuse it.**

## Step 0 — before any code: commit the pending planning/review docs

These are uncommitted in the working tree (A4 review + OQ-A4 resolution + this handover + the caveats ledger update):

```bash
git status   # expect modified: ../plans/active/2026-06-14-pillar-a-rigour.md, ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md, research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md, 2026-06-18-a5-reality-matched-generator-handover.md
git add ../plans/active/2026-06-14-pillar-a-rigour.md ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md 2026-06-18-a5-reality-matched-generator-handover.md
git commit -m "docs(plan): A4 review + OQ-A4 resolved (OULAD) + A5 handover"
```

(If nothing to commit, proceed.) Do **not** stage `.codex/**`.

## The dataset is in place (OQ-A4 resolved → OULAD)

`research/datasets/oulad/` — full 7-table OULAD, CC-BY 4.0. The two files A5.2 needs:

- **`studentVle.csv`** (10,655,280 rows): `code_module, code_presentation, id_student, id_site, date, sum_click`. The engagement series — aggregate `sum_click` across `id_site` per `(id_student, code_module, code_presentation, date)` → a **per-student daily engagement intensity** time series. (`date` = days since module start, can be negative for pre-start; decide and document handling.)
- **`studentRegistration.csv`**: `date_unregistration` (`?` = didn't withdraw) → the **dropout/withdrawal** signal for shift/bursty-missingness moments.

**It's ~449 MB / 10.6M rows — stream or sample; don't naïvely load it all into memory.** EdNet/Junyi are **not** needed (OQ-A4: optional corroboration only, add only if OULAD moments prove too coarse).

## What A5 is

Turn "works on my synthetic data" into a thesis-grade **external-validity** claim: enrich the generator, fit its **moments** to real OULAD engagement **as bounds only**, re-run the whole contest on the reality-matched regime under the A3 protocol, and report whether the per-track ranking **holds**.

### Acceptance criteria (full text in VERIFICATION.md — this is the checklist)

- **A5.1 — Enrich the generator** behind a **new `dataset_id` / params hash**: continuous archetype space (sample latent traits from a mixture, not 6 discrete types), richer regimes (multiple shifts, relapse/recovery, exam-crunch seasonality, illness/holiday gaps), bursty missingness (dropout + return-after-hiatus, weekend clustering), heavier-tailed session-length-dependent noise, and a **logged-time-misreporting layer the candidates do NOT see** (it tests robustness, not fit). **The frozen `e716cd12dddc` regime must be preserved and still reproduce byte-identically.**
- **A5.2 — Fit moments to OULAD as BOUNDS only.** Derive autocorrelation φ, shift frequency, and gap-distribution **ranges** from `research/datasets/oulad/` engagement series; feed them as generator parameter **bounds**, **never point-fit-then-score on the same fit** (circularity guard). Record the **source + the explicit proxy mapping** (`daily sum_click → minutes toward a roadmap`).
- **A5.3 — Re-run the full contest** on the reality-matched regime under the **A3 rigour protocol** (200 seeds, held-out archetypes, bootstrap CIs, Holm/BH); **report the per-track ranking-hold, including where it does NOT hold** (an honest external-validity result).
- **A5.4 — (Optional)** direct external validation: run calibration/detection/projection on the real OULAD engagement series with the stated proxy mapping. N=1 (Phase 5) stays the face-validity anchor.
- **A5.5 — Generator tests:** the new regime produces the planted richer structure (multi-shift labels in the sidecar, bursty-gap distribution, misreporting layer **present but hidden** from candidate inputs); the frozen regime hash `e716cd12dddc` is **unchanged** and reproduces.

## Suggested order

1. **Moments script first** (A5.2): read OULAD → per-student daily series → φ / gap / shift-frequency **ranges** + recorded proxy mapping. This is small, testable, and de-risks the rest. 2. **Enrich the generator** (A5.1) behind a new `dataset_id`, consuming those ranges as bounds; keep the frozen regime intact. 3. **Generator tests** (A5.5). 4. **Re-run the contest** under A3 (A5.3) + ranking-hold report. 5. **(Optional) direct external validation** (A5.4).

## What to FOLLOW

- **Bounds, not fits.** Moments set parameter *ranges*; the generator samples within them. Never fit a point value to OULAD and then score candidates on that exact fit — that's the A5 form of the leakage trap.
- **New regime = new `dataset_id`/hash, frozen regime preserved.** Keep `e716cd12dddc` reproducible byte-identically (test it); the reality-matched regime lives **alongside**, not replacing it.
- **Score under the A3 protocol** (reuse `runners/rigour.py`): held-out archetypes, bootstrap CIs, Holm/BH; report only Holm-surviving wins as wins.
- **State the proxy mapping explicitly** and cite OULAD (CC-BY → attribution required). Record source + mapping in provenance/docs.
- **Commit discipline:** on completion set Phase A5 `Status: ✅ Complete — <sha>`, fill the A5 Resolution block (files, SHA, dataset/moment sources, the bounds derived, ranking-hold summary, per-criterion self-check A5.1–A5.5, deviations + why), commit code + plan + verification together.

## What to AVOID (the recurring bar — A1/A2/A4 each had a redo over a version of this)

- **No circularity / no fitting-to-the-test.** Moments → bounds only; do not point-fit the generator to OULAD and then claim the ranking holds on that same fit. The reality-matched regime is a *robustness* check, not a curve-fit.
- **No candidate-favouring parameter values.** Range changes are recorded in pre-reg §10; never pick values that make a particular candidate win.
- **The misreporting layer is hidden from candidates.** Candidates see the logged (misreported) series; the truth stays in the sidecar. Don't leak the true minutes into candidate inputs.
- **Don't break or "improve" the frozen regime.** `e716cd12dddc` must still reproduce exactly; if your generator refactor changes it, that's a regression — stop.
- **No generator-truth leakage into `baselines/`** (the A2 lesson still applies). **Don't touch `research/kt-bench`, the closed loop, or `.codex/**`.** Don't run the known-blocked E2E/build setup.
- **Don't overstate external validity.** If the ranking doesn't hold on the reality-matched regime, **say so** — that's a finding, and it goes in the report-caveats ledger (`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`).

## Runtime heads-up

Two heavy parts: (1) OULAD `studentVle.csv` is ~449 MB / 10.6M rows — stream/sample for the moments; (2) re-running the full contest at `--seeds 200` on a new regime is the heaviest run yet. **Smoke-test the moments script + a low-seed contest run first**, then the full run once.

## Commands

```bash
export PATH="$HOME/.local/bin:$PATH"
# moments (A5.2) — your new script, reading research/datasets/oulad/
uv run --package research-comparison python -m research_comparison.<your_moments_module>
# generator tests (A5.5) + frozen-regime reproducibility
uv run --package research-comparison pytest research/comparison/tests/test_generator.py -q
# re-run contest on the reality-matched dataset_id under A3 (A5.3)
uv run --package research-comparison python -m research_comparison.runners.calibration --seeds 200
uv run --package research-comparison python -m research_comparison.runners.detection   --seeds 200
uv run --package research-comparison python -m research_comparison.runners.projection  --seeds 200
uv run --package research-comparison python -m research_comparison.runners.scheduling  --seeds 200
uv run --package research-comparison python -m research_comparison.runners.sweep
uv run --package research-comparison pytest research/comparison/tests -q
```

## What the reviewer will verify (so you can self-check first)

1. **No circularity:** moments used as bounds only; new `dataset_id`; the frozen `e716cd12dddc` regime still reproduces byte-identically; no candidate-favouring values.
2. **Misreporting layer hidden** from candidate inputs (present in sidecar only).
3. **Proxy mapping recorded** explicitly (OULAD source + `clicks → minutes` mapping), with attribution.
4. **Contest re-run under the A3 protocol** on the new regime; **ranking-hold reported honestly**, including where it breaks.
5. **Generator tests** non-vacuous: new regime's planted structure present; frozen regime unchanged.
6. Numbers ground-checked against the working-tree result JSONs; tests pass (and, like A3/A4, expect to be asked for a JUnit + evidence capture if the headline claims rest on the 200-seed run).

## Report back

Fill the A5 Resolution block in `VERIFICATION.md`. If the ranking does not hold on the reality-matched regime, that is an acceptable, honest close — report it; do not force it to hold. When A5 is verified, **Pillar A (the whole `pillar-a-rigour` plan) is complete** — flag that so we can update `research-tasklist.md` (`PA+.1–PA+.8`) and move to the Phase 5/6 write-up.

## Files likely in play

`research/comparison/src/research_comparison/generator/*.py` (enrichment + new regime/hash) · a new moments module (reads `research/datasets/oulad/`) · `research/comparison/src/research_comparison/runners/*` + `runners/rigour.py` (reuse) · `research/comparison/tests/test_generator.py` (+ track tests) · `research/datasets/oulad/` (read-only input) · `college/mydeliverables/1st-Review/report/generated/*` · `../plans/active/2026-06-14-pillar-a-rigour.md` + `…-VERIFICATION.md` (status + A5 Resolution) · `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` (record the external-validity result).
