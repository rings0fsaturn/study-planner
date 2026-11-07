"""Phase-2 ESA deck build, part 2: slides 11-16 + appendix A1-A7."""
from pptx import Presentation
from pptx.util import Pt, Inches, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image

NAVY = RGBColor(0x1F, 0x38, 0x64)
RED = RGBColor(0xFF, 0x00, 0x00)
TEAL = RGBColor(0x33, 0xCC, 0xCC)
TREB = 'Trebuchet MS'
OUT = '/tmp/pptx-build/Phase-2-ESA-v1.pptx'
SHOT = 'college/mydeliverables/Phase-2-report/phase2-report/screenshots'
L = PP_ALIGN.LEFT

prs = Presentation(OUT)
BLANK = prs.slide_layouts[6]


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


def add_box(slide, l, t, w, h, text, size=12, bold=True):
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
    sp.fill.solid()
    sp.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    sp.line.color.rgb = NAVY
    sp.line.width = Pt(1.5)
    return sp


def add_arrow_text(slide, l, t, w, h, text='\u2192', size=14):
    tx = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    p = tx.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.bold = True
    r.font.size = Pt(size)
    r.font.name = TREB
    r.font.color.rgb = NAVY
    return tx


def set_notes(slide, text):
    try:
        slide.notes_slide.placeholders[1].text = text
    except Exception as e:
        print('notes failed on slide', slide.slide_id, e)


# ---------------- Slide 11: Results I ----------------
s = prs.slides[10]
set_heading(s.shapes[1], 'Results I: Retrieval + Generation')
set_body(s.shapes[2], [
    (L, [('Rerank lifts recall on both corpora \u2014 descriptively. ', True,
          13),
         ('Hybrid+rerank r@1 0.67 / r@3 0.90 / MRR 0.797 on ACCA-754; deltas '
          '+16 / +17 / +0.139 on DDIA-1094 (Table 6.1, p43).', False, 13)]),
    (L, [('S:off ships 0.9667 schema-valid at 0.7241 gold support ($0.00561, '
          'p95 10.5 s); groundedness 0.8667, self-judged over six question '
          'clusters (p43-44).', False, 13)]),
    (L, [('Footnote: n=30, descriptive; McNemar n.s.; groundedness self-judged '
          '(same model).', False, 11)]),
])
add_table(s, Inches(2.3), Inches(4.35), Inches(8.6), [
    ['Arm (ACCA-754)', 'r@1', 'r@3', 'MRR'],
    ['Dense', '0.60', '0.77', '0.706'],
    ['Hybrid', '0.60', '0.80', '0.720'],
    ['Hybrid + rerank', '0.67', '0.90', '0.797'],
], [Inches(3.4), Inches(1.6), Inches(1.6), Inches(2.0)])
set_notes(s, 'Read the footnotes, not the headlines. Retired 788-split '
             'absolutes never appear.')

# ---------------- Slide 12: Results II ----------------
s = prs.slides[11]
set_heading(s.shapes[1], 'Results II: Mastery + Closed Loop')
set_body(s.shapes[2], [
    (L, [('BKT ties on ranking, nearly halves calibration error: ', True, 13),
         ('live 0.7397 / 0.1401 vs running-proportion 0.7368 / 0.2679 '
          '(Table 6.3, p44).', False, 13)]),
    (L, [('4/4 suggest-replan verdicts convert at confidence 1.0, sufficiency '
          '0.66\u20130.77, over a 32-day span. No fixed-plan control '
          '(Table 6.4, p45).', False, 13)]),
    (L, [('Footnote: parity on ranking is the finding; conversion is '
          'integration behavior, not efficacy.', False, 11)]),
])
add_table(s, Inches(2.3), Inches(4.15), Inches(4.9), [
    ['Model (live)', 'AUC', 'ECE'],
    ['bkt-v1', '0.7397', '0.1401'],
    ['running-proportion', '0.7368', '0.2679'],
], [Inches(2.5), Inches(1.2), Inches(1.2)])
# redrawn verdict-router strip (native; grill D6)
add_box(s, 7.55, 4.15, 1.55, 0.62, 'Week signals', 11)
add_arrow_text(s, 9.12, 4.15, 0.28, 0.62, '\u2192', 12)
add_box(s, 9.42, 4.15, 1.55, 0.62, 'Jev-1.13 judge', 11)
add_box(s, 7.55, 4.95, 1.55, 0.62, 'Gate 0.5 / 0.7', 11)
add_arrow_text(s, 9.12, 4.95, 0.28, 0.62, '\u2192', 12)
add_box(s, 9.42, 4.95, 1.55, 0.62, 'Hold: writes nothing', 11)
add_box(s, 7.55, 5.75, 3.42, 0.62, 'Suggest-replan: copies verdict pair',
        11)
