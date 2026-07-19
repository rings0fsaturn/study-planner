# Phase-1 ESA deck — reorder decisions

Session date: 2026-07-18. Scope: **slide order & structure only** (contents deferred).
Deliverable: `../Phase-1-ESA-reordered.pptx` (style/layout/font/colors preserved from
`../Phase–1ESA-template.pptx`). Original template left untouched.

## Grounding (confirmed by Rohit)

| Question | Answer |
|---|---|
| Framing | **Hybrid** — weave product (web app) + research (Pillar-A/B, dissertation) as two threads in one narrative; merge the parallel product/research design slides |
| Live demo placement | **After Project Progress** (as the payoff, before References) |
| Reorder freedom | **Free to reorder & merge** |
| Consolidation | **Light merge** — combine obvious overlapping pairs, keep every topic represented |

## Decision 1 — overall narrative order → **Option B (Progressive disclosure)**

Compared three orderings in an interactive storyboard (A = current template, B = progressive
disclosure, C = architecture-first).

- **Chosen: B.** Each slide zooms one level deeper: problem → scope → prior work → review
  feedback → methodology/approach → design approach → **architecture (system map)** →
  detailed design → tech → progress → demo. Fixes the original complaint — Architecture
  moves up from slide 11 to slide 9.
- **Rejected A** (current): Architecture buried at #11, no demo slot, no merges.
- **Rejected C** (architecture-first): showing the system map before methodology/design tends
  to prompt "why this design?" before it's set up; kept as the runner-up for a purely
  system-heavy pitch.

## Structural changes applied

- **Merge** "Design Approach" + "Design Constraints, Assumptions & Dependencies"
  → *Design Approach & Constraints*.
- **Merge** "Design Details" (research) + "Design Description" (product)
  → *Design Description & Details*.
- **New** *Live Demo* slide (cloned from Technologies slide for identical styling),
  placed after Project Progress.
- **Agenda** rewritten to match the new order.
- **Layout fix:** the "Google Shape" slide family vertically-centred its body box, so longer
  merged text grew up into the header. Bodies set to top-anchored below the header underline.

## Final order (16 slides)

1. Title · 2. Agenda · 3. Problem Statement · 4. Abstract & Scope · 5. Literature Survey ·
6. Suggestions from Review-3 · 7. Proposed Methodology / Approach ·
8. Design Approach & Constraints *(merged)* · 9. Architecture ·
10. Design Description & Details *(merged)* · 11. Technologies Used · 12. Project Progress ·
13. Live Demo *(new)* · 14. References · 15. Any other information · 16. Thank You

## Open / deferred (content phase, not this session)

- The two merged slides currently hold **both** sections' template guidance, so they overflow;
  clears once real (shorter) content replaces the boilerplate.
- Optional later decision: single unified Architecture slide (current) vs. split into
  product-architecture + research-pipeline slides.
