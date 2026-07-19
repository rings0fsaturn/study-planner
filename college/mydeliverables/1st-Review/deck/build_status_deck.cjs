/* Build the 6-slide RESEARCH-TIER STATUS deck for the 2nd guidance call.
 * Reuses the house palette/fonts from build_deck.cjs (matches the .tex diagram).
 * Embeds assets/architecture_horizontal.png.
 * Run:  node build_status_deck.cjs   ->  status-research-tier-deck.pptx
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const DIR = __dirname;
const ARCH = path.join(DIR, "assets", "architecture_horizontal.png");
const LOGO = path.join(DIR, "..", "report", "pes_logo.png");

// ---- deck palette (matches architecture_horizontal.tex / first deck) ----
const TEAL = "0F3D3E", TEALM = "3D7068", GOLD = "C9974B", GOLDF = "F2E4C6";
const SLATE = "5B6770", INK = "1A1A1A", CREAM = "F7F5F0", SAND = "D7D2C5";
const PALET = "D9E4E2", GREEN = "2E7D5B", GREENF = "E3EFE7", WHITE = "FFFFFF";
const GREY = "9CA3AF", GREYT = "8A8A82", GREYF = "ECEAE3";
const AMBER = "B7791F", AMBERF = "F7E9CC", RED = "B4452F", REDF = "F3DED7";
const HF = "Calibri", BF = "Calibri";
const W = 10, H = 5.625, M = 0.5;
const NSLIDES = 6;
const FOOT = "Adaptive Study Planning  ·  Rohit Saji  ·  Research-tier status — 2nd Guidance Call (14 Jun 2026)";

function footer(slide, n) {
  slide.addText(FOOT, { x: M, y: H - 0.34, w: 8.0, h: 0.25, fontFace: BF, fontSize: 8, color: SLATE, align: "left", valign: "middle", margin: 0 });
  slide.addText(`${n} / ${NSLIDES}`, { x: W - 1.4, y: H - 0.34, w: 0.9, h: 0.25, fontFace: BF, fontSize: 8, color: SLATE, align: "right", valign: "middle", margin: 0 });
}
function header(slide, n, title, subtitle) {
  slide.background = { color: CREAM };
  slide.addText(`SLIDE ${n}`, { x: M, y: 0.26, w: 3, h: 0.22, fontFace: HF, fontSize: 10, color: GOLD, bold: true, charSpacing: 3, margin: 0 });
  slide.addText(title, { x: M, y: 0.48, w: W - 2 * M, h: 0.55, fontFace: HF, fontSize: 26, color: TEAL, bold: true, margin: 0 });
  if (subtitle) slide.addText(subtitle, { x: M, y: 1.06, w: W - 2 * M, h: 0.32, fontFace: BF, fontSize: 12.5, color: SLATE, italic: true, margin: 0 });
  footer(slide, n);
}
function card(P, slide, x, y, w, h, fill, line, lw) {
  slide.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: fill || WHITE }, line: { color: line || SAND, width: lw || 1 } });
}
// small status pill
function pill(P, slide, x, y, w, txt, fill, txtColor) {
  slide.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.26, rectRadius: 0.13, fill: { color: fill }, line: { color: fill, width: 1 } });
  slide.addText(txt, { x, y, w, h: 0.26, fontFace: HF, fontSize: 8.5, bold: true, color: txtColor, align: "center", valign: "middle", charSpacing: 1, margin: 0 });
}

const SLIDES = {};

/* ============================================================= SLIDE 1 — TITLE */
SLIDES[1] = (P) => {
  const s = P.addSlide();
  s.background = { color: TEAL };
  s.addText("RESEARCH TIER   ·   STATUS UPDATE", { x: M, y: 0.85, w: 8.2, h: 0.4, fontFace: HF, fontSize: 14, color: GOLD, bold: true, charSpacing: 4, margin: 0 });
  s.addText("Where the Offline /research\nTier Stands Today", { x: M, y: 1.3, w: 8.7, h: 1.2, fontFace: HF, fontSize: 36, color: WHITE, bold: true, lineSpacingMultiple: 0.96, margin: 0 });
  s.addText("Pillar A done & genuine · Pillar B data now secured · two parts remain", { x: M, y: 2.62, w: 8.8, h: 0.4, fontFace: BF, fontSize: 14.5, color: PALET, italic: true, margin: 0 });

  // status tally chips
  const chips = [
    ["7 / 8", "phases complete", GREEN],
    ["2 / 2", "datasets secured", GREEN],
    ["2", "parts remain", GREY],
  ];
  const cw = 2.55, gap = 0.25, cy = 3.35;
  chips.forEach((c, i) => {
    const x = M + i * (cw + gap);
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y: cy, w: cw, h: 0.92, rectRadius: 0.06, fill: { color: "12494A" }, line: { color: c[2], width: 1.5 } });
    s.addText(c[0], { x: x + 0.15, y: cy + 0.1, w: cw - 0.3, h: 0.45, fontFace: HF, fontSize: 26, bold: true, color: WHITE, align: "left", valign: "middle", margin: 0 });
    s.addText(c[1], { x: x + 0.16, y: cy + 0.55, w: cw - 0.3, h: 0.3, fontFace: BF, fontSize: 11, color: PALET, align: "left", valign: "middle", margin: 0 });
  });

  s.addText([
    { text: "Rohit Saji", options: { bold: true, color: WHITE } },
    { text: "   ·   M.Tech DS & AI · PES University        ", options: { color: PALET } },
    { text: "Guide: ", options: { color: GOLD, bold: true } },
    { text: "Prof. Ramesh Prakash Guledgudd", options: { color: WHITE } },
  ], { x: M, y: 4.62, w: 8.8, h: 0.3, fontFace: BF, fontSize: 12, margin: 0 });
  try { s.addImage({ path: LOGO, x: 8.6, y: 0.5, w: 0.95, h: 0.95 }); } catch (e) {}
};