set_notes(s, 'Parity is the finding. Conversion is integration behavior, not '
             'efficacy; pre-fix 4/4 holds were the defect removed.')

# ---------------- Slide 13: Live Demo ----------------
s = prs.slides[12]
set_heading(s.shapes[1], 'Live Demo')
set_body(s.shapes[2], [
    (L, [('Live walkthrough of the running loop (\u00b76 min, seeded '
          'account): ', True, 14),
         ('materials \u2192 generation \u2192 taking/review \u2192 '
          'practice/coach \u2192 evidence trail.', False, 14)]),
    (L, [('Kill-switch: advance to the stills below. ', True, 14),
         ('Fallback stills, left to right: library, generation config, review, '
          'practice run \u2014 Figs 5.1\u20135.4.', False, 14)]),
])
stills = ['app_materials_library.png', 'app_assessment_config.png',
          'app_assessment_review.png', 'app_practice_run.png']
n = len(stills)
strip_top, strip_h = 4.55, 2.05
total_w = 0
dims = []
for f in stills:
    with Image.open(f'{SHOT}/{f}') as im:
        asp = im.width / im.height
    w = strip_h * asp
    dims.append((f, asp, w))
    total_w += w
gap = 0.18
total_w += gap * (n - 1)
x = (13.33 - total_w) / 2
for f, asp, w in dims:
    s.shapes.add_picture(f'{SHOT}/{f}', Inches(round(x, 3)),
                         Inches(strip_top), Inches(round(w, 3)),
                         Inches(strip_h))
    x += w + gap
set_notes(s, '90 s path: one week of one archetype end to end. Fig 5.6 stays '
             'out until re-captured (error state); evidence claim on slide 12 '
             'stands without it.')

# ---------------- Slide 14: References ----------------
s = prs.slides[13]
set_heading(s.shapes[1], 'References')
set_body(s.shapes[2], [
    (L, [('[1] M. Islam et al., Predict-then-optimize study planning, ICCIT, '
          'IEEE, 2024.  (base paper)', False, 12)]),
    (L, [('[2] B.S. Bloom, The 2 sigma problem, Educational Researcher, '
          '1984.', False, 12)]),
    (L, [('[3] A.T. Corbett and J.R. Anderson, Knowledge tracing, UMUAI, '
          '1994.', False, 12)]),
    (L, [('[4] A.M. Chen et al., Hierarchical Bayesian adaptive teaching, '
          'Cognitive Science, 2024.', False, 12)]),
    (L, [('[5] A. Zanellati et al., Hybrid models for knowledge tracing, IEEE '
          'TLT, 2024.', False, 12)]),
    (L, [('[6] P. Lewis et al., Retrieval-augmented generation, NeurIPS, '
          '2020.', False, 12)]),
    (L, [('[7] G.V. Cormack et al., Reciprocal rank fusion, SIGIR, 2009.',
          False, 12)]),
    (L, [('[8] Lecture-to-quiz item generation, Computers and Education: AI '
          '(year pending verification).', False, 12)]),
    (L, [('[9] Short-answer rubric grading, EDUCON, 2024 (authors pending '
          'verification).', False, 12)]),
    (L, [('[10] J. Zhang et al., Think-aloud gaming the system, LAK, 2026.',
          False, 12)]),
    (L, [('Full 31-entry bibliography in the dissertation.', True, 12)]),
])
set_notes(s, 'Bloom to Corbett to RAG/hybrid to rubric to LAK26. Venue+year '
             'fallbacks flagged for verification.')

# ---------------- Slide 15: Delivered, Limits, Next ----------------
s = prs.slides[14]
set_heading(s.shapes[1], 'Any other information')
s.shapes[1].text_frame.paragraphs[0].runs[0].text = 'Delivered, Limits, Next'
set_body(s.shapes[2], [
    (L, [('Delivered. ', True, 13.5),
         ('Closed loop delivered and integrated: grounded generation, server '
          'grading, BKT mastery, verdict replan \u2014 live-verified end to '
          'end (Ch7, p48-50).', False, 13.5)]),
    (L, [('Limits. ', True, 13.5),
         ('Synthetic-only evidence; self-judged groundedness; difficulty '
          'unmeasured; week 5 unobserved; no control arm; harness FAIL gate '
          'stands (Threats, p47).', False, 13.5)]),
    (L, [('Next. ', True, 13.5),
         ('Real-learner study with held-out validation \u2014 the test that '
          'would change the claim \u2014 plus multi-band calibration.',
          False, 13.5)]),
])
set_notes(s, 'End on the test that would change the claim.')

