# coding-generation-context residuals + wayfinder exit - implementation plan

_Written 2026-09-28. Status: not started._
_Ticket: [#67](https://github.com/rings0fsaturn/study-planner/issues/67) (OPEN; code complete at `b6e286b`) · Parent spec: [#32](https://github.com/rings0fsaturn/study-planner/issues/32) · Wayfinder map: [#4](https://github.com/rings0fsaturn/study-planner/issues/4) · Task: `.work/active/coding-generation-context/`_
_Extends: `.work/active/coding-generation-context/plan/PLAN.md` (complete, `b6e286b`) and its `plan/VERIFICATION.md` (AC1-AC6 PASS, 2026-09-21). Those two files remain the record of the original build; this plan is the spec for its residual hardening and its wayfinder exit._

## How to use this plan

You are an AI agent asked to implement one or more phases below.
Read this whole preamble and the Decisions log before touching code.
Each phase is a vertical slice that a fresh context window can implement and verify on its own.
Work phases in order: Phase 1 and Phase 2 are independent of each other, Phase 3 reviews both, and Phase 4 is the close-out and must not start before Phase 3 passes.
Follow the repository rules in `.agents/rules/`, above all rule 17 (logging and tracing), rule 42 (assessment and practice generation), rule 52 (gh + token), rule 54 (demand-start/stop the sidecar), and rule 80 (dry-run before any paid run).
Run the smallest relevant check first, then broaden verification in proportion to the change.
Do not commit unless the human explicitly asks; when asked, stage only the paths this plan names (the worktree is dirty with other tasks).
Update each phase's status marker as you go.

## TL;DR

#67's implementation is already complete and committed (`b6e286b`, AC1-AC6 verified live on 2026-09-21), but the ticket is still OPEN because the wayfinder exit never ran.
Two residual gaps recorded in its verification record are worth closing before that exit:

1. **The coding gold registry lost its negative case.** ACCA was re-pinned `expectedDerivable: true` in #67, leaving all three coding golds positive, so a regression that starts fabricating questions from codeless material would be invisible to the harness.
2. **The no-steer chunk listing trusts one PostgREST response.** The hosted PostgREST caps every collection at 1000 rows (measured 2026-09-28: `content-range: 0-999/4175`), and DDIA has 1094 chunks, so 94 chunks are silently invisible to both the even spread and the code-seeking scorer.

Fix both with one small TDD change each, then run the exit: independent re-verification of AC1-AC6 against the current tree, the two review fanouts, and the full wayfinder close-out (ACs, resolution comment, close, map line, archive, STATUS).

## Context and evidence (measured 2026-09-28)

### The ticket is done; the close-out is not

| Observation | Value | Source |
|---|---|---|
| Issue #67 | OPEN, no comments, labels `wayfinder:phase2` + `ready-for-agent` | GitHub, fetched 2026-09-28 |
| Implementation | committed `b6e286b`, ancestor of HEAD `1d6fddb` | `git merge-base --is-ancestor` |
| Original plan | `plan/PLAN.md`, status "Complete - b6e286b" | task folder |
| Acceptance | AC1-AC6 all PASS with live evidence | `plan/VERIFICATION.md` |
| Task state | "wrap pending" since 2026-09-21 | `state.md:7`, STATUS row |
| Open wayfinder frontier | #49 (Phase 2 Integrated Verification); #67 only looks open because the exit never ran | `gh issue list --label wayfinder:phase2 --state open` |

### Residual 1 - the gold registry has no negative case

- `scripts/eval_golds_coding.json` holds three items, all `expectedDerivable: true`.
- `coding_gold_agreement` (`scripts/eval_harness.py:291`) only checks materials with observed terminal coding attempts, so the all-positive registry silently reports `checked=2, agreed=2` (last full run, `research/doc/generation-quality-harness/summary.json:121-126`).
- The AC2 fixture is still live: material `ac8e4730-00eb-447d-bffd-81e81dd43bb4` has assessment `421aca54-b116-44d2-afe2-d552328bca32` `status=failed`, warning `code_not_derivable` (probed 2026-09-28), and the last harness run recorded `attempts: 1, refused: 1` for it.
- Consequence of leaving it: a future change that starts producing questions from codeless material raises `derivable_rate` (a minimum gate, so no breach) and flips nothing red.

### Residual 2 - the no-steer listing is truncated at the hosted 1000-row cap

- `build_context` with no steer calls `_spread_context` (`app/generation/context.py:117`), which builds one listing query with `&limit=10000` and fetches it in a single request (`context.py:134-138` code path, `_code_seeking_context` at `:174` for the coding arm).
- Hosted PostgREST caps the response regardless of the requested limit. Measured live, read-only:

```bash
curl -s -D - -o /dev/null \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" \
  "$SUPABASE_URL/rest/v1/content_chunks?select=id&limit=10000"
# HTTP/2 206
# content-range: 0-999/4175
```

- Per-material totals measured the same way: grokking 260 (unaffected), ACCA 754 (unaffected), codeless 1 (unaffected), DDIA `ef3abfa1-99c7-4166-8ba7-6560c862f49f` 1094 -> **94 chunks invisible today**.
- The repo already owns the fix idiom: `scripts/retrieval_probe.py:105-127` (`fetch_chunks`) pages with `limit=1000&offset=N` until a short page.

### Worktree state to respect

The worktree is dirty with other tasks, and none of it belongs to this plan:

- `repair-validation-resilience` is code-complete but uncommitted: `services/intelligence/app/generation/worker.py`, `openrouter_client.py`, `tests/test_generation_coding.py`, `tests/test_generation_worker.py`, `tests/test_generation_adapter.py`, `scripts/full_app.py`, `scripts/tests/test_full_app.py`, rules 10/51/54, `.work/STATUS.md`, `.work/specs/test-login-cred.txt`, `research/doc/generation-quality-harness/{summary.json,report.md}`, and the new `.work/active/repair-validation-resilience/` + `.work/plans/2026-09-27-*.md`.
- ~905 deletions under `college/mydeliverables/3rd-Review/for-submit/code-submit/` plus untracked `e2e/jev-*.spec.ts`, `e2e/pdf/*.pdf`, `graphify-out/`, `.claude/`.

Never `git add -A`; stage only the paths this plan names; leave every other path untouched.

## Baseline - what is already done (do not re-do)

- The code-proximity scorer, code-seeking spread, `coding-v2` rule, and 3-window resample are implemented and live-verified (`b6e286b`).
- The focused baseline is green (measured 2026-09-28): `uv run --package intelligence pytest services/intelligence/tests/test_generation_context.py services/intelligence/tests/test_eval_harness.py -q` -> `29 passed in 13.09s`.
- The broader intelligence suite on the current tree has 18 pre-existing unrelated failures (16 `test_v1_integration.py` golden fixtures + 2 `test_retrieval_probe.py` import), recorded by the repair-validation task. Do not chase them.

## Decisions log

### D-01: Fix both residuals before the exit; no other code changes

**Status:** ✅ Agreed with the user 2026-09-28.

**Context:** #67 is code-complete, so the only code worth touching is the two gaps its own verification record left behind.

**Decision:** Two small changes (negative gold guard, listing pagination), then the exit. No re-implementation, no prompt/self-check changes, no schema.

**Rationale:** Both gaps are recorded, measured, and cheap; anything else is gold-plating a verified slice.

**Reversibility:** easy - each change is independently revertable.

### D-02: The negative gold pins the live codeless material

**Status:** ✅ Agreed with the user 2026-09-28.

**Decision:** Add `ac8e4730-00eb-447d-bffd-81e81dd43bb4` with `expectedDerivable: false` to `eval_golds_coding.json`.

**Rationale:** It is the exact fixture AC2 used, it is already tracked in the harness summary, and the other three golds are live account materials too, so it follows the registry's existing shape.

**Alternatives considered:**

- Build a new committed codeless corpus fixture - rejected: needs a new material, ingestion, and embedding budget for no extra checking power.
- Repin ACCA back to false - rejected: the 2026-09-21 decision (prose + worked procedure is derivable under `coding-v2`) stands.

**Reversibility:** easy - one JSON item.

### D-03: A negative coding case becomes mandatory in `verify_golds`

**Status:** ✅ Agreed with the user 2026-09-28.

**Context:** The 2026-09-21 re-pin silently removed the only negative case and nothing failed.

**Decision:** `verify_golds` reports a problem when the coding gold set has no `expectedDerivable: false` item, so `--verify-golds` fails closed.

**Rationale:** The registry guard is what makes D-02 durable; without it the same regression can happen again unnoticed.

**Reversibility:** easy - remove the guard and the test.

### D-04: Page with the repo's offset idiom at the measured cap

**Status:** ✅ Agreed with the user 2026-09-28.

**Decision:** One shared `_fetch_listing` helper pages `limit=1000&offset=N` until a short page; both the even spread and the code-seeking listing use it. Page size = the measured hosted cap. A `ponytail:` comment records the cap assumption and the `Content-Range` upgrade path.

**Rationale:** Same root cause on both paths, and `retrieval_probe.fetch_chunks` already proves the idiom. A single-request fast path is preserved for materials under the cap (the common case).

**Alternatives considered:**

- Fetch only `id,ordinal` pages, then fetch text per candidate band - rejected: more requests and more code for no gain.
- Push `code_proximity` into SQL - rejected: violates the #67 D-03 in-memory decision and needs a schema/function change.

**Reversibility:** easy.

### D-05: The exit re-verifies on fresh live evidence

**Status:** ✅ Agreed with the user 2026-09-28.

**Context:** The 2026-09-21 live evidence predates the uncommitted `repair-validation-resilience` worker changes and this plan's pagination change to the shared no-steer path.

**Decision:** Minimum live set before the close-out: AC1 (coding generation on grokking), AC2 (codeless refusal), AC4 (objective and written generation still `ready`). AC3 and AC6 are static sweeps. All runs join `X-Request-ID`/`trace_id` per rule 17.

**Rationale:** Closing on stale evidence would certify drift; the live set is cheap (one coding, one refusal, one objective, one written) and directly re-tests the changed path.

**Alternatives considered:**

- Reuse the 2026-09-21 record as-is - rejected: the tree changed underneath it.
- Full E2E suite - deferred: the exit verifies this ticket's ACs, not the whole Phase 2 journey (that is #49).

**Reversibility:** n/a (a verification decision).

### D-06: Review fanout is the two named subagents

**Status:** ✅ Agreed with the user 2026-09-28.

**Decision:** Phase 3 fans out `open-code-review-delegate` and `verification-loop` in parallel over the Phase 1-2 diff and evidence.

**Rationale:** User instruction; the diff is small (two source files + two test files + one JSON), so the pair is proportionate.

**Alternatives considered:**

- Add `thermo-nuclear-code-quality-review` - deferred: run it only if the diff grows beyond the two source files, or the delegate pass leaves structural findings.

**Reversibility:** n/a.

## Architecture overview

```
assessments.recipe {formats:['coding']}
        |
        v
worker._build_context(code_seeking=True)                      (unchanged, b6e286b)
        |
        v
context.build_context                                          (context.py:41)
        |-- steer present -> match_content_chunks               (unchanged)
        `-- no steer      -> _spread_context                    (context.py:117)
                               TODAY: one GET &limit=10000      -> PostgREST caps at 1000 rows
                               NEW:   _fetch_listing            -> &limit=1000&offset=N until short page
                                      |
                                      v
                                filter exclude_chunk_ids
                                      |
                     code_seeking? ---+--- default?
                          |                    |
                          v                    v
                  _top_code_picks        _evenly_spaced + detail fetch
                  (code_proximity)       (unchanged)
```

The two residual fixes touch the two ends of this picture only: the gold registry (offline, Phase 1) and the listing fetch (Phase 2).

### Files-touched index

| File | Phase | Change |
|---|---|---|
| `services/intelligence/tests/test_eval_harness.py` | 1 | RED test: the registry must hold a negative coding case |
| `services/intelligence/scripts/eval_harness.py` | 1 | `verify_golds` guard for the mandatory negative case |
| `services/intelligence/scripts/eval_golds_coding.json` | 1 | Add the codeless negative gold item |
| `services/intelligence/tests/test_generation_context.py` | 2 | Pagination tests + updated URL assertions |
| `services/intelligence/app/generation/context.py` | 2 | `LISTING_PAGE_SIZE` + `_fetch_listing`; delete `_code_seeking_context` |
| `.work/plans/2026-09-28-coding-generation-context-residuals.md` | all | This plan; update status markers in place |
| `.work/active/coding-generation-context/plan/VERIFICATION.md` | 4 | Continuation ledger (residuals + fresh AC evidence + review verdicts) |
| `.work/active/coding-generation-context/state.md`, `.work/STATUS.md` | 4 | Task finalised, STATUS row flipped to Done |
| GitHub `#67`, `#4` | 4 | ACs ticked, resolution comment, close, map decision line |
| `.work/active/phase2-wayfinder/state.md` + `research/map-4.md` | 4 | Frontier + map snapshot updated |

---

## Phase 1 - A mandatory negative coding gold (TDD)

**Status:** ✅ Done 2026-09-28 (RED->GREEN; 13/13 harness tests; `--verify-golds` healthy; `coding.gold` checked=3/agreed=3/rate=1.0; ac8e4730 attempts=1/refused=1)
**Depends on:** none
**Estimated scope:** 3 files, ~35 lines

### Goal

The harness can always detect a codeless-fabrication regression: the coding gold registry carries a real negative case, and `--verify-golds` fails if it ever does not.

### Verification (run BEFORE starting to confirm prereqs)

```bash
uv run --package intelligence pytest services/intelligence/tests/test_eval_harness.py services/intelligence/tests/test_generation_context.py -q   # expect 29 passed
# The AC2 fixture must still be live (service-role read; do not print the key):
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/assessments?material_id=eq.ac8e4730-00eb-447d-bffd-81e81dd43bb4&select=id,status,warnings"
# expect 421aca54-... failed with code_not_derivable
```

If the assessment row is gone, STOP: D-02 needs a live refusal row; surface before picking a new fixture.

### Steps

1. **RED - add the registry-guard test** at the end of `services/intelligence/tests/test_eval_harness.py` (add `import json` beside the existing imports):

```python
def test_verify_golds_requires_a_negative_coding_case(tmp_path, monkeypatch):
    """A coding gold registry with no codeless material is not healthy."""
    monkeypatch.setattr(eh, "gold_path", lambda name: tmp_path / name)
    (tmp_path / "probe_questions.json").write_text(
        json.dumps([{"label": "o", "answerSnippet": "snippet"}]), encoding="utf-8"
    )
    (tmp_path / "eval_golds_written.json").write_text(
        json.dumps([{"label": "w", "answerSnippet": "snippet"}]), encoding="utf-8"
    )
    (tmp_path / "eval_golds_coding.json").write_text(
        json.dumps([{"label": "code-only", "materialId": "m1", "expectedDerivable": True}]),
        encoding="utf-8",
    )
    golds = {
        "folds": [],
        "objectiveGold": "probe_questions.json",
        "writtenGold": "eval_golds_written.json",
        "codingGold": "eval_golds_coding.json",
    }
    problems = eh.verify_golds(golds)
    assert any("no negative case" in problem for problem in problems)
```

Run it; it must FAIL (the guard does not exist yet).

2. **GREEN - implement the guard** in `verify_golds` (`scripts/eval_harness.py:502`), appending after the existing per-item loop inside the `for key, label in (...)` body:

```python
        if (
            label == "coding"
            and items
            and not any(item.get("expectedDerivable") is False for item in items)
        ):
            problems.append(
                f"coding gold has no negative case (expectedDerivable=false): {path.name}"
            )
```

3. **Pin the negative case** in `scripts/eval_golds_coding.json` (append a fourth item):

```json
  {
    "label": "codeless placeholder material (negative case)",
    "materialId": "ac8e4730-00eb-447d-bffd-81e81dd43bb4",
    "concept": "none - code_not_derivable is the required outcome",
    "expectedDerivable": false
  }
```

### Tests

- Add `test_verify_golds_requires_a_negative_coding_case` (`test_eval_harness.py`) - covers the guard.
- No other test changes; `coding_gold_agreement` already has negative-case coverage (`test_coding_suitability_and_gold_agreement`).

### Verification (DONE)

```bash
uv run --package intelligence pytest services/intelligence/tests/test_eval_harness.py -q
uv run --package intelligence ruff check services/intelligence/scripts/eval_harness.py services/intelligence/tests/test_eval_harness.py
# Live registry check (needs services/intelligence/.env; read-only, zero model calls):
uv run --package intelligence python scripts/eval_harness.py --verify-golds   # expect "gold registry healthy"
uv run --package intelligence python scripts/eval_harness.py --summarize
# expect coding.gold checked=3, agreed=3, agreement_rate=1.0, disagreements=[]
# and the ac8e4730 by_material entry refused=attempts (derivable false)
```

The `--summarize` run rewrites `research/doc/generation-quality-harness/{summary.json,report.md}`, which are already dirty from the #76/#77 runs; that is intended. Record the new `coding.gold` block in the task scratchpad; do not revert the unrelated rubric/telemetry lines.

### Rollback

Revert the three files. The guard and the gold item are independent: the guard alone is harmless (it fails until the item exists), so land them together.

---

## Phase 2 - Page the no-steer chunk listing at the hosted cap (TDD)

**Status:** ✅ Done 2026-09-28 (RED 3 failed -> GREEN; 32/32 focused tests; ruff check + format clean; live probe `rows fetched: 1094 expected: 1094`)
**Depends on:** none (independent of Phase 1)
**Estimated scope:** 2 files, ~90 lines

### Goal

A material larger than the hosted 1000-row collection cap is fully visible to both the even spread and the code-seeking scorer, with a single request preserved for materials under the cap.

### Verification (run BEFORE starting to confirm prereqs)

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_context.py -q   # expect 17 passed
# Confirm the cap and one affected material (read-only; do not print the key):
curl -s -D - -o /dev/null -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" "$SUPABASE_URL/rest/v1/content_chunks?select=id&material_id=eq.ef3abfa1-99c7-4166-8ba7-6560c862f49f&limit=10000"
# expect content-range: 0-999/1094
```

### Steps

1. **Update the existing URL assertions** in `tests/test_generation_context.py` (they currently expect `limit=10000` and a URL ending at the scope predicate):

- `test_build_context_spreads_when_there_is_no_steer` (:184): expect `...&select=id,ordinal&order=ordinal.asc&limit=1000&offset=0`.
- `test_build_context_spread_is_bounded_by_the_scope_pages` (:212): change `.endswith("&page_start=lte.140&page_end=gte.100")` to `assert "&page_start=lte.140&page_end=gte.100" in rest.calls[0]["url"]`.
- `test_code_seeking_spread_is_bounded_by_the_scope_pages` (:341): same `in` change.

2. **RED - add the pagination tests**:

```python
def test_listing_pages_until_a_short_page(monkeypatch: pytest.MonkeyPatch) -> None:
    """PostgREST caps collections at 1000 rows; the even spread must page."""
    monkeypatch.setattr(context_module, "LISTING_PAGE_SIZE", 2)
    pages = [
        httpx.Response(200, json=[{"id": "c0", "ordinal": 0}, {"id": "c1", "ordinal": 1}]),
        httpx.Response(200, json=[{"id": "c2", "ordinal": 2}, {"id": "c3", "ordinal": 3}]),
        httpx.Response(200, json=[{"id": "c4", "ordinal": 4}, {"id": "c5", "ordinal": 5}]),
        httpx.Response(200, json=[]),  # exact multiple: the loop ends on the short page
    ]
    detail = httpx.Response(
        200, json=[{"id": f"c{i}", "ordinal": i, "text": "body"} for i in range(5)]
    )
    rest = FakeRest([*pages, detail])
    chunks = build_context("m1", (), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]

    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c1", "c2", "c3", "c4"]
    assert [call["url"].split("&")[-2:] for call in rest.calls[:4]] == [
        ["limit=2", "offset=0"],
        ["limit=2", "offset=2"],
        ["limit=2", "offset=4"],
        ["limit=2", "offset=6"],
    ]


def test_code_seeking_scores_across_paged_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    """A code chunk past the cap still wins its band (the DDIA 1094-chunk case)."""
    monkeypatch.setattr(context_module, "LISTING_PAGE_SIZE", 4)
    rows = [
        _prose("c0", 0), _prose("c1", 1), _prose("c2", 2), _code("c3", 3),
        _code("c4", 4), _prose("c5", 5), _prose("c6", 6), _prose("c7", 7),
        _prose("c8", 8), _prose("c9", 9),
    ]
    rest = FakeRest(
        [httpx.Response(200, json=rows[offset : offset + 4]) for offset in range(0, len(rows), 4)]
    )
    chunks = build_context(
        "m1", (), None, "https://supabase.example", "svc-key", rest, code_seeking=True  # type: ignore[arg-type]
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c3", "c4", "c6", "c8"]
    assert len(rest.calls) == 3  # 4 + 4 + 2; the third page is short
```

Run them; they must FAIL (the constant and the paged helper do not exist yet).

3. **GREEN - implement in `app/generation/context.py`**:

3a. Beside `CONTEXT_TOP_K` (:37), add:

```python
# The hosted PostgREST caps every collection at 1000 rows (measured 2026-09-28:
# `content-range: 0-999/4175`). A single listing request silently loses a
# material's tail past 1000 chunks, so the no-steer listing pages at the cap.
# ponytail: a page equals the measured cap; if the cap ever drops, read
# `Content-Range` instead of trusting a short page.
LISTING_PAGE_SIZE = 1000
```

3b. Replace `_spread_context`'s body (keep the signature, update the docstring to say the listing is paged):

```python
    select = "id,ordinal,text,page_start,page_end" if code_seeking else "id,ordinal"
    query = (
        f"{supabase_url.rstrip('/')}/rest/v1/{CHUNKS_TABLE}"
        f"?material_id=eq.{material_id}&select={select}&order=ordinal.asc"
    )
    if scope is not None:
        query += f"&page_start=lte.{scope.page_end}&page_end=gte.{scope.page_start}"
    rows = _fetch_listing(client, query, service_key=service_key)
    rows = [row for row in rows if str(row.get("id") or "") not in exclude_chunk_ids]
    if code_seeking:
        return [_retrieved_chunk(row, material_id) for row in _top_code_picks(rows)]
    picks = _evenly_spaced(rows, CONTEXT_TOP_K)
    if not picks:
        return []
    ids = ",".join(str(row["id"]) for row in picks)
    detail = _json_rows(
        _request(
            client,
            "get",
            (
                f"{supabase_url.rstrip('/')}/rest/v1/{CHUNKS_TABLE}"
                f"?id=in.({ids})&select=id,ordinal,text,page_start,page_end&order=ordinal.asc"
            ),
            service_key=service_key,
        ),
        "chunk listing",
    )
    return [_retrieved_chunk(row, material_id) for row in detail]
```

3c. Add the helper after `_spread_context` and **delete `_code_seeking_context`** entirely (its fetch is now shared; its remaining two lines are inlined above):

```python
def _fetch_listing(client: httpx.Client, query: str, *, service_key: str) -> list[dict]:
    """Every row for a listing query, paged at the hosted collection cap.

    One request when the material fits the cap; extra requests only past
    `LISTING_PAGE_SIZE` rows, so a large material's tail is still scored
    instead of silently dropped by PostgREST's 1000-row ceiling.
    """
    rows: list[dict] = []
    offset = 0
    while True:
        page = _json_rows(
            _request(
                client,
                "get",
                f"{query}&limit={LISTING_PAGE_SIZE}&offset={offset}",
                service_key=service_key,
            ),
            "chunk listing",
        )
        rows.extend(page)
        if len(page) < LISTING_PAGE_SIZE:
            return rows
        offset += len(page)
```

### Tests

- Update the three URL assertions listed in step 1.
- Add `test_listing_pages_until_a_short_page` and `test_code_seeking_scores_across_paged_rows`.
- Existing tests that keep passing unchanged prove the single-page fast path: `test_code_seeking_picks_the_code_dense_chunk_in_each_band`, `test_code_seeking_exclusion_removes_tried_chunks`, `test_build_context_spread_with_no_chunks_returns_nothing`, `test_default_spread_is_unchanged_by_the_code_seeking_seam`.

### Verification (DONE)

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_context.py -q
uv run --package intelligence ruff check services/intelligence/app/generation/context.py services/intelligence/tests/test_generation_context.py
uv run --package intelligence ruff format --check services/intelligence/app/generation/context.py services/intelligence/tests/test_generation_context.py
# Live dry run (read-only, no model calls, rule 80) - the paged helper must see the DDIA tail:
uv run --package intelligence python - <<'PY'
import httpx
from pathlib import Path
from app.generation.context import _fetch_listing

env = dict(
    line.split("=", 1) for line in Path("services/intelligence/.env").read_text().splitlines()
    if "=" in line and not line.strip().startswith("#")
)
material = "ef3abfa1-99c7-4166-8ba7-6560c862f49f"  # DDIA: 1094 chunks, 94 past the cap
query = (
    f"{env['SUPABASE_URL'].rstrip('/')}/rest/v1/content_chunks"
    f"?material_id=eq.{material}&select=id&order=ordinal.asc"
)
with httpx.Client(timeout=60.0) as client:
    rows = _fetch_listing(client, query, service_key=env["SUPABASE_SERVICE_ROLE_KEY"])
print("rows fetched:", len(rows), "expected: 1094")
PY
```

Record the `rows fetched: 1094` line as evidence. Do not print the key.

### Rollback

Revert the two files. The query base without `limit` is only valid with `_fetch_listing`; revert both together.

---

## Phase 3 - Code review + verification fanout

**Status:** ✅ Done 2026-09-28 (`open-code-review-delegate` APPROVE, 3 Low waived; `verification-loop` READY, zero deviations; no thermo-nuclear per D-06)
**Depends on:** Phase 1, Phase 2

### Goal

Both changed areas pass an independent review fanout before any close-out.

### Steps

1. **Fan out two subagents in parallel** (user instruction 2026-09-28):
   - `open-code-review-delegate` (installed skill) over the diff of the Phase 1-2 files: correctness, contract, and simplification findings.
   - `verification-loop` (installed ECC skill) over the phase evidence: tests green, live probes reproduced, no silent fallback introduced in `_fetch_listing` (a failed page must stay a retryable `provider_unavailable`, which `_json_rows` already enforces).
2. Fix all correctness findings with the smallest diff and re-run the owning phase's verification.
3. Waive style nits explicitly, each with a one-line reason, in the task scratchpad.
4. If either pass surfaces structural findings (a new abstraction, a widened API), also run `thermo-nuclear-code-quality-review` (AGENTS.md's default partner) before the exit.

### Verification (DONE)

- Both fanout reports are recorded (verdict + findings) in the scratchpad and distilled into `state.md`.
- Every correctness finding is fixed and its owning phase's tests are green again.
- `git status --short` shows only the intended Phase 1-2 paths plus this plan.

### Rollback

Review has no rollback; revert fixes by the phase they belong to.

---

## Phase 4 - Independent re-verification and the wayfinder exit

**Status:** ☐ Not started
**Depends on:** Phase 1, Phase 2, Phase 3

### Goal

#67 closes with fresh evidence on the current tree, the map records its decision, and the task folder is archived.

### 4.1 Suites and static gates

```bash
uv run --package intelligence pytest services/intelligence/tests/test_generation_context.py services/intelligence/tests/test_eval_harness.py -q
uv run --package intelligence pytest services/intelligence/tests/ -q   # expect 838+ passed; only the 18 pre-existing failures
uv run --package intelligence ruff check services/intelligence/
uv run --package intelligence ruff format --check <changed files>
```

### 4.2 Harness

```bash
uv run --package intelligence python scripts/eval_harness.py --verify-golds   # healthy
uv run --package intelligence python scripts/eval_harness.py --summarize
```

Record `coding.gold` (`checked`, `agreed`, `agreement_rate`, `disagreements`) and `derivable_rate` in the verification ledger.

### 4.3 Live AC re-verification (D-05)

Runtime first (rules 10 + 54; stop the sidecar and Piston after):

```bash
./full-app status full
./full-app start full      # sidecar :8200 + Piston :2000 are managed dependencies
curl -s http://127.0.0.1:8000/health && curl -s http://localhost:8200/health >/dev/null && echo sidecar-ok
curl -s http://localhost:2000/api/v2/runtimes >/dev/null && echo piston-ok
```

Then one API-driven generation per AC (credentials from `.work/specs/test-login-cred.txt`; values may be backtick-wrapped - strip them; never print or commit them):

```bash
ACCESS_TOKEN=$(python3 - <<'PY'
import json, urllib.request
from pathlib import Path

def pairs(path):
    return dict(
        line.split("=", 1)
        for line in Path(path).read_text().splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    )

creds = pairs(".work/specs/test-login-cred.txt")
env = pairs("apps/app/.env.local")
request = urllib.request.Request(
    f"{env['SUPABASE_URL'].strip()}/auth/v1/token?grant_type=password",
    data=json.dumps(
        {
            "email": creds["email"].strip().strip("`\"'"),
            "password": creds["password"].strip().strip("`\"'"),
        }
    ).encode(),
    headers={
        "apikey": env["SUPABASE_PUBLISHABLE_KEY"].strip(),
        "Content-Type": "application/json",
    },
)
print(json.load(urllib.request.urlopen(request))["access_token"])
PY
)

