# P1 live verification — steer fix + meta blocklist (2026-09-11)

Live stack: dev Supabase project, ROCm sidecar on :8200, Intelligence service on :8000 (restarted to pick up the P1 code, `./full-app restart full`), detached worker restarted (`scripts/run-detached-ingestion-worker.sh`). Material: `ACCA APM Study Text` `80c8b138-b544-4095-8dc0-1c390ac70da2` (572 pages, 754 chunks).

## 1. Retrieval probe — the steer fix

`uv run --package intelligence python services/intelligence/scripts/diagnose_generation_context.py <material> "<steer>"` (sidecar query embedding + `match_content_chunks`, top_k 5 — the path `context.build_context` takes).

| steer | retrieved ordinals and heads |
|---|---|
| `ACCA APM Study Text, budgeting` (pre-fix shape: title + tag) | 753 index, 0 cover, 67 chapter-1 boundary, 49 syllabus intro, 24 "The examination / Approach to examining the syllabus" — **5/5 front or back matter** |
| `Chapter 5 Budgeting and control` (P1 shape: section label) | 203 "Chapter 5 Budgeting and control 124 ... 1 Common knowledge", 271 "Budgeting and control 170 ... Bottom-up control ... top-down budgeting", 204 "Chapter 5 ... 3 Introduction to budgeting 3.1 What is a budget?", 269 "Chapter 5 ... 169 ... rolling budgets", 202 "and weaknesses of alternative budgeting models and compare such techniques as fixed and flexible, rolling, activity based, zero based and incremental" — **5/5 Chapter 5 body text** |

The printed contents page is chunk ordinal 4 ("Chapter 5 Budgeting and control 123"), so the label P1 steers on is the document's own section title.

Empty-steer hole (measured, drove D-08): steer `""` returns ordinals 393 `'likes'.`, 259 `produced.`, 90 `GU.`, 532 `369`, 344 `necessary.` — fragments. An empty steer is therefore refused in code, not embedded.

## 2. Real generation A/B — real retrieval, real prompt, real model

`scripts/diagnose_generation_context.py` proves retrieval only, so the same two steers were driven through the fixed code end to end: `context.build_context` -> `prompts.build_messages` (with `META_BLOCKLIST`) -> `mcq_schema` bound to the retrieved ids -> the real `OpenRouterGenerationClient` (`deepseek/deepseek-v4-flash-0731`, reasoning off, temp 0.3).

Arm A — pre-fix steer `("ACCA APM Study Text", "budgeting")`, outcome `ok`, 15.7 s:

> Q: In the context of budgeting, which statement best describes Zero Based Budgeting (ZBB)?
> 1. It requires every cost to be justified from a zero base, as if the activity were new. (correctIndex 1)

Arm B — P1 steer `("Chapter 5 Budgeting and control",)`, outcome `ok`, 10.6 s:

> Q: In the context of budgeting approaches, which statement best describes a top-down budget?
> 0. A budget that is imposed on the budget holder by senior management and controlled by them. (correctIndex 0)

Reading:

- The blocklist holds in both arms: no question about the examination, the syllabus, marks, duration or the study text — the failure mode the ticket was opened for (25/25 stored questions) is gone even when the context is entirely front matter.
- The steer fix is what makes the question **grounded**: arm A's context is the index/cover/contents, so "ZBB" there is only an index line ("Zero Based Budgeting (ZBB).....133") and the correct answer is the model's own knowledge of the term. Arm B's context is Chapter 5 body text, and the stem-with-options follows the "top-down budget" passage at ordinal 271.
- Therefore P1 alone is not sufficient for an unscoped request: the blocklist stops meta questions but cannot manufacture grounding. Page scope (P2/P4) is what closes that half.

## 3. Test suites

- Focused: `pytest tests/test_generation_context.py tests/test_generation_prompts.py tests/test_generation_worker.py tests/test_assessments_api.py tests/test_generation_models.py tests/test_generation_validation.py` -> **139 passed**.
- Whole service: **509 passed, 7 failed** — the identical 7 failures on the untouched base (503 passed there): 2 `test_retrieval_probe.py` (`ModuleNotFoundError: No module named 'services'`, an invocation-path artefact) and 5 `test_v1_integration.py` calibration goldens (`timeOfDay: 'afternoon' != 'evening'`, the known WSL TZ flake). No new failures; 6 new tests in the delta.

## 4. Reproduction

```
# retrieval
uv run --package intelligence python services/intelligence/scripts/diagnose_generation_context.py \
  80c8b138-b544-4095-8dc0-1c390ac70da2 "ACCA APM Study Text, budgeting" "Chapter 5 Budgeting and control"

# pre-fix vs P1 generation A/B (ad-hoc script, not committed)
uv run --package intelligence python /tmp/p1_live_ab.py
```

Not run: the browser/API click-through. `.work/specs/test-login-cred.txt` no longer satisfies Supabase's password grant (`invalid_credentials` with both the service-role and publishable apikey), so the authenticated `POST /v1/assessments/generate` path was exercised by unit tests only (`test_assessments_api.py`, 2 new route cases) and the generation proof above runs the same worker objects directly.
