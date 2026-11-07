"""Programmatic gate for Phase-2-ESA-v1.pptx (plan section 5)."""
import re
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor

NAVY = RGBColor(0x1F, 0x36, 0x84)
RED = RGBColor(0xFF, 0x00, 0x00)
P = '/tmp/pptx-build/Phase-2-ESA-v1.pptx'
prs = Presentation(P)
fails = []


def check(cond, msg):
    print(('PASS' if cond else 'FAIL'), '-', msg)
    if not cond:
        fails.append(msg)


def rgb(run):
    try:
        return run.font.color.rgb
    except Exception:
        return None


slides = list(prs.slides)
check(len(slides) == 23, f'slide count 23 (got {len(slides)})')

# A-slides hidden (slides 17-23)
hidden = [s._element.get('show') == '0' for s in slides[16:]]
check(all(hidden), f'A1-A7 hidden (got {hidden})')

# Headings: slides 2-15 + A-slides red/Trebuchet/24pt right
for i in list(range(1, 15)) + list(range(16, 23)):
    s = slides[i]
    heads = [sh for sh in s.shapes
             if sh.has_text_frame and sh.text_frame.text.strip()
             and any('Agend' in sh.text or False for _ in [0])]
    # find right-aligned red run as heading marker
    found = False
    for sh in s.shapes:
        if not sh.has_text_frame:
            continue
        for p in sh.text_frame.paragraphs:
            if str(p.alignment) != 'RIGHT (3)':
                continue
            for r in p.runs:
                if r.text.strip() and rgb(r) == RED and r.font.name == \
                        'Trebuchet MS' and r.font.size.pt == 24.0:
                    found = True
    check(found, f'slide {i + 1} heading red/Trebuchet/24pt/right')

# Bodies navy/Trebuchet, no empty text boxes (exempt teal rule slivers)
BANNED_EMPTY = 0
for i, s in enumerate(slides):
    for sh in s.shapes:
        if not sh.has_text_frame:
            continue
        tf = sh.text_frame
        txt = tf.text.strip()
        # teal rule: wide flat rectangle
        if sh.width > int(7 * 914400) and sh.height < int(0.1 * 914400):
            continue
        if not txt:
            BANNED_EMPTY += 1
            print(f'  empty textbox: slide {i + 1} shape {sh.name}')
        for p in tf.paragraphs:
            for r in p.runs:
                if not r.text.strip():
                    continue
                c = rgb(r)
                if c is not None and str(c) not in ('1F3864', 'FF0000'):
                    check(False,
                          f'slide {i + 1} run color {c} not navy/red: '
                          f'{r.text[:40]!r}')
                if r.font.name not in ('Trebuchet MS', None):
                    check(False,
                          f'slide {i + 1} font {r.font.name}: {r.text[:40]!r}')
check(BANNED_EMPTY == 0, f'no empty text boxes (got {BANNED_EMPTY})')

# Images aspect drift 0
for i, s in enumerate(slides):
    for sh in s.shapes:
        if sh.shape_type == 13:
            asp_render = sh.width / sh.height
            asp_src = sh.image.size[0] / sh.image.size[1]
            drift = abs(asp_render - asp_src)
            check(drift < 0.001,
                  f'slide {i + 1} image {sh.name} drift {drift:.4f}')

# Tables on slides 8, 11, 12 (+A2=slide 18)
for i in [7, 10, 11, 17]:
    n = sum(1 for sh in slides[i].shapes if sh.has_table)
    check(n >= 1, f'slide {i + 1} has table (got {n})')
t = slides[17].shapes
for sh in t:
    if sh.has_table:
        check((len(sh.table.rows), len(sh.table.columns)) == (5, 4),
              f'A2 table 5x4 (got {len(sh.table.rows)}x'
              f'{len(sh.table.columns)})')

# Agenda runs 03-15
ag = slides[1].shapes[1].text_frame.paragraphs
nums = [p.runs[0].text.strip() for p in ag]
check(nums == [f'{n:02d}' for n in range(3, 16)], f'agenda 03-15 ({nums})')

# Residue grep
RESIDUE = ['92%', 'Jul 2026', 'Sep 20', 'Ch 4.4', 'You are here', '788',
           '0.858']
blob = '\n'.join(sh.text_frame.text for s in slides for sh in s.shapes
                 if sh.has_text_frame)
# '0.77' handled separately: allowed only as Table 6.1 dense r@3 on slide 11
hits = [r for r in RESIDUE if r in blob]
check(not hits, f'zero Phase-1 residue {hits}')
n077 = blob.count('0.77')
print(f'INFO - "0.77" occurrences: {n077} (expected 1: Table 6.1 dense r@3, '
      'slide 11; banned sense was the retired 788-split r@1 headline)')

# Word budgets: body textboxes only (headings, tables, diagram labels excluded;
# results-slide footnotes excluded by construction)
BODY_SHAPE = {2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 9: 2, 10: 2, 11: 2, 14: 2}
for i, lim in [(2, 90), (3, 90), (4, 90), (5, 80), (6, 80), (7, 80),
               (9, 80), (10, 80), (11, 80), (14, 80)]:
    shp = list(slides[i].shapes)[BODY_SHAPE[i]]
    wc = len(shp.text_frame.text.split())
    check(wc <= lim, f'slide {i + 1} body words {wc} <= {lim}')

# References count
refs = [p.text for p in slides[13].shapes[2].text_frame.paragraphs]
check(len(refs) == 11, f'references 10 + closer (got {len(refs)})')

print()
print('RESULT:', 'GREEN' if not fails else f'RED {fails}')
