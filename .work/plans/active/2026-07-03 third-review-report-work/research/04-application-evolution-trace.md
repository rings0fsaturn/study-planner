---
title: Application Evolution Trace — git-log-grounded chronological history, 2026-05-01 → 2026-07-03
status: durable reference (third-review-report-work research stage 2) — independently re-verified 2026-07-03
last_updated: 2026-07-03
scope: >
  How the app got to the state documented in `01-app-architecture-and-data-flow.md`,
  `02-research-to-app-mapping.md`, and `03-research-to-literature-mapping.md` — a
  chronological, commit-grounded trace of every era of development from the first
  post-scaffold commit (2026-05-01) through today. Built for the M.Tech 3rd-review
  report's development-narrative material. Read-only investigation; no code was
  changed while producing this document.
sources: >
  Seven parallel era-research-agent traces (one per chronological era below), each
  independently walking `git log --stat`/`git show` for its exact commit range and
  cross-referencing the matching `.work/plans/` folder(s) plus docs 01-03 for
  current-state truth, synthesized into this single doc by the orchestrating session,
  which additionally ran two direct verification passes on cross-era ambiguities the
  agents flagged (§9). A second, independent verification stage (2026-07-03, same day,
  after this document's initial commit `e60773e`) then re-fact-checked every specific,
  checkable claim below via 8 fresh agents (one per era plus one meta-auditor) that
  treated the original agents' work as unverified rather than as ground truth — see the
  "Verification notice" immediately below for what that pass found and corrected.
---

# Application Evolution Trace

## Verification notice (2026-07-03, independent second-pass audit)

After this document's initial commit (`e60773e`), 8 independent agents (one per era 0-6,
plus one meta-auditor for §1/§9/§10) re-fact-checked every specific, checkable claim below
against fresh `git log`/`git show`/`grep` output, instructed to actively look for errors
rather than confirm the original text. Findings, and what changed as a result:

