# Scratchpad — third-review-report-work / research
_Plan: (no PLAN.md — pure documentation-gathering task, ceremony=normal) · Log: this file doubles as log until work-journal wrap · Updated: 2026-07-03T01:15 (TASK COMPLETE — reconciliation pass done, handing off to work-journal)_

## Now
**Task complete.** All 3 documentation files written, cross-verified against source (not
just agent self-reports — several findings were independently confirmed via direct
grep/read by the orchestrating session, then any exploratory changes reverted cleanly):

- `research/01-app-architecture-and-data-flow.md` — every route/page, provider nesting,
  both TS↔Python mirrored engine pairs (progress/calibration, roadmap) with live-path
  determined per capability, the 5 pure-TS deep modules (EventStore/SyncEngine/
  SessionLifecycle/Onboarding/AuthGate), the full 18-event-kind catalog, and 7 numbered
  findings (dead code, docs drift, one real product-relevant gap: session events don't sync).
- `research/02-research-to-app-mapping.md` — research/comparison ↔ production mapped
  capability-by-capability (calibration/detection/projection/scheduling/closed-loop/
  synthetic-generator), confirms Pillar-B (KT-bench) has zero integration into the app.
- `research/03-research-to-literature-mapping.md` — full 48-entry final-bibliography
  table, cite-key-to-chapter-section map, candidate-list provenance trail (raw DOIs →
  scored → curated → cited), Pillar-A/B literature-vs-implementation asymmetry.

Now doing the work-journal handoff (STATUS.md row + decide archive-vs-keep-active).

## Alignment
Complete, on scope. All three parts of the user's original ask are covered by the three
docs above; nothing was fixed/changed in application code (pure documentation task, as
requested) — findings that looked like bugs were recorded, not remediated.

## Open
— none.

## Blockers
— none.

## Deferrals
— none. (Findings that *could* prompt follow-up work — e.g. the session-sync gap, the
unpromoted scheduling-algorithm research, the unrealized conformal-GP fix — are recorded
as findings in the docs, not tracked here as deferred tasks, since no decision to act on
them has been made yet. If the user wants any of them turned into a ticket, that's a new
task, not a continuation of this one.)

## Checklist
- [x] Stage 1 (4 parallel agents: pages; progress/calibration engine; roadmap engine;
      EventStore/SyncEngine/SessionLifecycle/Onboarding/AuthGate) + synthesis into
      `01-app-architecture-and-data-flow.md`
- [x] Stage 2 (1 agent: full research/ inventory) + 3 direct verification greps (CUSUM
      param comparison, GP-conformal absence, enriched.py hyperparameter match) +
      synthesis into `02-research-to-app-mapping.md`
- [x] Stage 3 (1 agent: literature inventory) + synthesis into
      `03-research-to-literature-mapping.md`
- [x] Scratchpad reconciliation pass (this edit)
- [ ] work-journal wrap (STATUS.md row, archive-vs-active decision) — next step

## In-flight edits
— none outstanding. All 4 files in `research/` (this scratchpad + 3 docs) are written and
complete. One transient edit (regenerating a TS test fixture to empirically check a parity
claim) was made and fully reverted during Stage 1b's investigation — confirmed clean via
`git status --porcelain` at the time.

## Decisions in force
- Output lives at `.work/plans/active/2026-07-03 third-review-report-work/research/`
  (user-specified path; folder pre-existed empty at session start — not renamed to
  kebab-case despite the space in the parent folder name, since renaming an existing
  folder was out of scope and risked breaking an external reference).
- Three separate numbered docs (one per stage) rather than one giant file, for
  scannability and independent linking from `STATUS.md`.
- Findings that look like bugs (session-sync gap, broken fixture-parity claim, unpromoted
  research findings) are documented with severity/evidence, not fixed — matches the
  user's explicit ask ("comprehensively document it").

## Follow-up 2 (2026-07-03, same session) — user-caught correction
User asked whether the material-session decoupling redesign (`.work/plans/active/2026-06-30-material-session-decoupling/`)
and the ETA model-selection research (`.work/plans/active/2026-06-30-research-eta-model-selection/`)
were accounted for — they weren't, in the original pass. Two real errors found and fixed:
1. Scheduling "gap" (issue #022) was WITHDRAWN — DECISIONS.md D1/§5c explicitly retired the
   whole scheduling-comparison research question on 2026-06-30 (prescriptive packing no
   longer exists post-redesign); this was never an unaddressed gap.
2. GP-projection "gap" was NARROWED — `packages/progress/src/projectFinish.ts` (commit
   `1d9270e`, 2026-07-01) already promotes the validated `gp_plus_analytic` cold-start
   composite (R4, validated 2026-06-30, one day earlier). Only the split-conformal
   interval-width correction remains genuinely unpromoted.
Corrected: `01-app-architecture-and-data-flow.md` (§3.5, §5 finding table), `02-research-to-app-mapping.md`
(substantial rewrite — added correction notice, rewrote scheduling/projection rows + §3
table), `03-research-to-literature-mapping.md` (scheduling/GP rows + §5 summary), issue
`022` (renamed/narrowed to conformal-only, full "Correction history" section added), issue
`021` (strengthened with DECISIONS.md corroboration), `specs/issues/README.md` follow-up
note, and `.work/STATUS.md`'s row. Lesson: when auditing "was research X promoted into
production," always check adjacent `.work/plans/active/` folders and `git log` dates before
concluding something wasn't promoted — file *content* alone can be stale relative to a
later, superseding decision or commit.

## Follow-up (2026-07-03, same session)
User asked to turn the 4 headline findings into detailed tracked issues. Filed as
`.work/specs/issues/019-022.md` (019 session-sync gap AFK; 020 fixture-parity test-integrity
AFK; 021 orphaned roadmap seam HITL; 022 promote-research-to-prod HITL), added to
`specs/issues/README.md`'s table + a dated follow-up note, and linked from the
`[DISSERTATION]` STATUS.md row added earlier this session. No code changed — issues only.

## Resolved (recent)
- Step 0 orientation (`.work/README.md`/`STATUS.md`) — confirmed this task has no
  PLAN.md/VERIFICATION.md (pure documentation task), so the scratchpad lives directly
  under the task's `research/` subfolder per the user's explicit path.
- The one open question at kickoff ("which engine — TSX or Python — is live") is fully
  answered in Doc 1 §0/§2/§3: it varies per capability, tabulated exactly, not a single
  answer.
- All 6 background research agents returned successfully; no agent failures or re-runs
  needed.
