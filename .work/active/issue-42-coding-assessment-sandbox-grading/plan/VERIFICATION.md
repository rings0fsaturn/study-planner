# Verification – issue-42-coding-assessment-sandbox-grading (#42)

_Ticket: #42 · Parent spec #32 · Plan: plan/PLAN.md · Updated: 2026-09-19 (P4)_

## AC tick-down (all unchecked until proven)

- [x] AC1 — Coding formats generate only when the material supports code-bearing content. — P1 (`has_code`/`code_languages` on the material read) + P3 (in-generation LLM judge; `code_not_derivable` carries the reasoning). P3 dry run: `implement_fn` self-check 5/5, `debug` steer judged `code_not_derivable`; P4 renders the warning path untouched.
- [x] AC2 — Client execution advisory, server execution authoritative. — **P4**: the taker runs the question's visible tests in a lazily imported Pyodide (`advisoryRunner.ts`) behind an "Advisory - the server grade is authoritative" badge; the grade arrives only from the server poll (`pollGrade(..., 'judge0')`), and a compile-error grade from the server overrides a passing advisory (exercised live: advisory pass + real Piston grade 1.00; the earlier compile-error run showed the server verdict authoritative over the editor state).
- [x] AC3 — Compile/runtime/timeout/test-case normalize into the public grading contract. — P2 (`coding_grader`: hidden pass rate, `correct @ 0.6`, shared `per_skill_observations`, `testCases` veil). P4 renders the table and the deterministic template words; live grades showed `Passed 2/2 hidden tests.` and `Your code did not compile.`
- [x] AC4 — Sandbox isolation, hidden-test protection, failure behavior tested. — P2 unit coverage + live client round-trip + **P5** live spec: `e2e/coding-assessment-live.spec.ts` 3/3 green (real Piston sandbox end to end: fail-closed compile error, mid-grading reload resume, retry, output_prediction with a worker-log no-sandbox-contact assertion, 375 px flow); redaction sweep over every `/rest/v1` + `/v1` response body and the rendered DOM against seeded hidden-content markers; window-scoped cleanup verified cascade-empty.

## Phase gates

