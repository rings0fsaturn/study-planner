---
name: code-memory
description: >-
  Maintain and consult a persistent per-repo memory index of code Codex has already explored, to avoid re-reading the same files across sessions in Codex. Use this skill at the start of ANY code exploration, debugging, tracing, or "how does X work" task in a repo — even if the user doesn't mention memory, an index, or prior sessions. Trigger whenever Codex is about to read source files to understand a codebase: questions like "how does login work", "where is X handled", "trace the flow of Y", "fix the bug in Z", or any task that would normally involve grep plus multiple Read calls. The skill installs a hook on first use that auto-indexes files as they're read, and provides a small Table of Contents that Codex consults before exploring so it doesn't re-explore what's already known.
---

# Code Memory

A per-repo memory system that prevents re-exploration of code across Codex sessions. The index is agent-only — humans don't read it.

## What this skill provides

Three on-disk artifacts under `.codex/memory/`:

- **`toc.md`** — a compact map of every indexed file (path + one-line summary), plus a list of flow files. Loaded at the start of every exploration task. This is the map.
- **`index.jsonl`** — one row per indexed file: hash, symbols with line ranges, summary, flags. Never read wholesale; queried per file via `grep`.
- **`flows/<slug>.md`** — narrative traces of how code flows from one method/class/file to another. Written by the `update-context` skill, read here.

A `PostToolUse` hook on `Bash` and `apply_patch` maintains `index.jsonl` and
`toc.md` automatically for common shell reads such as `cat`, `sed`, `nl`,
`head`, and `tail`, plus files changed through Codex patch edits. **The
file-and-symbol index is maintained by the hook, not by Codex.**
Codex's job is to *consult* the memory and to write *flow* memory (via the
separate `update-context` skill).

## First use in a repo

If `.codex/memory/` does not exist, run the setup once before doing anything else:

```bash
bash scripts/init-memory.sh
```

This creates the memory directory, registers the hook inline in
`.codex/config.toml`, adds `.codex/memory/` to `.gitignore`, copies the worker
scripts to `.codex/hooks/`, and verifies `universal-ctags` and `python3` are
installed (errors with install instructions if not). If a legacy
`.claude/memory/` directory exists and `.codex/memory/` does not, the script
copies the existing index and flow files instead of starting from an empty Codex
memory.

If the script reports dependency errors, install the missing tools and re-run. The script is idempotent and safe to run repeatedly.

## The consumption ritual — do this on every exploration task

### 1. Read `toc.md` at the start of the task

```bash
cat .codex/memory/toc.md
```

This is small and cheap. Read it once at the start of any task that involves understanding code Codex didn't write in this session.

- If `toc.md` is in **flat mode** (lists files directly): scan it for files relevant to the task.
- If `toc.md` is in **directory-index mode** (lists directories with counts and per-directory ToC paths): identify the relevant top-level directories for the task, then read their per-directory ToCs:

```bash
cat .codex/memory/toc/<dirname>.md
```

The `## Flows` section of `toc.md` is *always* flat. Scan it — if a flow file's one-line title matches the question Codex is about to answer, read that flow file *before* doing any exploration:

```bash
cat .codex/memory/flows/<slug>.md
```

A matching flow file often answers the question outright or gets Codex 80% of the way, saving a multi-file trace.

If `toc.md` shows a stale-notice banner ("~N% of index rows may be stale"), mention it to the user and offer to run `gc-memory`.

### 2. Before reading any source file, check the index

For each source file Codex is about to `Read`, first check whether the index already has it:

```bash
grep "\"path\":\"<exact-relative-path>\"" .codex/memory/index.jsonl
```

If a row exists:

- Hash the current file: `sha1sum <path>` (compare only the hex digits).
- Compare against the row's `hash` field.
- If they **match**: the row's `symbols` and `summary` are current. If the question can be answered from the symbol list plus summary, or by reading one specific line range from the file, do that instead of reading the whole file.
- If they **don't match** (file changed since indexing): the row is stale. Do a full `Read` — the hook will refresh the row automatically.

If no row exists: do a full `Read` — the hook will create the row.

If the row has an `error` field: treat it as if no row exists (re-read fully). Check `.codex/memory/hook.log` if curious why.

### 3. After reading a file, upgrade its summary if provisional

The hook writes a heuristic placeholder summary when it first indexes a file (e.g., "3 functions including handleLogin, validateToken", or whatever docstring/comment it pulled out). The placeholder is flagged with `"summary_provisional": true` in `index.jsonl`, and the corresponding ToC line ends in `~`.

After reading a file and understanding what it does, replace the placeholder:

```bash
python3 .codex/hooks/set-summary.py <relative-path> "one-line description of what this file is for"
```

Rules for a good summary:

- 15 words or fewer.
- Describes the file's *purpose*, not its contents.
- Useful to a future Codex doing a ToC scan.

Good: `OAuth login entry point, validates tokens and creates sessions`
Bad: `Contains the login function and some helpers`

Do this opportunistically — every time Codex reads a file with a provisional summary, upgrade it. The ToC's value compounds with every upgrade.

## When to use the index versus re-reading

The index is a *map*, not a replacement for the source.

- **Use the index alone** when: Codex just needs to know whether a file/symbol exists, where it lives, and roughly what it does. Example: "is there already a token refresh function somewhere?" → grep the index, done.
- **Use the index to narrow, then read** when: Codex needs code-level detail about a specific method. The index gives the file and line range; read just those lines.
- **Re-read fully** when: the row is stale, missing, or has an error; or when the question genuinely requires reading the file end to end.

## Cross-references to other skills

- To write a flow memory file capturing what was just traced: invoke **`update-context`** (or tell the user "I should run update-context to save this trace").
- To clean up stale rows from deleted or moved files: invoke **`gc-memory`**.

## Instruction-mode fallback (hooks unavailable)

If the user's Codex version doesn't fire `PostToolUse` hooks (verify by reading
a file with a simple shell command such as `sed -n '1,40p' <path>` and checking
whether `.codex/memory/index.jsonl` gained a row), the file/symbol index will
not update automatically. Tell the user once, early in the session, that hooks
don't appear to be firing. Then operate in instruction mode: after every shell
read on an indexable source file, run

```bash
python3 .codex/hooks/update-index.py <relative-path>
```

This is the same worker the hook would have called. It is **strictly worse** than hook mode because it depends on Codex remembering to do it. If Codex finds itself drifting away from doing this consistently, surface that to the user rather than silently letting the index rot.

## Things this skill does NOT do

- Does not bulk-index the repo on setup. The index grows from actual exploration.
- Does not synthesize flows. Flows are explicit and live in `update-context`.
- Does not delete stale rows. That's `gc-memory`'s job.
- Does not work outside Codex (the hook mechanism is Codex specific).
