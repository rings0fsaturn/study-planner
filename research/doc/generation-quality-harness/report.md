# Generation-quality evaluation harness

- Gold version: `1` · Attempt gate K: 5
- Corpus: `80c8b138-b544-4095-8dc0-1c390ac70da2` (754 chunks, sidecar)
- Generated: 2026-09-21T15:03:14Z · Activation gate: off
- Live arms: cache

## Gate verdict

FAIL - 2 gate(s) breached:

- `difficultyMeanAbsBandError`: difficultyMeanAbsBandError unmeasured (no eligible evidence) - collect data or lower the gate
- `codingDerivableMin`: codingDerivableMin 0.3333 < 0.5

## Objective (recorded #56 evidence)

| metric | value |
|---|---|
| n | 180 |
| schema_valid | 0.9611 |
| citation_valid | 0.9133 |
| gold_support | 0.7803 |
| copy_through | 0.0231 |
| near_dup_rate | 0.0044 |

## Groundedness

- LLM judge (offline): 0.8667 over 30 judged
- Gold support (citation contains the gold answer): 0.7803

## Retrieval

- n=30 · recall@1=0.6 · recall@3=0.7333 · recall@5=0.8667 · MRR=0.7033

## Difficulty calibration

- questions with >= K attempts: 1 (observations: 15)
- mean abs band error: None · monotonic: None
- authored band -> empirical score: {'3': 1.0}

## Diversity / deduplication

- near-dup rate: 0.0044 · distractor cosine: 0.4116 · option position entropy: 1.3042

## Mastery candidates

| candidate | ECE | AUC |
|---|---|---|
| bkt-v1 | 0.1604 | 0.8884 |
| running-proportion | 0.1968 | 0.8886 |

- observations: 94 over 35 (material, skill) sequences

## Coding suitability

- attempts: 8 (judged: 6) · `code_not_derivable`: 4 · derivable rate: 0.3333
- gold agreement: 1.0 (2/2 labeled materials)

## Telemetry (redacted)

- records: 190 · acceptance: 0.7632 · repair rate: 0.0474
- outcomes: {'provider_error': 2, 'malformed_output': 22, 'ok': 145, 'partial': 21}

