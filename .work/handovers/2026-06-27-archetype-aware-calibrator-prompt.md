# Prompt — Build an archetype-aware pace calibrator (research layer, "A6")

> Hand this to the design+build session (Codex/Sonnet, or a fresh research session). It is
> self-contained: every path, symbol, metric, and command below is real in this repo. Confirm
> anything you're unsure of against the file named — do not guess.

---

## 1. ROLE & GOAL

You are a research-ML engineer working **only** in the Python research layer at
`research/comparison/` of the `study-planner-web` repo.

**Goal (one):** Build an **archetype-aware pace-calibration model** — added as **new, additive
candidate(s)** to the existing comparison harness — and determine, under this repo's established
rigour protocol (200 seeds, held-out archetypes, bootstrap-CI-on-Δ, Holm correction), **whether it
beats the incumbent calibration baselines on held-out generalization.**

The model must do what a generic calibrator can't: infer *what kind of learner this data looks
like* from the **observed behaviour only**, then calibrate accordingly. Build it as a **composition
of submodels** (feature layer → archetype-membership layer → per-class calibration), and build
**two membership variants** — a hard router and a soft/partial-pooling version — letting the
held-out score pick the winner.

**A scientifically honest "no improvement" is a valid, acceptable outcome.** A win that only
appears because of label leakage, tuning on scoring cells, or magic constants is a **failure**, not
a win — that exact failure is why this track exists (see §2).

**Out of scope (do not touch):** the change-detection track, the React/TypeScript app, and
`packages/progress/`. Keep `predict_next` app-portable for a *later* port, but write zero app code.

---

## 2. CONTEXT

- **Why this exists.** A prior rigour pass (A0–A5) found pace calibration is currently an **honest
  null**: simple pooling/EWMA is near-optimal, and the structured candidates (`covariate_bayes`,
  `eb_partial_pool`, `kalman`) **overfit per-context multipliers from sparse data and do not survive
  Holm on held-out archetypes** — several are significantly *worse*. Read this before designing:
  `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` (the A2 priority caveat) and the
  design brief `handovers/2026-06-18-pillar-a-custom-algorithms-handover.md` (failure modes +
  ranked options + the eval bar). Your model is the deliberate attempt to beat that null *honestly*.

