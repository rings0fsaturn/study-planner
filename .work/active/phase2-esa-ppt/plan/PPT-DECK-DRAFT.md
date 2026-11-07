# PPT Deck Draft – Phase-2 ESA (plan, not the deck)

_Source of truth: `college/mydeliverables/Phase-2-report/phase2-report/ROHITSAJI-PES2PGE24DS201-REPORT.pdf` (57pp, 2026-10-23). Journal: `college/mydeliverables/phase2-journal/ROHITSAJI-PES2PGE24DS201-JOURNAL.pdf` (16pp). Structure reference only: `Phase-1-ESA-reordered.pptx` (16 slides, Blank layout throughout, Trebuchet, red/navy + teal rule, master logo). No deck rules exist in INFO.txt, the guideline HTML, or the sample PDF (research/04). Every number below carries its report page; conflicts are flagged, never silently resolved._

## Deck thesis

Phase 1 built an open-loop planner that adapts to pace but never checks learning; Phase 2 closes the loop with assessment-verified evidence — one-family grounded generation, per-family server grading, BKT mastery, and a verdict gate that replans from grades while refusing what it cannot ground — and evaluates the assembled loop honestly on frozen evidence with all nulls disclosed.

## The 3 messages the examiner must remember

1. **The contribution is the loop itself** — generated items are graded per family, grades update mastery, the verdict steers the plan, and every step cites its evidence (report p18 Fig 2.1, p26).
2. **The numbers are descriptive and disclosed, not oversold** — rerank lifts recall on both corpora but McNemar is n.s. at n=30; groundedness is self-judged; coding clears the gate only on the judged pair; BKT ties on ranking while halving calibration error; 4/4 verdicts convert with no control arm (report p42-47).
3. **No learning gain is claimed** — synthetic single-learner evidence only, week 5 unobserved, difficulty unmeasured, harness gate reads FAIL by design; efficacy is deferred to a real-learner study (report p47, p49-50).

## Slide-by-slide table (FINAL: 16 + appendix — grill-locked 2026-10-24)

_Grill changes vs the 17-row proposal: old slide 10 (Loop in Motion) folded away — its verdict-router figure moves to slide 12; everything shifts up. Agenda lists 03–15 for slides 3–15, same device as Phase-1. Slide 13 is live-demo-primary with stills fallback. All content slides Blank layout, ≤90 words, qualifier footnotes on results slides._

