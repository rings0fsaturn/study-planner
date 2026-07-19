# Change-Detection Literature Survey — covering CUSUM/CSD's weaknesses toward a principled hybrid

**Date:** 2026-06-20 · **Author:** Cowork planning/review agent · **Status:** research artifact (not yet a plan)
**Motivates:** Phase 6 of [`plans/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md`](../../.work/plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md)
**Grounded in harness:** `research/comparison/src/research_comparison/baselines/detection.py`, `runners/detection.py`, `metrics/detection.py`

---

## 0. How to read this (unbiased stance)

This survey was written to find detectors **beyond CUSUM/CSD** that attack our *specific* weaknesses — not to justify a predetermined winner. To keep it honest:

- It **carries forward the A6 probe null** (no fused detector dominated the CUSUM/CSD Pareto frontier; AR(1)-whitening and GLR both failed) and **explicitly down-ranks** anything that just re-runs that experiment.
- Each candidate carries an honest **null-risk** rating, including the blunt finding that **reality-regime drifts sit below the detection floor for *every* method we have tried** — a hybrid cannot manufacture a signal that isn't in the data.
- Sources are chosen for **credibility and breadth**: field-defining surveys, peer-reviewed benchmarks, and primary method papers — not blog posts. Selection criteria are in §4.

The reader's takeaway should be a *prioritised shortlist with realistic expectations*, not hype.

---

## 1. What is already exhausted (do not re-tread)

The harness already implements and the A6 probe already stress-tested these. Treat them as the **baseline frontier**, not candidates:

| Already in harness / probe | Family | Verdict |
|---|---|---|
| `cusum` (robust MAD z-scores, step+drift arms) | Sequential / CUSUM | Owns the **low-false-alarm** end of the frontier |
| `csd` (critical slowing down: rising mean/var/autocorr) | Variance/AR proxy | Owns the **fast-mid** end |
| `page_hinkley`, `ewma` | Sequential / control chart | Competitive on aggregate; weak under the Pareto/FAR lens |
| `adwin`, `bocpd`, `bocpd_ar1` | Windowing / Bayesian | Dominated on our data |
| `ruptures_pelt_binseg` | Offline | Oracle / upper bound only (not online) |
| `unified_{gate,two_stage,full,glr}` | Fusion of the above + GLR | **Null** — no dominance; AR(1)-whitening and GLR both falsified |

**Implication for an unbiased search:** the productive frontier is *not* "fuse more mean-shift detectors." It is (a) detect a **different kind of signal** (distribution shape, not just the mean), (b) detect on a **higher-SNR stream** (calibrator residuals, not raw pace), and (c) **control false alarms with a guarantee** so Layer-1 speed isn't paid for in FAR. Those three are the axes of everything below.

---

## 2. The core problem, decomposed into pain points

The brief ("one fused operating point that *dominates* the latency↔false-alarm frontier, Holm-surviving on held-out, on both regimes") decomposes into six smaller, separately-attackable problems:

- **P1 — Gradual drift under noise.** Slow declines (60→55→50→45 min over weeks) never produce an alarming single session; mean-shift detectors miss them. *This is the headline weakness.*
- **P2 — The latency↔false-alarm tension.** Catching faster costs false alarms. We need to push the frontier *outward*, i.e. lower FAR at equal latency (or vice-versa), ideally with a **guarantee** on FAR (average run length, ARL).
- **P3 — Autocorrelation & non-stationary noise.** Pace is serially correlated; naive whitening (AR(1)) already failed. Need noise handling that doesn't assume i.i.d. and doesn't depend on a fragile AR fit.
- **P4 — Short, per-learner series + cold start.** Each learner has few sessions; detectors must work with little pre-change history and not over-trigger early.
- **P5 — Learner heterogeneity.** 9 archetypes with different baselines; a single global threshold is wrong for some. (Mirrors the calibration archetype problem.)
- **P6 — Single-signal.** We currently monitor one channel (pace ratio). Real shifts also show in session frequency, gaps, and prediction error. Multivariate/derived signals may carry drift the pace channel buries.

A "hybrid" worth building is one whose **components each own a different pain point** — not four mean-detectors voting on the same signal.

---

## 3. Candidate families, mapped to pain points

Each subsection: what it is · which pain point · how it adapts into our harness · honest null-risk.

### 3.1 Nonparametric distribution-shape monitoring → P1, P3, P6
**Methods:** **KSWIN** (Kolmogorov–Smirnov windowing) [Raab et al. 2020]; **scan-B / kernel-MMD** change detection [Li et al. 2019; Li et al. 2015]; **MMDEW** (MMD on exponential windows) [Kalinke et al. 2022]; **QuantTree / Kernel-QuantTree** [Boracchi et al. 2018; Stucchi et al. 2024].

