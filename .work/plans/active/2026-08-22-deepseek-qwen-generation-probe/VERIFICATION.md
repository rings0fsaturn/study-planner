# Verification Log — DeepSeek × Qwen-sidecar generation-quality probe (#56)

## Phase 0: Plan docs

- PLAN.md committed at `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/PLAN.md`.
- Ticket #56 claimed (assignee `rings0fsaturn`).

## Phase 1: Claim ticket and stand up the runtime

- [ ] #56 shows assignee `rings0fsaturn`
- [ ] GPU sidecar `/health`: `cuda_available: true`, `loaded: true`, `device_name: AMD Radeon RX 9070 XT`
- [ ] OpenRouter credit balance > $0.50 (value recorded below, key never printed)

**Credit balance at start:** _to fill_

## Phase 2: Dependency + probe skeleton

- [ ] `openai` added to `services/intelligence/pyproject.toml`, `uv.lock` regenerated
- [ ] `generation_probe.py` imports cleanly without side effects

## Phase 3: Provider client, error taxonomy, metrics, tests

- [ ] Unit tests pass (count: _to fill_)
- [ ] `ruff check` clean on both new files
- [ ] No em/en dashes in `generation_probe.py`

## Phase 4: Live smoke run

- [ ] 4 smoke calls classified correctly (2 layers × 2 items, tier `off`)
- [ ] reasoning tokens == 0 for off tier
- [ ] parsed_ok for ok rows; citations ⊆ provided ids
- [ ] Projected full-run cost: _to fill_ (abort gate: > $1.00)

## Phase 5: Full-ladder run

- [ ] Raw record count >= 390 (or tier rejections documented)
- [ ] Outcome taxonomy tally recorded
- [ ] Sidecar stopped immediately after run

## Phase 6: Report + closure

- [ ] `summary.json` + `report.md` produced
- [ ] Human reviewed the report (HITL gate)
- [ ] Resolution comment on #56; ticket closed
- [ ] Map #4 decision line appended
- [ ] Pointer comment on #53
- [ ] `.work/STATUS.md` row + `last_updated` bumped