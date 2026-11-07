# Journal evidence — Lane C (journal miner), phase2-esa-ppt

Source: `college/mydeliverables/phase2-journal/ROHITSAJI-PES2PGE24DS201-JOURNAL.pdf` (16pp, finalized 2026-10-23).
Cross-checked against: `college/mydeliverables/phase2-journal/journal-draft.tex` (468 lines, same content) and
`college/mydeliverables/phase2-journal/journal-refs.bib` (24 refs).
Compared against: `college/mydeliverables/Phase-2-report/phase2-report/ROHITSAJI-PES2PGE24DS201-REPORT.pdf` (57pp).
Provenance key: `J:pN` = journal printed page N; `R:pN` = report printed page N; `T:lN` = journal-draft.tex line N.
PDF text extracted with `pdftotext -layout`; page mapping verified against printed folios.

## 1. The compressed 16pp argument, section by section

Headline contribution (J:p1 abstract, J:p2): **the verdict-gated closed loop itself** —
one-family grounded generation, per-family server grading, BKT tracing, reranked retrieval, and a
Jev verdict gate at 0.7, evaluated on frozen evidence. Quote: "The contribution is the loop itself" (J:p2, T:l66).

- **Abstract (J:p1).** Fixed plans fail within days; time logs do not measure understanding.
Reports: rerank r@1 0.60→0.67, r@3 0.80→0.90 on frozen 754-chunk corpus; groundedness 26/30 (0.867),
near-duplicate 0.004; live BKT AUC 0.74 tying the running-proportion baseline while halving calibration error;
4-of-4 synthetic cases convert to replans; zero console errors across all live suites; single-learner scope with
synthetic validation; Phase I change detection a robust null, no detector shipped, split-conformal unshipped.
- **1 Introduction (J:pp1-2).** Phase I = open-loop pace planner (adapts to pace, never checks learning).
Phase II closes the loop with assessment-based proof: grounded practice, authoritative grading, BKT mastery,
Socratic ladder, verdict-driven replan. Research question: can a gated, evidence-backed loop replan from grades
while refusing what it cannot ground. Three scope rules: every number traces to frozen evidence or live code;
synthetics replace a classroom study (stated wherever it matters); rejected arms and nulls sit beside positives.
Bloom [1] 2-sigma cited as the single-learner motivation, tested with synthetics not a classroom (J:p2, T:l66).
- **2.1 Tracing and mastery (J:pp2-3).** BKT equation (correct-response posterior + learn-rate step) with
Corbett & Anderson [2]; Chen et al. hierarchical priors (312 adults) supply prior structure, BKT the updater;
Zanellati et al. hybrid taxonomy (hybrids beat pure BKT/DKT on correctness prediction but do not steer content);
parameter-selection bake-off bkt-v1 0.888 vs running-proportion 0.889, flagged as a different cut from the
shipped-params synthetic row (0.785) and live harness (0.7397 vs 0.7368) (J:p2-3, T:l88);
Mai et al. probabilistic head rejected on cold start; DKT [6] rejected (needs dense logs, less inspectable).
Synthesis: prior structure (Chen), updater taxonomy (Zanellati), temporal head (Mai) — none joins the posterior
to the next task the learner sees; the planner needs that join (J:p3, T:l94).
- **2.2 Generation and ranking (J:pp3-4).** STEM prompting study [7] (coverage claim, no chunk provenance);
lecture-to-quiz [8] (shape checks miss well-formed questions on wrong passages); KC tagging [9] (tags never
steer practice); RAG [10] + DPR 754 chunks/768-d [11] + BM25 [12] + RRF pool 25 [13]; reranker reorders top 50,
+r@1 7pts / +r@3 10pts [14]. Synthesis: item-quality vs item-provenance split; one-family-per-call makes the
citation audit tractable — "It spends calls instead of mixing formats" (J:p3-4, T:l108).
- **2.3 Grading authority (J:pp3-4).** EDUCON rubric study [15] (repeatable judgments; live matrix grades
written 4/4); Piston sandbox [16] for code; grade-prediction study [17] (~0.73 forecast used for planning only,
grading kept separate; objective 2/2 exact match). Synthesis: rubric = contract for non-recomputable judgments,
hidden tests = contract for reproducible code pass/fail; authority never transfers to the client; the refusal path
(`code_not_derivable`) follows from the same split (J:p4, T:l116).
- **2.4 Guidance without answers (J:p4).** Alhazbi et al. 25-study review [18] (adherence metrics, no guidance);
Uzun et al. [19] (engagement needs reading; ungated hints leak answers, reveal locked till confirm);
think-aloud gaming study [20] (genuine attempts vs answer extraction; replay 4/4 conversions post-fix vs 4/4
holds pre-fix). Synthesis: "We prefer less help that stays auditable over more help that confounds the
evidence" (J:p4, T:l126).
- **2.5 Sourcing note (J:pp4-5).** Advisor-guided curation + citation chaining, one representative work per
sub-theme, **no hundred-scale screening run or claimed** (T:l130). Table 1 lit map: 6 streams ×
selected/rejected/gap, including a Loop row (Jev gate fail-closed vs raw LLM choice) that has no report
equivalent as a lit-row (J:p5, T:l132-146).
- **3.1-3.4 Methods core (J:pp5-6).** Five stages; hold writes no event, suggest-replan copies exact verdict
pair; one family + one question per call with bounded concurrency; objective=exact rules, written=rubric,
coding=sandbox, client checks advisory; bkt-v1 released params, Adaptive advisory and "uncalibrated by design
in this draft" (T:l168); Jev jev-1.13 via OpenRouter, sufficiency in [0,1], 0.7 rule, fail-closed to hold;
threshold sweep 0.5–0.7 agreed with human label on **18 of 21 states**, 0.8 rejected (held a live 0.79 case)
(T:l174).
- **3.5-3.6 Design + datasets (J:p6).** Two-part design (frozen-gold offline leg + 4-archetype synthetic
longitudinal leg; live browser matrix deployment-check only). ACCA APM text, 572pp, 754 durable chunks,
768-d, zero nulls; OULAD reserved, no OULAD result enters the paper [21]; 788-chunk split frozen precedent
only; golds 30 objective + 6 written + 4 coding, attempt gate K=5; archetypes steady/crammer/struggling/
returning; no new live-user dataset (T:l182).
- **3.7 Tool stack + fixed budgets (J:pp6-7).** Table 2 pins (deepseek-v4-flash-0731 reasoning-off T0.3 30s;
muse-spark-1.3-contributor low for feedback; Jev-1.13 separate key; Qwen3 pair on :8200; Piston :2000 Python
3.12.0; CodeMirror 6 + Pyodide 0.27.8 advisory). Budgets as claims: reranked-754 = 30Q×3 arms; endpoint =
30Q×2 flags; DDIA 30 golds/1094 chunks; generation probe 395 calls at $0.099 across 13 arms; structured-output
probe 180 items p50 3973ms / p95 10547ms, none over 30s; dip replay ≤15 Jev calls, used 7; beyond-budget = new
run, not rerun (T:l192).
- **3.8 Reproducibility (J:p7).** Fail-closed gates; one request-id per logical call (used to verify the
zero-error claims, not assumed); versioned evidence beside the draft. "A mismatch between paper and code is
therefore a defect we can locate, not a dispute about which build produced a number" (T:l214). Scope fence:
mechanics on frozen evidence only — no population, retention, or classroom claims (T:l216).
- **4.1 Retrieval (J:pp7-8).** Table 3: dense 0.60/0.77/0.87/0.706; hybrid 0.60/0.80/0.87/0.720; hybrid+rerank
**0.67/0.90/0.93/0.797**. Footnote: 788-split precedent (dense 0.70/0.83/0.90/0.788; hybrid 0.73/0.90/0.93/0.816;
reranked 0.77/0.97/0.97/0.858) superseded. Fig 1 bar chart. Endpoint: plain reproduces RPC probe
0.60/0.73/0.87/0.703; reranked endpoint 0.70/0.90/0.93/0.813 reported as the deployed number (RPC candidate set
differs). DDIA: +16 r@1, +17 r@3, +0.139 MRR. Title-prefix no gain; INT8 → 0.10 rejected. Interpretation:
fusion adds depth not first-hit; reranker recovers near misses (r@3 gain > r@1 gain in both corpora); HTTP
boundary adds no retrieval defect; 788 numbers from a retired chunker, not comparable (J:p8, T:l257).
- **4.2 Generation (J:p9).** Table 4 (n=180 probe + n=30 fresh judge): schema 0.9611, citation 0.9133, gold
support 0.7803, near-dup 0.0044, cost $0.061289, groundedness 0.8667 (26/30), coding derivable 0.5349 (passes
0.5 gate), gold agreement 3/3 coding golds with authored accepted value (4 total). Support-vs-groundedness
distinction explicit, never averaged. 0.5349 called "the weakest headline number… the first place a fresh
corpus would likely fail" (T:l282).
- **4.3 BKT (J:pp9-10).** Table 5 + Fig 2 (y-axis from 0.5): bake-off shipped params 0.785/0.057; live
0.7397/0.1401 vs run-prop 0.7368/0.2679 (282 obs, 139 seqs); external anchor 0.60–0.61, ECE not reportable
(floor check, not like-for-like). Difficulty pool held one question → Adaptive stays advisory, no difficulty
effect claimed (T:l314).
- **4.4 Verdicts (J:pp10-11).** Table 6 (9 rows) + Fig 3 scatter with 0.7 dashed gate: rebound 4/4 convert at
conf 1.0, sufficiency cross-user range 0.66–0.77, all extend-deadline with exact verdict copy; trough holds 4/4
at 0.28–0.35; week-4 struggling 0.61–0.69 gate-held; pre-fix 4/4 holds at 0.18–0.34 from span-zero inputs
reported "only as the defect the fix removed, not as a second result". Adherence arm (24 rows, next-week
0.000) kept in appendix, rebound-era capture, no adherence effect claimed (T:l354). "The gate tracks the
evidence rather than the calendar" (J:p11).
- **4.5 Architecture (J:p11).** Three TikZ figures: deployment map (solid=requests, dashed=worker calls;
sidecars :8200/:2000), five-stage loop with gate, two-leg comparison pipeline with deployment check separate
(T:l360-415).
- **4.6–4.8 (J:p12).** Rejected arms recap (incl. INT8 2.45x speedup note); parity-and-nulls (BKT parity not
improvement; Phase I change-detection null; no detector; split-conformal unshipped; Adaptive advisory);
deployment check counts (objective 2/2, written 4/4, coding 3/3, guides 2/2, practice 2/2, feedback 3/3,
mastery 2/2; ingestion completes with skips; zero console errors; full-book ready ~88s with cleanup).
- **5 Conclusion (J:pp12-13).** Loop joins what prior planners keep apart; evidence supports ranking parity
with better calibration + 4/4 synthetic replans; no population/retention support. "The test that would change
the claim is a real-learner study with held-out validation." Code + data-availability + contribution
declarations; 8 versioned evidence records in Appendix A with exact filenames (reranked-754, endpoint,
DDIA+questions, synth emission, generation harness summary/report/live, difficulty baseline, dip replay,
full-book timing) (J:p13, T:l462).

