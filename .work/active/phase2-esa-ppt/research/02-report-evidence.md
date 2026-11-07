# Report evidence — Phase-2 final PDF (Lane B)

Source: `college/mydeliverables/Phase-2-report/phase2-report/ROHITSAJI-PES2PGE24DS201-REPORT.pdf` (57 PDF pages, finalized 2026-10-23). Cross-checked against `chapters/*.tex` + `main.tex` where PDF text was ambiguous. All "PDF pN" below are physical PDF page numbers (pdfinfo: 57pp). Phase-1 report is superseded context only.

## 1. Chapter/section map (PDF pages)

- Cover: PDF p1. Certificate (unsigned): PDF p2. Declaration (no signature block): PDF p3. Acknowledgement: PDF p4. Abstract + keywords: PDF p5. Contents: PDF p6-7. List of Figures: PDF p8. List of Tables: PDF p9. Definitions and Abbreviations: PDF p10.
- Ch1 Introduction: PDF p11-13 (1.1 Background p11; 1.2 Problem p11-12; 1.3 Objectives p12-13; 1.4 Scope p13; 1.5 Organization p13).
- Ch2 Literature Survey: PDF p14-20 (2.1 Knowledge tracing p14-15; 2.2 Item generation/KC tagging p15-16; 2.3 Grading p16-17; 2.4 Socratic guidance/feedback p17-18; 2.5 Sourcing method p18-19; 2.6 Summary + Table 2.1 p19-20).
- Ch3 Requirements: PDF p21-25 (3.1 Hardware + Table 3.1 p21; 3.2 Software + Table 3.2 p22; 3.3 FR-1..FR-15 p22-23; 3.4 NFR-1..NFR-9 p23-24; 3.5 Perspective p24; 3.6 Assumptions p24-25; 3.7 Environment p25).
- Ch4 Methodology: PDF p26-31 (4.1 Closed loop p26; 4.2.1-4.2.5 candidates+selection p27-28; 4.3 Comparison p28-30 + Table 4.1/Fig 4.3 p29 + Table 4.2 p30; 4.4 Evolution p30; 4.5 Architecture + Fig 4.4/Table 4.3 p30-31).
- Ch5 Implementation: PDF p32-41 (5.1 Env p32; 5.2 Datasets + Tables 5.1/5.2 p32-33; 5.3 Service impl + Listing 5.1 p34 + Tables 5.3/5.4 p35; 5.4 Reproducibility + Tables 5.5/5.6 p36; 5.5 App: 5.5.1 materials/Fig 5.1 p37; 5.5.2 generation/Fig 5.2 p38; 5.5.3 taking/Fig 5.3 p38-39; 5.5.4 practice/Fig 5.4 p39-40 + Fig 5.5 flow p40; 5.5.5 feedback/loop/Fig 5.6 p39-41).
- Ch6 Results: PDF p42-47 (6.1 Generation quality + Tables 6.1/6.2/6.3 p42-44; 6.2 Live verification p45; 6.3 Closed-loop verdict + Table 6.4 p45; 6.4 Longitudinal validation p45-46; 6.5 Discussion p46; 6.6 Threats p47; 6.7 Summary p47).
- Ch7 Conclusion: PDF p48-50 (7.1 Conclusion p48-49; 7.2 Future work p49; 7.3 Limitations p49-50).
- Appendix A: PDF p51-54 (A.1 adherence/Table A.1 p51; A.2 verdict instants/Table A.2 p51-52; A.3 DDIA golds/Table A.3 p52-54; A.4 prompts/repro p52). Bibliography [1]-[31]: PDF p55-57.

## 2. Phase-2 story