- **Per-era commit counts (eras 1, 2, 4, 5, 6) initially looked "off by one"** against a
  naive `git log START..END | wc -l`. Root cause: every era's stated count consistently
  includes its own start-boundary commit (i.e. it's actually `git log START^..END | wc -l`),
  which the exclusive `A..B` range notation doesn't signal on its own. The numbers
  themselves are internally consistent under that convention, and independently confirmed
  to have no overlap or gap between adjacent eras — this was a missing methodology
  footnote, not a wrong count. Now stated explicitly in §0.
- **§0's "341 commits" total was simply wrong** — no reconciliation of era counts, `git log`
  windows, or branch/HEAD variants reproduces 341; the correct total is 304 (see §1).
  Corrected below.
- **Era 0's topology explanation was wrong.** The original text claimed `27fe887`'s parent
  was a `feature/issue-004` branch commit; it isn't — `27fe887`'s real parent is an
  unrelated same-day mainline commit (`d3ce43f`). The 4 extra pre-2026-05-01 commits
  actually enter the naive range through a later merge (`557fd47`, 2026-05-03) reconciling
  the long-diverged `feature/issue-004` branch. Corrected in §2.
- **Era 0's narrative silently omitted 5 real code commits** inside its own commit set
  (`1ac6ccf`, `3b3168f`, `37a398a`, `35de3d5`, `23dc3ca`) — none change any conclusion, but
  `23dc3ca` is a genuine Home.tsx behavior change worth naming. Added to §2.
- **Era 3's "reviewer-verified… 11/12 frozen, 9/12 reality" claim was unsupported.** No
  Cowork review actually happened anywhere in era 3 (that plan's `VERIFICATION.md` review
  sections are still unfilled "pending" placeholders across the whole commit range), and
  the 9/12 reality figure belongs to a later phase's re-score, not the discovery commit
  itself (whose own evidence showed 10/12 reality). Corrected in §5.
- **Era 4's "lifts the calibrator verbatim" overstated a small, real change** — one
  defensive guard clause was added, not a byte-identical copy. Corrected in §6.
- **Era 5's quoted user direction was a blended paraphrase, not a verbatim quote**, and its
  "first commit with booking vocabulary, three days after" claim conflated application-code
  and planning-doc vocabulary (two different first-use dates). Corrected in §7.
- **A genuine section-numbering bug**: "Cross-era resolutions" is `## 9`, not `## 8` as
  several internal citations claimed (frontmatter, §0, era 0, era 2, era 3); era 5 also
  cited a non-existent "§8.3". All fixed to point at the right section.
- **Two coda (§10) claims have gone stale since this document's initial commit** — not
  because they were wrong when written, but because a concurrent, unrelated session kept
  landing commits on the same calendar day after this document was committed. §10 is
  updated to reflect that.
- Everything else — every other cited commit SHA, timestamp, diff content, quoted decision,
  and numeric result (fixture counts, AUC scores, coverage numbers, Holm-win counts other
  than the one flagged above, hyperparameter values, grep results) — held up exactly under
  independent re-verification. No other correction was needed.

## 0. How to read this document

Each era below is a **contiguous, non-overlapping commit range** (exact SHA boundaries
given), covering the 304 commits inside the 7 eras below (2026-05-01 through 2026-07-02;
see the counting-convention note at the end of this section). This document's own
out-of-band commits on 2026-07-03 are covered separately in §10. Every era section was
produced by an agent instructed to (a) read the matching plan/decision docs for stated
intent, (b) verify against actual `git show` diffs rather than trust commit subject lines,
and (c) explicitly flag — not assume — whether what it found is still true today, using
docs 01-03 as the current-state reference. Where two eras' agents disagreed or flagged an
open question about each other's territory, §9 records the orchestrator's direct
verification and resolution. Nothing below is asserted from a plan document alone without
a corroborating commit; where a plan doc's stated date didn't match when the work actually
landed, the commit date wins and the discrepancy is noted.

**Counting convention**: each era's stated commit count includes that era's own
start-boundary SHA (i.e. it is `git log --oneline START^..END | wc -l`, not the exclusive
`git log START..END` that the `SHA1..SHA2` range notation conventionally implies) —
independently confirmed to be applied consistently across all 7 eras below, with no
overlapping or double-counted commits between adjacent eras.

## 1. Timeline overview

| Era | Date range | Commit range | Commits | Headline |
|---|---|---|---|---|
| 0 | 2026-05-01 → 05-09 | `27fe887..a14de65` | 37 | Progress/calibration TS engine genesis — pre-Python |
| — | 2026-05-09 → 06-06 | (none) | 0 | Dead week — offline 1st-Review report prep |
| 1 | 2026-06-06 → 06-08 | `aa7e257..b0d5ac0` | 16 | 1st-Review wrap; Python workspace + Intelligence Service born |
| 2 | 2026-06-13 → 06-14 | `0a3f44e..9ab583f` | 58 | `research/comparison` + KT-bench built; real KT data integrated |
| 3 | 2026-06-17 → 06-19 | `26c31b2..98d854d` | 46 | Pillar-A rigour (honest null) → `enriched_shrink` discovered |
| 4 | 2026-06-20 → 06-25 | `2cf9acd..c752d47` | 42 | `enriched_shrink` shipped to production; auth/retry/cache hardening |
| 5 | 2026-06-26 → 06-27 | `552bc46..2619f7f` | 57 | Roadmap Calendar + Roadmaps dashboard (built on the *legacy* packed-slot engine) |
| 6 | 2026-06-30 → 07-02 | `17bb1af..08783ed` | 48 | **The major refactor**: material/session decoupling retires packed-slot for a booking model; ETA cold-start composite promoted one day after validation |
| coda | 2026-07-03 | (uncommitted) | — | This documentation task itself; UI-bugs Phases 6-8 spec'd, not yet built |

Total: 304 commits across the 7 eras above (37+16+58+46+42+57+48 = 304), spanning
2026-05-01 through the end of era 6 (2026-07-02). A plain `git log --since=2026-05-01
--until="2026-07-03 23:59" --oneline | wc -l` returns more than 304 from any point after
this document's own commit — that command also counts commits *about* this document, and,
later the same day, unrelated work from a concurrent task (see the verification notice
above and §10's coda for the reconciliation).

---

## 2. Era 0 — Progress/Calibration Engine Genesis (2026-05-01 → 2026-05-09, `27fe887..a14de65`, 37 commits)

**Topology note:** a literal `git log 27fe887^..a14de65` returns 41 commits, 4 more than
this era's stated 37. The 4 extra pre-2026-05-01 commits (onboarding CSS, the Session page,
and their two merge wrappers — all dated 2026-04-30) are **not** `27fe887`'s own ancestors —
its real parent is an unrelated same-day mainline commit, `d3ce43f`. They enter the naive
range through a later merge, `557fd47` (2026-05-03, "Merge feature/issue-004 into main"),
which reconciles a long-diverged `feature/issue-004` branch tip back into a history that by
then already includes `27fe887..a14de65`. They're excluded below as pre-2026-05-01,
out-of-scope branch work — not because of anything about `27fe887`'s direct lineage.

### What shipped

**Playlist/session UI polish:**
`27fe887`/`fde4906` (05-01): playlist single-card + picker redesign (thumbnails, search).
`670c2f9`(05-01)→`43c9e80`(05-02, revert)→`f3e6e2c`(05-03, reland): per-kind session
rendering (YouTube IFrame embed, article new-tab fallback) — a genuine revert-and-fix-forward
(the reland added the full `YouTubePlayerAdapter`/`NotificationStrategy` split, +4044/-136
across 33 files), not an abandoned false start. `4d1ae0f`(05-03): wired the planned-end
notification into `Session.tsx` (the strategy/banner classes existed but were never
instantiated). `8d041d1`/`f1ef2b0`(05-03): ESLint config for `apps/app/`, pagination and
tie-resolution bug fixes.

**Progress-engine rename + new package split (Plan A, all 2026-05-03):**
`13599a5` Phase 1 renames `@study-tracker/progress-engine`→`@study-tracker/roadmap-engine`
(28 import sites) — **because the existing package generated roadmaps, not progress**, and
the name would have collided with the new module. `267c1ae` Phase 2 creates the
`packages/progress/` skeleton. `7211f00` Phase 3: Hierarchical Bayesian model + CUSUM.
`4b4c25e` Phase 4: Kalman filter/trend. `cdc93b6` Phase 5: GP regression + streak. `81801a3`
Phase 6: `computeCalibration()`/`computeProgress()` integration. `b93313a` Phase 7: wired into
the app via hooks.

**Plan B — UI integration (2026-05-03 → 05-04):** `6788ae8` `SessionTaggedExceptional`/
`RecalibrationPromptResolved` events + Log-form time-of-day chips. `03443c2` `BurnUpChart`
refactor + `Week.tsx`. `aed137a` Home page overhaul (streak card, GP-CI projection,
exceptional-flag toggle). `9022554` session-end exceptional toggle. `74542ea`
`RecalibrationBanner`/`RecalibrationModal` (three responses: replan/acknowledged/temporary).
`490061f` E2E spec authored (not run). `982121e` dev seed utility (`window.__seed()`).
`735b5fa`(05-04) past-weeks viewer.

**Other:** playlist-as-single-material consolidation (issue #011, all 05-08): `b4c1ad9`
rewrites `expandPlaylistsToMaterials()` to return one material per playlist (was eating a
whole 2-hour slot per video for 30-video playlists), `bb520e8`/`98f4f76`/`18009dc` add
video-cursor tracking, multi-video auto-advance, and cross-session cursor roll-forward.
`1d0875b`/`a14de65`(05-09): stale-preview-edit fix and a flaky-`SyncEngine`-test fix
(undestroyed engines left `setTimeout` callbacks alive across test boundaries).

Also inside this era's commit set but not otherwise narrated above: `1ac6ccf`/`3b3168f`/
`37a398a`/`35de3d5` (progress-engine and Week/Home test coverage additions), and `23dc3ca` —
a real Home.tsx behavior change ("Fix Home stats: always show 'This week', compare
projection to deadline") that predates and is unrelated to the later `aed137a` Home
overhaul.

### Why (stated intent)

Plan A's decisions log: three-level Hierarchical Bayesian chosen because "this should be a
STAR algorithm" and Bayesian "handles cold start gracefully" (D-04); CUSUM `h=4.5σ/k=0.5σ`
was swept against 5 synthetic user profiles, not guessed (D-05, D-15); Piecewise Kalman
("B+D architecture") because pure Kalman "smooths through regime shifts" and pure GP is
"hard to distill into narrative" (D-06); GP burn-up CI's raw coverage measured ~53.4% at
`ℓ=7/noise=0.20`, "inflated to ~80% with a 1.5× factor" — an **explicitly acknowledged
imperfect fix**, flagged as an open question at the time (D-07). Plan B: three recalibration
responses instead of binary accept/dismiss, per the user's own framing — "what can user give
us so that the existing CUSUM can match their need?" (D-10).

### Cross-era status check

- **Package split, hyperparameters, event kinds, Home/Week pages** — **all still live**,
  unchanged. Direct verification: `git show a14de65:packages/progress/src/config.ts` is
  byte-identical to doc 03 §3.3's listing — no tuning occurred after this era for these base
  constants across the entire subsequent two months.
- **`packages/py-progress/`, `packages/py-roadmap-engine/`, `services/intelligence/`** —
  **confirmed absent** throughout. First appearance of all three is `4cda8c9` (2026-06-08,
  era 1) — a full month later. `git ls-tree -r a14de65 -- packages/` shows only
  `design-tokens`, `progress`, `roadmap-engine`.
- **`videoPlayTimeMinutes`** — the field is declared here (`f3e6e2c`) but, per orchestrator
  verification (§9.1), **has never been assigned by `logSession()` in any commit across the
  project's entire history** — confirmed dead-on-arrival, not a later regression.
- **OQ-01 (GP CI under-coverage, the 1.5× inflation fudge)** — still an open question as of
  2026-07-03 per doc 01 §3.5/doc 03: the split-conformal fix this era's own plan flagged as
  needed was never built; a later era's cold-start composite (era 6) addressed a *different*
  failure mode (small-plan behavior) without touching this one.

### The dead week (2026-05-09 → 2026-06-06)

No commits exist in this ~4-week window. `.work/plans/archive/2026-06-04-review1-prep-deferrals.md`
confirms this is offline 1st-Review dissertation prep ("Review 1 is ~2 days out"), not an
unrecorded gap in app-development effort — its own deferral list explicitly deprioritizes
"repo polish" in favor of "Review 1 content."

---

## 3. Era 1 — 1st-Review Wrap + Pillar-A FastAPI Backend Origin (2026-06-06 → 2026-06-08, `aa7e257..b0d5ac0`, 16 commits)

### What shipped

**1st-Review wrap** (dissertation paperwork): `aa7e257` adds a standalone-TikZ
system-architecture diagram; `ba34193` is a bulk snapshot of report/deck/lit-survey
artifacts, the `.agents/skills/` library, and new `.claude/rules/`.

**The Python workspace origin — all within 1h36m on 2026-06-08, 08:28-10:04:**
`38dcc59`(08:28) is an unrelated same-morning app bug fix (SyncEngine dedup on re-login), not
part of the Python work. `4cda8c9`(09:04) — Phases 1+2 combined: scaffolds the root `uv`
workspace (`pyproject.toml`), `packages/py-progress/`/`packages/py-roadmap-engine/`/
`services/intelligence/` skeletons, and the fixture-export mechanism (`scripts/fixture-export/`
→ 72 progress + 27 roadmap golden JSON fixtures) that doc 01 §3.4 still describes as the
current parity-testing method. `aebb861`(09:12) Phase 3: full NumPy port of `py-progress`.
`3d3c73d`(09:22) Phase 4: `py-roadmap-engine` port. `74346f1`(09:29) Phase 5: FastAPI routers
+ Pydantic schemas. `2e32f18`(10:03) Phase 6: Docker/Colima. `b0d5ac0`(10:04): final SHA
recorded, era ends.

### Why

`.work/plans/active/2026-06-08-pillar-a-fastapi-backend.md`: port Pillar-A into Python under
a uv workspace, expose via a stateless FastAPI service, prove full parity against Vitest
golden fixtures — explicitly backend-only, no React changes (D-01). Cited driver:
"Python is the single source of truth for algorithms — evaluated code = shipped code." D-03
names the uv-workspace layout's ulterior motive: "`/research` can import same libs later" —
anticipating era 2's research tier.

### Cross-era status check

- **`services/intelligence` is born in this era, not later** — confirmed via
  `git log --diff-filter=A -- services/intelligence`: the FastAPI skeleton, `/v1` routers,
  and Docker all land here; auth hardening is a later era (consistent with plan D-07: "no
  auth on endpoints in v1").
- **`enriched_shrink` confirmed NOT YET PRESENT.** Directory listing at era-end
  (`b0d5ac0`) shows no `enriched.py` — `/v1/calibration` still returned the plain Bayesian
  result at this point.
- **Golden-fixture parity mechanism** — still the live mechanism today (doc 01 §3.4), though
  by 2026-07-03 one specific fixture has drifted from parity because production's later
  `enriched_shrink` override diverged from the plain-Bayesian value it encodes (doc 01 §3.5)
  — that drift is a much later event, unrelated to this era.
- **Minor bookkeeping note**: the plan doc's Phase 1/2 SHA citation (`0d605b5`) is a dangling,
  unreachable commit object from an amend-after-recording workflow; the reachable commit is
  `4cda8c9`. Phases 3-6 each got a corrective "record commit sha" follow-up; Phase 1/2 never
  did. Cosmetic only — no functional claim in docs 01-03 is affected.

---

## 4. Era 2 — Research-Tier Build + KT Real-Data Integration (2026-06-13 → 2026-06-14, `0a3f44e..9ab583f`, 58 commits)

### What shipped

**Foundation + Pillar-A fan-out (2026-06-13, 20:38-21:48):** `b46b79c` scaffolds
`research/comparison` as a `uv` workspace member. `2ced5f4` builds the synthetic generator.
`fd6d7c9` ships the first runner (calibration tracer bullet: `hierarchical_bayes`, `SMA`,
`EWMA`, `PooledBayesian` baselines). `de1d79d`/`ca55cc4`/`27e3483`/`15b63d5` add the
detection/projection/scheduling tracks and oracle baselines — importantly, the detection
track's `detect_cusum` is a thin wrapper around **production's own `run_cusum`** imported as
a benchmarked candidate, not a new algorithm. `66f3e9a` builds the closed-loop track but
holds it for Phase II.

**KT-bench (2026-06-13, 21:56-22:23):** `01665a6` bootstraps the isolated `.venv`
(torch 2.3.1, pykt-toolkit) and exports folds from a **12-learner smoke fixture** — the real
datasets aren't in yet. `32cb911` adds `train.py`/`coldstart.py`, confirmed by direct
inspection to be **synthetic stubs** (`MODEL_STRENGTH` dict, `synthetic_predictions()` that
never reads real data). `ded302e`/`e3c1e09` add the clean-env seam (`kt/join.py`), boundary-
enforced by a test asserting `"pykt" not in sys.modules` after import.

**KT real-data integration, R1-R3 (2026-06-14, 09:23-11:19):** `7295d30` R1 lands the real
Eedi/NeurIPS-2020 (1.38M interactions) and a new ACcoding→POJ streaming adapter (445,837
rows, no MySQL). `0789554` R2 rewrites `train.py`/`coldstart.py` to actually train pyKT's
DKT/AKT/Deep-IRT/SAKT — explicitly because "flipping only the provenance stamp on synthetic
numbers would be dishonest" (D-17). `5dc2885`/`100080a` R3 fits a real `pyBKT.Model`; a full
DKT run lands 0.7426 mean AUC on NIPS2020 (literature band ≈0.70-0.82).

**Credibility hardening (2026-06-14, 15:08-18:09):** an 8-criterion (G1-G8) gate converges on
the final **9-cell reportable allow-list** (5 NIPS + 4 ACcoding cells) doc 02 §2 still cites
today — finalized in this era's last two commits, unchanged since.

### Why

`.work/plans/active/2026-06-13-research-tier.md`: build the offline comparison harness
"genuinely" — importing `py-progress`/`py-roadmap-engine` as peer candidates, never
re-implementing — plus a quarantined KT bench. The quarantine rationale (D-13/D-14): pyKT's
torch/wandb stack "would contaminate the clean numpy-only `uv` workspace," so the bridge is
file-only (`results/kt/*.json`), never an import.

### Cross-era status check

- **`enriched_shrink`, `detect_cusum_robust`, `gp_plus_analytic`, `forecast_conformal_finish`
  — all confirmed NOT YET PRESENT.** First appearances: `8545481` (2026-06-19, era 3),
  `5aa4c2e` (2026-06-18, era 3), `17bb1af` (2026-06-30, era 6). `forecast_conformal_finish`
  had a near-miss false positive — a 06-14 commit only *plans* it, doesn't implement it; the
  actual function doesn't exist in code until later.
- **KT-bench quarantine design and the 9-cell allow-list — both confirmed to originate in
  this era, unchanged since.** Not a later retrofit.
- **`.work/plans/active/2026-06-14-pillar-a-rigour.md`'s phases (A0-A4) are NOT executed in
  this era** despite the filename date — confirmed absent from era 2's commit range; they
  land 2026-06-17/18 (era 3 confirms the same boundary independently — see §5, no conflict).

---

## 5. Era 3 — Pillar-A Rigour (A0-A5) + Custom Calibration/Detection Discovery, A6 (2026-06-17 → 2026-06-19, `26c31b2..98d854d`, 46 commits)

`26c31b2` is a trivial tooling sanity-check commit (auto-reverted), not real work.

### What shipped

**A0-A5 (2026-06-17 09:51 → 06-18 12:54), the rigour pass:** `e1c6455` A0 scaffolds
bootstrap CIs, Holm/BH correction, held-out archetype splits — and records that the shipped
`hierarchical_bayes` incumbent mathematically collapses to a plain global-mean pool,
explaining why every prior "calibration win" measured Δ≈1e-17. `833fdd2`→redo `0912297` A1:
projection-coverage attempt (first try was a hardcoded ×4.20 fudge, review caught it as
tuned-on-scoring-cells; redo used a principled AR(1) variance-inflation factor, landing
honest within-learner coverage at only 0.50/0.67/0.85 vs nominal 0.95 — the ≈0.95 fix was
explicitly deferred to A3). `716f6f9`→redo→re-scope `4445701` A2: a first covariate-model
attempt leaked the generator's own constants into its prior (review caught it); the redo
produced an honest null on the original metric, then a user-directed re-scope to
context-aware prediction found a win that **did not survive Holm correction** on held-out
data once A3 re-checked it. `2b8e23c` A3: seeds bumped 40→200, held-out archetype split
locked, Holm/BH correction applied — across-learner split-conformal here reached genuine
0.906-0.991 coverage. `5aa4c2e` A4: new candidates per track. `68f4a12` A5: reality-matched
generator regime from a 10.65M-row OULAD pass — structured calibration candidates
(covariate/EB) **do not hold** on the reality regime; projection/scheduling rankings do.
**Verified whole-plan close**: "Pace calibration was an honest null under rigour" — no
candidate beats the incumbent under Holm correction on held-out data.

**A6 (2026-06-19, same day, immediately following A0-A5's close) — the enriched-shrinkage
discovery.** `a10eaff` plan committed; scope is calibration-first, detection explicitly
deferred to Phase 6 per the user's direction ("Focus on pace calibration first"). `02cedbc`
Phase 2: archetype set extended 6→9 specifically so the most interesting held-out pattern
(deadline-ramp behavior) exists on both sides of the train/held-out split. **`8545481`
Phase 3, 10:51:06 — the discovery commit**: adds `EnrichedShrinkageCalibrator`
(`enriched_shrink`) to the research harness — a ridge/shrinkage log-linear regression over
observable signals the null-era candidates ignored (fatigue, deadline-proximity from the new
`planned_horizon` field, recency), shrunk toward a TRAIN-only population prior. A genuine,
leakage-free win by the plan's own held-out/Holm criterion — **though not Cowork-reviewed
within this era**: that plan's `VERIFICATION.md` review sections remain unfilled "pending"
placeholders across the whole commit range, so "reviewer-verified" (as an earlier version of
this document put it) overstated what actually happened here. At this discovery commit's own
evidence, `enriched_shrink` is Holm-surviving on held-out `context_pred_mae` in 11/12 frozen
cells and **10/12** reality cells — the oft-cited "9/12 reality" figure is Phase 5's later
re-score, after archetype-router candidates were folded into the correction family (see
below). `a919ea4` Phase 4: archetype-aware router variants
tested and **honestly rejected** — neither beats plain shrinkage. `922c64e` Phase 5: final
recommendation is `enriched_shrink` alone, not the archetype layer.

### The enriched_shrink discovery — exact timeline

First code appearance: `8545481` (2026-06-19 10:51, research-only — no production code
touched anywhere in this era). Dataclass defaults at introduction were already
`ridge=2.0, shrink=6.0` — matching what ships in production today. **However**, the Phase 3
run's own grid search *selected* different values for its own evaluation runs:
`ridge=1.0, shrink=6.0` (frozen dataset) and `ridge=1.0, shrink=2.0` (reality dataset) — not
the defaults (evidence: `research/doc/verification-runs/2026-06-19-a6-enriched/evidence.json`).
**§9.2 resolves this**: the defaults were independently re-validated (not blindly inherited)
by the very next era's Phase 0. The dual-prior ensemble (`DualPriorWeightedCalibrator`,
`REALITY_POPULATION_PRIOR`/`FROZEN_POPULATION_PRIOR`) does **not** exist yet — confirmed
absent throughout era 3; first appears `bd9eafa` (2026-06-20, era 4).

### Cross-era status check

- **`enriched_shrink`'s core design (shrinkage toward a population prior over observable
  session-context features)** — **still live**, exactly as discovered, in
  `packages/py-progress/src/py_progress/enriched.py` (doc 01 §3.6).
- **The archetype router variants** — correctly not recommended here, and correctly absent
  from what's live today (doc 01/02 describe only the plain dual-prior ensemble).
- **Change-detection "robust null"** — **not this era's finding**, despite `.work/STATUS.md`
  attributing it to "A6 Phase 6": the underlying artifact
  (`research/doc/2026-06-20-change-detection-literature-survey.md`) is first committed
  2026-06-20 or later, one to six days after this era ends, and is absent from this era's
  final tree. The probe belongs entirely to era 4.

---

## 6. Era 4 — `enriched_shrink` Promoted to Production + Dev-Production-Readiness (2026-06-20 → 2026-06-25, `2cf9acd..c752d47`, 42 commits)

### What shipped

**Calibration promotion, Phases 0-3 (all 2026-06-20, 22:28-22:52):** `bd9eafa` Phase 0
validates the `DualPriorWeightedCalibrator` ensemble (two `EnrichedShrinkageCalibrator`s,
one per `REALITY_`/`FROZEN_POPULATION_PRIOR`, leave-one-out-weighted, static (0.6,0.4)
cold-start blend) — **GO**, 7 Holm-surviving wins, with a documented small-band-regression
caveat recorded the same evening (`c3b6a71`). `0032479` Phase 1 lifts the calibrator
**near-verbatim** into `packages/py-progress/src/py_progress/enriched.py` — one defensive
guard clause is added to `fit_global` (returns the prior mean for an empty session list,
absent from the research version) — production behavior unchanged this phase regardless,
since nothing calls `production_calibrator()` yet. `eef569a` Phase 2 wires it into `compute_calibration`, overriding only
`globalMultiplier`/`globalPosterior.variance` (role multipliers, CUSUM, Kalman trend
untouched, per D-03) and adds the (ultimately unused client-side) `nextSessionForecast`
field. `e4555c1` Phase 3 creates `intelligenceClient.ts` and rewires `useCalibration.ts` to
call `POST /v1/calibration` — **the first commit that makes the app call the Intelligence
Service for calibration at all.**

**Dev-production-readiness, 5 phases (implemented 2026-06-21, reviewed/closed 2026-06-25):**
`b71d962` Phase 1: `require_user` JWT auth (HS256/`SUPABASE_JWT_SECRET`) on all `/v1` routes.
`5cabf41` Phase 2: 8s-timeout, ≤2-retry resilient client with typed errors. `3655f34`
Phase 3: Dexie `v5` adds `calibrationCache`; stale-cache fallback + `ErrorBoundary`. `dcb1069`
Phase 4: request-id logging, `/readiness`, per-user rate limiting. `18dd144` Phase 5:
`pnpm dev:full` launcher, immediately followed same-morning by `3c7092a` — a real Supabase
browser session surfaced **ES256, not HS256** access tokens, extending `require_user` to
branch on JWT `alg` with JWKS-based verification for asymmetric keys. Review paused 4 days;
`94195d0` (06-25) flagged a Phase-2 typed-error leak, fixed same evening by `abbac65` (see
`.claude/rules/fetch-typed-error-normalization.md`), closed by `9d553cf`.

### Cross-era status check

- **`enriched_shrink`/dual-prior hyperparameters, auth flow, stale-cache contract — all
  still live, unchanged since this era.** Direct verification at HEAD confirms
  `packages/py-progress/src/py_progress/enriched.py`'s `ridge=2.0, shrink=6.0` and
  `services/intelligence/app/security.py`'s HS256/ES256-JWKS branching match doc 01 §3.6-3.7
  exactly, including line-level dependency-chain details. This entire architecture traces
  cleanly to this era and has not been touched since.
- **`pnpm dev:full` — partially superseded.** The command name is still the documented entry
  point (`CLAUDE.md`), but its `concurrently`+`wait-on` implementation from this era was
  replaced by the `./full-app` lifecycle-manager CLI one era later (`16394a0`, 2026-07-02).
- **`nextSessionForecast`** — shipped here, confirmed still a dead field client-side (doc 01
  §3.2), consistent with this era's own scope (D-04 was additive plumbing only).

---

## 7. Era 5 — Roadmap Calendar + Roadmaps Dashboard (2026-06-26 → 2026-06-27, `552bc46..2619f7f`, 57 commits)

### What shipped

**Roadmap Calendar, 7 phases (2026-06-26):** `c50ff53` Phase 1: pure `deriveSlotStatuses`
function. `8019007` Phase 2: `/study/roadmap` gets a real month-grid calendar. `3cb0df6`
Phases 3-4: month nav + session/day detail modals. `3967553` Phase 5: mobile dots/day-sheet/
swipe. `192cbef` Phase 6: `RoadmapMarkedComplete/Abandoned` terminal events + lifecycle
grouping. `84abbd2` Phase 7: the Python-routed replan seam (`postRoadmapRegenerate` →
`/v1/roadmap/regenerate`, TS `regenerateRoadmap` as offline fallback) — **per the user's
explicit direction — "Create an interface and its shd route to python backend."**

**Roadmaps Dashboard, 7 phases (2026-06-26/27):** `4631152` Phase 1: identity-aware lifecycle
grouping (a replan chain collapses to one entry). `37a0361` Phase 2: date-window session
attribution (no new `roadmapId` field, by design — D-06). `0fc02ce`→redo `521cd6d` Phase 3:
re-entrant onboarding (`?new=1`). `2cba6cf` Phase 4: `/roadmaps` becomes a real dashboard
(Active/Draft/History). `03a2537` Phase 5: non-dismissible `RoadmapEndedBanner`, 3 actions
only, never a blocking modal (preserving the user-choice principle, D-08/D-09). `c771f63`→
redo `d544994` Phase 6: quick-log + inline edits (`RoadmapEdited`). `734dd32` Phase 7:
`/replan` becomes a real preview-confirm screen, in-place edit preserving roadmap identity
(D-07: "Ya its meant to update in place").

**Dashboard fixes (2026-06-27):** `03f7386` Phase A: `?new=1` was being dropped by
intra-onboarding navigation. `5d3cfcc` Phase B: history detail becomes a real route. Phase C
(layout polish) explicitly deferred by the user. `2619f7f` Phase D: `findActiveRoadmap`
lifecycle-aware resolver — Home/Week stop being driven by an abandoned/completed roadmap
with no successor.

### What generation system was this UI built against, at era-end?

**Confirmed by direct `git show 2619f7f:<path>` inspection: the legacy packed-slot system,
not the booking system that's live today.**

1. `RoadmapCalendar.tsx` at era-end imports and calls `deriveSlotStatuses` — not
   `deriveBookingStatuses`.
2. Onboarding (`Step3Preview.tsx`) calls `generateRoadmap` from `@study-tracker/roadmap-engine`
   (the packed-slot engine) — not `generateBookings`.
3. The live default Replan path is `replanRoadmap.ts` → `postRoadmapRegenerate` →
   **`POST /v1/roadmap/regenerate` on the Python service** — exactly as D-11/D-12 specified —
   with TS `regenerateRoadmap` invoked only as an offline fallback.
4. Zero trace of booking vocabulary anywhere in the era-5 tree
   (`generateBookings`/`SessionBooked`/`BookingCleared`/`deriveBookingStatuses` all return no
   hits). The first commit introducing booking vocabulary into **application code**
   (`apps/app`/`packages`) is `327ca45` (2026-07-01) — four days after this era ends, inside
   era 6. Two `.work/` planning-doc commits use the vocabulary earlier still (`8272d46`,
   2026-06-30, three days after this era ends; `8c65b07`, 2026-07-01), but neither touches
   application code — the substantive point stands: the live app's code doesn't gain booking
   vocabulary until era 6.

### Cross-era status check

**This entire UI shell was built and verified against the packed-slot engine — the fact that
today's `RoadmapCalendar.tsx` reads `deriveBookingStatuses` instead is a later-era migration,
not something this era did.** Era 6 (§8, confirmed independently by the era-6 agent, not
just inferred here) shows the migration rewired exactly the three call sites this era built
(`Step3Preview.tsx`, `commitReplan.ts`, `RoadmapCalendar.tsx`) onto the booking model while
apparently keeping this era's UI shell (calendar grid, lifecycle dashboard, banners, terminal
events) largely intact — a clean example of an underlying data-layer swap under a stable UI.

---

## 8. Era 6 — ETA Model-Selection Research + Material-Session Decoupling Redesign (2026-06-30 → 2026-07-02, `17bb1af..08783ed`, 48 commits) — "the major refactor"

### What shipped

**ETA/decoupling research (all 2026-06-30, `research/comparison`):** `17bb1af` plan authored.
`36f2718` R1: decoupled-regime synthetic generator (models the new booking/partial-session
data-generating process). `51a5d40`→`a9c3e70` R2: calibration re-run confirms `enriched_shrink`
transfers to the new regime. `96368de`/`c766bee` R3: detection re-run, CUSUM robust-null
holds and strengthens. `7f97a3c` **R4 code**: adds `forecast_gp_plus_analytic_finish`
(`COLD_START_N=5`) to the research baselines. `7d55bc1`/`a3acadf` **R4 evidence**: the
200-seed/9-archetype/3-band benchmark and Holm verdict — beats plain GP on cold-start plans
only (qualified win). `8ae07b4` R5 rigour parity; R6 (real N=1 data) explicitly deferred, no
data yet.

**Decoupling implementation (2026-07-01 → 07-02 morning):** `327ca45` (07-01, 11:35)
Phases 1+2: `generateBookings`/`Booking`/`suggestMaterialForBooking` added to
`packages/roadmap-engine`; `generateRoadmap`/`regenerateRoadmap` marked `@deprecated` but
kept compiling; `deriveBookingStatuses`/`buildMaterialLedger`/`buildDailyActivity` added to
`packages/progress`. `de2339a` (13:05) Phases 3+4: `Step3Preview.tsx` rebuilt for the
summary+calendar UI (retires `SchedulePreview`/tie-resolution/`generateRoadmap`); `Session.tsx`
gains a pre-session material-picker gate; partial-position capture on interrupt.
`bd20c8a` (13:34): review-gap fixes (real radial dial, soft-cap pace logic, collapsible
groups). **`1d9270e` (15:10) Phases 5+6**: rebuilds the booking editor sheets to the mock,
**and adds `packages/progress/src/projectFinish.ts`** (the ETA composite) + capacity-based
weekly targets. `31feaa2`(20:35)→rework `6d4cc89`(07-02, 08:25) Phase 7: `Replan.tsx` levers
UI, then fixes for an async capacity-lever hydration race, `materialDurationOverrides` not
applying on read, and a hardcoded `weeks: 0`.

**Post-ship UI bug fixes, Phases 1-5 (2026-07-02 evening):** `0268f20` Phase 1/2 (duplicate
Edit-link removal; centered booking sheets). `3c8d869` Phase 3/4 (empty-day tap-to-add;
study-day tint/legends). `256616b` Phase 5 (burn-up baseline rebuilt from live
booking-capacity semantics, axis/GP-curve fixes).

### The redesign decision, verbatim-grounded

`DECISIONS.md` **D1** (locked 2026-06-30): *"Drop the prescriptive day-by-day `Slot`
assignment. Materials live in a browsable directory; the user picks a material at session
start, then sets a session length. The engine's job shrinks to capacity model + finish-date
projection, not per-day packing."* Trigger: the `/onboarding/3?new=1` bug traced to the
packer's boundary "tie" slots. **§5c**: *"Dropped: the scheduling track (constrained packer
retired; soft-suggest ordering is a lighter, separate KT concern)."* The companion research
plan states it in the planner's own words: *"Scheduling track | DROPPED (constrained packer
retired; §5c) — do not run/extend."* **This is an explicit, dated, reviewed retirement — not
an oversight.**

