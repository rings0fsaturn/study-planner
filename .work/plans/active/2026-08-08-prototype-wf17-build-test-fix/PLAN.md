# PLAN — Recover `prototype/wf17-inline-hint-guide` to a buildable/testable/iterable state

**Task id:** `2026-08-08-prototype-wf17-build-test-fix`
**Type:** environment + build recovery (diagnosed; fix work remains)
**Branch:** `prototype/wf17-inline-hint-guide` (HEAD `d0aa66d`, 2026-08-05)
**Parent context:** Phase-2 wayfinder ticket **#12 Inline-hint live guide (prototype)** — Wave 1 → see [`../2026-07-31-phase2-wayfinder/PLAN.md`](../2026-07-31-phase2-wayfinder/PLAN.md) (destination = working throwaway prototypes of the inline-hint live guide).
**Host (diagnosis env):** Windows / PowerShell 5.1, Node v25.6.1, pnpm 10.33.2 (npm shim), no Python/uv/corepack.
**Sibling docs:** [`VERIFICATION.md`](VERIFICATION.md) (running log + acceptance criteria) · [`../../../handovers/2026-08-08-prototype-wf17-build-test-fix-handover.md`](../../../handovers/2026-08-08-prototype-wf17-build-test-fix-handover.md) (next-session baton).

> **Read first:** the handover doc above. It has the exact iteration loop, commands, and file:line entry points. This PLAN is the durable contract; VERIFICATION is the churny log.

## Destination

Bring the `prototype/wf17-inline-hint-guide` branch to the state where the **repeated build/test/fix loop runs clean**, so the #12 inline-hint prototype can actually be developed and compared across its three variants (ghost-text / margin-rail / popover):

- `pnpm --filter @study-tracker/app typecheck` exits 0.
- `pnpm --filter @study-tracker/app test` runs the suite (no `Cannot find package 'vitest'` import error).
- `pnpm build` (root `-r`) exits 0.
- `pnpm dev:app` serves `http://localhost:5173/study/practice-prototype?variant=A|B|C` in a browser with no console errors.
- (Stretch, unblocks Wave 2) `pnpm dev:intelligence` starts; `uv run pytest` runs — gated on installing Python + uv + `services/intelligence/.env`.

## Root causes (diagnosed 2026-08-08, see VERIFICATION.md for evidence)

Three independent fault layers; fixing one does not fix the others.

1. **Host toolchain (Windows).** The `./full-app` launcher is POSIX-only (bash + `lsof`/`ps`/`os.getpgid`/`os.killpg`). The bare `pnpm` shim in `C:\Users\user\AppData\Local\pnpm` is corrupted. `corepack` is not on PATH and PowerShell execution policy blocks `.ps1` shims (e.g. `npx.ps1`). Python, Python3, and `uv` are absent, so the Intelligence Service cannot start.
2. **Dependency graph corruption.** `pnpm install` cannot finish its prune step on Windows (`EACCES` removing stale `.pnpm` dirs), leaving an orphan `vitest@4.1.5` + `@vitest/*@4.1.5` + `@testing-library/*@16.3.2` while `apps/app` resolves `vitest@1.6.1` (matches its `^1.6.1`). `@testing-library/jest-dom@6.9.1`'s `vitest.mjs` resolves `vitest` to the dangling v4 → **all 62 test files fail before a single test runs** with `Cannot find package 'vitest'`. `pnpm-workspace.yaml` also carries a malformed placeholder `allowBuilds:` block.
3. **Source type errors in the onboarding swap-DnD prototype.** `tsc --noEmit` fails with 3 errors in `@dnd-kit/react@0.4.0` code — the code's shape does not match the installed dnd-kit types. This independently breaks `typecheck` and `build` (app build is `tsc && vite build`).

## Scope and non-goals

- **In scope:** make the loop runnable on this host — fix pnpm/node_modules, fix the 3 tsc errors, document the Windows `full-app` + missing Python/uv gaps with workarounds. The handover defines the exact iteration order.
- **Non-goals (this task):** redesigning the dnd-kit swap feature, implementing the rest of #12's content, fixing the cross-branch divergence with `main` (main is ancient; do not rebase onto it), and installing Python/uv if the user only needs the React side.

## Phases (vertical slices; do the smallest relevant check first, then broaden)

Order is load-bearing: Phase 0 unblocks every later command; Phase 1 unblocks build/typecheck/test; Phase 2 is the actual prototype iteration the recovery exists to enable.

