"""Phase-2 ESA deck build. Reads /tmp/pptx-build/work.pptx (copy of source),
writes /tmp/pptx-build/Phase-2-ESA-v1.pptx. Source deck never touched."""
import re
from PIL import Image
from pptx import Presentation
from pptx.util import Pt, Inches, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

NAVY = RGBColor(0x1F, 0x38, 0x64)
RED = RGBColor(0xFF, 0x00, 0x00)
TEAL = RGBColor(0x33, 0xCC, 0xCC)
TREB = 'Trebuchet MS'
SRC = '/tmp/pptx-build/work.pptx'
OUT = '/tmp/pptx-build/Phase-2-ESA-v1.pptx'
SHOT = 'college/mydeliverables/Phase-2-report/phase2-report/screenshots'

prs = Presentation(SRC)
BLANK = prs.slide_layouts[6]
WORD_BUDGET = {}


def words(shape):
    return len(shape.text_frame.text.split())


def set_para(para, align, runs):
    para.alignment = align
    para.clear()
    for text, bold, size in runs:
        r = para.add_run()
        r.text = text
        r.font.bold = bold
        r.font.size = Pt(size)
        r.font.name = TREB
        r.font.color.rgb = NAVY
    return para


def set_body(shape, paras):
    tf = shape.text_frame
    tf.clear()
    first = True
    for align, runs in paras:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        set_para(p, align, runs)
    return shape


def set_heading(shape, text, size=24):
    tf = shape.text_frame
    tf.clear()
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    r = p.add_run()
    r.text = text
    r.font.bold = False
    r.font.size = Pt(size)
    r.font.name = TREB
    try:
        r.font.color.rgb = RED
    except Exception:
        r.font.color.rgb = RED
    return shape


def add_table(slide, left, top, width, rows_data, col_widths, size=12,
              header=True):
    nrows, ncols = len(rows_data), len(rows_data[0])
    g = slide.shapes.add_table(nrows, ncols, left, top, width, Emu(0))
    tbl = g.table
    for i, w in enumerate(col_widths):
        tbl.columns[i].width = w
    for ri, row in enumerate(rows_data):
        for ci, val in enumerate(row):
            cell = tbl.cell(ri, ci)
            cell.text = ''
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = str(val)
            r.font.bold = bool(header and ri == 0)
            r.font.size = Pt(size)
            r.font.name = TREB
            r.font.color.rgb = NAVY
            cell.margin_left = Emu(45720)
            cell.margin_right = Emu(45720)
    return g


def add_box(slide, l, t, w, h, text, size=12, bold=True, fill_white=True):
    sp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                Inches(l), Inches(t), Inches(w), Inches(h))
    sp.text_frame.word_wrap = True
    sp.text_frame.clear()
    p = sp.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.bold = bold
    r.font.size = Pt(size)
    r.font.name = TREB
    r.font.color.rgb = NAVY
    if fill_white:
        sp.fill.solid()
        sp.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    sp.line.color.rgb = NAVY
    sp.line.width = Pt(1.5)
    return sp


def add_arrow_text(slide, l, t, w, h, text='→', size=14):
    tx = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tx.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.bold = True
    r.font.size = Pt(size)
    r.font.name = TREB
    r.font.color.rgb = NAVY
    return tx


def remove_shape(shape):
    shape._element.getparent().remove(shape._element)


def set_notes(slide, text):
    try:
        slide.notes_slide.placeholders[1].text = text
    except Exception as e:
        print('notes failed on slide', slide.slide_id, e)


def pic_aspect(path):
    with Image.open(path) as im:
        return im.width / im.height


L = PP_ALIGN.LEFT

# ---------------- Slide 1: Title ----------------
s = prs.slides[0]
set_para(s.shapes[0].text_frame.paragraphs[0], PP_ALIGN.CENTER,
         [('UE20CS972\u2013  Project Phase \u2013 2', None, 28)])
set_para(s.shapes[0].text_frame.paragraphs[1], PP_ALIGN.CENTER,
         [('End Semester Assessment', None, 36)])