# ---------------- Slide 16: Thank You (keep) ----------------
s = prs.slides[15]
set_notes(s, 'Q&A; backup slides ready.')


# ---------------- Appendix builder ----------------
def new_appendix(title, paras, size=13):
    ns = prs.slides.add_slide(BLANK)
    for shp in list(ns.shapes):
        shp._element.getparent().remove(shp._element)
    head = ns.shapes.add_textbox(Inches(2.08), Inches(1.25), Inches(9.58),
                                 Inches(0.5))
    set_heading(head, title)
    rule = ns.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(3.33),
                               Inches(1.73), Inches(8.33), Inches(0.04))
    rule.fill.solid()
    rule.fill.fore_color.rgb = TEAL
    rule.line.fill.background()
    body = ns.shapes.add_textbox(Inches(2.17), Inches(1.92), Inches(9.0),
                                 Inches(5.17))
    set_body(body, paras)
    ns._element.set('show', '0')
    return ns, body


a, _ = new_appendix('Caveats', [
    (L, [('Week 5 not observed for all four archetypes (n.o.) \u2014 0.000 '
          'marks an unobserved week, never measured zero (p46, A.1 p51).',
          False, 13)]),
    (L, [('Harness gate reads FAIL by design: difficultyMeanAbsBandError '
          'fires because difficulty calibration is unmeasured (p42, p47).',
          False, 13)]),
    (L, [('Groundedness 0.8667 is self-judged: generator and judge share the '
          'same model over six question clusters; no independent rerun or '
          'human audit (p43, p47).', False, 13)]),
    (L, [('Coding gate clears only on the judged pair: 0.5349 judged vs 0.371 '
          'full-denominator; never quote 0.5349 alone (p43-44, p47).', False,
          13)]),
    (L, [('Written cutoff 0.6/0.10 shipped on a met-class of two pairs; '
          'train split favoured 0.7 (p44).', False, 13)]),
    (L, [('No fixed-plan control arm: 4/4 conversions are integration '
          'behavior, not efficacy (p46-47).', False, 13)]),
])
set_notes(a, 'Show only when asked. Full honesty sheet.')

a, abody = new_appendix('Verdict instants', [
    (L, [('Per-user decidedAt values, post-fix replay: all four converted '
          '(Table A.2, p52).', False, 13)]),
])
add_table(a, Inches(2.3), Inches(2.9), Inches(8.6), [
    ['User', 'Verdict', 'decidedAt', 'Converted'],
    ['steady', 'suggest_replan', '2026-10-14T12:00:11.235Z', 'yes'],
    ['crammer', 'suggest_replan', '2026-10-14T12:00:07.156Z', 'yes'],
    ['struggling', 'suggest_replan', '2026-10-14T12:00:07.606Z', 'yes'],
    ['returning', 'suggest_replan', '2026-10-14T12:00:07.515Z', 'yes'],
], [Inches(1.8), Inches(2.0), Inches(3.1), Inches(1.7)], size=12)
set_notes(a, 'Provenance only.')

stems = [
    'What does it mean for a data system to be reliable?',
    'What is the difference between a fault and a failure?',
    'How does the book define scalability?',
    'What does operability mean as an aspect of maintainability?',
    'What does schema flexibility mean in the document model?',
    'What are the roots of the relational model?',
    'What drove the adoption of NoSQL databases?',
    'Why are declarative query languages preferred over imperative APIs?',
    'What is an advantage of SSTables over log segments with hash indexes?',
    'How do B-trees and LSM-trees compare on read performance?',
    'How common are secondary indexes in relational databases?',
    'How does leader-based replication work?',
    'What guarantee prevents reading stale data after your own write?',
    'What is the biggest problem with multi-leader replication?',
    'When can quorum reads generally expect the most recent value?',
    'How does skew affect batch jobs?',
    'What is consistent hashing?',
    'Where does the acronym ACID come from?',
    'What is the most basic transaction isolation level?',
    'Which isolation level is named in the chapter on weak isolation?',
    'How strong is serializable isolation?',
    'What extra element appears in distributed transactions compared to '
    'single-node ones?',
    'What does the FLP result prove about consensus?',
    'What does consistency mean in the CAP theorem?',
    'What illusion does linearizability give?',
    'What technique orders events across leaders?',
    'What is a batch processing system?',
    'What is the difference between event time and processing time?',
    'Who questioned the lambda architecture?',
    'What does exactly-once mean for stream processing?',
]
qparas = [(L, [('DDIA second-corpus gold set, 30 question stems verbatim '
                '(Table A.3, p52-54). Answer snippets live in the '
                'dissertation.', False, 11)])]
