# Lane D - Deck Constraints and Asset Inventory (phase2-esa-ppt)

Source rule: every claim carries path provenance. No requirement is stated unless the source states it.

## 1. Submission-guideline constraints relevant to the DECK

**Plain finding: none of the three inputs states any deck rule.**
No duration, slide cap, file format, file naming, deadline/date, softcopy/hardcopy, or demo requirement for a slide deck appears in any of them.
Everything below is a REPORT rule, listed so the deck author does not mistake it for a deck rule.

### 1a. INFO.txt (`college/mydeliverables/Phase-2-report/INFO.txt`, 13 lines)

- Chairperson: Dr. Sandesh B J; Dean of Faculty: Dr. Keshavan B K; Chancellor: Prof. Jawahar Doreswamy; Vice Chancellor: Dr. Suryaprasad J (INFO.txt:1-4).
- Guide designation follows current designation, faculty title not compulsory (INFO.txt:5).
- Journal: softcopy, single column, IEEE format (INFO.txt:8-10). This is the journal/paper track, not the deck.
- Report: softcopy submitted in Olympus; hardcopy to be sent (INFO.txt:12-13).
- Deck content in INFO.txt: zero lines.

### 1b. Guideline HTML (`college/mydeliverables/Phase-2-report/MTech project report submission guideline.html`)

Report-only. Verified by grep: zero hits for slide/deck/ppt/powerpoint/present/demo/minutes across the whole file (bash grep, 2026-10-24).
Report rules it does state (deck column = "not stated"):

| # | Report rule (with provenance) | Deck analogue stated? |
|---|---|---|
| 1 | Subject code UE20CS972 for Phase-2 (guideline.html:266) | No |
| 2 | Hard-copy submission is a pre-requisite for sitting in the Phase 2 ESA Review; result declared after all deliverables + reviews (guideline.html:272, 346-348) | No - note: eligibility gate is the REPORT hard copy, not a deck |
| 3 | Strictly follow the sample Phase 2 ESA Report template shared on Olympus (guideline.html:284) | No |
| 4 | Report at least 40 pages excluding first page, Certificate, Declaration (guideline.html:285) | No page/slide minimum or cap for any deck |
| 5 | Degree name "Master of Technology in Data Science and Artifical Intelligence" [sic - copy as-is] (guideline.html:287) | No deck title-slide rule, but reuse this spelling on the title slide for consistency |
| 6 | Front-page duration "May 2026 to Oct 2026" (guideline.html:290) - CONTRADICTED by the Note item "July 2025 - December 2025" (guideline.html:349). See Sec 4. | No deck duration rule |
| 7 | Print on only one side; Justify text (guideline.html:293, 296) | No |
| 8 | Mentor digital signature on Certificate; own digital signature on Declaration (guideline.html:299, 302) | No |
| 9 | Plagiarism <= 15%, send to pesu.eclib@pes.edu CC anurag.s@greatlearning.in, mentor + coordinator approval (guideline.html:305) | No |
| 10 | Hard binding light cream (not yellowish); 1 hard copy to Anurag Sah, Great Learning HQ, HSR Layout Bangalore + location link (guideline.html:312, 327-335) | No |
| 11 | No submission deadline/date stated anywhere in the guideline | No deck deadline either |

### 1c. Sample PDF (`college/mydeliverables/Phase-2-report/phase-2-sample-to-follow.pdf`, via `pdftotext -layout` + `pdfinfo` ONLY)

- 58 pages, letter (612x792 pts), pdf-lib producer, unencrypted (pdfinfo).
- A REPORT template: ransomware-detection dissertation, CSE program, UE19CS651, Jan-May 2021 (pdftotext head).
- Structure: front matter + certificate + declaration + acknowledgement + abstract + TOC, then CHAPTER-1 INTRODUCTION, CHAPTER-2 Literature Survey, CHAPTER-3 PROJECT REQUIREMENTS SPECIFICATION, CHAPTER-4 PROPOSED METHODOLOGY, CHAPTER-5 IMPLEMENTATION DETAILS AND PSEUDOCODE, CHAPTER-6 RESULTS AND DISCUSSION, CHAPTER-7 CONCLUSION AND FUTURE WORK, references to p48+ (pdftotext CHAPTER grep + tail).
- Targeted greps for slide/deck/ppt/powerpoint/minute/duration/naming/deadline/softcopy/hardcopy/binding/plagiarism: zero deck-relevant hits. The only "deadline" hit is ransomware-payment prose; "presents" hits are chapter prose ("This chapter presents the results"). No deck guidance of any kind.
- Deck-vs-report verdict for the sample: report template only; nothing reusable as a deck constraint.

