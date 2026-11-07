# Gap 7 plan - difficulty calibration measurement (2026-10-22)

_Goal: measure the adaptive-difficulty claim (`mean_abs_band_error`, currently null, gate unmeasurable) so the paper either reports a band-error number or scopes the chip to uncalibrated-advisory._

## Ground facts

- Harness difficulty block: 1 question at/above K, `mean_abs_band_error: null` (`summary.json:229-237`). BKT AUC rows exist (synthetic 0.785, live 0.7203) but band-error does not.
- Producer: `GET /v1/mastery/recommendations` one-band endpoint + Practice Adaptive chip (`routers/mastery.py`); shipped BKT params in `packages/py-progress/src/py_progress/mastery.py:23-42`.
- Needs (question, predicted band, observed outcome) pairs at volume; the current attempt pool is thin (109 obs over 35 skill seqs, only 1 question at gate depth).

## Steps

1. Define the metric first: predicted band vs observed outcome bin per attempt, absolute error averaged; write the definition into the run note before measuring (no post-hoc metric shopping).
2. Dry run per rule 80: compute band error on the existing 109-obs pool; verify the pipeline parses even if the number is underpowered.
3. If underpowered, collect pairs from fresh practice runs (live or synthetic archetype runs) until at least K questions clear the gate; then compute and record.
4. Write `research/doc/2026-XX-difficulty-calibration.md` (definition + n + band-error + confidence note); update the brief (report the number with its n, or scope the chip as uncalibrated-advisory). Close gap 7 in the brief.

## Acceptance

- A band-error number with stated n, or an explicit uncalibrated verdict. No silent carry of the AUC rows as difficulty proof.

## Cost

- Analysis-only if the pool suffices; otherwise practice-run generation spend (bounded concurrency, one family per call). Depends on gap 6's fresh arms for attempt volume; run after gap 6.
