# Journal content brief - grounded evidence for the Springer draft
_Source: 4-stream read-only sweep 2026-10-22 (report miner, retrieval, KT+generation, closed-loop+system)._
_Shape target: `research/springer-sample-pattern.md` (5-section IMRaD, verdict table + explicit selection, honest limits). Shell rules: `research/sn-template-structure.md` (`sn-mathphys,Numbered`, single column)._
_Rule: every number below carries provenance. Anything marked NEEDS-LIVE-RUN is not claimed until measured._

## 1. Grounded numbers table

### Retrieval and ranking
- Dense baseline (frozen 788-chunk split, 30Q multi-gold): r@1 0.70, r@3 0.83, r@5 0.90, MRR 0.788 (`research/doc/2026-08-15-retrieval-quality-program-results.md:13`).
- Hybrid RRF (k=60, wD=1.0, wL=0.7, pool 25): r@1 0.73, r@3 0.90, r@5 0.93, MRR 0.816; gate r@3 +5 PASS (same doc :14).
- Plus Qwen3-Reranker-0.6B top-50: r@1 0.77, r@3 0.97, r@5 0.97, MRR 0.858; gate r@1 +10 / MRR +0.05 PASS (same doc :15).
- Rejected arms (honest-limits material): title-prefix no-gain 0.77/0.97/0.97/0.858; ONNX int8 collapse 0.10/0.10/0.10/0.131 at 2.45x speedup (same doc :16-17, :53-55).
- Durable 754-chunk baseline (current 30-token-overlap chunker, corpus `80c8b138`, 0 NULL, 768-d): in-process dense 0.60/0.77/0.87/0.706; hybrid 0.60/0.80/0.87/0.720; live RPC same-space 0.60/0.73/0.87/0.703; harness live 0.60/0.7333/0.8667/0.7033 (program-results.md :18-19; corpus-restore VERIFICATION.md :46; productionize VERIFICATION.md :93,119; issue-48 VERIFICATION.md :18).
- Reranked-754 re-run 2026-10-22 (sidecar-routed, same 30Q, 0 skipped): hybrid_rerank 0.67/0.90/0.93/0.797; deltas r@1 +7, r@3 +10, MRR +0.077; dense/hybrid arms reproduce the baselines exactly, which validates the rerank arm (`research/doc/2026-10-22-reranked-754.md`, JSON evidence beside it).
- RESOLVED 2026-10-22: reranked-754 measured at 0.67/0.90/0.93/0.797; the retired-788 headline (0.77/0.97/0.858) is superseded for the paper. Report the coherent 754 table; cite 788 numbers only as the frozen-split precedent.
- Sidecar parity: dense 0.70/0.83/0.90/0.790 vs 0.788 baseline (+0.002, within gate); sweep MRR 0.7894-0.7895 (dockerize VERIFICATION.md :9,18).
- Throughput: CPU ~80 chunks/min; GPU 4297-4522 chunks/min (operating-point dependent, batch 64 vs 128+HTTP16); rerank GPU batch8 325 ms mean vs CPU ~41 s per 50 pairs (gpu-benchmark.md :26-27, :37-40).

### Generation quality (eval harness, `research/doc/generation-quality-harness/summary.json`)
- Objective aggregate S-layer (n=180): schema_valid 0.9611, citation_valid 0.9133, gold_support 0.7803, near_dup 0.0044, cost $0.061289 (:16-51).
- Groundedness LLM-judge (fresh live 2026-10-22, n=30): 0.8667 = 26/30, confirms cached value; judge `deepseek/deepseek-v4-flash-0731`, reasoning off.
- Do not conflate groundedness 0.8667 (judge) with gold_support 0.7803 (citation-contains-gold): different metrics.
- Probe totals: 13 arms x ~30 = 395 calls, $0.099039; reasoning-off arm S:off p50 3973 ms, p95 10547 ms, 0 over-30s (deepseek-generation-probe/summary.json).
- Contract: `GENERATION_REASONING_EFFORT=off` default (`.env.example:19`).
- Coding derivability 0.0 on golds (report 04:52); fresh live pull 2026-10-22: 62 attempts, 43 judged, derivable_rate 0.5349 PASSES the 0.5 gate (was 0.4545 breach on 22/11); gold agreement 3/3.
- Gold counts: objective 30, written 6, coding 4 (3 derivable + 1 not); attempt gate K=5; 3 fold hashes.

### Knowledge tracing (three populations, cite with population)
- Synthetic bake-off (shipped params p_init 0.15 / p_learn 0.1 / p_slip 0.05 / p_guess 0.2): mean AUC 0.785, ECE 0.057 (`packages/py-progress/src/py_progress/mastery.py:23-42`).
- Live harness (real attempts, 282 obs over 139 skill seqs, fresh 2026-10-22): bkt-v1 AUC 0.7397 / ECE 0.1401 vs running-proportion 0.7368 / 0.2679 (was 109 obs, 0.7203/0.1463).
- External anchor (pyBKT accoding subsamples): mean AUC 0.602-0.611; gate `masteryMinAuc` 0.6 (`research/kt-bench/model_registry.json:84-115`; `eval_golds.json:64`).
- Thesis-safe framing: parity, not win (bake-off 0.888 vs 0.889 in report prose). Difficulty calibration unmeasured (`mean_abs_band_error: null`). NEEDS-LIVE-RUN.

