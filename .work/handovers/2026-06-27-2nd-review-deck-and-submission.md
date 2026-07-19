# Handover — 2nd-review deck, presenter note & submission bundle (2026-06-27)

## What this session produced

All under `../college/mydeliverables/2nd-review/`:

- **`Second-Review-Progress-So-Far.pptx`** — 7-slide status deck (plain-language, human voice).
  Titles: Second Review: Progress So Far · Teaching the Plan to Read Pace Better · Spotting Pace
  Shifts: What I Found · Putting the Research to Work · The App Today · What's Next, and When ·
  Closing Thoughts. Built with python-pptx (`outputs/build_deck.py`).
- **`presenter-note.md`** — speaker notes: per-slide talking points, "old vs new" pace explanation,
  the four Pillar-A methods status table, plain-word swaps, likely Q&A.
- **`study-tracker-2nd-review-submission.zip`** (~1 MB, 315 files) — runnable **web app + Python
  intelligence service** only (research/college excluded). Includes `SUBMISSION/` (deck, note,
  `architecture-diagram.png` = the horizontal Pillar-A diagram, `README-SUBMISSION.md`). Ships a
  **trimmed root `pyproject.toml`** (uv members = py-progress, py-roadmap-engine, services/intelligence;
  `research/comparison` dropped) and **omits `uv.lock`** (uv resolves fresh). Secrets excluded
  (`apps/app/.env.local`, `services/intelligence/.env`); only `.env.example` templates included.
  pnpm lockfile kept (matches the 5 JS members incl. apps/marketing).

## Honest-status corrections made to the deck this session (code-grounded)

These were caught by Rohit against the running app and verified in code:

1. **Finish date is not calibration-driven.** `packages/progress/src/progress.ts` `computeProgress`
   takes `_calibration` (unused); the projected finish comes from the burn-up GP curve, not the new
   pace method. This is **OQ-01** (still open). Deck slide 4 now carries an explicit "Honest status"
   line; the service returns a sharper **pace**, which drives the "review your plan" nudge — not the
   on-screen finish date.
2. **Only Pace Calibration is wired through the Python service** (`/v1/calibration`). Per decision
   **D-03** (enriched_shrink integration plan), Change Detection / GP projection / Scheduling stay as
   the in-browser TS implementations — validated/hardened, not replaced. Note + deck reflect this.

## ⚠️ Drift to reconcile (the working tree advanced mid-session)

When Rohit screenshotted the app, `apps/app/src/pages/Roadmap.tsx` was a "Coming soon" stub and the
deck's "Still to build" listed **Roadmap page** and **Re-plan flow**. The tree has since advanced
(commits dated 2026-06-26/27, now on `project/phase-1`):

- **Roadmap page is BUILT** — `Roadmap.tsx` → `<RoadmapCalendar />` (roadmap-calendar plan, all 7
  phases Cowork-verified per STATUS).
- **Re-plan: seam built, UI still a stub** — `apps/app/src/roadmap/replan/{replanRoadmap,mapToRegenerateRequest}.ts`
  route to `POST /v1/roadmap/regenerate`; `/replan` route renders `ReplanStub()` (App.tsx:120).
  Full `/replan` UI is [`issue 010`](../specs/issues/010-replan-flow-with-three-options.md), still queued.
- Also new: **`/roadmaps` dashboard** (multi-roadmap lifecycle, phases 1–6 done, phase 7 in progress).

**Decision needed from Rohit:** reconcile the deck to the now-current code? i.e. move **Roadmap page**
to "Working now" and re-label **Re-plan** as "partly built (plumbing done, screen pending)" on slides
5 & 6 (and the note). The submission **zip already contains the current code** (RoadmapCalendar
included), so the code and deck currently disagree — fixing the deck makes them honest again.

## Next entry point

1. Get Rohit's call on the deck reconcile (above) → if yes, edit `outputs/build_deck.py` slides 5 & 6
   + `presenter-note.md`, rebuild, re-copy into `2nd-review/`, re-zip.
2. Otherwise the deliverables are final as-is.