### The promotion-timeline verification (`projectFinish.ts` / `1d9270e`)

Independently re-verified — **no discrepancy found on any of the three points**:

1. Commit date: `1d9270e`, **2026-07-01 15:10:10**.
2. The diff creates `projectFinish.ts` new (112 lines) with `export const COLD_START_N = 5`
   and the exact three-branch structure (cold-start → analytic; GP-non-crossing/past-horizon
   → analytic rescue; else GP point+CI) — a line-for-line match to the research reference
   `forecast_gp_plus_analytic_finish`.
3. R4's own `VERIFICATION.md` states "implemented by Codex on 2026-06-30," and the benchmark
   result file has mtime `2026-06-30 17:25`. `1d9270e` lands 2026-07-01 15:10 — **exactly one
   calendar day later**, same author/timezone. The "one day after validation" claim already
   stated in docs 01-03 checks out precisely.

### What this era orphaned

`packages/py-roadmap-engine/` and `services/intelligence/app/routers/roadmap.py` (the
`/v1/roadmap/regenerate` seam) receive **zero commits** in this era — they were **abandoned
in place, not actively removed**. What this era's commits *did* actively do: rewire the
three live call sites (`Step3Preview.tsx`, `commitReplan.ts`, `RoadmapCalendar.tsx`) from the
packed-slot engine onto `generateBookings`/`deriveBookingStatuses`, leaving `replanRoadmap.ts`
in place but unreachable — it still compiles and still imports `regenerateRoadmap`, but
nothing in the live app imports `replanRoadmap.ts` anymore (confirmed via
`grep -rn "generateRoadmap\|regenerateRoadmap" apps/app/src` at current HEAD, one hit, in
that now-dead file).