# AC1 - coding on grokking; AC2 - the same call on the codeless material;
# AC4 - objective and written on grokking. One family, one question per call (rule 42).
curl -s -X POST http://127.0.0.1:8000/v1/assessments/generate \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "X-Request-ID: $(python3 -c 'import uuid; print(uuid.uuid4())')" \
  -H "Idempotency-Key: $(python3 -c 'import uuid; print(uuid.uuid4())')" \
  -d '{"materialIds":["b5f51eab-c11d-4505-80db-88bb3627801d"],
       "recipe":{"formats":["coding"],"questionCount":1,"difficulty":3}}'
# -> 202 {assessmentId, jobId}; poll GET /v1/assessments/{id} until ready/failed (bound ~10 min)
```

| AC | Material | Recipe | Expected |
|---|---|---|---|
| AC1 | `b5f51eab-...` (grokking) | `{formats:[coding],questionCount:1,difficulty:3}` | `ready`, `warnings=[]`, question `format=coding`, telemetry `prompt_template_version=coding-v2` |
| AC2 | `ac8e4730-...` (codeless) | `{formats:[coding],questionCount:1,difficulty:3}` | `failed`, warning `code_not_derivable`, 0 questions |
| AC4 | `b5f51eab-...` | `{formats:[objective],...}` then `{formats:[written],...}` | both `ready` |

Join each with `./full-app logs intelligence --grep <request-id>` (rule 17).
Do NOT delete the codeless material: the Phase 1 negative gold depends on its row.

### 4.4 Redaction sweep (AC6)

```bash
curl -s "http://127.0.0.1:8000/v1/assessments/$CODING_ASSESSMENT_ID" -H "Authorization: Bearer $ACCESS_TOKEN" \
  | grep -E "referenceSolution|hiddenTests|acceptedValue" ; echo "exit=$? (1 = clean)"
