# Generation-quality evaluation harness

- Gold version: `1` · Attempt gate K: 5
- Corpus: `80c8b138-b544-4095-8dc0-1c390ac70da2` (754 chunks, sidecar)
- Generated: 2026-10-22T08:58:43Z · Activation gate: off
- Live arms: live

## Gate verdict

FAIL - 1 gate(s) breached:

- `difficultyMeanAbsBandError`: difficultyMeanAbsBandError unmeasured (no eligible evidence) - collect data or lower the gate

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

- n=30 · recall@1=0.6 · recall@3=0.7333 · recall@5=0.8667 · MRR=0.7032

## Difficulty calibration

- questions with >= K attempts: 1 (observations: 23)
- mean abs band error: None · monotonic: None
- authored band -> empirical score: {'3': 1.0}

## Diversity / deduplication

- near-dup rate: 0.0044 · distractor cosine: 0.4116 · option position entropy: 1.3042

## Mastery candidates

| candidate | ECE | AUC |
|---|---|---|
| bkt-v1 | 0.1401 | 0.7397 |
| running-proportion | 0.2679 | 0.7368 |

- observations: 282 over 139 (material, skill) sequences

## Coding suitability

- attempts: 62 (judged: 43) · `code_not_derivable`: 20 · derivable rate: 0.5349
- gold agreement: 1.0 (3/3 labeled materials)

## Rubric calibration (slice-4 flag queue)

- test agreement: 0.9743589743589743 · malformed rate: 0.0
- picked thresholds: cutoff 0.6 · margin 0.1
- source: .work/active/jev-integration/plan/evidence/jev_calibration_report_v1.json

## Telemetry (redacted)

- records: 361 · acceptance: 0.7784 · repair rate: 0.1163
- outcomes: {'ok': 281, 'partial': 37, 'malformed_output': 35, 'provider_error': 8}