/* ============================================================= SLIDE 2 — ARCHITECTURE */
SLIDES[2] = (P) => {
  const s = P.addSlide();
  header(s, 2, "The System We Are Building", "Two horizontal pillars behind one Intelligence Service; the gold loop is the Phase-II novelty");
  const ratio = 3600 / 1952; // 1.844
  const maxH = 3.30, iy = 1.46;
  let dh = maxH, dw = dh * ratio;
  if (dw > W - 2 * M) { dw = W - 2 * M; dh = dw / ratio; }
  const ix = (W - dw) / 2;
  s.addImage({ path: ARCH, x: ix, y: iy, w: dw, h: dh });
  s.addText([
    { text: "solid", options: { bold: true, color: TEAL } },
    { text: " = Pillar A, built      ", options: { color: SLATE } },
    { text: "dashed", options: { bold: true, color: GREYT } },
    { text: " = Pillar B, Phase II      ", options: { color: SLATE } },
    { text: "gold", options: { bold: true, color: GOLD } },
    { text: " = closed loop (held for Phase II)      ", options: { color: SLATE } },
    { text: "green", options: { bold: true, color: GREEN } },
    { text: " = offline research tier (this status)", options: { color: SLATE } },
  ], { x: M, y: iy + dh + 0.08, w: W - 2 * M, h: 0.3, fontFace: BF, fontSize: 10.5, align: "center", margin: 0 });
};

/* ============================================================= SLIDE 3 — STATUS MAP */
SLIDES[3] = (P) => {
  const s = P.addSlide();
  header(s, 3, "Built vs Pending — Mapped to the Architecture", "Every block on the diagram, with its current research-tier status");
  // legend pills row
  const ly = 1.46;
  pill(P, s, M, ly, 1.15, "BUILT", GREEN, WHITE);
  pill(P, s, M + 1.25, ly, 1.65, "PLACEHOLDER", AMBER, WHITE);
  pill(P, s, M + 3.0, ly, 1.15, "PENDING", GREY, WHITE);
  pill(P, s, M + 4.25, ly, 1.55, "PHASE II", TEALM, WHITE);
  s.addText("re-run pending", { x: M + 1.25, y: ly + 0.27, w: 1.65, h: 0.18, fontFace: BF, fontSize: 7.5, italic: true, color: AMBER, align: "center", margin: 0 });

  const head = ["Architecture block", "Status", "Where it stands"].map(t => ({ text: t, options: { fontFace: HF, fontSize: 10, bold: true, color: WHITE, fill: { color: TEAL }, valign: "middle" } }));
  const rows = [
    ["Pillar A — calibration · detection · projection · scheduling", "BUILT", "Genuine 720-learner Monte-Carlo comparison; figures + tables auto-generated", GREEN, GREENF],
    ["Offline research — synthetic generator + comparison", "BUILT", "6 archetypes × 3 bands, frozen pre-registered params, seed-deterministic", GREEN, GREENF],
    ["Pillar B — knowledge-tracing bench (pipeline)", "PLACEHOLDER", "Real Eedi + ACcoding data now in hand — re-run swaps smoke fixtures for real numbers", AMBER, AMBERF],
    ["Pillar B — item generation · answer evaluation", "PHASE II", "Designed; build deferred to Phase II (LLM, exam-aware)", TEALM, WHITE],
    ["Closed loop — verified mastery → recalibrate", "PHASE II", "Built & archived; deliberately held as the Phase-II headline novelty", TEALM, WHITE],
    ["N=1 validation · report/journal wiring", "PENDING", "Not started — Phase 5 (own sessions) + Phase 6 (\\input figures)", GREY, WHITE],
  ];
  const data = [head];
  rows.forEach(r => {
    data.push([
      { text: r[0], options: { fontFace: BF, fontSize: 9, bold: true, color: TEAL, fill: { color: r[4] }, valign: "middle" } },
      { text: r[1], options: { fontFace: BF, fontSize: 8.5, bold: true, color: r[3], fill: { color: r[4] }, valign: "middle", align: "center" } },
      { text: r[2], options: { fontFace: BF, fontSize: 9, color: INK, fill: { color: r[4] }, valign: "middle" } },
    ]);
  });
  s.addTable(data, { x: M, y: 1.92, w: W - 2 * M, colW: [3.4, 1.25, 4.35], rowH: 0.46, border: { type: "solid", pt: 0.5, color: SAND }, align: "left", valign: "middle", margin: [2, 4, 2, 4] });
};

