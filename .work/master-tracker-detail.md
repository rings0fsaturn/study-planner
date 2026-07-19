---
title: study-planner-web — Master Tracker (single consolidated source of truth)
purpose: >
  One exhaustive status index across every workstream — product web app, research tier,
  Pillar-A algorithm rigour, Pillar-B knowledge-tracing bench, the M.Tech dissertation
  deliverables, and repo infrastructure. Read this first to know what is done, in flight,
  blocked, and next. It is an INDEX over the per-workstream canonical files, not a runbook.
audience: [cowork-planning-review-agent, codex-gpt-5.5, claude-code-sonnet, rohit]
status: active living document
last_updated: 2026-06-25
location_note: >
  This file is the former MASTER_TRACKER.md. On 2026-06-25 the planning pile was consolidated
  into .work/ (see ../.work README) and MASTER_TRACKER.md became .work/STATUS.md — the single
  read-first index. Paths below are relative to .work/ (so non-.work targets use ../).
maintainer: Cowork planning/review agent proposes edits; the native side commits (Cowork cannot commit — see infra notes)
status_legend:
  "✅": done / verified
  "🟡": in progress
  "☐": not started
  "🛑": blocked
  "⏳": pending review
  "🤔": assumed / unconfirmed
update_protocol: >
  When a phase/issue/cell changes state, update its row HERE in the same change that updates
  the workstream's own canonical file, and bump last_updated. This index is convenience; the
  linked canonical file is the source of truth if they disagree — fix the drift, do not paper over it.
