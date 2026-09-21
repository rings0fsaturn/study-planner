# Coding generation: code-aware context + derived contracts

_Written: 2026-09-21 · Status: Complete - working tree (uncommitted) · Origin: #48 resolution finding · Parent spec: #32 · Map: #4 · Issue: #67 · Verification: `plan/VERIFICATION.md`_

## How to use this plan (read this first, agent)

This is an implementation plan, not a spec. Read the whole preamble before touching code.

1. **Read the decisions log first.** D-01..D-08 are load-bearing; several of them close off obvious-looking solutions. Do not "improve" past a decision without recording why.
2. **Work one phase at a time.** Each phase is a vertical slice sized for a fresh context window. A phase is done only when its own verification commands pass.
3. **Update the status marker in place** (`Not started` / `In progress` / `Blocked` / `Complete - <sha>`) as you go, and commit the plan file alongside the phase's code.
4. **Rules that apply to every phase:** `.agents/rules/42-assessment-and-practice-generation.agents.md` (one family per call, generation contracts), `.agents/rules/80-script-dry-run-before-full-runs.agents.md` (dry-run before any paid or full run), `.agents/rules/17-logging-and-tracing.agents.md` (logger + trace ids), `.agents/rules/54-gpu-inference-sidecar.agents.md` (demand-start and stop the sidecar).
5. **Ponytail governs the diff.** Reuse before new: the scorer extends `code_signal.py`, the selector extends `context.py`, no new service, table, column, or UI.
6. **The live stack is the source of truth.** Verify line numbers and behavior against the checkout; this plan was written 2026-09-21 and may have drifted.
7. **Never commit** `.env*`, tokens, hidden grading content, reference solutions, or raw material text into evidence.

## TL;DR

A code-rich material (`grokking-algorithms`, 260 chunks of an algorithms textbook) cannot produce a coding question: 3/3 coding generations were refused with `code_not_derivable`. The cause is not the material and not the model's capability. It is two gaps:

1. **Context gap.** The coding arm has no code-seeking retrieval. With no `skillTags` and no section label it falls back to an even spread of 5 chunks across the whole material (`context.py:95`), which lands on front matter and chapter summaries. The prompt then correctly reports that it cannot see an implementable task.
2. **Bar gap.** The suitability contract demands a "complete, self-contained problem statement with input/output specifications" and refuses when the chunks explain an algorithm without stating one. An algorithms textbook teaches algorithms; the I/O contract is derivable from the explanation, so refusing is the wrong bar.

The fix is code-aware chunk selection plus a reframed suitability contract, with the existing generation-time self-check as the correctness guard, and a bounded resample before any terminal refusal.

## Context (measured diagnosis, 2026-09-21)

Everything below was measured against the live stack during the #48 session. Reproduce before relying on it.

| Observation | Value | Source |
|---|---|---|
| Material | `b5f51eab-c11d-4505-80db-88bb3627801d`, "grokking-algorithms", 260 chunks, ready | `materials` |
| Coding assessments on it | 3, all `failed` with `code_not_derivable` | `assessments.warnings` |
| Their recipes | `{formats:[coding], pageStart:20,pageEnd:40}`, `{...pageStart:76,pageEnd:97}`, `{formats:[coding]}` (no scope, no skillTags) | `assessments.recipe` |
| Refusal reasons (verbatim) | "conceptual explanations and code snippets for quicksort ... lack a complete, self-contained problem statement with input/output specifications"; "introductory front matter and early chapter excerpts about binary search and big O notation ... no concrete coding examples"; "mostly front matter, chapter summaries, and brief excerpts" | `assessments.warnings` |
| Chunks containing a Markdown fence | **0 / 260** | `content_chunks.text like '%```%'` |
| Chunks with code keywords (`def `, `class `, `return`, `import`, `for .. in`, `while`) | **162 / 260** | `content_chunks.text ~ ...` |
| Chunks with a newline + 4-space/tab indent | **0 / 260** | `content_chunks.text ~ (chr(10) || '(    |\t)')` |
| `materials.has_code` | `NULL` | `materials` |
| #48 harness coding suitability | derivable rate 0.000, gold disagreement on this material | `research/doc/generation-quality-harness/report.md` |