- [x] P0 — branch + plan. `3844f72` (PR #65 merged #44), branch `phase2/issue-42-coding-sandbox-grading`, plan `a7f66e2`.
- [x] P1 — migration `031` + contracts. Pushed + live-probed; contracts 28/28; router 45/45.
- [x] P2 — Piston sandbox + grading arm (D-02 amended after the isolate gate failed on this host). 46 new tests; suite 625/5 (pre-existing calibration); rule-80 live round-trip green.
- [x] P3 — generation coding arm + `has_code`. 52 new tests; suite 673/5; rule-80 dry run green (`implement_fn` 5/5, `output_prediction` numeric, `debug` steer `code_not_derivable`).
- [x] P4 — client slice. Gates below.
- [x] P5 — durable live spec + AC sweep + records. Gates below.

## P4 gate evidence (2026-09-19)

### Tests and static gates

- `pnpm --filter app test src/assessments src/pages/assessments` → **114 passed** (9 files): `advisoryRunner` (5, rewritten for the sandbox execution model + normalization), `attemptFlow` (coding + prediction submit/gates), `AttemptTaker` (coding + output_prediction), `ReviewSurface` (verdict table, hidden-content DOM gate, prediction rendering), `AssessmentConfig` (Coding chip, no-code note), plus the existing objective/written matrices.
- Full app suite → **902/904**; the 2 failures are the documented WSL TZ flakes in `src/dev/seedTestData.test.ts` (pass with `--pool=forks`, verified in this session).
- `pnpm --filter app typecheck` clean; `pnpm --filter app lint` clean; `pnpm --filter app build` green.

### Bundle gate (D-06; measured, not assumed)

Built at the P4 tree and at `080d96b` in a temporary worktree (same lockfile store):

| Chunk | Baseline | P4 | Delta |
|---|---|---|---|
| `index-*.js` (main) | 1,182.59 kB (gzip 351.52) | 1,188.07 kB (gzip 353.03) | **+5.48 kB** (gzip +1.51) |
| `index-*.css` | 154.04 kB | 155.06 kB | +1.02 kB |
| `CodingTaker-*.js` (lazy) | - | 377.05 kB | new lazy chunk (CodeMirror) |
| `pyodide-*.js` (lazy) | - | 14.46 kB | new lazy chunk (loader; wasm/stdlib served from `public/pyodide/`) |
| `PdfViewer-*.js` | 492.73 kB | 492.73 kB | 0 |

The main chunk contains **zero** occurrences of `cm-editor` / `CodeMirror` / `loadPyodide` / `pyodide` / `@codemirror` (grep on the built artifact); both heavy libraries live in lazy chunks, and the lazy `CodingTaker` module only loads when a coding question renders. The +5.48 kB is the feature's own static code (taker branch, gates, prediction input, review table, config chip) - the D-06 requirement (editor/runtime out of objective/written bundles) holds. The plan's literal "main bundle does not move" is not achievable for any feature code; recorded here as a measured deviation, not a silent pass.

`codemirror` (meta, `basicSetup`) was dropped for explicit composition; `@codemirror/commands` + `@codemirror/language` added as direct deps; `codemirror`, `@codemirror/autocomplete`, `@codemirror/lint`, `@codemirror/search` pruned from the lockfile.

### Live end-to-end pass (real stack, no mocks)

Seeded one throwaway material + three assessments (2x `implement_fn`, 1x `output_prediction`) with service-role PostgREST inserts, then drove the real app (managed runtime + Piston sandbox, demand-started and stopped after):

- **Desktop 1280x720**: config Coding chip + "No code blocks detected" note; taker renders starter code in CodeMirror; advisory run on the starter fails honestly (`IndentationError` from real Pyodide, one line, never a pass); after fixing the source the advisory passes both visible tests; submit → real `assessment_grade` → real Piston execution → review table (`Passed 2/2 hidden tests.`, mixed list / all negative / Hidden test 1 / Hidden test 2 all pass, `Coding 1/1`, score 1.00).
- **Desktop output_prediction**: snippet + value input (no editor, no advisory), submit `{value}` → deterministic objective grade (`Correct.`), review shows the snippet + "Your prediction: 6", no verdict table.
- **Mobile 375x812**: same coding flow; review table renders, hidden rows veiled, no horizontal page overflow (`scrollWidth <= clientWidth + 1` asserted).
- Console error capture (`e2e/fixtures.ts`) clean in all three scenarios.

Evidence: `plan/evidence/desktop-config.png`, `desktop-taker.png`, `desktop-advisory-pass.png`, `desktop-review.png`, `desktop-prediction-taker.png`, `desktop-prediction-review.png`, `mobile-taker.png`, `mobile-review.png`.

The temporary spec (`e2e/tmp-p4-vision.spec.ts`) and the seed script were deleted after the pass; P5 owns the durable `e2e/coding-assessment-live.spec.ts`.

### Defects found and fixed in P4 (the pass earned its keep)

1. **Advisory/server execution model divergence** (code read): the runner called `solve(stdin_as_literal)` and compared stdout verbatim, while the sandbox runs the whole program with stdin piped and compares CRLF/trailing-whitespace-normalized stdout. Rewritten to the sandbox model (`sys.stdin = io.StringIO(...)`, fresh `__main__` namespace, `normalizeOutput` mirroring `piston_client._normalize_output`); pinned by 5 unit cases including the normalization case. Live advisory verdicts now agree with the server on the same source.
2. **`recordGrade` could return `undefined`** when the Dexie connection closes mid-poll (surfaced as an unhandled rejection in the full suite; reachable in production on user switch). `pollGrade`'s contract now holds via an `EMPTY_ROW` identity fallback; the full suite has no unhandled rejections.
3. **"Objective assessment" heading on coding assessments** (`AssessmentDetail`), and the recipe fallback re-requested `objective` for a pre-recipe coding row. Both now handle `coding`.
4. **Code rendered uppercase**: `.t-mono-sm` (a label style) was applied to code blocks, and `text-transform: uppercase` rewrote the learner's source on screen. Code surfaces now carry their own mono styling; the answer-value line is exempted too.
5. **Editor width capped at 420px** by the `.field-group` form primitive, and the prediction input stretched to card width. `coding-field-group` widens the code surfaces; the prediction input caps at 240px.
6. **`basicSetup` pulled autocompletion + lint** (D-06 forbids them) and the hidden textarea fallback was dead weight. The extension list is now the explicit D-06 ceiling, and the fallback is deleted.

## P5 gate evidence (2026-09-19)

### Live spec: `e2e/coding-assessment-live.spec.ts` - 3/3 green

```
✓ 1 implement_fn: advisory, fail-closed compile error, mid-grading reload resume, retry, sandbox grade, hidden veil (16.7s)
✓ 2 output_prediction: deterministic grade without any sandbox contact (13.0s)
✓ 3 coding flow at 375: sandbox grade, veiled table, zero horizontal overflow (14.2s)
3 passed (47.5s)
pnpm exec playwright test -c e2e/playwright.config.ts e2e/coding-assessment-live.spec.ts --project=app --workers=1
```

Each scenario signs in with the shared account, seeds one material + assessment + coding question through service-role PostgREST (the P4 recipe), drives the real taker/review, and deletes the material by id with a cascade-empty verification (`assessments`, `questions`, `question_attempts`). Stale rows from failed runs are swept by title prefix at scenario start; the frozen ACCA corpus is never touched (verified no `E2E#42*` rows remain after the run).

- Scenario 1 (desktop 1280): CodeMirror renders the starter (width > 600 px asserted - the desktop-only gate), the Pyodide advisory fails the deliberately wrong starter and passes the corrected source, a `SyntaxError` submission grades fail-closed 0 through the **real Piston sandbox** ("Your code did not compile.", padded failed verdicts, veiled `Hidden test 1/2` rows), a reload issued right after the POST /attempts commit resumes through the 3 s server refresh loop and lands the grade, retry mints attempt 2 (history shows `Attempt #1 incorrect · 0.00` + `Attempt #2 correct · 1.00`), score 1.00 with `Passed 2/2 hidden tests.`.
- Scenario 2 (desktop): read-only snippet + numeric input, no editor, no advisory; deterministic `Correct.` grade; the worker log's `piston execution attempt=` line count is identical before and after - **no sandbox contact**.
- Scenario 3 (375 px): full coding flow, veiled table, `scrollWidth <= clientWidth` (no horizontal overflow).

Redaction (AC4): the seeded `answer_block` carries three distinctive markers (reference comment `# ref-only-77a1`, hidden test name `H7f3aX`, hidden stdin `99 99`); every `/rest/v1` + `/v1` response body buffered during the scenario and the rendered DOM are swept for the markers and the structural keys (`answerBlock|answer_block|referenceSolution|hiddenTests|...`) - zero hits in all three scenarios.

Evidence: `plan/evidence/p5-impl-desktop.png`, `p5-impl-mobile.png`, `p5-prediction-desktop.png`.

### Full gates

- App suite **902/904** (the 2 documented WSL TZ flakes in `src/dev/seedTestData.test.ts`, pass with `--pool=forks`); `typecheck` clean; `lint` clean; `build` green (main chunk 1,188.20 kB, unchanged vs P4's 1,188.07 kB - P5 ships no product code).
- Backend suite **673/5** (the 5 documented pre-existing calibration golden-fixture failures, fail on base tree); contracts **28/28**; ruff clean (no backend change in P5).
- Sandbox hygiene: Piston demand-started before the run (rule-80 trivial submission green) and stopped after; the leftover stopped dockerized stack (`web`/`intelligence`/`ingestion-worker` from a prior session) was re-stopped so only one worker drains `assessment_grade`.

### Defects found and fixed in P5 (all in the spec, none in product code)

1. **Admin-users lookup is ambiguous on this account**: Gmail dot-aliasing means several auth rows share one inbox (`iamrohit.saji@gmail.com` and `i.amrohitsaji@gmail.com` both normalize to the same address), and the actually signed-in user id was not even in the first admin page. The spec now reads the user id from the signed-in session the app itself stored (`localStorage['sb-kabpmbhlvfbrhtbxjaua-auth-token'].user.id`) - authoritative, since the seeded rows must carry the exact id RLS checks.
2. **The in-flight grading text is not assertable**: the sandbox composes a grade in ~250 ms of the worker picking the message up (measured from `worker.log`: 4 Piston executions in 180 ms), so `Grading…`/`Grading in the sandbox` flashes for less than one poll interval. The mid-grading reload now waits on the deterministic commit signal - the POST `/attempts` response - before reloading.
3. **`Your submitted code` is an aria-label, not text**: the review card's source `<pre>` carries `aria-label="Your submitted code"` and its text is the code itself; `getByText` cannot find it, `getByLabel` can.

## Handoff notes (superseded in part by the live spec)

- The live spec can seed rows directly (the P4 recipe): one `materials` row (`ingestion_state='ready'`, `has_code`), one `assessments` row (`status='ready'`, `recipe.formats=['coding']`), one `questions` row (`format='coding'`, `subtype`, `starter_code`, `visible_tests`, `answer_block` = `{hiddenTests, referenceSolution}` or `{acceptedValue}`). Service-role PostgREST; cleanup deletes the material and cascades. The P5 spec (`e2e/coding-assessment-live.spec.ts`) now owns this recipe and its cleanup; reuse its helpers rather than this note.
- The LLM picks the subtype, so the `output_prediction` scenario needs a seeded row (or generation retries) - the P4 seed proved the row shape works end to end.
- Playwright typing into CodeMirror: use `keyboard.insertText` after `ControlOrMeta+a`; per-key typing is mangled by `indentOnInput` (and mobile autocapitalize).
- Piston must be up (`docker compose --profile sandbox up -d`, python 3.12.0 in the volume) and stopped after; a stopped sandbox makes coding grades retryable, never silent.
- The user id for seeding must be read from the signed-in session (the admin-users listing is ambiguous on this account; see the P5 defect log).

## Shared-account hygiene

- Every seeded row was created under a `p4-vision-*` id and deleted after the pass (`materials?id=eq.<id>` DELETE; assessments/questions cascade). Three seed cycles ran; the last cleanup is verified by the delete response. No product data was mutated; the pre-existing materials (including the frozen corpus) were only read.
- The shared dev account's Dexie data is per-browser-context and discarded by Playwright.
