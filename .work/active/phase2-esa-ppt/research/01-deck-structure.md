# Deck structure – Phase-1 ESA reordered deck (Lane A)

_Source: `college/mydeliverables/Phase-2-report/Phase-1-ESA-reordered.pptx` (461089 B). All facts below from read-only inspection of a `/tmp` copy via `python-pptx` + raw OOXML (`zipfile`); source deck untouched. Method note: rendered appearance (e.g. whether master footer placeholders paint) cannot be confirmed without rendering; structure is reported as stored._

## 1. Slide inventory (order, titles, narrative arc, words)

_Size: 16:9, 13.33 x 7.50 in (`p:sldSz cx=12192000 cy=6858000`) (all slides). No transitions, no animations/timings on any slide (all 16 `slideN.xml`: no `<p:transition>`, no `<p:timing>`) (slides:1-16). Speaker notes are effectively empty (notes slides hold only slide-number artifacts or nothing) (slides:2-15)._

| # | Title | Arc role | Words |
|---|---|---|---|
| 1 | (title card: course/phase + project title + presenter/guide/program) | Boilerplate title | 40 |
| 2 | Agenda | Map of 03-15 | 47 |
| 3 | Problem Statement | Claim: fixed plans go stale; sparse non-stationary evidence; our loop | 150 |
| 4 | Abstract and Scope | Claim: open-loop adaptive planner + honest evaluation; in/out of scope | 96 |
| 5 | Literature Survey | 5 technique families, each gap + "we use"; loop-closing contribution | 202 |
| 6 | Suggestions from Review - 3 | Guide ask (LLM-guided practice) + 3 self-initiated changes w/ chapter refs | 115 |
| 7 | Proposed Methodology / Approach | The adaptive loop + 3 findings (real win / honest null / validated-not-shipped) | 132 |
| 8 | Design Approach & Constraints | 4 key decisions + constraints/dependencies | 132 |
| 9 | Architecture | 3-tier system + diagram; research tier out of request path | 41 |
| 10 | Design Description & Details | Log-then-calibrate-then-replan sequence + diagram; 4 screens teaser | 96 |
| 11 | Technologies Used | Stack by layer + testing + "why this stack" | 96 |
| 12 | Project Progress | ~92% + per-stream bars + "You are here" + Phase-2 dates | 63 |
| 13 | Live Demo | 4 demo steps + ~6 min seeded account | 78 |
| 14 | References | 11 of 21 refs, base paper flagged | 182 |
| 15 | Any other information | Phase-2 outlook: 4 items + timeline | 110 |
| 16 | Thank You | Closer | 2 |

_Total ~1582 words. Densest: slide:5 (202), slide:14 (182); sparsest content: slide:9 (41), slide:16 (2). Titles above are the right-aligned heading-box text per slide (slides:1-16)._

## 2. Layouts, master, theme, fonts, palette

- _One master_ (`slideMaster1.xml`), _9 layouts defined_ (`slideLayout1-9.xml` = Title Slide, Title and Content, Section Header, Two Content, Comparison, Title Only, Blank, Content with Caption, Picture with Caption), but _every one of the 16 slides points at `slideLayout7.xml` = "Blank"_ (all 16 `slides/_rels/slideN.xml` target `slideLayout7.xml`; `python-pptx` layout[6]='Blank') (slides:1-16). Layouts 1-6, 8, 9 are dead weight from the import.
- _No slide instantiates any placeholder_ (`placeholders=0` on all slides): all content is free text boxes + rectangles, so date/footer/slide-number placeholders exist only on the master/layout, never on slides (slides:1-16).
- _Theme is stock Office_ (`theme1.xml`; master `rId10` -> `theme1.xml`; `theme2/3.xml` present but unreferenced): `lt1=FFFFFF dk1=000000 dk2=44546A lt2=E7E6E6 accent1=4472C4 accent2=ED7D31 accent3=A5A5A5 accent4=FFC000 accent5=5B9BD5 accent6=70AD47 hlink=0563C1 folHlink=954F72`; theme fonts `Calibri Light`/`Calibri` (theme:theme1). _None of the accent colors or theme fonts are actually used_ - every run overrides to `Trebuchet MS`, and all color is inline `srgbClr`: headings `FF0000` (red, 24 pt, right-aligned), body `1F3864` (navy, 12-16 pt, left-aligned) (slides:2-15); slide:1 title 28/36 pt centered red/navy mix; slide:16 "Thank You" 40 pt red right-aligned.
- _Provenance split_: slides 2-6, 12, 14-16 use PowerPoint-native names (`Rectangle N`, `Text Box N`, `Content Placeholder 2`); slides 1, 7-11, 13 use Google-Slides-import names (`Google Shape;N;pM`) (slides:1-16) - consistent with a mixed-origin "reordered" deck.
- _Core props (stale artifacts, not content)_: author `Sunitha R`, last modified by `Sudha B G` 2022-08-20, revision 11; master date placeholder text `8/20/2022` (props, master:slideMaster1).

## 3. Logo, media, tables/charts, text devices

