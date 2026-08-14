---
date: 2026-08-08
mode: mid-task
slug: prototype-wf17-build-test-fix
topic: Recover the prototype/wf17-inline-hint-guide branch to a runnable build/test/fix loop (Phase-2 #12 inline-hint prototype)
---

## TL;DR

The `prototype/wf17-inline-hint-guide` branch (Phase-2 wayfinder **#12**, the inline-hint
live-guide prototype) is **mid-build and cannot be built, typechecked, or tested** on this
host. Three independent fault layers are blocking the loop. Your job is to clear them in
order (Phase 0 → 1 → 2) so the **repeated build/test/fix loop runs clean** — then either
hand back to the #12 implementer or keep iterating the prototype (Phase 3).

**Read these first:**
- [`../.work/plans/active/2026-08-08-prototype-wf17-build-test-fix/PLAN.md`](../.work/plans/active/2026-08-08-prototype-wf17-build-test-fix/PLAN.md) — the durable contract + phases.
- [`../.work/plans/active/2026-08-08-prototype-wf17-build-test-fix/VERIFICATION.md`](../.work/plans/active/2026-08-08-prototype-wf17-build-test-fix/VERIFICATION.md) — the full diagnosis with command output evidence + acceptance checklist.

Do **not** trust the bare `pnpm` on this machine — it's broken. Do **not** rebase onto `main`
(main is ancient). Do **not** run `./full-app` on Windows (POSIX-only).

## The three faults (one-line each)

1. **Host** — bare `pnpm` shim corrupted; `corepack`/`npx` blocked; Python/`uv` missing;
   `./full-app` is POSIX-only. **Workaround already known:** invoke pnpm as
   `& "C:\Users\user\AppData\Roaming\npm\pnpm.cmd"`.
2. **Deps** — `pnpm install` EACCES-prunes on Windows, leaving a dangling `vitest@4.1.5`
   while `apps/app` resolves `vitest@1.6.1` → all 62 test files fail with
   `Cannot find package 'vitest'`. `pnpm-workspace.yaml` has a junk `allowBuilds:` block.
3. **Source** — `tsc --noEmit` fails with **3 errors** in `@dnd-kit/react@0.4.0` swap-DnD
   code → breaks `typecheck` + `build` (`tsc && vite build`).

## Exact entry points (file:line, branch HEAD d0aa66d)

Fault 3 — the only place source changes are needed for the recovery:
- `apps/app/src/onboarding/components/SwapDndContext.tsx:74` — `<DragDropProvider …>` children (TS2322).
- `apps/app/src/onboarding/components/SwapDndContext.tsx:81` — `<DragOverlay …>{(source) => …}</DragOverlay>` render-prop (TS7006 implicit any).
- `apps/app/src/onboarding/components/SwappableSlotRow.tsx:137` — `onKeyDown={(e) => …}` (TS7006 implicit any).
- Installed version: `@dnd-kit/react@0.4.0` (`apps/app/package.json` pins `^0.4.0`). **Reconcile to the installed types, don't blindly bump.** The error "Property 'children' does not exist on … Props$1" suggests the v0.4 `DragDropProvider` type dropped/renamed the children slot.

Fault 2 — config fix:
- `pnpm-workspace.yaml` lines 4–6: the `allowBuilds:` block with placeholder string values. Replace with `onlyBuiltDependencies: [esbuild, sharp]` (pnpm 10) or delete it.

The prototype you're unblocking (no edits needed to make the loop run, only to iterate #12):
- Mount route: `apps/app/src/App.tsx:156` — `<Route path="/practice-prototype" …>`.
- Sources: `apps/app/src/prototype/practice-guide/` — `PracticeGuidePrototype.tsx`, `VariantA_GhostText.tsx`, `VariantB_MarginRail.tsx`, `VariantC_Popover.tsx`, `useHintEngine.ts`, `hint-ladders.ts`, `PrototypeSwitcher.tsx`, `TierBits.tsx`, `prototype.css`.
- Browse at `http://localhost:5173/study/practice-prototype?variant=A` (or `B` / `C`).

## The iteration loop (do this repeatedly once Phases 0–1 are green)

```text
edit variant  →  pnpm --filter @study-tracker/app typecheck  →  pnpm --filter @study-tracker/app test
              →  (if UI) pnpm dev:app, reload ?variant=A|B|C, watch console  →  record in VERIFICATION.md
```

## Phase order (load-bearing — do the smallest relevant check first)

**Phase 0 — clean deps (unblocks everything).**
```powershell
$pnpm = "C:\Users\user\AppData\Roaming\npm\pnpm.cmd"
Remove-Item -Recurse -Force node_modules, apps\app\node_modules, apps\marketing\node_modules, packages\*\node_modules -ErrorAction SilentlyContinue
# Fix pnpm-workspace.yaml first (see entry point above), THEN:
& $pnpm install
# Verify:
Get-ChildItem node_modules\.pnpm -Directory | Where-Object Name -like 'vitest@*' | Select-Object Name   # expect only vitest@1.6.1_*
```
Done when: `pnpm install` exit 0, no `EACCES`, only `vitest@1.6.1_…` in `.pnpm`. Commit the `pnpm-workspace.yaml` fix.

**Phase 1 — fix the 3 tsc errors (SwapDndContext / SwappableSlotRow).**
```powershell
& $pnpm --filter @study-tracker/app typecheck   # red→green
& $pnpm --filter @study-tracker/app build       # tsc && vite build → green
& $pnpm -r typecheck                            # green
& $pnpm -r lint                                 # MUST stay green (already is)
```
Done when: all four exit 0. Commit the source fixes.

**Phase 2 — restore the test suite.**
```powershell
& $pnpm --filter @study-tracker/app test
```
Done when: it reports a real pass/fail count (not 62/62 `Cannot find package 'vitest'`). After Phase 0 this is expected to clear automatically; if `@testing-library/jest-dom` still complains about vitest peers, pin it (keep the `/// <reference types="vitest/globals" />` / `@testing-library/jest-dom` refs the HEAD commit `d0aa66d` added in `apps/app/src/test/setup.ts`). Commit only if config changed.

**Phase 3 (optional, the actual #12 work) — iterate the prototype.** Use the loop above. This recovery task **ends** when Phases 0–2 are green; Phase 3 is the #12 implementer's normal work.

## Commands cheat sheet (pnpm-on-Windows)
```powershell
$pnpm = "C:\Users\user\AppData\Roaming\npm\pnpm.cmd"
& $pnpm install
& $pnpm --filter @study-tracker/app typecheck
& $pnpm -r typecheck
& $pnpm --filter @study-tracker/app build
& $pnpm -r lint
& $pnpm --filter @study-tracker/app test
& $pnpm dev:app          # then open http://localhost:5173/study/practice-prototype?variant=A|B|C
& $pnpm dev:marketing     # http://localhost:4321 (independent, already healthy)
# Intelligence Service — CANNOT run on this host yet (Python 3.12 + uv missing, services/intelligence/.env missing).
& $pnpm dev:full          # BROKEN on Windows (full-app is POSIX-only) — do not use.
```

## What's already known-green (don't regress)
- `pnpm -r lint` exits 0 (5 scoped projects).
- `pnpm --filter @study-tracker/marketing build` exits 0 (Astro, 6 pages).
- `pnpm --filter @study-tracker/app dev` **boots** (vite skips typecheck) — `http://localhost:5173/study/` ready.
- `packages/progress`, `packages/roadmap-engine` typecheck clean.

## Gotchas
- **Bare `pnpm` is broken on this host** — always use the `AppData\Roaming\npm\pnpm.cmd` path (the `AppData\Local\pnpm` shim references a missing `pnpm-exe\10.33.2\pnpm`).
- **PowerShell execution policy** blocks `.ps1` shims (`npx.ps1`). Use the `.cmd`/`.exe` paths instead.
- **Never rebase onto `main`.** Branch diverged from `06fa63f`; `main` (tip `ba34193`) is far behind. Recovery is in-place on `prototype/wf17-inline-hint-guide`.
- **Never run `git clean -fdx`** at repo root, and never gitignore `.work/` (see `AGENTS.md` / `.work/README.md`).
- **E2E specs are authored, not run** here (STATUS gotcha). Don't add `SUPABASE_SERVICE_ROLE_KEY` to source/logs.

## Out of scope for this recovery (file separate tickets, don't block)
- Port `./full-app` + `scripts/full_app.py` to Windows (POSIX-only: `lsof`/`ps`/`os.getpgid`/`os.killpg`).
- Install Python 3.12 + `uv`, create `services/intelligence/.env`, to run the Intelligence Service + `uv run pytest`.
- Clean up stray untracked files at repo root (`study-planner-web-source.zip`, `project.bundle`, `project-1.bundle`, `bundleimportguide.txt`, `filter-guide.txt`, `grill-me-with-mocks.skill`, `.agents/skills/grill-me.rar`, `apps/app/supabase/.branches/`, `apps/app/supabase/.temp/`, `college/Zero/`, `tmp/`).

## Status row
`.work/STATUS.md` → new **Active** row `2026-08-08-prototype-wf17-build-test-fix` (tag `[APP][INFRA]`). Flip it to Done when Phases 0–2 are green and the loop runs; the handover then moves to `handovers/archive/`.

> **Update 2026-08-08:** Phases 0–2 are now green (commits `7759422`, `8ac3805`). Phase 1 needed **no source change** — the 3 tsc errors were fallout from the corrupted dependency graph, not a code-vs-types mismatch (the installed `@dnd-kit/react@0.4.0` types accept both `children` and the `DragOverlay` render-prop). Phase 2 additionally fixed one genuine pre-existing test failure (`SyncProvider.test.tsx`, Node 25 webstorage shadowing jsdom `localStorage`) via a portable guard in `apps/app/src/test/setup.ts`. Full suite: 62 files / 563 tests green; `-r typecheck`, `-r lint`, app build, marketing build all exit 0. Ready for the #12 implementer to run Phase 3.