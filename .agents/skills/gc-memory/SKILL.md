---
name: gc-memory
description: >-
  Garbage-collect the code-memory index — remove rows for files that have been deleted, moved, or newly gitignored. Use whenever the user says any variant of "clean up memory", "garbage collect", "gc the index", "remove stale entries", "memory got big", "trim the index", or when Codex notices the in-ToC stale notice ("Note: ~N% of index rows may be stale. Consider running gc-memory."). Also trigger proactively if Codex sees that notice while reading toc.md at the start of a task — surface the option to the user.
---

# GC Memory

Periodic maintenance for the `code-memory` index. Removes rows that no longer correspond to real, indexable files.

## What it does

Full sweep over `.Codex/memory/index.jsonl`. For each row:

1. **Does the file exist?** `test -f <path>`. If no → remove the row (file deleted or moved without a forwarding address).
2. **Is the file gitignored now?** `git check-ignore <path>`. If yes → remove the row (file moved into a build artifact, generated dir, etc.).
3. **Does the extension still match the allow-list?** Re-check against the list in `update-index.py` / `gc-memory.py`. If no → remove the row.
4. **Does the file match a deny-list name, deny-list pattern, or deny directory segment?** Re-check. If yes → remove the row.

Rows that survive all checks are kept as-is. **Hashes are not re-verified here** — stale-hash detection is the hook's job on next read, not gc's.

## How to run

```bash
python3 .Codex/hooks/gc-memory.py
```

The script does the sweep, rewrites `index.jsonl` with surviving rows, regenerates `toc.md`, and prints a summary.

## Reporting

After running, report to the user with concrete counts. Example:

> Garbage-collected the memory index:
> - 47 rows removed total
> - 12 files deleted from disk
> - 3 files newly gitignored (looks like new build output dirs)
> - 32 files renamed/moved (their old paths are gone; new paths will be re-indexed when next read)
> - 218 rows remain in the index
> - ToC regenerated

If a large fraction of rows was removed (gc-memory itself surfaces a warning at >30%), suggest the user check whether something unexpected happened — e.g., a big refactor, a `.gitignore` change, or accidentally running gc in the wrong repo. That kind of churn isn't necessarily wrong but is worth flagging.

## Things this skill does NOT do

- **Does not delete flow files.** Flow files survive even if the underlying code is gone — they're history, sometimes useful for understanding past architecture.
- **Does not modify rows it keeps.** Stale-hash detection is the hook's job, not this skill's.
- **Does not re-index anything.** The index grows from real exploration, not from gc.
- **Does not run automatically.** It's explicit — invoked by the user or by Codex in response to the in-ToC stale notice.
