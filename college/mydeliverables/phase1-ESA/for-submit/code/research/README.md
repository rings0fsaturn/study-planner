# Phase 1 Research Scripts

This directory contains the offline Phase 1 evaluation harness and the standalone change-detector design probe.
The comparison harness imports the same Python progress and roadmap engines used by the Intelligence Service.
The generator also reads `college/scope/archetype-preregistration.md` and `college/scope/decoupled-session-preregistration.md` to calculate stable lineage hashes.

Run all commands below from the package's `code` directory.

## Setup

Install all locked Python workspace packages so the research tools and Intelligence Service remain available together:

```bash
uv sync --all-packages
```

Research commands write generated files under `research/results` unless an explicit output directory is provided.
The included source datasets are read-only inputs and should not be overwritten.

## Included Data

| Path | Purpose |
|---|---|
| `datasets/synthetic-e716cd12dddc-seed0-n3600` | Frozen synthetic evaluation data with 3,600 learners, six archetypes, three history bands, and 200 seeds. |
| `datasets/synthetic-reality-3b404c903563-seed0-n3600` | OULAD-bounded reality-matched evaluation data with 3,600 learners. |
| `datasets/oulad` | Uncompressed OULAD input files used to derive the engagement-moment bounds. |
| `evidence/oulad_moment_bounds.json` | Frozen bounds used by the reality-matched generator and validator. |

The two 3,600-learner datasets are the inputs referenced by the Phase 1 ESA evaluation.
The generator in the current source revision has since expanded to nine archetypes, so its default full generation produces a newer 5,400-learner lineage.
Use the included 3,600-learner directories when reproducing the reported Phase 1 analysis.

The recorded bounds JSON contains absolute source paths as historical provenance.
Those recorded paths are metadata and are not used to locate the included dataset at runtime.

Dataset ZIP archives are not included.
The Phase 2 knowledge-tracing bench, ACcoding archive, NeurIPS archive, trained models, caches, and generated result files are also not included.

See [`datasets/README.md`](datasets/README.md) for the included file formats.

## Executable Script Reference

### Phase 1 data and evaluation

| Script or module | Use | Main output |
|---|---|---|
| `research_comparison.generator.generate` | Generates deterministic frozen, reality-matched, or decoupled synthetic learner datasets with ground-truth sidecars. | A versioned directory under the selected `--out-dir`. |
| `research_comparison.generator.oulad_moments` | Derives engagement persistence, shift, gap, and dropout bounds from uncompressed OULAD files. | A JSON bounds file selected with `--out`. |
| `research_comparison.runners.calibration` | Compares pace-calibration candidates and baselines with held-out scoring and statistical corrections. | `calibration_results.json`. |
| `research_comparison.runners.detection` | Compares change detectors by latency, false alarms, and shift type. | `detection_results.json`. |
| `research_comparison.runners.projection` | Compares finish-date projection methods and interval reliability. | `projection_results.json`. |
| `research_comparison.runners.scheduling` | Compares roadmap scheduling strategies for deadline, capacity, prerequisite, and runtime behavior. | `scheduling_results.json`. |
| `research_comparison.runners.sweep` | Runs the predefined sensitivity grid and records ranking robustness. | `sweep_results.json`. |
| `research_comparison.runners.closed_loop` | Simulates calibration and detection signals feeding roadmap regeneration when `--closed-loop` is supplied. | `closed_loop_results.json`. |
| `research_comparison.plots.convergence` | Converts calibration results into the convergence figure. | A vector PDF under the generated output directory. |
| `research_comparison.plots.detection_latency` | Converts detection results into latency and false-alarm figures. | A vector PDF under the generated output directory. |
| `research_comparison.plots.projection_reliability` | Converts projection results into nominal-versus-empirical reliability figures. | A vector PDF under the generated output directory. |
| `research_comparison.plots.scheduling_metrics` | Converts scheduling results into comparison figures and tables. | Generated scheduling artifacts. |
| `research_comparison.plots.robustness_heatmap` | Converts sweep results into a ranking-stability heatmap. | A vector PDF under the generated output directory. |
| `comparison/scripts/verify_reality_bounds.py` | Checks that a reality-matched dataset remains inside the frozen OULAD moment bounds. | Validation JSON files in `--output-dir`. |
| `comparison/scripts/capture_evidence.py` | Collects selected result JSON files into a stamped, portable evidence bundle. | `evidence.json` and a summary in `--output-dir`. |
| `scripts/unified_detector_sim.py` | Runs the standalone A6 detector design probe against frozen and reality-style simulated shifts. | JSON results and a Markdown summary selected with `--out` and `--summary`. |

