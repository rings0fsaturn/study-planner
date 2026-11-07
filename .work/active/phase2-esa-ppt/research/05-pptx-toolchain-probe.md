# 05 - python-pptx Toolchain Probe (phase2-esa-ppt)

Probe date: 2026-10-24. Library: `python-pptx 1.0.2` via `uv run --with python-pptx --with Pillow` (system python3 has no pptx). All experiment files live in `/tmp/pptx-probe/` (`test.pptx` copy, `out.pptx` result, `replacement.png`, `probe_*.py` scripts, `inspect.txt`). Nothing was written under `college/`.

Source integrity: `sha256sum` of `college/mydeliverables/Phase-2-report/Phase-1-ESA-reordered.pptx` is `8aca0a0906286967eb1d60164b7b8462c0a10368c36cefa97b92d64f547f7af` before AND after the probe (match). `git status --short -- college/` shows no new/modified files from this probe (only pre-existing entries).

Deck facts learned by inspection (`probe_inspect.py`): 16 slides, 13.33x7.5 in (16:9), all on the `Blank` layout. Recipe per content slide: right-aligned red (`FF0000`) 24pt Trebuchet MS heading box, teal (`33CCCC`) solid-fill rule rectangle at `(3048000,1581155)` size `(7620000x36513)` with no line, left navy (`1F3864`) Trebuchet MS body box (`word_wrap=True`, margins 91440/91440/45720/45720). Agenda numbers on slide 2 are typed text runs (`'03   '` bold + title regular), NOT auto-numbering. Slide 9 arch picture: blob 2521x1638 px PNG in a 6035040x3921220 EMU frame (aspects match to 4 dp: 1.5391).

## Checks (29/29 PASS, verified by re-opening out.pptx in `probe_verify.py`)

| # | Check | Result |
|---|---|---|
| 1 | Slide count 16 -> 17, nothing deleted | PASS (17) |
| a1 | Slide 3: new wording present (`Who it hits now.` + `PROBE EDIT`) | PASS |
| a2 | Mixed runs: run0 bold=True, run1 bold=False | PASS |
| a3 | Both runs navy `1F3864` | PASS |
| a4 | Both runs Trebuchet MS | PASS |
| a5 | Original 14pt size kept on both runs | PASS |
| a6 | Neighbor paragraphs untouched | PASS |
| b1 | Agenda numbers now `03..09,11..16` | PASS |
| b2 | Bold flags kept on number runs | PASS |
| b3 | Titles (`Problem Statement` .. `Any Other Information`) intact | PASS |
| c1 | Slide 9 has exactly 1 picture | PASS |
| c2 | New blob is 1600x1200 px | PASS |
| c3 | Still PNG | PASS |
| c4 | Rendered frame aspect == image aspect (1.3333, drift 0) - no stretch | PASS |
| c5 | New frame centered on old frame center (drift 0,0 EMU) | PASS |
| c6 | New frame fully inside old frame bounds | PASS |
| c7 | Slide 9 still has 4 shapes | PASS |
| c8 | Slide 9 body text intact | PASS |
| d1 | New slide at index 12 (slide_id 573) | PASS |
| d2 | Heading `Phase-2 Probe Slide` present | PASS |
| d3 | Heading red + 24pt (304800 EMU) + Trebuchet + right-aligned | PASS |
| d4 | Teal rule at recipe geometry | PASS |
| d5 | Navy body box present | PASS |
| d6 | Exactly 1 table | PASS |
| d7 | Table is 3x3 | PASS |
| d8 | Table values `11..33` as authored | PASS |
| d9 | Old slide 12 (`Project Progress`, id 536) unmoved at index 11 | PASS |
| d10 | Old slide 13 (`Live Demo`, id 572) shifted to index 13 | PASS |
| e | Tail slide still `Thank You` | PASS |

One self-caught harness bug (not a deck issue): first version of check d9 looked for `Project Progress` at index 13; correct expectation is index 11 (insert AFTER slide 12 leaves it in place). Fixed and re-run green.

## Quirks + workarounds

