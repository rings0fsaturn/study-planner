# Gap-7 difficulty baseline (2026-10-22, current pool)

- Definition (`eval_harness.py:160-199`): rows are (authored band, score) per attempt for questions with at least K=5 attempts and a set `authored_difficulty`; observed band = round(6 - 5 x mean_score) clamped 1..5; `mean_abs_band_error` = mean |authored - observed| across bands; a curve needs at least 2 authored bands, one band cannot calibrate. Gate: `difficultyMeanAbsBandError` 1.0 (`eval_golds.json:63`).
- Current pool (fresh 2026-10-22 harness): n=23 observations on 1 question, single band 3, curve {3: 1.0} -> `mean_abs_band_error: null` by construction.
- Verdict on current data: UNMEASURABLE, not failing. The pool holds one eligible question; no re-analysis can produce a second band.
- Path to a number: fresh graded attempts on questions spanning at least 2 authored bands. The gap-8 dip replay is the collection vehicle (graded weeks across archetypes/materials). Re-run this measurement after gap 8; if the pool still holds one band, scope the Adaptive chip to uncalibrated-advisory in the paper.