| No. | Working title | Single message | Evidence (report page) | Proposed visual | Speaker-note gist | Reuse Phase-1 | Density |
|---|---|---|---|---|---|---|---|
| 1 | Title | Phase-2 ESA: verified-learning loop on the Phase-1 planner; UE20CS972, May-Oct 2026 | Cover/front matter p1-5 | Title card, same frame as slide 1 | Name, SRN, guide; one-line what changed since Phase 1 | adapt | 40 words |
| 2 | Agenda | 14 stops: problem → loop → evidence → demo → limits | — (map of this deck) | Numbered map, same device as slide 2 | Walk the arc in 20 seconds; promise honest nulls | adapt | 45 words |
| 3 | Problem Statement | Time logs measure hours, not understanding; fixed plans go stale | Ch1 p11-12 | Claim slide; 3 short paragraphs | Phase-1 pace signal + the failure it cannot see | adapt | ≤90 words |
| 4 | Abstract & Scope | Full loop delivered; synthetics replace a classroom study wherever it matters | Ch1 p12-13, scope p13 | Claim slide; scope fence as 3 bullets | Read the scope fence aloud; it defuses half the Q&A | adapt | ≤90 words |
| 5 | Literature Survey & Gap | Five families + gap table: fluent but untraceable, single-signal grades, help that leaks answers | Table 2.1 p19-20, Ch2 p14-20 | Gap table (report Table 2.1, simplified for projection) | One line per family: mechanism, metric, gap; land on the loop row | adapt | ≤90 words |
| 6 | From Phase-1 Review to Phase-2 | Every Phase-1 review ask became a shipped, tested loop stage | Ch4.4 p30 (was: guide feedback slide 6) | Checklist: ask → where it lives now (chapter pointer each) | Show review responsiveness; point at chapters, not adjectives | change | ≤80 words |
| 7 | Proposed Methodology | Five-stage closed loop, evaluated two ways: frozen-gold harness + synthetic longitudinal replay | Fig 4.3 p29, Ch4 p26-30 | Two-leg pipeline figure (Fig 4.3) | Fail-closed gate first, then the two legs; live matrix never promotes a candidate | adapt | ≤80 words |
| 8 | Design Decisions & Constraints | One family per call (provenance costs calls); per-family authority; advisory difficulty; fixed budgets | Table 4.1 p29, Table 5.5 p36 (subset) | Decisions table (candidates → selected, report Table 4.1 condensed) | "Spends calls instead of mixing formats"; budgets are part of the claim | adapt | ≤80 words |
| 9 | Architecture | Browser + FastAPI service/worker + Supabase hub + Qwen3 sidecar + Piston sandbox | Fig 4.4 p30-31 | Architecture figure (Fig 4.4, redrawn/simplified for projection) | Request path vs worker path; sidecars are separate compose, not request path | adapt | ≤40 words caption |
| 10 | The Loop in Motion | Grade → mastery/verdict → replan: the judge proposes, the code gate disposes | Fig 4.2 p28 + Fig 5.5 flow strip p40 | Verdict-router diagram + 5-stage strip | Walk one week of one archetype end to end; hold writes nothing | adapt | ≤80 words |
| 10 | Technologies & Reproducibility | Pinned stack, frozen hyperparams, request-id tracing, 976 + 65 + 33 tests, no CI | Tables 5.5/5.6 p36, Ch5 p32-36 | Stack by layer (same recipe as slide 11) + 3-line test inventory | Reproducibility = falsifiability; mismatch is a locatable defect | adapt | ≤80 words |
| 11 | Results I: Retrieval + Generation | Rerank lifts recall on both corpora (descriptive, n=30); S:off ships 0.9667/0.7241; groundedness 0.8667 self-judged | Tables 6.1/6.2 p43-44 | Two annotated mini-tables with n=30 + n.s. footnotes | Read the footnotes, not just the headlines; retired 788 absolutes never appear | change (was progress ~92%) | ≤80 words + footnotes |
| 12 | Results II: Mastery + Closed Loop | BKT ties ranking, halves calibration error; judge proposes, code gate disposes; 4/4 verdicts convert at conf 1.0 with no control | Tables 6.3/6.4 p44-45, Fig 4.2 p28 | Headline pair (0.7397/0.1401; 4/4) + verdict-router diagram + sufficiency range | Parity is the finding; conversion is integration behavior, not efficacy | new | ≤80 words + footnotes |
| 13 | Live Demo / Delivered System | The loop runs live; stills prove it if the network fails: materials → generation → taking/review → practice/coach → evidence trail | Figs 5.1-5.4 p37-40 (Fig 5.6 excluded until re-captured) | Live walkthrough + 4 numbered stills as fallback on the same slide path | 6-minute path; narrate what each screen proves; kill-switch = advance to stills | adapt | ≤80 words |
| 14 | References | 10 short anchors (Corbett 1994; venue+year-only ×2 pending check); full 31-entry bibliography lives in the dissertation | Biblio p55-57, journal shortlist research/03 §4 | References frame (base paper flagged, "full bibliography in dissertation") | Bloom → Corbett → RAG/hybrid → rubric → recent LAK26 | adapt | ≤10 entries, 12pt |
| 15 | Delivered, Limits, Next | Loop delivered and integrated; limits listed; next = real-learner study with held-out validation | Ch7 p48-50, Threats p47 | Delivered/limits/next three blocks (was: Phase-2 outlook) | End on the test that would change the claim | change | ≤80 words |
| 16 | Thank You | Closer | — | Same closer as Phase-1 slide 16 | Q&A; backup slides ready | yes | 2 words |

## Grill decisions applied (all 10 locked 2026-10-24, see grill.md)

- D1: ESA panel, 10–12 min talk (~40–45 s/slide), 16 + hidden appendix.
- D2: 70/30 research-led; app is existence proof.
- D3: Live demo primary (online exam, own system); 4 stills as in-deck fallback; Fig 5.6 re-capture still required for the deck.
- D4: One-slide Phase-1 recap (slide 6); Phase-1 numbers banned.
- D5: Qualifier footnote on every results slide; full caveats in backup A1.
- D6: Reuse 4 final stills; retake only Fig 5.6; redraw TikZ diagrams for projection.
- D7: Copy-on-copy build with the verified `pptx-deck` skill (GO, 29/29); source deck never written.
- D8: Appendix A1–A7 hidden; 10-entry references; Q&A ammo = 8 examiner flashpoints (research/02 §5).
- D9: Output `Phase-2-ESA-v1.pptx`; title slide mirrors guideline spelling "Artifical" [sic] + May–Oct 2026; clash flagged to coordinator.
- D10: Corbett & Anderson 1994 on-slide; Chan year + EDUCON authors venue+year-only until verified.
- No unresolved branches. Nothing deliberately left open.

## Keep / change / drop vs the Phase-1 16-slide spine

- Keep: title frame (1), agenda device (2), demo frame (14), references frame (15), closer (17/16), master logo + teal rule + red/navy treatment, 16:9 Blank-layout construction.
- Change: problem/scope/survey/methodology/design/architecture/sequence/stack slides (3-5, 7-11) get Phase-2 bodies on the same recipes; review-response slide (6) becomes Phase-1→Phase-2 mapping; progress slide (12, "~92%") becomes Results I; outlook slide (15/16) becomes delivered/limits/next.
- Drop: all Phase-1 numbers (~92%, stream bars, "You are here: Phase-1 ESA Jul 2026", Phase-2 dates Sep 20-Oct 25 2026), both Phase-1 diagrams (replaced by Figs 4.4/4.2/5.5), stale core props (author Sunitha R, 8/20/2022 date), unused layouts 1-6/8/9 and theme2/3 if rebuilding clean.
- New: Results II (mastery + closed loop) has no Phase-1 ancestor; backup appendix is new.