## 2. Deliberately excluded vs the 57pp report

- All Phase I machinery: Bayesian pace calibration, CUSUM change detection (Page), GP projection (Rasmussen),
split-conformal correction (Vovk) except as named nulls (R:pp11,14-15,26,46,48-49 vs J:p1 abstract mention only).
- Full SRS chapter: FR-1–FR-15, NFR-1–NFR-9 with prospective floors, hardware/software tables (R:pp21-25).
- Implementation chapter: app screens (Figs 5.1–5.6), service route table, TS/Python parity harness + BKT
listing, hyperparameters table, test inventory (976 pytest / 65 vitest / 33 Playwright) (R:pp32-41).
- Design-evolution narrative, event-type table, Dexie schema v7, RLS/owner-scoping (R:pp30-31).
- Threats-to-validity chapter as such (ethics/security: third-party retention, sandbox bounds, prompt injection,
no usability evidence) (R:pp46-47); journal keeps only the scope fence in Methods (J:p7) and per-result caveats.
- Future-work program (split-conformal shipment, multi-band calibration, real-learner study, usability gate,
classroom scope) (R:pp48-50); journal compresses to one sentence (J:p12-13).
- Supplementary tables: adherence emission A.1, verdict instants A.2, 30 DDIA questions A.3, judge prompts +
rerun commands A.4 (R:pp51-54); journal Appendix A is an evidence-file index only (J:p13).
- 7 report-only references: Page 1954, Rasmussen 2006, Vovk 2005 (Phase I heritage); Zheng et al. 2023 + Kasneci
et al. 2023 (judge validity); VanLehn 2011, Anderson et al. 1995, Koedinger & Aleven 2007 (tutoring systems);
Cepeda et al. 2006, Settles & Meeder 2016 (spacing); Roediger & Karpicke 2006, Dunlosky et al. 2013 (retrieval
practice); Hattie & Timperley 2007, Chi & Wylie 2014, Shute 2008 (feedback theory); Niculescu-Mizil & Caruana
2005, Embretson & Reise 2000 (calibration/IRT); Vaswani et al. 2017 is cited in journal Methods [23] but has no
journal-refs.bib entry of its own — it is covered only via the bib's `vaswani2017`? No: bib has no vaswani key;
`\cite{vaswani2017}` in T:l186 resolves against the SN template's sample bib or is a dangling cite — PPT must
not cite Vaswani from the journal without checking. Journal ref count 24 vs report 31.
- Statistical machinery: Wilson 95% intervals (r@1 0.42–0.75, r@3 0.56–0.86; groundedness 0.70–0.95; coding
0.39–0.68), McNemar p=0.546/0.131, delivered S:off arm detail (0.9667/0.7241, $0.00561, p95 10.5s), harness
telemetry (281 ok / 37 partial / 35 malformed / 8 provider errors), full-denominator coding rate 0.371,
review-queue 4/4, ingestion 5+2 skipped, AC1–AC4 acceptance mapping, decidedAt instants, seed-shape timestamp
defect, four replay caveats (R:pp42-46).

