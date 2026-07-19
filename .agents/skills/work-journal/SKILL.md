---
name: work-journal
description: "Maintain the project's .work/ working directory (the local Jira + knowledge base) so its record stays current and nothing is lost. Use at the END of any work worth remembering: a plan or spec was created, a task or phase progressed or finished, after an implementation/grill/research session, or when the user says \"record this\", \"update .work\", \"we finished X\", or \"wrap this up\" - even if they don't name .work. It classifies what happened, creates or updates the right file in the right folder (specs, plans, the task's state/verification log), keeps .work/STATUS.md (the index) honest, and on completion does the wrap: distill findings into research, move the active task folder to archive, flip the STATUS row. The directory LAYOUT differs per project, so it reads .work/README.md first and adapts (see Project profiles). Reach for it whenever a session produced something a future agent needs to resume. Not for editing code, searching the tree, or writing prompts (use prompt-architect)."
---

# Work Journal — keep `.work/` current

`.work/` is the project's **local Jira + knowledge base**: the index, the per-task specs and
running logs, the durable research, and the reusable prompts. This skill is the *manual habit* that
keeps it honest — because in every project that uses `.work/`, git no longer auto-cleans it, so
record-keeping is on you.

> **The layout is NOT the same in every project.** Where `.work/` lives, how it's protected from
> git, what the subfolders are called, and how rows are tagged all vary. **Two things are constant:**
> the *method* below (orient → classify → write → update index → wrap) and the *invariants*
> (durable vs ephemeral; spec vs state; one index; archive-don't-delete; ceremony dial; code is
> ground truth; no fabrication; manual lifecycle). Everything project-specific you **read from the
> project itself**.

## Step 0 — Detect the project and orient (always first)

1. **Read `.work/README.md`** — it is the canonical folder map for *this* project. It tells you
   where `.work/` sits (inside the repo, or outside as a sibling), how it's protected from git, the
   exact subfolder names, the task-id convention, and the agent doc(s).
2. **Read `.work/STATUS.md`** — the read-first index. Learn the section model and the row **tag
   set** this project uses (e.g. `[UI]`/`[BE]`, or `[APP]`/`[RESEARCH]`/`[PILLAR-A]`/…). Find the
   row/file that already covers the work in front of you.
3. If `.work/README.md` is missing, match the tree against **Project profiles** (bottom of this
   file). If it matches none, infer the layout from what's there and ask the user before inventing a
   new shape. **On any conflict, the project's own `README.md`/`STATUS.md` wins over this skill.**

You're updating a living record, not starting fresh — **update the existing row/file rather than
creating a duplicate.** A second file for something that already has one is the most common way this
directory rots.

## Step 1 — Classify what happened

Pick the row(s) that match the session's outcome. A focused session is one row; a rich session
(grill + plan + kickoff) is legitimately several — apply **one or more** as they fit.

| What happened | Primary action | Where (resolve exact path from README) |
|---|---|---|
| A new plan / implementation approach was decided | Create a plan doc | the plans area |
| A new task's contract/scope was nailed down | Create a spec | the specs area |
| Durable per-service / API knowledge was learned | Add/extend a research doc | the research area |
| A task made progress (phase done, decision, blocker) | Append to its running log | the task's state/verification log |
| A brand-new task is starting | Open its working folder | the active-task area (+ log + spec pointer) |
| A cross-session baton is needed | Write/append a handover | the handovers area (if the project has one) |
| A task is fully finished | Do the **wrap** (Step 4) | the archive area + `STATUS.md` |
| A reusable prompt was written | Save it | the prompts area |

After the primary action, **Step 3 (update STATUS.md) is almost always required too** — the index
must reflect the new reality.

