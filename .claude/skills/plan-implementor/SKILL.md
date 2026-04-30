---
name: plan-implementor
description: Execute an implementation plan written by write-implementation-plan (or compatible plan format), one phase at a time, using TDD discipline (via the tdd skill) and automatically escalating to a debug subagent (using the debug-session skill) when tests fail in non-trivial ways. Strictly faithful to the plan — does not skip phases, does not improvise on decisions, stops and surfaces to human when reality contradicts the plan. Use this skill whenever the user wants to "implement the plan", "execute the plan", "work the plan", "pick up the plan", "do the next phase", "start the implementation", "continue the build", "implement phase N", or has a plan file in plans/ that they want acted upon. Trigger this skill when the user references a plan file and asks for any kind of implementation work on it, even if they don't say the exact phrase "implement the plan". Pairs downstream of write-implementation-plan in the typical workflow: grill → plan → implement.
---

# Plan Implementor

This skill executes an implementation plan, phase by phase, with TDD discipline and automatic debug escalation. It assumes:

- The plan was written by `write-implementation-plan` (or follows the same format) — operating-manual preamble at top, numbered phases with status markers, decisions log, files-touched index, per-phase verification blocks, etc.
- A `tdd` skill is available for test-first methodology.
- A `debug-session` skill is available for systematic debugging of test failures.

If `tdd` or `debug-session` are not available, this skill still runs but does the TDD / debugging inline, and flags the missing skill(s) to the user once at the start.

The plan's operating-manual preamble is the contract. This skill operationalizes that contract — every "do this", "don't do this", and status-update rule comes from there. **Read the preamble of the target plan in full before doing anything else.** It is your protocol.

## When NOT to use this skill

- The user wants to write a plan, not execute one — use `write-implementation-plan` instead.
- The plan file is in a non-standard format and lacks phase markers / status / verification blocks. The skill needs that structure to work.
- The user wants to make a quick code change unrelated to any plan — just do the work directly without invoking this skill.

## Workflow

The skill processes ONE phase at a time by default. Each phase goes through the lifecycle below — don't skip steps. If the user explicitly asks for batch execution ("implement all remaining phases"), repeat the lifecycle for each phase in sequence, surfacing between phases only if there's a notable surprise or deviation.

### Step 1 — Locate the plan and verify supporting skills

1. **Find the plan file.** If the user named it, use that. Otherwise scan `plans/` (or detected equivalent like `docs/rfcs/`). If exactly one plan exists with at least one `☐ Not started` phase, default to that. If multiple, ask the user which.