## Phase-2 additions the Phase-1 deck cannot carry

1. Verified-learning loop concept (Fig 2.1) and verdict router (Fig 4.2).
2. One-family generation + per-family grading authority + refusal path.
3. Practice runs + Socratic ladder + gated reveal.
4. Closed-loop evidence: 4/4 conversions, dip replay, adherence emission.
5. Final results with nulls: retrieval deltas, groundedness, coding pair, BKT parity, FAIL gate.
6. Limitations + threats + deferred efficacy stated on-slide.

## Backup / appendix candidates

- A1 Honesty sheet: week 5 n.o., FAIL gate, self-judged groundedness, n=2 written cutoff, full-denominator 0.371 (p42-47, A.1 p51).
- A2 Verdict instants Table A.2 (p52).
- A3 DDIA golds Table A.3 (p52-54, corpus rigor).
- A4 Hyperparameters Table 5.5 (p36, rerun contract).
- A5 Test inventory Table 5.6 (p36).
- A6 Cost/latency budgets: S:off $0.00561/10.5s vs sweep $0.061289; probe 395 calls/$0.099 (p44, journal p6-7).
- A7 Pre-fix contrast 4/4 holds at 0.18-0.34 (p45, defect-removed framing).
- A8 Fig 5.6 clean capture (only after re-capture; never the error-state pixels).

## Do-not-include list

- Full FR-1..FR-15 / NFR-1..NFR-9 lists; hardware/software tables.
- Full Table 5.5 hyperparameters; statistical machinery (Wilson/McNemar formulas).
- Any Phase-1 result, date, or diagram.
- Retired 788-split absolutes (0.77/0.97/0.858) except one labeled precedent footnote at most.
- Vaswani citation via the journal (dangling cite, research/03 §2).
- Week-5 0.000 as measured data; 0.5349 without 0.371; groundedness without self-judged disclosure.
- Fig 5.6 error-state pixels; 1056-wide onboarding still.

## OPEN decisions (feed the grill; recommendations are mine)

- OPEN-1 Audience, time limit, slide cap. No deck rule exists in any input (research/04 §1). Recommendation: assume ESA panel + 10-12 min talk, hold 16 + appendix until the coordinator says otherwise.
- OPEN-2 Story ratio: research contribution vs product demo. Recommendation: 70/30 research-led; the loop is the contribution, the app is its existence proof.
- OPEN-3 Demo mode: live app vs recorded walkthrough vs stills. Recommendation: stills-first (4 final PNGs exist); one batched re-capture session for Fig 5.6 only if schedule allows; no live dependency on exam day.
- OPEN-4 Phase-1 recap depth. Recommendation: one slide max (slide 6 carries it: review asks → shipped stages); no Phase-1 numbers anywhere.
- OPEN-5 Results honesty: which nulls on-slide. Recommendation: every results slide carries its qualifier footnote (n=30 descriptive, McNemar n.s., self-judged, judged-pair gate, no control, week 5 n.o.); full caveats live in backup A1.
- OPEN-6 Figure strategy: reuse vs re-capture vs simplify. Recommendation: reuse 4 final stills + TikZ vectors (Figs 4.2/4.3/4.4/5.5 redrawn for projection size); re-capture only Fig 5.6; drop it if no slot.
- OPEN-7 Build strategy: clone Phase-1 theme vs fresh build on the same master. Recommendation: clone on a COPY — same Blank-layout construction, Trebuchet, red/navy + teal rule, master logo — because the visual language is panel-familiar; rebuild clean only if layout debt bites.
- OPEN-8 Backup slides, references policy, Q&A ammunition. Recommendation: appendix A1-A7; references = 10-entry shortlist (research/03 §4) with venue+year-only fallback where authorship conflicts are unresolved; Q&A ammo = the 8 examiner flashpoints (research/02 §5).
- OPEN-9 Naming, branding, handover. Recommendation: output `Phase-2-ESA-v1.pptx` (copy, never overwrite source); title slide reuses guideline degree-name spelling "Artifical" [sic] and May-Oct 2026 duration with the contradiction flagged to the coordinator, not silently fixed.
- OPEN-10 Citation conflicts (report vs journal). Recommendation: Corbett & Anderson 1994 (canonical, journal right); Chan item-gen year and EDUCON authors VERIFY before printing (DOI evidence cuts both ways) — default to venue+year-only on the slide if unverified. Per task authority rule the report is otherwise preferred; these three go to the user.
