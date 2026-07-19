# A6 unified change-detector design probe — a6-detsim-v2 (adds unified_glr; unified_full FAR-floor scale-fix)
detectors (12): cusum, csd, page_hinkley, ewma, adwin, bocpd, bocpd_ar1, unified_gate, unified_gate_nowhiten, unified_two_stage, unified_full, unified_glr

### frozen: detectors by mean comp_overall (lower=better)
            page_hinkley     6.35
            unified_full     6.41
                   cusum     7.25
   unified_gate_nowhiten     7.30
            unified_gate     7.48
             unified_glr     8.35
                     csd     8.70
                    ewma     9.18
       unified_two_stage     9.55
               bocpd_ar1    52.13
                   bocpd    56.94
                   adwin   119.97
### frozen: Pareto dominance over the cusum+csd frontier — dom_frac = fraction of baseline operating points the unified matches/beats (>=0.90 CI-low => DOMINATES; lat_margin neg = faster)
  [ step]           unified_gate: dom_frac=0.08 CI=[0.00,0.25] lat_margin=+0.41 -> worse
  [ step]  unified_gate_nowhiten: dom_frac=0.08 CI=[0.00,0.21] lat_margin=+0.10 -> worse
  [ step]      unified_two_stage: dom_frac=0.13 CI=[0.00,0.25] lat_margin=+0.51 -> worse
  [ step]           unified_full: dom_frac=0.05 CI=[0.00,0.14] lat_margin=+0.05 -> worse
  [ step]            unified_glr: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+3.10 -> worse
  [drift]           unified_gate: dom_frac=0.12 CI=[0.00,0.27] lat_margin=+0.90 -> worse
  [drift]  unified_gate_nowhiten: dom_frac=0.11 CI=[0.00,0.25] lat_margin=+0.02 -> worse
  [drift]      unified_two_stage: dom_frac=0.26 CI=[0.19,0.38] lat_margin=+0.01 -> worse
  [drift]           unified_full: dom_frac=0.13 CI=[0.06,0.20] lat_margin=-0.51 -> worse
  [drift]            unified_glr: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+2.96 -> worse

### reality: detectors by mean comp_overall (lower=better)
            page_hinkley    55.64
            unified_full    55.71
                   cusum    55.77
   unified_gate_nowhiten    56.02
            unified_gate    56.17
             unified_glr    56.23
                    ewma    57.31
                     csd    59.81
       unified_two_stage    60.25
                   bocpd    78.36
               bocpd_ar1    80.04
                   adwin   117.61
### reality: Pareto dominance over the cusum+csd frontier — dom_frac = fraction of baseline operating points the unified matches/beats (>=0.90 CI-low => DOMINATES; lat_margin neg = faster)
  [ step]           unified_gate: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+0.26 -> worse
  [ step]  unified_gate_nowhiten: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+0.19 -> worse
  [ step]      unified_two_stage: dom_frac=0.08 CI=[0.00,0.19] lat_margin=+0.88 -> worse
  [ step]           unified_full: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+0.50 -> worse
  [ step]            unified_glr: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+3.36 -> worse
  [drift]           unified_gate: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]  unified_gate_nowhiten: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]      unified_two_stage: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]           unified_full: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]            unified_glr: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a

