---
name: opencode-agents-reformatter
description: >
  Reformat Claude Code rule/guard .md files into opencode-compatible format.
  Use this skill whenever the user wants to: migrate CLAUDE.md or rule files to
  opencode, audit AGENTS.md for stale content, split a fat AGENTS.md into
  .opencode/rules/ files with progressive disclosure, or create a lean
  AGENTS.md that references external rule files. Trigger on phrases like
  "reformat for opencode", "migrate to opencode", "optimise AGENTS.md",
  "split rules into .opencode/rules", or any mention of AGENTS.md + opencode.
---

# opencode AGENTS.md Reformatter

Convert existing rule/guard markdown files into lean opencode-compatible format
using **progressive disclosure**: fat content lives in `.opencode/rules/`, and
`AGENTS.md` holds only lightweight `@path` references with trigger descriptions.

---

## Opencode Rules Primer

| File | Purpose |
|---|---|
| `AGENTS.md` (project root) | Always-loaded context; keep under ~80 lines |
| `~/.config/opencode/AGENTS.md` | Global personal rules (not committed to git) |
| `.opencode/rules/*.md` | Domain-specific rule files; loaded on-demand via `@ref` |

**Progressive disclosure pattern:**
```
AGENTS.md          ← references only; no inline rule bodies
.opencode/
  rules/
    auth.md        ← loaded when working on auth
    storage.md     ← loaded when touching storage
    api.md         ← loaded when touching API layer
```

**Key opencode conventions:**
- `@.opencode/rules/filename.md` in AGENTS.md tells the agent to `Read` that
  file when the described domain is relevant
- Add the CRITICAL preamble to AGENTS.md so the agent knows `@ref` = Read tool
- Rule files use plain frontmatter: `name` + `description` only (drop Claude
  Code-specific fields like `type: guard`, `type: instruction`, etc.)
- Commit `AGENTS.md` and `.opencode/rules/` to git — they're team-shared

---

## Workflow

### Step 1 — Audit for stale content

For each rule file, check:
- **Frontmatter fields** — remove any `type:` field (Claude Code artifact; not
  used by opencode). Keep `name` and `description`.
- **Library/framework versions** — flag anything pinned to a version that may
  have breaking changes (e.g. a Dexie v2 pattern in a v4 codebase).
- **Deprecated APIs** — remove or update patterns referencing APIs no longer
  current in the target stack.
- **Duplicated guidance** — if a section merely restates the rule already shown
  in a code example, remove the prose version.
- **"Incorrect" code blocks** — keep only if they show a non-obvious anti-pattern;
  remove if they just invert what the correct example already shows.

### Step 2 — Reformat the rule file

Target: `.opencode/rules/<slug>.md`

```markdown
---
name: <slug>
description: <one-line summary>
---

# <Title>

## Rule
<imperative statement of the rule — max 2 sentences>

<correct code example — trimmed to the essential pattern>

**Never do this:**
<anti-pattern snippet — only if non-obvious>

## Why / Comparison table (optional)
<keep if it genuinely aids decision-making>

## Architecture (optional)
<component responsibility table — keep if multiple components interact>

## Checklist
- [ ] item
...

## When to Apply
<bullet list of triggers>
```

**Line budget:** aim for 40–70 lines. If a rule file exceeds 100 lines, look
for sections to extract into a sub-reference or collapse into a table.

### Step 3 — Update AGENTS.md

If `AGENTS.md` doesn't exist yet, create it with this shell:

```markdown
# AGENTS.md

> CRITICAL: File references below use `@path` notation. When you encounter one,
> use your Read tool to load it **on a need-to-know basis** — only when the task
> at hand is directly related to that domain.

---

## <Domain Group>

- `@.opencode/rules/<slug>.md` — Read when <2–3 word trigger list>.
  <One sentence on what the rule covers.>
```

If `AGENTS.md` already exists, append a new entry under the appropriate domain
group heading (or create a new heading). Never inline rule body content into
`AGENTS.md` itself.

**AGENTS.md line budget:** under 80 lines total. If it grows beyond that,
move any inline guidance into a new `.opencode/rules/` file and replace with
a `@ref` entry.

### Step 4 — Output

Present two files to the user:
1. `.opencode/rules/<slug>.md` — the reformatted rule
2. `AGENTS.md` — updated with the new `@ref` entry

Summarise what was changed:
- Removed fields / sections (and why)
- Any stale content found and how it was handled
- Line count before → after for the rule file

---

## Example: Before / After

**Before** (Claude Code guard, 71 lines):
```
---
name: eventstore-per-user-db
description: Prevent cross-account data bleed...
type: guard          ← Claude Code only, remove
---
[full rule body inline in one file]
```

**After**:
- `.opencode/rules/eventstore-per-user-db.md` — 58 lines, `type: guard` removed,
  redundant "Incorrect" block condensed to a 2-line comment pair
- `AGENTS.md` — 12 lines, single `@ref` entry under `## Storage & Auth`

---

## Checklist for Claude

- [ ] Frontmatter: `name` + `description` only — strip `type:`, `tags:`, etc.
- [ ] Stale API/version patterns flagged or updated
- [ ] "Incorrect" block kept only if non-obvious anti-pattern
- [ ] Rule file within 40–70 line target
- [ ] AGENTS.md has CRITICAL `@ref` preamble
- [ ] AGENTS.md entry includes domain trigger keywords
- [ ] AGENTS.md stays under 80 lines total
- [ ] Both files presented to user for download