set_body(s.shapes[1], [
    (L, [('Project Title : ', True, 18),
         ('Assessment-Verified Closed-Loop Study Planning', False, 18)]),
    (L, [('Presented by : ', True, 18),
         ('Rohit Saji  (PES2PGE24DS201)', False, 18)]),
    (L, [('Project Guide : ', True, 18),
         ('Prof. Ramesh Prakash Guledgudd', False, 18)]),
    (L, [('Program : ', True, 18),
         ('M.Tech in Data Science and Artifical Intelligence [sic], PES University',
          False, 18)]),
    (L, [('Duration : ', True, 18), ('May 2026 \u2013 Oct 2026', False, 18)]),
])
set_notes(s, 'Name, SRN, guide. One line on what changed since Phase 1: '
             'the open-loop pace planner now closes the loop with '
             'assessment-verified evidence. Degree spelling and duration mirror '
             'the submission guideline; clash flagged to coordinator.')

# ---------------- Slide 2: Agenda ----------------
s = prs.slides[1]
set_heading(s.shapes[2], 'Agenda')
titles = ['Problem Statement', 'Abstract & Scope', 'Literature Survey & Gap',
          'From Phase-1 Review to Phase-2', 'Proposed Methodology',
          'Design Decisions & Constraints', 'Architecture',
          'Technologies & Reproducibility',
          'Results I: Retrieval + Generation',
          'Results II: Mastery + Closed Loop', 'Live Demo', 'References',
          'Delivered, Limits, Next']
paras = s.shapes[1].text_frame.paragraphs
assert len(paras) == 13, len(paras)
for p, t in zip(paras, titles):
    p.runs[1].text = t
set_notes(s, '20-second arc walk: problem, loop, evidence, demo. '
             'Promise honest nulls up front.')

# ---------------- Slide 3: Problem ----------------
s = prs.slides[2]
set_heading(s.shapes[2], 'Problem Statement')
set_body(s.shapes[1], [
    (L, [('Time logs measure hours, not understanding. ', True, 14),
         ('A learner can log hours yet fail assessments while the plan still '
          'reports healthy (report p11-12).', False, 14)]),
    (L, [('Fixed plans go stale. ', True, 14),
         ('A deadline set on day one drifts within days; pace evidence is '
          'sparse and non-stationary, and static planners never revise.',
          False, 14)]),
    (L, [('What Phase 2 adds. ', True, 14),
         ('Assessment-verified evidence \u2014 grounded items, server grades, '
          'mastery tracing \u2014 steers the plan instead of predicted grades.',
          False, 14)]),
])
WORD_BUDGET[3] = 90
set_notes(s, 'Phase-1 pace signal plus the failure it cannot see: '
             'self-reported time never checks learning.')

# ---------------- Slide 4: Abstract & Scope ----------------
s = prs.slides[3]
set_heading(s.shapes[2], 'Abstract and Scope')
set_body(s.shapes[1], [
    (L, [('Full loop delivered. ', True, 15),
         ('One-family grounded generation, per-family server grading, BKT '
          'mastery, and a verdict gate that replans from grades while refusing '
          'what it cannot ground (report p12-13).', False, 15)]),
    (L, [('Scope fence. ', True, 15),
         ('(1) Synthetic histories stand in for a classroom wherever it '
          'matters. (2) Every number traces to frozen evidence or live code. '
          '(3) No learning-gain claim; efficacy is deferred.', False, 15)]),
])
WORD_BUDGET[4] = 90
set_notes(s, 'Read the scope fence aloud; it defuses half the Q&A.')

# ---------------- Slide 5: Literature Survey ----------------
s = prs.slides[4]
set_heading(s.shapes[2], 'Literature Survey')
set_body(s.shapes[1], [
    (L, [('Tracing \u2014 ', True, 12.5),
         ('predicts correctness, not planned-vs-actual pace. We use BKT '
          'bkt-v1 as the updater.', False, 12.5)]),
    (L, [('Generation \u2014 ', True, 12.5),
         ('fluent but untraceable to source chunks. We use one-family-per-call '
          'with recorded citations.', False, 12.5)]),
    (L, [('Grading \u2014 ', True, 12.5),
         ('one signal, or the client decides. We use per-family server '
          'authority; the client stays advisory.', False, 12.5)]),
    (L, [('Guidance \u2014 ', True, 12.5),
         ('measures without helping, or helps by leaking answers. We use a '
          'gated Nudge-to-Reveal ladder.', False, 12.5)]),
    (L, [('Scheduling \u2014 ', True, 12.5),
         ('solved once, never revised from evidence. We close the loop: grades '
          'update mastery, the verdict replans (Table 2.1, p19-20).',
          False, 12.5)]),
])
WORD_BUDGET[5] = 90
set_notes(s, 'One line per family: mechanism, metric, gap. Land on the loop row.')

