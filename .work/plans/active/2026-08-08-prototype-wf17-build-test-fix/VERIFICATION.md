# VERIFICATION — 2026-08-08-prototype-wf17-build-test-fix

Running log for the `prototype/wf17-inline-hint-guide` build/test/fix recovery. Canonical contract is [`PLAN.md`](PLAN.md); the next-session entry point is [`../../../handovers/2026-08-08-prototype-wf17-build-test-fix-handover.md`](../../../handovers/2026-08-08-prototype-wf17-build-test-fix-handover.md).
**Code is ground truth.** Every claim below was produced by running the command on the host on 2026-08-08.

## Status

| Phase | State |
|---|---|
| 0 — Recover dependency graph + pnpm | ✅ fixed 2026-08-08 (`7759422`) |
| 1 — Fix 3 tsc errors (swap-DnD code) | ✅ fixed 2026-08-08 (fixed by Phase 0; no source change needed) |
| 2 — Restore test suite (vitest resolution) | ✅ fixed 2026-08-08 (`8ac3805`) |
| 3 — Iterate #17 prototype (optional, Wave-1) | ☐ unblocked — loop runs clean |

## Acceptance criteria (done = all green)

- [x] `pnpm install` exits 0, no `EACCES`, no orphan `vitest@4.1.5` in `node_modules/.pnpm`.
- [x] `pnpm -r typecheck` exits 0 (5 scoped projects; marketing `astro check` 0 errors).
- [x] `pnpm --filter @study-tracker/app build` exits 0 (tsc + vite build, 1393 modules).
- [x] `pnpm -r lint` exits 0 (kept green).
- [x] `pnpm --filter @study-tracker/app test` runs to a real pass/fail count — **62 files / 563 tests passed**.
- [x] `pnpm dev:app` serves `/study/practice-prototype?variant=A|B|C` (vite boots; route mounted at `App.tsx:156`).

## Fix log — 2026-08-08 (implementation)

### Phase 0 — clean dependency graph ✅
- Fixed `pnpm-workspace.yaml`: replaced the malformed `allowBuilds:` placeholder block with pnpm-10-correct `onlyBuiltDependencies: [esbuild, sharp]`. Committed `7759422`.
- Wiped `node_modules` at repo root + `apps/*` + `packages/*`, then `pnpm install` via the working shim: exit 0, no EACCES, only `vitest@1.6.1_@types+node@25.6.0_jsdom@29.1.0` in `.pnpm` (plus `@vitest/*@1.6.1`). All 730 packages reused/resolved, esbuild+sharp postinstalls ran.

### Phase 1 — 3 tsc errors ✅ (fixed by Phase 0, no source edit needed)
- After the clean reinstall, `pnpm --filter @study-tracker/app typecheck` exits 0 — **the 3 errors were a symptom of the corrupted dependency graph (dangling `@dnd-kit/react` resolution), not a real code-vs-types mismatch.** Inspected the installed `@dnd-kit/react@0.4.0` `index.d.ts`: `Props$1` (DragDropProvider) `extends PropsWithChildren`, and `DragOverlay`'s `children` is `ReactNode | ((source: U) => ReactNode)` — so `SwapDndContext.tsx:74/81` and `SwappableSlotRow.tsx:137` all typecheck as written. **No commit to the onboarding source was needed.** (Verification had warned "do not blindly bump" — confirmed: the pinned `^0.4.0` and code are already aligned.)
- `pnpm --filter @study-tracker/app build` exit 0 (tsc && vite build, 1393 modules, ~6.3s).
- `pnpm -r typecheck` exit 0 (all 5 scoped projects; `packages/progress`, `packages/roadmap-engine`, `apps/app` `tsc --noEmit` clean; `apps/marketing` `astro check` 0 errors/warnings).
- `pnpm -r lint` exit 0 (kept green).

### Phase 2 — test suite ✅ (one real pre-existing failure fixed at the harness)
- `pnpm --filter @study-tracker/app test` now runs v1.6.1 and reports a real count — **62 files / 563 tests passed** (was 62/62 `Cannot find package 'vitest'`).
- After Phase 0 cleared the vitest resolution, **1 genuine pre-existing failure surfaced**: `src/sync/SyncProvider.test.tsx` failed at module scope (`vi.spyOn(localStorage, 'getItem')` → `Error: getItem does not exist`, 0 tests). Probe confirmed the cause: **Node 25.6.1's experimental webstorage shadows jsdom's `localStorage` with an empty plain `Object`** (no `Storage` API); Node itself warns `--localstorage-file was provided without a valid path`. This predates the branch recovery (test written in `e74257c`).
- Fix (`8ac3805`): added a guard in `apps/app/src/test/setup.ts` that installs an in-memory `Storage` (Map-backed) onto `window.localStorage` + `globalThis.localStorage` only when `localStorage.getItem` isn't a function — healthy hosts (jsdom `Storage`) are untouched. Matches the existing defensive pattern for `ResizeObserver`/`matchMedia`. Alternative (`NODE_OPTIONS=--no-experimental-webstorage`) also works but is host-specific; the setup guard is portable.
- Post-fix full run: 62/62 files, 563/563 tests green.

