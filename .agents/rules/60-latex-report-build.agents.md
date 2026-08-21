---
name: latex-report-build
description: Compile and inspect dissertation reports with the repository's TinyTeX workflow.
---

# LaTeX Report Build

Identify the active report and read its local decisions, chapter structure, and [`college/mydeliverables/REPORT_WRITING_GUIDE.md`](../../college/mydeliverables/REPORT_WRITING_GUIDE.md) before editing.
Do not assume every review report has the same monolithic or modular layout.

TinyTeX is installed outside the default shell path.
When TinyTeX is absent, install it user-local without sudo:

```bash
curl -sL https://yihui.org/tinytex/install-bin-unix.sh | sh
```

Resolve the TinyTeX bin directory per host with a glob before building:
macOS installs to `$HOME/Library/TinyTeX/bin/universal-darwin`, Linux installs to `$HOME/.TinyTeX/bin/x86_64-linux`, and `tlmgr` symlinks `latexmk` and friends into `$HOME/.local/bin`.
Build from the report directory with TinyTeX prepended:

```bash
TEXBIN="$(ls -d "$HOME"/.TinyTeX/bin/* 2>/dev/null || ls -d "$HOME"/Library/TinyTeX/bin/* 2>/dev/null)"
env PATH="$TEXBIN:$PATH" \
  latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
```

Let `latexmk` run the required cross-reference passes.
Judge warnings from the final log, not an intermediate pass.
Resolve undefined references and citations before accepting the build.

Inspect the compiled PDF visually for overflow, clipped figures, broken tables, weak page breaks, and inconsistent spacing.
Keep source assets and citations portable within the report bundle.
Use the bibliography mechanism already selected by that report instead of introducing a second mechanism casually.

Do not edit generated LaTeX artifacts by hand.
Clean auxiliary output with `latexmk -C main.tex` only when cleanup is actually needed and the target report directory has been confirmed.
