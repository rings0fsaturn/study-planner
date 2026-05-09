---
name: update-index
description: 'Update the codebase memory index files when source files change. Use when: starting a new session and staleness is detected, after significant code changes, user says "update the index", "refresh the index", "re-index", or any time the codebase index may be stale. Supports incremental updates (default) and full rescan (--full).'
---

# Update Codebase Index

Detect changed source files and update the affected memory index files so future lookups stay accurate.

## Path-to-Module Mapping

| Source Path Pattern | Memory File |
|--------------------|-------------|
| `apps/app/src/auth/*` | `index-auth.md` |
| `apps/app/src/events/*` | `index-events.md` |
| `apps/app/src/sync/*` | `index-sync.md` |
| `apps/app/src/progress/*` | `index-progress-hooks.md` |
| `apps/app/src/onboarding/*` | `index-onboarding.md` |
| `apps/app/src/session/*` | `index-session.md` |
| `apps/app/src/components/*` | `index-components.md` |
| `apps/app/src/pages/*` | `index-pages.md` |
| `apps/app/src/lib/*` or `dev/*` or `test/*` | `index-lib.md` |
| `apps/app/src/main.tsx` or `App.tsx` | `codebase-index.md` |
| `packages/progress/*` | `index-pkg-progress.md` |
| `packages/roadmap-engine/*` | `index-pkg-roadmap.md` |
| `packages/design-tokens/*` | `index-pkg-tokens.md` |
| `apps/marketing/*` | `index-marketing-e2e.md` |
| `e2e/*` | `index-marketing-e2e.md` |

The memory directory is at: `/home/rsaji/.claude/projects/-home-rsaji-workspace-study-planner-web/memory/`

## Workflow: Incremental Update (default)

### Step 1 — Detect changes

Read the memory file `index-metadata.md` to get the last-indexed commit hash.

Then run:
```bash
git diff --name-only <last-indexed-commit>..HEAD -- 'apps/' 'packages/' 'e2e/'
```

Filter the output to source files only: `.ts`, `.tsx`, `.css`, `.astro` extensions. Ignore test files (`.test.ts`, `.test.tsx`, `.spec.ts`) unless they are in `e2e/`.

If no source files changed, update the commit hash in `index-metadata.md` and stop.

### Step 2 — Group by module

Map each changed file path to its module using the table above.

If a file path doesn't match any existing module pattern (e.g., a new directory under `apps/app/src/`), flag it as a **new module**.

### Step 3 — Update affected modules

For each affected module:

1. **List current files** in the source directory:
   ```bash
   find apps/app/src/<module>/ -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) | sort
   ```

2. **Read the existing module index** from memory.

3. **Identify changes:**
   - **Added files:** In directory but not in index → read the file, extract exports via `grep -n '^export'`, add entry to the table
   - **Removed files:** In index but not in directory → remove entry from the table
   - **Modified files:** In both → re-read the file, check if exports changed via `grep -n '^export'`, update the entry if needed

4. **Update the module memory file** with the corrected file table. Preserve the Data Flow and Cross-Module sections unless you have clear evidence they changed (e.g., a new provider was added).

5. **Update file counts** in the Files section header.

### Step 4 — Handle new modules

If Step 2 flagged a new module:

1. Create a new `index-{name}.md` memory file using this template:
   ```markdown
   ---
   name: {Name} Module Index
   description: File index for {path} — {key concepts}
   type: reference
   ---

   ## Files ({N} source)

   | File | Key Exports | Purpose |
   |------|-------------|---------|

   ## Data Flow

   {Describe how this module connects to others}

   ## Cross-Module

   - **Depends on:** {modules it imports from}
   - **Depended by:** {modules that import from it}
   ```

2. Add a one-line entry to `MEMORY.md`.

3. Add a row to the Module Overview table in `codebase-index.md`.

### Step 5 — Handle deleted modules

If a module directory no longer exists but has an index file:

1. Delete the `index-{name}.md` memory file.
2. Remove its entry from `MEMORY.md`.
3. Remove its row from `codebase-index.md`.

### Step 6 — Update master index

If any module's file count changed, or modules were added/removed:

1. Update the Module Overview table in `codebase-index.md` (file counts, purposes).
2. Update the Feature Cross-Reference table if new features were added.
3. Update the total file count in the module overview header.

### Step 7 — Save metadata

Update `index-metadata.md` with:
- Current commit hash: `git rev-parse HEAD`
- Current date
- Updated module count and file count

## Workflow: Full Rescan (`--full`)

Use when: the metadata file is missing, the index seems badly out of date, or the user explicitly requests it.

1. **Skip git diff** — scan all source directories directly.
2. For each module directory: list all source files, read each file, extract exports.
3. **Rebuild** each module memory file from scratch (overwrite the file tables, preserve Data Flow and Cross-Module sections if they still look correct).
4. Update `codebase-index.md` entirely.
5. Save metadata with current commit hash.

## Important Notes

- **Source files only:** Index `.ts`, `.tsx`, `.css`, `.astro` files. Skip `.json`, `.md`, config files.
- **Test files:** Include test files in the index only as a count/list — don't catalog their individual exports. Exception: `e2e/` spec files should be indexed with their test scenarios.
- **Preserve structure:** Keep the existing Data Flow, Cross-Module, and State Machine sections in module files unless you have clear evidence they changed.
- **MEMORY.md cap:** Keep MEMORY.md under 200 lines. Each entry should be one line under 150 characters.
- **Don't over-read:** For modified files, just check `grep '^export'` output. Only do a full Read if exports changed or the file is new.
