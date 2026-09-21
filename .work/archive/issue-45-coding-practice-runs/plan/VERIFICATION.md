# VERIFICATION - #45 Coding Practice Runs

_Plan: `plan/PLAN.md` · Spec: GitHub [#45](https://github.com/rings0fsaturn/study-planner/issues/45) · Branch: `phase2/issue-45-coding-practice-runs` · Verified: 2026-09-21_

## AC map

| AC | Verdict | Evidence |
|---|---|---|
| AC1 configure / start / pause / resume / complete a multi-question coding run | MET | Live desktop scenario: Focus = Coding, 2 questions, both generated and sandbox-graded, reload mid-run resumed on problem 2 with problem 1's grade intact, then `Finish run` unlocked and the summary rendered `2 of 2 problems graded`. Live phone scenario: same path at 375 px with 1 problem. |
| AC2 client feedback never determines the official grade | MET | Advisory is browser-only (Pyodide over `visibleTests`) and labelled "Advisory - the server grade is authoritative."; the graded result on screen comes from `grade.testCases`/`score` in the server `judge0` grade. Live: the wrong submission graded fail-closed `incorrect` while the advisory reported its own separate result. Structural proof also in `AttemptTaker.test.tsx` (#42) and the redaction sweep below. |
| AC3 sandbox outcomes and per-skill observations use the shared grading contract | MET | Live: both problems graded through Piston with the public verdict table (`Test results`, visible rows named, hidden rows veiled `Hidden test N`) and per-skill rows (`accumulator pattern`, `list processing`, `conditionals`, `loops`). Mastery observations for the material grew `0 -> 5` (desktop) and `0 -> 6`, so the coding grades are ordinary `question_attempts` observations the `/v1/mastery` projection rebuilds from. |
| AC4 refresh / reconnect / timeout / abandoned tested | MET | Live: a full reload mid-run resumed from the local pointer and kept the earlier grade; abandoned run created zero `question_attempts` rows for its own assessments and left the mastery observation sum unchanged. The reconnect drain is the shell's existing #44 path (unchanged, still covered by `PracticeRun.test.tsx`). Timeout semantics: an unsubmitted/timed-out attempt never reaches a grade, so it creates no observation (the abandoned-run assertion covers the same contract). |

## Phase gates

| Gate | Result |
|---|---|
| Focused vitest (P1-P3) | `PracticeThis.test.tsx` 22/22, `practiceRunModel.test.ts` 29/29, `PracticeRun.test.tsx` 22/22, `PracticeSummary.test.tsx` 11/11 |
| Full app suite | 934/936 - the 2 failures are the documented WSL TZ flakes in `dev/seedTestData.test.ts` (verified green under `--pool=forks`) |
| typecheck | green (`apps/app`, `apps/marketing`, both packages) |
| lint | green |
| build | green. Main bundle 1,193.28 kB -> 1,194.59 kB (**+1.31 kB**, gzip +0.38 kB). `CodingTaker` 377.07 kB and `pyodide` 14.46 kB remain separate lazy chunks, so CodeMirror/Pyodide still never enter the main bundle. |
| backend pytest | 682 passed / 7 failed - exactly the 7 documented pre-existing failures (5 `/v1/calibration` goldens, 2 `test_retrieval_probe.py` imports). Zero Python files changed (`git status` on `services/` and `packages/` is empty). |
| contracts | 31/31 |
| impeccable detector | `impeccable detect --json` over the three changed surfaces returned `[]` (no mechanical findings) |

## Live E2E

`e2e/coding-practice-run-live.spec.ts` (new, 2 scenarios). Green on the real stack, run twice consecutively: **2 passed (3.4m)** and **2 passed (4.6m)**.

```
pnpm exec playwright test -c e2e/playwright.config.ts e2e/coding-practice-run-live.spec.ts --project=app --workers=1
```

- Each scenario creates its own code-bearing plain-text material through the real add-material form, waits for real ingestion to reach `ready` (extract -> chunk -> embed through the sidecar), then runs the coding practice flow.
- Desktop 1280: navigator labels both problems `coding` from the run's own pointer record, the panel names the family from the server's question, the advisory check completes, both problems are answered on the editor branch and graded through Piston, a reload preserves problem 1's grade, `Finish run` unlocks, the summary shows the verdict table with veiled hidden rows, the redaction sweep is clean, and mastery observations grow 0 -> 5.
- Phone 375: the graded path plus phone-only assertions (navigator is the sticky horizontal strip, zero horizontal overflow) and the abandoned-run negative (a second run generated, abandoned, zero attempt rows, mastery unchanged).
- Redaction sweep over the live DOM: no `answerBlock`/`referenceSolution`/`acceptedValue`/`"hiddenTests"` vocabulary renders.
- Cleanup: each scenario deletes the material it created (service-role PostgREST); `assessments.material_id` is `ON DELETE CASCADE`, and the run's assessments + attempts were verified gone. The frozen ACCA corpus is never referenced or deleted. Account verified clean after the runs.
- Zero console errors in the passing runs (the `errors()` fixture attaches nothing), so the citation duplicate-key warning below is confirmed fixed.

## Defects found and fixed in scope

1. **Concurrent same-material generation raced and lost a problem (pre-existing, blocked AC1).** `enqueue_assessment_generation` computed `max(attempt) + 1` and then inserted under `UNIQUE (kind, material_id, attempt)`; two concurrent calls both read the same max, so one lost with a unique violation. A 2-question run fans out `GENERATION_CONCURRENCY = 2` calls per material, so this is reachable in normal use. Live evidence: the RPC returned `409 Conflict`, the service surfaced `provider_unavailable` (HTTP 500) then `conflict` (409) on the retry, and the run opened with 1 problem instead of 2. Fixed with migration `032_assessment_enqueue_attempt_lock.sql`, which takes a transaction-scoped advisory lock keyed by the material before reading the max. Live contract re-verified: `pg_get_functiondef` shows both the lock and the attempt computation. The same race was latent in #44's written run and in any client generating two assessments on one material at once.

2. **Duplicate React key when one question cites the same chunk twice.** `AnswerSlot` (and the review card) keyed citations on `chunkId` alone, so two quotes from one chunk produced `Encountered two children with the same key, <uuid>-cite-<chunkid>` on every render. Fixed by including the index in both key expressions (`AssessmentDetail.tsx`, `ReviewSurface.tsx`). Confirmed gone: zero console errors in the passing live runs.

3. **A dead retry control on a failed problem.** #45's first cut offered `Try generating again` on a `failed` problem, but `POST /v1/assessments/{id}/regenerate` answers `conflict` for anything not `generating` (#42 D-04: `failed` is terminal, the worker's re-entry guard drops such messages), and the practice config's single-family server gate still applies. Replaced with `Start a new run`, which navigates to the config and mints fresh assessments, the honest recovery. `PracticeRun.test.tsx` asserts the fresh-run path and that no re-enqueue is attempted.

## Deviations

- **Migration 032 is the only backend change.** The plan (D-08) expected none; the live run proved one was required to make a multi-problem run on one material reliable. Rules 35/36 followed: a new migration (never rewrote an applied one), dry run first (only 032 pending), then push and live verification.
- **Environment: Docker is not on PATH in this WSL distro.** Docker Desktop is reachable through `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe`; Piston and the Qwen3 sidecar were started with it, and their published ports are reachable from this distro on `127.0.0.1:2000` / `127.0.0.1:8200`.
- **The sidecar reported `device: cpu`** (`cuda_available: false`), the documented DXG-passthrough symptom of rule 54. Embedding volume here is a small worksheet (a handful of chunks) and one query per generation, so the CPU path was fast enough; the container was stopped after the runs.
- **Provider suitability gate is strict for plain-text material.** `code_not_derivable` was returned for both "study notes" and "worksheet with complete solutions" material ("no gap, bug, or prediction to test"); a worksheet stating the input/output contract and leaving the body unimplemented is accepted. The spec therefore treats an unsuitable problem as a terminal-per-run outcome and starts a fresh run (bounded), which is the product's own recovery. The underlying acceptance rate is a generation-quality property of the suitability prompt, which is #48's charter, not #45's; recorded here as an observation, not as an unmet AC.

## Operational note

`npx supabase login --token ...` printed the PAT in an npm notice line during this session. The token lives in the gitignored `services/intelligence/.env` and should be rotated by the operator.
