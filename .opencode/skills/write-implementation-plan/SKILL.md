---
name: write-implementation-plan
description: Consolidate a planning discussion into a comprehensive, agent-handoff-ready implementation plan document, written to `plans/<YYYY-MM-DD>-<slug>.md`. The plan captures everything agreed and disagreed during planning, splits the work into vertical-slice phases (each independently implementable in a fresh agent context window), and includes exact file paths, line numbers, code, tests, and verification commands per phase. Use this skill whenever the user wants to "write an implementation plan", "convert this to a plan", "spec this out for an agent to build", "write up what we decided", "create an execution plan", "turn this into a plan an agent can execute", "draft an impl plan", "write the plan", or any time a planning conversation is wrapping up and the user wants the output captured as a structured, durable, handoff-ready document. Pairs with grill-me upstream — typical flow is grill → agree → write-implementation-plan. Trigger this skill whenever a planning discussion is being formalized for handoff, even if the user doesn't say the exact phrase "implementation plan".
---

# Write Implementation Plan

This skill takes a completed planning conversation and produces a single, comprehensive plan document at `plans/<YYYY-MM-DD>-<slug>.md`. The output is engineered so that **a fresh agent — landing in a new context window with zero memory of the planning discussion — can pick up any phase and implement it correctly**. That constraint shapes every part of how the plan is written.

The skill assumes the planning has already happened (typically via `/grill-me` or organic design discussion). It does NOT re-interview the user from scratch. Its job is consolidation, codebase grounding, and structured handoff.

## When NOT to use this skill

- The conversation hasn't actually planned anything yet — there's no design to consolidate. Suggest `/grill-me` first.
- The user wants a PRD (high-level requirements, not implementation steps) — use `to-prd` instead.
- The user wants to break work into GitHub issues — use `to-issues` instead. (An impl plan and issues are complementary; the plan can be linked from an issue.)

## Workflow

The skill runs in five sequential phases. Don't skip ahead — each phase depends on the previous.

### Phase 1 — Pre-flight check

Before doing anything else:

1. **Confirm there's a planning discussion in context.** Scan the conversation. If there isn't substantive design discussion (just a user request like "build me X" with no back-and-forth), STOP and tell the user:

   > "I don't see a substantive planning discussion in our current context. I can either (a) write a skeleton plan with everything flagged as open questions, or (b) suggest you run `/grill-me` first to nail the design down, then come back. Which do you want? My recommendation is (b)."

2. **Detect the project root.** Look for `.git`, `package.json`, `pyproject.toml`, `Cargo.toml`, etc. If you can't find one, ask the user where the project lives.

3. **Check for existing plans/ directory and conventions.** If `plans/` exists, look at recent plan files for naming and formatting patterns and follow them. If a different convention is in use (e.g., `docs/rfcs/`, `proposals/`), surface that to the user: "I see this project uses `docs/rfcs/`. Should I write the plan there instead of `plans/`?"

4. **Check for existing plan with matching slug.** If a plan covering similar topic already exists in `plans/` and is not yet `✅ Complete`, ask the user: "I see `plans/2026-04-15-jwt-auth.md` exists and isn't complete. Append new phases to it, or create a v2?"

### Phase 2 — Sanity sweep

Quickly scan the conversation for *unresolved fuzziness*. The goal is to catch the obvious gaps — not to re-grill — so the plan doesn't get written with vague spots that the implementing agent will trip over.

Look for:
- Decisions waved at but not nailed ("we'll figure out caching later")
- Files mentioned but never located ("the auth handler somewhere")
- Constraints stated without numbers ("it should be fast")
- Implicit assumptions Claude made that the user never explicitly confirmed

Surface up to ~5 of the most important gaps in a single message:

> "Before I write the plan, a few things I want to pin down:
> 1. Token expiry — we discussed 15min vs 1hr but I don't think we landed. Going with 1hr unless you object.
> 2. Where does the existing auth middleware live? You said 'somewhere in the api dir' but I want to verify before writing exact file paths.
> 3. Are we adding tests in `tests/auth/` or `tests/integration/auth/`?
> 4. ...
>
> Want to resolve these now or have me record them as Open Questions in the plan?"

If the user says "just write it" — fine. Each unresolved item becomes an entry in the Open Questions section of the plan, AND any decision Claude made implicitly gets `🤔 Assumed (unconfirmed)` status in the Decisions log. Don't pretend they were resolved.

### Phase 3 — Codebase grounding

This is the most important phase. The plan's value is that the implementing agent doesn't have to re-do the discovery work that already burned context once.

For every file mentioned, implied, or that will likely be touched:

1. **Read it.** Use `view` on the actual file. For very large files (>500 lines), read the relevant sections (functions/classes that will be touched, plus surrounding context).
2. **Pinpoint exact change locations.** For each modification, identify the function/class/line range. Draft the *actual code change* — not pseudocode. The plan will inline this code.
3. **For new files, draft the full content.** Inline in the plan.
4. **Verify imports and dependencies actually exist.** If the plan will say `from auth.jwt import validate_token`, confirm `validate_token` actually exists in `auth/jwt.py` (or that it's being newly created in this same plan, in an earlier phase).
5. **Watch for contradictions.** If the conversation said "modify the `validate_token` function" and the actual code has `verify_token` instead, STOP. Tell the user:

   > "Heads up — the planning discussion referenced `validate_token` but the actual code has `verify_token` in `auth/jwt.py:23`. Want me to (a) update the plan to use the real name, (b) check whether the discussion meant something different, or (c) something else?"

   Don't silently "fix" it. Contradictions are usually where the plan was wrong, not where the code is wrong.

6. **Tests too.** For each file touched, find the corresponding test file and read it. Plan will specify what tests to add/modify per phase.

If the grounding reveals the change is much bigger than the conversation suggested (e.g., touches >15 files, or projects to >7 phases), surface it:

> "Heads up — grounding the plan, this looks like it'll touch ~22 files across 3 subsystems. That's likely too much for one plan to handle cleanly. Want me to scope this plan to just [subsystem A] and write follow-up plans for the others?"

### Phase 4 — Write the document

**Read `references/document-template.md` before writing the first plan in any session.** It is the canonical skeleton — every section, every header, every placeholder.

Generate the slug from the conversation topic in kebab-case (e.g., `jwt-auth-middleware`, `stripe-webhook-handler`). Confirm the slug with the user before writing the file.

**Filename:** `plans/YYYY-MM-DD-<slug>.md` — date is **today's date in the system** (not a hardcoded date), slug is what you and the user agreed.

**The output MUST include the contents of `assets/plan-preamble.md` verbatim at the top of the file.** This is the operating manual for the implementing agent — without it, fresh agents won't know the protocol. Read the file and paste its contents (everything between the file boundaries, not including any frontmatter the file might or might not have) as the very first content of the plan, before the title.

**Phase splitting rules** — see "Phase design" below. Vertical slices, each independently implementable in a fresh context window, soft cap at 7 phases.

**Decisions log rules** — see "Decisions log" below. Number entries D-01, D-02, etc. so phase steps can reference them.

If `plans/README.md` doesn't exist in the project (and you're creating the first plan), create it from `assets/plans-readme.md` so future humans browsing the repo understand the convention.

### Phase 5 — Present and hand off

1. Show the user where you wrote the file.
2. Ask if they want you to `git add` it (do not auto-commit).
3. Briefly summarize: "Plan has N phases. Phase 1 is X, Phase N is Y. M open questions. K decisions logged."
4. If anything was contentious or assumed, call it out: "Note: D-04 (Redis blocklist) was something I assumed — you didn't explicitly confirm. Worth a glance."

## Phase design (the load-bearing rules)

Each phase is a **vertical slice** that:

1. **Delivers an end-to-end working increment.** Not "all the data layer", then "all the API layer". The thinnest path that proves the new flow works → next thinnest slice → etc. Vertical slicing is non-negotiable — horizontal slicing defers integration risk to the end and makes phases mutually dependent in ways that break the "fresh context window" guarantee.
2. **Is independently implementable in a fresh agent context window.** A fresh agent reading just the document header (preamble through Files-touched index) plus that one phase's section must have everything needed. They should not have to read other phases' implementation details — only their *outcomes*, captured in the "Codebase state assumed at start" block.
3. **Leaves the system in a working state.** If the agent stops here, the build still passes, tests still pass, no half-wired code dangling.
4. **Is sized for one focused work session.** Roughly 1–5 files touched. If a phase grows beyond that, split it.
5. **Has runnable verification.** Not "verify the auth works" — `pytest tests/auth/test_jwt.py -v` should pass.

**Phase template (use exactly this structure for each phase):**

```markdown
## Phase N: <One-sentence goal>

**Status:** ☐ Not started
**Depends on:** Phase X, Phase Y *(or "none — can start immediately")*
**Estimated scope:** ~N files, ~M lines

### Codebase state assumed at start
- File `<path>` exists with `<function/class>` defined
- Test `<path>::<test>` is passing
- *(only the prereqs that matter for this phase — keep it tight)*

### Verification (run BEFORE starting to confirm prereqs are met)
` ` `bash
pytest tests/auth/test_jwt.py -v   # should pass
grep -r "validate_token" auth/     # should return auth/jwt.py:23
` ` `

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

### Steps

1. **Modify `<file>`, `<function/class>` (currently lines N–M):**
   ` ` `<lang>
   <actual code, not pseudocode>
   ` ` `

2. **Create new file `<path>`:**
   ` ` `<lang>
   <full file contents inline>
   ` ` `

3. *(more steps...)*

### Tests

- Add `<test path>::<test name>` — <what it covers>
- Update `<test path>::<test name>` — <what changed and why>
- Run: `<bash command>`

### Verification (DONE — run after implementation)
` ` `bash
<command>   # <expected result>
` ` `

### Rollback
<How to revert this phase. Note any data migrations or external side-effects.>

### Notes (filled in during implementation)
*(empty — implementing agent records blockers, surprises, learnings here)*
```