agents:
  claude_code: reads CLAUDE.md + .claude/rules/*.md
  codex: reads AGENTS.md + .agents/rules/*.agents.md (model gpt-5.5; project_doc_fallback .agents.md)
  cowork: plans, designs, and reviews ONLY — never implements (division is absolute)
related:
  - ../CLAUDE.md
  - ../AGENTS.md
  - README.md
  - specs/prd/PRD-study-tracker-web.md
  - specs/issues/README.md
  - ../college/scope/research-tasklist.md
  - ../college/scope/research-build-plan.md
  - ../college/scope/archetype-preregistration.md
  - plans/active/2026-06-14-pillar-a-rigour.md
  - plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md
  - ../research/doc/2026-06-14-kt-credibility-tracker.md
  - ../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md
  - ../research/doc/2026-06-20-change-detection-literature-survey.md
  - ../DEPLOYMENT.md
---

# study-planner-web — Master Tracker (full workstream detail)

> **What this is.** The **full, long-form workstream detail** — markers, SHAs, findings, caveats,
> and the consolidated NEXT-actions rollup. It is the **Reference appendix** for the short index
> [`STATUS.md`](STATUS.md); read STATUS.md first, come here for depth. Preserved verbatim from the
> former `MASTER_TRACKER.md` when STATUS.md was reshaped into the scannable index on 2026-06-25.
> Markers: ✅ done · 🟡 in progress · ☐ not started · 🛑 blocked · ⏳ pending review · 🤔 unconfirmed.

> **Where things live (read [`README.md`](README.md) for the full map).** The pile is organised as:
> `specs/` (the contracts — PRD + issue tickets, stable) · `plans/` (`active/` in-flight,
> `archive/` done/superseded) · `handovers/` (cross-session batons; `archive/` = finished) ·
> `prompts/` (reusable prompts) · `archive/` (stray/retired artifacts). The reusable research
> knowledge base stays at the repo root in [`../research/`](../research/) (pointer only — not moved).
>
> **Manual lifecycle (git no longer cleans up — `.work/` is tracked on purpose so `git clean` can't
> delete it).** On wrapping a task: distill anything reusable into `../research/` or the repo docs,
> **then** move its folder to the matching `archive/`, **then** update this index (flip the row to
> Done, delete any gotcha that's now fixed). Keep this file short and pruned — an index nobody
> trusts is just another pile. **Ceremony dial:** trivial change = one line here, no folder;
> normal = a spec + a state log; complex = the full planner → developer → verifier loop.

## 0. Operating model & conventions (read once)

- **Two-environment workflow.** *Cowork* (this planning/review agent) plans, designs, and reviews; *Codex (gpt-5.5, primary)* and *Claude Code (Sonnet, secondary)* implement. The division is absolute — Cowork never writes code/tests/config and never runs mutating git (the sandbox bricks `.git` locks); the native side commits.
- **Context layers mirror 1:1.** Claude Code: `CLAUDE.md` + `.claude/rules/<name>.md` (canonical). Codex: `AGENTS.md` + `.agents/rules/<name>.agents.md` (mirror). A rule edit must update both.
- **Artifact homes.** Plans → `plans/YYYY-MM-DD-<slug>/PLAN.md` (+ `VERIFICATION.md`); tickets → `issues/`; requirements → `prd/`; cross-session batons → `handovers/`; research docs/trackers → `research/doc/` and `college/scope/`; dissertation → `college/mydeliverables/`.
- **Review loop.** Implementer commits planning docs first (Step 0), implements a phase, fills `VERIFICATION.md` (files, SHA, deviations); reviewer diffs the real commit and marks `✅ Verified` or `🔁 Changes requested`.
- **`.cursor/` and `.opencode/` are legacy/dead. Never touch `.codex/**` (runtime).**

## 1. Product — Web App v1  ·  status: 🟡 core shipped, polish gaps

Mobile-first: Astro marketing site (`studytracker.app/*`) + Vite/React 19 SPA (`studytracker.app/study/*`). Stack: pnpm 10, Supabase (auth/DB/storage), Dexie (IndexedDB), date-fns, Playwright/Vitest, Vercel.
**Canonical:** [`specs/prd/PRD-study-tracker-web.md`](specs/prd/PRD-study-tracker-web.md), [`specs/issues/README.md`](specs/issues/README.md), `DEPLOYMENT.md`.
**Status note:** per-issue state is inferred from source + plans + git (issues are not individually ticketed in-file); verify against deploys before relying on it.

| # | Slice | Status | Evidence / canonical |
|---|---|---|---|
| 1a | Deploy tracer + design system | ✅ | `packages/design-tokens/`, two Vercel deploys, `DEPLOYMENT.md` |
| 1b | Email/password sign-in | ✅ | `apps/app/src/auth/` (AuthGate DI), SignIn/SignUp |
| 2 | Log past session + account isolation | ✅ | `Log.tsx`, per-user Dexie DB (`eventstore-per-user-db` rule — replaced the wipe strategy) |
| 3 | Sync events + restore on fresh device | ✅ | `apps/app/src/sync/` (write-ahead queue, snapshots) |
| 4 | Onboarding (manual materials) | ✅ | `apps/app/src/onboarding/` (4-step wizard) |
| 5 | Active session for manual materials | ✅ | `Session.tsx` |
| 6 | URL materials w/ metadata fetch | ✅ | plan `2026-05-03-youtube-embed-article-fallback.md` |
| 7 | Active session w/ YouTube embed | ✅ | same plan; Session embed |
| 8 | Planned-end ping (NotificationStrategy) | ✅ | plan `2026-05-03-planned-end-notification-wiring.md` |
| 9 | ProgressEngine + PaceCalibration | ✅ | `packages/progress/`, plans `009a/009b` |
| 10 | Re-plan flow (three options) | ✅ | issue 010, replan flow |
| 11 | Weekly progress + streaming narrative | 🟡 | `Week.tsx` exists; streaming-narrative polish unconfirmed |
| 12 | Google OAuth sign-in | ✅ | `signInWithOAuth`, `GoogleIcon.tsx` in SignIn |
| 13 | PWA install (manifest, service worker) | ☐ | no manifest/SW found in `apps/app` |
| 14 | Marketing site content | ✅ | `apps/marketing/src/pages/` (index/about/how-it-works/privacy/terms/404) |
| 15 | Settings, preferences sync, account deletion | ✅ | `Settings.tsx` |
| 16 | Password reset + email-confirmation polish | ✅ | `ResetPassword.tsx`, `AuthConfirmed.tsx` |
| 17 | Plausible Analytics | 🤔 | referenced in privacy policy text; analytics script not confirmed |

**App next:** PWA (13); confirm/finish Plausible (17) and the Week streaming narrative (11). **Known constraint:** E2E tests are *written but not run* (environment issue — see CLAUDE.md).

## 2. Research Tier — 8-phase build  ·  status: 🟡 (6 of 8 phases done)

The `/research` tier that backs the algorithms (synthetic generator → metrics → Pillar-A tracks → Pillar-B KT-bench → validation → report).
**Canonical tracker:** [`college/scope/research-tasklist.md`](../college/scope/research-tasklist.md) (79 boxes done / 15 open). **Design:** [`research-build-plan.md`](../college/scope/research-build-plan.md). **Frozen numbers:** [`archetype-preregistration.md`](../college/scope/archetype-preregistration.md).

| Phase | Title | Status |
|---|---|---|
| 0 | Scaffolding & environment | ✅ |
| 1 | Synthetic generator (latent pace, regimes, AR(1) noise, archetypes) | ✅ |
| 2 | Metrics spine + calibration track (the tracer bullet) | ✅ |
| 3 | Fan out Pillar-A tracks (detection, projection, scheduling, oracles, sweep) | ✅ |
| 4 | Knowledge-tracing bench (Pillar B) | ✅ (with credibility caveats — §5) |
| 5 | N=1 real-data validation | ☐ open (P5.1–P5.6) |
| 6 | Outputs — report & journal wiring | ☐ open (P6.1–P6.6) |
| 7 | Closed-loop machinery (built, revealed in Phase II) | ✅ |

**Open items (the 12 unchecked tracer-bullet tasks):**
- Phase 5: P5.1 log own sessions (ongoing) · P5.2 export from event store → `SessionEvent[]` · P5.3 face-validity overlay real vs synthetic · P5.4 run own sessions through harness (N=1 case study) · P5.5 sweep-bound stats from real data (bounds only, circularity guard) · P5.6 write-up stub with explicit non-claims.
- Phase 6: P6.1 `make figs` (json → vector PDF + booktabs `.tex`) · P6.2 provenance stamp in captions · P6.3 `\input` generated tables/figures into `main.tex` · P6.4 full artifact inventory wired · P6.5 IMRAD journal-draft skeleton · P6.6 reproducibility gate (clean clone → `make all` → report compiles).
- The remaining ~3 open `☐` markers sit in the tracker's "Phase 3+ · Pillar-A rigour & extensions" section — **superseded by the A-series plan (§3) and now tracked there**; reconcile the old markers.

**Review mapping (presentation gate):** Phases 0–3 → Review 2; Phases 4–6 → Review 3 (full comparison + demo + journal draft); Phase 7 → Phase II.

## 3. Pillar-A rigour & extensions — A-series  ·  status: ✅ A0–A5 verified

Hardens the Pillar-A tracks (calibration / detection / projection / scheduling) under a rigorous protocol and adds new candidates.
**Canonical:** [`plans/active/2026-06-14-pillar-a-rigour.md`](plans/active/2026-06-14-pillar-a-rigour.md) + its `VERIFICATION.md`; design notes [`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md).

| Phase | Title | Status / SHA |
|---|---|---|
| A0 | Lock findings + rigour scaffolding (`metrics/rigour.py`) | ✅ `e1c6455` |
| A1 | Projection coverage fix (the one red → green) | ✅ `0912297` |
| A2 | Context-aware calibration prediction (re-scoped via D-A7 from EB-pooling) | ✅ `4445701` |
| A3 | Statistical rigour — 200 seeds, bootstrap CIs, held-out archetypes, Holm/MC correction | ✅ `2b8e23c` (verified) |
| A4 | New candidates per track + adversarial/wider sweep (OQ-A4 OULAD resolved) | ✅ `5aa4c2e` (verified) |
| A5 | Reality-matched generator + external validity | ✅ `68f4a12` (verified) |

**Key findings:** projection coverage fixed; **pace calibration is an honest null** under rigour (simple pooling/EWMA near-optimal; structured candidates overfit and fail Holm on held-out) — this is the null A6 then set out to beat; **change detection = a Pareto frontier with no single dominator** (CUSUM owns low-FAR, CSD owns fast-mid). Report caveats: [`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`](../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md).

## 4. Pillar-A A6 — custom calibration + detection  ·  status: ✅ calibration done; detection = honest null (probe only); ✅ prod integration verified (Cowork 2026-06-20)

Deliberate, honest attempt to beat the A-series calibration null, then (deferred) detection.
**Canonical:** [`plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md`](plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md) + `VERIFICATION.md` (all 5 calibration phases `✅ Verified`). **Latest baton:** [`handovers/2026-06-19-a6-calibration-done-detection-null-next.md`](handovers/2026-06-19-a6-calibration-done-detection-null-next.md).

| Phase | Title | Status / SHA |
|---|---|---|
| 1 | Baseline + heartbeat review scaffolding | ✅ `83bcede` |
| 2 | Dataset v2 — archetypes 6→9, observable `planned_horizon`, re-freeze (`PARAMS_VERSION_HASH=21c2cdabfa91`) | ✅ `02cedbc` |
| 3 | `enriched_shrink` calibrator (fatigue + deadline-proximity + recency, partial-pooling) | ✅ `8545481` — **real Holm-surviving held-out win on `context_pred_mae`; holds on reality. Overturns the calibration null.** |
| 4 | Archetype-aware variants (hard router + soft) | ✅ `a919ea4` — honest **non-win** (don't beat enriched_shrink) |
| 5 | Honest decision + findings | ✅ `922c64e` — recommend `enriched_shrink`; archetype layer not recommended |
| 6 | **Change detection** (two-stage + AR(1)-whitening) | ☐ **deferred** — design probe done → **robust NULL** (see §7); not yet in the real harness |

**Final calibration evidence:** `research/doc/verification-runs/2026-06-19-a6-final/{evidence.json,SUMMARY.md}`.
**Open loose ends:** (a) OQ-03 ledger caveat (frozen regime "over-clean"; lead deadline claim with reality) **not yet added** to the claims ledger; (b) the Phase 1–5 `VERIFICATION.md` reviewer edits + the lit-survey doc are **uncommitted**; (c) restore the pre-registration stop-gate (bypassed in the batch run) for any Phase 6 dataset change.

**Production integration (implemented locally 2026-06-20):** [`plans/active/2026-06-20-enriched-shrink-production-integration/PLAN.md`](plans/active/2026-06-20-enriched-shrink-production-integration/PLAN.md) (+ `VERIFICATION.md`) shipped `enriched_shrink` into `py_progress` → FastAPI `/v1/calibration` → app `useCalibrationState` (server-side, D-01). Phase 0 was **GO**, so production uses the per-learner reality+frozen dual-prior blend (D-02). Detection/projection/scheduling remain untouched (D-03). 4 implementation phases complete through `e4555c1` and **Cowork-reviewed against the committed diffs — all four `✅ Verified` (2026-06-20)**; local verification covered `py-progress` (76), `intelligence` (38), app Vitest (369), and app typecheck. Playwright calibration-service coverage is written but not run per the repo E2E constraint. **Verification caveat:** the Phase-0 dual-prior GO is a *net* win but band-dependent — 7 Holm wins vs 2 Holm-significant small-band losses on `context_pred_mae` (`recovery_mae` broadly better) — so the claims ledger must record it as a net win with a small-band exception before any write-up.

**Deferred open questions (from the integration plan — carried forward):**
- **OQ-01 — projection wiring:** should `nextSessionForecast` drive the burn-up projection/ETA, not just display? (`compute_progress` currently ignores calibration.)
- **OQ-02 — offline / caching:** server-side calibration means the UI returns `null` (pace/prompt blank) while offline and briefly between refetches. → **Implemented** in [`plans/active/2026-06-20-dev-production-readiness/PLAN.md`](plans/active/2026-06-20-dev-production-readiness/PLAN.md) Phase 3 (Dexie-persisted stale cache + UI states), commit `3655f34`; ⏳ pending Cowork review.
- **OQ-03 — production deploy:** Intelligence Service URL + CORS for `studytracker.app`; local dev now requires Supabase JWTs on `/v1/*` and supports both legacy HS256 and Supabase JWKS-backed ES256/RS256 tokens.

## 5. Pillar-B — Knowledge-Tracing bench  ·  status: ✅ (Phase 4; credibility-gated)

Isolated-env KT benchmark (pyKT / pyBKT) on public datasets.
**Canonical (source of truth for KT claims):** [`research/doc/2026-06-14-kt-credibility-tracker.md`](../research/doc/2026-06-14-kt-credibility-tracker.md) (G1–G8 gates); guidelines [`2026-06-14-kt-credibility-and-validation-guidelines.md`](../research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md). Code: `research/kt-bench/`.

- **Reportable: 9 pyKT cells** (5 NIPS2020 + 4 ACcoding) pass the credibility gates.
- **Not credible (recorded evidence):** `sakt × accoding`, `pybkt × accoding`.
- **Blocked (recorded evidence):** `pybkt × nips2020` — see `2026-06-14-kt-pybkt-nips2020-blocked-evidence.md`.
- A cell is `✅ credible` only when gates G1–G8 all pass; high-level phase markers are **not** the source of truth here.

## 6. Dissertation / College deliverables  ·  status: 🟡 Phase I delivered; R2/R3 ahead

M.Tech dissertation and review artifacts.
**Home:** `college/mydeliverables/`. **LaTeX report:** `college/mydeliverables/1st-Review/report/main.tex` (build via TinyTeX — see `.claude/rules/latex-report-build.md`; figures via `flow-diagram-tikz-gen.md`).

| Milestone | Status | Artifacts |
|---|---|---|
| 1st Guidance call | ✅ | `1st-Guidance-call/` (deck + script) |
| Literature evaluation | ✅ | `college/mydeliverables/zero/literatures/` |
| 1st Review (Phase I) | ✅ | `1st-Review/` — `report/main.tex`, `deck/`, `abstract.md`, `literature-survey-draft.md`, `architecture-diagram.md` + `arch-diagram.png`, `expected-outcomes.md`, `presenter-script.md` |
| 2nd Guidance call | ✅ | `2nd-Guidance-call/` status deck + script ("7 of 8 research parts done; both datasets in hand; 2 parts left") |
| Review 2 (intermediate results) | ☐ | gated on research Phases 0–3 (done) → assemble intermediate results |
| Review 3 (full comparison + demo + journal draft) | ☐ | gated on research Phases 4–6 |
| Phase II (closed-loop, demo) | ☐ | research Phase 7 built, revealed here |

## 7. Cross-cutting — Change-detection research (this thread, 2026-06-20)

Feeds the A6 Phase-6 decision (§4).
- **Literature survey:** [`research/doc/2026-06-20-change-detection-literature-survey.md`](../research/doc/2026-06-20-change-detection-literature-survey.md) — decomposes the detection problem into 6 pain points and maps adaptable families (KSWIN, kernel-MMD/scan-B, NEWMA, e-detectors, residual-coupled, hierarchical hybrid) toward a hybrid. ⏳ uncommitted.
- **Probe v3:** `research/scripts/unified_detector_sim.py` (`a6-detsim-v3`, committed `2cf9acd`) — adds the 6 survey families; dominance tested for all 11 non-baseline candidates over the CUSUM/CSD frontier.
- **Result (full run, reviewed):** **robust NULL** — no candidate dominates (all verdicts `worse`/`n/a`). Best aggregate `comp_overall`: `mmd_window` frozen 5.94; reality led by `page_hinkley` 55.64 with `unified_full`/`newma`/`mmd_window` clustered behind. Best partial signal: `mmd_window` frozen-drift dom_frac 0.276 [0.19,0.40] — real but far from dominance. Reality-drift undetectable by everyone. Artifacts: `research/scripts/unified_detector_{results.json,summary.md}`.
- **Recommendation:** accept the strengthened null; if anything earns a real-harness trial it's residual-coupling to the *actual* `enriched_shrink` calibrator + `mmd_window`, expecting another null. Otherwise write Phase 6 around the null.

## 8. Consolidated NEXT actions (rollup)

1. **A6 Phase 6 decision (highest priority):** accept the detection null and write the Phase 6 PLAN+VERIFICATION around it, **or** park detection and ship calibration as the headline. (Open question to Rohit.)
2. **Close A6 calibration loose ends:** add the OQ-03 ledger caveat; commit the uncommitted `VERIFICATION.md` review edits + the lit-survey doc (native side, Step 0); restore the pre-registration stop-gate.
3. **Research Phase 5 (N=1):** begin/continue logging own sessions; export → harness → face-validity overlay + case study (circularity guard).
4. **Research Phase 6 (report wiring):** `make figs` → `\input` generated artifacts into `main.tex`; provenance stamps; reproducibility gate.
5. **Dissertation:** assemble Review 2 from Phases 0–3 results; plan Review 3 (needs Phases 4–6).
6. **App polish:** PWA (issue 13); confirm Plausible (17) and Week streaming narrative (11).
7. **Production calibration hardening:** `plans/2026-06-20-enriched-shrink-production-integration/` is ✅ Cowork-verified. **Immediate:** record the Phase-0 dual-prior small-band caveat in `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`. **Then carry forward the deferred OQs (see §4):** OQ-01 projection wiring, OQ-02 offline cache/fallback, OQ-03 Intelligence Service deploy/auth/CORS before production release.
8. **Dev production-readiness (2026-06-20):** [`plans/active/2026-06-20-dev-production-readiness/PLAN.md`](plans/active/2026-06-20-dev-production-readiness/PLAN.md) (+ `VERIFICATION.md`) — 5 phases: Supabase-JWT auth on `/v1`, resilient calibration client (timeout/retry/typed errors), Dexie-persisted stale cache + UI states + error boundary, service hardening (request-id/logging/input-bounds/`/readiness`/rate-limit stub/compose healthcheck), and a one-command `pnpm dev:full` stack. Makes dev mirror prod so going live is config-only. **✅ All 5 phases implemented + committed (SHAs `b71d962`, `5cabf41`, `3655f34`, `dcb1069`, `18dd144`, ES256/JWKS fix `3c7092a` on `project/phase-1`); browser-verified with Rohit's real Supabase account: `/v1/calibration` returned 200 and no auth/service banner rendered. ⏳ Cowork reviewer findings still not filled.** Resolves prior-plan OQ-02; production hosting (OQ-03) still deferred.

## 9. Infra / housekeeping notes

- **Earlier 2026-06-20 housekeeping note:** Cowork had flagged A6 `VERIFICATION.md` reviewer edits, `plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md` edits, `research/doc/2026-06-20-change-detection-literature-survey.md`, and generated `unified_detector_{results.json,summary.md}` as possible native-side Step 0 cleanup. Re-check `git status` before acting on that older list; the enriched calibration production-integration work itself is clean through `00d1e12`.
- **Build gotchas (see `.claude/rules/`):** pnpm build needs internal registry (`COREPACK_NPM_REGISTRY`); LaTeX via TinyTeX on PATH; Dexie schema migrations must version-up; React Router `basename="/study"` (never include `/study` in `to`).
- **This tracker's reconciliation:** last full reconcile 2026-06-20. If a marker here conflicts with a workstream's canonical file, the canonical file wins — fix the row.
