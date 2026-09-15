---
name: wsl-dev-runtime
description: Handle WSL local-dev runtime quirks: stale Vite code, env loading, background process safety, and the 9p node_modules tax.
---

# WSL Dev Runtime

## node_modules belongs on the Linux filesystem, not drvfs

This repo lives on `/mnt/d`, a 9p mount.
Every `open`/`stat` over 9p is a hypervisor round-trip, so a dependency tree of thousands of small files costs wall time with almost no CPU.
Measured 2026-09-15: `require('jsdom')` from `/mnt/d` took **~45 s at 12% CPU**; the same tree on the Linux fs took **0.4 s**.
jsdom's dependency closure is 3,617 module files, and vitest loads it in every jsdom test file, so **every vitest invocation paid ~45 s before running a single test** (a 1 ms test file measured 56 s wall / 4 s CPU).

The fix in place: `node_modules` at the root and in each workspace is a symlink to `$HOME/.study-planner-modules/<same relative path>`, with the real files on the Linux fs.
That took the same single-test run from 56 s to 1.8 s and the full app suite to ~19 s.

Two things that make or break this layout:

- **Workspace-package links must point at the real repo.** pnpm installs `@study-tracker/*` as *relative* symlinks (`../../../../packages/progress`).
  Moving `node_modules` out of the repo makes them resolve somewhere else entirely, and Vite then fails with `Failed to resolve import "@study-tracker/progress"`.
  Repoint every link whose target contains `packages/` at the absolute repo path, and confirm with `find "$HOME/.study-planner-modules" -xtype l` returning nothing.
- **`.gitignore` needs a slash-less `node_modules` entry.** A trailing slash matches directories only, so a symlinked `node_modules` is *not* ignored and shows as untracked, and a blanket `git add -A` would commit the links.

`pnpm install` is a no-op on a warm tree and leaves the symlinks alone; do not run a cold `pnpm install` expecting it to keep them.

## Stale Vite code on drvfs

Vite's file watcher does not reliably fire on `/mnt/d` (Windows drive) mounts.
After editing app or service source, restart the affected process with `./full-app restart full` before browser verification.
A fresh Playwright page still receives the old module if the dev server never noticed the edit.

## Env loading and process env

dotenv `config()` never overrides an existing environment variable.
A placeholder or stale value exported in the shell beats the gitignored `.env` file, so the worker or service can run with the wrong key.
Unset the variable in the shell, or launch from a clean shell, before starting dev processes.
The Intelligence service and worker read `os.getenv` at process start, not per file write.
Adding or fixing keys in `.env` files requires a restart of the process to take effect.
Inspect a running process's actual environment with `/proc/<pid>/environ` and compare only value lengths; never print secret values.

## Node on WSL

Bare `node` is often missing from PATH on this host.
The Windows pnpm shim then fails with `sh is not recognized` and `pnpm exec` cannot run its bins.
Install a user-local Linux Node (for example a tarball under `$HOME/.local/node`, or fnm/nvm) and export `PATH="$HOME/.local/node/bin:$PATH"` before running pnpm-executed binaries such as Playwright.
Prefer `corepack pnpm` (it downloads the pinned pnpm version as a Linux tool) or `node <path>/cli.js` directly when the Windows shim misbehaves.

## Background process safety

`pkill -f` matches your own command line, so the pattern can kill the shell that is trying to kill the process.
Use a character class such as `pkill -f 'app[.]worker_main'`, or kill by explicit PID.
A `nohup ... &` started inside a tool command dies with the process group when the command times out.
Start long-running processes detached with `setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &`.
A background process that keeps stdout open makes the launching shell hang until the tool timeout kills it.