```

Also confirm `questions` visible columns carry no `answer_block`, and that the Phase 1 harness output contains no raw text. Record CLEAN plus the exact grep.

### 4.5 Update the verification ledger

Append a `## Continuation verification (2026-09-28)` section to `.work/active/coding-generation-context/plan/VERIFICATION.md`:
- Residual table: `verify_golds` negative-case guard + gold item; pagination + the `rows fetched: 1094` probe.
- Fresh AC1/AC2/AC4 evidence with assessment ids and request-ids (redacted as the original ledger is).
- Static gates and the two fanout verdicts.

### 4.6 Wayfinder exit (only after 4.1-4.5 are green)

1. Tick AC1-AC6 in the #67 body (fetch body, flip `- [ ]` to `- [x]`, `gh issue edit 67 --body-file`), bounded 5x retry per rule 52; token from `.env.git.local`, never printed.
2. Post the resolution comment on #67: outcome, the two residuals fixed, evidence pointers (verification ledger, commit sha, harness numbers, review verdicts).
3. Close #67.
4. Append the decision line to map #4 (remote body + `.work/active/phase2-wayfinder/research/map-4.md`) in the `## Decisions so far` section, one line in the existing voice:

```
- **Coding generation: code-aware context + derived contracts (verified)** - the #48 finding (a code-rich material refused 3/3 with `code_not_derivable`) is answered: a pure in-memory `code_proximity` scorer, a code-seeking spread on the coding no-steer path, a `coding-v2` derivation rule, and a bounded 3-window resample before any terminal refusal, live-verified AC1-AC6. Residual hardening made the negative coding gold mandatory in the registry and paged the no-steer listing past the hosted PostgREST 1000-row cap (DDIA 1094 chunks). ([#67](https://github.com/rings0fsaturn/study-planner/issues/67))
```