### Closed loop (post-fix replay 2026-10-19, the paper's verdict table)
- Pre-fix: 4/4 `hold`, 0 conversions, conf 0.18-0.34 (span0/neutral inputs).
- Post-fix: 4/4 `suggest_replan`, conf 1.0, sufficiency 0.66-0.77, jev-1.13; 4/4 converted to `RoadmapReplanned`, all `option: extend-deadline`, exact verdictId/decidedAt mirror (`synthetic-users-seeding/state.md:5`; `closed-loop-hold-analysis/state.md:18`; postfix `.json` evidence).
- `days_span` 32 for all four from durable `SessionLogged.payload.date` (replaced same-day grade timestamps that collapsed span).
- Gate change: `LOOP_APPROVE_AT` 0.7 (was 0.9); sweep N=21 agrees 0.857 at 0.5-0.7; 0.8 rejected after live 0.79 dip falsified it.
- Hook 37/37, feedback 77/77, typecheck+lint clean (post `7863aec`).
- Caveats on record: clock pinned 2026-10-14; rebound-era capture not week-3 dip; local-only `OnboardingCompleted` gate; cold-restore local duplication (extract from cloud only).
- JEV cutoff/margin prior 0.6/0.10 holds (train 0.7/0.05 contradicted on test; test met-class thin at 2 pairs, agree_met 1.0 fragile).

### Live verification matrix (Phase-2 #49 exit 2026-10-12)
- Objective 2/2, written 4/4 rubric, coding 3/3, guide 2/2, practice-run 2/2, feedback-copy 3/3, mastery 2/2, ingestion 5+2 skipped, review 4/4; zero console/page errors; AC1/AC3/AC4 PASS, AC2 pass-with-skips (`phase2-wayfinder/state.md:20`).
- Paper role per report methodology: deployment check only, never promotes (04:50).

## 2. Claims ledger (claim | status | provenance)

- Closed-loop learner model (generation, per-family server grading, BKT, verdict-gated replan) is implemented and live-verified | GROUNDED | 01:8, 04:4-7, wayfinder exit matrix.
- Hybrid + rerank lifts 754 r@1 0.60 to 0.67 and r@3 0.80 to 0.90 (MRR 0.720 to 0.797) | GROUNDED 2026-10-22 | `research/doc/2026-10-22-reranked-754.md`. The 788-split lift (0.70 to 0.77 / 0.83 to 0.97) stays as frozen-split precedent only.
- Grounded generation at 0.867 with near-dup 0.004 | GROUNDED (cached judge) | harness summary.json :53-75.
- BKT steers difficulty at parity with baseline | GROUNDED as parity | bake-off + live harness rows above.
- Verdict-gated replanning converts 4/4 on synthetic longitudinal replay | GROUNDED with caveats | postfix evidence + caveat rows above.
- Advisory-only feedback and client checks never reach grades | GROUNDED (contract) | worker.py :139-143, types.ts :112-135.
- Single-learner scope; synthetics stand in for longitudinal study | STATED LIMIT | 01:29, 03:3.
- `code_not_derivable` refusal is honest terminal behavior | GROUNDED (contract) | assessments.py :360-373.

## 3. Section-to-evidence map

- 1 Introduction (no subheadings): problem sentence (time logs record time, not understanding; 01:8); closed-loop thesis (01:8); 7 objectives compressed to scope paragraph (01:12-26); scope delimiter (01:29). Fresh abstract (~200w, no cites/equations) + acronym keywords still to write.
- 2 Literature Review: 4-beat entries reusable from 02 (BKT equation 02:7-12; Chen/Zanellati/Mai/item-gen/lecture-quiz/KC-tag/rubric/Islam/Piston/Alhazbi/Uzun/gaming 02:5-37); verdict-ready `tab:litphase2` + 3-gap synthesis (untraceable gen; single-signal/client grades; answer-giving tutors; 02:67-84). Sourcing-honesty paragraph reusable as search-strategy limit (02:59-62).
- 3 Materials And Methods: 5-stage loop + verdict gating (04:4-7); server gate contract formats/questionCount (04:15); per-family grading arms (04:18); bkt-v1 + chip (04:21); gated ladder + feedback-v2 (04:24); Jev proposes / router disposes + LOOP_APPROVE_AT 0.7 (04:27); two-leg comparison design offline-golds-then-replay (04:50); datasets (754-chunk frozen + 768-d; eval golds 30/6/4; 4 archetypes; 05:38-56); tool table (OpenRouter flash T=0.3 no-reasoning 30 s; feedback muse-spark low; Jev-1.13; Qwen3 pair :8200; Piston :2000; 05:27-32); TS/Python parity harness (05:59); reproducibility triple (fail-closed defaults, X-Request-ID join, versioned re-runs; 05:119). Sample2-style needs: dataset row/feature counts + cleaning reasons + fixed budgets stated explicitly.
- 4 Results and Discussion: retrieval table (788-stock + 754-deployed split, sec 1 conflict note); generation table (groundedness/near-dup/cost); BKT table (three populations); verdict Table 1 (4 rows x verdict/conf/sufficiency/option/converted) + explicit selection sentence per Sample2 pattern; live matrix as deployment check; rejected arms (title-prefix, int8) as ablation honesty; parity/null discussion (BKT, CUSUM, conformal unshipped; 04:47).
- 5 Conclusion: winner restatement with metric; limits (compute budget, single-learner, synthetic-only validation, `code_not_derivable`, unshipped refinements); numbered future extensions (real-learner study, real-log validation, shipped conformal, per-account scale). Ch7 planned 7.1/7.2 per CHAPTERS.md.
- Back matter: 8-bullet Declarations shell, Acknowledgments, appendices env, `sn-bibliography` (11 keys in main.tex, all paper-relevant; sec 4 of report-miner return). Code-availability link goes inline in Conclusions per Sample1.

