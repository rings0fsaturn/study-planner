# KT Bench

This directory is the quarantined knowledge-tracing bench for the research tier.
It deliberately owns its own Python environment and is not a `uv` workspace
member. Do not import anything from this directory in `research/comparison`.

The artifact seam is:

```text
research/results/kt/*.json
```

The clean comparison harness reads those JSON files and the tracked shared folds
under `research/kt-bench/folds/`; it never imports `torch` or `pykt`.

## Environment

```bash
cd research/kt-bench
python3 -m venv .venv
./.venv/bin/pip install -U pip
./.venv/bin/pip install -r requirements.txt
```

If a package download fails on the corporate network, use the same CA and mirror
pattern documented in `.agents/rules/51-docker-runtime.agents.md` and
`.agents/rules/50-pnpm-build-registry.agents.md`; keep any machine-specific config
outside this repo.

## Workflow

1. Preprocess and export shared folds:

   ```bash
   ./.venv/bin/python preprocess.py --datasets nips2020,poj
   ```

2. Train full-sequence models and write `k=full` results:

   ```bash
   ./.venv/bin/python train.py --dataset nips2020 --models dkt,akt,deep_irt,sakt,dkt_clst_config --folds folds/nips2020_folds.json
   ```

3. Emit the cold-start curve:

   ```bash
   ./.venv/bin/python coldstart.py --dataset nips2020 --k 3,5,10,20
   ```

4. Emit calibration artifacts:

   ```bash
   ./.venv/bin/python calibrate.py --dataset nips2020
   ```

5. Join in the clean env:

   ```bash
   cd ../..
   uv run --package research-comparison python -m research_comparison.kt.join
   ```

Use `WANDB_MODE=offline` unless intentionally running online sweeps. Fixed
configs and seeds are sufficient for the thesis; sweeps are optional.

## Progress output

Long-running KT scripts print progress to stderr by default:

```text
[kt-train-progress] 2026-06-14T07:40:00Z 042% state=train.fold.training elapsed=90s detail=dataset=nips2020 model=akt fold=2; still running
```

The percent is approximate but monotonic within a command. Use it to tell which
dataset/model/fold/k stage is active. Pass `--quiet` to suppress progress output
when a script is used from another tool that expects quiet stderr.

For interrupted full-sequence training, resume with `train.py --skip-complete`.
The runner skips only matching `k=full` rows whose seed, fold hash, training
config, smoke depth, and expected prediction count already match the requested
run.
