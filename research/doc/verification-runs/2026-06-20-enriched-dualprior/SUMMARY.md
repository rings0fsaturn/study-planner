# A6 Baseline Calibration Evidence

Every later phase is measured against this baseline bar.

| run | metric | band | candidate | held-out mean |
|---|---|---|---|---:|
| reality | context_pred_mae | max | archetype_router_hard | 0.137780 |
| reality | context_pred_mae | max | archetype_soft | 0.138436 |
| reality | context_pred_mae | max | covariate_bayes | 0.161557 |
| reality | context_pred_mae | max | eb_partial_pool | 0.164642 |
| reality | context_pred_mae | max | enriched_dual_prior | 0.137036 |
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
| reality | context_pred_mae | medium | enriched_dual_prior | 0.138572 |
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
| reality | context_pred_mae | small | enriched_dual_prior | 0.143258 |
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
| reality | recovery_mae | max | enriched_dual_prior | 0.115863 |
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
| reality | recovery_mae | medium | enriched_dual_prior | 0.109894 |
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
| reality | recovery_mae | small | enriched_dual_prior | 0.102816 |
| reality | recovery_mae | small | enriched_shrink | 0.114991 |
| reality | recovery_mae | small | ewma | 0.139993 |
| reality | recovery_mae | small | hierarchical_bayes | 0.107391 |
| reality | recovery_mae | small | kalman | 0.166461 |
| reality | recovery_mae | small | oracle_calibration | 0.000000 |
| reality | recovery_mae | small | pooled_bayes | 0.107391 |
| reality | recovery_mae | small | sma | 0.126905 |

## Multiple-Comparison Survivors

### reality
- `context_pred_mae`: Holm wins={'archetype_router_hard': 8, 'archetype_soft': 9, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'enriched_dual_prior': 9, 'enriched_shrink': 9, 'oracle_calibration': 12, 'sma': 4}; significant not-win={'covariate_bayes': 7, 'eb_partial_pool': 8, 'kalman': 8, 'sma': 4}
- `recovery_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 3, 'enriched_dual_prior': 3, 'enriched_shrink': 3, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 2, 'archetype_soft': 3, 'covariate_bayes': 9, 'eb_partial_pool': 12, 'enriched_dual_prior': 1, 'enriched_shrink': 3, 'ewma': 12, 'kalman': 12, 'sma': 12}

## Reference-Baseline Survivors

### reality
- baseline `enriched_shrink`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 2, 'eb_partial_pool': 1, 'enriched_dual_prior': 7, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 1, 'covariate_bayes': 9, 'eb_partial_pool': 10, 'enriched_dual_prior': 2, 'ewma': 5, 'hierarchical_bayes': 9, 'kalman': 12, 'pooled_bayes': 9, 'sma': 8}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 2, 'eb_partial_pool': 1, 'enriched_dual_prior': 11, 'hierarchical_bayes': 3, 'oracle_calibration': 12, 'pooled_bayes': 3}; significant not-win={'covariate_bayes': 9, 'eb_partial_pool': 3, 'ewma': 9, 'hierarchical_bayes': 3, 'kalman': 12, 'pooled_bayes': 3, 'sma': 9}
- baseline `ewma`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 5, 'covariate_bayes': 1, 'eb_partial_pool': 2, 'enriched_dual_prior': 6, 'enriched_shrink': 5, 'oracle_calibration': 12}; significant not-win={'covariate_bayes': 6, 'eb_partial_pool': 6, 'kalman': 12, 'sma': 1}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 9, 'archetype_soft': 9, 'covariate_bayes': 8, 'eb_partial_pool': 10, 'enriched_dual_prior': 12, 'enriched_shrink': 9, 'hierarchical_bayes': 12, 'oracle_calibration': 12, 'pooled_bayes': 12, 'sma': 6}; significant not-win={'kalman': 12}
- baseline `pooled_bayes`:
  - `context_pred_mae`: Holm wins={'archetype_router_hard': 8, 'archetype_soft': 9, 'covariate_bayes': 3, 'eb_partial_pool': 3, 'enriched_dual_prior': 9, 'enriched_shrink': 9, 'oracle_calibration': 12, 'sma': 4}; significant not-win={'covariate_bayes': 7, 'eb_partial_pool': 8, 'kalman': 8, 'sma': 4}
  - `recovery_mae`: Holm wins={'archetype_router_hard': 3, 'archetype_soft': 3, 'enriched_dual_prior': 3, 'enriched_shrink': 3, 'oracle_calibration': 12}; significant not-win={'archetype_router_hard': 2, 'archetype_soft': 3, 'covariate_bayes': 9, 'eb_partial_pool': 12, 'enriched_dual_prior': 1, 'enriched_shrink': 3, 'ewma': 12, 'kalman': 12, 'sma': 12}
