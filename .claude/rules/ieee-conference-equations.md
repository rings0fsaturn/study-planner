# IEEE Conference Equations

Source of truth: [`IEEEtran_HOWTO.pdf`](../../college/mydeliverables/3rd-Review/journal/IEEEtran_HOWTO.pdf).
See [`ieee-conference-class-setup.md`](./ieee-conference-class-setup.md) for the
`amsmath`/`cases.sty` load-order rule referenced below.

## Problem

`eqnarray` compiles without complaint and looks fine at a glance, but IEEE explicitly
flags it as defective. `subequations` silently consumes a slot in the *main* equation
counter even when no sub-numbers are visibly printed, which shows up much later as an
unexplained skip in equation numbering.

## Rule

### Numbering and environments

Use `equation`, `align` (amsmath), or `IEEEeqnarray` — **never `eqnarray`**. `eqnarray` has
three documented defects: its `2×\arraycolsep` column separation doesn't match natural math
spacing, its column definitions can't be altered, and it's hard-limited to 3 alignment
columns with no per-cell override.

```latex
\begin{equation}
a+b=\gamma\label{eq_example}
\end{equation}
```

Use `displaymath` instead of `equation` when no number should appear at all.

### Referencing

Cite the number in parentheses — `\eqref{eq_example}` (amsmath) or `\ref{eq_example}`
wrapped in manual parens — never "Eq. (1)" or "equation (1)" mid-sentence. The one
exception is at the start of a sentence: "Equation (1) is...".

### The `subequations` gotcha

The `subequations` environment increments the **main** equation counter even when no
numbers are displayed for its contents. Forgetting this is how equation numbers skip (e.g.
17 → 20) without any visible cause — if numbering looks wrong, check for a stray
`subequations` block first.

### Load order

`amsmath` must be loaded **before** `cases.sty` — the reverse order redefines
`\subequations` and throws `Command \subequations already defined`.

### Multi-line / column-spanning equations

`IEEEtran` ships its own `IEEEeqnarray` family for equations that don't fit in `align`
(e.g. need to span the full column width, or need fine per-column control):

```latex
\begin{IEEEeqnarray}[decl]{cols}
...
\end{IEEEeqnarray}
```

Unlike `align`, `IEEEeqnarray` does **not** strip trailing spaces before `&`, `\\`, or
`\end` — guard line ends with a trailing `%` or stray spacing artifacts will appear,
especially in text-mode columns. `\cline` is incompatible with it; use
`\IEEEeqnarraymulticol{num_cols}{h}{}` instead. This is an advanced/rarely-needed tool —
reach for `align` first.

## Pattern Checklist

- [ ] No `eqnarray` anywhere in the paper — `equation`/`align`/`IEEEeqnarray` only
- [ ] Equations referenced via `\eqref`/`\ref` in parens, not "Eq. (n)" mid-sentence
- [ ] Any `subequations` block is intentional, and equation numbering after it is
      double-checked for skips
- [ ] `amsmath` loaded before `cases.sty` if both are present

## When to Apply

Writing or reviewing any numbered equation, multi-line derivation, or math environment in
the IEEE conference paper under `college/mydeliverables/3rd-Review/journal/`.