**Ceremony dial** (don't over-document): trivial change = one line in `STATUS.md`, no new file.
Normal task = a spec + a running log. Complex task = full planner → developer → verifier trail.

## Naming — keep one task id everywhere

Pick the task's **stable id once** and reuse it verbatim across specs / plans / active / archive so
the whole task is greppable end to end. **Match the ids already in the tree** — the convention is
project-specific (read README): e.g. `issue-NN` + backend kebab slices in one project, ticket
numbers (`001a`) + dated plan slugs (`2026-06-18-<slug>`) in another.

## Step 2 — Write to the right place

General rules for every file you author or edit:

- **Convert relative dates to absolute** (`2026-06-22`, not "today"). A log read months later must be
  unambiguous.
- **Code is ground truth.** If a doc and the code disagree about what shipped, fix the doc to match
  the code — never the reverse. Note the correction in the log.
- **No fabrication.** Record only what actually happened/was verified. Mark anything unconfirmed as
  UNCONFIRMED. Never log secrets/PII.
- **Cite, don't restate.** Point to the source file, the research doc, or the commit rather than
  re-deriving facts that already live in research.

### Creating a spec
The spec is the **contract** — stable, the thing a developer builds against. Keep it to scope,
goals/non-goals, the contract (endpoints/fields/parity/acceptance criteria). Keep the volatile "how
it's going" out of it — that belongs in the task's running log. **Exactly one current spec per
task**; if scope changes, edit it, don't fork a second one.

### Creating a plan
The plan is the **how** — phases, ordering, file paths, decisions. It may churn; that's fine. Place
it in the project's plans area (some projects split it by repo, others by lifecycle `active/`+`archive/`).

### Adding research
Durable, cross-task knowledge. One file per service/topic. **Don't thin existing research.** If a
finding duplicates an existing doc, extend/dedup it rather than adding a near-twin. (Note: research
may live *inside* `.work/` or at the repo root — README says which.)

### Appending to the task's running log (`state.md` or `VERIFICATION.md`)
This is the highest-churn file and the one a future agent reads first to resume. Append a dated
bullet under a `## Log` section; update any status table at the top. Capture: what was done, what's
in progress, decisions, blockers, and the **next action** — concrete enough that someone with no
memory of the session could continue. (The file's *name* is project-specific: a free-form
`state.md`, or a structured `VERIFICATION.md` that round-trips planner → developer → verifier.)

```
- **2026-06-22** Finished Phase 4: <module> wired + unit tests green (commit abc1234).
  Next: Phase 5 (<next concrete step>).
```

### Opening a new active-task folder
Create the folder, drop the running-log file whose top **points at** the task's spec and plan (don't
copy them in), and seed the first log line.

### Handovers (projects that have a `handovers/` area)
When work crosses a session boundary and the next session needs an explicit entry point, write a
dated handover baton. Finished handovers move to `handovers/archive/`.

## Step 3 — Update `STATUS.md` (the index)

`STATUS.md` is the local Jira and the read-first file; an out-of-date index is one nobody trusts, so
update it in the same session as the work. **Conform to whatever model this project's STATUS already
uses** (learned in Step 0) — do not impose a different shape. Two common shapes:

