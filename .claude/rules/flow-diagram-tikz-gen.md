# Flow Diagram Generation (TikZ → vector PDF)

Full workflow, layout principles, reusable TikZ styles, and the mistake log live in
[`college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md`](../../college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md).
Read it before building or editing any architecture/flow diagram for the dissertation.

## When to Apply

Producing a clean, professional architecture/flow diagram as a tight-bbox **vector PDF**
for a LaTeX report (`\includegraphics`) — from a Mermaid sketch, hand-drawn flow, or a
described system, or editing an existing standalone-TikZ diagram under
`college/mydeliverables/`. This is the workflow behind
`college/mydeliverables/1st-Review/report/system_architecture.tex`.

## Top gotchas (full detail in the guide)

1. **Use standalone-class TikZ, not Mermaid CLI or a raster PNG** — vector, font-matched,
   fully controllable. TinyTeX is not on PATH; export it every compile (see `latex-report-build.md`).
2. **You cannot judge a diagram from source — rasterize after every change**:
   `sips -s format png -Z 1800 diagram.pdf --out _preview.png`, then Read the PNG. Expect
   3-6 edit/compile/inspect passes; clean up temp PNGs and the standalone `.aux` when done.
3. **Plan an absolute coordinate grid**; parallel pipelines as vertical columns, not
   horizontal rows — frees the centre/right edge for feedback loops and return edges.
4. **Draw container titles as separate nodes *after* the edges**, with opaque fill — a
   `label=` on a `fit` container is drawn on the background layer and gets sliced by
   later edges.
5. **Exit/enter edges from the anchor facing the destination** — the wrong anchor cuts
   across the box; route long edges through empty channels, never through a node.