- **The lever (what's genuinely learnable).** A learner's emitted pace ratio
  `r = activeMinutes / plannedMinutes` is generated as
  `pace = m_global · ρ(role) · τ(time_of_day) · ν(day_of_week) · regime(t) · φ_fatigue(same_day_count) · δ_deadline(progress) · lognormal-AR(1) noise`.
  The current baselines model **only `ρ/τ/ν`** (`baselines/calibration.py` features:
  `[intercept, anchor, practice, morning, evening, weekend]`). They **ignore** three *observable*,
  genuinely-predictive signals: `same_day_count` (fatigue), `progress = index/total` (deadline
  ramp), and recency/time-trend. **Adding those real signals is the most promising honest win — not
  cleverer priors on the same six features.**

- **The 6 frozen archetypes** live in `research/comparison/src/research_comparison/params.py`
  (`ARCHETYPES` dict): `steady`, `morning_lark`, `fading_flame`, `weekend_warrior`,
  `deadline_sprinter`, `marathon_runner`, each with principled params (`m_global`, `sigma_log`,
  `attempt_prob`, and distinguishing mechanisms like `tau`, `drift_total`, `deadline_ramp`,
  `n_steps`). They are **pre-registered and frozen** in `college/scope/archetype-preregistration.md`;
  `PARAMS_VERSION_HASH` in `params.py` is the sha256 of that doc. Extending them has hard
  consequences — see Mandatory Rule 6.

- **The harness already scores all this.** You add candidates; you do **not** reinvent generation,
  scoring, held-out splitting, or multiple-comparison correction.

---

## 3. SOURCES & TOOLS  (each line = what it's FOR / NOT for)

| Source | USE FOR | NOT FOR |
|---|---|---|
| `baselines/calibration.py` **[mandatory — your code lands here]** | Add your candidate(s); register in `calibration_candidates()`. Interface: `fit_global(sessions)->float`, `predict_next(history, next_context)->float`, `fit_interval(sessions)->tuple\|None`. | — |
| `runners/calibration.py` **[mandatory]** | Run the calibration track; emits `context_pred_mae` (primary, D-A7) and `recovery_mae`. | — |
| `runners/rigour.py` **[mandatory — reuse, do not reinvent]** | 200-seed scoring, held-out-archetype split, bootstrap CIs on Δ, Holm/BH. Every candidate must carry `delta_ci`, `scored_split="held_out"`, and appear in the `mc_correction` block. | Re-implementing any of these yourself. |
| `metrics/{prequential,paired,rigour}.py` **[reference]** | Understand exactly how `context_pred_mae`, paired Δ, and `survives_holm_win` are computed. | — |
| `oracles/calibration.py` **[reference]** | The upper bound to sanity-check against. | Reporting an oracle number as a deployable win. |
| `generator/{pace,effects,noise,regimes,reality}.py` **[READ-ONLY reference]** | Understanding the truth you're trying to recover, so your *features* are well-motivated. | **Importing any of it into `baselines/`** (`ROLE_RHO`, `TAU_GENERIC`, `m_global`, regime/shift schedules). That is leakage — Mandatory Rule 1. |
| `params.py` + `college/scope/archetype-preregistration.md` **[mandatory if extending archetypes]** | Where new archetypes are defined and re-frozen. | Silently editing one without the other — Mandatory Rule 6. |
| `tests/test_calibration_track.py` **[mandatory — mirror it]** | The shape your new tests must follow. | — |
| Datasets: frozen `research/datasets/synthetic-e716cd12dddc-seed0-n3600`; reality `research/datasets/synthetic-reality-3b404c903563-seed0-n3600` **[mandatory]** | Score frozen first, then reality for the generalization check. | Scoring only frozen and declaring victory. |

Generator-truth files and the harness are **complementary**: the generator tells you *what signal
exists* (so your features are principled); the harness tells you *whether you recovered it without
overfitting*. Use both — but the wall between them (Rule 1) is absolute.

**Commands** (env first, every shell):
```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -m research_comparison.runners.calibration --seeds 200
uv run --package research-comparison pytest research/comparison/tests -q
```

---

## 4. MANDATORY RULES  (these override any convenience implied below)

1. **No leakage — the whole point.** Never import generator truth into `baselines/`. The
   archetype-membership layer must infer the learner's type from the **observed session series
   only** — never read the sidecar archetype label, `r_star[t]`, or regime/shift schedules.
   `predict_next` may use history + the **observable** next-context (role/day/time/`progress`/
   `same_day_count`) and nothing else.
2. **No tuning on scoring cells.** Any hyperparameter (regularization λ, number of latent classes,
   mixture concentration, prior strength) is tuned **only on held-out-TRAIN archetypes**, recorded
   in provenance (mirror the A4 pattern `method="grid_search_train_archetypes_only"`).
3. **No magic constants** dialed to hit a metric. Everything data-derived or principled.
4. **Additive.** Keep all shipped candidates in the contest; yours are *added and registered*, never
   swapped in.
5. **Report only Holm-surviving wins on held-out as wins.** A significant difference in the wrong
   direction is not a win. An honest null is a legitimate close.
6. **Extending archetypes is a re-freeze, not an edit.** If you add archetypes (you are — see §5,
   S5): add them to `ARCHETYPES` in `params.py` **and** to `college/scope/archetype-preregistration.md`
   with explicit params, principled rationale, and a new dated freeze entry; this changes
   `PARAMS_VERSION_HASH`, so you must **regenerate the synthetic dataset(s)** (new hash dir) and
   record the new `params_version_hash` everywhere results are stamped. **Always keep a held-out
   subset** of the enlarged archetype set — held-out archetypes are never used to fit population
   priors, tune λ, or pick the winner. No held-out split ⇒ the protocol is void.

---

## 5. WORKFLOW  (decomposed into the smallest independently-testable slices — build, test, and score one before starting the next; fix before advancing)

**Model architecture you are building (all layers estimated from observed data only):**
- **L1 — Feature layer (shared):** per session, build observable covariates: role indicators
  (anchor/foundation/practice), time-of-day (morning/afternoon/evening), day-of-week
  (weekday/weekend), `same_day_count` (fatigue), `progress = index/total` (deadline proximity),
  recency/time-index.
- **L2 — Membership layer (archetype inference, NO labels):** reduce each learner's series to a
  behavioural fingerprint (e.g., weekend/weekday attempt ratio, time-of-day pace skew,
  early-vs-late drift, noise scale) and assign archetype membership.
- **L3 — Calibration submodels:** regularized fit of pace ratio on L1 features, per class or as
  population + per-learner offset; emits `fit_global` / `predict_next` / `fit_interval`.

**Slices:**

- **S0 — Ground yourself.** Run the calibration track + tests *unchanged* at `--seeds 200`; record
  the incumbent `context_pred_mae` / `recovery_mae` per band and the current Holm table. This is the
  bar every later slice is measured against.
- **S1 — Feature-enriched calibrator (single shared model first).** Add `same_day_count`,
  `progress`, `recency` to the `covariate_bayes`-style form as one new candidate; regularize; tune λ
  on held-out-TRAIN only. Register, unit-test, score. *(This alone may be the honest win — validate
  it before adding archetype machinery.)*
- **S2 — Behavioural fingerprint (L2 inputs).** Implement the label-free per-learner feature
  summary; unit-test that it's computable from `sessions` alone and contains **no** truth fields.
- **S3 — Candidate A: hard router.** Hard-assign each learner to a latent class / nearest behavioural
  prototype → route to that class's L3 submodel. Register as a distinct candidate; test; score.
- **S4 — Candidate B: soft / partial-pooling.** Soft responsibilities over classes (mixture), with
  per-context effects shrunk toward a **population** prior fit on TRAIN archetypes; sparse learners
  fall back to population, data-rich learners adapt. Register; test; score.
- **S5 — Extend the archetype set** (per Rule 6). Propose ≥3 new archetypes, each motivated by a
  real learning pattern (params set by principle/literature, **not** to favour your model); update
  `params.py` + re-freeze the pre-registration; designate the TRAIN vs HELD-OUT split; regenerate
  datasets; record the new hash. **Surface the proposed archetypes + split for review before
  scoring** (this is a pre-registration act).
- **S6 — Decide honestly.** Re-score A and B under `runners/rigour.py` (200 seeds, held-out, Holm) on
  frozen **and** reality regimes. Winner = the variant with a Holm-surviving win on held-out
  `context_pred_mae` (tie-break: holds on reality, then simplicity). If neither beats
  `pooled_bayes`/`ewma`, **write the honest null.**

---

## 6. DO / DON'T  (each with its why)

- **DO** infer archetype from observed behaviour (S2). **DON'T** read the archetype label or any
  `r_star`/regime field — that's leakage and invalidates the result (Rule 1).
- **DO** tune λ / #classes / prior strength on held-out-TRAIN archetypes only. **DON'T** tune on the
  held-out scoring archetypes — that's the exact overfitting the A3 protocol exists to catch.
- **DO** validate S1 (feature enrichment) on its own first. **DON'T** jump straight to the
  router/mixture — if the plain enriched model already wins, the archetype machinery must *beat that*
  to earn its complexity.
- **DO** add candidates additively and register them. **DON'T** modify or remove shipped candidates,
  oracles, or the runner's scoring logic.
- **DO** re-freeze + regenerate + re-hash when extending archetypes (Rule 6). **DON'T** edit
  `ARCHETYPES` in `params.py` without updating the pre-registration doc — the hash mismatch silently
  corrupts every stamped result.
- **DO** report a null if that's what the data says. **DON'T** introduce a magic constant or peek to
  manufacture a win — that is the failure this track was created to prevent.
- **DON'T** claim the model "understands each archetype" unless held-out generalization actually
  shows it; on seen-only data, "understanding" is indistinguishable from overfitting.

---

## 7. UNKNOWNS & NO-FABRICATION POLICY

- If a path, symbol, metric, or interface detail is unclear, **find it** by reading the named file
  (`runners/`, `metrics/`, `baselines/`, the tests) — do not guess or invent. Confirm every concrete
  identifier against the actual code, not memory.
- If a **design fork** would change the model's shape (e.g., how many latent classes, which new
  archetypes, how to define a behavioural fingerprint), **surface it and ask** before building —
  don't silently decide.