- Problem (PDF p11-12): Phase-I pace signal is self-reported session time; a learner can log hours yet fail assessments while the plan reports healthy. Analytics measures time-on-task, not understanding; prediction-then-optimize schedules from predicted grades, not graded evidence from the learner's own answers.
- Gap (PDF p19-20, Table 2.1): generation is fluent but untraceable to source chunks; grades come from one signal or the client; guidance either measures without helping or helps by giving the answer away.
- Novelty (PDF p20, p48): the Cognitive-Tutor line (model tracing + KT + mastery learning) narrowed to one local-first self-directed learner: LLM-generated grounded items instead of authored curricula, per-family server grades instead of step tracing, verdict-driven replan instead of a teacher. No learning-gain claim (PDF p47, p49-50).
- Methodology (PDF p26-30): five-stage closed loop (plan -> study -> grade -> mastery/verdict -> replan); one family + one question per generation call with recorded citations; per-family authoritative grading; bkt-v1 mastery + advisory difficulty chip; gated Nudge/Hint/Targeted/Reveal ladder; Jev-1.13 proposes, code router disposes (evidence >= 0.5, confidence >= 0.7, LOOP_APPROVE_AT 0.7). Two-leg comparison: offline fixed-gold harness (fail-closed) + synthetic 4-archetype longitudinal replay; live browser matrix is deployment-only, never promotes a candidate (PDF p28, p30, p45).
- Architecture (PDF p30-31, Fig 4.4): browser client (bookings, projection, mastery readers, verdict handoff) + Python FastAPI service/worker (generation, grading, mastery, guide, feedback, verdict; Jev as hosted-API client) + Supabase hub (auth/events/storage) + Qwen3 embed/rerank sidecar (:8200, separate compose) + Piston sandbox (:2000). Per-user Dexie DB, schema v7; only event+queue tables sync (Table 4.3, PDF p31).
- Implementation (PDF p32-41): pnpm TS client + uv Python service; golden-fixture TS/Py parity to 1e-6 (Listing 5.1, PDF p34); fail-closed gates; X-Request-ID tracing; FR-9..FR-15 app chain Figs 5.1-5.6.
- Results (PDF p42-47): rerank lifts recall on both corpora (descriptive, n=30, McNemar n.s.); groundedness 0.8667 over six self-judged clusters; coding gate clears only on judged pair; BKT parity on ranking, ECE nearly halves live; 4/4 verdict-to-replan conversions post-fix with no fixed-plan control; adherence unobserved.
- Limitations (PDF p47, p49-50): synthetic single-learner evidence only; self-judged groundedness; unmeasured difficulty calibration; unobserved week 5; no control arm; third-party data retention unstated; sandbox without stated resource bound; prompt injection untested; no usability evidence.

## 3. Exact quantitative results (marking small-N / null)

Retrieval (Table 6.1, PDF p43; harness n=30, Wilson 95% spans ~15pts, PDF p42-43):
- ACCA 754-chunk harness: dense 0.60/0.77/0.87/0.706; hybrid 0.60/0.80/0.87/0.720; hybrid_rerank 0.67/0.90/0.93/0.797 (r@1/r@3/r@5/MRR). Rerank deltas: r@1 +7pts, r@3 +10pts, MRR +0.077. SMALL-N: arm gaps inside Wilson band are descriptive (PDF p42-43).
- Live endpoint same corpus: plain RPC 0.60/0.73/0.87/0.703 (reproduces in-process arm exactly); reranked 0.70/0.90/0.93/0.813. Endpoint rerank gain descriptive: McNemar p=0.546 (rank1), p=0.131 (rank3), neither < 0.05, no multiplicity correction (PDF p42-43). NULL on significance.
- DDIA 1094-chunk second corpus: dense 0.40/0.73/0.83/0.593; hybrid 0.47/0.73/0.83/0.660; hybrid_rerank 0.63/0.90/0.97/0.799. Deltas: r@1 +16pts, r@3 +17pts, MRR +0.139 (PDF p42-43). Cross-corpus absolutes NOT comparable (independently authored golds); only arm deltas transfer (PDF p43).
- Rejected/retired: title-prefix indexing no gain; int8 quantization collapses to 0.10 at 2.45x speedup; retired 788-split headline (r@1 0.77, r@3 0.97, MRR 0.858) is frozen-split precedent only (PDF p43, p48).
- NFR-9 floor (PDF p24): r@1 0.60, r@3 0.85, MRR 0.75 on frozen ACCA-754 — headroom below hybrid_rerank arm, not the measured value.

Generation/grading (Table 6.2, PDF p44; Sec 6.1, PDF p43-44):
- Delivered S:off arm (n=30): schema-valid 0.9667 (29/30); gold support 0.7241 (21/29 valid citations); cost $0.00561, latency p95 10.5 s. SMALL-N.
- S-layer sweep aggregate (n=180): schema-valid 0.9611; citation-valid 0.9133; gold support 0.7803; near-duplicate 0.0044; cost $0.061289. Telemetry over 361 requests: 281 ok, 37 partial, 35 malformed output, 8 provider errors (PDF p43-44).
- Groundedness (LLM-judged): 0.8667 (26/30, Wilson 95% 0.70-0.95). SMALL-N + CLUSTERED: 30 judgments cover six distinct questions (S:1-S:6, 3-6 repeats each); generator and judge share deepseek-v4-flash-0731 reasoning-off (self-judged); no independent-judge rerun or human audit (PDF p43, p47). NFR-7 floor 0.80 on n=30 sits below the arm with headroom (PDF p24).
- Coding derivability: 0.0 on golds pre-top-up run (refusals by design); fresh live pull 0.5349 over 43 judged attempts (Wilson 95% 0.39-0.68), 0.371 over all 62 (23 derivable / 20 refusals / 19 other failures). 0.5 gate clears ONLY on judged pair (PDF p43-44, p47). Gold counts: 30 objective + 6 written + 4 coding (3 derivable + 1 not), attempt gate K=5 over 3 fold hashes (PDF p44).
- Written-arm cutoff: rubric cutoff 0.6 + margin 0.10 shipped; train split favored 0.7 but test agreement fell to 0.5 on a met-class of TWO pairs, so 0.6 prior shipped (PDF p44). SMALL-N (n=2) — flag on any slide.
- Harness gate verdict for this run: FAIL — breached gate difficultyMeanAbsBandError because difficulty calibration is unmeasured (PDF p42, p47).

