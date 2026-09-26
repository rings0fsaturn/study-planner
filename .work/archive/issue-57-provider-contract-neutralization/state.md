# State - issue-57-provider-contract-neutralization
_Spec: GitHub issue #57 (no local specs/issues file) · Plan: archive/issue-57-provider-contract-neutralization/plan/PLAN.md · STATUS row: issue-57-provider-contract-neutralization · Status: done · Updated: 2026-09-26_

## Current state & next
- Done: #57 verified and closed 2026-09-26. All four phases completed.
- Acceptance 10/10 PASS; contract suite 32 passed; two close-out fixes landed in `88aee5d`.
- Wayfinder exit done: resolution comment posted, #57 closed, map #4 decision line appended,
  phase2-wayfinder frontier updated to #49 only, this task archived.
- Next: none for this task. The remaining Phase 2 frontier is #49 (Phase 2 Integrated Verification).

## Done so far
- 2026-09-26: task opened; plan + verification scaffold written; STATUS row added under Active.
- 2026-09-26: Phase 1 acceptance lock - no `gemini/` dir; request/response neutral envelope;
  `unsupported_request`; telemetry `reasoningTokens`; `llm_rubric` in both enums; manifest
  generation fixtures -> `provider/`; openapi refs resolve; fixtures ASCII; baseline 31 passed.
- 2026-09-26: Phase 2 gap fixes - em dash -> dash; added `test_contract_pack_has_no_em_or_en_dashes`.
- 2026-09-26: Phase 3 review - OCR delegate range `7a3764e..98a3b12` (10 files, all reviewed);
  thermo-nuclear review clean; fixed stale README purpose wording.
- 2026-09-26: Phase 4 wayfinder exit - commit `88aee5d`; resolution comment
  [#57 comment](https://github.com/rings0fsaturn/study-planner/issues/57#issuecomment-5847322580);
  #57 closed; map #4 decision line appended; phase2-wayfinder state + STATUS updated; archived.

## Flow trace
- Contract surface: `services/intelligence/contracts/phase2/provider/` (generation-request,
  generation-response, embedding-request, written-grading-response, guide-hint-frame,
  gated-reveal-response, README).
- Fixtures: `services/intelligence/contracts/phase2/fixtures/` incl. `manifest.json` (6
  generation fixtures -> `../provider/generation-response.schema.json`).
- Suite: `services/intelligence/contracts/phase2/tests/test_contracts.py` (offline, no key).
- Landed #57 commits: `1f950ed` neutralize, `ae11c8a` harden, `98a3b12` tighten (base `7a3764e`).

## Files affected
- services/intelligence/contracts/phase2/tests/test_contracts.py - dash guard test added; em dash
  replaced - acceptance bullet 8.
- services/intelligence/contracts/phase2/README.md - purpose wording neutralized - scope item 7.
- archive/issue-57-provider-contract-neutralization/plan/PLAN.md + VERIFICATION.md - plan and
  verification record.
- .work/STATUS.md - task row added; phase2-wayfinder frontier corrected (#68 removed).

## Pitfalls & rules
- Never `git add -A`: the worktree carries unrelated deletions under
  `college/mydeliverables/3rd-Review/for-submit/code-submit/` and untracked assets.
- `grep -rn "gemini"` allowed hits: `provider/embedding-request.schema.json` (unchanged), the
  README scoping notes, the embedding fixtures, and the `TRACEABILITY.md` history line.
- No em/en dashes in new or modified files (repo convention); guarded by a test now.
- `gh` egress is flaky; use the 5x retry loop (rule 52), never print the token.
- `ruff format --check` on `test_contracts.py` flags pre-existing hunks (lines 357/494/601); do
  not reformat them in this slice.

## Decisions in force
- Decided this is a verify-and-close slice, not a rebuild, because the tree already reflects the
  #54 envelope and the three #57 commits landed (2026-09-26).
- Decided to reuse `tests/test_contracts.py` rather than add a committed harness (ponytail).
- Waived intentionally: embedding `$id` keeps `/gemini/` (file moves unchanged; grep allows `$id`),
  embedding fixture `gemini` strings (fallback only), missing trailing newlines, pre-existing
  ruff-format hunks.

## Open
- none.
