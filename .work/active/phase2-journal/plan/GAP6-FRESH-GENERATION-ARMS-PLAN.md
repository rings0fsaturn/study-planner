# Gap 6 plan - fresh generation live arms (2026-10-22)

_Goal: replace the cached generation numbers with fresh live measurements (sidecar retrieval arm + LLM groundedness judge) and re-pull the coding derivable rate, so the paper's generation table is measured, not replayed._

## Ground facts

- Current rows are cache replays (`liveSource: cache`, harness `summary.json:14`): retrieval 0.60/0.7333/0.8667/0.7033, groundedness 0.8667 (n=30), gold_support 0.7803 (n=180), near-dup 0.0044.
- Harness supports fresh runs: `--retrieval` (sidecar) + `--groundedness-judge` flags in `services/intelligence/scripts/eval_harness.py`; gates in `eval_golds.json` (recall3 0.7, mrr 0.67).
- Coding snapshot: derivable_rate 0.4545 breaches `codingDerivableMin` 0.5; needs a fresh attempt pull before any rate is claimed.
- Paid spend: judge calls via OpenRouter (`deepseek/deepseek-v4-flash-0731`, reasoning off); probe precedent 395 calls at ~$0.10 total. Small but real, so rule 80 applies.

## Steps

1. Dry run per rule 80: harness on a 2-question slice with live flags; verify `liveSource` flips to live, records parse, spend is cents.
2. Full run: fresh `--retrieval` + `--groundedness-judge` (30Q), fresh coding-attempt pull; record `summary.json` + `live.json` beside the run (same layout as `research/doc/generation-quality-harness/`).
3. Update the brief's generation rows with fresh values; if derivable_rate still breaches 0.5, record it as an honest limit with the gold-set composition note (4 golds: 3 derivable + 1 not). Close gap 6 in the brief.

## Acceptance

- `liveSource: live` in the new summary; every metric re-measured or explicitly marked carried-over.
- Spend logged (calls x price) in the run note.

## Cost

- Sidecar GPU minutes + small OpenRouter judge spend. Sequential, never parallel with other live work.