- **Never fabricate result numbers, win/loss claims, or `survives_holm_win` verdicts.** Report only
  what a scored run actually produced, with the run's `params_version_hash` and seed count.
- If you cannot complete a slice correctly (missing context, contradiction, scope blow-up), **say so
  and stop** — a flagged gap beats a confident-but-wrong result.

---

## 8. OUTPUT / DELIVERABLE

1. **Candidate code:** new archetype-aware calibrator(s) in
   `research/comparison/src/research_comparison/baselines/calibration.py`, registered in
   `calibration_candidates()`, exposing the `fit_global` / `predict_next` / `fit_interval` interface.
2. **Tests:** mirror `research/comparison/tests/test_calibration_track.py`; include an explicit
   **no-leakage** assertion (candidate produces identical output when truth fields are stripped /
   shuffled).
3. **Scored evidence:** a 200-seed held-out run on frozen + reality regimes, captured as an
   `evidence.json` in the A3/A4 style, with the `mc_correction` (`survives_holm_win`) block and the
   `params_version_hash`.
4. **If archetypes were extended:** the updated `params.py`, the re-frozen
   `college/scope/archetype-preregistration.md` (new dated entry + new hash), and the regenerated
   dataset dir.
5. **A concise findings note** stating, per band and regime: did A win? did B win? does it hold on
   reality? — or an explicit honest null. Tie each claim to the evidence file/commit.

