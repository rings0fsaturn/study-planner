# Flow Diagram Generation (TikZ → vector PDF)

How to produce a clean, professional architecture / flow diagram as a
tight-bbox **vector PDF** that drops straight into a LaTeX report
(`\includegraphics`). This is the workflow used to build
`college/mydeliverables/1st-Review/report/system_architecture.tex`.

Use this when you need a figure from a Mermaid sketch, a hand-drawn flow, or a
described system — and the output must be a PDF/vector image, not a raster mockup.

## Why TikZ standalone (not Mermaid CLI / PNG)

| Approach | Verdict |
|---|---|
| `mmdc` (Mermaid CLI) | needs puppeteer/npm; often unavailable/blocked; raster-ish |
| Hand-drawn PNG | not vector, fonts mismatch, can't edit |
| **standalone TikZ → PDF** | **vector, font-matched, fully controllable, self-contained** |

## Toolchain (this machine)

TinyTeX is **not on PATH**. Prepend it every compile (Bash resets env per call):

```bash
export PATH="$HOME/Library/TinyTeX/bin/universal-darwin:$PATH"
cd <report-dir>
pdflatex -interaction=nonstopmode -halt-on-error system_architecture.tex
# -> system_architecture.pdf  (1 page, cropped to content by the standalone class)
```

`tikz`, `standalone`, `positioning`, `fit`, `backgrounds`, `arrows.meta`,
`shapes.geometric`, `calc` are all installed. See `latex-report-build.md` for the
broader TeX setup.

## The visual-verification loop (CRITICAL — do not skip)

You cannot judge a diagram from source. **Rasterize and look at it after every
change.** `poppler`/`pdftoppm` are NOT installed, but macOS `sips` rasterizes PDF→PNG:

```bash
sips -s format png -Z 1800 system_architecture.pdf --out _preview.png   # then Read _preview.png
```

For fine detail (overlaps, arrowheads), render hi-res and crop with Python PIL
(available as system `python3`, NOT in the project `.venv`):

```bash
sips -s format png -Z 3200 system_architecture.pdf --out _hi.png
python3 - <<'PY'
from PIL import Image
im=Image.open("_hi.png"); W,H=im.size
im.crop((int(0.10*W),int(0.55*H),int(0.80*W),int(0.85*H))).save("_crop.png")  # fractional box
PY
```

Iterate: edit → compile → `sips` → Read → fix. Expect 3–6 passes. **Clean up**
`_preview.png`, `_hi.png`, `_crop*.png`, and the standalone `.aux` when done
(keep `.tex` + `.pdf`).

## Layout principles (what makes it clean)

1. **Pick a primary axis and commit.** A single top-down spine
   (actor → client → hub → service) reads best. Don't mix flow directions.
2. **Parallel pipelines = vertical columns, side by side.** Stacking pillars as
   *columns* (not horizontal rows) frees the centre and the right edge, and turns
   long L-shaped return edges into short straight ones. This was the key fix that
   removed congestion.
3. **Leave lanes for edges to travel.** Generous row gaps (~2.2–2.5 units) and
   column gaps (~3+ units) so arrows have empty channels. Cramped layouts force
   arrows through boxes.
4. **Use the empty centre gap** between two columns for the one feedback/loop
   edge (riser up the middle). It's the cleanest place for a return edge.
5. **One side per concern.** Keep one edge family per side: e.g. external service
   (OpenAI) on the right with short horizontals; the two upward returns as two
   parallel **left lanes** with rotated labels.
6. **Outer titles, inner arrows.** Put each group/container title on its *outer*
   top corner (Pillar A title top-left, Pillar B top-right) and route the feeding
   arrow into the *inner* top side — so title and arrowhead never overlap.
7. **Absolute coordinates, not relative chains.** For non-trivial diagrams, place
   nodes with explicit `at (x,y)` (units = cm). It makes routing predictable and
   edits local. Plan the grid first (sketch column x's and row y's).

## Structural recipe

```latex
\documentclass[border=12pt]{standalone}
\usepackage[T1]{fontenc}\usepackage{helvet}\renewcommand{\familydefault}{\sfdefault} % clean sans
\usepackage{tikz}
\usetikzlibrary{positioning,fit,backgrounds,arrows.meta,shapes.geometric,calc}
% \definecolor{...}{HTML}{...}  for each stroke/fill pair
\begin{document}\begin{tikzpicture}[ /* styles */ ]
  % 1. NODES  (absolute coords; one node per component)
  % 2. CONTAINER BOXES on the background layer (fit + draw), NO labels here
  % 3. EDGES
  % 4. CONTAINER TITLES last (on top), opaque fill  -> arrows pass behind text
\end{tikzpicture}\end{document}
```