### Known-green surfaces re-confirmed after reinstall
- `pnpm -r lint` exit 0.
- `pnpm --filter @study-tracker/marketing build` exit 0 (6 pages, ~465ms).
- `packages/progress`, `packages/roadmap-engine` typecheck clean.

## Log
- **2026-08-08** Diagnostic session: inspected code, attempted `./full-app`, `pnpm install`, `-r typecheck`, `-r lint`, `--filter @study-tracker/app test`/`build`/`dev`, `--filter @study-tracker/marketing build`. Identified the three fault layers above; wrote PLAN.md + this log + the handover baton. No source or lockfile changes made in that session (investigation only). Working-tree strays + the `design/architecture.md` modification were left untouched.
- **2026-08-08** Implementation session: Phase 0 (`7759422`), Phase 1 (no-op, cleared by Phase 0), Phase 2 (`8ac3805`). All acceptance criteria green. Loop now runs clean; hand back to #17 implementer or continue Phase 3. Working-tree strays + `design/architecture.md` modification left untouched.

## Diagnosis — 2026-08-08 (evidence from the live host)

Environment: Windows / PowerShell 5.1, Node v25.6.1. Repo on branch `prototype/wf17-inline-hint-guide` @ `d0aa66d`. Working tree had unrelated edits only (`design/architecture.md` + untracked strays) — preserved untouched.

### Toolchain / host
- **bare `pnpm` broken.** `pnpm --version` → `'"C:\Users\user\AppData\Local\pnpm\.tools\pnpm-exe\10.33.2\pnpm"' is not recognized`. A second shim at `C:\Users\user\AppData\Roaming\npm\pnpm.cmd` (v10.33.2) **works** — all successful runs in this log used that path.
- **`corepack` not on PATH; `npx` blocked** by PowerShell execution policy (`npx.ps1 cannot be loaded because running scripts is disabled`).
- **Python / Python3 / `uv` all absent** — only the Windows Store alias stub. `services/intelligence/.env` MISSING (only `.env.example` exists). Intelligence Service cannot start on this host.
- **`./full-app` POSIX-only** — `full-app` is `#!/usr/bin/env bash` → `python3 scripts/full_app.py`; `full_app.py` uses `lsof`, `ps -p`, `os.getpgid`, `os.killpg` (POSIX process groups). Will not run on Windows. `pnpm dev:full` therefore fails.

