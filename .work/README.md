# `.work/` — the project's working directory

This is the local "Jira + knowledge base" for **study-planner-web**: where planning,
specs, in-flight task memory, handovers, and reusable prompts live. It was consolidated
here on **2026-06-25** from the old scattered `plans/`, `issues/`, `prd/`, `handovers/`,
and `MASTER_TRACKER.md`.

If you only read one file, read **[`STATUS.md`](STATUS.md)** — the single read-first index.

## Access note

`.work/` sits at this repo's root — an agent working in this repo reaches it directly at
`.work/...` (single repo, no sibling checkout, no symlink). If ever sandboxed somewhere
that can't see it, use the absolute repo path.

## Why `.work/` is committed to git (not ignored)

History: working docs were lost once when git was acting as a "janitor" — a `git clean -fdx`
deletes **ignored and untracked** files, so anything hidden from git was fair game. The fix
here is the opposite of hiding: **`.work/` is tracked/committed**, so `git clean` cannot touch
it. Two rules follow from that:

- **Never add `.work/` to `.gitignore`.** Ignoring it re-creates the exact condition that
  destroyed it before.
- **Never run `git clean -fdx` at the repo root** without knowing what it will remove.

Because git no longer auto-removes finished docs, **cleanup is now a manual habit** — see the
lifecycle below. Skipping it is how the pile silently grows again.

## Folder map

| Folder / file | What it is | Durable or ephemeral |
|---|---|---|
| **`STATUS.md`** | The one index. One-line rows tagged by workstream (`[APP]` `[RESEARCH]` `[PILLAR-A]` `[KT]` `[DISSERTATION]` `[INFRA]`) under **Active / Queued / Done / Reference / Gotchas**. Read first; keep short and pruned. | durable (the index) |
| **`master-tracker-detail.md`** | The full long-form workstream detail (markers, SHAs, findings, caveats) — the Reference appendix behind `STATUS.md`. Preserved from the former `MASTER_TRACKER.md`. | durable (reference) |
| **`specs/`** | The **contracts**. `specs/prd/` = the product PRD; `specs/issues/` = the vertical-slice tickets (`001a…017`) + `images/`. Stable — a developer builds against these. | durable |
| **`plans/`** | Implementation plans. `plans/active/` = in-flight (each is a `PLAN.md` spec + a `VERIFICATION.md` running log/review). `plans/archive/` = done or superseded. `plans/README.md` = how to write a plan. | mixed |
| **`handovers/`** | Cross-session batons — where one session hands the next its exact entry point. `handovers/archive/` = finished/historical handoffs. | ephemeral |
| **`prompts/`** | Reusable prompts meant to be re-fed to an agent (e.g. test-run, calibrator prompts). | durable |
| **`archive/`** | Retired / stray artifacts kept for safety (old grill session, regenerated detector outputs, commit log). | ephemeral |

**Not under `.work/`:** the research knowledge base lives at the repo root in
[`../research/`](../research/) — it's a Python package + datasets the code imports, so it stays
in place. `STATUS.md` points to its docs under `../research/doc/`. The dissertation lives in
`../college/mydeliverables/`.

## Spec vs. state (why they're separate)

The per-task **spec** (the contract — `specs/issues/*`, a plan's `PLAN.md`) is kept separate
from the per-task **state** (the volatile running log — a plan's `VERIFICATION.md`, a handover).
A developer builds against a spec that isn't moving under them; the state file is where progress,
deviations, and review verdicts churn. Exactly one current spec per task.

## The multi-agent flow (paths as the API)

1. **Planner** writes the spec → `specs/` (ticket) and/or `plans/active/<task>/PLAN.md`, and
   pre-fills `plans/active/<task>/VERIFICATION.md` with acceptance criteria.
2. **Developer** reads the spec + `../research/`, implements, and writes its log into the same
   `VERIFICATION.md` (files changed, commit SHA, deviations + why).
3. **Verifier** reads the spec + the actual diff and writes pass/fail into that same
   `VERIFICATION.md`. A phase isn't done until it's marked verified.

## Wrapping a task (the manual lifecycle)

Start a task → run the loop above → on wrap: **distill** anything reusable into `../research/`
or the repo's own docs → **move** the task folder to the matching `archive/` → **update**
`STATUS.md` (row → Done, delete any fixed gotcha). Do these in that order so nothing is lost.

## Ceremony dial (ceremony proportional to risk)

- **Trivial** — one line in `STATUS.md`, no folder.
- **Normal** — a spec + a state log.
- **Complex** — the full planner → developer → verifier loop.
