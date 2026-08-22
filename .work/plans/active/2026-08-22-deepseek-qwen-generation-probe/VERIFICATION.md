# Verification Log — DeepSeek × Qwen-sidecar generation-quality probe (#56)

## Phase 0: Plan docs

- PLAN.md committed at `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/PLAN.md`.
- Ticket #56 claimed (assignee `rings0fsaturn`).

## Phase 1: Claim ticket and stand up the runtime

- [x] #56 shows assignee `rings0fsaturn`
- [x] GPU sidecar `/health`: `cuda_available: true`, `loaded: true`, `device_name: AMD Radeon RX 9070 XT`, `reranker_loaded: true`
- [x] OpenRouter credit balance > $0.50 (value recorded below, key never printed)

**Credit balance at start:** $2.5000 (usage $0.0000, limit $2.50) — 2026-08-22

## Phase 2: Dependency + probe skeleton

- [x] `openai` added to `services/intelligence/pyproject.toml`, `uv.lock` regenerated (openai 3.3.1)
- [x] `generation_probe.py` imports cleanly without side effects

## Phase 3: Provider client, error taxonomy, metrics, tests

- [x] Unit tests pass: 9 passed (6.86s)
- [x] `ruff check` clean on both new files; `ruff format --check` clean
- [x] No em/en dashes in `generation_probe.py`

## Phase 4: Live smoke run

- [x] 4 smoke calls classified `ok` (2 layers × 2 items, tier `off`)
- [x] reasoning tokens == 0 for off tier
- [x] parsed_ok for all ok rows; citations ⊆ provided ids (verified per record)
- [x] Projected full-run cost: **$0.046** (abort gate: $1.00) — smoke avg 1036 prompt / 181 completion tokens
- [x] raw.jsonl cleared after smoke; contexts.json kept (60 contexts: 30 S + 30 R)
- Fixes landed during smoke: key split (2-part), continuation guard, SDK v3 raw `.text` parse

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