### Cross-era status check

All specific claims this era was asked to verify (R4's validation date and composite design,
D1/§5c's exact wording, the three promotion-timeline facts, the orphaning mechanism, and the
five UI-bug-fix phase-to-commit mappings) **checked out exactly as already stated in docs
01-03 and `.work/STATUS.md`** — no factual correction was needed from this era's trace.

---

## 9. Cross-era resolutions (orchestrator direct verification)

Two questions were flagged by more than one era agent as needing a check outside their own
commit range. Both were resolved directly against `git show`/`git log`, not by trusting
either agent's inference:

### 9.1 `videoPlayTimeMinutes` — confirmed dead since origin, in every era

The Era-0 agent found this field declared in `f3e6e2c` (2026-05-03) but flagged it as
uncertain whether it was ever wired up. Direct check:
`git log --all -p --follow -- apps/app/src/session/SessionLifecycle.ts | grep videoPlayTimeMinutes`
returns **zero hits across the entire project history** — the field has existed only as an
unassigned optional type field (`session/types.ts:146`) since the day it was declared. Doc 01
§4.3's "not currently populated by `logSession()`" finding is not a regression from some
earlier working state; it was never wired in any era.

### 9.2 `enriched_shrink`'s `ridge=2.0, shrink=6.0` — validated for the ensemble, not inherited blindly

