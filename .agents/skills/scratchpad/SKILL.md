---
name: scratchpad
description: "Maintain SCRATCHPAD.md — the living working-memory dashboard inside a .work/ active task — so long or multi-session work survives context compaction without losing its thread. The doc an agent reads to reconstitute its head after compaction or a new session, and rewrites continuously as it works. READ it at session start and whenever you've lost the thread — 'where were we', 'pick up where we left off', 'what's the status', 'let's realign', 'review the task', or any time you're resuming a .work/-managed task and can't account for the plan position, open blockers, and recent decisions from memory. WRITE/UPDATE it after any decision, blocker, deferral, task-state change, or checklist step — 'update the scratchpad', 'context dump', 'checkpoint this', 'capture where we are'. Reach for it on long sessions and possible-compaction moments EVEN IF the user didn't name it. Anti-scope: LIVE in-session scratchpad only; end-of-task distill/archive/STATUS-flip belongs to work-journal."
---

# Scratchpad — the working-memory dashboard for a `.work/` active task

`SCRATCHPAD.md` is the **living snapshot of an agent's complete current working context** for one active
task. It exists to defeat one specific failure: **context compaction**. Your durable records
(`STATUS.md`, specs, plans, the running log, `research/`) are files on disk — compaction can't touch
them. What compaction *does* destroy is the in-flight reasoning that only ever lived in the context
window: *I'm halfway through phase 3, I decided two turns ago to use X, I'm blocked on Y, I still need
to verify Z.* The scratchpad externalizes exactly that volatile layer so it can be reloaded.

Two files sit in the active-task folder and they are **not** the same job:

| File | Shape | You read | You write |
|---|---|---|---|
| running log (`state.md` / `VERIFICATION.md`) | **diary** — append-only, chronological history | the tail | append, never rewrite |
| `SCRATCHPAD.md` | **dashboard** — living snapshot of *now*, overwritten in place | the whole thing | rewrite continuously |

The log answers *"what happened over time?"*. The scratchpad answers *"where exactly am I right now,
and what is my full mental context?"* — which is what an append-log can't restore, because the tail is
not the whole picture. Because the log preserves history, the scratchpad is free to be overwritten
without losing anything.

**Do not fold the scratchpad into the running log, `STATUS.md`, or a spec.** A second file for
something that already has one is how `.work/` rots — but these are genuinely different files with
different update disciplines, not duplicates. Keep the seam sharp: history → log; current picture →
scratchpad.

---

## Step 0 — Orient first (always, before reading or writing)

The `.work/` layout is **not the same in every project**, so resolve it from the project, never
hardcode it. This mirrors `work-journal`'s Step 0 on purpose, so both skills agree about the tree.

1. **Read `.work/README.md`** — the canonical folder map for *this* project. Resolve two things:
   - where the **active-task unit** lives (e.g. `active/<task>/`, or `plans/active/<task>/`), and
   - the **running-log filename** (`state.md` vs `VERIFICATION.md`).
2. **Read `.work/STATUS.md`** — the read-first index; find the row/task you're working on and its
   pointer into the active area.
3. On any conflict, **the project's own `README.md`/`STATUS.md` wins over this skill.**

The scratchpad's filename is fixed: **`SCRATCHPAD.md`**, placed **inside the resolved active-task
unit, beside the running log** (uppercase to match the read-first prominence of `STATUS.md` /
`VERIFICATION.md`, unless the project has a strong lowercase convention — then match it).

**Guard:** if you cannot resolve an active-task unit at all (no `.work/`, or no active task), do **not**
invent a location and drop a scratchpad somewhere arbitrary. Surface that and ask the user, the same
way `work-journal` asks before inventing a new shape.

---

## Reading the scratchpad (the payoff side)

The whole value is here. Don't try to *detect* compaction — an agent usually can't tell it was just
compacted. Bind the read to observable state instead:

- **Session start:** before touching task work, read `SCRATCHPAD.md` **in full**. This is the opening
  ritual — it loads your context for the session.
- **Mid-session self-rescue:** before acting on the task, if you **cannot account for the current
  plan position, the open blockers, and the recent decisions from your own working memory**, re-read
  the scratchpad first. Compaction manifests as exactly that thin-context feeling, so this fires
  precisely when it's needed — no compaction signal required.
- **Self-location:** the scratchpad names its own task, plan, and log at the top, and `STATUS.md` /
  the running log point to it — so if you're lost, you can find the scratchpad from any durable anchor
  still in context.

If the scratchpad doesn't exist yet, go to **Bootstrapping** below before reading.

---

## The structure — nine sections, most-load-bearing first

Order matters: a freshly-compacted agent reads top-down, so the context it needs first sits at the
top. Use this exact template.

```markdown
# Scratchpad — <task-id>
_Plan: <path> · Log: <state.md|VERIFICATION.md> · Updated: <YYYY-MM-DDThh:mm>_

## Now
<current plan + phase, and the one thing being worked on right this moment>

## Alignment
<is current work still matching the plan? note any drift, scope change, or "still on track">

## Open
<pending decisions, open questions, unknowns blocking clean progress — each with enough context to act>

## Blockers
<ACTIVE only. each: what's blocked · on what · unblock path if known>

## Deferrals
<consciously postponed. each: what · why · trigger to revisit>

## Checklist
<working to-do for the current phase. [x] done / [ ] pending — "what's left" at a glance>

## In-flight edits
<files/changes touched but unfinished or unverified, so a reload knows what's half-done>

## Decisions in force
<load-bearing decisions still GOVERNING current work. NOT a full changelog — history lives in the log>

## Resolved (recent)
<recently closed items, kept briefly for continuity, pruned as they age out>
```

