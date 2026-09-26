# Plan - issue-57-provider-contract-neutralization

Ticket: [rings0fsaturn/study-planner#57](https://github.com/rings0fsaturn/study-planner/issues/57) · Opened 2026-09-26
Wayfinder map: [#4](https://github.com/rings0fsaturn/study-planner/issues/4) · Decision ticket: [#54](https://github.com/rings0fsaturn/study-planner/issues/54) (closed)
Spec: the ticket body (no local `specs/issues/` file exists for #57).

Pure contract-file work under `services/intelligence/contracts/phase2/`.
No adapter, service, worker, app, Dexie, or Supabase code.

## Goal

Neutralize the Phase 2 provider contract pack in place for DeepSeek via OpenRouter
while preserving the public normalized boundary, exactly per the #54 resolution.

## Known ground truth (2026-09-26)

- The ticket is still `OPEN`, but `.work/active/phase2-wayfinder/state.md:6` says
  "#57 contract neutralization landed", and the live tree already shows `provider/`
  (7 files), no `gemini/` directory.
- Three #57 commits appear to have landed: `1f950ed` neutralize, `ae11c8a` harden,
  `98a3b12` tighten (verify SHAs against the tree before quoting them).
- So this is verify-and-close: fix gaps only if verification goes red.

## Acceptance (from ticket)

1. No `gemini/` directory or `gemini-`-named schema reference except the intentional
   `embedding-request.schema.json` note.
2. `provider/generation-request.schema.json` + `provider/generation-response.schema.json`
   validate the #54 envelope (flattened, neutral, `reasoningTokens`, `routedProvider`).
3. `provider-error.schema.json` code enum includes `unsupported_request`.
4. `generation-telemetry.schema.json` accepts optional `reasoningTokens`.
5. Fixtures + `manifest.json` + `tests/test_contracts.py` regenerate and pass offline;
   ASCII-only fixtures; `manifest.json` paths point at `provider/`.
6. `openapi.yaml` refs resolve; `grader` enum is `llm_rubric` in `openapi.yaml` and
   `durable-events.schema.json`.
7. `grep -rn "gemini" services/intelligence/contracts/phase2/` shows only the
   embedding-request + its scoping note + history-free `$id` paths.
8. No em/en dashes in new/modified files.

## Phases

### Phase 1 - Acceptance lock, failing-first (TDD red; no source edits yet)

- 1.1 Record each Acceptance line as a check (throwaway script or recorded commands;
  reuse `tests/test_contracts.py`, do not build a new committed harness - ponytail).
- 1.2 Baseline the offline suite:
  `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py -q`.
- 1.3 Run the ticket greps and classify hits: allowed (embedding-request + scoping note +
  history-free `$id`s + historical TRACEABILITY prose) vs gap.
- Gate: no source edit until Phase 1 is recorded red-or-green in `SCRATCHPAD.md`.

### Phase 2 - Minimal gap fixes only if Phase 1 is red (ponytail)

- 2.1 One red-green micro-loop per gap: smallest failing assertion in
  `tests/test_contracts.py` first (red), then the JSON/fixture/README fix (green),
  no refactor.
- 2.2 Suspects only: `provider/embedding-request.schema.json` `$id` with `/gemini/`;
  `fixtures/embedding-batch.json` + `fixtures/telemetry-embedding.json` `"gemini"`
  model strings (keep if the embeddings-fallback note covers it); any `openapi.yaml`
  `./gemini/` ref left.
- 2.3 Re-run Phase 1 checks after each fix. No service/adapter/app change by contract.
- Deletion over addition; one-line enum edit over a new file; no new dependencies.

### Phase 3 - Code review + verification loop (blocks close)

- 3.1 `open-code-review-delegate` + `thermo-nuclear-code-quality-review`; fix all
  correctness findings, waive style nits explicitly.
- 3.2 Verification loop: contract suite green, `manifest.json` refs resolve, ASCII
  check passes, dash check empty, `git status --short` shows only intended
  `contracts/phase2/` paths.
- 3.3 If Phase 2 made zero edits, review the landed #57 diff
  (`git diff <base>^..HEAD -- services/intelligence/contracts/phase2/`) so the close
  is reviewed, not rubber-stamped.

### Phase 4 - Wayfinder exit

- 4.1 Post the resolution comment on #57 (bounded 5x retry per rule 52), ticking each
  Acceptance line with evidence (test count, grep output, SHAs); token from
  `.env.git.local`, never printed.
- 4.2 Close #57; append the Decisions-so-far line to map #4; update
  `active/phase2-wayfinder/state.md` frontier (#49 remains); archive this task.
- 4.3 Confirm `git status --short` is clean of unrelated changes before any commit;
  leave the pre-existing `college/mydeliverables/.../for-submit/` deletions untouched.

## Dependencies

- None external. Offline contract tests need no API key, GPU sidecar, Supabase, or
  `./full-app` runtime.
- Tooling present: `gh`, `uv`, `grep`, `git`. `GH_TOKEN` from gitignored
  `.env.git.local` (read + close only).

## Risks

- HIGH: ticket OPEN but code reported landed; closing on assumption could certify
  drift. Mitigation: Phase 1 re-verifies exact Acceptance lines first.
- HIGH: dirty worktree has unrelated deletions under
  `college/mydeliverables/3rd-Review/for-submit/code-submit/`. Mitigation: never
  `git add -A`; check `git status --short`; leave those paths alone.
- MEDIUM: `grep gemini` acceptance is ambiguous (embeddings fixtures + `$id` beyond
  the stated allowlist). Mitigation: pass only with scoping-note evidence; fix
  smallest-diff only where the ticket demands.
- MEDIUM: `gh` TLS/EOF flakiness. Mitigation: 5x retry + sleep; no proxy/TLS change.
- LOW: `test_contracts.py` `jsonschema.RefResolver` deprecation warnings. Record only.

## Estimated complexity

LOW if Phase 1 stays green (verify + review + exit, ~1-2h). MEDIUM only if real
schema/fixture gaps surface, each as one red-green micro-loop.