# ---------------- Slide 6: Phase-1 Review to Phase-2 ----------------
s = prs.slides[5]
set_heading(s.shapes[2], 'Suggestions from Review - 3')
s.shapes[2].text_frame.paragraphs[0].runs[0].text = \
    'From Phase-1 Review to Phase-2'
set_body(s.shapes[1], [
    (L, [('\u2713 Guide ask: LLM-guided practice \u2192 ', True, 14),
         ('Socratic coach with gated reveal (Ch 4, Sec 5.5.4).', False, 14)]),
    (L, [('\u2713 Verified learning \u2192 ', True, 14),
         ('one-family generation plus per-family grading (Ch 4, Sec 5.3).',
          False, 14)]),
    (L, [('\u2713 Mastery estimate \u2192 ', True, 14),
         ('BKT bkt-v1 plus advisory chip (Ch 4, Sec 5.4).', False, 14)]),
    (L, [('\u2713 Closed loop \u2192 ', True, 14),
         ('verdict gate plus replan from grades (Ch 4, Sec 6.3).', False, 14)]),
    (L, [('\u2713 Pace substrate kept \u2192 ', True, 14),
         ('calibration and projection retained as the loop base (Ch 4).',
          False, 14)]),
])
WORD_BUDGET[6] = 80
set_notes(s, 'Show responsiveness; point at chapters, not adjectives. 30 s max.')

# ---------------- Slide 7: Methodology ----------------
s = prs.slides[6]
set_heading(s.shapes[1], 'Proposed Methodology / Approach')
set_body(s.shapes[2], [
    (L, [('Fail-closed gate first. ', True, 13.5),
         ('Fixed golds score each candidate arm; a breached gate blocks '
          'promotion \u2014 difficulty calibration stays advisory by design.',
          False, 13.5)]),
    (L, [('Leg A \u2014 offline harness. ', True, 13.5),
         ('Retrieval, generation, and mastery arms scored on frozen golds '
          '(n=30; 754 and 1094-chunk corpora).', False, 13.5)]),
    (L, [('Leg B \u2014 synthetic replay. ', True, 13.5),
         ('Four archetypes over a 32-day span validate the assembled loop; '
          'the live matrix is deployment-check only (Fig 4.3, p29).',
          False, 13.5)]),
])
WORD_BUDGET[7] = 80
# redrawn two-leg strip (native boxes; grill D6 redraw-for-projection)
y0 = 4.45
add_box(s, 0.35, y0, 1.75, 0.62, 'Leg A: frozen golds', 12)
add_arrow_text(s, 2.12, y0, 0.3, 0.62)
add_box(s, 2.44, y0, 1.75, 0.62, 'Score arms', 12)
add_arrow_text(s, 4.21, y0, 0.3, 0.62)
add_box(s, 4.53, y0, 1.75, 0.62, 'Gate blocks / ships', 12)
add_box(s, 6.60, y0, 1.75, 0.62, 'Fail-closed', 12)
y1 = 5.30
add_box(s, 0.35, y1, 1.75, 0.62, 'Leg B: 4 archetypes', 12)
add_arrow_text(s, 2.12, y1, 0.3, 0.62)
add_box(s, 2.44, y1, 1.75, 0.62, 'Verdict gate', 12)
add_arrow_text(s, 4.21, y1, 0.3, 0.62)
add_box(s, 4.53, y1, 1.75, 0.62, 'Replan from grades', 12)
add_box(s, 6.60, y1, 1.75, 0.62, 'Live matrix: check only', 12)
set_notes(s, 'Fail-closed gate first; then the two legs. The live matrix never '
             'promotes a candidate.')

