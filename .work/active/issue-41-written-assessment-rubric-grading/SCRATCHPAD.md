# Scratchpad – issue-41-written-assessment-rubric-grading · session 2026-09-11 (P5 live pass)
_state.md: active/issue-41-written-assessment-rubric-grading/state.md · Updated: 2026-09-11T04:12_

## Now / Next
- Doing: Phase 5 complete — live pass 4/4 green with both live-found defects fixed; records distilled into `state.md`, `STATUS.md` refreshed
- Next: the wayfinder exit — commit the P4/P5 work, post the resolution comment on #41, close it, map #4 Decisions-so-far line, flip STATUS to Done, archive the folder (awaiting the user's go, since it writes to GitHub)
- Blocked: none

## Session log
- 02:04 UNBLOCKED P5 · hosted Supabase dev project healthy again (`auth/v1/health` 200 0.35s, `auth/v1/user` 200 0.35s, `rest/v1/assessments|questions` 200, password sign-in OK) — the P4-session degradation is gone
- 02:05 FOUND  `/tmp/p5-supacheck.sh` probes must strip backticks as well as quotes from `.work/specs/test-login-cred.txt`, or the password carries a stray backtick and sign-in answers `invalid_credentials` (a false "Supabase broken" signal)
- 02:06 EDIT   runtime restarted (`./full-app start full`) + detached worker (`setsid nohup`, rule 53) — the earlier "stale pid" state was why nothing generated
- 02:08 FOUND  generation retrieves through the GPU sidecar; a stopped sidecar fails every generation with `embedding sidecar request failed: [Errno 111] Connection refused` (sidecar was `Exited (0)` 12 h) — started it, `/health` shows `cuda_available: true`, RX 9070 XT, both models loaded
- 02:10 FOUND  `pnpm test:e2e -- <spec> --project=app --workers=1` silently DROPS every option after `--` (the CLI reads them as test-file filters): Playwright ran **6 tests on 6 workers across both projects**, defeating the file's one-worker design (rules 16/10)
- 02:11 EDIT   `e2e/assessment-written-41-live.spec.ts` – docstring command corrected (no `--` separator) – verified
- 02:15 FOUND  the written answer label reads uppercase in `innerText` (`YOUR ANSWER (SHORT ANSWER)`) because CSS `text-transform: uppercase` applies; assert case-insensitively
- 02:25 FOUND  the `Attempt history` block only exists once a question has actually been retried, so the retry scenario must first settle on the graded card, then click Retry, then assert two rows
- 02:36 FOUND  written generations drop at the citation gate: the model cites a `chunkId` that is not in the retrieval context and `_verified_citations` returns `citation_missing` with **no repair pass** (`validation.py:142`; pinned by `test_generation_worker.py:480` "no repair for citation-gate failures")
- 02:40 FOUND  the provider call can take 146.6 s against `GENERATION_TIMEOUT_MS=30000` (measured live, `generation_telemetry.latency_ms=146644`), so the configured timeout is not an end-to-end deadline — the live spec's wait must be sized for that (now 300 s per attempt)
- 03:05 DECIDED scenarios are self-contained (each generates its own assessment): Playwright restarts the worker process after a failure, which resets module state and turns `test.skip(assessmentId === '')` into a silent SKIP in the very tests that were meant to verify the retry path (observed: run 6 reported 1 failed / 1 passed / 2 skipped)
- 03:33 FOUND  live defect — a failed generation's "Retry generation" re-requests `objective`: `AssessmentDetail.tsx:385` derived the family from `assessment.questions[0]`, which does not exist when generation failed; `difficulty: 3` and `skillTags: ['core']` were hardcoded there too, so a retry also dropped the learner's band and tags. Evidence: `written-v1 malformed_output` → retry → `v1 ok`, assessment stored `recipe.formats ["objective"]` (02:49 and 02:52)
- 03:38 EDIT   retry fix – `routers/assessments.py` echoes the stored `recipe`; `Assessment.recipe` added to openapi + client types; `AssessmentDetail` reuses it (fallback to the question for older rows) – RED proven both sides (`expected ['objective'] to deeply equal ['written']`; `KeyError: 'recipe'`)
- 03:41 DONE   P5 gates: service **502 passed / 7 failed** (the documented pre-existing set), contracts **20 passed**, app **758 passed / 2 failed** (the WSL TZ pair, **2/2 green under `--pool=forks`**), `tsc` + `eslint` clean, `ruff` at the recorded baseline (1 pre-existing E501)
- 03:44 FOUND  the real blocker: every written generation in run 8 failed with the **same invented id** `926625234438fbd0a6368380ee4e1` (4 consecutive retries), so "Retry generation" could never succeed; written arm is **5 ok / 14 attempts** today
- 03:45 EDIT   enum fix – `mcq_schema(citation_ids)` / `written_schema(citation_ids)` bind `citations[].chunkId` to the retrieved ids; the worker builds the schema per message (main + repair path); no unconstrained module-level schema remains – verified by 55 focused tests + ruff clean
- 03:45 DONE   live probe (one real provider call, `/tmp/enum_probe.py`): provider ACCEPTS the nested enum under strict mode (outcome `ok`, 9.4 s) and returned only in-context ids — the enum is enforceable, not just advisory
- 03:46 NEXT   re-run `e2e/assessment-written-41-live.spec.ts --project=app --workers=1` with the enum-bound schema
- 03:52 BLOCKED run 9 failed again with the SAME invented id · the worker process (started 02:08) predated the 03:45 enum edit — uvicorn `--reload` reloads the HTTP service but NOT the detached worker, so the live run exercised the old schema
- 03:55 UNBLOCKED killed the stale worker (pids 3294/3297) and started a fresh detached one; the next two written generations answered `ok` back to back
- 04:01 DONE   run 10 green: `4 passed (4.3m)`; every assessment created kept `recipe.formats ['written']` (including the steered `long_form` ones with their skill tags); 5 evidence screenshots written
- 04:03 DONE   gates re-run with both fixes: service 503 passed / 7 pre-existing, contracts 20 passed, app 758 passed / 2 (WSL TZ pair, 2/2 under `--pool=forks`), `pnpm typecheck` + `pnpm lint` clean, ruff at the recorded baseline
- 04:10 EDIT   records distilled — `plan/PLAN.md` P5 Notes (deviations a/b/c) + Phase 5 complete; `plan/VERIFICATION.md` P5 ticked, AC1–AC4 ticked, evidence listed, P4 line corrected; `state.md` (current state, done-so-far, files, pitfalls, decisions, open); `STATUS.md` row refreshed
- 04:12 NEXT   wayfinder exit (resolution comment + close #41 + map #4 line + STATUS Done + archive) plus the commit/push decision — both write outside the repo, so they need the user's go