5. Update `.work/active/phase2-wayfinder/state.md`: #67 now closed (exit run done), open frontier is **#49** alone.
6. Flip the `.work/STATUS.md` row from Active to Done: one line + `archive/coding-generation-context/state.md`.
7. Archive: remove the emptied `SCRATCHPAD.md`, `mv .work/active/coding-generation-context .work/archive/coding-generation-context`, fix the state.md header paths, mirror the map snapshot change.
8. If the human asked for commits: stage only the plan + Phase 1-2 files (one commit, e.g. `fix(intelligence): #67 residual hardening - mandatory negative coding gold + paged no-steer listing`) and the close-out records (a second docs commit, e.g. `docs(.work): #67 wayfinder exit - status, map, archive`). Never stage the `repair-validation-resilience` code, the `college/` deletions, `graphify-out/`, or `.claude/`. If the `repair-validation-resilience` STATUS row is still uncommitted, the docs commit will carry it; flag that to the human first.

### Verification (DONE)

- All four AC re-checks green, redaction CLEAN, review verdicts recorded, issue CLOSED on GitHub, map line visible on #4, archive folder present, STATUS row points at the archive.

### Rollback

Steps 4.1-4.5 are reversible. Step 4.6 is one-way: do not start it with any red check, and if something is wrong after the close, reopen #67 and add a correction comment rather than rewriting history.