# ---------------- Slide 8: Design Decisions ----------------
s = prs.slides[7]
set_heading(s.shapes[1], 'Design Approach & Constraints')
set_body(s.shapes[2], [
    (L, [('One family and one question per call \u2014 citations stay '
          'auditable. Authority never transfers to the client (Table 4.1, '
          'p29).', False, 13.5)]),
    (L, [('Budget line: S:off arm $0.00561 at p95 10.5 s; sweep $0.061289; '
          'probe 395 calls at $0.099 (Table 5.5, p36).', False, 12)]),
])
WORD_BUDGET[8] = 80
add_table(s, Inches(2.3), Inches(3.55), Inches(8.9), [
    ['Stage', 'Selected (candidates costed, not mixed)'],
    ['Generation', 'One-family-per-call, citations recorded'],
    ['Grading', 'Per-family server authority; client advisory'],
    ['Tracing', 'BKT bkt-v1; adaptive chip advisory-only'],
    ['Verdict', 'Jev-1.13 judge, gate 0.7, fail-closed to hold'],
], [Inches(2.2), Inches(6.7)])
set_notes(s, '"Spends calls instead of mixing formats." Budgets are part of '
             'the claim.')

# ---------------- Slide 9: Architecture ----------------
s = prs.slides[8]
set_heading(s.shapes[1], 'Architecture')
set_body(s.shapes[2], [
    (L, [('Browser client, FastAPI service plus worker, Supabase hub. Qwen3 '
          'sidecar (:8200) and Piston sandbox (:2000) are separate compose, '
          'never in the request path (Fig 4.4, p30-31).', False, 13)]),
])
WORD_BUDGET[9] = 40
for shp in [sh for sh in list(s.shapes) if sh.shape_type == 13]:
    remove_shape(shp)
add_box(s, 1.15, 3.45, 3.0, 0.95, 'React client\n(bookings, mastery)', 12)
add_arrow_text(s, 4.20, 3.55, 0.55, 0.75, '\u2192')
add_box(s, 4.80, 3.45, 3.4, 0.95, 'FastAPI service + worker\n(generate, grade, verdict)', 12)
add_arrow_text(s, 8.25, 3.55, 0.55, 0.75, '\u2192')
add_box(s, 8.85, 3.45, 3.0, 0.95, 'Supabase hub\n(auth, events, storage)', 12)
add_box(s, 2.60, 4.95, 3.5, 0.95, 'Qwen3 sidecar :8200\n(embed + rerank)', 12)
add_box(s, 7.10, 4.95, 3.5, 0.95, 'Piston sandbox :2000\n(code grading)', 12)
add_arrow_text(s, 1.15, 6.05, 10.7, 0.5,
               'Worker path only \u2014 sidecars are separate compose, '
               'not in the request path', 12)
set_notes(s, 'Request path versus worker path. Sidecars are separate compose.')

# ---------------- Slide 10: Technologies ----------------
s = prs.slides[9]
set_heading(s.shapes[1], 'Technologies Used')
for shp in [sh for sh in list(s.shapes) if sh.shape_type == 13]:
    remove_shape(shp)
set_body(s.shapes[2], [
    (L, [('Frontend \u2014 ', True, 14),
         ('React 19, Vite, TypeScript, Dexie / IndexedDB', False, 14)]),
    (L, [('Intelligence service \u2014 ', True, 14),
         ('FastAPI, Python 3.12, uv; TS/Py parity to 1e-6', False, 14)]),
    (L, [('Data and sidecars \u2014 ', True, 14),
         ('Supabase hub; Qwen3 embed/rerank :8200; Piston :2000', False, 14)]),
    (L, [('Tests \u2014 ', True, 14),
         ('976 pytest + 65 vitest files + 33 Playwright specs; no CI; '
          'X-Request-ID tracing (Tables 5.5/5.6, p36).', False, 14)]),
])
WORD_BUDGET[10] = 80
set_notes(s, 'Reproducibility is falsifiability: a mismatch is a locatable '
             'defect, not a dispute.')

prs.save(OUT)
print('part 1 saved:', OUT)
