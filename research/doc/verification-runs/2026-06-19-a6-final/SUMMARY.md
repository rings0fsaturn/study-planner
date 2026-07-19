# A6 Baseline Calibration Evidence

Evidence file: `research/doc/verification-runs/2026-06-19-a6-final/evidence.json`

Commit: `922c64e56975d639e4e22e70115a4663486c5c1f`

## Decision

`enriched_shrink` is the recommended A6 calibration candidate for the primary
held-out `context_pred_mae` metric. It has Holm-surviving wins against
`pooled_bayes` in 11/12 frozen cells and 9/12 reality cells, and against `ewma`
in 11/12 frozen cells and 5/12 reality cells. This is a qualified context
prediction win, not a global-pace recovery headline.

The archetype-aware variants are not recommended over `enriched_shrink`.
Against `enriched_shrink` directly, `archetype_router_hard` has isolated
`context_pred_mae` wins but also significant losses (frozen: 3 wins / 8
significant not-wins; reality: 2 wins / 1 significant not-win).
`archetype_soft` is close on means but does not establish a clean advantage
(frozen: 3 wins / 1 significant not-win; reality: 0 wins). The simpler
feature-enriched shrinkage model stands.

## Per-Band Means

| run | metric | band | candidate | held-out mean |
|---|---|---|---|---:|
| frozen | context_pred_mae | max | archetype_router_hard | 0.074512 |
| frozen | context_pred_mae | max | archetype_soft | 0.074216 |
| frozen | context_pred_mae | max | covariate_bayes | 0.092377 |
| frozen | context_pred_mae | max | eb_partial_pool | 0.094322 |
| frozen | context_pred_mae | max | enriched_shrink | 0.074364 |
| frozen | context_pred_mae | max | ewma | 0.125141 |
| frozen | context_pred_mae | max | hierarchical_bayes | 0.104403 |
| frozen | context_pred_mae | max | kalman | 0.145906 |
| frozen | context_pred_mae | max | oracle_calibration | 0.000000 |
| frozen | context_pred_mae | max | pooled_bayes | 0.104403 |
| frozen | context_pred_mae | max | sma | 0.115530 |
| frozen | context_pred_mae | medium | archetype_router_hard | 0.081856 |
| frozen | context_pred_mae | medium | archetype_soft | 0.081061 |
| frozen | context_pred_mae | medium | covariate_bayes | 0.103455 |
| frozen | context_pred_mae | medium | eb_partial_pool | 0.105104 |
| frozen | context_pred_mae | medium | enriched_shrink | 0.081329 |
| frozen | context_pred_mae | medium | ewma | 0.122311 |
| frozen | context_pred_mae | medium | hierarchical_bayes | 0.107561 |
| frozen | context_pred_mae | medium | kalman | 0.146525 |
| frozen | context_pred_mae | medium | oracle_calibration | 0.000000 |
| frozen | context_pred_mae | medium | pooled_bayes | 0.107561 |
| frozen | context_pred_mae | medium | sma | 0.114558 |
| frozen | context_pred_mae | small | archetype_router_hard | 0.098039 |
| frozen | context_pred_mae | small | archetype_soft | 0.096272 |
| frozen | context_pred_mae | small | covariate_bayes | 0.117357 |
| frozen | context_pred_mae | small | eb_partial_pool | 0.117525 |
| frozen | context_pred_mae | small | enriched_shrink | 0.096353 |
| frozen | context_pred_mae | small | ewma | 0.113574 |
| frozen | context_pred_mae | small | hierarchical_bayes | 0.111069 |
| frozen | context_pred_mae | small | kalman | 0.145013 |
| frozen | context_pred_mae | small | oracle_calibration | 0.000000 |
| frozen | context_pred_mae | small | pooled_bayes | 0.111069 |
| frozen | context_pred_mae | small | sma | 0.114873 |
| frozen | recovery_mae | max | archetype_router_hard | 0.055515 |
| frozen | recovery_mae | max | archetype_soft | 0.055460 |
| frozen | recovery_mae | max | covariate_bayes | 0.084945 |
| frozen | recovery_mae | max | eb_partial_pool | 0.031335 |
| frozen | recovery_mae | max | enriched_shrink | 0.056212 |
| frozen | recovery_mae | max | ewma | 0.107018 |
| frozen | recovery_mae | max | hierarchical_bayes | 0.026355 |
| frozen | recovery_mae | max | kalman | 0.121382 |
| frozen | recovery_mae | max | oracle_calibration | 0.000000 |
| frozen | recovery_mae | max | pooled_bayes | 0.026355 |
| frozen | recovery_mae | max | sma | 0.089691 |
| frozen | recovery_mae | medium | archetype_router_hard | 0.048200 |
| frozen | recovery_mae | medium | archetype_soft | 0.048115 |
| frozen | recovery_mae | medium | covariate_bayes | 0.088475 |
| frozen | recovery_mae | medium | eb_partial_pool | 0.051960 |
| frozen | recovery_mae | medium | enriched_shrink | 0.049223 |
| frozen | recovery_mae | medium | ewma | 0.124456 |
| frozen | recovery_mae | medium | hierarchical_bayes | 0.045625 |
| frozen | recovery_mae | medium | kalman | 0.140671 |
| frozen | recovery_mae | medium | oracle_calibration | 0.000000 |
| frozen | recovery_mae | medium | pooled_bayes | 0.045625 |
| frozen | recovery_mae | medium | sma | 0.100349 |
| frozen | recovery_mae | small | archetype_router_hard | 0.051363 |
| frozen | recovery_mae | small | archetype_soft | 0.047073 |
| frozen | recovery_mae | small | covariate_bayes | 0.102405 |
| frozen | recovery_mae | small | eb_partial_pool | 0.083913 |
| frozen | recovery_mae | small | enriched_shrink | 0.049444 |
| frozen | recovery_mae | small | ewma | 0.115208 |
| frozen | recovery_mae | small | hierarchical_bayes | 0.079068 |
| frozen | recovery_mae | small | kalman | 0.139826 |
| frozen | recovery_mae | small | oracle_calibration | 0.000000 |
| frozen | recovery_mae | small | pooled_bayes | 0.079068 |
| frozen | recovery_mae | small | sma | 0.093596 |
| reality | context_pred_mae | max | archetype_router_hard | 0.137780 |
| reality | context_pred_mae | max | archetype_soft | 0.138436 |
| reality | context_pred_mae | max | covariate_bayes | 0.161557 |
| reality | context_pred_mae | max | eb_partial_pool | 0.164642 |
| reality | context_pred_mae | max | enriched_shrink | 0.138436 |
| reality | context_pred_mae | max | ewma | 0.151367 |
| reality | context_pred_mae | max | hierarchical_bayes | 0.159523 |
| reality | context_pred_mae | max | kalman | 0.169162 |
| reality | context_pred_mae | max | oracle_calibration | 0.000000 |
| reality | context_pred_mae | max | pooled_bayes | 0.159523 |
| reality | context_pred_mae | max | sma | 0.147594 |
| reality | context_pred_mae | medium | archetype_router_hard | 0.139439 |
| reality | context_pred_mae | medium | archetype_soft | 0.139734 |
| reality | context_pred_mae | medium | covariate_bayes | 0.157744 |
| reality | context_pred_mae | medium | eb_partial_pool | 0.163142 |
| reality | context_pred_mae | medium | enriched_shrink | 0.139730 |
| reality | context_pred_mae | medium | ewma | 0.149005 |
| reality | context_pred_mae | medium | hierarchical_bayes | 0.151995 |
| reality | context_pred_mae | medium | kalman | 0.169695 |
| reality | context_pred_mae | medium | oracle_calibration | 0.000000 |
| reality | context_pred_mae | medium | pooled_bayes | 0.151995 |
| reality | context_pred_mae | medium | sma | 0.150365 |
| reality | context_pred_mae | small | archetype_router_hard | 0.143585 |
| reality | context_pred_mae | small | archetype_soft | 0.142126 |
| reality | context_pred_mae | small | covariate_bayes | 0.157047 |
| reality | context_pred_mae | small | eb_partial_pool | 0.160051 |
| reality | context_pred_mae | small | enriched_shrink | 0.142129 |
| reality | context_pred_mae | small | ewma | 0.150473 |
| reality | context_pred_mae | small | hierarchical_bayes | 0.151445 |
| reality | context_pred_mae | small | kalman | 0.177066 |
| reality | context_pred_mae | small | oracle_calibration | 0.000000 |
| reality | context_pred_mae | small | pooled_bayes | 0.151445 |
| reality | context_pred_mae | small | sma | 0.157536 |
| reality | recovery_mae | max | archetype_router_hard | 0.118233 |
| reality | recovery_mae | max | archetype_soft | 0.118746 |
| reality | recovery_mae | max | covariate_bayes | 0.166469 |
| reality | recovery_mae | max | eb_partial_pool | 0.153792 |
| reality | recovery_mae | max | enriched_shrink | 0.118746 |
| reality | recovery_mae | max | ewma | 0.266602 |
| reality | recovery_mae | max | hierarchical_bayes | 0.140097 |
| reality | recovery_mae | max | kalman | 0.274990 |
| reality | recovery_mae | max | oracle_calibration | 0.000000 |
| reality | recovery_mae | max | pooled_bayes | 0.140097 |
| reality | recovery_mae | max | sma | 0.250384 |
| reality | recovery_mae | medium | archetype_router_hard | 0.115140 |
| reality | recovery_mae | medium | archetype_soft | 0.116824 |
| reality | recovery_mae | medium | covariate_bayes | 0.138334 |
| reality | recovery_mae | medium | eb_partial_pool | 0.119210 |
| reality | recovery_mae | medium | enriched_shrink | 0.116824 |
| reality | recovery_mae | medium | ewma | 0.211748 |
| reality | recovery_mae | medium | hierarchical_bayes | 0.104824 |
| reality | recovery_mae | medium | kalman | 0.226175 |
| reality | recovery_mae | medium | oracle_calibration | 0.000000 |
| reality | recovery_mae | medium | pooled_bayes | 0.104824 |
| reality | recovery_mae | medium | sma | 0.188604 |
| reality | recovery_mae | small | archetype_router_hard | 0.113492 |
| reality | recovery_mae | small | archetype_soft | 0.115006 |
| reality | recovery_mae | small | covariate_bayes | 0.137627 |
| reality | recovery_mae | small | eb_partial_pool | 0.124031 |
| reality | recovery_mae | small | enriched_shrink | 0.114991 |
| reality | recovery_mae | small | ewma | 0.139993 |
| reality | recovery_mae | small | hierarchical_bayes | 0.107391 |
| reality | recovery_mae | small | kalman | 0.166461 |
| reality | recovery_mae | small | oracle_calibration | 0.000000 |
| reality | recovery_mae | small | pooled_bayes | 0.107391 |
| reality | recovery_mae | small | sma | 0.126905 |