- _Logo_: `ppt/media/image1.png` (176x55 px RGBA, 6801 B, dark thumbnail) is referenced _only by the master_ (`slideMaster1 rels rId11` -> `../media/image1.png`; `<p:pic>` in master at top-right ~0.80x0.25 in, x=9.12 in y=0.11 in, plus a grey `B7B7B7` connector tick beside it) - so it renders on _every slide_ via the master (master:slideMaster1). Identity beyond "small dark top-right logo" cannot be determined without rendering.
- _Slide 9_ uses `ppt/media/image2.png` (2521x1638 px RGB, 356170 B; rendered 6.60x4.29 in at 3.35,2.75) - the architecture diagram (slide:9). _Slide 10_ uses `ppt/media/image3.jpg` (1248x406 px RGB, 49504 B; rendered 8.50x2.77 in at 2.42,4.55) - the sequence/flow diagram (slide:10). Pixel content/semantics of either image cannot be determined from the file (thumbnails read mostly white / warm off-white).
- _Zero tables, zero charts_ in the whole deck (shape census: 16 autoshape + 29 textbox + 2 picture; `has_table=False has_chart=False` everywhere) (slides:1-16). Progress "bars" on slide:12 are inline text (`100% ... 90%`), not charts.
- _Recurring devices_: (a) thin teal rule under every content heading - solid-fill `33CCCC` rectangle 8.33x0.04 in at y~1.73 in (slides:2-15); (b) right-aligned red 24 pt heading box + left-aligned navy body box on every content slide (slides:2-15); (c) agenda numbering `03`-`15` with bold number + regular title runs, left-aligned, 16 pt (slide:2); (d) centered title card + right-aligned "Thank You" closer (slides:1,16). Body sizes vary 12/12.5/13/13.5/14/15/16 pt with no per-level system - free formatting, not a type scale.

## 4. Boilerplate to preserve vs content to replace

- _Preserve (shell)_: slide:1 title-card frame (course/phase line, title, presenter, guide, program slots); slide:2 agenda device (numbered map); slide:13 demo-step frame; slide:14 references frame (base-paper flag + "full bibliography in dissertation" pointer); slide:15 "Any other information" outlook frame; slide:16 closer; master logo + grey tick; teal rule + red-heading/navy-body treatment; 16:9 Blank-layout construction (or rebuild equivalents, since placeholders are unused anyway).
- _Replace (all Phase-1 substance)_: every body claim on slides:3-12 (problem, scope, survey, methodology findings, design, architecture diagram, sequence diagram, stack, progress numbers); slide:6 becomes Phase-2 review-response; slide:12 numbers (~92%, stream bars, "You are here: Phase-1 ESA (Jul 2026)"); slide:15 outlook items; slide:14 ref list (grows with Phase-2 sources); slide:1 metadata (phase,cexam window, SRN/program if changed).
- _Do not carry over_: stale core props author/modifier/date; master `8/20/2022` date text; unused layouts 1-6/8/9 and unreferenced `theme2/3.xml` if rebuilding clean.

## 5. Reusable slide recipes (as built in this deck)

- _Claim_ (slides:3,4,7,8): heading box right + body box left; 3-6 short paragraphs, each opening with a bold claim fragment; ~100-150 words; optional 3-item verdict list (win/null/validated, slide:7).
- _Architecture_ (slide:9): 1-sentence body caption + single centered PNG ~6.6x4.3 in below text; ~40 words of caption.
- _Sequence_ (slide:10): bold `→`-joined one-line pipeline + 2-3 short mechanism notes + single wide JPG ~8.5x2.8 in; ~100 words.
- _Results_ (slides:7,12): headline verdict first ("Real win - ...", "~92%"), then per-item evidence lines with parenthetical pointers (`Holm-surviving`, `Ch 4.4`, percentages); ~60-130 words. No charts exist to copy.
- _Demo_ (slide:13): N numbered one-line steps + time-box + account note ("~6 minutes - seeded demo account"); ~78 words.
- _References_ (slide:14): 12 pt navy, 11 numbered entries, base paper suffixed `(base paper)`, closer line pointing to full bibliography; ~182 words max before overflow.

## 6. Fragility - what breaks if slide count changes

- _Agenda is fully manual_: numbers `03`-`15` are typed bold runs, not fields, and equal physical slide positions (slide:2 vs slides:3-15); inserting/deleting any slide before slide:15 forces hand-renumbering the agenda with no auto-check.
- _No auto slide numbers anywhere_: no slide instantiates the number placeholder and no `<p:fld type="slidenum">` exists at slide level (master only) (slides:1-16, master:slideMaster1) - renumbering is invisible-safe but also unaided.
- _Cross-slide pointers are hardcoded_: `Ch 4.4`, `(Ch 4.3, 6)`, `(Ch 5.2)` (slide:6), `Ch 6`-style refs, `You are here: Phase-1 ESA (Jul 2026)` + `Phase-2 ESA between Sep 20 and Oct 25, 2026` (slide:12) - all must be re-pointed for Phase-2 chapters/dates.
- _Safe_: logo (master-level, position-independent); teal rule/heading treatment (per-slide shapes, no cross-refs); images (slide-local rels `rId3` on slides:9,10); no transitions/animations to re-time; no TOC field or section-marker system beyond the agenda.
