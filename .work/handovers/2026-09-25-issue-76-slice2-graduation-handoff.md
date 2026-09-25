# Handoff – start #76 Jev slice-2 graduation

_From: 2026-09-25 session (closed #75 slice-1 graduation) · To: next session · Ticket: [#76](https://github.com/rings0fsaturn/study-planner/issues/76) "Jev slice-2 graduation: RAG enforce, worker filter first" (wayfinder) · Map: [#69](https://github.com/rings0fsaturn/study-planner/issues/69)_

## Read first, in this order

1. `.work/STATUS.md` - the jev-integration row.
2. `.work/active/jev-integration/state.md` - the durable task record. **This is the whole context**; the scratchpad is reset.
3. Ticket #76 in full (body summarised below).
4. `.agents/skills/jev/SKILL.md` - the Jev dev/debug skill; consult every session.
5. Rules: 17 (request_id/trace_id), 42 (assessment contracts), 80 (`--limit 2` dry run before any full run).

## Where things stand

- **#75 is CLOSED.** Slice-1 is in enforce: suitability pre-gate coding-only, citation confident-reject drops with `citation_missing`. Bands `APPROVE_AT=0.9` / `BLOCK_AT=0.1` / `AUTO_ACCEPT=0.8`. Commits `dd28420`, `f7c59f2`, `fce91ec`, `3c63615`, close-out `a4bc966`.
- **The task folder stays `active/jev-integration/`.** It covers slices 1/2/4 (#70-#77). Do not archive it; #76 and #77 still target it.
- **Frontier is #76.** #77 (rubric flag queue) is queued last.
- Working tree at handoff: HEAD `a4bc966` on `project/phase-2`. `services/intelligence` and `.work/active/jev-integration` are clean.

## What #76 asks for

Where the slice-2 enforce bands land (`PASSAGE_THRESHOLDS` + wording) after a stress sweep, and what enforces first - worker filter, retrieval slot, or both.

Decide: (a) thresholds per Noul from sweep distributions (starting points `injection_max 0.70`, `contradicts_min 0.70`, `relevant_min 0.45`, `evidence_min 0.55`); (b) prompt variants locked (`batch_passage_questions` derived from the winner so shapes cannot drift); (c) **staging - worker slot enforces first** (filter + top-by-relevance floor), retrieval slot graduates only after the worker validates live; (d) sidecar relation at enforce (Jev filter + Qwen3 rerank compose, head-to-head disagreement analysis posted); (e) latency ceiling confirmed (p50/p95 vs `JEV_SLICE2_TIMEOUT_MS=15000` and the 90 s visibility window).

Phase A (stress) runs first; **Phase B (enforce) may not start until its distributions are posted.**

## What the code already has (build on it, do not rewrite)

- `app/generation/worker.py::_jev_classify_passages_shadow` - worker-passage classify shadow, log-only, fail-open.
- `_summarize_passage_shadow` - the pure summarizer; emits `jev_kept` / `jev_dropped` / `jev_floor` / `jev_input_tokens`.
- `app/jev/questions.py::passage_questions` (4 Nouls) + `batch_passage_questions(count)` + `route_passage` / `route_batch_passage` with `PASSAGE_THRESHOLDS`.
- `app/jev/measure_slice1.py` - the pure threshold-grid summarizer (#75). #76 shares this harness; extend rather than fork.
- `scripts/jev_sweep_slice1.py` - the budget-guarded sweep runner (#75). #76 reuses the same shape (variant grid x threshold grid, offline reruns at zero extra spend).
- Slice-2 client: `JevClient.from_env("JEV_SLICE2", default_timeout_ms=15000)` in `worker_main.py`.

## The single most important finding to carry in

**The slice-2 passage shadow dropped 5/5 chunks in every one of the 6 live cells** (`kept=0/5`) across two code-heavy PDFs. That is the shadow's own verdict on real retrieval windows. It is log-only today so nothing broke - but if that behaviour is real, flipping the worker filter to enforce would strip the entire context from every generation. **Investigate this before any enforce decision.** It is the likeliest reason the sweep looks the way it does, and it is the one thing that could make #76's answer "do not enforce yet".

Second finding: **Jev and the provider's own refusal are separate gates.** On code-heavy prose, DeepSeek's `unsuitable` schema outcome did the refusing while Jev sat advisory in `review` (0.44-0.88). Do not attribute a provider refusal to Jev.

## Environment gotchas that will cost time otherwise

- **Use the native `/usr/bin/docker`, not the Windows `docker.exe`.** The Windows client produces containers whose host directory binds are EMPTY, which silently puts the GPU sidecar on CPU (`cuda_available: false`, `Cannot load librocdxg.so`). `docker desktop restart` does not fix it. See the `docker-host-bind-mount-diagnosis` skill.
- **GPU sidecar is demand-started (rule 54)** and was stopped at session end. Any embedding or rerank work needs it up: `docker compose -f services/embedder/docker-compose.yml up -d`. Verify `GET /health` reports `cuda_available: true`, `device: cuda:0`, dimensions 768.
- **The frozen retrieval baseline must not regress.** Spot-check r@1 0.77 / r@3 0.97 via the eval harness. The sweep needs the sidecar for query embeds.
- **Run the sweep from the repo root** as `services/intelligence/scripts/...`; a bare `scripts/` path fails under `uv run --package intelligence`.
- **Restart the managed runtime after editing service source** (WSL does not reliably watch `/mnt/d`).
- `./full-app status full` reported the runtime **running** at handoff (intelligence :8000, app :5173, worker with `JEV_SLICE1_ENABLED=true`). Verify rather than assume.

## Open hygiene items to clear first

- **Shared-account leftovers:** the 2026-09-25 runs left test assessments behind (2 coding + the 6-cell matrix rows, one stuck `generating` from a Piston-down window). Clean before any live run, or strict-mode locators will collide.
- **Untracked files at risk:** `e2e/pdf/CSAPP_2016.pdf` and `e2e/pdf/grokking-algorithms-2nd-edition-2nd_compress.pdf` (7.3 MB, operator-added). `e2e/pdf` is NOT gitignored and the older sample PDFs ARE tracked, so these two are untracked-by-omission. Also untracked: the two throwaway `e2e/jev-*-live.spec.ts` diagnostics. **Never run `git clean -fdx` at the repo root.**

## Suggested first moves

1. Read the five files above; re-read ticket #76.
2. Run the slice-2 sweep with `--limit 2` on a handful of rows first (rule 80), inspect the records, then scale.
3. Reproduce the `kept=0/5` starvation on a small sample **before** designing the enforce grid - it may redefine what Phase A needs to measure.
4. Claim #76 on the tracker before starting work (map #69's rule: assign to yourself first).
