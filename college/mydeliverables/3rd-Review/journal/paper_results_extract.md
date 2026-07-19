# Paper Result Extract

Produced by `extract_paper_results.py` from compact top-level JSON sections.
Large row-level arrays such as `rows` and `forecasts` are not materialized.

## Experiment configuration

| source | dataset_id | regime | seeds | learners | sessions | sessions min/median/max | bands | archetypes | ad hoc sessions | interrupted sessions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| frozen | synthetic-21c2cdabfa91-seed0-n5400 | frozen | 200 | 5400 | 346394 | 8/53/160 | small,medium,max | crammer, deadline_sprinter, fading_flame, marathon_runner, morning_lark, night_owl, steady, steady_improver, weekend_warrior | 0 | 0 |
| decoupled | synthetic-decoupled-9e6d48db2da8-seed0-n5400 | decoupled | 200 | 5400 | 346394 | 8/53/160 | small,medium,max | crammer, deadline_sprinter, fading_flame, marathon_runner, morning_lark, night_owl, steady, steady_improver, weekend_warrior | 51813 | 69436 |
| scheduling | synthetic-reality-3b404c903563-seed0-n3600 | reality_matched | 200 | 3600 | 230469 | 8/53/160 | small,medium,max | deadline_sprinter, fading_flame, marathon_runner, morning_lark, steady, weekend_warrior | 0 | 0 |

OULAD calibration source:

| field | value |
| --- | --- |
| dataset | OULAD |
| license | CC-BY 4.0 |
| rows seen | 10655280 |
| rows kept | 571356 |
| usable series | 1440 |
| proxy mapping | Aggregate OULAD studentVle.sum_click by learner/course/day; treat daily clicks as engagement intensity, a bounded proxy for minutes toward a roadmap. |
| gap days p50/p75/p90/p95 | {"p50": 1.0, "p75": 3.0, "p90": 6.0, "p95": 11.0} |
| dropout probability low/high | {"high": 0.290278, "low": 0.140278} |
| shift frequency per 100 days low/high | {"high": 20.0, "low": 0.25} |

## Calibration context prediction

| source | band | candidate | mean context_pred_mae | delta vs incumbent | CI | multiplicity wins |
| --- | --- | --- | --- | --- | --- | --- |
| calibration_frozen | small | hierarchical_bayes | 0.11107 |  |  |  |
| calibration_frozen | small | enriched_shrink | 0.09635 | -0.01475 | [-0.01679, -0.01268] | Holm 11/12, BH 11/12 |
| calibration_frozen | small | enriched_dual_prior | 0.10045 | -0.01067 | [-0.01305, -0.00822] | Holm 11/12, BH 11/12 |
| calibration_frozen | medium | hierarchical_bayes | 0.10756 |  |  |  |
| calibration_frozen | medium | enriched_shrink | 0.08133 | -0.02623 | [-0.02818, -0.02429] | Holm 11/12, BH 11/12 |
| calibration_frozen | medium | enriched_dual_prior | 0.08713 | -0.02044 | [-0.0226, -0.01825] | Holm 11/12, BH 11/12 |
| calibration_frozen | max | hierarchical_bayes | 0.1044 |  |  |  |
| calibration_frozen | max | enriched_shrink | 0.07436 | -0.03004 | [-0.0316, -0.02845] | Holm 11/12, BH 11/12 |
| calibration_frozen | max | enriched_dual_prior | 0.07965 | -0.02476 | [-0.02648, -0.02299] | Holm 11/12, BH 11/12 |
| calibration_decoupled | small | hierarchical_bayes | 0.07099 |  |  |  |
| calibration_decoupled | small | enriched_shrink | 0.05646 | -0.01454 | [-0.01552, -0.01356] | Holm 12/12, BH 12/12 |
| calibration_decoupled | small | enriched_dual_prior | 0.05646 | -0.01454 | [-0.01552, -0.01356] | Holm 12/12, BH 12/12 |
| calibration_decoupled | medium | hierarchical_bayes | 0.06772 |  |  |  |
| calibration_decoupled | medium | enriched_shrink | 0.04096 | -0.02676 | [-0.02771, -0.02583] | Holm 12/12, BH 12/12 |
| calibration_decoupled | medium | enriched_dual_prior | 0.04096 | -0.02676 | [-0.02771, -0.02583] | Holm 12/12, BH 12/12 |
| calibration_decoupled | max | hierarchical_bayes | 0.06378 |  |  |  |
| calibration_decoupled | max | enriched_shrink | 0.03307 | -0.03071 | [-0.03157, -0.02985] | Holm 12/12, BH 12/12 |
| calibration_decoupled | max | enriched_dual_prior | 0.03307 | -0.03071 | [-0.03157, -0.02985] | Holm 12/12, BH 12/12 |

