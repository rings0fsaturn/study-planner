UV_RUN ?= uv run --package research-comparison
.PHONY: dataset compare compare-detection compare-projection compare-scheduling sweep closed-loop kt figs figs-calibration figs-detection figs-projection figs-scheduling figs-robustness all
dataset: ; $(UV_RUN) python -m research_comparison.generator.generate
compare: ; $(UV_RUN) python -m research_comparison.runners.calibration
compare-detection: ; $(UV_RUN) python -m research_comparison.runners.detection
compare-projection: ; $(UV_RUN) python -m research_comparison.runners.projection
compare-scheduling: ; $(UV_RUN) python -m research_comparison.runners.scheduling
sweep: ; $(UV_RUN) python -m research_comparison.runners.sweep
closed-loop: ; $(UV_RUN) python -m research_comparison.runners.closed_loop --closed-loop
figs-calibration: compare
	$(UV_RUN) python -m research_comparison.plots.convergence
figs-detection: compare-detection
	$(UV_RUN) python -m research_comparison.plots.detection_latency
figs-projection: compare-projection
	$(UV_RUN) python -m research_comparison.plots.projection_reliability
figs-scheduling: compare-scheduling
	$(UV_RUN) python -m research_comparison.plots.scheduling_metrics
figs-robustness: sweep
	$(UV_RUN) python -m research_comparison.plots.robustness_heatmap
figs: figs-calibration figs-detection figs-projection figs-scheduling figs-robustness
kt:
	cd research/kt-bench && test -f data/poj/poj_log.csv || ./.venv/bin/python adapters/accoding_to_poj.py --out data/poj/poj_log.csv
	cd research/kt-bench && ./.venv/bin/python preprocess.py --datasets nips2020,accoding --mode raw --raw-root data --folds-dir folds
	cd research/kt-bench && ./.venv/bin/python train.py --dataset nips2020 --models dkt,akt,deep_irt,sakt,dkt_clst_config --folds folds/nips2020_folds.json
	cd research/kt-bench && ./.venv/bin/python coldstart.py --dataset nips2020 --k 3,5,10,20
	cd research/kt-bench && ./.venv/bin/python calibrate.py --dataset nips2020
	cd research/kt-bench && ./.venv/bin/python train.py --dataset accoding --models dkt,akt,deep_irt,sakt,dkt_clst_config --folds folds/accoding_folds.json
	cd research/kt-bench && ./.venv/bin/python coldstart.py --dataset accoding --k 3,5,10,20
	cd research/kt-bench && ./.venv/bin/python calibrate.py --dataset accoding
	$(UV_RUN) python -m research_comparison.kt.pybkt_runner --dataset nips2020
	$(UV_RUN) python -m research_comparison.kt.pybkt_runner --dataset accoding
	$(UV_RUN) python -m research_comparison.kt.join
all: dataset compare compare-detection compare-projection compare-scheduling sweep figs