Reusable styles that worked well:

```latex
box/.style   ={rounded corners=3pt, draw, line width=0.8pt, align=center,
               inner sep=6pt, text width=3.1cm, fill=white},
proc/.style  ={box, draw=blueStroke, fill=paFill},          % active / Phase I
phase2/.style={box, draw=grey, dashed, fill=greyFill, text=greyText}, % future / greyed
hub/.style   ={cylinder, shape border rotate=90, aspect=0.16, ...},   % datastore
actor/.style ={rounded corners=12pt, ...},                  % person (stadium)
ext/.style   ={draw=grey, double, double distance=1pt, ...},% external system
flow/.style  ={-{Latex[length=2.6mm,width=2.2mm]}, line width=0.9pt, draw=slate},
flowbi/.style={{Latex[...]}-{Latex[...]}, ...},             % bidirectional
dflow/.style ={flow, dashed, draw=grey},                    % Phase II / optional
loop/.style  ={-{Latex[...]}, line width=1.2pt, dashed, draw=loopClr}, % the feedback edge
lbl/.style   ={font=\scriptsize, fill=white, inner sep=1.8pt, text=slate}, % white bg masks line
```

Routing edges as clean lanes (orthogonal, explicit waypoints):

```latex
\draw[flow] (SCH.west) -- (-4.4,1.6) -- (-4.4,13.8) -- (SB.west);  % up the left lane
\node[lbl, rotate=90] at (-4.4,8.2) {plan $+$ projections};         % rotate lane labels
\draw[loop] (KT.west) -- (3.5,4.0) -- (3.5,8.8) -- (CAL.east);      % feedback up centre gap
```

## Mistakes to avoid (each cost a rebuild)

- **Title drawn under the arrow → arrow slices through the letters.** Container
  `label=` is drawn on the *background* layer with the container, so later edges
  paint over it. Fix: draw titles as separate nodes **after the edges**, with an
  **opaque fill** (the arrow then passes cleanly *behind* the title tab).
- **Arrow exits the wrong anchor and cuts across the box.** `(SCH.north) -- (right,sameY)`
  slices the box corner. Exit from the anchor facing the destination:
  `(SCH.east) -- (rightX, SCH_y) -- ...`.
- **Two arrows converging on one box corner look chaotic.** Give them distinct
  anchors / sides: e.g. one into `CAL.west`, the other into `CAL.south` — not both
  into `CAL.south west`.
- **Edge routed through a box that sits between endpoints.** Route through a gap:
  send the riser down the empty channel between two boxes (e.g. `router→GEN` down
  the gap between the first two Pillar-A boxes), not straight through a node.
- **Labels colliding with container titles / other labels.** Move the label into a
  genuinely empty band; give every edge label `fill=white` so it masks the line it
  sits on; rotate lane labels 90°.
- **Long titles spanning the central spine.** Keep group titles short
  (`Pillar A --- Phase I`) so they don't reach the centre where the spine arrow is.
- **Container `fit` ordering.** Define content nodes first; then on the
  `background` layer create `fit=(...)` containers; nest outer containers by
  `fit`-ing the inner container *nodes*. Draw containers behind content, edges and
  titles on top.
- **Forgetting the PATH export / running from wrong dir.** "command not found" or
  graphic-not-found — re-`export PATH` and `cd` the report dir each Bash call.

## Wiring into a LaTeX report

```latex
\begin{figure}[p]                         % [p] = own page for a tall/portrait diagram
\centering
\includegraphics[width=0.82\textwidth]{system_architecture.pdf}  % .pdf = vector
\caption{...describe solid vs dashed, Phase I vs II, the hub, the loop...}
\label{fig:architecture}
\end{figure}
```

Reference it in prose (`Figure~\ref{fig:architecture}`). Vertical diagrams are
portrait — prefer `width=0.8`–`0.85\textwidth` and a full-page `[p]` float.
Recompile the report with `latexmk -pdf` and verify `0` undefined refs + the
`<system_architecture.pdf ...>` line in `main.log`.

## Checklist

- [ ] `standalone` class, sans-serif, libraries loaded
- [ ] Nodes placed on a planned absolute grid; parallel pipelines as columns
- [ ] Containers on background layer via `fit`; edges + titles drawn on top
- [ ] Every edge exits/enters a sensible anchor; no edge crosses a box
- [ ] Returns/loops use dedicated lanes or the centre gap; labels in empty bands
- [ ] Rasterized with `sips`, inspected, and crop-checked at problem spots
- [ ] Included as `.pdf` (vector) in a `[p]` figure; report recompiles clean
- [ ] Temp PNGs + standalone `.aux` cleaned up