## 4. Figure and table shopping list

- EXISTS, reuse/adapt: `fig:architecture` (04:105-126 TikZ); `fig:closed-loop` (02:55-56); `fig:comparison-pipeline` (04:54-69); `fig:appflow1-5` screenshots (05:133-200); `tab:method-candidates`, `tab:phase2-metrics` (04:29-45, 75-91); `tab:litphase2` (02:67+).
- DRAW NEW: Results verdict Table 1 (4x5 + selection sentence); per-family grading bars; mastery AUC figure; next-week adherence figure (needs gap 3 measured first); journal architecture adaptation of `fig:architecture` to single-column width.
- Simple chains may stay inline TikZ per phase2-report precedent; standalone rule-61 recipe only for complex lane/container diagrams.

## 5. Gaps consolidated (all NEEDS-LIVE-RUN, do not invent)

1. Reranked-754 parity - CLOSED 2026-10-22 (`research/doc/2026-10-22-reranked-754.md` + JSON beside it).
2. Endpoint-level retrieval numbers - CLOSED 2026-10-22 (live `/v1/retrieval/search`: plain 0.60/0.73/0.87/0.703 exact RPC repro; reranked 0.70/0.90/0.93/0.813; `research/doc/2026-10-22-endpoint-retrieval.md` + JSON).
3. Second-corpus generalization - CLOSED 2026-10-22 (DDIA, 1094 chunks, 30 verified golds: dense 0.40/0.73/0.83/0.593, hybrid 0.47/0.73/0.83/0.660, reranked 0.63/0.90/0.97/0.799; deltas r@1 +16, r@3 +17, MRR +0.139, same direction as ACCA; `research/doc/2026-10-22-second-corpus-ddia.md` + questions + JSON).
4. Full-book PDF E2E through sidecar at scale - CLOSED 2026-10-22 (572-page fixture: created 13.5 s, extracting 15 s, embedding 48 s, ready 101 s, ~88 s wall at 10 s poll granularity; material deleted, card-gone verified; `research/doc/2026-10-22-fullbook-e2e-timing.md` + JSON).
5. Full `synthExtract` table emission - CLOSED 2026-10-22 (24 adherence rows; 12 mastery rows all below pInit because seeded scripts answer ~90% wrong by design; 4/4 verdicts converted; next-week adherence measured 0.000 with rebound-era caveat; `research/doc/2026-10-22-synth-extract-emission.md` + JSON). Seed-shape finding recorded: `+00:00`/`.000Z` timestamp mismatch silently breaks the mapEvents strict-equality join; emission canonicalizes (documented), product untouched.
6. Fresh generation live arms - CLOSED 2026-10-22 (`liveSource: live`; retrieval 0.60/0.7333/0.8667/0.7032 confirms cache; groundedness 0.8667 confirms cache; coding 0.5349 now passes 0.5 gate; harness `summary.json`/`report.md` rewritten).
7. Difficulty calibration measurement - CLOSED 2026-10-22 as unmeasurable on current data (definition locked; pool 1 eligible question; dip replay produced verdicts only, no new attempts; `research/doc/2026-10-22-difficulty-baseline.md`). Paper scopes the Adaptive chip to uncalibrated-advisory; the BKT AUC/ECE rows stand as the tracing evidence.
8. Week-3 dip-window replay - CLOSED 2026-10-22 (uniform pin 2026-09-05: 4/4 choice-hold at conf 0.28-0.35; Sept-12 struggling choice suggest_replan 0.61-0.69 held by gate; gradient trough->week4->rebound reads as intended; cloud untouched; JEV 7/15 calls used; `research/doc/2026-10-22-dip-window-replay.md`).
9. JEV probe budget - CLOSED 2026-10-22 (APPROVED 15-call cap for dip replay under stop rule; memo `plan/GAP9-SIGNOFF-MEMO.md`).

## 6. Front-matter facts still to confirm

- Target journal + reference style (default `sn-mathphys,Numbered` holds until named).
- Title, author list, affiliations, corresponding-author email, equal-contribution note.
- Code-availability URL for inline Conclusions link.