### 1d. Precedent (not a constraint)

`college/mydeliverables/Phase-2-report/Phase-1-ESA-reordered.pptx` (461089 bytes, PowerPoint 2007+, 16 content slides via zip slide count) is the Phase-1 ESA deck and the only in-repo deck precedent.
Slide arc (slide XML text extraction): 1 title (UE20CS971, Adaptive Study Planning) / 2 agenda / 3 problem / 4 scope / 5 literature-calibration / 6 guide feedback / 7 methodology / 8 design constraints / 9 architecture / 10 sequence / 11 tech stack / 12 progress / 13 live demo / 14 references / 15 phase-2 outlook / 16 thank-you.
Precedent only - no authority claims a Phase-2 deck must match it.

## 2. Asset inventory

Dimensions via `file` command (PIL unavailable in this env). Sizes via `ls -la`.

### 2a. Phase-2 report screenshots (`college/mydeliverables/Phase-2-report/phase2-report/screenshots/`) - uniform 1280x900 RGB captures, 2026-10-22

| File | Dims | Bytes | Report fig | What it proves | Verdict |
|---|---|---|---|---|---|
| `app_materials_library.png` | 1280x900 | 91511 | Fig 5.1 (`fig:appshot1`, 05-implementation.tex:214-216) | Material library: ready cards offer Practice, failed card keeps badge + retry (caption 05-implementation.tex:215) | FINAL - reuse in deck |
| `app_assessment_config.png` | 1280x900 | 112332 | Fig 5.2 (`fig:appshot2`, :226-228) | Generation config: one material, one family, one scoped chapter per question (caption :227) | FINAL - reuse |
| `app_assessment_review.png` | 1280x900 | 143251 | Fig 5.3 (`fig:appshot3`, :238-240) | Taking/review: server grade with per-criterion rubric feedback (caption :239) | FINAL - reuse |
| `app_practice_run.png` | 1280x900 | 112175 | Fig 5.4 (`fig:appshot4`, :250-252) | Practice run: lazily resolved question + anchored Socratic coach (caption :251) | FINAL - reuse |
| `app_roadmap_evidence.png` | 1280x900 | 134321 | Fig 5.6 (`fig:appshot5`, :277-279) | Feedback/loop evidence trail + advisory recommendation (caption :278) | NEEDS RE-CAPTURE (see 2c) |

Fig 5.5 (`fig:appflow5`, 05-implementation.tex:260-273) is an inline TikZ 5-node flow strip (Materials -> Generation -> Taking/review -> Practice/guide -> Feedback/loop), not a raster. FINAL (Batch 6 merged five flow figures into this one; phase2-report plan :313).

### 2b. Phase-1 screenshots (`college/mydeliverables/Phase-2-report/phase1-report/screenshots/`) - planner substrate, unchanged per 05-implementation.tex:203

| File | Dims (`file`) | Bytes | Verdict |
|---|---|---|---|
| `app_home.png` | 2560x2912 | 319314 | Usable for 1-slide Phase-I recap if needed; full-page portrait, crop to 16:9 |
| `app_onboarding_plan.png` | 1056x1922 | 149825 | STALE-SUSPECT: odd narrow size vs the 2560-wide set; different capture setup; avoid unless re-captured |
| `app_replan.png` | 2560x1600 | 193742 | Usable; 16:10, minor crop |
| `app_roadmap.png` | 2560x2594 | 230197 | Usable; full-page portrait, crop |
| `app_roadmaps.png` | 2560x1766 | 161411 | Usable; crop |
| `app_session.png` | 2560x1600 | 177561 | Usable; 16:10 |
| `app_week.png` | 2560x1770 | 156756 | Usable; crop |

### 2c. Known open item: Fig 5.6 re-capture

