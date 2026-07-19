# TikZ Diagram Patterns for Technical Academic Reports

All patterns assume the following preamble:
```latex
\usepackage{tikz}
\usetikzlibrary{positioning, arrows.meta, shapes.geometric, calc, fit, backgrounds}
```

---

## Pattern 1: Flowchart / Process Diagram

Use for: algorithm steps, decision trees, methodology pipelines.

```latex
\begin{figure}[htbp]
\centering
\begin{tikzpicture}[
    node distance=1.4cm,
    startstop/.style={rounded rectangle, draw=black, fill=blue!15, minimum width=3cm, minimum height=0.7cm, align=center},
    process/.style={rectangle, draw=black, fill=gray!10, minimum width=3.5cm, minimum height=0.7cm, align=center},
    decision/.style={diamond, draw=black, fill=orange!20, minimum width=2.5cm, minimum height=0.7cm, align=center, aspect=2},
    arrow/.style={-{Stealth[length=6pt]}, thick}
]

\node (start)   [startstop]                     {Start};
\node (input)   [process, below=of start]        {Receive Input};
\node (check)   [decision, below=of input]       {Valid?};
\node (process) [process, below=of check]        {Process Data};
\node (output)  [process, below=of process]      {Generate Output};
\node (end)     [startstop, below=of output]     {End};
\node (error)   [process, right=2.5cm of check]  {Handle Error};

\draw [arrow] (start)   -- (input);
\draw [arrow] (input)   -- (check);
\draw [arrow] (check)   -- node[left]  {Yes} (process);
\draw [arrow] (check)   -- node[above] {No}  (error);
\draw [arrow] (process) -- (output);
\draw [arrow] (output)  -- (end);
\draw [arrow] (error.south) |- (output);

\end{tikzpicture}
\caption{Processing pipeline flowchart.}
\label{fig:flowchart}
\end{figure}
```

---

## Pattern 2: System Architecture Block Diagram

Use for: layered architectures, component diagrams, pipeline overviews.

```latex
\begin{figure}[htbp]
\centering
\begin{tikzpicture}[
    node distance=0.5cm,
    block/.style={rectangle, draw=black!70, rounded corners=3pt, minimum width=5cm, minimum height=0.8cm, align=center, font=\small},
    layer/.style={rectangle, draw=black!30, dashed, inner sep=8pt, rounded corners=2pt},
    arrow/.style={-{Stealth[length=6pt]}, thick, gray!70}
]

% Blocks (top to bottom)
\node (frontend)  [block, fill=blue!15]           {Frontend / User Interface};
\node (api)       [block, fill=teal!15, below=of frontend]  {API Gateway};
\node (logic)     [block, fill=green!15, below=of api]      {Business Logic Layer};
\node (ml)        [block, fill=orange!15, below=of logic]   {ML Inference Engine};
\node (db)        [block, fill=gray!15, below=of ml]        {Data Store};

% Layer grouping (optional)
\begin{scope}[on background layer]
    \node [layer, fit=(logic)(ml), label=left:{\footnotesize\textit{Core}}] {};
\end{scope}

% Arrows
\draw [arrow] (frontend) -- (api);
\draw [arrow] (api)      -- (logic);
\draw [arrow] (logic)    -- (ml);
\draw [arrow] (ml)       -- (db);

% Bidirectional where needed
\draw [arrow] (db.east) -- ++(0.6,0) |- (logic.east);

\end{tikzpicture}
\caption{System architecture showing layered components.}
\label{fig:architecture}
\end{figure}
```

---

## Pattern 3: Horizontal Pipeline (Left to Right)

Use for: data processing pipelines, sequential stage diagrams.

```latex
\begin{figure}[htbp]
\centering
\begin{tikzpicture}[
    node distance=0.8cm,
    stage/.style={rectangle, draw=black, rounded corners=4pt, fill=blue!10, minimum width=2.2cm, minimum height=1cm, align=center, font=\small},
    arrow/.style={-{Stealth[length=6pt]}, thick}
]

\node (s1) [stage]                  {Data\\Ingestion};
\node (s2) [stage, right=of s1]     {Pre-\\processing};
\node (s3) [stage, right=of s2]     {Feature\\Extraction};
\node (s4) [stage, right=of s3]     {Model\\Inference};
\node (s5) [stage, right=of s4]     {Output\\Formatting};

\draw [arrow] (s1) -- (s2);
\draw [arrow] (s2) -- (s3);
\draw [arrow] (s3) -- (s4);
\draw [arrow] (s4) -- (s5);

% Optional: stage labels below
\foreach \n/\l in {s1/Stage 1, s2/Stage 2, s3/Stage 3, s4/Stage 4, s5/Stage 5} {
    \node [below=0.15cm of \n, font=\tiny\color{gray}] {\l};
}

\end{tikzpicture}
\caption{Five-stage data processing pipeline.}
\label{fig:pipeline}
\end{figure}
```

---

## Pattern 4: Comparison / Side-by-Side

Use for: before/after, approach A vs approach B.

