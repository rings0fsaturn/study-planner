---
name: ieee-conference-class
description: Keep the journal paper compliant with the repository's IEEEtran conference template.
---

# IEEE Conference Class

Use the local [`IEEEtran_HOWTO.pdf`](../../college/mydeliverables/3rd-Review/journal/IEEEtran_HOWTO.pdf), [`IEEEtran.cls`](../../college/mydeliverables/3rd-Review/journal/IEEEtran.cls), and conference template as the format authority.
Use this canonical class declaration unless the target venue explicitly requires another option:

```latex
\documentclass[conference]{IEEEtran}
```

Do not add redundant `10pt` or `twocolumn` options.
Do not override margins, fonts, baseline spacing, or column geometry.
Do not use `geometry`, class override macros, or manual font shrinking to fit content.

Treat `\thanks`, `\IEEEPARstart`, `\IEEEbiography`, `\IEEEpubid`, `\IEEEmembership`, and `\IEEEaftertitletext` as locked in conference mode.
Do not enable locked commands unless the venue explicitly requires the behavior and the decision is documented.

Load `amsmath` before `cases` when both packages are needed.
Use pdfLaTeX whenever figures include PDF, PNG, or JPEG assets.
Use the TinyTeX build workflow in [`60-latex-report-build.agents.md`](60-latex-report-build.agents.md).