- `app_roadmap_evidence.png` currently shows a CITATION_UNVERIFIED error state plus a 0/20 score; needs a clean live re-capture (phase2-report SCRATCHPAD:101; phase2-report plan 2026-10-23-examiner-review-rating-10-plan.md:313 "Partial: Figure 5.6 still shows the CITATION_UNVERIFIED error state (needs live re-capture); screenshots not cropped/enlarged").
- Task-level mirror: phase2-esa-ppt research/02-report-evidence.md:82, :105 and state.md:9 / SCRATCHPAD.md:15 carry the same flag ("VISIBLE AS RISK", "do not enlarge blindly").
- Deck consequence: do NOT put the current Fig 5.6 pixels on a large-format slide; either re-capture first or omit that screenshot and show the Fig 5.5 TikZ flow strip instead.

### 2d. Vector figures (no pixel dims - 1-page pdfTeX PDFs)

- `phase1-report/arch_initial.pdf` (48707 B, 1pp) + `arch_revised.pdf` (72309 B, 1pp): Phase-1 methodology architecture, included at 04-methodology.tex:116, :127. FINAL vectors; re-exportable from `arch_initial.tex` / `arch_revised.tex`.
- Phase-2 Ch4 figures are inline TikZ in `phase2-report/chapters/04-methodology.tex` (`fig:guide-ladder` :44-45, `fig:verdict-router` :67-68, `fig:comparison-pipeline` :111-112, `fig:architecture` :170-171 with Batch-6 protocol edge labels). FINAL; no standalone PDFs to inventory.
- Delivered report PDF `phase2-report/ROHITSAJI-PES2PGE24DS201-REPORT.pdf`: 57 pages, pdfTeX-1.40.29, LaTeX+hyperref (pdfinfo). Ch5 app figs at PDF p37-41 per research/02-report-evidence.md:12.

### 2e. Non-assets (do not use in deck)

- `frontpage-color.png` (386x456) + `frontpage-sample.jpeg` (720x1280): report binding/front-page references (2025-09-24). Not deck assets.
- `PESU-new-logo.png` (155x72 colormap): report logo; deck should use the higher-res `phase1-report/PESU-new-logo.png` if a logo is wanted (check before use - not verified here).
- `e2e/` top-level holds 33 Playwright spec files + a `pdf/` fixture dir; no app screenshots live in `e2e/` root (ls e2e/). The `e2e/pdf/` textbook fixtures (incl. the 572-page volume per rule 16) are test inputs, not deck visuals.

## 3. Conflicts and stale assets

1. Guideline duration contradiction (REPORT rule, affects title slide if mirrored): "May 2026 to Oct 2026" (guideline.html:290) vs "July 2025 - December 2025" (guideline.html:349). Deck recommendation: use May 2026-Oct 2026 (matches the live report) and flag the contradiction to the coordinator; do not invent a third value.
2. Fig 5.6 error-state capture (Sec 2c) - the only confirmed stale pixel asset.
3. Screenshots "not cropped/enlarged" Batch-6 partial (plan :313): all five Phase-2 PNGs ship at 1280x900 inside a `0.85\linewidth x 0.42\textheight keepaspectratio` LaTeX box - fine for print, but verify browser chrome/whitespace before blowing any of them full-slide.
4. `app_onboarding_plan.png` size outlier (1056x1922 vs 2560-wide siblings) - suspect different device/viewport; treat as stale until re-captured.
5. Guideline degree-name typo "Artifical" (guideline.html:287) - reproduce exactly on formal slides; do not silently "fix".
6. Sample PDF program mismatch: CSE/UE19CS651 Jan-May 2021 vs our DS-AI/UE20CS972 May-Oct 2026 - structural reference only; no front-matter values carry over.

## 4. Live-demo screenshot strategy (no runtime started, per lane constraints)

- STILLS-FIRST: four of five Phase-2 stills are final at 1280x900 (1.42:1 - near 16:9, minimal crop). Build every demo-dependent slide from stills; nothing in the inputs requires a live demo, and the Phase-1 precedent's "Live Demo" slide (slide13) is precedent, not a requirement.
- ONE re-capture session, not five: the only mandatory live work is the Fig 5.6 clean capture (CITATION_UNVERIFIED fix). Batch it with optional 16:9 crops of the other four + a fresh onboarding capture to retire the 1056-wide outlier, in a single browser session, then freeze pixels.
- Do not start `./full-app` from this lane; re-capture belongs to whoever owns the runtime lane (Vite watcher is unreliable on /mnt/d per rule 53 - restart before capturing).
- Fallback if no re-capture slot exists: drop the Fig 5.6 screenshot, keep its caption claim on the Fig 5.5 TikZ flow slide, and mark the slide "screenshot pending re-capture" in speaker notes only.