Mastery/BKT (Table 6.3, PDF p44):
- Bake-off shipped params (p_init 0.15, p_learn 0.1, p_slip 0.05, p_guess 0.2): mean AUC 0.785, ECE 0.057 (PDF p44, p48-49). Ch2 bake-off pair: bkt-v1 0.888 vs running-proportion 0.889 — parity, not a win (PDF p15, p28).
- Live harness (282 observations, 139 skill sequences): bkt-v1 AUC 0.7397/ECE 0.1401 vs running-proportion 0.7368/0.2679 — parity on ranking, calibration error nearly halves (PDF p44). Point estimates only, no intervals — parity reading stays descriptive (PDF p44).
- External pyBKT accoding anchor: AUC 0.602-0.611 under gate masteryMinAuc 0.6, ECE 0.272 not reportable (PDF p44).
- Difficulty calibration: UNMEASURED (null) — pool holds 23 observations on a single question in one band; adaptive chip stays uncalibrated-advisory (PDF p44, p46, p48-49).

Live verification — deployment check only, never promotes a candidate (PDF p45): objective 2/2; written 4/4 with real rubric grades; coding 3/3; guide 2/2; practice 2/2; feedback copy 3/3; mastery 2/2; review 4/4; ingestion 5 with 2 skipped; zero console/page errors; AC1/AC3/AC4 pass, AC2 passes with skips. SMALL-N throughout — deployment evidence only.
- Full-book E2E (572-page/~23 MB fixture): upload->created 13.5 s; extracting 15 s; embedding 48 s; ready 101 s; start-to-ready wall ~88 s at 10 s poll granularity; 754-chunk baseline with 0 NULL embeddings; material deleted after run, shared account as found (PDF p45, p48-49).

Closed loop (Table 6.4, PDF p45; Sec 6.3-6.4, PDF p45-46):
- Post-fix replay: 4/4 suggest_replan verdicts convert to verdict-linked replans; confidence 1.0; sufficiency 0.66-0.77 (cross-user range; per-archetype decidedAt in versioned JSON); all four extend-deadline over material-scoped 32-day span; exact verdict pair mirrored onto RoadmapReplanned (PDF p45, p48). NO fixed-plan control — no efficacy comparison (PDF p46-47). decidedAt values (Table A.2, PDF p52): steady 2026-10-14T12:00:11.235Z; crammer .007.156Z; struggling .007.606Z; returning .007.515Z — all converted.
- Pre-fix contrast: 4/4 hold at confidence 0.18-0.34 on spanless neutral inputs; input fix opened states; confidence 1.0 would also clear old 0.9 gate; gate moved 0.9 -> 0.7; 0.8 candidate rejected after live sample 0.79 fell in 0.79-0.85 band (PDF p45).
- Dip-window replay (browser clock pinned to week-3 trough): 4/4 hold at 0.28-0.35, sufficiency 0.66-0.77, Keep writes nothing; Sep-12 pin flips struggling to suggest_replan at 0.61-0.69 but gate holds; rebound-eve converts at 1.0 (PDF p46, p48).
- Adherence: 24-cell emission, 20 weekly values observed; week 5 NOT OBSERVED (n.o.) for all four — 0.000 marks unobserved week, not measured zero (Table A.1, PDF p46, p51). Next-week adherence unobserved (capture ran one day before deadline) (PDF p45-46). 12 mastery rows ~0.1067 throughout (below prior 0.15) measure seeded scripts (~90% wrong answers for grading-path coverage), never cited as tracing validation (PDF p46-47). Cloud replan counts: crammer 1, returning 2, steady 1, struggling 2; no cloud history rewritten (PDF p46). Seed-shape timestamp defect recorded, no product code changed (PDF p46).

