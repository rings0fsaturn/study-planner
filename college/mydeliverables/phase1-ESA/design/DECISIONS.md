# Phase-1 ESA deck — custom design decisions

Session: 2026-07-18. Goal: replace the exam template's look with a modern, custom design
tailored to the app + research, **keeping the agreed order-B 16-slide structure**.
Grounded in the app's real design system (`packages/design-tokens` — "Marginalia").
Mocks shown interactively in Cowork; final combined mock + PPTX to follow.

Structure is fixed (see `../reorder-planning/DECISIONS.md`). These decisions cover **design only**.

**Two decks (confirmed):** this custom deck is the **live presentation deck** the panel sees;
the reordered template PPTX (`../Phase-1-ESA-reordered.pptx`) is the **submission deck** only
(never shown live). So the presentation deck is free of all template styling constraints and is
optimized purely for the 20-min talk.

## Design language reference (Marginalia)

- Paper `#F5EFE4` · card `#FBF7EE` · ink `#2A1F18` · ink-soft `#5C4D40` · faint `#8B7B6B` · rule `#D9CDB8`
- Accents: terracotta `#B85C38`, moss `#4A6B3A`, clay `#C28E5A`
- Type: Fraunces (display serif) · Inter Tight (body) · JetBrains Mono (labels/eyebrows)

## D-01 — Visual direction → **A · Marginalia paper**

Compared A (Marginalia paper), B (clean technical white), C (dark keynote) on the title +
architecture slides.

- **Chosen: A.** Uses the product's own design language — distinctive and memorable (an edge
  in the first slot), high-contrast/projector-safe, and it signals design maturity. Ties the
  product and research threads into one identity via the terracotta (product) / moss
  (research) accent split.
- Rejected B (credible but anonymous, loses brand); rejected C (dramatic but projector-risky,
  can read as flashy to a strict panel).

## D-02 — Content-slide frame → **B · Top band**

Compared A (left spine), B (top eyebrow band, full-width body), C (corner index) on the
Literature Survey gap-table slide.

- **Chosen: B.** Maximum body width for content and explanations — the priority for a
  content-dense research talk. Section № + title on a rule, page counter top-right.
- Rejected A (editorial but eats ~10% width); rejected C (roomy but weak orientation).

## D-03 — Architecture diagram → **accurate TikZ vector (not a schematic)**

Initial mock offered three simplified schematics (layered / two-thread / request-trace).
Rohit rejected simplification: the architecture slide must **match reality**. Per the
`tikz-flow-diagrams` rule + `TIKZ_DIAGRAM_GUIDE.md`, built a standalone-TikZ vector
diagram grounded in a full code inventory (Explore pass over the real repo).

- **Artifact:** `system_architecture.tex` → `system_architecture.pdf` (vector) +
  `system_architecture.png` (300 dpi, for the slide). Marginalia palette (terracotta =
  product, moss = intelligence/research, clay = Supabase, grey dashed = offline research).
- **Reality details captured** (would be lost in a cartoon): Dexie schema **v5 / 6 tables**;
  only `/v1/calibration` + `/v1/roadmap/regenerate` cross the wire (progress + initial
  roadmap compute in the in-browser TS engines); **JWKS verification against Supabase auth**,
  not Postgres; **TS↔Python engine mirror** (`enriched.py` is Python-only); research tier
  **imports the engines offline** and is **not in the request path**; write-ahead
  queue → `public.events` + snapshot to Storage/`sync_checkpoints`, with pull-delta return.
- **Dual use:** the same vector PDF drops into the deck's Architecture slide (frame B,
  full-width) *and* into the LaTeX dissertation via `\includegraphics`.
- Build verified through the guide's rasterize-and-inspect loop (4 passes).

## D-04 — Project Progress slide → **A (status board) + Phase-2 timeline strip**

- **Chosen: A + timeline.** Workstream progress bars + weighted overall % (answers "how far"),
  with a slim Phase-1→Phase-2 milestone strip + "you are here" marker filling the lower band
  (answers "how much further"). Fills the frame — no dead space.
- Rejected B alone (timeline only — sequence without depth); rejected C (burn-up dogfood —
  stylish but reads as flourish, and invites number-picking). Burn-up stays in the demo, where
  it is a real product feature.

_Note: all mock copy/numbers are placeholders; content is a later session._

## D-05 — Live Demo slide → **light route + "watch for" cues (no screenshots)**

Clarified: the ESA is an online meeting with screen-share, so the live demo is guaranteed.
That makes a screenshot storyboard redundant — the app, shown live and moving, beats any still.

- **Chosen:** a 4-beat route (Onboarding → Roadmap → Session → Progress), each with a
  one-line "watch for" cue; beat 4 (roadmap + finish-date re-adapting after a logged session)
  accented as "the moment." The slide primes the panel for ~15s, then presenter switches to
  screen-share. Doubles as the presenter's cue card.
