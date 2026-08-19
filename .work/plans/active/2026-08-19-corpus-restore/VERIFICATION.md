# VERIFICATION — Corpus Restore (wipe-then-re-ingest the frozen 572p corpus)

Plan: [`PLAN.md`](PLAN.md) · Slug: `2026-08-19-corpus-restore` · Branch: `phase2/issue-37`

## Acceptance criteria (pre-filled)

| # | Criterion | Status |
|---|---|---|
| 1 | `corpus_restore.py wipe --owner-id 29288e28-… --dry-run` snapshots the owner's library without mutating anything (writes `evidence/<run>-pre-wipe.json`). | ☐ |
| 2 | `corpus_restore.py wipe --yes` deletes only that owner's `materials`, `content_chunks`, `ingestion_jobs`, `generation_telemetry`, and `material-raw/<owner>/*` storage objects; post-wipe `materials?user_id=eq.<owner>` is empty. | ☐ |
| 3 | `corpus_restore.py restore` re-ingests `e2e/pdf/sample-textbook-572page.pdf` at `80c8b138-b544-4095-8dc0-1c390ac70da2` through the `materials_enqueue_ingestion` trigger to `ready`, provider `qwen-sidecar`, `~754-788` chunks, `0` NULL, `0` skipped, sampled vectors 768-dim L2≈1.0. | ☐ |
| 4 | Live DB: `materials` row = `ready | qwen-sidecar | 788`; `content_chunks` = `788 chunks / 788 embedded`. | ☐ |
| 5 | Parity gate ±0.01 vs frozen baseline: dense r@1 0.70 / r@3 0.83 / MRR 0.788; hybrid 0.73/0.90/0.816; reranked 0.77/0.97/0.858. | ☐ |
| 6 | Service tests: new `test_corpus_restore.py` green; full suite = prior 264 + new, 5 pre-existing golden-fixture failures unchanged; ruff clean. | ☐ |
| 7 | `.work/STATUS.md` follow-up row ("restore the dev corpus embeddings") flipped to Done with evidence links; plan folder archived. | ☐ |

## Implementation log

### Phase 0 — Plan doc + status row

- Status: `☐ Not started` → (filled during implementation)
- Files: `PLAN.md`, `VERIFICATION.md`, `.work/STATUS.md`
- Notes: —

### Phase 1 — Wipe primitive + preflight

- Status: ✅ Complete
- Files: `services/intelligence/scripts/corpus_restore.py`, `services/intelligence/tests/test_corpus_restore.py`
- Test run: `2 passed`; ruff clean; live dry-run snapshot `20260819-085506-pre-wipe.json` (17 materials / 799 chunks / 18 jobs / 240 telemetry / 42 storage objects incl. 27 orphan folders)
- Notes: storage listing is POST-with-body (not GET); orphan storage folders (no material row) now deleted too — clean slate. See PLAN.md notes.

### Phase 2 — Restore subcommand

- Status: `☐ Not started`
- Files: `services/intelligence/scripts/corpus_restore.py` (extend)
- Test run: —
- Notes: —

### Phase 3 — Live restore + parity + close-out

- Status: `☐ Not started`
- Evidence: —
- Notes: —