**Why this order:** `Now` + `Alignment` are what a compacted agent needs first to re-anchor. The
middle block (`Open` / `Blockers` / `Deferrals` / `Checklist`) is the actionable working set.
`In-flight edits` prevents the "did I already change that file?" hazard on reload. `Decisions in
force` is deliberately *only* the decisions still constraining current work — keeping it a changelog
is how it starts duplicating the running log. `Resolved` is the stickiness graveyard (see below), kept
short.

Empty sections are fine — keep the heading with a short `— none` so the reader knows it was
considered, not forgotten.

---

## Updating the scratchpad (keeping it current AND complete)

**Update at natural checkpoints, not at "compaction time."** Compaction is unpredictable; if you wait
for it you'll lose the race. Instead rewrite the scratchpad immediately after any of:

- a decision made, or a decision reversed;
- a blocker hit, or a blocker cleared;
- a deferral (something consciously postponed);
- a task-state change (phase started/finished, scope shift, realignment);
- a checklist item completed;
- an edit started or finished on a file.

The invariant: **the scratchpad is never more than one meaningful event stale.** Then *whenever*
compaction lands, the latest version is already a faithful snapshot. Bump the `Updated:` timestamp on
every rewrite.

**Stickiness — no silent drops.** An overwrite may reorganize and compress, but it may **not** make an
unresolved item vanish. Open items (blockers, deferrals, open decisions) persist across rewrites until
**explicitly resolved**. Resolving means moving the item to `Resolved (recent)` with its outcome noted
— never just deleting it. This rule is what stops an overwrite-in-place doc from quietly amnesia-ing
itself, which is the single biggest failure mode for a living-snapshot file.

**Compress, don't accumulate.** The scratchpad is a dashboard, not a log — if a section is growing
into a history, that history belongs in the running log; leave only the currently-load-bearing subset
here. When in doubt about whether something is durable, write the durable version to the log/research
and keep the scratchpad pointer short.

---

## Bootstrapping — when no scratchpad exists yet

A brand-new task, or an older active task that predates this skill, won't have a `SCRATCHPAD.md`.
Create it on first need — **seeded, never blank.** An empty scratchpad is worse than none: the agent
reads nothing useful, learns to skip it, and the habit dies.

1. After Step 0 resolves the active-task unit, create `SCRATCHPAD.md` there from the template above,
   with the header filled in (task-id, plan path, resolved running-log name, timestamp).
2. **Seed it from the durable files already present:**
   - `Now` / `Alignment` ← current phase from the plan doc;
   - `Open` / `Decisions in force` / `Checklist` ← recent decisions and the next-action from the tail
     of the running log;
   - `Blockers` ← any open gotchas in `STATUS.md` relevant to this task.
3. Only mark as fact what the durable files actually say. If something's inferred, note it as such
   rather than inventing state (**no fabrication** — same rule as `work-journal`).

The first read should already reflect reality, demonstrating the doc's job immediately.

---

## Completion — reconcile before the wrap, then archive intact

The scratchpad is **working state, not a durable artifact.** It is the thing you distill *from*, not a
thing you promote *into* the durable store. `work-journal` still owns the wrap mechanics (distill →
`mv` to `archive/` → flip `STATUS.md`) — do **not** duplicate that logic here, so the two skills never
fight over `STATUS.md`.

This skill's one completion obligation is a **reconciliation pass, run *before* the wrap:**

- Walk `Decisions in force`, any unresolved `Deferrals`, and any durable lesson in the scratchpad.
- Confirm each already has a home in the right durable file — a final dated line in the running log, a
  `research/` doc, or a `STATUS.md` gotcha. Anything that lives **only** in the scratchpad, push there
  first.
- Then let the scratchpad **ride into `archive/` with the task folder, intact** (`mv`, never deleted —
  matches `.work/`'s archive-don't-delete invariant). Don't promote it into `research/`; it's a
  snapshot, not durable knowledge.

The reconciliation pass exists to kill the exact failure this whole skill prevents: a blocker or
decision that lived only on the whiteboard getting archived into oblivion because nobody copied it
into the durable record.

---

## What NOT to do

- **Don't hardcode `.work/active/<task>/` or assume `state.md`.** Resolve the layout in Step 0; other
  projects use `plans/active/<task>/` and `VERIFICATION.md`.
- **Don't turn the scratchpad into a second diary.** Chronological history → running log. The
  scratchpad holds only the *currently load-bearing* picture.
- **Don't silently drop an open item on rewrite.** Move it to `Resolved` with an outcome, or it stays.
- **Don't wait for a compaction signal to update or re-read.** Tie updates to events you control and
  reads to whether you actually have the context you should.
- **Don't own the wrap.** Distill/archive/STATUS-flip is `work-journal`'s job; do the reconciliation
  pass and hand off.
- **Don't create a scratchpad outside a real `.work/` active task.** If no active unit resolves, ask.
- **Don't fabricate state when seeding.** Only record what the durable files actually say; mark
  inferences as inferences.