1. **No in-place image swap API.** Setting a picture's blob is unsupported; `add_picture` + deleting the old `pPic` element works. Old blob (`image2.png`, 356 KB) stays orphaned in `ppt/media/` (verified by zip listing: out.pptx carries image2 AND image4). Harmless bloat; for the real build either accept it or strip unused parts post-save.
2. **Replacement stretches unless refit.** `add_picture(path, l, t, w, h)` with both w+h stretches. Workaround: compute fit-inside-old-frame preserving new aspect, center on old center (pattern below). Verified drift 0.
3. **Z-order:** added picture appends to end of shape tree (top). Here the original was already topmost, so order preserved; if replacing a buried image, re-check overlap.
4. **`font.color.rgb` raises** `AttributeError: no .rgb property on color type '_NoneColor'` for theme/unset colors (slide 1 title runs). Verifiers must try/except; setters (`color.rgb = ...`) work fine.
5. **`Slide` has no `.width`;** use `prs.slide_width/slide_height`.
6. **New runs only set `a:latin` typeface;** deck originals set latin+ea+cs+sym. Cosmetically identical in PowerPoint for Latin text; noted for fidelity.
7. **`paragraph.clear()` keeps alignment/level,** drops runs - safe basis for run surgery.
8. **New slide from Blank layout ships 3 placeholder shapes;** delete them before building the recipe, else strays render.
9. **Slide reorder needs the private `_sldIdLst` API** (`remove` + `insert`); slide IDs preserved, no rel breakage observed.
10. **Agenda fragility CONFIRMED:** numbers are manual text, so any insertion forces a manual renumber pass; the regex-on-run[0] rewrite preserves bold/titles and is the pattern to reuse.
11. **Harness gotcha:** never name a probe script `inspect.py` (shadows stdlib `inspect`, breaks lxml import with a circular-import error). Also `Shape` has no `flip_h`, `_Run` has no `_rPr`.
12. **Table default style** is blue-banded `Medium Style 2 Accent 1`; the deck has no tables to match, so set every cell's font explicitly (done: 14pt navy Trebuchet).

## Verified code patterns (each ran green)

(a) Run surgery - clear para, re-add runs with explicit formatting copied from the original size:
```python
para = prs.slides[2].shapes[1].text_frame.paragraphs[1]
size = para.runs[1].font.size
para.clear()
rb = para.add_run(); rb.text = 'Who it hits now. '
rb.font.bold, rb.font.size, rb.font.name, rb.font.color.rgb = True, size, 'Trebuchet MS', NAVY
rr = para.add_run(); rr.text = 'new wording...'
rr.font.bold, rr.font.size, rr.font.name, rr.font.color.rgb = False, size, 'Trebuchet MS', NAVY
```
(b) Agenda renumber - regex only the number run, keep suffix spacing and titles:
```python
bump = {'10':'11','11':'12','12':'13','13':'14','14':'15','15':'16'}  # insert after 09
for p in prs.slides[1].shapes[1].text_frame.paragraphs:
    m = re.match(r'^(\d+)(.*)$', p.runs[0].text)
    if m and m.group(1) in bump:
        p.runs[0].text = bump[m.group(1)] + m.group(2)
```
(c) Image replace - fit new aspect inside old frame, centered, then swap:
```python
nw, nh = old_w, int(old_w / asp)
if nh > old_h: nh, nw = old_h, int(old_h * asp)
nl, nt = old_cx - nw // 2, old_cy - nh // 2
pic._element.getparent().remove(pic._element)
slide.shapes.add_picture(path, nl, nt, width=nw, height=nh)
```
(d) Slide insert - add at end, move via `_sldIdLst`, strip placeholders, build recipe:
```python
ns = prs.slides.add_slide(prs.slide_layouts[6])  # Blank
lst = prs.slides._sldIdLst; items = list(lst)
lst.remove(items[-1]); lst.insert(12, items[-1])
for shp in list(ns.shapes): shp._element.getparent().remove(shp._element)
# heading box: add_textbox + RIGHT + red + Pt(24) + Trebuchet
# rule: add_shape(RECTANGLE, ...) + fill.solid() + fore_color.rgb=TEAL + line.fill.background()
# body: add_textbox + navy Trebuchet; table: add_table(3,3,...) + explicit cell fonts
```

## Verdict: GO

`uv run --with python-pptx` reliably performs every edit class the Phase-2 build needs (styled run surgery, manual agenda renumber, aspect-safe image swap, recipe-conformant slide insert with table, order-preserving insert) with 29/29 programmatic checks green and the source deck byte-identical. Caveats for the real session: accept or strip the orphaned image blob (quirk 1), re-check z-order when replacing non-top images (quirk 3), and guard `.rgb` reads (quirk 4). No `./full-app`, lint, or build was touched per the probe constraints.
