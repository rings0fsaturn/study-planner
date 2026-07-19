---
name: update-context
description: >-
  Save the flow Codex just traced through the codebase as a persistent flow memory file, and do bounded maintenance on the code-memory index. Use whenever the user says any variant of "update context", "save what we learned", "remember this", "log this flow", "update the memory", "capture this", or signals a natural breakpoint (debugging session ending, fix shipped, "before we move on let's record this"). Also trigger proactively at the end of a substantive code-tracing task even if the user doesn't ask — surface the option to the user: "Should I run update-context to save this flow?"
---

# Update Context

Companion skill to `code-memory`. Writes flow memory files capturing how code flows from one method/class/file to another, based on what was actually explored in the current session.

## Prerequisite

`.Codex/memory/` must exist (created by `code-memory`'s `init-memory.sh`). If it doesn't, tell the user `code-memory` needs to be set up first and stop.

## What this skill does, in order

### 1. Decide whether there's a flow worth recording

Scan the current session for one of:

- A question the user asked that required tracing through 2 or more files to answer.
- A bug fix or feature implementation that touched a chain of methods.
- An explicit user instruction to capture a specific flow.

If none of these — no real tracing happened this session — skip to step 4 (maintenance only). Don't invent flows. **Hallucinated memory is worse than no memory.** If a flow is too thin to write a useful narrative about, don't write one.

### 2. Check for duplicate flows

Before writing a new file, scan existing flow file *headers* (cheap — frontmatter only, not bodies):

```bash
for f in .Codex/memory/flows/*.md; do
  head -25 "$f"; echo "---"
done
```

Look for an existing flow with the same `entrypoint` or covering the same `source_question`. If found, **update** it rather than creating a new file:

- Append new files/symbols to `related_files` and `related_symbols`.
- Increment `revisited_count`.
- Update `last_updated`.
- Add a `## Revisited <date>` section to the body with any new findings.

If two existing flows cover overlapping ground, do not silently merge them. Note in the new/updated flow that "see also: <other-slug>" and leave the merge decision to the user.

### 3. Write or update the flow file

Path: `.Codex/memory/flows/<slug>.md` where `<slug>` is short kebab-case derived from the entrypoint or question (e.g., `login-token-refresh-on-401`).

Template:

```markdown
---
slug: <kebab-case-slug>
title: <one-sentence title of the flow>
entrypoint: <what triggers this flow — HTTP route, CLI command, UI event, etc.>
related_files:
  - <path>
  - <path>
related_symbols:
  - <Class.method or function>
source_question: "<the question this flow answers, in the user's words if possible>"
last_updated: <YYYY-MM-DD>
revisited_count: 1
---

# Flow

<Narrative trace, in Codex's own words. Reference symbols as `path:line`
so a future Codex can grep `index.jsonl` to verify they still exist.
Be specific — name the methods, name the line numbers, name the files.
Avoid vague "the controller delegates to the service" — say which
controller and which service.>

# Gotchas

<Optional. Things that surprised Codex during the trace: silent defaults,
footguns, latent bugs noticed along the way. Skip the section entirely if
there are none.>

# Symbols touched

- <Symbol>: <path>:<start>-<end>
- <Symbol>: <path>:<start>-<end>
```

Do not invent sections without content. The three above are the recommended sections; the only one that's always present is `# Flow`.

### 4. Bounded maintenance pass

For files Codex *actually read this session* (not the whole index):

- If a file's index row has `"summary_provisional": true`, upgrade it now via `set-summary.py` with what Codex learned about the file's purpose.
- If a file no longer exists on disk (`test -f`), remove its row from `index.jsonl`.

Then regenerate the ToC:

```bash
python3 .Codex/hooks/regen-toc.py
```

### 5. Report back to the user

Brief summary: which flow file was written (or updated), what maintenance happened. Example:

> Saved flow `login-token-refresh-on-401` (related to `auth-middleware-error-paths`).
> Upgraded provisional summaries for 3 files. ToC regenerated.

## Things this skill does NOT do

- **Does not synthesize flows from files not actually read this session.** No making up traces from the index. If Codex didn't read it this session, it doesn't go in a flow file.
- **Does not consolidate or restructure existing flow files** unless the user explicitly asks. "Merge these flow files" or "reorganize my memory" is a separate, future operation.
- **Does not do full stale-row sweeps.** That's `gc-memory`.
- **Does not delete flow files.** Flow files survive even if the underlying code is gone — they're history, sometimes useful for understanding why something used to be the way it was.
