# Scratchpad – jev-integration · session 2026-09-25
_state.md: active/jev-integration/state.md · Updated: 2026-09-25T10:15_

## Now / Next
- Doing: Start #76 slice-2 graduation Phase A (stress sweep); Step-0 starvation gate first
- Next: preflight ./full-app status full, then Step-0 offline replay of kept=0/5 shadow calls
- Blocked: none

## Session log
- 10:15 DECIDED shared-account leftovers stay in place per user answer (leave as-is); scope all sweep locators around existing rows to avoid strict-mode collisions
- 10:15 DECIDED Step-0 runs offline replay first then minimal live sample per user answer; zero-spend replay classifies the kept=0/5 drop before any paid calls
- 10:15 DONE orient reads complete (handoff + STATUS + state + ticket #76 JSON + jev skill + rules 17/42/80/10/52/53/54); claimed #76 via self-assign to rings0fsaturn
- 10:15 NEXT preflight ./full-app status full
- 10:20 DONE preflight: intelligence/app/worker all healthy (pids 146659/146763/146834); #76 self-assigned to rings0fsaturn
- 10:20 FOUND 11 shadow lines in worker.log dedup to 7 distinct chunk-windows, all kept=0/5 with verdicts all-exclude; floor always set (top-by-relevance)
- 10:20 FOUND contradiction signal: chunks excluded by passage shadow later citation-verified stands=True at 0.96-1.00 (0c23.. via 1453ecf8, 982a.. via 0c2e3e6b, a61d.. via 6fb52250) - same chunks, opposite judges
- 10:20 FOUND window-composition suspect: matrix spec picks family + Generate with no skill tags and no scope, so _steer returns "" and context falls to _spread_context/_code_seeking_context while the shadow still judges relevance against the empty query
- 10:20 NEXT Step-0 offline replay: fetch assessment recipes + chunk texts from Supabase (read-only), reconstruct steer per window, hand-label, then one minimal live batched decide for raw Nouls
- 10:30 FOUND Step-0 confirmed offline: all 8 matrix recipes are bare {formats, difficulty, questionCount} with no skillTags and no scope, so _steer is "" in every cell and the shadow judged relevance against an empty query (context.py:62-63,111-115); grokking coding window (d1e02206) held binary_search + findSmallest/selectionSort code (ord 24/52) that grounded later citation stands 0.96 and question generation, so the 0/5 drop is a false-negative wall, not a correct strip
- 10:30 DECIDED Step-0 gate closes as window-composition false-negative wall; proceed to the threshold grid with real scored-query rows because generic-steer windows cannot measure relevance
- 10:30 NEXT TDD RED: failing test for pure summarize_passage (counts, rates, floor, per-label precision/recall) in a new test file mirroring test_jev_slice1_measure.py
- 10:45 DONE TDD RED->GREEN committed 372b0aa: measure_slice2.summarize_passage (histogram, starvation/floor rates, malformed, latency); RED ModuleNotFoundError on collection, GREEN 3 passed slice-2 + 35 passed jev-adjacent, ruff clean
- 10:45 NEXT build Step-0 evidence file: recorded shadow summaries for the 7 distinct starved windows + recipe/steer proof, commit as evidence JSON
- 11:20 DONE baseline spot-check: retrieval_arm full n=30 r@1 0.60 / r@3 0.7333 / MRR 0.7033 (dry --limit 2 was 1.0/1.0 on n=2); matches durable 754-corpus dense numbers 0.60/0.77/0.706 within gold tolerance (thresholds r@3 0.7, MRR 0.67); ticket 0.77/0.97 is the 788-chunk + reranker number (2026-08-15), NOT this arm - report both, do not claim the harness arm checks 0.77/0.97
- 11:20 DONE sidecar up via native docker, /health cuda_available true device cuda:0 dims 768 loaded+reranker true (rule 54: stop when embedding work done)
- 11:20 NEXT row collection: build slice2_rows.json from match_content_chunks windows on grokking + CSAPP with real scored-query steers, hand-label include/exclude/conflicting_evidence, split sweep/final by material
- 11:45 DONE Step-0 scored-query probe: 4 windows x 5 batched decide, verdicts 17 include / 3 exclude, starved 0/4; vs hand labels tp 12 fp 5 fn 1 tn 2 (precision 0.706, recall 0.923); FPs score relevance 0.75-0.93 + evidence 0.80-0.94 (same-chapter generous); sole FN (b3f713d0 cond-expr-vs-statement) sits 0.47/0.46 at the relevant_min/evidence_min walls; conflicting_evidence absent - premise-denying windows needed in sweep build; latencies 598-988 ms well under 15 s; spend $0.000406; sidecar stopped
- 11:45 NEXT post Step-0 + baseline update to #76, then design the full sweep (rows + grid + sidecar head-to-head) under TDD
- 11:50 DONE Step-0 + baseline posted to #76 (comment 5834061427)
- 11:50 NEXT full sweep design: slice2_rows.json (sweep/final by material, include/exclude/conflicting_evidence, premise-denying windows) + sweep runner extension + offline grid + sidecar head-to-head
- 12:10 DONE rows drafted: slice2_rows.json 44 rows (8 windows x 5 + 4 authored conflict pairs; sweep 15/5/2, final 13/7/2); dry --limit 2 windows clean: 7/10 OK, verdicts separate (include Nouls 0.54-0.97, exclude 0.13-0.24); 3 misses are boundary cases (a3916c8b log-prereq 0.56/0.73 FP, 22f9e95f log-steps 0.17/0.24 FN, 51447f9f D&C-mention 0.65/0.63 FP); spend $0.000219, lat 672-966 ms
- 12:10 NEXT extend the sweep runner (slice-2 path in jev_sweep_slice1.py shape) under TDD, then full sweep v1 + offline grid + sidecar head-to-head
