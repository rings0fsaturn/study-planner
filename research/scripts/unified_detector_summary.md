# A6 change-detector design probe — a6-detsim-v3 (survey candidates: kswin, mmd_window, newma, e_detector, residual_cusum, hybrid_hier; dominance tests ALL non-baseline candidates)
detectors (18): cusum, csd, page_hinkley, ewma, adwin, bocpd, bocpd_ar1, unified_gate, unified_gate_nowhiten, unified_two_stage, unified_full, unified_glr, kswin, mmd_window, newma, e_detector, residual_cusum, hybrid_hier
candidates tested for dominance (11): unified_gate, unified_gate_nowhiten, unified_two_stage, unified_full, unified_glr, kswin, mmd_window, newma, e_detector, residual_cusum, hybrid_hier

### frozen: detectors by mean comp_overall (lower=better)
              mmd_window     5.94  *cand*
            page_hinkley     6.35
            unified_full     6.41  *cand*
                   newma     6.65  *cand*
                   cusum     7.25
   unified_gate_nowhiten     7.30  *cand*
            unified_gate     7.48  *cand*
          residual_cusum     7.70  *cand*
             unified_glr     8.35  *cand*
                     csd     8.70
                    ewma     9.18
       unified_two_stage     9.55  *cand*
                   kswin    29.01  *cand*
               bocpd_ar1    52.13
                   bocpd    56.94
              e_detector    70.86  *cand*
             hybrid_hier   111.71  *cand*
                   adwin   119.97
### frozen: Pareto dominance over the cusum+csd frontier — dom_frac = fraction of baseline operating points the candidate matches/beats (>=0.90 CI-low => DOMINATES; lat_margin neg = faster)
  [ step]           unified_gate: dom_frac=0.08 CI=[0.00,0.25] lat_margin=+0.41 -> worse
  [ step]  unified_gate_nowhiten: dom_frac=0.08 CI=[0.00,0.21] lat_margin=+0.10 -> worse
  [ step]      unified_two_stage: dom_frac=0.13 CI=[0.00,0.25] lat_margin=+0.51 -> worse
  [ step]           unified_full: dom_frac=0.05 CI=[0.00,0.14] lat_margin=+0.05 -> worse
  [ step]            unified_glr: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+3.10 -> worse
  [ step]                  kswin: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+4.99 -> worse
  [ step]             mmd_window: dom_frac=0.12 CI=[0.00,0.21] lat_margin=+1.49 -> worse
  [ step]                  newma: dom_frac=0.04 CI=[0.00,0.08] lat_margin=+2.72 -> worse
  [ step]             e_detector: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+13.27 -> worse
  [ step]         residual_cusum: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+1.35 -> worse
  [ step]            hybrid_hier: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+13.62 -> worse
  [drift]           unified_gate: dom_frac=0.12 CI=[0.00,0.27] lat_margin=+0.90 -> worse
  [drift]  unified_gate_nowhiten: dom_frac=0.11 CI=[0.00,0.25] lat_margin=+0.02 -> worse
  [drift]      unified_two_stage: dom_frac=0.26 CI=[0.19,0.38] lat_margin=+0.01 -> worse
  [drift]           unified_full: dom_frac=0.13 CI=[0.06,0.20] lat_margin=-0.51 -> worse
  [drift]            unified_glr: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+2.96 -> worse
  [drift]                  kswin: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+5.89 -> worse
  [drift]             mmd_window: dom_frac=0.28 CI=[0.19,0.40] lat_margin=+1.20 -> worse
  [drift]                  newma: dom_frac=0.07 CI=[0.00,0.13] lat_margin=+2.84 -> worse
  [drift]             e_detector: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+17.79 -> worse
  [drift]         residual_cusum: dom_frac=0.08 CI=[0.00,0.27] lat_margin=+1.40 -> worse
  [drift]            hybrid_hier: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+20.43 -> worse

### reality: detectors by mean comp_overall (lower=better)
            page_hinkley    55.64
            unified_full    55.71  *cand*
                   newma    55.73  *cand*
              mmd_window    55.76  *cand*
                   cusum    55.77
          residual_cusum    55.82  *cand*
   unified_gate_nowhiten    56.02  *cand*
            unified_gate    56.17  *cand*
             unified_glr    56.23  *cand*
                    ewma    57.31
                     csd    59.81
       unified_two_stage    60.25  *cand*
                   kswin    70.73  *cand*
                   bocpd    78.36
               bocpd_ar1    80.04
              e_detector    93.23  *cand*
             hybrid_hier   111.44  *cand*
                   adwin   117.61
### reality: Pareto dominance over the cusum+csd frontier — dom_frac = fraction of baseline operating points the candidate matches/beats (>=0.90 CI-low => DOMINATES; lat_margin neg = faster)
  [ step]           unified_gate: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+0.26 -> worse
  [ step]  unified_gate_nowhiten: dom_frac=0.01 CI=[0.00,0.07] lat_margin=+0.19 -> worse
  [ step]      unified_two_stage: dom_frac=0.08 CI=[0.00,0.19] lat_margin=+0.88 -> worse
  [ step]           unified_full: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+0.50 -> worse
  [ step]            unified_glr: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+3.36 -> worse
  [ step]                  kswin: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+5.87 -> worse
  [ step]             mmd_window: dom_frac=0.01 CI=[0.00,0.12] lat_margin=+1.46 -> worse
  [ step]                  newma: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+3.10 -> worse
  [ step]             e_detector: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+16.51 -> worse
  [ step]         residual_cusum: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+0.59 -> worse
  [ step]            hybrid_hier: dom_frac=0.00 CI=[0.00,0.00] lat_margin=+14.84 -> worse
  [drift]           unified_gate: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]  unified_gate_nowhiten: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]      unified_two_stage: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]           unified_full: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]            unified_glr: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]                  kswin: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]             mmd_window: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]                  newma: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]             e_detector: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]         residual_cusum: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a
  [drift]            hybrid_hier: dom_frac=nan CI=[nan,nan] lat_margin=+nan -> n/a

