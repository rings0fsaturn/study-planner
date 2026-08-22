# DeepSeek V4 Flash 0731 x Qwen-sidecar generation-quality probe

- Model: `deepseek/deepseek-v4-flash-0731` · Material: `80c8b138-b544-4095-8dc0-1c390ac70da2`
- Generated: 2026-08-22T05:31:53Z · Seed: 20260822

> Note: in `json_object` mode (arm C) DeepSeek returns its own shape (`question`/`options`/`answer`/`chunkIds`) instead of the requested contract (`stem`/`correctIndex`/`difficulty`/`skillTags`/`citations`), so contract-level metrics for `R:json` are empty by construction.

## Validity per tier

| group | n | schema-valid % | citation-valid % | gold-support % | outcomes |
|---|---|---|---|---|---|
| R:high | 31 | 96.8% | 83.3% | n/a | {'ok': 31} |
| R:json | 30 | 0.0% | 25.9% | n/a | {'ok': 27, 'malformed_json': 1, 'truncated': 2} |
| R:low | 31 | 96.8% | 86.7% | n/a | {'ok': 30, 'provider_error': 1} |
| R:max | 31 | 96.8% | 93.3% | n/a | {'ok': 31} |
| R:medium | 31 | 93.5% | 96.5% | n/a | {'ok': 30, 'provider_error': 1} |
| R:off | 30 | 100.0% | 86.7% | n/a | {'ok': 30} |
| R:xhigh | 31 | 96.8% | 93.3% | n/a | {'ok': 31} |
| S:high | 30 | 96.7% | 93.1% | 86.2% | {'ok': 29, 'malformed_json': 1} |
| S:low | 30 | 90.0% | 85.2% | 77.8% | {'ok': 27, 'malformed_json': 1, 'provider_error': 1, 'truncated': 1} |
| S:max | 30 | 96.7% | 89.7% | 75.9% | {'ok': 29, 'provider_error': 1} |
| S:medium | 30 | 96.7% | 86.2% | 72.4% | {'ok': 29, 'provider_error': 1} |
| S:off | 30 | 96.7% | 93.1% | 72.4% | {'ok': 29, 'provider_error': 1} |
| S:xhigh | 30 | 100.0% | 100.0% | 83.3% | {'ok': 30} |

## Grounding and craft

| group | copy-through % | distractor cos | near-dup % | pos hist | vocab |
|---|---|---|---|---|---|
| R:high | 0.0% | 0.394 | 0.0% | {'0': 6, '1': 14, '2': 6, '3': 3} | 55 |
| R:json | 0.0% | n/a | 0.0% | {'0': 0, '1': 0, '2': 1, '3': 0} | 0 |
| R:low | 0.0% | 0.423 | 0.0% | {'0': 9, '1': 15, '2': 5, '3': 0} | 58 |
| R:max | 0.0% | 0.405 | 0.0% | {'0': 16, '1': 10, '2': 3, '3': 1} | 68 |
| R:medium | 0.0% | 0.437 | 0.0% | {'0': 13, '1': 11, '2': 4, '3': 1} | 59 |
| R:off | 6.7% | 0.443 | 0.0% | {'0': 14, '1': 10, '2': 5, '3': 0} | 55 |
| R:xhigh | 3.3% | 0.407 | 0.0% | {'0': 10, '1': 14, '2': 5, '3': 1} | 62 |
| S:high | 0.0% | 0.393 | 0.0% | {'0': 16, '1': 11, '2': 0, '3': 1} | 57 |
| S:low | 3.7% | 0.407 | 0.0% | {'0': 14, '1': 12, '2': 1, '3': 0} | 59 |
| S:max | 3.5% | 0.423 | 0.0% | {'0': 21, '1': 6, '2': 1, '3': 0} | 62 |
| S:medium | 0.0% | 0.394 | 0.0% | {'0': 12, '1': 13, '2': 3, '3': 0} | 59 |
| S:off | 3.5% | 0.448 | 0.0% | {'0': 18, '1': 8, '2': 2, '3': 1} | 59 |
| S:xhigh | 3.3% | 0.403 | 0.0% | {'0': 17, '1': 10, '2': 3, '3': 0} | 65 |

## Difficulty distribution (self-assessed)

| group | band counts |
|---|---|
| R:high | {'1': 6, '2': 10, '3': 5, '4': 4, '5': 4} |
| R:json | {} |
| R:low | {'1': 6, '2': 8, '3': 8, '4': 7} |
| R:max | {'1': 5, '2': 13, '3': 5, '4': 5, '5': 2} |
| R:medium | {'1': 5, '2': 13, '3': 5, '4': 4, '5': 2} |
| R:off | {'1': 2, '2': 14, '3': 8, '4': 5} |
| R:xhigh | {'1': 6, '2': 10, '3': 7, '4': 4, '5': 3} |
| S:high | {'3': 27} |
| S:low | {'2': 2, '3': 25} |
| S:max | {'2': 2, '3': 26} |
| S:medium | {'3': 27} |
| S:off | {'3': 29} |
| S:xhigh | {'2': 1, '3': 29} |

## Latency and economics

| group | p50 ms | p95 ms | >30 s | prompt | completion | reasoning | r/share | cost $ |
|---|---|---|---|---|---|---|---|---|---|
| R:high | 9849.7 | 102308.9 | 5 | 13914 | 27250 | 25589 | 0.939 | 0.006018 |
| R:json | 11946.7 | 184328.9 | 3 | 11263 | 32687 | 0 | 0.0 | 0.006785 |
| R:low | 14581.8 | 100540.9 | 10 | 13751 | 38455 | 38911 | 1.0119 | 0.008022 |
| R:max | 6619.3 | 57129.5 | 5 | 18577 | 13217 | 7198 | 0.5446 | 0.003865 |
| R:medium | 11441.9 | 40024.9 | 3 | 14348 | 25520 | 22314 | 0.8744 | 0.005741 |
| R:off | 4830.9 | 20754.6 | 0 | 13751 | 4947 | 0 | 0.0 | 0.001991 |
| R:xhigh | 6102.2 | 59455.9 | 4 | 14912 | 22969 | 20250 | 0.8816 | 0.005327 |
| S:high | 12558.1 | 30573.0 | 3 | 56272 | 34122 | 30321 | 0.8886 | 0.010644 |
| S:low | 16464.5 | 133647.9 | 9 | 57180 | 49212 | 38550 | 0.7833 | 0.013433 |
| S:max | 11756.8 | 106190.3 | 5 | 59106 | 29608 | 25498 | 0.8612 | 0.010058 |
| S:medium | 11506.0 | 40895.8 | 5 | 57552 | 30861 | 27437 | 0.8891 | 0.010159 |
| S:off | 3973.4 | 10547.0 | 0 | 57564 | 5580 | 0 | 0.0 | 0.00561 |
| S:xhigh | 15033.9 | 41537.2 | 6 | 56430 | 38176 | 35342 | 0.9258 | 0.011386 |

## Continuation acceptance (K)

| tier | accepted | latency ms | finish |
|---|---|---|---|
| high | True | 30925.0 | stop |
| low | False | 32845.6 | error |
| max | True | 57129.5 | stop |
| medium | True | 20803.1 | stop |
| xhigh | True | 59909.8 | stop |

## S vs R delta (sidecar handoff cost)

| metric | S (retrieval-driven) | R (sampled) |
|---|---|---|
| schema_valid | 0.9611333333333334 | 0.9677166666666667 |
| copy_through | 0.023216666666666667 | 0.016666666666666666 |
| near_dup_rate | 0.0 | 0.0 |