## Multiple-Comparison Survivors

### frozen
- `context_pred_mae`: Holm wins={'archetype_router_hard': 11, 'archetype_soft': 11, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'enriched_shrink': 11, 'ewma': 1, 'oracle_calibration': 12}; significant not-win={'archetype_soft': 1, 'covariate_bayes': 5, 'eb_partial_pool': 5, 'enriched_shrink': 1, 'ewma': 9, 'kalman': 12, 'pooled_bayes': 1, 'sma': 10}
- `recovery_mae`: Holm wins={'archetype_router_hard': 4, 'archetype_soft': 6, 'enriched_shrink': 6, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 5, 'archetype_soft': 6, 'covariate_bayes': 12, 'eb_partial_pool': 5, 'enriched_shrink': 6, 'ewma': 12, 'kalman': 12, 'sma': 10}

### reality
- `context_pred_mae`: Holm wins={'archetype_router_hard': 8, 'archetype_soft': 9, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'enriched_shrink': 9, 'oracle_calibration': 12, 'sma': 4}; significant not-win={'covariate_bayes': 7, 'eb_partial_pool': 8, 'kalman': 8, 'sma': 4}
- `recovery_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 3, 'enriched_shrink': 3, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 2, 'archetype_soft': 3, 'covariate_bayes': 9, 'eb_partial_pool': 12, 'enriched_shrink': 3, 'ewma': 12, 'kalman': 12, 'sma': 12}

## Reference-Baseline Survivors

### frozen
- baseline `enriched_shrink`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 3, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'hierarchical_bayes': 1, 'oracle_calibration': 12, 'pooled_bayes': 1, 'sma': 1}; significant not-win={'archetype_router_hard': 8, 'archetype_soft': 1, 'covariate_bayes': 9, 'eb_partial_pool': 9, 'ewma': 11, 'hierarchical_bayes': 11, 'kalman': 12, 'pooled_bayes': 11, 'sma': 11}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 4, 'archetype_soft': 4, 'covariate_bayes': 2, 'eb_partial_pool': 5, 'hierarchical_bayes': 6, 'oracle_calibration': 12, 'pooled_bayes': 6}; significant not-win={'archetype_router_hard': 5, 'archetype_soft': 1, 'covariate_bayes': 8, 'eb_partial_pool': 6, 'ewma': 12, 'hierarchical_bayes': 6, 'kalman': 12, 'pooled_bayes': 6, 'sma': 11}
- baseline `ewma`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 12, 'archetype_soft': 11, 'covariate_bayes': 7, 'eb_partial_pool': 7, 'enriched_shrink': 11, 'hierarchical_bayes': 9, 'oracle_calibration': 12, 'pooled_bayes': 9, 'sma': 9}; significant not-win={'covariate_bayes': 3, 'eb_partial_pool': 3, 'hierarchical_bayes': 1, 'kalman': 12, 'pooled_bayes': 1, 'sma': 1}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 12, 'archetype_soft': 12, 'covariate_bayes': 8, 'eb_partial_pool': 12, 'enriched_shrink': 12, 'hierarchical_bayes': 12, 'oracle_calibration': 12, 'pooled_bayes': 12, 'sma': 12}; significant not-win={'covariate_bayes': 2, 'kalman': 12}
- baseline `pooled_bayes`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 11, 'archetype_soft': 11, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'enriched_shrink': 11, 'ewma': 1, 'hierarchical_bayes': 1, 'oracle_calibration': 12}; significant not-win={'archetype_soft': 1, 'covariate_bayes': 5, 'eb_partial_pool': 5, 'enriched_shrink': 1, 'ewma': 9, 'kalman': 12, 'sma': 10}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 4, 'archetype_soft': 6, 'enriched_shrink': 6, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 5, 'archetype_soft': 6, 'covariate_bayes': 12, 'eb_partial_pool': 5, 'enriched_shrink': 6, 'ewma': 12, 'kalman': 12, 'sma': 10}

### reality
- baseline `enriched_shrink`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 2, 'eb_partial_pool': 1, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 1, 'covariate_bayes': 9, 'eb_partial_pool': 10, 'ewma': 5, 'hierarchical_bayes': 9, 'kalman': 12, 'pooled_bayes': 9, 'sma': 8}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 2, 'eb_partial_pool': 1, 'hierarchical_bayes': 3, 'oracle_calibration': 12, 'pooled_bayes': 3}; significant not-win={'covariate_bayes': 9, 'eb_partial_pool': 3, 'ewma': 9, 'hierarchical_bayes': 3, 'kalman': 12, 'pooled_bayes': 3, 'sma': 9}
- baseline `ewma`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 5, 'covariate_bayes': 1, 'eb_partial_pool': 2, 'enriched_shrink': 5, 'oracle_calibration': 12}; significant not-win={'covariate_bayes': 6, 'eb_partial_pool': 7, 'kalman': 12, 'sma': 1}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 9, 'archetype_soft': 9, 'covariate_bayes': 8, 'eb_partial_pool': 10, 'enriched_shrink': 9, 'hierarchical_bayes': 12, 'oracle_calibration': 12, 'pooled_bayes': 12, 'sma': 6}; significant not-win={'kalman': 12}
- baseline `pooled_bayes`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 8, 'archetype_soft': 9, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'enriched_shrink': 9, 'oracle_calibration': 12, 'sma': 4}; significant not-win={'covariate_bayes': 7, 'eb_partial_pool': 8, 'kalman': 8, 'sma': 4}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 3, 'enriched_shrink': 3, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 2, 'archetype_soft': 3, 'covariate_bayes': 9, 'eb_partial_pool': 12, 'enriched_shrink': 3, 'ewma': 12, 'kalman': 12, 'sma': 12}
