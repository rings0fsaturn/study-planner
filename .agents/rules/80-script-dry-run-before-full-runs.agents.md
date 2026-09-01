---
name: script-dry-run-before-full-runs
description: Run a minimal-scoped dry check of operator scripts before any full run, so errors surface on a few calls instead of after a long or paid run.
---

# Script Dry Run Before Full Runs

Run a small, minimal-scoped dry check of any operator script before the
actual full run.
This applies to the probe, bake-off, re-embed, corpus, and report scripts in
`services/intelligence/scripts/` and to any new long-running Python code.

A dry run costs seconds and cents.
A full run costs minutes to hours and real API or GPU budget.
The dry run catches import errors, SDK version mismatches, request-shape
bugs, and record-shape mistakes while only a handful of records exist.

## Dry-run protocol

Run the script with a small limit and a single cheap mode first, for example:

```bash
uv run --package intelligence python scripts/generation_probe.py \
  --layers S --tiers off --limit 2 --concurrency 2
```

Inspect the produced records before scaling:
- Every record has a classified outcome.
- Success records parse into the expected shape.
- Citations and references stay inside the provided scope.
- Sanitizers redact keys and secrets.

After any code edit, repeat the dry run.
Do not jump from an edit straight to the full matrix.

## Verify cheaply before spending budget

Prefer offline or cheap checks before any paid or GPU-backed run:
- Import and syntax check with a plain Python parse.
- Run the unit tests for the script's pure functions.
- Run `ruff check` and `ruff format --check` on the touched files.
- Where the script has an offline report or summarize mode, run it on
  existing evidence before new calls.

Metric and report code must be exercised on small real or synthetic records
before a full-data run.
Full-data report runs exposed shape drift (string citations, options as
objects) that a small sample would have shown first.

## Do not rerun the whole run

Treat full runs as resume-safe where the script supports done-keys or
append-only evidence.
A dry run that finds a bug is a success, not a failed run:
fix the bug, dry-run again, then resume the full run.