**Soft cap: 7 phases.** If the plan would exceed this, surface to the user and suggest splitting into multiple plans (each linked from the others' References section). The reason for the cap: a plan with 12+ phases usually means the change is too big and would benefit from being broken into separate, sequenced plans.

**Single-Phase mode:** If grounding reveals the total change is <2 files / <30 lines, skip the phase-splitting overhead — make it a single phase. The doc still has all other sections (preamble, context, decisions, etc.) — just one phase. Don't manufacture artificial phase boundaries for trivial work.

## Decisions log

Format every decision as a numbered entry with this structure:

```markdown
### D-NN: <Short title of the decision>

**Status:** <✅ Agreed | 🤔 Assumed (unconfirmed) | ⚠️ Disagreed/Deferred>

**Context:** <one or two sentences — what was being decided and why it came up>

**Decision:** <what was chosen>

**Rationale:** <why this and not the alternatives>

**Alternatives considered:**
- <option> → rejected: <reason>
- <option> → rejected: <reason>

**User pushback / disagreement:** <if any — paraphrase usually, verbatim quote (with `>` blockquote formatting) when the exact phrasing matters>

**Reversibility:** <easy / moderate / hard — and a one-liner on what would be involved>
```

**Status guidance:**
- `✅ Agreed` — user explicitly endorsed it.
- `🤔 Assumed (unconfirmed)` — Claude proposed it, user didn't object but never explicitly confirmed. Surface these in the pre-write sanity sweep so user has a chance to upgrade or push back. **Always log assumed decisions — don't omit them.** The implementing agent needs to see them so they don't accidentally treat them as firm.
- `⚠️ Disagreed/Deferred` — there was tension, or the decision was punted. Cross-reference an Open Question entry.

**Reference decisions from phase steps** like: `Step 3 implements D-04`. This makes the *why* discoverable from the implementation site without bloating each step with rationale.

## Output document anatomy

The plan document, top to bottom:

1. **Operating manual preamble** — verbatim from `assets/plan-preamble.md`. ALWAYS first.
2. **Title + metadata** — slug, date, author, plan status, links to upstream PRD/issue.
3. **TL;DR** — 3–5 sentences. Fresh agent reads just this and knows whether they're on the right plan.
4. **Context & background** — problem, prior state, constraints. Links to support docs.
5. **Decisions log** — D-01, D-02, ... with the format above.
6. **Architecture overview** — high-level shape. Mermaid diagram if useful. Keep it short — implementation details belong in phases.
7. **Files touched (index)** — flat table: `path | new/modify/delete | phase | one-line purpose`.
8. **Phases** — Phase 1, Phase 2, ... using the phase template above.
9. **Open questions** — `OQ-NN: <question>` entries. Each has: question, why deferred, what triggers needing resolution, who/how it gets resolved.
10. **Out of scope** — explicit list of things readers might *expect* but aren't included. One-line "why not now" each.
11. **References** — every external doc, ticket, RFC, library doc, related plan, etc.

See `references/document-template.md` for the full template with placeholders, and `references/examples.md` for worked examples of the trickier sections.

## Quality bar — what separates a good plan from a bad one

A good plan, when handed to a fresh agent in a new context window, lets them implement Phase N correctly *without* having to:
- Re-read the original conversation
- Re-explore the codebase to find which file something is in
- Guess at intent or re-derive rationale
- Coordinate with the human for clarifications that should've been resolved at planning time

If the implementing agent has to do any of these, the plan failed at its job. Bias toward over-specifying. Inline the code. Spell out the imports. Name the test file. Show the bash command for verification.

A bad plan reads like meeting minutes ("we discussed X, then Y, then decided Z"). A good plan reads like a runbook ("Do this. Then this. Verify with this command. Update status. Commit.").

The most common failure mode is a plan that's *correct in spirit* but skimpy on detail — it makes sense to the human and Claude who just had the planning discussion (because they have all the context in their heads), but is unimplementable by anyone else. Counteract this by mentally simulating: "If I dropped this file in front of an agent who has never seen our conversation, could they execute Phase 3 correctly with just this file and the codebase?" If the answer is no, the phase needs more detail.

## Pointers

- `assets/plan-preamble.md` — The operating manual block that goes verbatim at the top of every plan. **Read and paste into output. Do not modify per-plan** — keeping it identical across plans means agents learn the protocol once.
- `assets/plans-readme.md` — Boilerplate for `plans/README.md`, created once per project on first use.
- `references/document-template.md` — Full plan skeleton with placeholders and section-by-section guidance. Read before writing the first plan in any session.
- `references/examples.md` — Worked examples (good and bad) of decisions log entries, phase entries, verification blocks, and open questions. Read when unsure of formatting or level of detail.