- Rejected screenshot storyboard / area-rows matrix (only needed as a fallback, which a
  guaranteed live demo doesn't require).

---

# HANDOFF — deck design complete

**Presentation deck** = live deck (Marginalia design); **submission deck** = the reordered
template PPTX. Design system locked across D-01..D-05. Full 16-slide template assembled at
`phase1-esa-deck.html` (self-contained, keyboard-nav, placeholder skeleton content).
Architecture diagram (`system_architecture.pdf/.png`) embedded in slide 9.

**Next session:** grill the *content* of each slide (real copy, figures, references,
screenshots for the demo cue, actual progress numbers) and, if wanted, the remaining slide
treatments (Problem/Scope/Lit-survey/Methodology/Tech visual polish).

---

# CONTENT SESSION — 2026-07-18 (deck fully written + presenter script)

Grilled the content of all 16 slides and wrote real copy into `phase1-esa-deck.html`
(replacing the placeholder skeleton). Also produced `../presenter-script.md`. Grounded in the
3rd-Review report chapters + `.work/.../third-review-report-work/research`.

## Cross-cutting decisions
- **C-01 · Time budget → full 20 min is talk + demo; Q&A after.** ~13 min slides + ~6 min demo;
  timing plan sums to 19:20 (40 s buffer). Recorded in the script's timing table.
- **C-02 · Title/identity** → "Adaptive Study Planning for Self-Directed Learners" (matches the
  dissertation `main.tex`). One-liner: "Learns your real pace from your own logged sessions, and
  re-projects your finish date as the evidence arrives." Presenter Rohit Saji · PES2PGE24DS201;
  guide Prof. Ramesh Prakash Guledgudd; M.Tech DSAI, PES University. (All pulled from `main.tex`,
  not invented.)
- **C-03 · Evaluation placement → folded into the Methodology slide (7).** No separate Results
  slide (structure stays 16). Three headline findings: real win (enriched-shrinkage on
  prospective short-history, Holm-surviving) · honest null (CUSUM frontier) · validated-not-shipped
  (split-conformal GP coverage fix). DP-scheduler-won-but-not-shipped as a footnote.
- **C-04 · Demo↔slides division → slide 10 hybrid.** Data/sequence diagram (event-sourced
  log → calibrate → replan) as the hero + a 4-screen fallback montage (`slide10_montage.jpg`,
  embedded base64) built from the report screenshots. Live demo carries the UI.

## Slide-content decisions
- **C-05 · Slide 6 (Review-3) → two columns.** Only the **LLM-guided-practice** idea was real
  guide feedback; the booking redesign, rigorous+honest evaluation, and OULAD grounding were
  Rohit's own initiatives — framed as "from my guide" vs "self-initiated since Review-3".
- **C-06 · Slide 12 (Progress) → 4 bars, Phase-1 ~92%.** Report/dissertation 100 · Product app 90 ·
  Intelligence engines (TS+Py) 90 · Research & evaluation 90. Timeline: lit/engines/eval done →
  "you are here" Phase-1 ESA (Jul 2026) → Phase-2 start Aug 1 → Phase-2 ESA Sep 20–Oct 25.
- **C-07 · Slide 15 → "What's Next · Phase-2".** Lead with verified-learning (assessment + KT →
  feed mastery back into calibration = principal novelty); then guide-suggested LLM-guided practice
  (framed as the in-session companion to after-session verification); then ship split-conformal;
  then longitudinal real-data validation. Dated strip Aug 1 → Sep 20–Oct 25. Scope-prioritised note.
  Publication/OSS omitted (none stated).
- **C-08 · Slide 5 (Lit survey)** rebuilt to the report's **five Pillar-A families**
  (Bayesian calibration · change-point detection · GP projection · adaptive scheduling [Islam 2024
  base paper] · SRL analytics) with strength→gap — replacing the wrong DKT/pyBKT/FSRS placeholders.
  **Slide 11 (Tech)** research-tier corrected from Phase-2 "pyBKT/KT-bench" to the Phase-1 offline
  comparison harness. **Slide 14 (References)** = 11 real IEEE cites from the report bib (+ "21 in
  the dissertation" note).

## Verification status
- Structure/content/alignment verified programmatically (16 sections, counters, no leftover
  placeholders, montage + arch image embedded, script headers ↔ deck titles match, timing = 19:20).
- **Not** pixel-rendered: the Cowork sandbox has no headless browser (Chromium download blocked).
  Overflow guarded by conservative height budgeting + `overflow:hidden`. **Open the deck in a browser
  (press F) and eyeball each slide before the talk.**
