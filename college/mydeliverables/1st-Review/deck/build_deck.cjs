const pptxgen = require("pptxgenjs");
const path = require("path");

const DIR = __dirname;
const ARCH = path.join(DIR, "assets", "architecture_horizontal.png");
const LOGO = path.join(DIR, "..", "report", "pes_logo.png");

// ---- deck palette (matches first-guidance-call-deck.pptx) ----
const TEAL = "0F3D3E", TEALM = "3D7068", GOLD = "C9974B", GOLDF = "F2E4C6";
const SLATE = "5B6770", INK = "1A1A1A", CREAM = "F7F5F0", SAND = "D7D2C5";
const PALET = "D9E4E2", GREEN = "2E7D5B", WHITE = "FFFFFF", GREY = "9CA3AF";
const GREYT = "8A8A82", GREYF = "ECEAE3";
const HF = "Calibri", BF = "Calibri";
const W = 10, H = 5.625, M = 0.5;
const FOOT = "Adaptive Study Planning  ·  Rohit Saji  ·  First Review (Phase I)";

function footer(P, slide, n) {
  slide.addText(FOOT, { x: M, y: H - 0.34, w: 7.5, h: 0.25, fontFace: BF, fontSize: 8, color: SLATE, align: "left", valign: "middle", margin: 0 });
  slide.addText(`${n} / 12`, { x: W - 1.4, y: H - 0.34, w: 0.9, h: 0.25, fontFace: BF, fontSize: 8, color: SLATE, align: "right", valign: "middle", margin: 0 });
}
function header(P, slide, n, title, subtitle) {
  slide.background = { color: CREAM };
  slide.addText(`SLIDE ${n}`, { x: M, y: 0.26, w: 3, h: 0.22, fontFace: HF, fontSize: 10, color: GOLD, bold: true, charSpacing: 3, margin: 0 });
  slide.addText(title, { x: M, y: 0.48, w: W - 2 * M, h: 0.55, fontFace: HF, fontSize: 27, color: TEAL, bold: true, margin: 0 });
  if (subtitle) slide.addText(subtitle, { x: M, y: 1.06, w: W - 2 * M, h: 0.32, fontFace: BF, fontSize: 12.5, color: SLATE, italic: true, margin: 0 });
  footer(P, slide, n);
}
function card(P, slide, x, y, w, h, fill, line) {
  slide.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: fill || WHITE }, line: { color: line || SAND, width: 1 } });
}

const SLIDES = {};

// ---------------------------------------------------------------- SLIDE 1
SLIDES[1] = (P) => {
  const s = P.addSlide();
  s.background = { color: TEAL };
  s.addText("FIRST REVIEW   ·   PHASE I", { x: M, y: 1.0, w: 8, h: 0.4, fontFace: HF, fontSize: 15, color: GOLD, bold: true, charSpacing: 4, margin: 0 });
  s.addText("Adaptive Study Planning for\nSelf-Directed Learners", { x: M, y: 1.5, w: 8.6, h: 1.1, fontFace: HF, fontSize: 38, color: WHITE, bold: true, lineSpacingMultiple: 0.95, margin: 0 });
  s.addText("A verified, closed-loop adaptive study planner", { x: M, y: 2.78, w: 8.6, h: 0.4, fontFace: BF, fontSize: 16, color: PALET, italic: true, margin: 0 });
  s.addText([
    { text: "Rohit Saji", options: { bold: true, color: WHITE } },
    { text: "   ·   PES2PGE24DS201", options: { color: PALET } },
  ], { x: M, y: 3.7, w: 8.6, h: 0.3, fontFace: BF, fontSize: 14, margin: 0 });
  s.addText("M.Tech in Data Science and Artificial Intelligence   ·   PES University", { x: M, y: 4.02, w: 8.6, h: 0.3, fontFace: BF, fontSize: 12.5, color: PALET, margin: 0 });
  s.addText([
    { text: "Guide: ", options: { color: GOLD, bold: true } },
    { text: "Prof. Ramesh Prakash Guledgudd", options: { color: WHITE } },
    { text: "        7 June 2026", options: { color: PALET } },
  ], { x: M, y: 4.34, w: 8.6, h: 0.3, fontFace: BF, fontSize: 12.5, margin: 0 });
  try { s.addImage({ path: LOGO, x: 8.55, y: 0.5, w: 1.0, h: 1.0 }); } catch (e) {}
};

