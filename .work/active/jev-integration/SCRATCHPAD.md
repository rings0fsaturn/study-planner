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