## 3. Journal-vs-report differences; CONFLICTs

No headline metric differs. Deliberate-shape differences first, then conflicts.

- Framing: journal headline = "the loop itself" (J:p2); report headline = verified-learning loop extending
predict-then-optimize [Islam] from predicted grades to graded evidence, narrowed from Cognitive Tutors
(R:pp20,48). Journal drops the Cognitive-Tutor narrowing claim and the predict-then-optimize extension claim.
- Gate narrative: journal reports only the 0.5–0.7 sweep (18/21 agreement) + 0.8 rejection (J:p6, T:l174);
report adds the origin (gate moved 0.9→0.7, LOOP_APPROVE_AT; conf 1.0 would clear the old gate) and the
0.79–0.85 band detail (R:pp10,28,45). Complementary, not conflicting.
- BKT equation: journal prints only the correct-response posterior (J:p2, T:l77-81); report eq 2.1 identical
in form (R:p14). The incorrect-response branch lives in code listing (R:p34), absent from the journal.
- External anchor: journal table "0.60-0.61" + text "0.602-0.611 floor" (J:pp9-10); report "0.602 to 0.611"
(R:pp43-44). Rounding only — NOT a conflict.
- Groundedness framing gap: report discloses the judge is self-judged (same deepseek-v4-flash-0731 model,
reasoning off, no independent judge/human audit; 30 judgments over six question clusters) (R:pp43,46-47).
The journal never states the generator and judge share a model. For a PPT methods slide, use the report's
disclosure; the journal alone over-reads.
- Coding-gate framing gap: journal "Coding derivability is 0.5349 and passes the 0.5 gate" (J:p9, T:l263);
report adds the full denominator 0.371 (23/62) which does NOT clear 0.5 — "clears only on the judged pair"
(R:pp43,47-48). The journal omits 0.371. PPT must carry the report's qualifier.
- Adaptive wording: journal "leave the module uncalibrated by design in this draft" (J:p6, T:l168); report
"harness gate verdict FAIL… difficultyMeanAbsBandError fires because difficulty calibration is unmeasured"
(R:p42). Same fact, softer journal framing.
- CONFLICT 1 — Corbett & Anderson year: journal ref [2] "(1994)" (J:p14); report biblio [12] "1995"
(R:p56). Both cite UMUAI vol 4, pp 253–278. The canonical publication year is 1994; PPT must use 1994 and not
copy the report's 1995.
- CONFLICT 2 — Chan et al. item-generation year: journal-refs.bib `itemgen2024` year = 2025, text "(2025)"
(J:p14, bib l33-41); report biblio [6] "2024" (R:p55). Same venue (Computers and Education: AI, vol 8, Art.
100344). PPT must verify year independently before printing; the DOI 10.1016/j.caeai.2024.100344 suggests the
report's 2024 may be the article-year — flag, do not silently pick.
- CONFLICT 3 — EDUCON short-answer author names: journal ref [15] "Duong, T.N.B., Meng, C." (J:p15, bib
l59-66); report biblio [9] "Ta, N. B. D., Chai, Y. M." (R:p55). Same venue/year/pages/DOI
(EDUCON 2024, pp 1–10, doi:10.1109/EDUCON60312.2024.10578839). PPT must verify author spelling independently;
do not copy either without checking.
- Journal-only numbers with no report counterpart (safe to cite with J provenance, all from J:pp6-7, T:l190-192):
generation probe 395 calls / $0.099 / 13 arms; structured-output latency p50 3973ms, p95 10547ms; dip replay
7-of-15 Jev calls; Jev threshold sweep 18/21 agreement (J:p6). Report never states these.
- Report-only numbers the journal drops (do not attribute to the journal): BKT shipped params
pinit 0.15 / plearn 0.1 / pslip 0.05 / pguess 0.2 (R:pp27,36); Wilson/McNemar stats; S:off arm row; telemetry;
0.371 full-denominator coding rate; decidedAt instants (R:p51).

