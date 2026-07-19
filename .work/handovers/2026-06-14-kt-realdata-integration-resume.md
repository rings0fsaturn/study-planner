---
title: KT Real-Data Integration Resume
purpose: Preserve the blocked Part 3 KT bench context and point the next session at the new real-data integration plan.
audience: next implementation agent, candidate
status: ready-to-implement
last_updated: 2026-06-14
related:
  - ../plans/2026-06-14-kt-realdata-integration.md
  - ../plans/2026-06-13-research-tier-3-kt-bench.md
  - ./2026-06-14-kt-datasets-acquired-plan-handoff.md
  - ./2026-06-13-research-tier-status-and-blockers.md
---

## TL;DR

Part 3 KT bench infrastructure is built and committed through `4535bf1`, but it was
blocked as a final deliverable because all KT outputs were generated from smoke fixtures.
The user has now found the real datasets and a new implementation plan exists at
`../plans/active/2026-06-14-kt-realdata-integration.md`.

Next session should execute that plan from Phase R1, not resume the old blocked goal as-is.
Read the plan header first, then run R1 prereqs and start with real-data landing plus the
ACcoding adapter.

## Goal / why

Original goal was to complete `../plans/active/2026-06-13-research-tier.md` Part 3 at a high standard.
The pipeline was implemented, but completion was intentionally not claimed because public
benchmark numbers require real Eedi/NeurIPS and coding-modality data.

The new goal is to finish that same Part 3 honestly by replacing smoke provenance with
`public_raw` provenance and regenerating the KT report artifacts from real datasets.

## Key references

| Path | Why it matters |
|---|---|
| `../plans/active/2026-06-14-kt-realdata-integration.md` | Source of truth for the next implementation run; phases R1-R3 are not started. |
| `archive/2026-06-14-kt-datasets-acquired-plan-handoff.md` | Prior handover that describes acquired datasets and why the integration plan exists. |
| `../plans/active/2026-06-13-research-tier-3-kt-bench.md` | Original Part 3 plan; phases 4a/4b/4c are complete but smoke-backed. |
| `research/kt-bench/preprocess.py` | Current fold export; real-data plan modifies it for `accoding` and sequence sidecars. |
| `research/kt-bench/train.py` | Current deep-runner is a deterministic synthetic stub; R2 must replace it with real pyKT training. |
| `research/kt-bench/coldstart.py` | Current cold-start runner is synthetic; R2 must evaluate real first-k predictions. |
| `research/comparison/src/research_comparison/kt/pybkt_runner.py` | Current pyBKT runner is synthetic; R3 must fit real pyBKT from sidecars. |
| `research/comparison/src/research_comparison/kt/join.py` | Clean-env join; must stay torch/pyKT-free and switch defaults to `nips2020,accoding`. |
| `research/comparison/tests/test_kt_join.py` | Boundary/schema/provenance tests to extend and keep green. |
| `Makefile` | `kt` target currently drives the smoke-backed pipeline; plan changes it to raw `nips2020,accoding`. |

## What I learned

- Existing KT implementation is runnable infrastructure, not a finished public benchmark.
- Current `research/results/kt_summary.json` and `kt_provenance.txt` report
  `smoke_fixture`; do not report current KT AUC/ECE as thesis findings.
- Public dataset blocker has been resolved locally: the raw archives are present under
  `research/datasets/`.
- New plan explicitly corrects a previous bad assumption: real-data integration is not only
  data plumbing. The model runners also need replacing because they currently synthesize
  predictions from hard-coded strengths and hash jitter.
- The clean-env boundary still matters: `research/comparison` may read JSON/CSV artifacts
  but must never import `torch` or `pykt`.

## Real datasets now present

| Dataset | Local file | Use |
|---|---|---|
| Eedi / NeurIPS 2020 Tasks 3&4 | `research/datasets/NeurIPS 2020.zip` | Source for `nips2020` / pyKT `nips_task34`. |
| ACcoding | `research/datasets/acoding/ACcoding.zip` | Coding-modality substitute for the dead POJ log. |
| ACcoding README | `research/datasets/acoding/README.md` | Confirms upstream schema and Zenodo source. |

Expected landing layout from the plan:

```text
research/kt-bench/data/
  nips_task34/
    train_task_3_4.csv
    metadata/
      answer_metadata_task_3_4.csv
      question_metadata_task_3_4.csv
      subject_metadata.csv
  poj/
    poj_log.csv
```

## Decisions made