for i, q in enumerate(stems, 1):
    qparas.append((L, [(f'{i:2d}. {q}', False, 9)]))
a, _ = new_appendix('DDIA golds', qparas)
set_notes(a, 'Corpus-rigor proof. Full stems plus answer snippets in Table '
             'A.3.')

a, _ = new_appendix('Rerun contract', [
    (L, [('Hold these fixed (Table 5.5, p36):', True, 13)]),
    (L, [('\u2022 Chunks ~400 tokens / ~30 overlap; 768-d Qwen3 sidecar '
          'embeddings; top-5 owner-scoped chunks per call; top-50 candidates '
          'before rerank.', False, 12)]),
    (L, [('\u2022 Generation temp 0.3, reasoning off, 30 s timeout, 4096 max '
          'output tokens; at most one repair.', False, 12)]),
    (L, [('\u2022 BKT p_init 0.15, p_learn 0.1, p_slip 0.05, p_guess 0.2; loop '
          'gates evidence 0.5 / confidence 0.7.', False, 12)]),
    (L, [('\u2022 Golds: 30 objective + 6 written + 4 coding; attempt gate K=5 '
          'over 3 fold hashes.', False, 12)]),
])
set_notes(a, 'A repetition beyond these budgets is a new run, not a rerun.')

a, _ = new_appendix('Test inventory', [
    (L, [('Engineering rigor behind the delivered code (Table 5.6, p36; '
          'counts collected 2026-10-23):', True, 13)]),
    (L, [('\u2022 976 pytest tests across 57 files (intelligence service).',
          False, 13)]),
    (L, [('\u2022 65 vitest files (app plus engines); 37 hook plus 77 '
          'feedback tests passing.', False, 13)]),
    (L, [('\u2022 33 Playwright spec files; 11 harness pure-function unit '
          'tests.', False, 13)]),
    (L, [('\u2022 No CI gate; coverage not measured.', False, 13)]),
])
set_notes(a, 'No CI is the disclosed gap.')

a, _ = new_appendix('Budgets', [
    (L, [('Every run has a fixed budget, and the budget is part of the claim '
          '(report p44; journal p6-7):', True, 13)]),
    (L, [('\u2022 S:off delivered arm: $0.00561, latency p95 10.5 s.',
          False, 13)]),
    (L, [('\u2022 S-layer sweep aggregate: $0.061289 over 361 requests.',
          False, 13)]),
    (L, [('\u2022 Generation probe: 395 calls at $0.099 across 13 arms.',
          False, 13)]),
    (L, [('\u2022 Structured-output latency p50 3973 ms / p95 10547 ms; dip '
          'replay used 7 of 15 Jev calls.', False, 13)]),
])
set_notes(a, 'Budgets are claims; beyond-budget is a new run.')

a, _ = new_appendix('Pre-fix contrast', [
    (L, [('Report only as the defect the fix removed, never as a second '
          'result (p45):', True, 13)]),
    (L, [('\u2022 Pre-fix replay: 4/4 hold at confidence 0.18\u20130.34 on '
          'span-zero neutral inputs.', False, 13)]),
    (L, [('\u2022 Input fix opened states; confidence 1.0 would also clear the '
          'old 0.9 gate.', False, 13)]),
    (L, [('\u2022 Gate moved 0.9 \u2192 0.7; 0.8 candidate rejected after a '
          'live 0.79 sample fell in the 0.79\u20130.85 band.', False, 13)]),
    (L, [('\u2022 Dip replay: 4/4 hold at 0.28\u20130.35; Sep-12 pin flips one '
          'archetype without clearing the gate.', False, 13)]),
])
set_notes(a, '"Not a second result."')

prs.save(OUT)
print('part 2 saved:', OUT, 'slides:', len(prs.slides.__iter__.__self__._sldIdLst))
