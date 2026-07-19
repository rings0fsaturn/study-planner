---
title: KT Credibility Validation Next Session Handover
purpose: Resume KT research after real-data integration by following the credibility guidelines and maintaining the living tracker.
audience: next implementation agent, candidate
status: ready-to-resume
mode: transition
last_updated: 2026-06-14
related:
  - ../research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md
  - ../research/doc/2026-06-14-kt-credibility-tracker.md
  - ../plans/2026-06-14-kt-realdata-integration.md
  - ./2026-06-14-kt-realdata-integration-resume.md
---

## TL;DR

The KT real-data integration is complete and committed through `d04057b`, but the credibility audit
found that only one model x dataset cell is currently reportable: `dkt x nips2020`.

Next session should continue KT research by treating
`research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md` as the acceptance bar and
`research/doc/2026-06-14-kt-credibility-tracker.md` as the living state. Update the tracker as each
cell is fixed, re-run, inspected, and gated.

Do not treat `public_raw` provenance by itself as credibility. A cell is credible only when gates
G1-G8 pass, or it is explicitly blocked with a recorded reason.

## Goal / why

The project now has real public KT data wired into the pipeline, but most cells are still not valid
research findings because they were generated with smoke-depth training, degenerate pyBKT keying, or
silent CLST aliasing.

The next research run should convert this from "real-data infrastructure exists" into "reportable
KT findings are explicitly validated, limited, and traceable." The final thesis/report should cite
only cells that the tracker marks credible.

## Key references

| Path | Why it matters |
|---|---|
| `research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md` | Source of truth for gates G1-G8 and the definition of "credible". |
| `research/doc/2026-06-14-kt-credibility-tracker.md` | Living tracker to update after every rerun, gate decision, or blocked cell. |
| `../plans/active/2026-06-14-kt-realdata-integration.md` | Completed R1-R3 plan; useful for provenance and commands already run. |
| `research/comparison/tests/test_kt_join.py` | Existing clean-env tests; extend this for the automated credibility guards in S5. |
| `research/kt-bench/train.py` | Real pyKT runner; known issue: `clst` is currently aliased to `dkt`. |
| `research/comparison/src/research_comparison/kt/pybkt_runner.py` | Real pyBKT runner; known issue: nips2020 KC keying degenerates pyBKT. |
| `research/comparison/src/research_comparison/kt/join.py` | Clean-env join over the active result grid; keep it torch/pyKT-free. |
| `research/results/kt/` | Active JSON result tree. This is gitignored, so tracker docs must preserve the durable interpretation. |
| `college/scope/research-tasklist.md` | Do not flip Phase 4 to fully complete until tracker gates support that claim. |

## Last known-good state

Branch: `project/phase-1`.

Recent KT commits:

| Commit | Meaning |
|---|---|
| `7295d30` | Phase R1: land KT real-data folds. |
| `0789554` | Phase R2: replace KT deep-model stubs. |
| `96a22a6` | Phase R3 start marker. |
| `5dc2885` | Phase R3: run real pyBKT and refresh KT artifacts. |
| `e1d7cee` | Phase R3: record completion sha. |
| `100080a` | Phase R3: refresh KT DKT full-run artifacts. |
| `d04057b` | Phase R3: record audit completion sha. |

Current active result state:

| Item | State |
|---|---|
| `research/results/kt/*.json` | 360 active JSON rows, all `public_raw`. |
| `research/results/kt_summary.json` | `folds_raw_sources == ["public_raw"]`, `gaps == 0`, `result_count == 360`. |
| Old `poj__*.json` smoke rows | Moved out of active results to `/private/tmp/kt-smoke-archive-2026-06-14`. |
| `kt_provenance.txt` | Does not mention `smoke_fixture`; report artifacts exist but are not yet all credible. |
| DKT nips2020 full run | Mean AUC `0.7426`; validation sequence counts `[1503,1537,1481,1497,1528]`; `smoke_sequences_per_fold == 0`. |

Last verification:

```bash
uv run --package research-comparison pytest research/comparison/tests/test_kt_join.py -q
```

Result: 8 tests passed.

## Credibility state to preserve

The tracker currently says "audited 2026-06-14 @ `d04057b`".

| Cell | State | Why |
|---|---|---|
| `dkt x nips2020` | Reportable today | Full depth, public raw, AUC `0.743`, ECE `0.037`, cold-start sane. Tracker still marks G7 pending, so handle reproducibility before calling the whole grid finished. |
| `pybkt x accoding` | Partial | AUC `0.606`, but needs accoding subsample stability and KC-fidelity review. |
| `pybkt x nips2020` | Not credible | Degenerate flat AUC around `0.508-0.509`, ECE around `0.485`; compound KC keying likely creates thousands of one-shot skills. |
| `clst x *` | Not credible | Silent alias: `clst` maps to `dkt` in `train.py`; G8 fails. |
| Most other deep cells | Not credible | Smoke-depth results: `epochs=1`, `smoke_sequences_per_fold=64`, often `n_pred=64`. |