2. **Verify supporting skills exist.** Check `available_skills` (or your environment's equivalent). If `tdd` or `debug-session` are missing, tell the user once:

   > "Note: I don't see the `tdd` skill — I'll do test-first manually. The `debug-session` skill is also missing — I'll debug failures inline instead of spawning a subagent. Continuing with the plan."

   Don't refuse to run because of missing skills. The user can install them later if they want stronger guarantees.

3. **Check git state.** If there are uncommitted changes, ask the user before starting:

   > "There are uncommitted changes in the working tree. Commit them first, stash them, or proceed anyway?"

   Don't auto-stash or auto-commit — that surprises users and can lose work.

### Step 2 — Read the plan header

Read the full document, top to bottom. Read the *header* sections deeply (you'll be acting on them throughout):

- **Operating-manual preamble** — your protocol. Follow it exactly.
- **Title + metadata** — orient yourself on what's being built.
- **TL;DR** — the 30-second summary of what this plan does.
- **Context & background** — why the change exists.
- **Decisions log** — read every D-NN in full. Phase steps will reference these. The decisions explain choices that may otherwise look arbitrary; respecting them is non-negotiable.
- **Architecture overview** — mental model of how pieces fit.
- **Files touched index** — what's in scope.

For phases, read enough to identify:

- Which are `✅ Complete` (their outcomes are now part of "codebase state")
- Which are `🟡 In progress` or `🛑 Blocked` from a prior session (anomalies — surface to user before starting new work)
- Which is the next `☐ Not started` whose `Depends on:` phases are all `✅ Complete`

### Step 3 — Determine the target phase

**Default behavior:** the first `☐ Not started` phase whose dependencies are all `✅ Complete`.

**If the user specified a phase number:** use that, but verify dependencies first. If a dep isn't complete, tell the user and ask whether to do the dep first or proceed anyway. Don't override the dep order silently.

**If a phase is `🟡 In progress` or `🛑 Blocked` from a prior session:** surface that BEFORE starting anything new. Example:

> "I see Phase 3 is `🛑 Blocked: refresh token rotation test failing after one debug cycle` from a prior session. Want me to resume Phase 3 (re-run the failing tests, try a different angle), or skip it and start Phase 4 if its deps are still met?"

**If no phase qualifies** (everything complete, or everything blocked on unmet deps): surface to user and stop.

### Step 4 — Run prereq verification

Read the target phase's "Verification (run BEFORE starting)" block. Run every command. For each:

- Pass → continue
- Fail → STOP. Surface to user with the exact command and output. Do NOT proceed.

The plan said "STOP" for a reason — the codebase isn't in the state this phase expects. Possible causes: a prior phase didn't fully complete (status marker drift), someone made changes outside the plan, the plan is wrong about prereqs. The user decides which.

### Step 5 — Update phase status to In progress, commit

1. Edit the plan file: change the phase's `Status:` from `☐ Not started` to `🟡 In progress`.
2. Commit the plan file alone with message: `Phase N: starting (status: in progress)`.

This boundary commit signals to anyone watching the repo that work has started, and is useful for `git bisect` later.

### Step 6 — Implement the phase using TDD

Read the phase's "Steps" and "Tests" sections together. Steps describe code changes; Tests describe what tests to add/update. The Decisions log entries referenced inside steps (e.g., "implements D-04") give the *why* — read those decision entries before applying the step.

**TDD ordering** — if `tdd` skill is available, invoke it for guidance. Otherwise apply this manually:

For each test listed in the phase's "Tests" section:

1. **Write the test first.** Implement the test per its description. The test should fail because the production code change hasn't been made yet.

2. **Run the test. Confirm it fails.** If it passes already, that's a signal — either the test isn't testing what it claims to test, or the change is somehow already in place. Investigate before continuing.

3. **Apply the relevant Step(s) from the phase.** Make the production code change. **Use the exact code from the plan — do not paraphrase or "improve" it.** If the plan says replace lines 34–58 with this code block, do exactly that. The plan author had reasons; you don't know them all.

4. **Run the test. Confirm it passes.**

5. **If it fails — go to Step 7 (debug escalation).**

6. **Move to the next test → repeat.**

For non-behavioral steps (adding imports, formatting, pure refactors with no test surface): just apply them, no test cycle needed.

**While implementing — STOP conditions** (these come from the plan's preamble; following them is the difference between a faithful implementor and a runaway agent):

- **Reality doesn't match the step** (file doesn't exist, function signature differs, line numbers are off, current code looks different from what the plan implies). STOP. Surface to user. Don't improvise.
- **A Decision (D-NN) seems wrong in light of the code.** STOP. Surface to user. Do not silently re-decide.
- **A step references something that should have been done in an earlier completed phase but isn't actually there.** The earlier phase's status marker may have lied (drift). Run the earlier phase's "Verification (DONE)" commands; if they fail, the marker is wrong. Surface to user.

### Step 7 — Debug escalation when tests fail

When a test fails after applying its corresponding Step, decide: trivial fix or escalate?

**Fix inline (no subagent) when ALL of these hold:**
- The error message + your knowledge of the codebase make the cause and fix immediately obvious
- The fix is one or two lines
- It's clearly a mechanical issue (typo, missed import, missing logger setup, off-by-one in a literal where the right value is obvious from surrounding context)

**Escalate to a debug subagent when ANY of these hold:**
- The assertion failure doesn't match expectation and root cause is unclear
- The error points to code you didn't change recently
- Behavior diverges from the spec but you're not sure why
- You'd need to read more than the failing test + the changed file to figure it out
- The issue might involve more than one cause (multiple things wrong)

**Bias toward escalating.** The cost of an unnecessary subagent is lower than the cost of papering over a real bug.

**Escalation procedure:**

1. **Commit the current state as a checkpoint**, even though tests fail:
   ```
   git add -A
   git commit -m "wip(Phase N): debug checkpoint — <which test> failing"
   ```
   This gives the debug subagent a clean reference point and makes revert trivial. Do NOT update the plan status — it's still `🟡 In progress`.

2. **Spawn a debug subagent** using your environment's subagent mechanism (Task tool in Claude Code, etc.). Use the prompt template at `references/debug-subagent-prompt.md` — fill in plan path, phase, step, test command, output, recent diff, and relevant decisions. Instruct the subagent to use the `debug-session` skill (if available).

3. **Wait for the subagent to return** with:
   - **RCA** — what's actually wrong
   - **Root cause location** — file + line(s)
   - **Detailed fix** — exact code change
   - **Confidence** — high / medium / low
   - **Caveats** — anything else to know
   - **Did NOT investigate** — potentially related issues the subagent deliberately scoped out

4. **Apply the fix.**
   - **Confidence high:** apply directly, then re-run the test.
   - **Confidence medium or low:** surface the RCA + proposed fix to the user before applying. They may want to inspect first.

5. **Re-run the failing test.**
   - **Pass** → great. Add the RCA + fix summary to the phase's "Notes (filled in during implementation)" block (one paragraph). Continue with the rest of the phase.
   - **Fail again** → DO NOT spawn another subagent. Surface to user with: original failure, subagent's RCA + fix, why the fix didn't work, your hypothesis if any. Update plan status to `🛑 Blocked: <one-line reason>` and commit. Let the user decide next steps.

   **Why no recursive escalation:** recursive subagents are expensive and usually indicate the issue is deeper than a single debugging cycle can resolve. The user's judgment is the right next step.

### Step 8 — Run phase post-verification

After all steps applied and all phase tests passing, run the phase's "Verification (DONE)" block. Every command must pass. If any fail:

- Treat as a debug escalation case (Step 7).
- A failure here usually means a step was incomplete or a side-effect was missed.

### Step 9 — Update phase status to Complete and commit

Awkward-but-necessary commit dance (the sha needs to live inside the plan file, but you can't know the sha until after committing):

1. Edit the plan file: change `🟡 In progress` to `✅ Complete — pending`.
2. Add anything substantial to the "Notes (filled in during implementation)" block — surprises, deviations (with reasons), debug RCAs from subagents, learnings.
3. `git add` the code changes AND the plan file.
4. Commit with message: `Phase N: <phase title>` (with longer body referencing the plan file, e.g., `See plans/2026-04-29-jwt-auth.md`).
5. Get the commit sha: `git rev-parse HEAD`.
6. Edit the plan file again: replace `pending` with the actual sha.
7. `git commit --amend --no-edit` to fold the sha update into the same commit.

The end result is one commit containing the code + the plan with the correct sha referencing itself.

### Step 10 — Surface to user, ask about next phase

Tell the user concisely:

- **What's done:** "Phase N complete (commit `abc1234`)."
- **Anything notable:** deviations, debug subagent invocations, surprises (just one or two sentences each).
- **What's next:** "Phase N+1 is ready (deps met)" / "Phase N+1 still blocked on Phase X" / "All phases complete."
- **Ask:** "Continue with Phase N+1, or stop here?"

Default to stopping unless the user said upfront "implement all phases" or similar. Per-phase surfacing is usually the right cadence — gives the user a chance to course-correct before the next phase starts.

## Fidelity rules — what NOT to do

These come from the plan's operating-manual preamble. They're easy to violate when an agent is "trying to be helpful" — reinforced here because they're load-bearing:

- **Do not skip phases.** Even if phase N+1 looks easier or more interesting.
- **Do not implement multiple phases without surfacing for review** between them, unless explicitly asked upfront.
- **Do not modify the Decisions log, the preamble, the TL;DR, the architecture overview, the files-touched index, the open questions, the out-of-scope, or the references.** Those are immutable. If you find a decision is wrong, surface to the human.
- **Do not paraphrase the code in Steps blocks.** If the plan says `validate_token(token)`, don't change it to `validate_token(token=token)` or "improve" it. Use exactly what's there.
- **Do not re-architect.** If something feels structurally wrong, surface — don't restructure.
- **Do not silently fix discrepancies between plan and code.** Stop, surface, ask.

## Plan-update commit conventions

| Moment | Message | What's in the commit |
|--------|---------|----------------------|
| Phase start | `Phase N: starting (status: in progress)` | plan file only |
| Debug checkpoint | `wip(Phase N): debug checkpoint — <test> failing` | code only; plan still says In progress |
| Phase complete | `Phase N: <phase title>` | code + plan file together; sha amended in via `commit --amend --no-edit` |
| Phase blocked | `Phase N: blocked — <one-line reason>` | plan file with `🛑 Blocked: <reason>` and notes block filled in; usually code from the most recent wip checkpoint is already committed separately |

## Notes block usage

The phase's "Notes (filled in during implementation)" block accumulates real-world context. Add to it whenever:

- You escalated to a debug subagent — record a one-paragraph RCA + fix summary.
- You found a surprise (something not in the plan but relevant).
- You deviated from the plan in any way — with the reason. If the deviation was significant, also surface to user in your phase-complete message.
- Something took notably longer or required unexpected work.

These notes become institutional knowledge. The next person reading this plan in 6 months — possibly a fresh agent debugging a related issue — will thank you.

## Pointers

- `references/debug-subagent-prompt.md` — the exact prompt template to spawn the debug subagent. Includes the structured-return contract.
- `references/examples.md` — worked scenarios: clean execution, prereq failure, debug escalation success, escalation that failed (handed to human), plan/code contradiction, trivial inline fix.
