# PLAN - #45 Coding Practice Runs

_Spec: GitHub [#45](https://github.com/rings0fsaturn/study-planner/issues/45) · Map: [#4](https://github.com/rings0fsaturn/study-planner/issues/4) · Branch: `phase2/issue-45-coding-practice-runs` · Base: `project/phase-2` · Opened: 2026-09-21_

## What to build

Resumable coding Practice runs on the shared shell: configure a coding or mixed run,
start / pause (leave-and-return) / resume / complete it, get safe client advisory feedback,
authoritative server sandbox grading, per-question review, and mastery updates.

## Ground truth (verified, not assumed)

- The coding plumbing already exists end to end: `AttemptTaker.tsx:143-184` dispatches coding
  (`CodingTaker` lazy, `OutputPredictionTaker`), `grading/worker.py:370-449` grades coding
  (`judge0`), `output_prediction` bypasses the sandbox through `grade_objective`.
- `PracticeThis.tsx:20-25` pins the run to written (`FOCUS='Written'`, `FORMAT='written'`);
  the Focus chips render but only Written is enabled (`:285-296`).
- The server admits exactly one family per generation call and `questionCount == 1`
  (`services/intelligence/app/routers/assessments.py:41`). An N-problem run is N calls
  (D-06, #44), concurrency 2.
- `PracticeRunStartedPayload.mode` is `'written'` (`sync/types.ts:100-106`); the event is
  local-only (no durable-events schema), so widening it needs no migration.
- `QuestionNavigator` renders `group.question.format` in each tab
  (`ReviewSurface.tsx:297`), and `PracticeRun.tsx:247` hardcodes `format:'written'` for the
  pending placeholder - so a coding run's navigator currently mislabels its own problems.
- `code_not_derivable` fails the assessment (`generation/worker.py:421-449` →
  `update_assessment_status(..., "failed", warnings)`), and the run shell already renders that
  state with the server's reason (`PracticeRun.tsx:503-518`).

## Decisions

- **D-01 Focus model.** Config gains `focus: 'written' | 'coding' | 'mixed'`. Every call still
  carries exactly one family: `formats: [familyFor(index)]`. Mixed alternates by planned index,
  `index % 2 === 0 ? 'written' : 'coding'`.
- **D-02 Pointer widening + backward compatibility.** `mode` widens to
  `'written' | 'coding' | 'mixed'`; a new optional `families: AssessmentFormat[]` is aligned
  with `assessmentIds`. The reader falls back to `mode === 'coding' ? 'coding' : 'written'` when
  `families` is absent, so every existing pointer stays readable (rule 30, additive).
- **D-03 Honest navigator.** A pending problem's placeholder format comes from the pointer's
  `families[index]`, never a hardcoded `'written'`.
- **D-04 Family is visible.** The run panel and the summary both label the problem's family.
- **D-05 Unsuitable-material honesty.** The config shows the `hasCode === false` note for coding
  and mixed focus (the `AssessmentConfig.tsx:262-264` pattern). A problem whose generation failed
  offers `Retry generation` (re-enqueue the same assessment through the existing #44 path),
  so one bad problem cannot make a run uncompletable.
- **D-06 Advisory vs authoritative (AC2).** Unchanged: Pyodide over visible tests only; the
  server grade is the only grade. No client result ever reaches the grade.
- **D-07 Mastery (AC3).** Unchanged wiring: coding grades are ordinary `question_attempts` rows,
  so `/v1/mastery` rebuilds from them with no parallel model. The run refreshes projections on
  every graded row and the summary advises the next band (advisory only, `bkt-v1`).
- **D-08 No backend change expected.** The coding generation arm, grading arm, and 031 columns
  already exist. Any service change is a recorded deviation, not scope.
- **D-09 Two independent round-robins.** Materials round-robin (`materialIds[i % M]`) and, for
  Mixed, family alternation (`i % 2`). No multi-material synthesis (#44 D-12 stays out).

## Phases

### P0 - open (done 2026-09-21)
- Claim #45, create the task folder, add the STATUS row, seed `state.md` + `SCRATCHPAD.md`.
- Cut `phase2/issue-45-coding-practice-runs` from `project/phase-2`.

### P1 - configure a coding/mixed run
- `sync/types.ts`: widen `PracticeRunStartedPayload.mode`, add `families?: AssessmentFormat[]`.
- `PracticeThis.tsx`: Focus becomes real state (`written | coding | mixed`); per-call
  `familyFor(index)`; `families` on the pointer; `hasCode === false` note; generation progress
  copy names the mix.
- Tests: `PracticeThis.test.tsx` - coding call carries `['coding']`; mixed alternates
  `['written'], ['coding'], ['written']`; no request ever carries two formats; legacy pointer
  without `families` still reads.

### P2 - the run shell
- `practiceRunModel.ts`: carry `family` on each `PracticeRunProblem` (from `families` with the
  legacy fallback).
- `PracticeRun.tsx`: pending placeholder uses the problem's own family; panel meta shows the
  family tag; the `failed` branch offers `Retry generation`.
- Tests: `practiceRunModel.test.ts` (family derivation + legacy fallback), `PracticeRun.test.tsx`
  (coding placeholder label, failed-problem retry, sandbox grading copy).

### P3 - summary + mastery
- `PracticeSummary.tsx`: label each problem's family; coding problems render `CodingFeedback`
  through the existing `ProblemBody` (no fork).
- Confirm the mastery refresh counts coding grades (it counts graded local rows, family-agnostic).
- Tests: summary renders coding verdicts; mastery refresh fires on a coding grade.

### P4 - gates
- `pnpm --filter app test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (bundle delta recorded;
  CodeMirror/Pyodide must stay lazy).
- `uv run pytest` for the service; contracts `test_contracts.py` (expected unchanged).

### P5 - live E2E + impeccable pass
- New `e2e/coding-practice-run-live.spec.ts`, modelled on `practice-run-live.spec.ts`:
  a code-bearing seed material (not the prose ACCA corpus, because coding generation is gated on
  `has_code` + the `code_not_derivable` judge), one `implement_fn` graded through Piston, one
  `output_prediction` (no sandbox contact), a 375 px leg, reload-resume mid-run, abandoned-run
  zero-observation, the redaction sweep, and window-scoped service-role cleanup.
- Impeccable Operate refinement, one bounded pass at 1280×720 and 375×812: Focus chip affordance,
  family labeling, editor density inside the run panel, the failed-problem recovery action.

## AC map

| AC | Where it lands |
|---|---|
| Configure / start / pause / resume / complete | P1 (focus + per-call family), P2 (leave-and-return resume, retry, finish) |
| Client feedback never the grade | P2 (advisory copy + no client grade path; unchanged `judge0` authority) |
| Sandbox outcomes + per-skill observations | P3 (mastery refresh on coding grades), P5 (live `implement_fn` grade) |
| Refresh / reconnect / timeout / abandoned tested | P2 (refresh + reconnect), P5 (live reload-resume, sandbox timeout grade, abandoned zero-observation) |

## Verification

- Focused vitest per phase, then the full app suite; 2 documented WSL TZ flakes
  (`dev/seedTestData.test.ts`) are pre-existing and pass under `--pool=forks`.
- typecheck / lint / build green; main-bundle growth measured, CodeMirror + Pyodide lazy only.
- Live stack: `./full-app start full` (intelligence + app + worker), Piston
  (`docker compose --profile sandbox up -d`) and the Qwen3 sidecar on `:8200` demand-started,
  both stopped after (rules 54, 80, 16).
- Shared account cleaned by window; the frozen ACCA material never deleted.

## Risks

- Coding generation is stochastic and can return `code_not_derivable`; the live spec must force a
  gradeable subtype (seed or retry), not assume one.
- Playwright + CodeMirror needs `keyboard.insertText` after select-all (`indentOnInput` mangles
  per-key `type()`).
- Vite on `/mnt/d` does not reliably watch source: restart the runtime before any browser pass
  (rule 53).