## 4. Best 6–10 citable references for a references slide

Ordered by PPT value. All verified present in journal refs (J:pp13-16) unless noted.

1. Bloom, B.S. — "The 2 sigma problem", Educational Researcher 13(6), 1984 [J:1]. Why: the one-line motivation
for single-learner tutoring; names the gap the loop addresses. Safe — identical in report [27] (R:p56).
2. Corbett, A.T. & Anderson, J.R. — "Knowledge tracing", UMUAI 4(4), 1994 [J:2]. Why: the BKT equation the
system ships. Cite as 1994 per CONFLICT 1; do NOT take the report's 1995.
3. Chen, A.M. et al. — "A hierarchical Bayesian model of adaptive teaching", Cognitive Science 48(7), 2024
[J:3]. Why: prior structure over learners from 2 online experiments (312 adults); justifies few-shot estimation.
4. Zanellati, A. et al. — "Hybrid models for knowledge tracing: a systematic literature review", IEEE TLT 17,
2024 [J:4]. Why: taxonomy showing hybrids beat pure BKT/DKT on correctness prediction — the rejected-arm
evidence for keeping plain BKT.
5. Lewis, P. et al. — "Retrieval-augmented generation for knowledge-intensive NLP tasks", NeurIPS 33, 2020
[J:10]. Why: the RAG foundation under grounded generation. (With Karpukhin et al., DPR, EMNLP 2020 [J:11] as
the dense-arm companion if a second retrieval slot exists.)
6. Cormack, G.V. et al. — "Reciprocal rank fusion", SIGIR 2009 [J:13]. Why: the named fusion (pool 25) behind
the hybrid arm; short, classic, audience-recognizable.
7. Duong/Ta et al. — EDUCON 2024 short-answer rubric grading [J:15]. Why: authority for the written grading
arm. VERIFY author names first per CONFLICT 3; print venue+year only if unsure.
8. Zhang, J. et al. — "Understanding gaming the system… think-aloud protocols", LAK 2026 [J:20]. Why: newest
citation; backs the gated-reveal design (answer-extraction threat). Good "recent work" signal.
9. Alhazbi, S. et al. — SRL measurement systematic review (25 studies), JCAL 40(4), 2024 [J:18]. Why: backs the
adherence-vs-understanding problem statement.
10. Qwen Team — Qwen3-Embedding-0.6B + Qwen3-Reranker-0.6B model cards, HuggingFace 2025 [J:14/J:24]. Why: the
deployed retrieval hardware; shows real stack, not just theory. (Spare: Uzun et al. 2025 feedback-engagement
[J:19] if a feedback slide needs a citation; Piech et al. DKT 2015 [J:6] if naming the rejected deep arm.)