/* ============================================================= SLIDE 4 — PILLAR A RESULTS */
SLIDES[4] = (P) => {
  const s = P.addSlide();
  header(s, 4, "Pillar A — Results", "Synthetic learners with known ground truth → a genuine, paired multi-candidate comparison");

  // dataset strip
  card(P, s, M, 1.44, W - 2 * M, 0.5, PALET, TEALM);
  s.addText([
    { text: "DATASET   ", options: { bold: true, color: TEAL } },
    { text: "synthetic generator, known ground truth — 6 archetypes × 3 length-bands × 40 seeds = ", options: { color: INK } },
    { text: "720 learners", options: { bold: true, color: TEAL } },
    { text: "  ·  pre-registered frozen params (hash e716cd12dddc)  ·  seed-deterministic  ·  oracle upper-bounds confirm each task is solvable.", options: { color: INK } },
  ], { x: M + 0.22, y: 1.44, w: W - 2 * M - 0.44, h: 0.5, fontFace: BF, fontSize: 9.3, valign: "middle", margin: 0 });

  // results table — comparison · test · conclusion
  const head = ["Track", "Candidates (★ shipped)", "Test / metric", "Result → conclusion"].map(t =>
    ({ text: t, options: { fontFace: HF, fontSize: 9.3, bold: true, color: WHITE, fill: { color: TEAL }, valign: "middle" } }));
  const rows = [
    ["Pace calibration", "Bayesian ★ vs SMA · EWMA · pooled", "recovery error vs truth · paired t (Δ, p, effect)",
      [{ text: "Bayesian wins", options: { bold: true, color: GREEN } }, { text: " — err 0.033 vs EWMA 0.109, p<1e-16, d=2.2", options: { color: INK } }]],
    ["Change detection", "CUSUM ★ vs EWMA-chart · CSD", "latency ↔ false-alarm, split step/drift · ROC",
      [{ text: "Trade-off", options: { bold: true, color: GOLD } }, { text: " — CSD fastest (lat ≈4–5); CUSUM fewest false alarms (≈0.016)", options: { color: INK } }]],
    ["Progress projection", "GP ★ vs linear · Kalman", "finish-date error · 95% CI coverage",
      [{ text: "GP lowest error", options: { bold: true, color: GREEN } }, { text: " (16.6 vs 29 d) — but all CIs under-cover (≈0.2–0.68)", options: { color: RED } }]],
    ["Schedule generation", "greedy ★ vs DP · rule-based", "deadline drift · capacity · prereq order",
      [{ text: "DP scales best", options: { bold: true, color: GREEN } }, { text: " — greedy drifts ≈30 d on complex mixes; capacity ok", options: { color: INK } }]],
  ];
  const data = [head];
  rows.forEach((r, i) => {
    const bg = i % 2 ? WHITE : "F1EEE7";
    data.push([
      { text: r[0], options: { fontFace: BF, fontSize: 8.8, bold: true, color: TEAL, fill: { color: bg }, valign: "middle" } },
      { text: r[1], options: { fontFace: BF, fontSize: 8.3, color: INK, fill: { color: bg }, valign: "middle" } },
      { text: r[2], options: { fontFace: BF, fontSize: 8.3, color: SLATE, fill: { color: bg }, valign: "middle" } },
      { text: r[3], options: { fontFace: BF, fontSize: 8.3, fill: { color: bg }, valign: "middle" } },
    ]);
  });
  s.addTable(data, { x: M, y: 1.98, w: W - 2 * M, colW: [1.35, 2.4, 2.3, 2.95], rowH: [0.32, 0.52, 0.52, 0.52, 0.52], border: { type: "solid", pt: 0.5, color: SAND }, align: "left", valign: "middle", margin: [2, 4, 2, 4] });

  // further-rigour band
  const fy = 1.98 + 0.32 + 4 * 0.52 + 0.16;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: fy, w: W - 2 * M, h: 0.56, rectRadius: 0.05, fill: { color: TEAL }, line: { color: TEAL, width: 1 } });
  s.addText([
    { text: "TEST FURTHER →  ", options: { bold: true, color: GOLD } },
    { text: "real data (N=1 own sessions + public KT benchmark)  ·  widen the sweep + more seeds (243-cell grid, ranking stable ~96%)  ·  fix projection interval calibration (coverage well below 0.95)  ·  blind held-out + more archetypes.", options: { color: WHITE } },
  ], { x: M + 0.2, y: fy, w: W - 2 * M - 0.4, h: 0.56, fontFace: BF, fontSize: 9, align: "left", valign: "middle", margin: 0 });
};

