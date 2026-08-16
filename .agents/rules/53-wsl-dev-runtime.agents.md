---
name: wsl-dev-runtime
description: Handle WSL local-dev runtime quirks: stale Vite code, env loading, and background process safety.
---

# WSL Dev Runtime

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