Two derived facts matter:

- **Fences and indentation are destroyed by PDF extraction**, so the existing code signal (`scan_code_blocks`, fence-based, `code_signal.py:21`) reads `has_code=false` on a code-rich book. `has_code` is also `NULL` for materials ingested before migration 031, and `ingestion/worker.py:365` only sets it at ingestion time. It is documented as UI-only and is never consulted by generation, so this plan does not depend on it.
- **5 evenly-spaced chunks is ~2% of a 260-chunk material.** An even spread is a reasonable default for prose (it samples the book's breadth) and a bad default for code (it samples front matter, headings, and summaries, and misses the implementation listings).

Prior art already in the tree, same failure shape, different axis: `context.py:15-21` records that including the material title in the steer retrieved front matter 5/5 times, measured on the ACCA corpus, which is why the title is excluded from the steer. This plan is the coding-arm analogue of that fix.

## Decisions log

- **D-01 - Fix both gaps, not one.** Code-aware selection without a reframed bar still refuses when the selected chunks explain rather than state a task; a reframed bar without code-aware selection still refuses on front-matter draws. Decided with the user 2026-09-21.
- **D-02 - Bounded resample before a terminal refusal.** When the selected chunks look unsuitable, try up to 3 distinct windows, then refuse. The success path costs nothing extra; only the refusal path spends up to 2 extra judge calls. Decided with the user 2026-09-21.
- **D-03 - No schema change.** No `content_chunks` column, no migration, no re-ingest, no Dexie version. The code-proximity signal is computed in memory over candidate rows at generation time. Rationale: a stored column would need a backfill across every existing material and a second source of truth to keep in sync, for a signal that only the coding arm reads.
- **D-04 - Keep the refusal path.** `code_not_derivable` stays a legitimate outcome for a genuinely codeless draw. This plan makes it rarer and more honest, it does not delete it. A material with no code must still refuse rather than fabricate.
- **D-05 - The generation-time self-check is the correctness guard, unchanged.** A question whose reference solution fails its own tests already fails at generation (`worker.py:642`), so a derived contract that does not execute cannot reach the learner. That guard is what makes D-02's looser bar safe; do not weaken it.
- **D-06 - Reuse the existing seams.** Extend `code_signal.py` with a pure scorer; extend `context.py` with a code-seeking selector; bump the coding prompt template version. No new module for the scorer, no new service, no new queue.
- **D-07 - Objective and written arms are untouched.** The code-seeking selection is opt-in on the coding format only. Their retrieval behavior, prompts, and tests must not change.
- **D-08 - The citation gate stays enum-bound to the returned context.** A derived-contract question must still cite chunks from the selection it was given (`validation.py:137`, `coding_schema` `chunkId` enum). No relaxation there.

## Architecture overview

```
assessments.recipe {formats:['coding']}
        |
        v
worker._recipe_format            (worker.py:95)   -> CODING_FORMAT
        |
        v
worker context build             (worker.py:332)  -> context_builder(material_id, skill_tags, scope, ...)
        |
        v
context.build_context            (context.py:39)
        |-- steer present  -> match_content_chunks            (unchanged)
        `-- no steer       -> _spread_context                  (context.py:95)
                               TODAY: _evenly_spaced            (context.py:143)
                               NEW:   code-seeking selection     <-- P2
        |
        v
prompts.build_coding_messages    (prompts.py:427)  <-- P3 reframes the suitability bar
        |
        v
validation.validate_coding       (validation.py:333)
        |-- candidate.unsuitable -> code_not_derivable warning (validation.py:348)
        `-- else                 -> coding_format_failures + citation gate
        |
        v
worker refusal handling          (worker.py:421-449)
        TODAY: fail terminal on the first unsuitable verdict
        NEW:   bounded resample (max 3 windows), then fail terminal   <-- P4
        |
        v
worker._coding_self_check        (worker.py:642)   <-- unchanged correctness guard
```

### Files-touched index

| File | Phase | Change |
|---|---|---|
| `services/intelligence/app/ingestion/code_signal.py` | P1 | Add a pure code-proximity scorer beside `scan_code_blocks` |
| `services/intelligence/tests/test_code_signal.py` | P1 | Tests for the scorer |
| `services/intelligence/app/generation/context.py` | P2 | Code-seeking spread selection on the coding path |
| `services/intelligence/tests/test_generation_context.py` | P2 | Tests for selection + exclusion |
| `services/intelligence/app/generation/prompts.py` | P3 | `coding-v2` template: derive the contract from an explanation |
| `services/intelligence/tests/test_generation_prompts.py` | P3 | Template/version tests |
| `services/intelligence/app/generation/worker.py` | P2, P4 | Thread the coding mode into context; bounded resample |
| `services/intelligence/app/worker_main.py` | P2 | Thread `code_seeking`/exclude through the injected context-builder closure (found live) |
| `services/intelligence/tests/test_generation_worker.py` | P2, P4 | Wiring + resample tests |
| `services/intelligence/tests/test_generation_coding.py` | P3 | Contract tests for the reframed bar |
| `services/intelligence/scripts/eval_golds_coding.json` | P5 | Re-pin the gold expectation if the finding changes |
| `.work/STATUS.md` | P0 | Row for this task |

---

## Phase P0 - Open the task contract

**Status: Complete**

1. Create one GitHub issue as a child of spec #32 (parent map #4): "Coding generation: code-aware context + derived contracts". Body = the TL;DR plus the acceptance criteria below. Reference this plan.
2. Add a `.work/STATUS.md` row (Active) pointing at this plan file.
3. Read `.agents/rules/42-assessment-and-practice-generation.agents.md` and `.agents/rules/80-script-dry-run-before-full-runs.agents.md` in full.

**Acceptance criteria (the contract for every later phase)**

- AC1 - A coding generation on `b5f51eab-c11d-4505-80db-88bb3627801d` produces a question whose reference solution passes the generation-time self-check.
- AC2 - A genuinely codeless draw still returns `code_not_derivable` with a learner-facing reason; the refusal path is preserved.
- AC3 - No schema change: no Supabase migration, no Dexie version, no `content_chunks` column.
- AC4 - Objective and written generation behavior is unchanged (their suites stay green and their retrieval path is untouched).
- AC5 - The #48 harness re-run flips `grokking-algorithms` from gold disagreement to agreement and reports a derivable rate above zero.
- AC6 - No hidden grading content, reference solution, or raw material text reaches the browser, local cache, event log, or telemetry.

**Verification:** issue exists and is linked to #32/#4; STATUS row present.

**Rollback:** none needed (no code).

---

## Phase P1 - Code-proximity scorer

**Status: Complete**

### What

A pure function that scores how much a chunk looks like code, on signals that survive PDF extraction.

`services/intelligence/app/ingestion/code_signal.py` already owns `scan_code_blocks` (`:21`) and its docstring explains the fence rule. Add beside it:

```python
# Signals that survive PDF text extraction. Fences and leading indentation are
# flattened by the extractor (measured 2026-09-21 on grokking-algorithms: 0/260
# chunks carry a fence, 0/260 carry a newline + 4-space indent), so the scorer
# reads what does survive: code keywords, call/assignment shapes, and the
# operator punctuation prose does not use in runs.
CODE_KEYWORDS = (
    "def ", "class ", "return ", "import ", "from ", "while ", "for ",
    "print(", "elif ", "else:", "None", "True", "False", "len(",
)

def code_proximity(text: str) -> float:
    """0.0 (prose) .. 1.0 (dense code) for one chunk. Pure."""
```

Design constraints:

- **Pure and deterministic.** No I/O, no model, no randomness. Unit-testable without the DB.
- **Monotone on the signals it reads**: a chunk with `def quicksort(...)` and `return` must outscore a chapter summary, which must outscore front matter.
- **Cheap**: called once per candidate row per coding generation, over at most a few hundred rows.
- **Not a fence detector.** `scan_code_blocks` stays exactly as it is; the two answer different questions (does the document declare code blocks vs does this chunk look like code).

### Why not reuse `has_code`

`has_code` is fence-based, is `NULL` for pre-031 materials, is written only at ingestion (`ingestion/worker.py:365`), and is documented as UI-only. Making generation depend on it would require a backfill and would still read `false` on this book.

### Tests (`tests/test_code_signal.py`)

- A Python implementation chunk (`def`, `return`, `print(`) scores above 0.5.
- A prose chapter summary scores below the implementation chunk.
- Front matter / title page scores near 0.
- Empty and whitespace-only text score 0.
- The scorer is deterministic across repeated calls.
- Existing `scan_code_blocks` tests are untouched and still pass.

### Verification

```bash
uv run --package intelligence pytest services/intelligence/tests/test_code_signal.py -q
uv run --package intelligence ruff check services/intelligence/app/ingestion/code_signal.py services/intelligence/tests/test_code_signal.py
uv run --package intelligence ruff format --check services/intelligence/app/ingestion/code_signal.py
```

### Rollback

Delete the added function and its tests. No callers yet, so nothing else changes.

---

## Phase P2 - Code-aware context for the coding arm

**Status: Complete**

### What

Make the coding arm's no-steer fallback pick code-dense chunks instead of an even spread.

`context.py` today:

- `build_context` (`:39`) computes `_steer` (`:89`) and either queries `match_content_chunks` or calls `_spread_context` (`:95`).
- `_spread_context` fetches `id,ordinal` for the material (or the scoped pages), picks with `_evenly_spaced` (`:143`), then fetches those rows' text.

Change:

1. Give `build_context` a code-seeking mode, e.g. a keyword-only `code_seeking: bool = False` (default false, so objective/written callers are untouched per D-07).
2. In the no-steer branch, when `code_seeking` is true:
   - fetch candidate rows with text (the material is at most a few hundred chunks; scope bounds it further when a scope exists);
   - score each with `code_proximity` (P1);
   - pick `CONTEXT_TOP_K` (`:35`) with positional spread so the 5 are not 5 adjacent chunks of one listing: rank by score, then take the highest-scoring chunk in each of `CONTEXT_TOP_K` contiguous ordinal bands.
3. Support an **exclusion set** of already-tried chunk ids so P4's resample can ask for a different window. Thread it through as a keyword-only argument.
4. Keep returning `RetrievedChunk` (`models.py`) so prompts, the citation enum, and validation need no change.

### Worker wiring

`context_builder` is injected at `worker.py:231` and called at `:332` (main) and `:600` (inside `_widen_thin_context`). Thread the coding flag from `question_format == CODING_FORMAT` (`worker.py:301-302`) into the `:332` call. `_widen_thin_context` (`:579`) widens a thin scope; decide there whether the widened retry also seeks code (it should, for the coding arm) and keep the objective/written behavior identical.

### Tests (`tests/test_generation_context.py`, `tests/test_generation_worker.py`)

- With `code_seeking=True` and no steer, the selected ids are the top code-proximity chunks under positional spread, not the evenly-spaced ones.
- With `code_seeking=False` (default), selection is byte-for-byte the current even spread (regression guard for D-07).
- The exclusion set removes tried ids from the candidates.
- A scope's page bounds still bound the candidates.
- `tests/test_generation_worker.py:873` (scope reaches the context builder) still passes; add a sibling asserting the coding format reaches it too.
- No chunk text leaks into logs.

### Verification

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_context.py services/intelligence/tests/test_generation_worker.py -q
uv run --package intelligence ruff check services/intelligence/app/generation/context.py services/intelligence/app/generation/worker.py
```

### Rollback

The flag defaults to false; reverting the call site restores today's behavior with no data impact.

---

## Phase P3 - Reframe the suitability bar (`coding-v1` -> `coding-v2`)

**Status: Complete**

### What

An algorithms textbook teaches algorithms. The coding arm should be allowed to derive the input/output contract from the described behavior, instead of requiring the chunks to state a task.

Touch `prompts.py` only:

- `CODING_PROMPT_TEMPLATE_VERSION` (`:27`): `"coding-v1"` -> `"coding-v2"`. It flows to telemetry via `_TEMPLATE_VERSIONS` (`worker.py:76-78`) and to the durable question row, so the change is attributable.
- `CODING_SYSTEM_TEMPLATE` (`:386`): replace the "complete, self-contained problem statement with input/output specifications" requirement with an explicit derivation rule. Sketch:

  > If the chunks describe an algorithm or a technique but do not state an exercise, you may author the question yourself: the stem names the algorithm, and the tests and reference solution define the contract. The contract must follow the behavior described in the cited chunks. Refuse only when the chunks contain no code, no algorithm, and no implementable technique.

- Keep the `unsuitable` shape and the refusal instruction (`:414-416`), reworded to the narrower codeless case.
- `coding_schema` (`:302`), `unsuitable_schema` (`:369`), and `CODING_USER_TEMPLATE` (`:420`) need no structural change. Do not change the schema: no client, validator-shape, or contract change (D-06).

### Why this is safe (D-05)

The generation-time self-check (`worker.py:642`) runs the reference solution against its own authored tests before the question is accepted. A derived contract that does not execute fails there. A derived contract that does execute is a real, gradeable question grounded in cited chunks.

### Tests (`tests/test_generation_prompts.py`, `tests/test_generation_coding.py`)

- The system prompt carries the derivation rule and still carries the refusal instruction.
- `CODING_PROMPT_TEMPLATE_VERSION == "coding-v2"`.
- The schema still admits exactly `unsuitable | tests-bearing | output_prediction`.
- `validate_coding` still returns `code_not_derivable` for `{"unsuitable": true, "reason": ...}` and still returns `malformed_output` for a shape that fails `coding_format_failures` (`validation.py:273`).
- The citation gate still rejects a `chunkId` outside the context (D-08).

### Verification

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_prompts.py services/intelligence/tests/test_generation_coding.py services/intelligence/tests/test_generation_validation.py -q
uv run --package intelligence ruff check services/intelligence/app/generation/prompts.py
```

### Rollback

Revert the two prompt constants. Existing stored questions keep their own `prompt_template_version`, so history stays honest.

---

## Phase P4 - Bounded resample before `code_not_derivable`

**Status: Complete**

### What

Today the first `unsuitable` verdict is terminal (`worker.py:421-449`): the assessment fails, the learner starts a fresh run. Instead, retry with a different window before refusing.

In the coding path of `worker.py`:

1. Wrap the context-build -> generate -> validate step in a bounded loop, `max_windows = 3` (D-02).
2. On an `unsuitable` verdict and while attempts remain: add the tried chunk ids to the exclusion set, rebuild the context (P2's exclusion argument), and generate again.
3. On success, proceed exactly as today (`_coding_self_check`, then persist).
4. When the bound is exhausted, fail terminal exactly as today with the last (or most informative) reason, so the learner-facing behavior on a genuinely codeless material is unchanged (D-04).
5. Record the number of windows in telemetry so the extra spend is visible, and log each window with `trace_id` (rule 17).

### Constraints

- **No new race.** Resamples happen inside one job, after `enqueue_assessment_generation` took migration 032's per-material advisory lock; that lock is per-enqueue and is not affected.
- **Bounded spend.** At most 2 extra provider calls per coding generation, only on the refusal path.
- **Repair is separate.** `_repair_once` (`:614`) handles `malformed_output`; do not fold the resample into it.

### Tests (`tests/test_generation_worker.py`)

- Three unsuitable verdicts fail terminal with `code_not_derivable` and exactly three generation calls.
- An unsuitable first verdict followed by an accepted second one persists the question and never fails.
- The resample asks the context builder with the tried ids excluded.
- An objective or written generation is unaffected (no resample).
- Telemetry records the window count.

### Verification

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_worker.py -q
uv run --package intelligence ruff check services/intelligence/app/generation/worker.py
```

### Rollback

Set `max_windows = 1` to restore today's one-shot behavior with no other change.

---

## Phase P5 - Live verification and harness re-run

**Status: Complete**

Rule 80 order: unit tests, then a minimal live dry run, then the full check. Rule 54: the GPU sidecar is demand-started and stopped after.

1. **Cheap checks first.**
   ```bash
   uv run --package intelligence pytest services/intelligence/tests/ -q
   uv run --package intelligence ruff check services/intelligence/
   uv run --package intelligence ruff format --check services/intelligence/app services/intelligence/tests
   ```
2. **Start the managed runtime and the sidecar** (sidecar only while needed):
   ```bash
   ./full-app status full
   ./full-app restart full
   export HF_TOKEN=$(grep '^HF_TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
   docker compose -f services/embedder/docker-compose.yml up -d
   ```
   Wait for `http://localhost:8200/health` to report `cuda_available: true` and `loaded: true`.
3. **Single live coding generation** on `b5f51eab-c11d-4505-80db-88bb3627801d` (AC1). Confirm a question is produced, the self-check passes, and no `code_not_derivable` warning is written.
4. **Refusal regression** (AC2): a coding generation on a prose-only material still returns `code_not_derivable` with a learner-facing reason.
5. **No-regression pass** (AC4): one objective and one written generation still succeed.
6. **Harness re-run** (AC5):
   ```bash
   cd services/intelligence && uv run python scripts/eval_harness.py --summarize
   ```
   Expect `grokking-algorithms` to move from gold disagreement to agreement and the derivable rate to exceed zero. If the finding genuinely changed, re-pin `eval_golds_coding.json` and record why.
7. **Redaction sweep** (AC6): grep the responses, the Dexie cache, the event log, and telemetry for `referenceSolution`, `hiddenTests`, and raw chunk text; expect zero.
8. **Stop the sidecar** and leave the managed runtime in the state the user wants.
9. **OCR delegate review** of the diff before merge; fix High/Critical findings.

### Evidence

Write results to `.work/active/<task-id>/plan/VERIFICATION.md` (create the task folder at P0 via the work-journal contract) with an AC ledger. Keep browser/console evidence only if a UI surface changed (it should not).

---

## Open questions

- **Should a derived-contract question be marked as such?** The stem names the algorithm, but nothing tells the learner "the task was authored around the explanation, not quoted from it". Options: no marker (current plan), a stem sentence, or a `warnings` entry. Decide during P3; do not silently pick one.
- **Should `code_proximity` weight the operator-punctuation signal at all?** Decide from the P1 unit-test fixtures rather than by intuition; keep the function small.
- **Is 3 the right window bound?** P4 picks 3 because it is 2 extra calls worst case. Revisit if the live dry run shows a success rate that plateaus at 2.
- **Should the objective/written arms eventually get a signal-aware spread too?** Out of scope here (D-07), but the `code_seeking` flag is the seam if it is ever wanted.

## Out of scope

- **No `content_chunks` code column, no migration, no re-ingest, no backfill** (D-03).
- **No rerank or embedding changes.** Retrieval quality was measured separately and is not the cause here.
- **No UI copy changes.** Warning strings render as they do today.
- **No change to `_coding_self_check`, the grading arm, the sandbox, or the citation gate** (D-05, D-08).
- **No deletion of the `code_not_derivable` outcome** (D-04).
- **No app-package or Dexie change.**

## References

- Parent spec: [Phase 2 Assessments and LLM-Guided Practice](https://github.com/rings0fsaturn/study-planner/issues/32) (#32)
- Wayfinder map: [#4](https://github.com/rings0fsaturn/study-planner/issues/4)
- Origin finding: [#48](https://github.com/rings0fsaturn/study-planner/issues/48) resolution comment (coding suitability 0.0 + gold disagreement)
- Harness evidence: `research/doc/generation-quality-harness/report.md`, `summary.json`
- Prior art for the same failure shape: `services/intelligence/app/generation/context.py:15-21` (title-in-steer retrieved front matter 5/5, measured 2026-09-11)
- #45 coding arm (prompt, validator, self-check, sandbox grading): `archive/issue-45-coding-practice-runs/`
- #42 coding assessment and sandbox grading (arm contract): `archive/issue-42-coding-assessment-sandbox-grading/`
- Rules: 42 (generation contracts), 80 (dry-run before full runs), 54 (sidecar), 17 (logging/tracing)
- Concurrency guard this work must not disturb: `apps/app/supabase/migrations/032_assessment_enqueue_attempt_lock.sql`
