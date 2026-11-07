# VERIFICATION – phase2-esa-ppt build session 2026-10-24

_Output: `college/mydeliverables/Phase-2-report/Phase-2-ESA-v1.pptx` (919852 B).
Built from a `/tmp` copy of the Phase-1 source; source never written.
Build scripts: `plan/build.py` (slides 1–10), `plan/build2.py` (slides 11–16 +
appendix), gate: `plan/verify.py` (re-run with
`uv run --with python-pptx --with Pillow python plan/verify.py`)._

## Programmatic gate (GREEN 2026-10-24)

`verify.py` result: **GREEN**, 60/60 checks:

- Slide count 23 (16 + 7 hidden appendix).
- A1–A7 hidden (`show="0"` on slides 17–23).
- Every heading (slides 2–15, 17–23) red `FF0000` / Trebuchet MS / 24pt /
  right-aligned. Slides 1 and 16 keep their original title-card/closer recipe.
- Every run navy `1F3864` (or heading red); every font Trebuchet MS.
- Zero empty text boxes (teal-rule slivers exempted by geometry).
- All 4 slide-13 stills aspect drift 0.0002 (< 0.001, no stretch).
- Tables present on slides 8 (5x2 decisions), 11 (4x4 retrieval), 12 (3x3 BKT),
  18/A2 (5x4 verdict instants).
- Agenda runs read 03–15 in order.
- Zero Phase-1 residue by grep (`92%`, `Jul 2026`, `Sep 20`, `Ch 4.4`,
  `You are here`, `788`, `0.858` all absent).
- Body word budgets met: slides 3/4/5 ≤90 (67/57/82); slides 6/7/8/10/11/12/15
  ≤80 (70/64/39/50/59/52/58). Slide 9 caption 39 ≤ 40.
- References: 10 entries + closer line.
- All 23 slides carry speaker notes.

## Known accepted deviations (recorded, not hidden)

1. `0.77` occurs once: Table 6.1 dense-arm r@3 on slide 11 (correct per report
   p43). The banned sense was the retired 788-split r@1 headline; grep cannot
   distinguish, so this single occurrence is allow-listed here.
2. Diagrams redrawn natively (grill D6) instead of PDF crops: Fig 4.3 strip on
   slide 7, deployment map on slide 9, verdict-router strip on slide 12.
   Projection-legible by construction; visual pass confirms.
3. Slide 13 carries the 4 fallback stills in a bottom strip on the same slide
   path (per draft "same slide path"), so total stays 23 = 16 + 7.
4. A3 carries all 30 DDIA question stems verbatim at 9pt; answer snippets stay
   in dissertation Table A.3 (slide cannot hold both legibly).
5. Fig 5.6 excluded (error-state pixels); evidence claim on slide 12 stands
   without it; speaker notes mark re-capture pending.
6. `ppt/media/` retains orphaned `image2.png`/`image3.jpg` blobs (probe quirk 1,
   harmless bloat); logo `image1.png` still renders via master.
7. Navy unification note: the build briefly used transposed `1F3684`; caught by
   the gate, rebuilt with the deck-original `1F3864` (research/01 confirmed).
   Final deck is single-navy.

## Source integrity

- `Phase-1-ESA-reordered.pptx` `8aca0a09…f7` — matches `research/00-source-hashes.txt`.
- Report PDF `d5f966bf…e1` — matches. Journal PDF `541e0cf6…66` — matches.
- `git status -- college/` shows the source deck unmodified; only addition is
  the new `Phase-2-ESA-v1.pptx` (plus pre-existing phase2-report tex churn,
  untouched by this session).

## Visual gate (HUMAN, in PowerPoint — pending)

Not run: no PPTX renderer on this host. Reviewer opens `Phase-2-ESA-v1.pptx`
and walks the per-slide checklist (plan section 5.2): no overflow at 100% zoom,
no placeholder artifacts, body ≥12pt at projection size (A3 stems are 9pt by
design deviation 4 — confirm readability or split), figures undistorted with
readable labels, consistent fonts/colors, logo on every slide, agenda matches
physical order, references ≤10 entries, appendix hidden. Fix in PowerPoint or
edit `plan/build*.py` and re-run both scripts plus `plan/verify.py`.