```latex
\begin{figure}[htbp]
\centering
\begin{tikzpicture}[
    box/.style={rectangle, draw, rounded corners=3pt, minimum width=4cm, minimum height=2.5cm, align=center, font=\small},
    label/.style={font=\bfseries\small}
]

\node (a) [box, fill=red!10]   at (0,0)    {Approach A\\[4pt]• Property 1\\• Property 2\\• Property 3};
\node (vs) at (3,0)             {\large\textbf{vs}};
\node (b) [box, fill=green!10] at (6,0)    {Approach B\\[4pt]• Property 1\\• Property 2\\• Property 3};

\node [label, above=0.3cm of a] {Traditional Method};
\node [label, above=0.3cm of b] {Proposed Method};

\end{tikzpicture}
\caption{Comparison between the traditional and proposed approaches.}
\label{fig:comparison}
\end{figure}
```

---

## Pattern 5: Timeline

Use for: project phases, experimental schedule, historical progression.

```latex
\begin{figure}[htbp]
\centering
\begin{tikzpicture}[
    event/.style={rectangle, draw=black!60, fill=blue!10, rounded corners=2pt, minimum height=0.6cm, align=center, font=\small},
    arrow/.style={-{Stealth[length=5pt]}, thick, gray!60}
]

% Main timeline axis
\draw [thick, gray!40] (0,0) -- (12,0);

% Events (adjust x positions for timing)
\foreach \x/\label/\desc in {
    1/Phase 1/Requirements,
    3.5/Phase 2/Design,
    6/Phase 3/Implementation,
    8.5/Phase 4/Testing,
    11/Phase 5/Deployment
}{
    \draw [thick] (\x, -0.15) -- (\x, 0.15);
    \node [above=0.2cm] at (\x, 0) {\footnotesize\textbf{\label}};
    \node [below=0.2cm] at (\x, 0) {\footnotesize\desc};
}

% Arrow at end of timeline
\draw [arrow] (12,0) -- (12.5,0);

\end{tikzpicture}
\caption{Project timeline showing five development phases.}
\label{fig:timeline}
\end{figure}
```

---

## Pattern 6: Simple Directed Graph / DAG

Use for: dependency graphs, state machines, knowledge graphs.

```latex
\begin{figure}[htbp]
\centering
\begin{tikzpicture}[
    node distance=2cm,
    vertex/.style={circle, draw=black, fill=white, minimum size=0.8cm, font=\small},
    arrow/.style={-{Stealth[length=6pt]}, thick}
]

\node (A) [vertex] at (0,2)   {A};
\node (B) [vertex] at (2,3)   {B};
\node (C) [vertex] at (2,1)   {C};
\node (D) [vertex] at (4,2)   {D};
\node (E) [vertex] at (6,2)   {E};

\draw [arrow] (A) -- (B);
\draw [arrow] (A) -- (C);
\draw [arrow] (B) -- (D);
\draw [arrow] (C) -- (D);
\draw [arrow] (D) -- (E);
% Self-loop example:
\draw [arrow] (E) to[loop right] (E);

\end{tikzpicture}
\caption{Directed acyclic graph showing data dependencies.}
\label{fig:dag}
\end{figure}
```

---

## TikZ Quick Reference

### Node shapes (requires `shapes.geometric`)
| Shape | Style key |
|-------|-----------|
| Rectangle | `rectangle` (default) |
| Circle | `circle` |
| Ellipse | `ellipse` |
| Diamond | `diamond, aspect=2` |
| Rounded box | `rectangle, rounded corners=4pt` |
| Rounded rectangle | `rounded rectangle` |

### Arrow tips (requires `arrows.meta`)
| Tip | Code |
|-----|------|
| Filled arrowhead | `{Stealth[length=6pt]}` |
| Open arrowhead | `{Triangle[open]}` |
| Double | `{Implies}` |
| No tip | (omit) |

### Useful positioning shorthands
```latex
\node (b) [below=1cm of a]     % 1cm below node a
\node (b) [right=2cm of a]     % 2cm to the right
\node (b) [below right=of a]   % diagonal
```

### Drawing curves
```latex
\draw (a) to[bend left=30]  (b);   % curved arc
\draw (a) to[bend right=20] (b);
\draw (a) -- ++(1,0) |- (b);       % right-angle path
```

### Colours in TikZ
```latex
fill=blue!20         % 20% blue, 80% white
fill=red!30!blue     % mix of red and blue
draw=black!60        % 60% black (dark gray)
```

---

## When Not to Use TikZ

Use `\includegraphics` placeholders instead when:

- The figure requires real data (use matplotlib/seaborn/R to generate a `.pdf`)
- The diagram has >20 nodes (becomes unmanageable in TikZ source)
- The figure is a photograph or screenshot

```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=0.85\linewidth]{figures/my-plot.pdf}
\caption{Results of the experiment showing X vs Y.}
\label{fig:results}
\end{figure}
```

Always save data-driven figures as `.pdf` (vector) when exporting from Python/R — never `.jpg`.