### Dependency graph (Phase 0 evidence)
- `pnpm install` (working shim): lockfile up to date, resolved 40 packages, then **failed with `EACCES: permission denied, ... node_modules\.pnpm\esbuild@0.21.5\node_modules\@esbuild\linux-x64\package.json`** during the prune step. Preceded by ~13 `WARN Failed to remove "<…>.pnpm\…@4.1.5|@16.3.2…>"` warnings (vitest@4.1.5, @vitest/mocker/utils/snapshot@4.1.5, @testing-library/react@16.3.2, framer-motion@12.38.0, astro@4.16.19, @typescript-eslint/*@8.59.1).
- **Orphan vitest@4.1.5 confirmed on disk:** `node_modules/.pnpm/` lists BOTH `vitest@1.6.1_@types+node@25.6.0_jsdom@29.1.0` (correct, matches `apps/app` `^1.6.1`) AND `vitest@4.1.5_…_vite@5.4.21_…` (dangling — pnpm tried to prune it, EACCES'd).
- `pnpm-workspace.yaml` carries a malformed placeholder block:
  ```yaml
  allowBuilds:
    esbuild: set this to true or false
    sharp: set this to true or false
  ```
  Not a valid pnpm-10 field shape; values are literal strings. (Did not block install this run, but is latent junk.)

### App typecheck (Phase 1 evidence)
`pnpm --filter @study-tracker/app typecheck` → exit 2, 3 errors (identical output from `pnpm -r typecheck` for the `apps/app` project):
```
src/onboarding/components/SwapDndContext.tsx(74,6): error TS2322: ... Property 'children' does not exist on type 'IntrinsicAttributes & Props$1<...>'.
src/onboarding/components/SwapDndContext.tsx(81,11): error TS7006: Parameter 'source' implicitly has an 'any' type.
src/onboarding/components/SwappableSlotRow.tsx(137,32): error TS7006: Parameter 'e' implicitly has an 'any' type.
```
Installed `@dnd-kit/react@0.4.0` (confirmed via `apps/app/node_modules/@dnd-kit/react/package.json` and `.pnpm/@dnd-kit+react@0.4.0_react-…`). The code passes `children` to `DragDropProvider` and a `(source) =>` render-prop to `DragOverlay` — the installed types don't expose those. Reconcile code ↔ installed types; do **not** blindly bump the dnd-kit version.

### App build (Phase 1 evidence)
`pnpm --filter @study-tracker/app build` → exit 2 at `tsc` (app build script is `tsc && vite build`). Same 3 errors as typecheck. `vite build` itself never reached.

### App tests (Phase 2 evidence)
`pnpm --filter @study-tracker/app test` → **62/62 test files FAIL**, zero tests run, Duration ~21s:
```
Error: Cannot find package 'vitest' imported from D:\study\git\study-planner-web\node_modules\.pnpm\@testing-library+jest-dom@6.9.1\node_modules\@testing-library\jest-dom\dist\vitest.mjs
{ code: 'ERR_MODULE_NOT_FOUND' }   [1/62]
```
Root cause: `src/test/setup.ts` (touched by the HEAD commit `d0aa66d`) imports `@testing-library/jest-dom/vitest`; that subpath's `vitest.mjs` resolves `vitest` to the **dangling vitest@4.1.5** (Phase 0 fallout), not the real v1.6.1. **Fixing Phase 0 is expected to clear this.** `apps/app/.bin/vitest.CMD` exists and points at the correct v1.6.1.

### Surfaces that already work (do not regress)
- **`pnpm -r lint` exits 0** for all 5 scoped projects (`packages/progress`, `packages/roadmap-engine`, `apps/app` report `Done`; `apps/marketing` + `packages/design-tokens` have no lint script — silently skipped, "5 of 6 workspace projects").
- **`pnpm --filter @study-tracker/marketing build` exits 0** — Astro builds 6 static pages, ~960ms. Dev should correspondingly work.
- **`pnpm --filter @study-tracker/app dev` BOOTS** — Vite v5.4.21 ready, `http://localhost:5173/study/` (vite does not typecheck, so the 3 tsc errors don't block dev startup). Runtime behavior of the swap-DnD routes **UNCONFIRMED in-browser** — needs a console check after Phase 1.
- `packages/progress` and `packages/roadmap-engine` typecheck clean.

### Branch / STATUS context
- This branch **is** the Phase-2 wayfinder **#17 Inline-hint live guide (prototype)** in progress (see [`../2026-07-31-phase2-wayfinder/PLAN.md`](../2026-07-31-phase2-wayfinder/PLAN.md) "Wave 1"). HEAD `df0d2ab` = "prototype(wf17): inline-hint live guide — 3 clickable surfaces"; `d0aa66d` = the test-setup touch.
- Prototype mount: `apps/app/src/App.tsx:156` → `<Route path="/practice-prototype" …>` (mirrors the existing `/chart-test` dev-route precedent). Try `?variant=A|B|C`.
- Prototype sources: `apps/app/src/prototype/practice-guide/` (VariantA ghost-text / VariantB margin-rail / VariantC popover + `useHintEngine`, `hint-ladders`, `PrototypeSwitcher`, `TierBits`, `prototype.css`).
- Branch diverged from `06fa63f` (Merge PR #8 feature/issue-005); **`main` is far behind** (tip `ba34193` "snapshot 1st-Review deliverables…") — do **not** rebase onto main as part of this recovery.

## Log
- **2026-08-08** Diagnostic session: inspected code, attempted `./full-app`, `pnpm install`, `-r typecheck`, `-r lint`, `--filter @study-tracker/app test`/`build`/`dev`, `--filter @study-tracker/marketing build`. Identified the three fault layers above; wrote PLAN.md + this log + the handover baton. No source or lockfile changes made in this session (investigation only). Working-tree strays + the `design/architecture.md` modification were left untouched.
  **Next:** Phase 0 — wipe `node_modules`, fix `pnpm-workspace.yaml`, reinstall, confirm a clean graph. Then Phase 1.