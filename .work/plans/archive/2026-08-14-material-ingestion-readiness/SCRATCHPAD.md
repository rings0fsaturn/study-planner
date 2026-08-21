# Scratchpad — 2026-08-14-material-ingestion-readiness (issue #37)
_Plan: `.work/plans/archive/2026-08-14-material-ingestion-readiness/PLAN.md` · Log: `VERIFICATION.md` · Updated: 2026-08-17 (reconciliation)_

## Now
Task complete and archived. All gates 0-11 green: service 186 (+5 baseline), contracts 6/6,
app 668/668, root typecheck/lint, builds, ruff, live E2E 5 passed / 2 env-gated skips, live DB
probes for 005-013. Branch commits landed (`55afc04` ... `7e15ef8`); STATUS row flipped to Done
and the folder moved to `plans/archive/` in the 2026-08-17 work-docs reconciliation.

## Alignment
Plan complete; every operator checkbox closed by later evidence (see PLAN.md reconciliation note).

## Open
- Live sidecar re-embed E2E for the Qwen3 GPU embedder — owned by the `2026-08-16-dockerize-embed` plan.
- Full-book Gemini PDF validation under the C8 throttle — tracked in `2026-08-14-ingestion-performance-baseline`; likely superseded by the sidecar path.
- Operator: `./docker-app start` on a Docker-enabled host (no docker CLI in this WSL distro).

## Blockers
— none

## Deferrals
- Documented open boundaries (ingestion_state client-writable; worker has no HTTP healthcheck;
  file replacement disabled in UI) remain as recorded in VERIFICATION.md.

## Checklist
- [x] Gates 0-11 (unit + live verification)
- [x] Final review suites (service/app/contracts/typecheck/lint/builds/ruff/E2E)
- [x] VERIFICATION.md + STATUS.md updated
- [x] Scratchpad reconciliation (this file)
- [x] Commit phase2/issue-37 — `55afc04`, `518e060`, `0a58fc2`, `24f99dd`, `57253f8`,
      `344798e`, `441bcd5`, `f467f76`, `f08c47c`, `7e15ef8`

## In-flight edits
- None; all edits verified green and committed.

## Decisions in force
- D-01..D-05; per-gate test-fix-review; credentials never printed/committed.
- Retry = DB-atomic RPC; ready publish = transactional RPC; server-owned columns = guard trigger.
- Detail page: self-stopping 5s poll; PracticeThis gates non-ready; file replace disabled.

## Resolved (recent)
- Gate 10: worker restarted on new code (smoke -> ready via atomic RPC); Docker = operator step.
- Gate 11: E2E hardened + 5 passed / 2 skipped, attempt-level retry verified, zero errors.
- Final review: all suites green; only pre-existing baselines (5 fixtures + 1 E501) remain.