The Era-3 agent found that the Phase-3 discovery run's own grid search selected
`ridge=1.0` (both frozen and reality datasets) as best for the **standalone** calibrator —
not the `ridge=2.0, shrink=6.0` class defaults that ship in production — and asked the
orchestrator to check era 4's promotion commit for provenance. Direct check of `bd9eafa`
(era 4, Phase 0, "validate dual-prior weighting") shows its `DualPriorWeightedCalibrator` and
component `EnrichedShrinkageCalibrator` classes were **defined with `ridge=2.0, shrink=6.0`
from the start of that commit** — i.e., Phase 0's own 200-seed/Holm/held-out validation run
(which produced the GO decision) *used* these values, and `0032479`'s promotion commit
carries the identical numbers forward unchanged. **Resolution**: these are not "untested
defaults inherited by accident" — they are the specific values the dual-prior *ensemble*
(a different model configuration from era 3's single-calibrator experiment) was itself
validated against. Era 3's `ridge=1.0` finding and era 4's `ridge=2.0` are both real,
correctly-reported results — for two different model shapes evaluated one day apart, not a
contradiction or an error in either era's work.

---

## 10. Coda — 2026-07-03 (today, not a commit-graph era)

**As originally written**, at this document's own commit (`e60773e`, 2026-07-03 21:25): the
working tree contained no code commits for 2026-07-03 — only in-progress
planning/documentation state: this stage-2 evolution-trace task (and its stage-1
predecessor, docs 01-03), issues 019-022 filed from stage 1's findings, and
`.work/plans/active/2026-07-02-material-session-ui-bugs/`'s Phases 6-8, which were fully
spec'd (mock HTML files for the branded-loading state and bubble-truncation fix exist) but
had zero implementation commits yet.

**Updated by this document's independent verification pass** (still 2026-07-03, same day):
that state has already moved on, from a concurrent session unrelated to this one. `33a98c9`
("scroll day sheet into view," 21:40) implements Phase 6 of the material-session-ui-bugs
plan, and `f70126b` (21:41) records its work-journal wrap — per that task's own
`SCRATCHPAD.md`, Phase 6 is implemented and awaiting reviewer verification; Phases 7-8
remain unimplemented. This verification stage of the third-review-report-work task (the one
that produced the corrections in this document) is itself further same-day activity not yet
fully wrapped. Nothing in this coda should be read as a snapshot that stays current for
long — on a day with this much concurrent activity, re-run `git log --oneline 08783ed..HEAD`
before citing "what's shipped as of 2026-07-03" in the dissertation.
