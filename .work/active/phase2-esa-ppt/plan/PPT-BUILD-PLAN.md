# PPT Build Plan – Phase-2 ESA (cold-start executable)

_Who: a fresh session with zero report knowledge. Read ONLY this file + `.agents/skills/pptx-deck/SKILL.md` + the research/ files it points to. Do NOT re-read the 57pp report unless a number below looks wrong — every claim below already carries its page._

## 0. Target and budget

- Output: `college/mydeliverables/Phase-2-report/Phase-2-ESA-v1.pptx` (new file; the source `Phase-1-ESA-reordered.pptx` is NEVER written).
- 16 slides + 7 hidden appendix slides (A1–A7). Talk: 10–12 min → ~40–45 s/slide; slide 13 (demo) gets 90 s, borrowed from slide 6 (30 s).
- Density: ≤90 words per content slide; results slides 11–12 add one footnote line each (footnotes don't count).

## 1. Exact slide list (all Blank layout = `prs.slide_layouts[6]`; Trebuchet; red FF0000 24pt right heading; teal 33CCCC rule; navy 1F3864 body)

| # | Title | Text budget | Visual | Speaker notes (say this) |
|---|---|---|---|---|
| 1 | Title | 40 words | Copy of Phase-1 card; swap phase/dates/title. Degree line copies guideline spelling "Artifical" [sic]; duration May–Oct 2026. | Name, SRN, guide; one line on what changed since Phase 1. |
| 2 | Agenda | 45 words | Same numbered device; entries 03–15 = slides 3–15 (manual text runs). | 20-second arc walk; promise honest nulls. |
| 3 | Problem Statement | ≤90 | Claim slide; 3 short paragraphs (report p11-12). | Phase-1 pace signal + the failure it cannot see. |
| 4 | Abstract & Scope | ≤90 | Claim slide; scope fence as 3 bullets (report p12-13). | Read the scope fence aloud. |
| 5 | Literature Survey & Gap | ≤90 | Simplified gap table from report Table 2.1 (p19-20); 5 families. | One line per family: mechanism, metric, gap. |
| 6 | From Phase-1 Review to Phase-2 | ≤80 | Checklist: review ask → shipped stage + chapter pointer (Ch4.4 p30). | Show responsiveness; point at chapters. 30 s max. |
| 7 | Proposed Methodology | ≤80 | Two-leg pipeline figure = crop of report Fig 4.3 (p29). | Fail-closed gate first; live matrix never promotes a candidate. |
| 8 | Design Decisions & Constraints | ≤80 | Condensed candidates→selected table from report Table 4.1 (p29) + 1 budget line (Table 5.5 p36). | "Spends calls instead of mixing formats." |
| 9 | Architecture | ≤40 caption | Deployment figure = redraw/crop of report Fig 4.4 (p30-31). Replaces old image2. | Request path vs worker path; sidecars are separate compose. |
| 10 | Technologies & Reproducibility | ≤80 | Stack-by-layer text (same recipe as Phase-1 slide 11) + 3-line test inventory (976 / 65 / 33, Table 5.6 p36). | Mismatch is a locatable defect. |
| 11 | Results I: Retrieval + Generation | ≤80 + footnote | Two mini-tables: Table 6.1 row (0.67/0.90/0.93/0.797, n=30) + S:off row (0.9667/0.7241, $0.00561) + groundedness 0.8667 self-judged (report p43-44). Footnote: "n=30, descriptive; McNemar n.s.; groundedness self-judged." | Read the footnotes, not the headlines. |
| 12 | Results II: Mastery + Closed Loop | ≤80 + footnote | Headline pair (0.7397/0.1401 vs 0.7368/0.2679) + verdict-router diagram (Fig 4.2 p28) + 4/4 conversions, conf 1.0, suff 0.66–0.77 (Tables 6.3/6.4 p44-45). Footnote: "parity on ranking; no fixed-plan control." | Conversion is integration behavior, not efficacy. |
| 13 | Live Demo / Delivered System | ≤80 | Live walkthrough primary; 4 fallback stills on hidden duplicate (Figs 5.1–5.4). | 90 s path; kill-switch = advance to stills. |
| 14 | References | ≤10 entries 12pt | Base paper flagged + "full bibliography in dissertation". Corbett 1994; Chan + EDUCON venue+year-only. | Bloom → Corbett → RAG/hybrid → rubric → LAK26. |
| 15 | Delivered, Limits, Next | ≤80 | Three blocks: delivered / limits / next (Ch7 p48-50, Threats p47). | End on the test that would change the claim. |
| 16 | Thank You | 2 words | Same closer. | Q&A; backups ready. |
| A1 | Caveats (hidden) | — | Honesty sheet: week 5 n.o.; FAIL gate; self-judged; judged-pair gate; n=2 cutoff; no control (p42-47, A.1 p51). | Show only when asked. |
| A2 | Verdict instants (hidden) | — | Table A.2 decidedAt values (p52). | Provenance only. |
| A3 | DDIA golds (hidden) | — | Table A.3, 30 questions verbatim (p52-54). | Corpus-rigor proof. |
| A4 | Rerun contract (hidden) | — | Table 5.5 hyperparameters (p36). | "Hold these fixed." |
| A5 | Test inventory (hidden) | — | Table 5.6 counts (p36). | Engineering rigor. |
| A6 | Budgets (hidden) | — | S:off $0.00561/10.5s; sweep $0.061289; probe 395 calls/$0.099 (report p44; journal p6-7). | Budgets are claims. |
| A7 | Pre-fix contrast (hidden) | — | 4/4 holds at 0.18–0.34, defect-removed framing (p45). | "Not a second result." |

## 2. Asset manifest

| Asset | Path | Provenance | Size | Crop / treatment | Caption | Status |
|---|---|---|---|---|---|---|
| Materials still | `phase2-report/screenshots/app_materials_library.png` | Fig 5.1, report p37 | 1280x900 | Near-16:9, minimal crop; verify chrome | Ready cards offer Practice; failed card keeps badge | FINAL |
| Generation still | `phase2-report/screenshots/app_assessment_config.png` | Fig 5.2, report p38 | 1280x900 | Same | One material, one family, one chapter | FINAL |
| Review still | `phase2-report/screenshots/app_assessment_review.png` | Fig 5.3, report p39 | 1280x900 | Same | Server grade + rubric feedback | FINAL |
| Practice still | `phase2-report/screenshots/app_practice_run.png` | Fig 5.4, report p40 | 1280x900 | Same | Lazy question + anchored coach | FINAL |
| Evidence still | `phase2-report/screenshots/app_roadmap_evidence.png` | Fig 5.6, report p41 | 1280x900 | RE-CAPTURE ONLY (current pixels show error state) | Evidence trail + advisory recommendation | STALE — §5 |
| Loop pipeline | Crop from report PDF p29 via `pdftoppm -png -r 150 -f 29 -l 29` | Fig 4.3 | vector→raster | Tight crop on figure; redraw if text <14pt at full slide | Two-leg comparison | OK as crop |
| Verdict router | Crop from report PDF p28 | Fig 4.2 | vector→raster | Same | Judge proposes, code disposes | OK as crop |
| Architecture | Crop from report PDF p30-31 | Fig 4.4 | vector→raster | Same; may need 2-slide split if dense | Deployment map | OK as crop |
| Logo | Master-embedded `image1.png` (keep via copy-on-copy) | deck master | 176x55 | None | — | KEEP |

## 3. Evidence table (claim → report page → journal page)

| Claim on slide | Report | Journal |
|---|---|---|
| Time logs ≠ understanding; plans go stale | p11-12 | J:p1 |
| One-family-per-call; authority never transfers to client | p26-27 | J:p3-4 |
| Rerank +7 r@1 / +10 r@3, MRR 0.797 (n=30, McNemar n.s.) | p42-43 Table 6.1 | J:pp7-8 Table 3 |
| DDIA +16/+17/+0.139 (absolutes not cross-comparable) | p42-43 | J:p8 |
| S:off 0.9667/0.7241, $0.00561, p95 10.5s | p43-44 Table 6.2 | — (report only) |
| Groundedness 0.8667 self-judged, 6 clusters | p43-44, p47 | J:p9 (report qualifier wins) |
| Coding 0.5349 judged / 0.371 full; gate clears judged-only | p43-44, p47 | J:p9 (0.5349 only; report qualifier wins) |
| Written cutoff 0.6/0.10 shipped; train 0.7 rejected (met-class n=2) | p44 | — (report only) |
| Harness FAIL: difficultyMeanAbsBandError, difficulty unmeasured | p42, p47 | J:p6 (softer wording; report wins) |
| BKT live 0.7397/0.1401 vs 0.7368/0.2679; bake-off 0.785/0.057 | p44 Table 6.3 | J:pp9-10 Table 5 |
| 4/4 convert, conf 1.0, suff 0.66–0.77, 32-day span; pre-fix 4/4 hold | p45 Table 6.4 | J:pp10-11 Table 6 |
| Dip replay 4/4 hold at 0.28–0.35; week 5 n.o. | p46, p51 Table A.1 | J:p11 |
| Live matrix 2/2, 4/4, 3/3…; full-book ~88 s wall | p45 | J:p12 |
| Tests 976 + 65 + 33; no CI; hyperparams Table 5.5 | p36 Tables 5.5/5.6 | J:pp6-7 (budgets) |
| No learning-gain claim; efficacy deferred | p47, p49-50 | J:pp12-13 |
| Corbett & Anderson 1994 (report prints 1995 — journal wins per D10) | p56 [12] | J:p14 [2] |

## 4. Toolchain (decided; fallback included)

- Primary: `.agents/skills/pptx-deck/SKILL.md` (verified GO 2026-10-24, 29/29 checks; probe log `research/05-pptx-toolchain-probe.md`). Run via `uv run --with python-pptx --with Pillow python <script>.py`; raw OOXML via stdlib `zipfile`.
- Fallback (same library, no new dependency): the SKILL.md patterns ARE the fallback — agenda regex, image fit-swap, `_sldIdLst` insert. Last resort: hand touch-up in PowerPoint.
- Theme reuse: work ONLY on a `/tmp/` copy of the source; Blank layout `prs.slide_layouts[6]`; Trebuchet everywhere; red `FF0000` headings 24pt right; navy `1F3864` body; teal `33CCCC` rule at `(3048000,1581155)` size `(7620000x36513)`; master logo untouched.
- Forbidden: global installs; editing the source deck; files named `inspect.py`; committing the output before the visual pass.

## 5. Render-and-inspect (no LibreOffice on this host)

1. Programmatic gate (must pass): re-open the output with python-pptx and assert slide count 23 (16+7), every heading red/Trebuchet/24pt, every body navy/Trebuchet, no empty text boxes, every image aspect drift = 0, tables present on slides 8/11/12, agenda runs read 03–15, and a text grep finds zero Phase-1 residue (`92%`, `Jul 2026`, `Sep 20`, `Ch 4.4`, `You are here`, `788`, `0.77`, `0.858`).
2. Visual gate (human, in PowerPoint — the reviewer reads PPTX natively): open `Phase-2-ESA-v1.pptx`, walk the per-slide checklist: no overflow (text inside boxes at 100% zoom), no placeholder artifacts, legible body ≥12pt at projection size, figures undistorted with readable labels, consistent fonts/colors, logo on every slide, agenda matches physical order, references ≤10 entries, appendix hidden.
3. Record both gates in the build session's VERIFICATION log before handover.

## 6. Ordered execution steps (each independently verifiable; stop on red)

1. Baseline: `sha256sum` all three sources (expect deck `8aca0a09…f7`, report `d5f966bf…e1`, journal `541e0cf6…66`; full values in `research/00-source-hashes.txt`); `cp` deck to `/tmp/pptx-build/work.pptx`. Verify: hashes match, work file opens at 16 slides.
2. Slides 1–2: title metadata + agenda 03–15. Verify: re-open, assert texts.
3. Slides 3–8: claim run-surgery per SKILL.md pattern (a). Verify: wording + bold/color/size asserts.
4. Slides 9 + 12 diagrams: fit-swap image2→Fig 4.4 crop; insert Fig 4.2 on slide 12 per pattern (c). Verify: aspect drift 0, centered.
5. Slides 7, 8, 11, 12 tables: condense Tables 4.1/6.1/6.2/6.3 to ≤5 rows each with footnote lines. Verify: cell values + footnotes present.
6. Slide 13 + fallback stills: text + 4 PNG swaps on a hidden duplicate. Verify: 1 picture per fallback.
7. Slides 14–16 + A1–A7: references (Corbett 1994; 2× venue+year-only), closer, appendix. Verify: count 23 slides; A-slides hidden.
8. Fig 5.6 re-capture (ONLY step needing runtime): `./full-app status full` → start if needed → capture clean evidence-trail 1280x900 → stop runtime → swap into slide 13 fallback set. If no slot: drop Fig 5.6, keep caption claim on slide 12, note "pending" in speaker notes.
9. Gates: run §5 programmatic gate, then user visual pass. Fix → re-run gates.
10. Ship: save as `college/mydeliverables/Phase-2-report/Phase-2-ESA-v1.pptx`; re-hash all three sources (must match §6 baseline); `git status` shows source deck unmodified.

## 7. Rollback

- Source deck is never written; every run starts from a fresh `/tmp/` copy. A bad run is deleted, not repaired. Output versions increment (`-v1`, `-v2`); never overwrite a handed-over file.

## 8. Definition of done + self-review

- Done: `Phase-2-ESA-v1.pptx` exists; 16 + 7 hidden slides; programmatic + visual gates green; zero Phase-1 residue by grep; source hashes unchanged; VERIFICATION log written; STATUS/state updated.
- Self-review pass: re-read each slide against its evidence-table row; every number must trace to the cited page; every qualifier footnote present; conflicts D10 honored (1994; 2× venue+year-only); Fig 5.6 either clean or absent.