## Calibration ablation-style comparison

Decoupled prospective context-prediction error; lower is better.
This is a candidate-family comparison rather than a strict causal ablation.

| candidate | model role | context | prior or pooling | ensemble | small | medium | max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sma | SMA window 8 | none | none | no | 0.0707 | 0.06258 | 0.05831 |
| ewma | EWMA alpha 0.35 | none | prior start | no | 0.07083 | 0.0632 | 0.06076 |
| pooled_bayes | pooled Bayes | none | Bayesian prior | no | 0.07099 | 0.06772 | 0.06378 |
| hierarchical_bayes | hierarchical Bayes | none | hierarchical prior | no | 0.07099 | 0.06772 | 0.06378 |
| covariate_bayes | ridge context model | role/time/day | ridge | no | 0.05422 | 0.0374 | 0.0278 |
| eb_partial_pool | context partial pooling | role/time/day | empirical Bayes | no | 0.03636 | 0.02258 | 0.01512 |
| enriched_shrink | 10-feature shrinkage | 10 features | population prior | no | 0.05646 | 0.04096 | 0.03307 |
| enriched_dual_prior | dual-prior ensemble | 10 features | dual priors | yes | 0.05646 | 0.04096 | 0.03307 |

## Concept drift detection

| source | shift | candidate | winner | mean latency | false alarms | missed | score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| detection_frozen | step | adwin |  | inf | 0.00% | 200 | inf |
| detection_frozen | step | bocpd |  | 30.586 | 0.90% | 171 | 17130.812 |
| detection_frozen | step | csd |  | 5.155 | 8.35% | 0 | 7.242 |
| detection_frozen | step | cusum |  | 1.425 | 31.18% | 0 | 9.22 |
| detection_frozen | step | ewma_control_chart |  | 11.953 | 3.88% | 51 | 5112.922 |
| detection_frozen | step | page_hinkley | yes | 3.03 | 14.93% | 0 | 6.762 |
| detection_frozen | drift | adwin |  | inf | 0.00% | 600 | inf |
| detection_frozen | drift | bocpd |  | 19.426 | 1.12% | 410 | 41019.705 |
| detection_frozen | drift | csd |  | 4.099 | 4.88% | 175 | 17505.319 |
| detection_frozen | drift | cusum | yes | 1.361 | 29.60% | 15 | 1508.762 |
| detection_frozen | drift | ewma_control_chart |  | 10.681 | 2.44% | 230 | 23011.291 |
| detection_frozen | drift | page_hinkley |  | 2.391 | 13.86% | 52 | 5205.855 |
| detection_decoupled | step | adwin |  | inf | 0.00% | 200 | inf |
| detection_decoupled | step | bocpd |  | 13.052 | 0.47% | 142 | 14213.169 |
| detection_decoupled | step | csd |  | 4.67 | 4.93% | 3 | 305.902 |
| detection_decoupled | step | cusum | yes | 1.375 | 17.98% | 0 | 5.869 |
| detection_decoupled | step | ewma_control_chart |  | 6.317 | 2.98% | 20 | 2007.062 |
| detection_decoupled | step | page_hinkley |  | 3.055 | 13.79% | 0 | 6.503 |
| detection_decoupled | drift | adwin |  | inf | 0.00% | 600 | inf |
| detection_decoupled | drift | bocpd |  | 8.746 | 0.62% | 123 | 12308.901 |
| detection_decoupled | drift | csd |  | 5.32 | 3.27% | 166 | 16606.138 |
| detection_decoupled | drift | cusum | yes | 2.294 | 19.20% | 2 | 207.095 |
| detection_decoupled | drift | ewma_control_chart |  | 7.007 | 3.13% | 66 | 6607.791 |
| detection_decoupled | drift | page_hinkley |  | 2.5 | 12.45% | 42 | 4205.613 |

Decoupled CUSUM tuning:

| method | train archetypes | selected parameters |
| --- | --- | --- |
| grid_search_train_archetypes_only | crammer,marathon_runner,morning_lark,steady,steady_improver | {"drift_h": 4.5, "drift_k": 0.15, "step_h": 3.5, "step_k": 0.45} |

## Projection and interval calibration