Important inconsistency: the tracker row for `dkt x nips2020` has overall status
`credible`, but G7 is still pending in the matrix. Resolve that explicitly during the next run.

## Next plan

Follow the checklist in `research/doc/2026-06-14-kt-credibility-tracker.md`, not a new plan.

| Step | Next-session intent |
|---|---|
| S1 | Resolve CLST fidelity: implement a distinct method or relabel the alias and add a model registry manifest. |
| S2 | Fix pyBKT KC keying for nips2020: split compound Eedi subject strings into atomic KCs or document a bounded keying choice. |
| S3 | Re-run full-depth deep models for remaining non-credible cells with `--smoke 0 --epochs 5`. |
| S4 | Re-run pyBKT after the KC fix and verify test-size prediction counts. |
| S5 | Add clean-env credibility guard tests in `research/comparison/tests/test_kt_join.py`. |
| S6 | Check accoding subsample stability at multiple `max_learners` values. |
| S7 | Rejoin and regenerate report artifacts after the credible set changes. |
| S8 | Update the tracker and reportable allow-list. |
| S9 | Only then update `research-tasklist.md` to a stronger completion claim. |

Recommended first concrete action:

```bash
sed -n '1,260p' research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md
sed -n '1,260p' research/doc/2026-06-14-kt-credibility-tracker.md
rg -n "PYKT_MODEL|clst|model_registry|skill|concept|subject" research/kt-bench research/comparison/src/research_comparison/kt
```

Then start S1 before burning time on more training. If `clst` is still a silent alias, re-running it
only creates more non-credible artifacts.

## Commands already used for the full DKT nips2020 rerun

These were run in `research/kt-bench` for the one full verified DKT cell:

```bash
env PYTHONPYCACHEPREFIX=/private/tmp/study-pycache WANDB_MODE=offline ./.venv/bin/python train.py \
  --dataset nips2020 --models dkt --folds folds/nips2020_folds.json --epochs 5 --batch-size 32

env PYTHONPYCACHEPREFIX=/private/tmp/study-pycache WANDB_MODE=offline ./.venv/bin/python coldstart.py \
  --dataset nips2020 --models dkt --folds folds/nips2020_folds.json --k 3,5,10,20 --batch-size 32

env PYTHONPYCACHEPREFIX=/private/tmp/study-pycache WANDB_MODE=offline ./.venv/bin/python calibrate.py \
  --dataset nips2020
```

Then from repo root:

```bash
uv run --package research-comparison python -m research_comparison.kt.join
uv run --package research-comparison pytest research/comparison/tests/test_kt_join.py -q
```

## Guardrails

- Update `research/doc/2026-06-14-kt-credibility-tracker.md` during the work, not only at the end.
- Keep `research/comparison` clean-env friendly; tests there should read JSON/CSV artifacts and avoid importing torch, pyKT, or pyBKT.
- Do not report any cell as credible if `smoke_sequences_per_fold > 0`, `epochs < 5`, `n_pred` is the smoke signature, or G8 fails.
- Do not let stale JSON rows pollute the active grid. `join.py` already filters the expected grid; preserve that behavior.
- Keep report claims narrower than artifact existence. The report may have generated tables/figures, but only tracker-green cells should be cited as findings.
- The worktree has unrelated dirty files from prior sessions. Use scoped staging if committing; do not sweep `.agents`, `.codex`, `.cursor`, or broad repo noise into KT commits unless the user asks.

## Open questions & assumptions

- Whether `clst` should be implemented as a distinct method or honestly relabeled is a research/reporting decision. The next agent should prefer truthful labeling over pretending a method exists.
- For pyBKT nips2020, the KC fix choice should be written down in the tracker: atomic subject expansion versus bounded hashing changes interpretability.
- For accoding, credibility depends on stability under the `max_learners` subsample, not just one AUC number.
- The current results directory is local and gitignored; the tracker is the durable record of what was actually credible.

## Definition of done for the next session

At minimum, the next session should leave the tracker strictly more accurate than it started:

- S1 and/or S2 implemented or explicitly blocked with evidence.
- Any rerun cell has G1-G8 statuses updated with AUC, ECE, cold-start, depth, and notes.
- Guard tests exist for the automated gates that can be checked without heavy ML dependencies.
- Report artifacts and `research-tasklist.md` are updated only when the tracker supports the claim.

If the session cannot finish all cells, that is acceptable. Do not broaden the claim; record the
remaining blocked or pending cells in the tracker.
