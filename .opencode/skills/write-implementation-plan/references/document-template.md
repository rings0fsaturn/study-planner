# Document template

This file is the canonical skeleton for an implementation plan. Use it as the structural reference when writing the output file.

**How to use this template:**

1. Copy the structure (all sections, all headers, in this order).
2. Replace every `<PLACEHOLDER>` with real content.
3. Paste the contents of `../assets/plan-preamble.md` verbatim at the very top of the output (above the title), then continue with the rest of this template.
4. Delete this top "How to use this template" block from the output — it's instructions for Claude, not for the implementing agent.

Sections marked `[REQUIRED]` must always be present. Sections marked `[OMIT IF EMPTY]` can be skipped if there's nothing to put in them (e.g., no open questions). Don't include empty sections with placeholder text like "TBD" — either fill them or omit them.

---

## Template starts below this line

```markdown
<!-- PASTE THE FULL CONTENTS OF assets/plan-preamble.md HERE, VERBATIM -->

---

# <Plan title — short, descriptive, sentence case>   [REQUIRED]

**Slug:** `<slug>`
**Date written:** <YYYY-MM-DD — today's date>
**Author:** Claude + <user handle / name if known, else "user">
**Plan status:** Draft
**Upstream:** <link to PRD / issue / RFC / design doc, or "none">

## TL;DR   [REQUIRED]

<3–5 sentences. What's being built, why, and the shape of the approach. A fresh agent should be able to read just this and know whether they're on the right plan. Avoid jargon that's only in the Decisions log — this section needs to stand on its own.>

## Context & background   [REQUIRED]

<What problem does this solve? What existed before? What constraints apply (perf, compat, deadline, team)? Why now? Anything the implementing agent needs to understand the *situation* before reading the *plan*.>

**Support docs:**

- <link or path to PRD>
- <link or path to design doc>
- <link or path to related issues / tickets>
- <link or path to relevant library / API documentation>
- <link or path to prior plans this builds on>

## Decisions log   [REQUIRED]

<Every meaningful decision made during planning. Numbered D-01, D-02, etc. so phase steps can reference them. See ../references/examples.md for full formatting examples (good and bad). The format below is the minimum.>

### D-01: <Short decision title>

**Status:** <✅ Agreed | 🤔 Assumed (unconfirmed) | ⚠️ Disagreed/Deferred>

**Context:** <one or two sentences — what was being decided and why it came up>

**Decision:** <what was chosen>

**Rationale:** <why this and not the alternatives>

**Alternatives considered:**

- <option> → rejected: <reason>
- <option> → rejected: <reason>

**User pushback / disagreement:** <if any — paraphrase usually, verbatim quote with `>` blockquote when phrasing matters; "none" if there was no pushback>

**Reversibility:** <easy / moderate / hard — and a one-liner on what would be involved to change later>

### D-02: <next decision>

<...>

## Architecture overview   [REQUIRED]

<High-level shape of the change. Components, data flow, key interfaces. Mermaid diagram if useful. Keep this SHORT — implementation details belong in phases. The reader of this section should walk away with a mental model of "what fits where", not a step-by-step.>

\`\`\`mermaid
<optional diagram — omit the code fence if not using mermaid>
\`\`\`

## Files touched (index)   [REQUIRED]

<Flat table of every file the plan creates/modifies/deletes. Lets a fresh agent see total scope at a glance and find the right phase for any file.>

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `auth/middleware.py` | modify | 1 | Add JWT validation step |
| `auth/blocklist.py` | new | 1 | Token blocklist using Redis |
| `tests/auth/test_middleware.py` | modify | 1 | Cover blocklist behavior |
| `...` | ... | ... | ... |

## Phases   [REQUIRED]

<Use the phase template below for each phase. Phases are vertical slices, each independently implementable in a fresh agent context window. Soft cap of 7 phases — if you'd exceed this, the plan should probably be split.>

### Phase 1: <One-sentence goal>

**Status:** ☐ Not started
**Depends on:** none — can start immediately
**Estimated scope:** ~N files, ~M lines

#### Codebase state assumed at start

<The minimal set of facts about the codebase that this phase relies on. Only list prereqs that matter for this phase. Don't restate the whole architecture — just the pieces this phase needs to be true before it starts.>

- File `<path>` exists with `<function/class>` defined
- Test `<path>::<test>` is passing
- Environment variable `<NAME>` is set

#### Verification (run BEFORE starting to confirm prereqs are met)

\`\`\`bash
<command>   # <expected result>
<command>   # <expected result>
\`\`\`

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

<Numbered, in execution order. Each step says exactly which file, exactly which function/class/line range, and contains the actual code (not pseudocode). Reference Decisions log entries inline (e.g., "implements D-04") so the *why* is one click away.>

1. **Modify `<file>`, function `<function>` (currently lines N–M):** <one-line description of the change. Implements D-NN if applicable.>

   \`\`\`<lang>
   <actual code, not pseudocode>
   \`\`\`

2. **Create new file `<path>`:**

   \`\`\`<lang>
   <full file contents inline>
   \`\`\`

3. **Add import to `<file>` (top of file):**

   \`\`\`<lang>
   <import statement>
   \`\`\`

4. *(more steps...)*

#### Tests

<For every behavior change, specify what test to add or modify. Name the test file and test function. Include the bash command to run them.>

- Add `<test path>::<test name>` — <what it covers>
- Update `<test path>::<test name>` — <what changed and why>
- Run: `<bash command>`

#### Verification (DONE — run after implementation)

\`\`\`bash
<command>   # <expected result>
<command>   # <expected result>
\`\`\`

#### Rollback

<How to revert this phase if needed. Note any data migrations, external side-effects, or cross-phase dependencies that would be affected.>

#### Notes (filled in during implementation)

<empty — implementing agent records blockers, surprises, learnings here>

---

### Phase 2: <next phase>

<...repeat the phase template...>

---

## Open questions   [OMIT IF EMPTY]

<Decisions deliberately deferred. Each is OQ-NN. If there are no open questions, omit this whole section.>

### OQ-01: <The question>

**Why deferred:** <reason>
**Triggers needing resolution:** <what makes this become urgent>
**Owner / resolution path:** <who decides, or what process resolves it>
**Cross-ref:** <decision IDs this affects, e.g., "blocks D-07 from being upgraded to ✅ Agreed">

### OQ-02: <next question>

<...>

## Out of scope   [OMIT IF EMPTY]

<Things readers might *expect* the plan to cover, but it deliberately does not. One line "why not now" each. Prevents scope creep mid-implementation. If there's nothing meaningful to call out, omit this section.>

- **<Thing>** — not in scope because <reason>. <Followup plan? Future work? Won't do?>
- **<Thing>** — not in scope because <reason>.

## References   [REQUIRED]

<Every external link, ticket, doc, library reference, related plan, etc. that the implementing agent should have available while working. The TL;DR + Context section already includes "Support docs"; this section can be more comprehensive (specific library functions, RFC sections, Stack Overflow threads, internal wiki pages, etc.).>

- <description> — <link or path>
- <description> — <link or path>
```