Instead of tracking the *mean*, these compare the **distribution** of a recent window against a reference window (KS distance, or Maximum Mean Discrepancy in a kernel space). A gradual drift that never spikes the mean still **shifts the distribution's shape/spread**, which these can catch — directly targeting P1. They are nonparametric (no Gaussian/i.i.d. assumption), so they tolerate the autocorrelated, heavy-tailed pace noise better than AR(1) whitening did (P3). MMD extends naturally to multiple channels (P6).

- **Adaptability:** KSWIN is ~30 lines over a sliding window of pace ratios; reference impl. in `river`/`scikit-multiflow`. MMDEW/scan-B are recursive (EWMA-like cost), so online-cheap. All slot in as new `DetectionCandidate`s.
- **Null-risk: MEDIUM.** Strongest *new* shot at P1. Risk: windowed two-sample tests need enough samples per window, which collides with P4 (short series) — tune window size on TRAIN only.

### 3.2 Residual-coupled detection (monitor the calibrator, not raw pace) → P1, P5, P6
**Methods (residual stream + a sequential test):** error/performance-based drift detectors **DDM, EDDM, RDDM, HDDM, STEPD, MDDM** [Gama 2004; Baena-García 2006; Barros 2017; Frías-Blanco 2015; Nishida & Yamauchi 2007; Pesaranghader 2018]; **WCUSUM** for patterned-mean residuals; **ADDM** (autoregressive-based drift) [arXiv:2203.04769].

This is the highest-leverage *new* idea and it only became possible this cycle: **A6 produced a genuinely good calibrator (`enriched_shrink`).** Feed each learner's one-step prediction **residual** `(actual − predicted)` into a detector. A behaviour change makes a well-calibrated model's residuals jump or bias — a **higher-SNR signal than raw pace**, because the model has already removed the predictable structure (fatigue, deadline ramp, recency) that pollutes the pace channel. The error-based drift family (DDM and descendants) was *designed* for exactly "monitor a model's error stream," which is why it's normally "supervised" — here our ground-truth-free residual is the supervision.

- **Adaptability:** we already compute `predict_next`; emit residuals alongside and run any §3.1/§3.3 test on them. RDDM/HDDM are in `river`. Must obey the no-leakage rule (observable residual only).
- **Null-risk: MEDIUM-LOW for the *idea*, MEDIUM for any single detector.** Decouples detection quality from the noisy pace channel and reuses a verified asset. Risk: if the calibrator already absorbs a slow drift into its per-learner fit, residuals stay flat and the drift hides — must monitor residuals *before* online re-fitting.

### 3.3 Anytime-valid sequential testing with FAR guarantees → P2, P4
**Methods:** **e-detectors** (e-process / Shiryaev–Roberts & CUSUM mixtures) [Shin, Ramdas & Rinaldo 2023, arXiv:2203.03532]; **conformal test martingales** for exchangeability [Volkhonskiy et al. 2017; Vovk].

These attack P2 head-on. An e-detector accumulates "evidence against no-change" as a betting process with **clean, non-asymptotic bounds on the average run length (false-alarm frequency)** and **near-optimal detection-delay bounds** in the sub-Gaussian/sub-exponential cases — *without* assuming a parametric pre/post distribution. That is precisely the lever the probe lacked: a way to run a *fast, sensitive* statistic while **provably** holding FAR, so speed isn't paid for in false alarms. Conformal martingales give the same anytime-valid guarantee by testing exchangeability and work with very little history (P4).

- **Adaptability:** the "change in the mean of a **bounded** random variable, **without i.i.d.** assumptions" instantiation in the e-detectors paper maps almost exactly onto bounded pace ratios; the betting statistic is a short recursion. This is the natural **confirmation layer** for the hybrid (§5).
- **Null-risk: LOW-MEDIUM on the FAR axis; MEDIUM on raw latency.** Best-justified route to *moving* the frontier rather than sliding along it. Risk: guarantees are about FAR, not sensitivity — on reality-drift it will be *correctly* silent (a true null, not a bug).

### 3.4 Autocorrelation-aware monitoring (beyond AR(1) whitening) → P3
**Methods:** online change-point detection in **dynamic-regression models with autocorrelated residuals**; **WCUSUM** for patterned/dynamic mean; empirical-likelihood-ratio change tests for **short autocorrelated series** [see §4 surveys; Aminikhanghahi & Cook 2017].