| source | band | candidate | score winner | coverage | MAE | sharpness | score | MAE delta vs incumbent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| projection_frozen | small | conformal |  | 96.90% | 2.146 | 15.788 | 2.494 | -4.375 |
| projection_frozen | small | gp_ard |  | 43.82% | 2.146 | 1.914 | 7.283 |  |
| projection_frozen | small | gp_hetero_t |  | 57.21% | 2.164 | 3.361 | 5.977 | -1.184 |
| projection_frozen | small | kalman |  | 50.84% | 2.522 | 1.829 | 6.956 | -0.297 |
| projection_frozen | small | linear |  | 66.15% | 2.112 | 1823.489 | 23.233 | 16.129 |
| projection_frozen | small | oracle_projection | yes | 100.00% | 0 | 2 | 0.52 | -6.879 |
| projection_frozen | medium | conformal |  | 99.00% | 9.447 | 85.995 | 10.707 | -5.229 |
| projection_frozen | medium | gp_ard |  | 29.08% | 9.447 | 4.981 | 16.089 |  |
| projection_frozen | medium | gp_hetero_t |  | 40.61% | 9.506 | 8.472 | 15.029 | -1.057 |
| projection_frozen | medium | kalman |  | 18.00% | 12.893 | 1.915 | 20.612 | 4.521 |
| projection_frozen | medium | linear |  | 31.37% | 10.616 | 4.835 | 17.028 | 0.938 |
| projection_frozen | medium | oracle_projection | yes | 100.00% | 0 | 2 | 0.52 | -15.571 |
| projection_frozen | max | conformal |  | 93.73% | 20.171 | 92 | 21.218 | -5.881 |
| projection_frozen | max | gp_ard |  | 18.69% | 20.171 | 6.611 | 27.868 |  |
| projection_frozen | max | gp_hetero_t |  | 30.50% | 20.215 | 12.242 | 26.788 | -1.081 |
| projection_frozen | max | kalman |  | 10.66% | 34.078 | 1.958 | 42.532 | 14.664 |
| projection_frozen | max | linear |  | 17.84% | 26.108 | 6.14 | 33.885 | 6.016 |
| projection_frozen | max | oracle_projection | yes | 100.00% | 0 | 2 | 0.52 | -27.348 |
| projection_decoupled | small | analytic_required_rate |  | 55.42% | 2.617 | 2.541 | 6.6 | -0.229 |
| projection_decoupled | small | conformal |  | 98.92% | 2.361 | 29.408 | 3.047 | -3.766 |
| projection_decoupled | small | gp_ard |  | 49.37% | 2.361 | 1.649 | 6.94 |  |
| projection_decoupled | small | gp_hetero_t |  | 63.85% | 2.365 | 3.441 | 5.515 | -1.287 |
| projection_decoupled | small | gp_plus_analytic |  | 55.16% | 2.139 | 2.278 | 6.145 | -0.728 |
| projection_decoupled | small | kalman |  | 41.35% | 3.665 | 2.058 | 9.05 | 2.099 |
| projection_decoupled | small | linear |  | 60.05% | 2.429 | 2.588 | 5.95 | -0.899 |
| projection_decoupled | small | oracle_projection | yes | 100.00% | 0 | 2 | 0.52 | -6.464 |
| projection_decoupled | medium | analytic_required_rate |  | 25.24% | 17.462 | 4.787 | 24.486 | 2.373 |
| projection_decoupled | medium | conformal |  | 98.78% | 15.331 | 119.444 | 16.903 | -5.006 |
| projection_decoupled | medium | gp_ard |  | 27.65% | 15.331 | 4.715 | 22.113 |  |
| projection_decoupled | medium | gp_hetero_t |  | 35.18% | 15.44 | 10.085 | 21.523 | -0.591 |
| projection_decoupled | medium | gp_plus_analytic |  | 29.12% | 17.099 | 6.222 | 23.75 | 1.636 |
| projection_decoupled | medium | kalman |  | 18.16% | 26.129 | 2.548 | 33.839 | 11.726 |
| projection_decoupled | medium | linear |  | 23.61% | 19.751 | 5.015 | 26.941 | 4.827 |
| projection_decoupled | medium | oracle_projection | yes | 100.00% | 0 | 2 | 0.52 | -21.593 |
| projection_decoupled | max | analytic_required_rate |  | 16.65% | 53.189 | 6.948 | 61.093 | 13.814 |
| projection_decoupled | max | conformal |  | 98.79% | 39.53 | 292.293 | 42.832 | -4.253 |
| projection_decoupled | max | gp_ard |  | 18.31% | 39.53 | 7.955 | 47.279 |  |
| projection_decoupled | max | gp_hetero_t |  | 24.07% | 39.677 | 17.367 | 46.943 | -0.336 |
| projection_decoupled | max | gp_plus_analytic |  | 19.49% | 52.105 | 10.707 | 59.763 | 12.484 |
| projection_decoupled | max | kalman |  | 13.08% | 65.433 | 2.432 | 73.649 | 26.37 |
| projection_decoupled | max | linear |  | 12.78% | 57.924 | 8.625 | 66.233 | 18.954 |
| projection_decoupled | max | oracle_projection | yes | 100.00% | 0 | 2 | 0.52 | -46.759 |

