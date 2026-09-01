# `.work/` — the project's working-memory system

This is the **single door** to the project's working record: `STATUS.md` (project index)
+ per-task `state.md` (durable) + per-session `SCRATCHPAD.md` (ephemeral). It follows the
`work-journal-orchestrator` contract (`.agents/skills/work-journal-orchestrator/SKILL.md`).

**Read this map and [`STATUS.md`](STATUS.md) before planning, editing, reviewing, or verifying.**
`STATUS.md` is the read-first index; every row points at a `state.md` for detail.

## The three-file system

Context flows upward as it settles from volatile to durable:

```
SCRATCHPAD.md   (session, ephemeral)   what I am doing right now; reset each session
    |  distill at session end
    v
state.md        (task, durable)        what the task is and where it stands; read to resume
    |  roll up one line
    v
STATUS.md       (project, durable)     every task, one line + a pointer down to state.md
```

- `SCRATCHPAD.md` + `state.md` are written by the **scratchpad** skill.
- `STATUS.md` and the task-centric layout are owned by the **work-journal** skill.
- Exactly one writer per file — that keeps the files from clashing.

## Access note

`.work/` lives at this repo's root and is **tracked/committed** on purpose. Two rules follow:
- **Never add `.work/` to `.gitignore`.** Ignoring it re-creates the condition that destroyed
  working docs before (`git clean -fdx` deletes ignored + untracked files).
- **Never run `git clean -fdx` at the repo root.** Because git no longer auto-removes finished
  docs, **cleanup is now a manual habit** — see the lifecycle below.

## Folder map

### Core (task-centric)

| Path | What it is | Owner skill |
|---|---|---|
| **`STATUS.md`** | The read-first project index. One line per task under Active / Queued / Done, each pointing at a `state.md`. | work-journal |
| **`active/<task-id>/`** | Everything about a live task, together: `state.md` + `SCRATCHPAD.md` + `plan/` + `prompts/` + `research/`. | scratchpad (state/scratchpad) + work-journal (layout) |
| **`archive/<task-id>/`** | Finished task folders, moved intact at WRAP (minus the emptied scratchpad). | work-journal |
| **`specs/`** | The stable contracts (this repo's `spec/`): `specs/prd/` = PRD, `specs/issues/` = vertical-slice tickets. Built against; outlive a task. | — |

> `spec/` (singular, per the generic contract) is realised here as **`specs/`** — the durable
> contract home already in the tree and referenced across hundreds of links. Treat the two as
> the same thing for this repo.

### Legacy (historical, absorbed at WRAP)

Pre-orchestrator storage for completed / in-flight work that predates the task-centric layout.
These are not migrated wholesale; they are absorbed task-by-task when a WRAP moves a folder.

| Path | What it is | Fate |
|---|---|---|
| **`plans/archive/`** | Completed implementation plans (`YYYY-MM-DD-<slug>/PLAN.md` + `VERIFICATION.md`). | stays until each task is wrapped into `archive/<task-id>/` |
| **`handovers/`** (+ `archive/`) | Cross-session batons. | drained into task `research/` or `archive/` as relevant |
| **`prompts/`** | Reusable prompts. | promoted to task `prompts/` or kept as reference |
| **`master-tracker-detail.md`** | Long-form workstream detail — the Reference appendix behind `STATUS.md`. | frozen; pointed at by STATUS, no longer edited |
| **`archive/`** | Stray / retired artifacts (older grill session, detector outputs, UI mocks). | kept for safety; not task-scoped |

**Not under `.work/`:** the research knowledge base lives at the repo root in
[`../research/`](../research/) — it's a Python package + datasets the code imports, so it stays
in place. The dissertation lives in `../college/mydeliverables/`.

## Spec vs. state (why they're separate)

The per-task **spec** (the contract — `specs/issues/*`, a plan's `PLAN.md`) is kept separate
from the per-task **state** (the volatile running record — `state.md`). A developer builds
against a spec that isn't moving under them; `state.md` is where progress, deviations, and
review verdicts churn. Exactly one current spec per task; exactly one `state.md` per live task.

## The lifecycle (manual)

Follow the `work-journal-orchestrator` phase router (`.agents/skills/work-journal-orchestrator/`):
OPEN (open a task folder + STATUS row) → START/RESUME (seed the scratchpad from `state.md`) →
SESSION END (distill scratchpad → `state.md`, verify, reset) → WRAP (promote reusable research,
remove the emptied scratchpad, move `active/<id>/` to `archive/<id>/`, flip STATUS to Done).
Do these in order so nothing is lost.

## Ceremony dial (ceremony proportional to risk)

- **Trivial** — one line in `STATUS.md`, no folder.
- **Normal** — a spec + a task folder (`state.md` + `SCRATCHPAD.md`).
- **Complex** — the full planner → developer → verifier loop inside a `plan/`.