AR(1) whitening failed because a single global AR coefficient is a poor model of bursty study behaviour. These instead either (a) model the dynamic mean and monitor *its* residual increments (WCUSUM), or (b) use distribution-free statistics whose null is calibrated *under* autocorrelation rather than assuming it away.

- **Adaptability:** MEDIUM — more bespoke; best treated as a *noise-model swap* feeding §3.1/§3.3 rather than a standalone detector.
- **Null-risk: MEDIUM-HIGH.** We already have one autocorrelation null (AR(1)); honesty demands flagging that better noise modelling may still not clear the bar. Lower priority than §3.1–3.3.

### 3.5 Heterogeneity & cold start → P4, P5
**Approach (not a single algorithm):** per-learner standardisation against a **partial-pooling population reference** — exactly the shrinkage idea that *won* in calibration (`enriched_shrink`). Set each detector's reference/threshold from a TRAIN-population prior, then adapt per learner as sessions arrive. Pairs with any detector above.

- **Adaptability:** HIGH — reuses the calibration shrinkage machinery and the existing TRAIN-only tuning discipline.
- **Null-risk: LOW as an enabler** (it won't *create* detections, but it reduces early false alarms on atypical archetypes and fixes the "one threshold for all" error). It is the detection analogue of the calibration archetype layer — and note that layer was an honest *non*-win, so treat this as variance-reduction, not a headline.

### 3.6 Composition: hierarchical two-layer & ensembles → the hybrid
**Methods:** **Hierarchical Change-Detection Tests (HCDT)** [Alippi, Boracchi & Roveri 2017, IEEE TNNLS]; **Hierarchical Hypothesis Testing / HLFR** [Yu et al. 2019, arXiv:1707.07821]; heterogeneous **detector ensembles with voting** [Gama et al. 2014; Gemaque et al. 2020].

This is the *principled* version of the hybrid the user wants — and it is **structurally different from the failed `unified_full` union.** `unified_full` OR-ed parallel paths, which *adds* false alarms (pinning the FAR floor). A **hierarchical** scheme is a fast **Layer-1 detector** (high sensitivity, FAR-tolerant) whose alarms are **confirmed by a slower, rigorous Layer-2 test** before firing — confirmation is an **AND**, which *lowers* FAR. HHT/HLFR is shown to beat flat detectors on precision, delay, *and* adaptability across drift types; HCDT formalises the two-layer design with FAR control. Ensembles (parallel + vote) are the alternative composition: diversity covers step *and* drift, but they trade FAR for coverage, so they rank below hierarchical for our P2-dominated objective.

- **Null-risk: MEDIUM** — the composition is sound and directly targets the dominance bar; residual reality-drift undetectability still caps the ceiling.

---

## 4. Why these sources (unbiased selection)

Selection rule: prefer (1) field-defining peer-reviewed **surveys** for taxonomy, (2) independent **benchmarks** for unbiased comparison, (3) **primary** method papers for mechanics. Excluded: vendor blogs, undated secondary summaries.

| Source | Type | Why credible / what it anchors |
|---|---|---|
| Lu, Liu, Dong, Gu, Gama, Zhang (2019), *IEEE TKDE* 31(12) — arXiv:2004.05785 | Survey | Canonical concept-drift taxonomy (abrupt/gradual/incremental/recurring); maps detector families |
| Gama, Žliobaitė, Bifet, Pechenizkiy, Bouchachia (2014), *ACM Computing Surveys* 46(4) | Survey | The reference drift-adaptation survey; error-based detector lineage + ensembles |
| Aminikhanghahi & Cook (2017), *Knowl. Inf. Syst.* 51:339–367 | Survey | Time-series change-point methods, supervised+unsupervised, incl. autocorrelation |
| Truong, Oudre, Vayatis (2020), *Signal Processing* 167 | Review + library | Offline CPD review; basis of `ruptures` (our oracle) |
| van den Burg & Williams (2020), arXiv:2003.06222 | **Benchmark** | Independent evaluation of CPD algorithms (TCPD) — guards against cherry-picking |
| Gemaque, Costa, Giusti, dos Santos (2020), *WIREs DMKD* e1381 | Survey | Specifically **unsupervised** drift detection (our regime) |
| Shin, Ramdas, Rinaldo (2023), *NEJSDS* — arXiv:2203.03532 | Primary | e-detectors: nonparametric, ARL-guaranteed (P2) |
| Keriven, Garreau, Poli (2020), *IEEE TSP* — arXiv:1805.08061 | Primary | NEWMA: model-free dual-EWMA / MMD (P1/P6) |
| Li, Xie, Dai, Song (2019), *Sequential Analysis*; Li et al. (2015), *NeurIPS* | Primary | scan-B / M-statistic kernel CPD (P1) |
| Alippi, Boracchi, Roveri (2017), *IEEE TNNLS* 28(2):246–258 | Primary | Hierarchical Change-Detection Tests (the hybrid skeleton) |
| Yu, Abraham, Wang, Shah, Wei, Príncipe (2019), *J. Franklin Inst.* — arXiv:1707.07821 | Primary | HHT/HLFR two-layer detect-and-confirm |
| Raab, Heusinger, Schleif (2020), *Neurocomputing* 416 | Primary | KSWIN (impl. in `river`/`scikit-multiflow`) |
| Frías-Blanco et al. (2015) HDDM; Barros et al. (2017) RDDM; Pesaranghader et al. (2018) MDDM | Primary | Error-based detectors for the residual-coupled route (§3.2) |

---

## 5. Proposed hybrid (concrete)

A **hierarchical, residual-coupled, FAR-guaranteed** detector — each layer owns a different pain point:

```
            pace ratios ─┬─────────────────────────────► (channel A: raw pace)
                         │
   enriched_shrink ──► residual stream ────────────────► (channel B: model residual, §3.2 → P1/P6)
                         │
        ┌────────────────┴───────────────────────────────────────────────┐
        │ LAYER 1 (fast, sensitive, FAR-tolerant)                         │
        │   nonparametric window test (KSWIN / MMDEW) on A and B          │  → P1, P3
        │   reference + threshold from TRAIN population prior, per-learner │  → P4, P5
        └────────────────┬───────────────────────────────────────────────┘
                         │ candidate alarm (proposal only)
        ┌────────────────┴───────────────────────────────────────────────┐
        │ LAYER 2 (slow, rigorous, confirms — AND, not OR)                │
        │   e-detector / conformal martingale on the flagged segment      │  → P2 (ARL/FAR guarantee)
        └────────────────┬───────────────────────────────────────────────┘
                         ▼ confirmed change point
```

Why this can move the frontier where `unified_full` could not: Layer-1 supplies **speed and a drift-sensitive, distribution-shape signal on a higher-SNR residual channel**; Layer-2 supplies a **provable FAR floor via confirmation**, so the system can run Layer-1 *hot* without paying the usual false-alarm tax. The per-learner population-prior reference handles heterogeneity and cold start. It is additive: each piece is an existing, citable method.

**Honest ceiling:** the probe says reality-regime *gradual* drifts are below the floor for everyone. Expect real gains on **step** and **frozen-drift**, and on the **FAR axis** via Layer-2; **reality-drift will likely remain an honest null** — and that is an acceptable, publishable result, not a failure.

---

## 6. Prioritised shortlist for the real harness

Ranked by (expected payoff on our pain points) × (adaptability) ÷ (null-risk):

1. **Residual-coupled detection (§3.2)** — *highest leverage, newly unlocked by `enriched_shrink`.* Emit residuals; run KSWIN/RDDM on them. Attacks P1/P5/P6.
2. **e-detector confirmation layer (§3.3)** — the only route with a **FAR guarantee**; the principled fix for P2 and the natural Layer-2.
3. **Nonparametric window test — KSWIN or MMDEW (§3.1)** — best standalone new shot at P1; also the Layer-1 engine.
4. **Hierarchical composition of 1–3 (§3.6, §5)** — the actual hybrid; only assemble *after* the parts are individually scored, so the source of any gain is attributable.
5. *(Lower)* Autocorrelation-aware noise model (§3.4) and ensemble voting (§3.6) — fallback experiments; higher null-risk.

**Explicitly de-prioritised (unbiased honesty):** any further fusion of mean-shift detectors, more AR-whitening variants, or GLR retuning — the probe exhausted these.

---

## 7. Unbiased evaluation protocol

Reuse the A6 rigour protocol verbatim so results are comparable and self-honest:

- **Dataset:** the Option-A re-freeze first (give `steady_improver` a labelled **train-side drift**, keep `night_owl` a no-shift control) so drift exists on *both* sides of the split — otherwise any drift result is untrustworthy. Honour the pre-registration **stop-gate** that was bypassed in the calibration batch.
- **Scoring:** 200 seeds, held-out archetypes, **Holm** correction, on **frozen + reality**; emit `evidence.json` + `SUMMARY.md`. Score each candidate vs `cusum` under `mc_correction`; per-shift-type Pareto frontiers with bootstrap CIs.
- **Success bar (the brief's, unchanged):** a fused operating point that **dominates** the CUSUM/CSD frontier (dom_frac CI-low ≥ 0.90), Holm-surviving on held-out. The probe predicts this is *not* met for reality-drift; meeting it for **step / frozen-drift / the FAR axis** would already be a real advance.
- **Pre-register the null as an acceptable outcome** to prevent fishing — the failure mode this track exists to avoid.

---

## 8. Open questions for the user

1. **Scope of Phase 6:** prototype the full §5 hybrid, or first land the two highest-leverage parts (residual-coupling + e-detector) and measure before composing?
2. **Residual definition:** monitor residuals from `enriched_shrink` specifically (best calibrator) or the simpler incumbent (more conservative, less risk of the model masking drift)?
3. **Dependency budget:** allow `river` (KSWIN/RDDM/HDDM, well-maintained) into `research/comparison`, or hand-implement to keep the harness dependency-free as today?
4. **Hash policy:** fold the Option-A re-freeze into the existing v2 `PARAMS_VERSION_HASH` or cut a v3?

---

## 9. References (locators)

- Lu, Liu, Dong, Gu, Gama, Zhang (2019). *Learning under Concept Drift: A Review.* IEEE TKDE 31(12):2346–2363. arXiv:2004.05785.
- Gama, Žliobaitė, Bifet, Pechenizkiy, Bouchachia (2014). *A survey on concept drift adaptation.* ACM Computing Surveys 46(4).
- Aminikhanghahi & Cook (2017). *A survey of methods for time series change point detection.* Knowl. Inf. Syst. 51:339–367.
- Truong, Oudre, Vayatis (2020). *Selective review of offline change point detection methods.* Signal Processing 167:107299. (`ruptures`)
- van den Burg & Williams (2020). *An Evaluation of Change Point Detection Algorithms.* arXiv:2003.06222. (TCPD benchmark)
- Gemaque, Costa, Giusti, dos Santos (2020). *An overview of unsupervised drift detection methods.* WIREs DMKD 10(6):e1381.
- Shin, Ramdas, Rinaldo (2023). *E-detectors: a nonparametric framework for sequential change detection.* NEJSDS. arXiv:2203.03532.
- Keriven, Garreau, Poli (2020). *NEWMA: a new method for scalable model-free online change-point detection.* IEEE TSP. arXiv:1805.08061.
- Li, Xie, Dai, Song (2019). *Scan B-statistic for kernel change-point detection.* Sequential Analysis. (+ Li et al. 2015, *M-statistic*, NeurIPS)
- Kalinke et al. (2022). *Maximum Mean Discrepancy on Exponential Windows for Online Change Detection.* arXiv:2205.12706.
- Boracchi, Carrera, Cervellera, Macciò (2018). *QuantTree.* ICML. + Stucchi et al. (2024). *Kernel-QuantTree.* arXiv:2410.13778.
- Alippi, Boracchi, Roveri (2017). *Hierarchical Change-Detection Tests.* IEEE TNNLS 28(2):246–258.
- Yu, Abraham, Wang, Shah, Wei, Príncipe (2019). *Concept Drift Detection and Adaptation with Hierarchical Hypothesis Testing.* J. Franklin Inst. arXiv:1707.07821.
- Raab, Heusinger, Schleif (2020). *Reactive Soft Prototype Computing for Concept Drift Streams (KSWIN).* Neurocomputing 416.
- Frías-Blanco et al. (2015). *HDDM.* IEEE TKDE 27(3). · Barros et al. (2017). *RDDM.* Expert Systems with Applications. · Pesaranghader et al. (2018). *McDiarmid Drift Detection (MDDM).* IJCNN.
- Gama, Medas, Castillo, Rodrigues (2004). *DDM.* SBIA. · Baena-García et al. (2006). *EDDM.* · Nishida & Yamauchi (2007). *STEPD.* Discovery Science.
- *Autoregressive-based Drift Detection Method (ADDM).* arXiv:2203.04769.
- Volkhonskiy, Burnaev, Nouretdinov, Gammerman, Vovk (2017). *Inductive Conformal Martingales for Change-Point Detection.* PMLR/COPA.
- Bifet & Gavaldà (2007). *Learning from time-changing data with adaptive windowing (ADWIN).* SIAM SDM. · Adams & MacKay (2007). *Bayesian Online Changepoint Detection.* arXiv:0710.3742. *(both already in harness)*