---

## Common mistakes to avoid

When filling in this template, watch for these failure patterns:

**Empty sections with "TBD" placeholders.** Either fill the section or omit it. "TBD" tells the implementing agent nothing and is worse than the section not existing.

**Phase sections that read like meeting minutes.** "We decided to add a blocklist check" is meeting minutes. "Modify `auth/middleware.py:34–58`, replace the function body with the following code, then run `pytest tests/auth/`" is a runbook. Aim for the latter.

**Pseudocode in step blocks.** If the step says "validate the token and check the blocklist", the implementing agent has to invent the code. Inline the actual code instead.

**Verification blocks that aren't runnable.** "Verify auth works" is not verification. `pytest tests/auth/test_jwt.py -v` is verification. Every verification block must be a copy-pasteable bash command with an explicit expected result.

**Decisions log entries with no rationale.** A bare "Decision: Use Redis" is dangerous — when the implementing agent (or a future reader) hits a snag, they'll second-guess the decision because they have nothing to push back against. Always include the why and the rejected alternatives.

**Phases that depend on each other in ways the "Codebase state assumed at start" doesn't capture.** This breaks the fresh-context-window guarantee. If Phase 4 needs Phase 2's `is_blocked()` function, the Phase 4 prereq block must say so explicitly — don't rely on the agent having read Phase 2.

**Skipping the preamble.** The verbatim preamble from `assets/plan-preamble.md` MUST be the first content of the output file, before the title. Without it, fresh agents won't know the protocol.
