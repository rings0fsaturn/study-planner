# VERIFICATION - issue-57-provider-contract-neutralization

Ticket: [rings0fsaturn/study-planner#57](https://github.com/rings0fsaturn/study-planner/issues/57) · Started 2026-09-26

Landed #57 commits under review: `1f950ed` (neutralize), `ae11c8a` (harden), `98a3b12` (tighten),
on base `7a3764e`.

## Acceptance criteria

| AC | Where it is satisfied | Evidence |
|---|---|---|
| No `gemini/` directory or `gemini-`-named schema ref except the embedding-request note. | `provider/` (7 files); `gemini/` deleted | Acceptance check 1 PASS; grep hits limited (check 8). |
| Request + response schemas validate the #54 envelope (flattened, neutral, `reasoningTokens`, `routedProvider`). | `provider/generation-request.schema.json`, `provider/generation-response.schema.json` | Checks 2, 3 PASS; suite asserts shape + conditional rejects. |
| `provider-error.schema.json` code enum includes `unsupported_request`. | `provider-error.schema.json:9` | Check 4 PASS. |
| `generation-telemetry.schema.json` accepts optional `reasoningTokens`. | `generation-telemetry.schema.json:8` | Check 5 PASS. |
| Fixtures + `manifest.json` + suite pass offline; ASCII-only; manifest paths point at `provider/`. | `fixtures/`, `tests/test_contracts.py` | Check 6 (6 generation fixtures -> `../provider/generation-response.schema.json`), check 9 ASCII PASS; suite 32 passed. |
| `openapi.yaml` refs resolve; `grader` enum is `llm_rubric` in both files. | `openapi.yaml`, `durable-events.schema.json` | Check 7 PASS; `test_openapi_refs_resolve_locally` green. |
| `grep -rn "gemini"` shows only allowed hits. | phase2 tree | Check 8 PASS: README scoping notes, `provider/embedding-request.schema.json` (unchanged), embedding fixtures, `TRACEABILITY.md` history. |
| No em/en dashes in new/modified files. | touched files | Check 10 PASS; new `test_contract_pack_has_no_em_or_en_dashes` guard. |

## Gates

| Gate | Result |
|---|---|
| `uv run --package intelligence pytest contracts/phase2/tests/test_contracts.py -q` | 32 passed, 67 RefResolver warnings (2026-09-26) |
| Consolidated acceptance script (10 checks) | ALL PASS (2026-09-26) |
| `ruff check` on `tests/test_contracts.py` | all checks passed |
| `ruff format --check` on `tests/test_contracts.py` | would reformat 3 pre-existing hunks (lines 357/494/601, from #41/#42); NOT reformatted to keep the #57 diff scoped; added code is format-clean |
| ASCII-only fixtures | PASS |
| em/en dash scan | PASS |
| Secret-pattern scan on #57 diff | no secrets |
| `git status --short -- contracts/phase2/` | only `README.md` + `tests/test_contracts.py` (this session) |

## Code review (Phase 3)

- `open-code-review-delegate`: preview range `7a3764e..98a3b12`, 10 reviewable files; system rules
  were key-spelling only; every file reviewed.
- `thermo-nuclear-code-quality-review`: no structural regression; schemas are declarative; test file
  stayed under 1k lines.

### Findings

| Severity | Finding | Disposition |
|---|---|---|
| Gap | em dash in `tests/test_contracts.py:395` (a #57-regenerated file); acceptance bullet 8. | Fixed: dash replaced; guard test added (red -> green). |
| Gap | `README.md:3` purpose still said "Gemini integration", stale after neutralization (scope item 7 wording). | Fixed: now "OpenRouter generation". |
| Waived (intentional) | `provider/embedding-request.schema.json` `$id` retains `/gemini/` while the file moved. | Ticket scope item 1 moves it "unchanged" and keeps it Gemini-shaped; grep acceptance allows `$id` paths. |
| Waived (intentional) | `fixtures/embedding-batch.json` + `telemetry-embedding.json` keep `gemini` model strings. | Embeddings fallback only; covered by the scoping note. |
| Waived (low) | Missing trailing newline in `provider/README.md` and several fixtures. | Declarative JSON/ASCII; no repo requirement; avoids diff noise. |
| Waived (pre-existing) | `ruff format` wants unrelated hunks in `test_contracts.py`. | Out of #57 scope; changing them would add diff noise. |

## Log

- 2026-09-26: task opened, plan + verification scaffold written, STATUS row added.
- 2026-09-26: Phase 1 green except one em dash; Phase 2 fixed dash + added guard; Phase 3 review
  fixed README wording; acceptance ALL PASS, suite 32 passed.