/* ============================================================= SLIDE 5 — PILLAR B: DATA SECURED */
SLIDES[5] = (P) => {
  const s = P.addSlide();
  header(s, 5, "Pillar B — Data Secured, Numbers Next", "The bench pipeline was already done — only its public data was missing. Both datasets are now in hand.");
  const y = 1.5, h = 1.72, w = 4.35;
  // EEDI card
  card(P, s, M, y, w, h, GREENF, GREEN);
  s.addText("EEDI / NeurIPS-2020  ·  MCQ", { x: M + 0.22, y: y + 0.12, w: w - 0.4, h: 0.28, fontFace: HF, fontSize: 12, bold: true, color: GREEN, margin: 0 });
  s.addText([
    { text: "Real train_task_3_4.csv — 1.38M MCQ rows", options: { bullet: true, breakLine: true } },
    { text: "Exact pyKT NIPS34 format (user · question · correct)", options: { bullet: true, breakLine: true } },
    { text: "Subject tags → concept-level cold-start KT", options: { bullet: true } },
  ], { x: M + 0.3, y: y + 0.46, w: w - 0.5, h: h - 0.58, fontFace: BF, fontSize: 9.5, color: INK, valign: "top", margin: 0, paraSpaceAfter: 4 });
  // ACcoding card
  const x2 = M + w + 0.3;
  card(P, s, x2, y, w, h, GREENF, GREEN);
  s.addText("ACcoding  ·  coding  (POJ substitute)", { x: x2 + 0.22, y: y + 0.12, w: w - 0.4, h: 0.28, fontFace: HF, fontSize: 12, bold: true, color: GREEN, margin: 0 });
  s.addText([
    { text: "4.05M submissions · 27,444 students · 4,559 tasks", options: { bullet: true, breakLine: true } },
    { text: "100 knowledge-point tags (richer than POJ)", options: { bullet: true, breakLine: true } },
    { text: "Maps to poj_log.csv: creator→User · problem→Problem · AC→correct", options: { bullet: true } },
  ], { x: x2 + 0.3, y: y + 0.46, w: w - 0.5, h: h - 0.58, fontFace: BF, fontSize: 9.5, color: INK, valign: "top", margin: 0, paraSpaceAfter: 4 });

  // mapping caveat strip
  const ny = y + h + 0.16;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: ny, w: W - 2 * M, h: 0.72, rectRadius: 0.05, fill: { color: GOLDF }, line: { color: GOLD, width: 1 } });
  s.addText([
    { text: "One caveat:  ", options: { bold: true, color: AMBER } },
    { text: "ACcoding has no submit-time column → use the auto-increment ", options: { color: INK } },
    { text: "id", options: { italic: true, color: INK } },
    { text: " as chronological order (provenance-noted). Drop WT/JG (non-terminal); AC = correct, every other verdict = incorrect.", options: { color: INK } },
  ], { x: M + 0.22, y: ny, w: W - 2 * M - 0.44, h: 0.72, fontFace: BF, fontSize: 10, valign: "middle", margin: 0 });

  // ask band
  const ay = ny + 0.72 + 0.14;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: ay, w: W - 2 * M, h: 0.6, rectRadius: 0.05, fill: { color: TEAL }, line: { color: TEAL, width: 1 } });
  s.addText([
    { text: "ASK →  ", options: { bold: true, color: GOLD } },
    { text: "confirm ", options: { color: WHITE } },
    { text: "Eedi (MCQ) + ACcoding (coding, replacing the dead POJ)", options: { bold: true, color: GOLD } },
    { text: ".  Next: wire both in and re-run make kt → real cold-start AUC + ECE replace today's placeholders.", options: { color: WHITE } },
  ], { x: M + 0.2, y: ay, w: W - 2 * M - 0.4, h: 0.6, fontFace: BF, fontSize: 10.5, align: "left", valign: "middle", margin: 0 });
};