- **Sectioned index** — items as one-line rows tagged by area (`[UI]`/`[BE]`, or
  `[APP]`/`[RESEARCH]`/`[PILLAR-A]`/`[KT]`/`[DISSERTATION]`/`[INFRA]`, …) under
  **Active / Queued / Done / Reference / Gotchas**. Move the row between sections as state changes;
  append within a section (order isn't significant).
- **Workstream tracker** — per-workstream tables with status **markers** (✅ 🟡 ☐ 🛑 ⏳ 🤔) plus a
  rollup of next actions and a gotchas section, governed by a frontmatter `update_protocol`/`last_updated`.

Whichever it is:

- **Move/flip only the item you're journaling.** Don't cascade-close sibling rows because a related
  one finished. Flip another row only if the **code** shows it done (verify — code is ground truth).
- Update the row's one-line note and the **`last_updated`/`_Last updated:_`** date.
- **Add a gotcha** when you hit a non-obvious trap a future agent would also hit; **delete a gotcha
  the moment it's fixed** — stale gotchas are worse than none.
- **Keep it short.** Push detail down into the spec/plan/log and link to it; the index is a scannable
  summary, not the record. Trim "Done" entries to a one-liner + pointer to the archived detail.
- If the project's frontmatter says the **canonical file wins over the index**, never record a status
  here you haven't grounded in that file/commit.

## Step 4 — Wrap (only when a task is fully finished)

Because git no longer cleans up, finishing a task is an ordered sequence. **Do all of it, in order** —
stopping after the move leaves the index lying; stopping after the distill leaves the active area cluttered.

0. **Log the finish first.** Append a final dated bullet to the task's running log recording
   completion (what merged, commit/parity facts, env keys, etc.) *before* you freeze the folder.
   An archived log that still says "Phase 5 next" is a lie to the next agent.
1. **Distill** anything reusable from the working notes into research (or the repo's own docs) — so
   the durable knowledge survives the archive. Extend an existing doc; don't add a near-twin.
2. **Move** the active-task folder into the archive area **intact** (`mv`, never delete — moved
   working state is the safety net).
3. **Flip `STATUS.md`**: item → Done (one-liner + pointer to the archived path), remove any gotcha
   this task closed, and **repoint any Reference/Done link** that targeted the active path to its new
   archived path (promote a doc to research only if genuinely reusable beyond this task).

## What NOT to do

- **Don't delete** working state — archive it. The only safe deletions are pure noise (`.DS_Store`,
  logs, stale zip exports), and even those need a reason.
- **Respect the project's git-safety model.** If `.work/` is **outside** the repos, don't expect a
  repo command to touch it. If `.work/` is **inside** the repo and protected by being **tracked**,
  never add it to `.gitignore`. Either way, **don't aim `git clean -fdx`** at a tree expecting it to
  spare anything ignored/untracked.
- **Don't fork a second spec** for one task, and don't duplicate a research doc — update what exists.
- **Don't bloat `STATUS.md`** with detail that belongs in a spec/plan/log.
- **Don't impose this skill's preferred layout** over the project's `README.md` — adapt to the project.

## Project profiles

Concrete shapes this skill knows. **Always defer to the live `.work/README.md`** — these are quick
recognizers, not the source of truth.

### Profile A — `study-planner-web` (single repo)
- **Location/safety:** `.work/` lives **inside** the repo at its root and is **tracked/committed on
  purpose** — `git clean -fdx` only deletes ignored/untracked files, so tracking is the protection.
  **Never gitignore `.work/`; never `git clean -fdx` at the repo root.** Reference paths as `.work/…`
  (no `../`).
- **Index:** `STATUS.md` — sectioned **Active / Queued / Done / Reference / Gotchas**, rows tagged
  `[APP]` (web app) · `[RESEARCH]` (research tier) · `[PILLAR-A]` (rigour/calibration/detection) ·
  `[KT]` (Pillar-B knowledge-tracing bench) · `[DISSERTATION]` · `[INFRA]`. Frontmatter carries
  `last_updated` + a "canonical file wins over the index" rule.
- **Folders:** `specs/{prd,issues}` (PRD + tickets `001a…017`) · `plans/{active,archive}/<YYYY-MM-DD-slug>/`
  each holding **`PLAN.md` (spec) + `VERIFICATION.md` (running log/review)** · `handovers/`
  (+ `handovers/archive/`) · `prompts/` · `archive/` (flat).
- **Running-log file:** `VERIFICATION.md` (structured planner → developer → verifier round-trip),
  inside `plans/active/<task>/`. The in-flight unit is the **plan folder**, not a top-level `active/`.
- **Research:** stays at the **repo root** in `../research/` (a Python package + `research/doc/`),
  **not** under `.work/`. STATUS points to `../research/doc/`.
- **Naming:** issues `001a…`; plans `YYYY-MM-DD-<slug>`.
- **Agents:** `CLAUDE.md` (Claude Code) + `AGENTS.md` (Codex), kept as 1:1 mirrors; rules in
  `.claude/rules/*.md` ↔ `.agents/rules/*.agents.md`.

### Profile B — merchant-onboarding (two repos)
- **Location/safety:** `.work/` at the **project root**, a sibling of `merchantonbmgmtserv` (backend)
  and `unifiedonboardnodeweb` (frontend), **outside both git worktrees on purpose** so `merge` /
  `git clean -fdx` cannot delete it. From inside a repo it is `../.work`. A sandboxed dev agent
  reaches it via that path (or a symlink the project sets up).
- **Index:** `STATUS.md` — **Active / Queued / Done / Reference / Gotchas**, rows tagged `[UI]` /
  `[BE]`.
- **Folders:** `specs/{ui,backend,mom-contract}` · `plans/{ui,backend}` (single doc, or a folder with
  `implementation-plan.md` + `phase-NN-*.md`) · `active/<task>/` with **`state.md`** · `archive/{ui,backend}/`
  · `prompts/` · `research/` **inside** `.work/`.
- **Naming:** UI `issue-NN`; backend kebab slices (`branch-b`, `s3-setup-credentials`).
- **Agents:** the `.work` guide is appended to **both** repos' agent docs.

## Quick reference — generic folder map

```
.work/
  STATUS.md          # the index — read first, keep short (model per project)
  README.md          # canonical folder map for THIS project (defer to it)
  research/  OR  ../research/   # durable knowledge base (location per project) — don't thin it
  specs/             # per-task CONTRACTS (one current spec per task)
  plans/             # the HOW (split by repo or by active/archive lifecycle)
  active task area   # running log (state.md or plans/active/<task>/VERIFICATION.md) + spec pointer
  handovers/         # cross-session batons (projects that use them)
  archive/           # finished task working-state, moved intact (never deleted)
  prompts/           # reusable prompts
```