## 5. Stronger / newer / more honest in the journal than the report

- "It spends calls instead of mixing formats" (J:p4, T:l108): the cost-of-provenance stated plainly; the report
never frames the N-call expansion as an explicit price (R:p27 states the shape, not the price).
- "Coding derivability at 0.5349 is the weakest headline number… the first place a fresh corpus would likely
fail" (J:p9, T:l282): sharper than the report's gate-arithmetic framing (R:pp43,47). (But pair it with the
report's 0.371 qualifier — the journal alone is the weaker disclosure here; see section 3.)
- "We prefer less help that stays auditable over more help that confounds the evidence" + "the reveal cannot
substitute for the attempt" (J:p4, T:l126): the assistance-dilemma position in one line; the report spreads it
across Koedinger/VanLehn exposition (R:pp16-17).
- Pre-fix 4/4 holds "report them only as the defect the fix removed, not as a second result" (J:p11, T:l354):
explicit anti-double-counting rule; the report keeps the same numbers but without this sentence (R:p45).
- "A mismatch between paper and code is therefore a defect we can locate" (J:p7, T:l214): reproducibility as
falsifiability claim — punchier than the report's three-facts exposition (R:p36).
- "No result here is read past the design that produced it" (J:p7, T:l216): the scope fence as a method rule;
strongest single honesty line for a limitations slide, complementing the report's threats chapter (R:pp46-47).
- Sourcing note discloses curation-without-screening in the paper body (J:pp4-5, T:l130) rather than the
report's appendix-adjacent methodology subsection (R:p18) — more visible honesty, though the report's
2026-10-23 verification sweep (20 targeted queries) postdates/is absent from the journal; do not claim the
sweep for the journal.
- Newer-feeling threshold evidence: the 18/21 human-agreement sweep for the 0.7 gate (J:p6, T:l174) appears
only in the journal; the report leans on the 0.9→0.7 fix narrative (R:p45). Both true; journal's is the
citable calibration detail.
- Explicit budget-as-claim doctrine ("Every run in this paper has a fixed budget, and the budget is part of
the claim… a repetition beyond these budgets is a new run and not a rerun", J:pp6-7, T:l192): the most
PPT-ready methods line in either document.