---

## Open questions

- **OQ-1 - Cap drift.** `LISTING_PAGE_SIZE = 1000` assumes the hosted cap stays at 1000; if Supabase lowers it, a short page ends the loop early and truncation returns silently. The `ponytail:` comment names the upgrade path (read `Content-Range`); revisit only if a cap change is observed.
- **OQ-2 - Unchecked golds.** A gold material with no observed attempts is silently skipped by `coding_gold_agreement`; if the shared account is cleaned, the negative case stops being checked (the agreement `checked` count drops). Reporting unchecked golds is a candidate follow-up, out of scope here.
- **OQ-3 - Detail-fetch bound.** The even-spread detail fetch uses `id=in.(...)` with 5 ids, far below the cap; no paging needed. Revisit only if `CONTEXT_TOP_K` ever grows past the cap.

## Out of scope

- Re-implementing any part of #67; the scorer, selector, prompt, and resample stay as landed in `b6e286b`.
- Changing `code_not_derivable`, the self-check, or any generation contract.
- Schema, migration, Dexie, UI, or event changes.
- Committing or touching the uncommitted `repair-validation-resilience` work.
- Cleaning the pre-existing `college/` deletions, `graphify-out/`, or untracked e2e specs.
- Fixing the 18 pre-existing intelligence-suite failures.
- #49 (Phase 2 Integrated Verification), which starts after this ticket closes.

## References

- Issue [#67](https://github.com/rings0fsaturn/study-planner/issues/67) (body = AC1-AC6) · parent spec [#32](https://github.com/rings0fsaturn/study-planner/issues/32) · wayfinder map [#4](https://github.com/rings0fsaturn/study-planner/issues/4).
- `.work/active/coding-generation-context/plan/PLAN.md` - the original build plan (D-01..D-08).
- `.work/active/coding-generation-context/plan/VERIFICATION.md` - the AC1-AC6 ledger this plan extends.
- `.work/active/coding-generation-context/state.md` - the durable task state.
- `services/intelligence/app/generation/context.py` - the no-steer listing and code-seeking selection.
- `services/intelligence/scripts/eval_harness.py` + `scripts/eval_golds_coding.json` - the gold registry and its guard.
- `services/intelligence/scripts/retrieval_probe.py:105-127` - the paging idiom this plan reuses.
- Rules: `17-logging-and-tracing`, `42-assessment-and-practice-generation`, `52-github-cli-and-token`, `54-gpu-inference-sidecar`, `80-script-dry-run-before-full-runs`.
- `.work/specs/test-login-cred.txt` - live-run credentials (read-only; never printed or committed).