// ---------------------------------------------------------------- SLIDE 2
SLIDES[2] = (P) => {
  const s = P.addSlide();
  header(P, s, 2, "The Vision", "What we are building, and the problem it kills");
  const y = 1.58, h = 2.5, w = 4.35;
  card(P, s, M, y, w, h, WHITE, SAND);
  s.addText("THE PROBLEM", { x: M + 0.25, y: y + 0.18, w: w - 0.5, h: 0.3, fontFace: HF, fontSize: 13, color: GOLD, bold: true, charSpacing: 2, margin: 0 });
  s.addText([
    { text: "Self-directed learners build fixed study plans that diverge from reality within days — they fall behind or surge ahead, and the plan never adapts.", options: { breakLine: true, paraSpaceAfter: 8 } },
    { text: "Worse, self-reported study time has no ground truth: logged hours may produce no real learning.", options: {} },
  ], { x: M + 0.25, y: y + 0.56, w: w - 0.5, h: h - 0.74, fontFace: BF, fontSize: 12, color: INK, valign: "top", margin: 0 });
  const x2 = M + w + 0.3;
  card(P, s, x2, y, w, h, TEAL, TEAL);
  s.addText("THE VISION", { x: x2 + 0.25, y: y + 0.18, w: w - 0.5, h: 0.3, fontFace: HF, fontSize: 13, color: GOLD, bold: true, charSpacing: 2, margin: 0 });
  s.addText("A verified closed-loop planner that learns each learner's true pace from assessment-verified sessions, detects behavioural shifts, projects completion with calibrated uncertainty, and regenerates the schedule — beating a static planner on adherence and genuine learning gains.", { x: x2 + 0.25, y: y + 0.56, w: w - 0.5, h: h - 0.74, fontFace: BF, fontSize: 12, color: WHITE, valign: "top", margin: 0 });
  const sy = y + h + 0.2;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: sy, w: W - 2 * M, h: 0.6, rectRadius: 0.06, fill: { color: GOLDF }, line: { color: GOLD, width: 1 } });
  s.addText([
    { text: "learn pace ", options: { bold: true } },
    { text: "→  detect shift  →  project completion  →  regenerate schedule  ", options: {} },
    { text: "↺  verified by assessment", options: { bold: true, color: GOLD } },
  ], { x: M + 0.2, y: sy, w: W - 2 * M - 0.4, h: 0.6, fontFace: BF, fontSize: 13, color: TEAL, align: "center", valign: "middle", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 3
SLIDES[3] = (P) => {
  const s = P.addSlide();
  header(P, s, 3, "Since the Guidance Call", "From one adaptive engine to two interlocking pillars");
  s.addText([
    { text: "Your directive", options: { bold: true, color: GOLD } },
    { text: " — “how do you stop users passing false session data?” — reshaped the project into ", options: {} },
    { text: "two co-equal research pillars.", options: { bold: true } },
  ], { x: M, y: 1.5, w: W - 2 * M, h: 0.35, fontFace: BF, fontSize: 13, color: INK, margin: 0 });
  const y = 1.98, h = 2.0, w = 4.35;
  card(P, s, M, y, w, h, WHITE, TEALM);
  s.addShape(P.shapes.RECTANGLE, { x: M, y, w: 0.08, h, fill: { color: TEALM } });
  s.addText("PILLAR A — Adaptation", { x: M + 0.25, y: y + 0.16, w: w - 0.4, h: 0.3, fontFace: HF, fontSize: 13.5, color: TEAL, bold: true, margin: 0 });
  s.addText("Phase I  ·  research resolved", { x: M + 0.25, y: y + 0.46, w: w - 0.4, h: 0.25, fontFace: BF, fontSize: 10.5, color: GREEN, bold: true, italic: true, margin: 0 });
  s.addText([
    { text: "Pace calibration — hierarchical Bayesian", options: { bullet: true, breakLine: true } },
    { text: "Shift detection — CUSUM change-point", options: { bullet: true, breakLine: true } },
    { text: "Projection — Gaussian process (uncertainty)", options: { bullet: true, breakLine: true } },
    { text: "Scheduling — constraint-based generation", options: { bullet: true } },
  ], { x: M + 0.3, y: y + 0.74, w: w - 0.5, h: h - 0.85, fontFace: BF, fontSize: 11, color: INK, valign: "top", margin: 0 });
  const x2 = M + w + 0.3;
  card(P, s, x2, y, w, h, GREYF, GREY);
  s.addShape(P.shapes.RECTANGLE, { x: x2, y, w: 0.08, h, fill: { color: GOLD } });
  s.addText("PILLAR B — Verification", { x: x2 + 0.25, y: y + 0.16, w: w - 0.4, h: 0.3, fontFace: HF, fontSize: 13.5, color: TEAL, bold: true, margin: 0 });
  s.addText("Phase II  ·  researching now", { x: x2 + 0.25, y: y + 0.46, w: w - 0.4, h: 0.25, fontFace: BF, fontSize: 10.5, color: GOLD, bold: true, italic: true, margin: 0 });
  s.addText([
    { text: "Item generation — LLM, material-grounded", options: { bullet: true, breakLine: true } },
    { text: "Grading — code test-cases + theory rubric", options: { bullet: true, breakLine: true } },
    { text: "Knowledge tracing — cold-start mastery", options: { bullet: true, breakLine: true } },
    { text: "Placement — spaced-practice cadence", options: { bullet: true } },
  ], { x: x2 + 0.3, y: y + 0.74, w: w - 0.5, h: h - 0.85, fontFace: BF, fontSize: 11, color: INK, valign: "top", margin: 0 });
  s.addText([
    { text: "Evaluation (3 legs): ", options: { bold: true, color: TEAL } },
    { text: "synthetic ground truth  +  public KT benchmark  +  closed-loop vs open-loop.  Pillar B supplies the measured learning-gain leg.", options: { color: INK } },
  ], { x: M, y: y + h + 0.18, w: W - 2 * M, h: 0.45, fontFace: BF, fontSize: 11.5, align: "center", valign: "middle", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 4
SLIDES[4] = (P) => {
  const s = P.addSlide();
  header(P, s, 4, "Two-Pillar System Architecture", "Phase I builds the open-loop platform; Phase II adds the verified closed loop");
  const ratio = 3600 / 1952; // 1.844
  const maxH = 3.35, iy = 1.45;
  let dh = maxH, dw = dh * ratio;
  if (dw > W - 2 * M) { dw = W - 2 * M; dh = dw / ratio; }
  const ix = (W - dw) / 2;
  s.addImage({ path: ARCH, x: ix, y: iy, w: dw, h: dh });
  s.addText([
    { text: "solid", options: { bold: true, color: TEAL } },
    { text: " = Phase I (built)      ", options: { color: SLATE } },
    { text: "dashed", options: { bold: true, color: GREYT } },
    { text: " = Phase II (build)      ", options: { color: SLATE } },
    { text: "gold", options: { bold: true, color: GOLD } },
    { text: " = closed loop (the novelty)", options: { color: SLATE } },
  ], { x: M, y: iy + dh + 0.07, w: W - 2 * M, h: 0.28, fontFace: BF, fontSize: 11, align: "center", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 5
SLIDES[5] = (P) => {
  const s = P.addSlide();
  header(P, s, 5, "Pillar A — Algorithms", "Predict-then-optimize, made adaptive   ·   base paper: Islam (2024)");
  const steps = [
    ["1", "Pace Calibration", "Hierarchical Bayesian", "Learn the learner's true pace from sparse sessions"],
    ["2", "Change Detection", "CUSUM / control charts", "Catch behavioural shifts as they happen"],
    ["3", "Progress Projection", "Gaussian Process", "Completion date with a calibrated uncertainty band"],
    ["4", "Schedule Generator", "Constraint-based + role-phasing", "Regenerate a concrete, feasible plan"],
  ];
  const n = steps.length, gap = 0.25, w = (W - 2 * M - gap * (n - 1)) / n, y = 1.75, h = 2.5;
  steps.forEach((st, i) => {
    const x = M + i * (w + gap);
    card(P, s, x, y, w, h, WHITE, TEALM);
    s.addShape(P.shapes.OVAL, { x: x + w / 2 - 0.28, y: y + 0.22, w: 0.56, h: 0.56, fill: { color: TEAL } });
    s.addText(st[0], { x: x + w / 2 - 0.28, y: y + 0.22, w: 0.56, h: 0.56, fontFace: HF, fontSize: 20, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
    s.addText(st[1], { x: x + 0.12, y: y + 0.92, w: w - 0.24, h: 0.55, fontFace: HF, fontSize: 13.5, bold: true, color: TEAL, align: "center", valign: "top", margin: 0 });
    s.addText(st[2], { x: x + 0.12, y: y + 1.45, w: w - 0.24, h: 0.3, fontFace: BF, fontSize: 10.5, italic: true, color: GOLD, align: "center", margin: 0 });
    s.addText(st[3], { x: x + 0.12, y: y + 1.78, w: w - 0.24, h: 0.65, fontFace: BF, fontSize: 10.5, color: INK, align: "center", valign: "top", margin: 0 });
    if (i < n - 1) s.addText("›", { x: x + w + gap / 2 - 0.12, y: y + 0.3, w: 0.24, h: 0.5, fontFace: HF, fontSize: 24, bold: true, color: GOLD, align: "center", valign: "middle", margin: 0 });
  });
  s.addText([
    { text: "Phase I computes calibration ", options: {} },
    { text: "open-loop", options: { bold: true, color: TEAL } },
    { text: " (computed, not yet fed back).  Phase II closes the loop.", options: {} },
  ], { x: M, y: y + h + 0.2, w: W - 2 * M, h: 0.3, fontFace: BF, fontSize: 11.5, color: SLATE, align: "center", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 6
SLIDES[6] = (P) => {
  const s = P.addSlide();
  header(P, s, 6, "Pillar B — Algorithms", "Exam-realistic, material-grounded verification   ·   base paper: CLST (2024)");
  s.addText([
    { text: "ingest material ", options: { bold: true } },
    { text: "→  LLM item generation (concept-tagged)  →  auto-grading  →  ", options: {} },
    { text: "cold-start knowledge tracing", options: { bold: true, color: TEAL } },
  ], { x: M, y: 1.5, w: W - 2 * M, h: 0.32, fontFace: BF, fontSize: 12.5, color: INK, align: "center", margin: 0 });
  const y = 1.95, h = 2.25, w = 4.35;
  card(P, s, M, y, w, h, PALET, TEALM);
  s.addText("DESIGN — decided", { x: M + 0.25, y: y + 0.15, w: w - 0.5, h: 0.3, fontFace: HF, fontSize: 13, color: TEAL, bold: true, charSpacing: 1, margin: 0 });
  s.addText([
    { text: "User-selected style: Tier 1 presets (Generic / Exam-realistic) + Tier 2 build-your-own pattern", options: { bullet: true, breakLine: true } },
    { text: "One pattern schema: sections · item types · marks · timing · negative marking", options: { bullet: true, breakLine: true } },
    { text: "Two modalities: auto-graded coding (POJ) + theory MCQ / short-answer (Eedi)", options: { bullet: true, breakLine: true } },
    { text: "Concept-level cold-start KT; LLM cost controls (cache · batch)", options: { bullet: true } },
  ], { x: M + 0.3, y: y + 0.5, w: w - 0.55, h: h - 0.62, fontFace: BF, fontSize: 10.8, color: INK, valign: "top", margin: 0, paraSpaceAfter: 4 });
  const x2 = M + w + 0.3;
  card(P, s, x2, y, w, h, GOLDF, GOLD);
  s.addText("PARAMETERS — under user research", { x: x2 + 0.25, y: y + 0.15, w: w - 0.5, h: 0.3, fontFace: HF, fontSize: 13, color: GOLD, bold: true, charSpacing: 1, margin: 0 });
  s.addText([
    { text: "Exam-pattern template library — which target exams (GATE, GRE, course papers, certs)", options: { bullet: true, breakLine: true } },
    { text: "Timing & item counts per section", options: { bullet: true, breakLine: true } },
    { text: "Difficulty mix", options: { bullet: true, breakLine: true } },
    { text: "Pass / mastery thresholds", options: { bullet: true } },
  ], { x: x2 + 0.3, y: y + 0.5, w: w - 0.55, h: h - 0.62, fontFace: BF, fontSize: 10.8, color: INK, valign: "top", margin: 0, paraSpaceAfter: 4 });
  s.addText("Assessment specifics are finalized through primary user research — a Phase-I requirements activity. A timed, exam-patterned test is harder to game = a more valid learning signal. Build is Phase II.", { x: M, y: y + h + 0.12, w: W - 2 * M, h: 0.45, fontFace: BF, fontSize: 10.5, color: SLATE, italic: true, align: "center", valign: "top", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 7
SLIDES[7] = (P) => {
  const s = P.addSlide();
  header(P, s, 7, "Literature Survey", "48 papers surveyed (2024–2026)  ·  12 anchors across both pillars  ·  ★ = base paper");
  const A = [
    ["Pace / Bayesian", "Chen 2024", "Hierarchical Bayesian (N=312)"],
    ["Shift detection", "Saqr 2026", "CSD; 88% warn early"],
    ["Projection", "Pérez-Suay 2024", "GP-ARD, R=0.89"],
    ["Scheduling ★", "Islam 2024", "Predict-then-optimize"],
    ["Adaptive vs static", "Pagano 2026", "2,064 students; adaptive wins"],
    ["SRL analytics", "Alhazbi 2024", "Time-management indicators"],
  ];
  const B = [
    ["KT / cold-start ★", "CLST 2024", "LLM-as-tracer"],
    ["Item generation", "Lecture→Quiz 2026", "Local-LLM material→MCQ"],
    ["Concept tagging", "KC-Tag 2024", "GPT-4 KC, expert-checked"],
    ["Auto-grading", "Jukiewicz 2026", "6,000 code submissions"],
    ["Integrity", "Integrity 2024", "Misconduct detection"],
    ["Retention timing", "Spaced 2025", "Spaced repetition"],
  ];
  const colW = [1.25, 1.35, 1.85];
  function tbl(x, title, rows) {
    s.addText(title, { x, y: 1.5, w: 4.45, h: 0.3, fontFace: HF, fontSize: 13, color: TEAL, bold: true, margin: 0 });
    const data = rows.map(r => [
      { text: r[0], options: { fontFace: BF, fontSize: 9, color: TEAL, bold: true, valign: "middle" } },
      { text: r[1], options: { fontFace: BF, fontSize: 9, color: INK, italic: true, valign: "middle" } },
      { text: r[2], options: { fontFace: BF, fontSize: 9, color: SLATE, valign: "middle" } },
    ]);
    s.addTable(data, { x, y: 1.85, w: colW.reduce((a, b) => a + b, 0), colW, rowH: 0.33, border: { type: "solid", pt: 0.5, color: SAND }, fill: { color: WHITE }, align: "left", valign: "middle", margin: [1, 3, 1, 3] });
  }
  tbl(M, "Pillar A — Adaptation", A);
  tbl(M + 4.55, "Pillar B — Verification", B);
  const gy = 4.48;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: gy, w: W - 2 * M, h: 0.62, rectRadius: 0.05, fill: { color: TEAL }, line: { color: TEAL, width: 1 } });
  s.addText([
    { text: "THE GAP   ", options: { bold: true, color: GOLD } },
    { text: "Each technique exists in isolation. None combines calibration + shift-detection + uncertainty-aware projection + adaptive scheduling into a closed loop — and none verifies the learning signal that drives planning.", options: { color: WHITE } },
  ], { x: M + 0.2, y: gy, w: W - 2 * M - 0.4, h: 0.62, fontFace: BF, fontSize: 10.5, align: "left", valign: "middle", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 8
SLIDES[8] = (P) => {
  const s = P.addSlide();
  header(P, s, 8, "Datasets & Evaluation", "Controlled ground truth + public benchmark + head-to-head");
  const ds = [
    ["Synthetic generator", "Literature-grounded learner archetypes with known nonlinear ground truth — the generator is itself a contribution"],
    ["Public KT (pyKT)", "Eedi (MCQ) + POJ (coding) — benchmark vs DKT / BKT baselines"],
    ["Honest-vs-faker overlay", "Synthetic gaming data to test the verification signal"],
    ["N = 1 real", "Own logged sessions — validation (not proof); logging starts now"],
  ];
  const y = 1.6, gap = 0.2, w = (W - 2 * M - gap) / 2, h = 0.92;
  ds.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (w + gap), yy = y + row * (h + gap);
    card(P, s, x, yy, w, h, WHITE, SAND);
    s.addShape(P.shapes.RECTANGLE, { x, y: yy, w: 0.07, h, fill: { color: GREEN } });
    s.addText(d[0], { x: x + 0.2, y: yy + 0.1, w: w - 0.35, h: 0.3, fontFace: HF, fontSize: 12.5, bold: true, color: TEAL, margin: 0 });
    s.addText(d[1], { x: x + 0.2, y: yy + 0.4, w: w - 0.35, h: 0.48, fontFace: BF, fontSize: 10.5, color: INK, valign: "top", margin: 0 });
  });
  const ey = y + 2 * h + gap + 0.2;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: ey, w: W - 2 * M, h: 0.78, rectRadius: 0.05, fill: { color: GOLDF }, line: { color: GOLD, width: 1 } });
  s.addText([
    { text: "Evaluation — three legs:   ", options: { bold: true, color: TEAL } },
    { text: "(1) synthetic ground truth    (2) public KT benchmark (KT-AUC ≈ 0.70–0.82)    (3) closed-loop + verified  vs  open-loop + unverified", options: { color: INK } },
  ], { x: M + 0.2, y: ey, w: W - 2 * M - 0.4, h: 0.78, fontFace: BF, fontSize: 11.5, align: "left", valign: "middle", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 9
SLIDES[9] = (P) => {
  const s = P.addSlide();
  header(P, s, 9, "Expected Outcomes", "Per-component metric · baseline it is compared against · expected result (only KT-AUC commits to a number)");
  const cols = ["Component", "Metric", "Compared against", "Expected result"];
  const head = cols.map(t => ({ text: t, options: { fontFace: HF, fontSize: 9.5, bold: true, color: WHITE, fill: { color: TEAL }, valign: "middle" } }));
  const rows = [
    ["Pace calibration", "MAE / RMSE of pace", "Bayesian vs moving average", "Lower error, esp. with sparse data"],
    ["Change detection", "Latency, false-alarm rate", "CUSUM vs EWMA vs CSD", "Clear winner per profile"],
    ["Progress projection", "95% CI coverage, point error", "GP vs linear extrapolation", "Calibrated intervals; linear not"],
    ["Schedule generation", "Deadline drift, adherence", "Constraint vs rule vs DP", "Competitive, prerequisite-aware"],
    ["Mastery (KT)", "AUC on public KT", "vs DKT, BKT", "≈ 0.70 – 0.82 (literature range)"],
    ["Cold-start mastery", "AUC at few interactions", "cold-start vs standard KT", "Higher AUC in low-data regime"],
    ["Verification", "Precision / recall of fake flags", "honest-vs-faker synthetic", "High precision; no over-flagging"],
    ["Item generation", "Validity / answerability", "human-checked sample", "Majority valid; failures characterised"],
    ["Learning signal", "Pre / post mastery delta", "—", "Detectable gain after genuine study"],
  ];
  const data = [head];
  rows.forEach((r, i) => {
    const bg = i % 2 ? "FFFFFF" : "F1EEE7";
    data.push(r.map((cell, k) => ({ text: cell, options: { fontFace: BF, fontSize: 8.6, bold: k === 0 || i === 4, color: k === 0 ? TEAL : (i === 4 ? GOLD : INK), fill: { color: bg }, valign: "middle" } })));
  });
  s.addTable(data, { x: M, y: 1.5, w: W - 2 * M, colW: [1.65, 2.3, 2.4, 2.65], rowH: 0.345, border: { type: "solid", pt: 0.5, color: SAND }, align: "left", valign: "middle", margin: [1, 4, 1, 4] });
};

// ---------------------------------------------------------------- SLIDE 10
SLIDES[10] = (P) => {
  const s = P.addSlide();
  header(P, s, 10, "Phase I Roadmap", "Three reviews — Review 1 is today");
  const tl = [["May 31", "Guidance 1", false], ["Jun 7", "REVIEW 1", true], ["Jun 14", "Guidance 2", false], ["Jun 21", "REVIEW 2", false], ["Jun 28", "Guidance 3", false], ["Jul 5", "REVIEW 3", false]];
  const ty = 1.65, n = tl.length, w = (W - 2 * M) / n;
  s.addShape(P.shapes.LINE, { x: M + w / 2, y: ty + 0.18, w: (n - 1) * w, h: 0, line: { color: SAND, width: 1.5 } });
  tl.forEach((t, i) => {
    const cx = M + i * w + w / 2;
    s.addShape(P.shapes.OVAL, { x: cx - 0.1, y: ty + 0.08, w: 0.2, h: 0.2, fill: { color: t[2] ? GOLD : TEALM }, line: { color: t[2] ? GOLD : TEALM, width: 1 } });
    s.addText(t[0], { x: cx - w / 2, y: ty - 0.18, w, h: 0.25, fontFace: BF, fontSize: 9.5, bold: true, color: SLATE, align: "center", margin: 0 });
    s.addText(t[1], { x: cx - w / 2, y: ty + 0.32, w, h: 0.25, fontFace: HF, fontSize: 9.5, bold: true, color: t[2] ? GOLD : TEAL, align: "center", margin: 0 });
    if (t[2]) s.addText("TODAY", { x: cx - w / 2, y: ty + 0.55, w, h: 0.2, fontFace: BF, fontSize: 8, bold: true, color: GOLD, align: "center", charSpacing: 1, margin: 0 });
  });
  const reviews = [
    ["REVIEW 1 · 30%", ["Abstract + two-pillar architecture", "Algorithms — both pillars", "Expected outcomes (per-component)", "48 references (12 anchors)", "Data-capture foundation built"]],
    ["REVIEW 2 · 80%", ["Synthetic data generator built", "Algorithm comparison — 4 components", "Static scheduler + dashboards", "Intermediate comparison results"]],
    ["REVIEW 3 · 100%", ["Full model comparison vs baselines", "Performance evaluation (synthetic + KT)", "Working demo — open-loop planner", "Draft journal paper"]],
  ];
  const ry = 2.55, gap = 0.25, cw = (W - 2 * M - gap * 2) / 3, ch = 1.85;
  reviews.forEach((rv, i) => {
    const x = M + i * (cw + gap), active = i === 0;
    card(P, s, x, ry, cw, ch, active ? PALET : WHITE, active ? TEALM : SAND);
    s.addText(rv[0], { x: x + 0.18, y: ry + 0.12, w: cw - 0.3, h: 0.3, fontFace: HF, fontSize: 12, bold: true, color: active ? TEAL : SLATE, margin: 0 });
    s.addText(rv[1].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < rv[1].length - 1, fontSize: 9.5 } })), { x: x + 0.3, y: ry + 0.45, w: cw - 0.5, h: ch - 0.55, fontFace: BF, fontSize: 9.5, color: INK, valign: "top", margin: 0 });
  });
  const cy = ry + ch + 0.15;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: cy, w: W - 2 * M, h: 0.5, rectRadius: 0.05, fill: { color: TEAL }, line: { color: TEAL, width: 1 } });
  s.addText([
    { text: "Phase I also delivers the offline research:  ", options: { bold: true, color: GOLD } },
    { text: "synthetic data generator + algorithm comparison for Pillar A  (next slide: what is already built).", options: { color: WHITE } },
  ], { x: M + 0.2, y: cy, w: W - 2 * M - 0.4, h: 0.5, fontFace: BF, fontSize: 10.5, align: "left", valign: "middle", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 11
SLIDES[11] = (P) => {
  const s = P.addSlide();
  header(P, s, 11, "Review 1 — The 30%", "Measured against the full two-pillar + research scope: the 30% is the data-capture foundation, with the research designed");
  const y = 1.65, h = 2.32, w = 4.35;
  // BUILT — data-capture foundation (the code 30%)
  card(P, s, M, y, w, h, PALET, TEALM);
  s.addShape(P.shapes.RECTANGLE, { x: M, y, w, h: 0.06, fill: { color: TEALM } });
  s.addText("BUILT — Data-capture foundation", { x: M + 0.25, y: y + 0.16, w: w - 0.45, h: 0.3, fontFace: HF, fontSize: 13, bold: true, color: TEAL, margin: 0 });
  s.addText("the Review-1 code", { x: M + 0.25, y: y + 0.46, w: w - 0.45, h: 0.25, fontFace: BF, fontSize: 10, italic: true, color: SLATE, margin: 0 });
  s.addText([
    { text: "Session logging + lifecycle (timer · pause / resume)", options: { bullet: true, breakLine: true } },
    { text: "Per-user event store (Dexie, isolated) + event data model", options: { bullet: true, breakLine: true } },
    { text: "Auth (Supabase) + cloud sync (queue · snapshots · restore)", options: { bullet: true } },
  ], { x: M + 0.3, y: y + 0.78, w: w - 0.55, h: h - 0.9, fontFace: BF, fontSize: 11, color: INK, valign: "top", margin: 0, paraSpaceAfter: 7 });
  // DESIGNED — offline research (also Phase-I scope)
  const x2 = M + w + 0.3;
  card(P, s, x2, y, w, h, WHITE, GOLD);
  s.addShape(P.shapes.RECTANGLE, { x: x2, y, w, h: 0.06, fill: { color: GOLD } });
  s.addText("DESIGNED — Offline research", { x: x2 + 0.25, y: y + 0.16, w: w - 0.45, h: 0.3, fontFace: HF, fontSize: 13, bold: true, color: GOLD, margin: 0 });
  s.addText("also Phase-I scope · build in R2", { x: x2 + 0.25, y: y + 0.46, w: w - 0.45, h: 0.25, fontFace: BF, fontSize: 10, italic: true, color: SLATE, margin: 0 });
  s.addText([
    { text: "4-stage algorithm-comparison methodology defined", options: { bullet: true, breakLine: true } },
    { text: "Synthetic-data generator designed — 6 archetypes, known ground truth", options: { bullet: true, breakLine: true } },
    { text: "Pillar B assessment approach surveyed + designed", options: { bullet: true } },
  ], { x: x2 + 0.3, y: y + 0.78, w: w - 0.55, h: h - 0.9, fontFace: BF, fontSize: 11, color: INK, valign: "top", margin: 0, paraSpaceAfter: 7 });
  // remaining Phase-I deliverables
  const cy = y + h + 0.18;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: cy, w: W - 2 * M, h: 0.78, rectRadius: 0.05, fill: { color: TEAL }, line: { color: TEAL, width: 1 } });
  s.addText([
    { text: "Remaining on the Phase-I rubric →  ", options: { bold: true, color: GOLD } },
    { text: "R2 · 80%: static scheduler · progress dashboards · data generator built + algorithm comparison + intermediate results.   R3 · 100%: full model comparison + demo.   (Tagged r1/30pct.)", options: { color: WHITE } },
  ], { x: M + 0.2, y: cy, w: W - 2 * M - 0.4, h: 0.78, fontFace: BF, fontSize: 10, align: "left", valign: "middle", margin: 0 });
};

// ---------------------------------------------------------------- SLIDE 12
SLIDES[12] = (P) => {
  const s = P.addSlide();
  header(P, s, 12, "Phase II Plan — What We Will Deliver", "Three reviews that close the loop and build the verification pillar (the novelty)");
  const reviews = [
    ["R1 · 40%", "foundations + first loop", [
      "Python Intelligence Service (FastAPI); migrate Pillar-A engines TS → Python",
      "Close loop v1: calibration → reschedule",
      "Pillar B: lock assessment design from user research; item-generation prototype",
      "Novelty proposal + Phase-II expected outcomes",
    ]],
    ["R2 · 80%", "full loop + verification build", [
      "Full loop: CUSUM → replan triggers; GP uses calibrated pace",
      "Pillar B: auto-grading (code + theory) + cold-start KT → mastery",
      "Assessment styles: Tier-1 presets + Tier-2 pattern builder",
      "Intermediate results: closed-vs-open; KT-AUC on Eedi / POJ",
    ]],
    ["R3 · 100%", "evaluation + publication", [
      "End-to-end verified closed loop (real + synthetic data)",
      "Full eval: closed + verified vs open + unverified — adherence + learning gain",
      "Model comparison vs base papers (Islam, CLST) + baselines",
      "Working demo + journal paper (publication proof)",
    ]],
  ];
  const ry = 1.55, gap = 0.25, cw = (W - 2 * M - gap * 2) / 3, ch = 2.7;
  reviews.forEach((rv, i) => {
    const x = M + i * (cw + gap), last = i === 2;
    card(P, s, x, ry, cw, ch, last ? GOLDF : WHITE, last ? GOLD : SAND);
    s.addShape(P.shapes.RECTANGLE, { x, y: ry, w: cw, h: 0.06, fill: { color: last ? GOLD : TEALM } });
    s.addText(rv[0], { x: x + 0.18, y: ry + 0.15, w: cw - 0.3, h: 0.3, fontFace: HF, fontSize: 13.5, bold: true, color: last ? GOLD : TEAL, margin: 0 });
    s.addText(rv[1], { x: x + 0.18, y: ry + 0.45, w: cw - 0.3, h: 0.25, fontFace: BF, fontSize: 9.5, italic: true, color: SLATE, margin: 0 });
    s.addText(rv[2].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < rv[2].length - 1 } })),
      { x: x + 0.3, y: ry + 0.76, w: cw - 0.52, h: ch - 0.9, fontFace: BF, fontSize: 9.8, color: INK, valign: "top", margin: 0, paraSpaceAfter: 6 });
  });
  const cy = ry + ch + 0.16;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: cy, w: W - 2 * M, h: 0.5, rectRadius: 0.05, fill: { color: TEAL }, line: { color: TEAL, width: 1 } });
  s.addText([
    { text: "Phase-II thesis:  ", options: { bold: true, color: GOLD } },
    { text: "turn the open-loop platform into a verified closed loop — Pillar B verifies the learning signal that drives Pillar A's replanning.", options: { color: WHITE } },
  ], { x: M + 0.2, y: cy, w: W - 2 * M - 0.4, h: 0.5, fontFace: BF, fontSize: 10.5, align: "left", valign: "middle", margin: 0 });
};

function newPres() {
  const P = new pptxgen();
  P.layout = "LAYOUT_16x9";
  P.author = "Rohit Saji";
  P.title = "Adaptive Study Planning for Self-Directed Learners — First Review";
  return P;
}

async function main() {
  if (process.env.QA === "1") {
    const fs = require("fs");
    const qaDir = path.join(DIR, "qa");
    if (!fs.existsSync(qaDir)) fs.mkdirSync(qaDir);
    for (let i = 1; i <= 12; i++) {
      const P = newPres();
      SLIDES[i](P);
      await P.writeFile({ fileName: path.join(qaDir, `slide${String(i).padStart(2, "0")}.pptx`) });
    }
    console.log("QA: wrote 12 single-slide pptx files to qa/");
  } else {
    const P = newPres();
    for (let i = 1; i <= 12; i++) SLIDES[i](P);
    const f = await P.writeFile({ fileName: path.join(DIR, "review1-deck.pptx") });
    console.log("WROTE", f);
  }
}
main();
