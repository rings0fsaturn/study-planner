---
title: Deferrals — Review 1 Prep Session
date: 2026-06-04
context: M.Tech "First Review" prep (Phase I). Review 1 is ~2 days out (est. Jun 7–8).
status: open
---

# Deferrals — Review 1 Prep Session (2026-06-04)

Things consciously pushed to later during this session, so they don't get lost.
Priority for the next 2 days is **Review 1 content**, not repo polish.

## Deferred actions

- [ ] **Commit-carve on `project/phase-1`** — split the squashed delta commit
  `644f65d` into logical "R2 chunk" (roadmap-engine + onboarding + dashboards)
  then "R3 chunk" (`packages/progress` engines + full SessionLifecycle).
  - Why deferred: cosmetic repo polish; zero bearing on Review 1 grade. Only
    matters if an examiner browses GitHub.
  - Trigger to revisit: the night before the repo needs to be visible to a panel.
  - Effort: ~30–45 min mechanical file-grouping.
  - Note: R1's "30%" ≈ `origin/main` already (real granular commits exist there),
    so only the *delta* needs carving, not the base.

- [x] **Tag `r1/30pct` at `origin/main`** — DONE 2026-06-04. Reference point so the
  data-collection/plumbing subset can be shown on demand as the "30% code".

- [ ] **Recover original git history** — the real repo (with full granular commit
  history) is **not accessible from this environment**. This working copy was
  re-initialized fresh (`git init`) and grafted onto `origin/main`; current full
  code lives in one squashed commit `644f65d`.
  - Why deferred: real repo unreachable here.
  - Trigger: when working from an environment that can reach the real repo.

- [ ] **Remote push / remote sync** — no push access to
  `github.com/NotTheRealRohit/study-planner-web` from here.
  - Why deferred: explicitly "worry about remote later."
  - Trigger: when push access is available.

- [ ] **Stand up FastAPI "Intelligence Service" (Docker/Colima)** — Python backend
  serving heavy ML for both pillars. Local Colima for dev/demo.
  - Why deferred: Phase-II build; not needed for Review 1 (architecture only).

- [ ] **Production hosting for the FastAPI backend** — Colima is local-only; a
  deployed product needs a container host (Fly.io / Render / Railway / etc.).
  - Why deferred: Phase-II / post-demo concern.

- [ ] **Migrate Pillar A engines (`packages/progress`: Bayesian, CUSUM, Kalman, GP)
  from TS → Python** as the single source of truth (evaluated code = shipped code).
  Keep trivial display derivations (streak, minutes, up-next) client-side TS for
  offline. Heavy inference → FastAPI, cached locally.
  - Why deferred: Pillar A already works in TS; do NOT rewrite before Review 1.
  - Trigger: Phase II, when wiring the Intelligence Service.

- [ ] **Refine architecture diagram** — `design/architecture.md` is a draft (OK as-is
  for now). Iterate later; also produce a Phase-I-only simplified variant for the
  Review-1 slide (full-color Phase I, greyed Phase II).

- [ ] **Start logging real study sessions NOW** — no real session data exists yet.
  N=1 validation is a later-review deliverable; every un-logged day is data lost.
  Begin daily app usage immediately so Review 2/3 has real data to validate against.

## Open decisions still to resolve (continue grill)

- [x] **Rework literature survey — BOTH pillars** (REQUIRED for Review 1) — DONE 2026-06-05.
  - Context: `literature-survey.md` is a zeroth-review FIRST DRAFT; needs full
    integration/deepening for Pillar A AND Pillar B (not just a Pillar B add-on).
  - DONE: Pillar B candidate selection — see `college/.../literatures/pillarB-selected.md`
    (158 evaluated + 26 arXiv recovered; curated set, all themes covered).
  - DONE (2026-06-05): expanded `1st-Review/report/main.tex` Literature Survey from
    27 → **48 papers (21 Pillar A + 27 Pillar B)**, mixed depth (anchors get full
    paragraphs, rest grouped tight mentions), added an SRL-analytics row to the
    comparison table `tab:litsummary`, all 48 `\bibitem`s with verified DOIs.
    Compiles clean: **28 pp, 0 undefined citations, 0 multiply-defined**.
  - Dropped as domain-mismatched (matched on keywords, not relevance): screw-compressor
    GPR, X-BCD smart-home, region-text-localization, K-Means weekly-engagement, generic
    GNN personalized-learning, Anki-medical-student survey, psych-test AIG, BKT+HPR AR,
    online-integrity book chapter, Cheng arXiv (dup of published ISET version).
  - PENDING (slide): pick the tight ~6-7 ★ subset per pillar for the Review-1 deck.
  - OPEN: title subtitle? (still "Adaptive Study Planning for Self-Directed Learners");
    architecture figure still a commented placeholder (TikZ vs PNG export unresolved).

- [ ] **Dataset story** — what dataset(s) to present at Review 1. Complicated by
  the new assessment pillar: needs study material / transcripts / quiz data, not
  just session durations. Current direction: hybrid synthetic (6 archetypes,
  nonlinear ground truth) + N=1 real validation. (Guide explicitly named this as
  a Review 1 must.)
- [ ] **Base paper(s)** — pick anchor paper(s) for each pillar (work is original,
  not a replication, so "what's your base paper?" needs a crisp answer).
  Candidates: Zanellati (hybrid KT), Perez-Suay (GP on Moodle), + an assessment /
  automatic-question-generation paper for Pillar B.
- [ ] **Is the guide on the Review 1 committee** (vs. a separate panel)? Changes
  how much airtime to give his "end-state vision" ask vs. the rubric. (Asked, not
  yet answered.)
- [ ] **Review 1 content deliverables** (rubric): Abstract (does not exist yet),
  refined Architecture diagram (now two-pillar), Algorithms/Techniques (both
  pillars), measurable Expected outcomes, 12–15 References.

## Decisions locked this session (for continuity)

- Assessment-based verification is a **co-equal core research pillar** (guide's
  directive), not a peripheral feature.
- End-state = **verified closed-loop** adaptive study planner. Two pillars:
  A) closed-loop adaptation (Bayesian → CUSUM → GP → constraint-based scheduling),
  B) assessment-based verification (LLM-generated, material-grounded quizzes).
- Phase split: **Phase I = open-loop baseline + *research* assessment options**;
  **Phase II = close the loop + *build* concrete assessment** (the mandated novelty).
- Review structure (per PES/GL guidelines): Phase I = Zeroth ✓ → First → Second →
  Third (4 touchpoints); Phase II = First → Second → Third (3). Phase II = novelty.
- `project/phase-1` is a **working branch off the full code** (demo the open-loop
  subset) — **not** a stripped branch. The app is already open-loop (calibration
  computed but not fed back), so the full current app is a legitimate Phase-1
  deliverable; no stripping needed.
- Repo: fresh local `git init`, `origin` set, `main` = `origin/main` + `644f65d`
  (full current code, 361 files ahead), `project/phase-1` branched off `main`.
  `.env.local` gitignored; `.claude/worktrees/` gitignored.
