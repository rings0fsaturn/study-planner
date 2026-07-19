---
name: ieee-conference-equations
description: Use IEEE-safe equation environments, numbering, references, and load order.
---

# IEEE Conference Equations

Use `equation`, `align`, or `IEEEeqnarray` for numbered mathematics.
Never use `eqnarray`.
Use an unnumbered display environment when no number will be referenced.

Place each equation label inside the numbered environment.
Reference equations with `\eqref` or a parenthesized `\ref`.
Use the word "Equation" only when the reference begins a sentence.

Treat every `subequations` block as a deliberate numbering decision because it advances the main counter.
Check subsequent numbering for gaps after adding or moving one.
Load `amsmath` before `cases` when both are present.

Use `IEEEeqnarray` only when `align` cannot express the required column structure.
Inspect long equations at final two-column width instead of shrinking the document font or margins.
