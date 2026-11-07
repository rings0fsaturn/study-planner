# pptx-deck

Reliable PowerPoint copy-and-edit with python-pptx. Use for any task that reads or modifies a `.pptx` deck in this repo: structural inspection, styled text surgery, image swaps, slide inserts, agenda renumbers.

There is no installed `pptx` skill on this host; this skill IS the verified path (probe: 29/29 checks green, 2026-10-24, findings in `.work/active/phase2-esa-ppt/research/05-pptx-toolchain-probe.md`).

## Toolchain

- Run everything with `uv run --with python-pptx --with Pillow python <script>.py`. System python3 has no pptx module. Never install packages globally.
- For raw OOXML (theme, masters, layouts, media inventory) use stdlib `zipfile` on the `.pptx` — no dependency needed.

## Guardrails (never skip)

1. NEVER edit the source deck. `cp` it to `/tmp/<task>/work.pptx` first; all writes go to the copy. Output files get new names (e.g. `Phase-2-ESA-v1.pptx`).
2. Record `sha256sum` of the source before and after; they must match.
3. Confirm `git status --short -- college/` shows no new/modified files from your work.
4. Never name a script `inspect.py` (shadows stdlib `inspect`, breaks the lxml import).

## This repo's deck recipe (Phase-1 ESA spine)

- 16:9 (`prs.slide_width` = 12192000 EMU); every slide uses the Blank layout (`prs.slide_layouts[6]`).
- Content slide = right-aligned red (`FF0000`) 24pt Trebuchet MS heading box + teal (`33CCCC`) solid-fill rule rectangle at `(3048000,1581155)` size `(7620000x36513)`, no line + left navy (`1F3864`) Trebuchet MS body box (`word_wrap=True`, margins 91440/91440/45720/45720).
- Body sizes vary 12-16pt with no type scale; copy the original run's size when editing.
- Agenda numbers are typed text runs (bold number + regular title), NOT auto-numbering — any insert/delete forces a manual renumber pass.
- New slides from Blank ship 3 placeholder shapes; delete them before building the recipe.

## Verified patterns

Run surgery (clear para keeps alignment; re-add runs with explicit formatting):
```python
size = para.runs[1].font.size
para.clear()
rb = para.add_run(); rb.text = 'Lead fragment. '
rb.font.bold, rb.font.size, rb.font.name, rb.font.color.rgb = True, size, 'Trebuchet MS', NAVY
```

Agenda renumber (regex the number run only, keep suffix spacing and bold):
```python
for p in slide.shapes[1].text_frame.paragraphs:
    m = re.match(r'^(\d+)(.*)$', p.runs[0].text)
    if m and m.group(1) in bump:
        p.runs[0].text = bump[m.group(1)] + m.group(2)
```

Image swap (no in-place blob API; fit new aspect inside the old frame, centered):
```python
nw, nh = old_w, int(old_w / asp)
if nh > old_h: nh, nw = old_h, int(old_h * asp)
slide.shapes.add_picture(path, old_cx - nw // 2, old_cy - nh // 2, width=nw, height=nh)
# then remove the old pPic element
```

Slide insert (add at end, move via `_sldIdLst`, strip placeholders, build recipe):
```python
ns = prs.slides.add_slide(prs.slide_layouts[6])
lst = prs.slides._sldIdLst; items = list(lst)
lst.remove(items[-1]); lst.insert(index, items[-1])
```

Tables: set every cell font explicitly (default style is blue-banded, nothing to match). Guard `.rgb` READS with try/except (theme/unset colors raise); setters work fine. Re-check z-order when replacing a non-top image.
