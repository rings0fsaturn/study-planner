---
name: tikz-flow-diagrams
description: Produce inspectable vector TikZ architecture and flow diagrams for report artifacts.
---

# TikZ Flow Diagrams

Read [`college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md`](../../college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md) before creating or revising report diagrams.
Use standalone TikZ and vector PDF output for architecture, process, and feedback-loop diagrams.

Plan the coordinate grid and routing channels before styling details.
Route edges through whitespace and choose anchors that face the destination.
Draw opaque container titles after edges so connectors do not slice through labels.

Compile and rasterize a preview after every meaningful layout change.
Inspect the preview visually rather than approving source alone.
Repeat until labels, edges, containers, and hierarchy remain clear at the report's final print size.

Keep reusable source beside the deliverable and remove disposable preview artifacts after verification.
