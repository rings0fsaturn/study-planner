---
name: ieee-conference-floats-and-citations
description: Apply IEEE placement, caption, label, graphic, citation, and bibliography conventions.
---

# IEEE Conference Floats and Citations

Put figure captions below graphics and table captions above tabular content.
Place each `\label` after or inside its `\caption`.
Use `\centering` instead of the `center` environment inside floats.

Use vector PDF or EPS for line art and plots.
Reserve bitmap formats for photographic content.
Place floats at column tops or bottoms unless the venue template requires another policy.
Use `figure*` and `table*` only when content genuinely requires both columns.
Do not use packages that place content across the column gutter.

Wrap algorithmic content in an IEEE-supported figure or table float instead of an unsupported algorithm float.
Verify every float at final two-column scale and ensure text, legends, and line weights remain readable.

Batch adjacent numeric citations in one `\cite{...}` call and use the template's citation package behavior.
Use the official `IEEEtran` bibliography style for BibTeX workflows.
Keep a manual `thebibliography` workflow internally consistent when the paper already uses it.
Do not mix bibliography mechanisms without an explicit migration and a clean rebuild.