### Knowledge-tracing utility modules

| Script or module | Use | Availability in this submission |
|---|---|---|
| `research_comparison.kt.pybkt_runner` | Runs the isolated pyBKT baseline against prepared shared folds. | Source is retained, but the Phase 2 folds and raw KT data are intentionally omitted. |
| `research_comparison.kt.join` | Joins isolated KT result JSON files into the comparison summary. | Source is retained, but it requires result files produced by the omitted Phase 2 KT bench. |

The KT utility modules are not required for any Phase 1 command below.

## Quick Smoke Commands

Verify that the package imports and can write a one-seed synthetic smoke dataset:

```bash
uv run --package research-comparison python -m research_comparison.generator.generate \
  --seeds 1 \
  --out-dir research/results/smoke-datasets
```

Run the standalone detector probe in quick mode:

```bash
uv run --package research-comparison python research/scripts/unified_detector_sim.py \
  --quick \
  --out research/results/detector-probe-quick.json \
  --summary research/results/detector-probe-quick.md
```

## Reproduce the Frozen Phase 1 Tracks

Run each track against the included frozen dataset:

```bash
uv run --package research-comparison python -m research_comparison.runners.calibration \
  --dataset-dir research/datasets/synthetic-e716cd12dddc-seed0-n3600 \
  --seeds 200 \
  --out-dir research/results/reproduced/frozen/calibration

uv run --package research-comparison python -m research_comparison.runners.detection \
  --dataset-dir research/datasets/synthetic-e716cd12dddc-seed0-n3600 \
  --seeds 200 \
  --out-dir research/results/reproduced/frozen/detection

uv run --package research-comparison python -m research_comparison.runners.projection \
  --dataset-dir research/datasets/synthetic-e716cd12dddc-seed0-n3600 \
  --seeds 200 \
  --out-dir research/results/reproduced/frozen/projection

uv run --package research-comparison python -m research_comparison.runners.scheduling \
  --dataset-dir research/datasets/synthetic-e716cd12dddc-seed0-n3600 \
  --seeds 200 \
  --out-dir research/results/reproduced/frozen/scheduling
```

These full 200-seed runs can take substantial CPU time.

## Reproduce the Reality-Matched Tracks

Replace the frozen dataset path with:

```text
research/datasets/synthetic-reality-3b404c903563-seed0-n3600
```

Use separate output directories so the frozen and reality-matched results do not overwrite one another.

## Recompute and Verify OULAD Bounds

Recompute the bounds from the included uncompressed OULAD data:

```bash
uv run --package research-comparison python -m research_comparison.generator.oulad_moments \
  --dataset-dir research/datasets/oulad \
  --out research/results/oulad_moment_bounds-recomputed.json
```

Verify the included reality-matched dataset against the frozen bounds:

```bash
uv run --package research-comparison python research/comparison/scripts/verify_reality_bounds.py \
  --dataset-dir research/datasets/synthetic-reality-3b404c903563-seed0-n3600 \
  --moment-bounds-file research/evidence/oulad_moment_bounds.json \
  --output-dir research/results/reality-bounds-check
```

## Generate Figures

Pass the result file explicitly when generating figures from the reproduced outputs.

Example for the calibration convergence figure:

```bash
uv run --package research-comparison python -m research_comparison.plots.convergence \
  --results-path research/results/reproduced/frozen/calibration/calibration_results.json \
  --generated-dir research/results/reproduced/frozen/figures
```

Use `--quiet` on supported commands to suppress progress logging.