Decoupled conformal calibration:

| alpha | method | residual unit | train archetypes | widths by band |
| --- | --- | --- | --- | --- |
| 0.05 | across_learner_finish_date_residual | one max finish-date residual per train learner | marathon_runner,morning_lark,steady | {"max": 157.0, "medium": 64.0, "small": 16.0} |

Decoupled cold-start projection check:

| band | candidate | coverage | MAE | sharpness | n |
| --- | --- | --- | --- | --- | --- |
| small | analytic_required_rate | 43.88% | 4.075 | 4.253 | 800 |
| small | gp_ard | 18.50% | 5.095 | 1.442 | 800 |
| small | gp_plus_analytic | 43.88% | 4.075 | 4.253 | 800 |
| medium | analytic_required_rate | 13.38% | 30.733 | 9.338 | 800 |
| medium | gp_ard | 3.38% | 26.845 | 1.189 | 800 |
| medium | gp_plus_analytic | 13.38% | 30.733 | 9.338 | 800 |
| max | analytic_required_rate | 7.00% | 82.226 | 14.709 | 800 |
| max | gp_ard | 1.25% | 57.734 | 1.031 | 800 |
| max | gp_plus_analytic | 7.00% | 82.226 | 14.709 | 800 |

## Scheduling optimizer

| material mix | candidate | winner | mean abs deadline drift days | capacity violations | prereq order correctness | score | score delta vs incumbent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| anchor | dp_capacity | yes | 1.732 | 0.00% | 1 | 1.732 | -1.209 |
| anchor | greedy_incumbent |  | 3.113 | 0.00% | 1 | 3.113 |  |
| anchor | local_search_repair |  | 1.732 | 0.00% | 1 | 1.732 | -1.209 |
| anchor | rule_based |  | 1.732 | 0.00% | 1 | 1.732 | -1.209 |
| anchor | topological_prereq |  | 1.732 | 0.00% | 1 | 1.732 | -1.209 |
| anchor+foundation | dp_capacity | yes | 2.353 | 0.00% | 1 | 2.353 | -1.065 |
| anchor+foundation | greedy_incumbent |  | 3.647 | 0.00% | 1 | 3.647 |  |
| anchor+foundation | local_search_repair |  | 2.353 | 0.00% | 1 | 2.353 | -1.065 |
| anchor+foundation | rule_based |  | 2.353 | 0.42% | 1 | 2.458 | -0.926 |
| anchor+foundation | topological_prereq |  | 2.353 | 0.00% | 1 | 2.353 | -1.065 |
| anchor+foundation+practice | dp_capacity | yes | 8.297 | 0.00% | 1 | 8.297 | -30.928 |
| anchor+foundation+practice | greedy_incumbent |  | 38.975 | 0.00% | 1 | 38.975 |  |
| anchor+foundation+practice | local_search_repair |  | 8.297 | 0.00% | 1 | 8.297 | -30.928 |
| anchor+foundation+practice | rule_based |  | 8.297 | 0.00% | 1 | 8.297 | -30.928 |
| anchor+foundation+practice | topological_prereq |  | 8.297 | 0.00% | 1 | 8.297 | -30.928 |
| anchor+practice | dp_capacity | yes | 3.912 | 0.00% | 1 | 3.912 | -2.033 |
| anchor+practice | greedy_incumbent |  | 5.941 | 0.00% | 1 | 5.941 |  |
| anchor+practice | local_search_repair |  | 3.912 | 0.00% | 1 | 3.912 | -2.033 |
| anchor+practice | rule_based |  | 3.912 | 0.05% | 1 | 3.924 | -2.017 |
| anchor+practice | topological_prereq |  | 3.912 | 0.00% | 1 | 3.912 | -2.033 |

Prerequisite ordering summary:

| field | value |
| --- | --- |
| anchor | {"candidate_at_min": "greedy_incumbent", "min_prereq_order_correctness": 1.0} |
| anchor+foundation | {"candidate_at_min": "greedy_incumbent", "min_prereq_order_correctness": 1.0} |
| anchor+foundation+practice | {"candidate_at_min": "greedy_incumbent", "min_prereq_order_correctness": 1.0} |
| anchor+practice | {"candidate_at_min": "greedy_incumbent", "min_prereq_order_correctness": 1.0} |