Test inventory (Table 5.6, PDF p36; counts collected 2026-10-23): 976 pytest tests / 57 files (intelligence); 65 vitest files (app+engines); 37 hook + 77 feedback tests passing; 33 Playwright spec files; 11 harness pure-function unit tests. No CI gate; coverage not measured (PDF p36).

Hyperparameters to hold fixed (Table 5.5, PDF p36): ~400-token chunks / ~30-token overlap; 768-dim Qwen3 sidecar embeddings; top-5 owner-scoped chunks per generation call; top-50 candidates before rerank; generation temp 0.3, reasoning off, 30 s timeout, 4096 max output tokens; at most one repair; BKT params above; loop gates evidence 0.5 / confidence 0.7.

## 4. Slide-candidate tables and figures (page + caption)

- Fig 2.1 (PDF p18): "The assessment-verified closed loop this chapter motivates: generated items are graded per family, grades update mastery, the verdict steers the plan, and the plan points back at the material. ..." — best single concept slide.
- Table 2.1 (PDF p19-20): "Summary of approach families, with strengths and limitations for this project." — gap-motivation slide.
- Fig 4.1 (PDF p28): "Guide ladder state machine: each step streams against retrieved chunks and only an explicit confirmation opens Reveal." — small TikZ diagram.
- Fig 4.2 (PDF p28): "Loop verdict router: the judge proposes over the week signals and the code gate disposes." — small TikZ diagram; pairs with gate numbers (0.5/0.7).
- Table 4.1 (PDF p29): "Candidate approaches per loop stage and the approach selected for the delivered system." — decisions slide.
- Fig 4.3 (PDF p29): "The two-leg comparison. Fixed golds score each candidate arm behind a fail-closed gate; the synthetic replay then validates the assembled loop after the gate fix." — methodology slide.
- Fig 4.4 (PDF p31): "The deployment that realizes Figure 2.1. ..." — architecture slide (client/service/Supabase/sidecars).
- Table 4.2 (PDF p30): "Evaluation metrics by loop stage." — honest-metrics framing slide.
- Listing 5.1 (PDF p34): "The shipped BKT forward filter, which realizes Equation (2.1)." — short code slide (optional).
- Table 5.5 (PDF p36): "Hyperparameters a rerun must hold fixed." — reproducibility backup slide.
- Table 5.6 (PDF p36): "Test inventory behind the delivered code (counts collected 2026-10-23)." — engineering-rigor slide.
- Fig 5.1 (PDF p37): "The material library: ready cards offer practice while the failed card keeps its badge with a retry action." — screenshot.
- Fig 5.2 (PDF p38): "Assessment generation: one material, one family, and one scoped chapter per question." — screenshot.
- Fig 5.3 (PDF p39): "Taking and review: the server grade with per-criterion rubric feedback." — screenshot.
- Fig 5.4 (PDF p40): "Practice run: the lazily resolved question with the Socratic coach anchored to the attempt." — screenshot.
- Fig 5.5 (PDF p40): "The complete Phase II application flow: ..." — five-stage chain strip (best flow slide).
- Fig 5.6 (PDF p41): "Feedback and the loop: the inspectable evidence trail with the advisory recommendation." — screenshot; NOTE Batch-6 flag says it needs live re-capture, screenshots uncropped (state.md) — verify pixels before enlarging.
- Table 6.1 (PDF p43): "Retrieval: recall and MRR by arm. ..." — headline results slide (annotate n=30, descriptive deltas, McNemar n.s.).
- Table 6.2 (PDF p44): "Generation: delivered S:off arm, S-layer sweep aggregate, groundedness judge, and coding pair. ..." — headline results slide (annotate self-judged, judged-pair gate).
- Table 6.3 (PDF p44): "Knowledge tracing: AUC and calibration across three populations. ..." — parity + calibration-halved slide.
- Table 6.4 (PDF p45): "Loop verdict: post-fix replay across four archetypes. ..." — 4/4 conversion slide (annotate no control, sufficiency range).
- Table A.1 (PDF p51): "Adherence emission: actual over planned minutes by user and week. Week 5 is not observed (n.o.) ..." — honesty appendix slide.
- Table A.2 (PDF p52): "Loop verdict instants: per-user decidedAt values." — provenance backup slide.
- Table A.3 (PDF p53-54): "DDIA second-corpus gold set, questions 1 to 15 / 16 to 30." — corpus-rigor backup (30 Qs verbatim snippets).

## 5. Claims an examiner will test (with best evidence page)