*(Per repo process, the plan + per-candidate `VERIFICATION.md` for this work belong at
`plans/2026-06-18-pillar-a-custom-calibration-detection/` and are authored on the Cowork side; the
implementing session fills the Implementer-report sections.)*

---

## 9. DEFINITION OF DONE / SELF-CHECK  (all must hold; if any is unchecked, the task is not done)

- [ ] Candidate(s) registered in `calibration_candidates()`; shipped candidates untouched (Rule 4).
- [ ] **No-leakage audit passes:** no generator-truth import in `baselines/`; membership inferred
      from observed series only; `predict_next` uses observable next-context only (Rule 1) — and a
      test asserts it.
- [ ] All hyperparameters tuned on **held-out-TRAIN** archetypes only, recorded in provenance (Rule 2).
- [ ] No magic constants; every number data-derived or principled (Rule 3).
- [ ] Both variants (hard router **and** soft/partial-pooling) built and scored; winner chosen by
      held-out `context_pred_mae` Holm-surviving win — or an honest null is reported (Rules 5, §5 S6).
- [ ] Scored at `--seeds 200` on **both** frozen and reality regimes; `delta_ci`,
      `scored_split="held_out"`, and `mc_correction` present.
- [ ] If archetypes extended: `params.py` **and** pre-registration re-frozen, dataset regenerated,
      new `params_version_hash` recorded, held-out split preserved (Rule 6).
- [ ] `pytest research/comparison/tests -q` passes.
- [ ] Findings note states wins/nulls per band+regime, tied to evidence — no fabricated numbers.
