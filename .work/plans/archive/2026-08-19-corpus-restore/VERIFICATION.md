# VERIFICATION — Corpus Restore (wipe-then-re-ingest the frozen 572p corpus)

Plan: [`PLAN.md`](PLAN.md) · Slug: `2026-08-19-corpus-restore` · Branch: `phase2/issue-37`

## Acceptance criteria (pre-filled)

| # | Criterion | Status |
|---|---|---|
| 1 | `corpus_restore.py wipe --owner-id 29288e28-… --dry-run` snapshots the owner's library without mutating anything (writes `evidence/<run>-pre-wipe.json`). | ✅ |
| 2 | `corpus_restore.py wipe --yes` deletes only that owner's `materials`, `content_chunks`, `ingestion_jobs`, `generation_telemetry`, and `material-raw/<owner>/*` storage objects; post-wipe `materials?user_id=eq.<owner>` is empty. | ✅ |
| 3 | `corpus_restore.py restore` re-ingests `e2e/pdf/sample-textbook-572page.pdf` at `80c8b138-b544-4095-8dc0-1c390ac70da2` through the `materials_enqueue_ingestion` trigger to `ready`, provider `qwen-sidecar`, `~754-788` chunks, `0` NULL, `0` skipped, sampled vectors 768-dim L2≈1.0. | ✅ |
| 4 | Live DB: `materials` row = `ready | qwen-sidecar | 754`; `content_chunks` = `754 chunks / 754 embedded`. | ✅ |
| 5 | **Parity gate — Decision A (accepted drift):** frozen baseline ±0.01 (dense 0.788 / hybrid 0.816 / rerank 0.858) was measured on the 788-chunk pre-C3 split. Re-ingest yields 754 chunks (30-token overlap, `chunking.py:3-6,18`) → dense 0.706 / hybrid 0.720, accepted as the **new durable baseline** (user decision, 2026-08-19). Rerank (0.858) not re-run on 754 — needs in-process `sentence_transformers`, not in test venv; deferred. | ✅ (Decision A) |
| 6 | Service tests: new `test_corpus_restore.py` green (9 tests); ruff clean. | ✅ |
| 7 | `.work/STATUS.md` follow-up row ("restore the dev corpus embeddings") flipped to Done with evidence links; plan folder archived. | ✅ |

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

- Status: ✅ Complete
- Files: `services/intelligence/scripts/corpus_restore.py` (extend)
- Test run: `7 passed`; ruff clean; live idempotency-guard smoke passed (refuses to run over existing `failed/None` material, no mutation)
- Notes: default `--pdf` resolved against repo root; guard verified. See PLAN.md notes.

### Phase 3 — Live restore + parity + close-out

- Status: ✅ Complete (Decision A — accept 754 as durable baseline)
- Evidence:
  - `evidence/20260819-090845-pre-wipe.json` — pre-wipe snapshot (17 materials / 799 chunks / 18 jobs / 240 telemetry / 42 storage objects incl. 27 orphan folders)
  - `evidence/20260819-090845-wipe.json` — wipe result
  - `evidence/20260819-091457-restore.json` — restore result: `ready / qwen-sidecar / 754 chunks / 0 NULL / 0 skipped / 768-dim / 67 telemetry records`
  - `/tmp/bakeoff-restore.json` + bakeoff report — dense r@1 0.60 / r@3 0.77 / MRR 0.706; hybrid r@1 0.60 / r@3 0.80 / MRR 0.720 on the 754 corpus
  - `retrieval_probe.py --hybrid` live RPC: MRR 0.356 — **invalid cross-space comparison** (probe embeds queries with Gemini, corpus is Qwen sidecar; `retrieval_probe.py:53-72,136` hard-requires `GEMINI_API_KEY`); documented, deferred.
- Notes:
  - Live wipe + restore ran clean against the shared dev account (owner `29288e28-…`).
  - **Chunk-count finding:** frozen baseline (788) was the pre-C3 60-token overlap; current chunker is 30-token (`chunking.py:3-6,18`) → 754. Not a restore defect.
  - **Decision A (user, 2026-08-19):** accept 754 as the new durable baseline; do NOT revert overlap or chase 788 metric continuity. Recorded in `research/doc/2026-08-15-retrieval-quality-program-results.md` and `research/doc/2026-08-16-qwen3-gpu-benchmark.md`.
  - **Vector-check fix (live-found):** PostgREST returns `halfvec(768)` as a serialized string; `_check_vectors` originally measured string length (reported 9513 "dims"). Fixed with `_parse_vector` (`corpus_restore.py:315-330`) + tests.
  - **Storage-list fix (live-found):** storage listing is POST-with-body, not GET; orphan storage folders (no material row) are now deleted too.
  - Full service suite not re-run (test env has no torch/`sentence_transformers`); new `test_corpus_restore.py` (9 tests) + ruff clean are the gate for this script.