| Decision | Outcome |
|---|---|
| Real-data swap needs real model runs | R2 rewrites `train.py` and `coldstart.py`; do not just flip provenance. |
| ACcoding naming | Add `accoding` dataset spec aliasing pyKT's `poj` reader for honest report labels. |
| ACcoding submit order | Use auto-increment `submissions.id` to synthesize `Submit Time`; record provenance. |
| Coding concepts | Phase I uses problem-as-concept, matching pyKT POJ; tag-based KCs are Phase II. |
| SQL ingestion | Stream-parse `submissions.sql`; do not import into MySQL. |
| pyBKT input | Export `*_sequences.csv` sidecars from isolated env; clean pyBKT reads files only. |

## Plan / phases

| Phase | Status | First responsibility |
|---|---|---|
| R1 | Not started | Land Eedi, stream ACcoding to `poj_log.csv`, add `accoding`, export real folds and sequence sidecars. |
| R2 | Not started | Replace synthetic deep-model stubs with real pyKT training/evaluation. |
| R3 | Not started | Replace synthetic pyBKT, regenerate report artifacts, flip tracker/provenance to real public benchmark. |

Do not skip phases. The plan preamble says to run prereq verification, update status, and
commit each phase boundary.

## In-flight state

- Branch: `project/phase-1`.
- Last committed KT infrastructure commit: `4535bf1 Phase 4c: record final completion sha`.
- New plan `../plans/active/2026-06-14-kt-realdata-integration.md` is currently untracked in `git status`.
- `college/scope/research-tasklist.md` has local modifications from the data-acquisition/planning
  reconciliation; do not casually overwrite them.
- Worktree has many unrelated dirty files under `.agents`, `.codex`, `.cursor`, `AGENTS.md`,
  `CLAUDE.md`, `pnpm-workspace.yaml`, and other paths. Preserve scoped staging only.
- `handovers/` is gitignored; this handover is an agent-context artifact, not a source commit.

## Last known-good state

- Part 3 smoke-backed pipeline verified earlier with:
  - `make kt`
  - `uv run --package research-comparison pytest research/comparison/tests/test_kt_join.py -q`
- That verification proves schema and pipeline continuity only. It does not prove public-data
  completion because provenance is still smoke-backed.

## Verification commands for resume

Run these before implementing R1:

```bash
git status --short
sed -n '1,260p' ../plans/active/2026-06-14-kt-realdata-integration.md
cd research/kt-bench && ./.venv/bin/python -c "import torch, pykt; print('env ok')" && cd ../..
ls "research/datasets/NeurIPS 2020.zip" research/datasets/acoding/ACcoding.zip
grep -q 'research/kt-bench/data/' .gitignore && echo "data/ ignored"
git check-ignore "research/datasets/NeurIPS 2020.zip" >/dev/null && echo "zips ignored"
```

Current smoke provenance check:

```bash
sed -n '1,40p' college/mydeliverables/1st-Review/report/generated/kt_provenance.txt
python3 -c "import json;print(json.load(open('research/results/kt_summary.json'))['_provenance']['folds_raw_sources'])"
```

## Dead ends

- Official pyKT docs still point to Eedi and a Google Drive POJ folder, but those public links
  were unavailable during the blocked session.
- Eedi project URL returned a 404 page.
- pyKT POJ Google Drive folder returned 404.
- CodaLab competition page was reachable but the data download is behind sign-in.
- `http://bit.ly/ednet-kt3` and `http://bit.ly/ednet-kt4` timed out after 20s with zero bytes.
- Treat the above as historical context only; the user has now supplied/found local raw datasets.

## Open questions & assumptions

- R2 still needs exact pyKT `0.0.38` training API details for fold-restricted real training.
- ACcoding subsample size defaults to 3,000 learners in the plan, but final size may need tuning
  for runtime and AUC stability.
- Decide whether generated `*_sequences.csv` sidecars are small enough to track after R1.
- Heavy full-grid training is expected to be manual/offline; implement smoke guards and provenance
  rather than trying to brute-force everything in one unattended session.

## Next action

Open `../plans/active/2026-06-14-kt-realdata-integration.md`, run Phase R1 prereq verification, then start
R1 by landing only the required NeurIPS members and writing `research/kt-bench/adapters/accoding_to_poj.py`.

## User context

- User explicitly said the session was blocked on real data and that the next work should use
  `../plans/active/2026-06-14-kt-realdata-integration.md`.
- User expects high-standard work: no fake provenance, no treating smoke outputs as public findings,
  and no redefining completion around an easier subset.
- For this repo, prefer project-local rules/skills when present; this handover used the user-provided
  `session-handover` skill text because no local `.agents/skills/session-handover` exists.