/* ============================================================= SLIDE 6 — WHAT'S PENDING / NEXT */
SLIDES[6] = (P) => {
  const s = P.addSlide();
  header(s, 6, "What's Pending — Path to R3", "Data's now in hand: one immediate re-run, then two parts remain");
  const cards = [
    ["PHASE 5", "N = 1 real-data validation", [
      "Export your own logged study sessions",
      "Overlay real-vs-synthetic for generator face-validity",
      "Run sessions through the harness as a feasibility case — no performance claims",
    ], GOLD, GOLDF, "Action: start logging now — want ~15–25 sessions by R3"],
    ["PHASE 6", "Report & journal wiring", [
      "\\input the generated figures/tables into main.tex",
      "Add provenance footnotes + IMRAD journal skeleton",
      "Reproducibility gate: clean clone → make all → 0 undefined refs",
    ], TEALM, PALET, "Artifacts already exist in report/generated/"],
  ];
  const y = 1.55, gap = 0.3, w = (W - 2 * M - gap) / 2, h = 2.55;
  cards.forEach((c, i) => {
    const x = M + i * (w + gap);
    card(P, s, x, y, w, h, WHITE, c[3]);
    s.addShape(P.shapes.RECTANGLE, { x, y, w, h: 0.06, fill: { color: c[3] } });
    s.addText(c[0], { x: x + 0.22, y: y + 0.16, w: w - 0.4, h: 0.28, fontFace: HF, fontSize: 11, bold: true, color: c[3], charSpacing: 2, margin: 0 });
    s.addText(c[1], { x: x + 0.22, y: y + 0.44, w: w - 0.4, h: 0.34, fontFace: HF, fontSize: 15, bold: true, color: TEAL, margin: 0 });
    s.addText(c[2].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c[2].length - 1 } })),
      { x: x + 0.34, y: y + 0.86, w: w - 0.56, h: 1.1, fontFace: BF, fontSize: 10.2, color: INK, valign: "top", margin: 0, paraSpaceAfter: 5 });
    // note strip
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: x + 0.18, y: y + h - 0.56, w: w - 0.36, h: 0.42, rectRadius: 0.05, fill: { color: c[4] }, line: { color: c[3], width: 0.75 } });
    s.addText(c[5], { x: x + 0.3, y: y + h - 0.56, w: w - 0.6, h: 0.42, fontFace: BF, fontSize: 9.2, bold: true, color: c[3] === GOLD ? AMBER : TEAL, valign: "middle", margin: 0 });
  });
  // bottom takeaway — the now-unblocked immediate step
  const cy = y + h + 0.16;
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: cy, w: W - 2 * M, h: 0.5, rectRadius: 0.05, fill: { color: GREEN }, line: { color: GREEN, width: 1 } });
  s.addText([
    { text: "Now unblocked →  ", options: { bold: true, color: GOLDF } },
    { text: "wire in Eedi (MCQ) + ACcoding (coding) and re-run make kt: today's placeholder KT numbers become real cold-start AUC + ECE before R3.", options: { color: WHITE } },
  ], { x: M + 0.2, y: cy, w: W - 2 * M - 0.4, h: 0.5, fontFace: BF, fontSize: 10.5, align: "left", valign: "middle", margin: 0 });
};

function newPres() {
  const P = new pptxgen();
  P.layout = "LAYOUT_16x9";
  P.author = "Rohit Saji";
  P.title = "Adaptive Study Planning — Research-tier Status (2nd Guidance Call)";
  return P;
}

async function main() {
  const P = newPres();
  for (let i = 1; i <= NSLIDES; i++) SLIDES[i](P);
  const f = await P.writeFile({ fileName: path.join(DIR, "status-research-tier-deck.pptx") });
  console.log("WROTE", f);
}
main();