### Phase 0 — Recover a clean dependency graph + working pnpm
- Make a working `pnpm` callable (use `C:\Users\user\AppData\Roaming\npm\pnpm.cmd`, or place that first on PATH; do NOT rely on the broken `AppData\Local\pnpm` shim).
- Wipe the corrupted store: remove `node_modules` at repo root AND each `apps/*/node_modules` + `packages/*/node_modules` (the EACCES prunes left dangling `.pnpm` links that symlink-wipes alone won't clear).
- Fix `pnpm-workspace.yaml`: delete the malformed `allowBuilds:` block (values are the placeholder strings `"set this to true or false"`), or replace with the pnpm-10-correct `onlyBuiltDependencies: [esbuild, sharp]` if build approval is actually wanted.
- Reinstall: `pnpm install` (non-frozen first; if it still EACCES-prunes, rerun — the second pass usually succeeds once the danging dirs are gone).
- **Verify:** `pnpm install` exits 0 with no `EACCES`; `ls node_modules/.pnpm` no longer lists `vitest@4.1.5` or `@vitest+*@4.1.5`.
- **Log:** VERIFICATION.md Phase 0 section + commit the `pnpm-workspace.yaml` fix.

### Phase 1 — Fix the 3 `tsc` errors in the onboarding swap-DnD code
Files + exact lines (git HEAD `d0aa66d`):
- `apps/app/src/onboarding/components/SwapDndContext.tsx:74` — `DragDropProvider` props type has no `children` (TS2322).
- `apps/app/src/onboarding/components/SwapDndContext.tsx:81` — `DragOverlay` render-prop `(source) => …` implicit any (TS7006).
- `apps/app/src/onboarding/components/SwappableSlotRow.tsx:137` — `onKeyDown={(e) => …}` implicit any (TS7006).

Resolve by reconciling the code to the **installed** `@dnd-kit/react@0.4.0` types (do not blindly bump dnd-kit — confirm what `DragDropProvider`/`DragOverlay` accept at that version first; the children-less `Props$1` strongly suggests `children` is passed via a different slot or the version's types dropped it). Annotate the render-prop and key-handler params with the package's exported types (e.g. `DragEndEvent`'s source type, `React.KeyboardEvent<HTMLDivElement>`).

- **Verify:** `pnpm --filter @study-tracker/app typecheck` exits 0; `pnpm --filter @study-tracker/app build` exits 0; `pnpm -r typecheck` exits 0; repo `pnpm lint` still exits 0.
- **Log:** VERIFICATION.md Phase 1 section + commit.

### Phase 2 — Restore the test suite
- After Phase 0, rerun `pnpm --filter @study-tracker/app test`. Expect the `Cannot find package 'vitest'` error to be gone; real test failures (if any) then surface and become the new iteration targets.
- Optionally pin `@testing-library/jest-dom` peer to vitest@1 if pnpm still warns about peer ranges (the `d0aa66d` setup commit added `/// <reference types="vitest/globals" />` etc. — keep those refs; they are correct).
- **Verify:** `pnpm --filter @study-tracker/app test` runs to completion and reports a real pass/fail count (not 62/62 import failures).
- **Log:** VERIFICATION.md Phase 2 section + commit if config changed.

### Phase 3 (Wave-1 continuation, OPTIONAL for this recovery) — Iterate the #12 prototype
- Only after Phases 0–2 are green. The handover is the entry point for this; the recovery task ends when the loop runs clean.
- Prototype routes: `/study/practice-prototype?variant=A|B|C` (mounted in `apps/app/src/App.tsx:156`).
- Prototype sources: `apps/app/src/prototype/practice-guide/` (`PracticeGuidePrototype.tsx`, `VariantA_GhostText.tsx`, `VariantB_MarginRail.tsx`, `VariantC_Popover.tsx`, `useHintEngine.ts`, `hint-ladders.ts`, `PrototypeSwitcher.tsx`, `TierBits.tsx`).
- Loop: change a variant → `pnpm --filter @study-tracker/app typecheck` → `pnpm --filter @study-tracker/app test` → reload browser at the three `?variant=` URLs → note behavior. This is the "repeated build/test/fix" loop this task exists to unblock.

## Out-of-scope gaps recorded for later (do not fix here)

- **`./full-app` on Windows** — the launcher (`full-app` + `scripts/full_app.py`) is POSIX-only. Documented workaround for this session: start `pnpm dev:app` + `pnpm dev:marketing` + (later) `pnpm dev:intelligence` in separate shells. A proper Windows port is its own follow-up (file a separate ticket).
- **Intelligence Service** — needs Python ≥3.12 + `uv` installed and `services/intelligence/.env` created from `.env.example` (supply `SUPABASE_JWT_SECRET` + `SUPABASE_URL`). Not required to build/iterate the React prototype.
- **Stray untracked artifacts** at repo root (`study-planner-web-source.zip`, `project.bundle`, `project-1.bundle`, `bundleimportguide.txt`, `filter-guide.txt`, `grill-me-with-mocks.skill`, `.agents/skills/grill-me.rar`, `apps/app/supabase/.branches/`, `apps/app/supabase/.temp/`, `college/Zero/`, `tmp/`) — gitignore or remove separately; do not block on them.

## Verification commands (cheat sheet)

```bash
# pnpm on this host (broken shim workaround):
$pnpm = "C:\Users\user\AppData\Roaming\npm\pnpm.cmd"

& $pnpm install                                   # Phase 0
& $pnpm --filter @study-tracker/app typecheck      # Phase 1
& $pnpm -r typecheck                              # Phase 1 (all packages)
& $pnpm --filter @study-tracker/app build          # Phase 1 (tsc && vite build)
& $pnpm -r lint                                   # Phase 1 (should stay green)
& $pnpm --filter @study-tracker/app test           # Phase 2
& $pnpm dev:app                                    # Phase 3 — open /study/practice-prototype?variant=A
```