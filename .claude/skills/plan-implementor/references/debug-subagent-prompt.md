# Debug Subagent Prompt Template

When a test fails in a non-trivial way during plan implementation, spawn a debug subagent with the prompt below. The subagent uses the `debug-session` skill (if available) to investigate systematically and returns a structured fix.

## Spawning

Use your environment's subagent mechanism (Task tool in Claude Code, etc.). The subagent should have access to the same codebase view and the same skills (especially `debug-session`) that the main agent does.

Fill in every `<PLACEHOLDER>` with concrete content before sending. Don't send the template with placeholders unfilled — the subagent's quality depends on context quality.

---

## Prompt template (copy from below this line)

You are a debug subagent. The main agent is implementing a plan and hit a test failure. Your job is to perform systematic debugging using the `debug-session` skill (read it first if you haven't), determine the root cause, and return a precise fix in the format specified at the end of this prompt.

You do NOT apply the fix. You investigate and propose. The main agent applies the fix and re-runs the test.

## Plan context

- **Plan file:** `<path, e.g., plans/2026-04-29-jwt-auth.md>`
- **Phase being implemented:** Phase `<N>`: `<phase title>`
- **Step that was just applied:** Step `<step number>` — `<one-line description>`

## What was supposed to happen

`<paste the relevant entry from the phase's "Tests" section — which test, what behavior it verifies>`

## What actually happened

**Test command run:**

```
<exact command, e.g., pytest tests/auth/test_middleware.py::test_blocklisted_token_rejected -v>
```

**Output:**

```
<paste the full test output, including stack trace>
```

## Files recently changed

These are the files modified in the most recent `wip` checkpoint commit. The bug is most likely in here:

```
<output of `git diff HEAD~1 HEAD --stat` or equivalent>
```

If the diff is small (under ~100 lines total), paste it inline:

```
<git diff HEAD~1 HEAD>
```

## Decisions to be aware of

These are the decisions from the plan's Decisions log that pertain to the changed code. Respect them — do not propose fixes that contradict these.

`<paste the relevant D-NN entries verbatim from the plan>`

## Relevant code locations

The main agent suggests starting your investigation here, but feel free to explore further:

- `<file:line>` — `<why it's relevant>`
- `<file:line>` — `<why it's relevant>`

## Your task

1. Read the `debug-session` skill (if available) and follow its methodology.
2. Read the failing test, the production code under test, and any related code.
3. Identify the root cause — be specific (file + line + what's wrong).
4. Propose a precise fix (exact code).
5. Return your findings in the format specified below. Do not deviate from this format — the main agent parses these sections mechanically.

## Required return format

Return a Markdown document with these sections, exactly:

### RCA

`<2–5 sentences explaining what's actually wrong and why. Focus on the cause, not the symptom.>`

### Root cause location

- **File:** `<path>`
- **Line(s):** `<range or specific line>`

### Detailed fix

For each file that needs to change, list separately:

**File:** `<path>`
**Change:** `<modify lines N–M / add new function / etc.>`
**Code:**

```<lang>
<exact code to apply — what the file should look like after the fix, for the changed region>
```

If multiple files need changes, repeat the block for each.

### Confidence

`<high | medium | low>` — `<one-sentence justification>`

- **high:** I'm confident the RCA is correct and the fix will resolve the failure.
- **medium:** RCA is plausible but I see other possible interpretations; fix should work but verify.
- **low:** Investigation was inconclusive; this is my best guess. Main agent should surface to user before applying.

### Caveats

`<anything else the main agent should know — side effects, related code that might also need attention, alternative interpretations of the bug, etc. "None" if nothing.>`

### Did NOT investigate

`<if you noticed potentially related issues but deliberately scoped your investigation to the failing test, list them here so the main agent / human can decide whether to follow up. "None" if nothing.>`

---

End of prompt.

---

## Why this format

- **Plan + Phase + Step context** — orients the subagent fast; they don't have to read the whole plan to understand what was being attempted.
- **Test command + output** — gives them the exact failure to reproduce mentally; no ambiguity about what's failing.
- **Files recently changed** — narrows the search space; the bug is usually in or near recent changes.
- **Decisions to be aware of** — prevents the subagent from "fixing" something that was deliberately decided. Without this, a debug subagent might propose reverting D-04 because it caused the failure, when the actual bug is in the *implementation* of D-04.
- **Required return format** — structured so the main agent can parse and apply mechanically. The Confidence field tells the main agent whether to apply directly or surface to user. Caveats and "Did NOT investigate" surface potential follow-ups without expanding scope of the current cycle.
- **Do NOT apply the fix** — separation of investigation and application keeps the loop clean. The main agent has the broader context (other phases, the plan as a whole) and decides whether to act on the proposal.