1. "Reranking lifts retrieval on both corpora" — Table 6.1, PDF p43; but paired test cannot separate gain from noise at n=30 (McNemar p=0.546/0.131, PDF p42-43). Say "descriptive lift, not significant."
2. "Questions are grounded (0.8667)" — Sec 6.1, PDF p43-44; self-judged (same model, reasoning off), six clusters, no independent rerun/human audit (PDF p47). Must disclose.
3. "Coding arm is honest (refuses ungroundable)" — 0.0 pre-top-up, 0.5349 judged / 0.371 full-denominator, gate clears only on judged pair, PDF p43-44. Do not quote 0.5349 without 0.371.
4. "Mastery tracing works" — Table 6.3, PDF p44: ranking parity (0.7397 vs 0.7368; bake-off 0.888 vs 0.889), ECE nearly halves (0.1401 vs 0.2679). Difficulty calibration unmeasured (23 obs, one band). Advisory-only chip.
5. "The loop closes: 4/4 verdicts convert" — Table 6.4, PDF p45; confidence 1.0, sufficiency 0.66-0.77, 32-day span; pre-fix 4/4 hold contrast, PDF p45. No fixed-plan control, adherence unobserved — integration behavior, not efficacy (PDF p46-47).
6. "Live app is verified end-to-end" — Sec 6.2, PDF p45: all pass counts are n=2-4 deployment checks + one 572-page full-book run (~88 s wall). Not a user study.
7. "No learning gain is claimed" — Abstract PDF p5; Sec 6.6-6.7 PDF p47; Sec 7.3 PDF p49-50; loop replay covers integration on synthetic histories, efficacy deferred. Strongest defense line.
8. "Harness gate reads FAIL" — Sec 6.1, PDF p42 (difficultyMeanAbsBandError, calibration unmeasured). Examiner may ask why a FAIL ships: answer — fail-closed gate behaving as designed; difficulty chip stays advisory; recorded in Threats (PDF p47).

## 6. Known open items — visible in the PDF as gaps (yes/no)

- D-01 signatures: VISIBLE GAP — certificate PDF p2 shows blank examiner/signature rows ("1. / 2." with empty signature cells; guide/coordinator/dean names printed, no signatures); declaration PDF p3 carries no signature/date/originality block. Matches task state (author decision D-01 open).
- Fig 5.6 re-capture: VISIBLE AS RISK — figure exists PDF p41 with caption as listed; state.md Batch-6 partial ("needs live re-capture; screenshots uncropped") cannot be confirmed from text alone — flag for pixel check, do not enlarge blindly.
- 29 -> 35-50 refs: VISIBLE GAP — bibliography holds [1]-[31] = 31 entries (PDF p55-57), still below the 35-50 target; Sec 2.5 (PDF p18-19) explicitly states "No hundred-scale database screening ran... Scopus and IEEE full-text screening ... remain author follow-up." Matches D-04 open.
- Judge rerun: VISIBLE GAP — self-judge disclosed Sec 6.1 (PDF p43) + Threats 6.6 (PDF p47): "no independent judge or human audit exists." Matches D-03 honest-cluster decision (no rerun budget).
- Learner study: VISIBLE GAP — synthetic-only scope stated Sec 1.4 (PDF p13), Sec 6.4-6.6 (PDF p45-47), Sec 7.2-7.3 (PDF p49-50): four synthetic archetypes replace the real-learner study; single-learner pilot deferred. Matches D-02 reframe.

## 7. Internal inconsistencies spotted

- Reference count: Sec 2.5 (PDF p19) says "The 29 retained references split into 11 Phase I and Phase II anchors and 18 added records," but the bibliography (PDF p55-57) numbers [1]-[31] = 31 entries. "29" is stale relative to the shipped list — do not quote 29 as the reference count; count is 31.
- Front-matter Contents (PDF p6-7) vs body: Contents lists Appendix items and bibliography correctly, but figure/table list pages (LOF p8, LOT p9) repeat captions verbatim — no inconsistency, just note captions must match body exactly if quoted.
- 32-day span vs 5-week archetypes: Sec 1.3 (PDF p12-13) says "five weeks each" while Sec 6.3 (PDF p45) reports a "32-day span" for the material-scoped run; both can hold (5 weekly emission columns w0-w4 observed + unobserved w5, Table A.1 PDF p51), but do not equate "5 weeks" with "35 days" on a slide — say "32-day material-scoped span; week 5 unobserved."
- Cost/latency pairing: S:off "$0.00561, 10.5 s" (PDF p44) is the delivered arm; "$0.061289 / 361 requests" is the sweep aggregate — keep the two denominators apart on any slide.
- No other number conflicts found: retrieval rows, BKT params, decidedAt values, and full-book timings repeat identically across Ch6/Ch7/Appendix.
