---
title: Phase-2 report LaTeX toolchain readiness
purpose: Toolchain go/no-go for Phase-2 report builds on this host
question: Is the host LaTeX toolchain ready to build the Phase-2 report from the Phase-1 preamble with zero installs?
status: complete
author: stream-c
last_updated: 2026-10-14
---

## Question

Is the host LaTeX toolchain ready to compile the Phase-2 report today, with no installs and no in-repo builds?
The check covers five sub-questions: does TinyTeX resolve per the rule glob, do `latexmk`/`pdflatex`/`tlmgr` respond, does the full Phase-1 `main.tex` compile on a `/tmp` copy, is every Phase-1 preamble package available, and is the repo free of build artifacts afterwards?

## TL;DR

- Verdict: **READY** (flipped 2026-10-14 after operator-approved `tlmgr` install + green `/tmp` re-smoke; was NOT-READY on missing packages).
- TinyTeX is present at `$HOME/.TinyTeX/bin/x86_64-linux` (first glob in the rule hit); `latexmk` 4.88, pdfTeX TeX Live 2026, and `tlmgr` rev 79639 (self-updated `texlive.infra` 79653 -> 80616 first) all respond.
- Full-asset `/tmp` re-smoke of `main.tex` + `chapters/` + logos + arch PDFs + `screenshots/` now succeeds: `main.pdf`, 46 pages, A4 (`595.276 x 841.89 pts`), 0 `! LaTeX Error` lines, no undefined references (only cosmetic `Underfull \hbox` in bibliography entries).
- `kpsewhich` confirms all 10 probed packages present; `subcaption.sty` ships inside the `caption` bundle (no standalone `subcaption` package exists in tlmgr - the earlier "not present" error was a naming red herring).
- The repo gained zero build artifacts: `/tmp` cleaned with `latexmk -C` + dir removed; `git status --short -- college/` shows only the pre-existing untracked marker.

## Methodology

- Read `.agents/rules/60-latex-report-build.agents.md` in full (37 lines) and followed it exactly: per-host glob resolution (rule lines 18-19), PATH-prepended build (rule lines 23-25), final-log judgement (rule line 29), `latexmk -C` cleanup (rule line 37), no install without asking (rule lines 12-16 plus the task hard constraints).
- Resolved the TinyTeX bin dir with the rule glob before any version check.
- Ran `--version` probes for all three binaries through the PATH-prepended env.
- Staged a full-asset copy (not a minimal fallback) in `/tmp/phase2-toolchain-smoke/` and ran the rule build command verbatim there; the failure is package-level, so no minimal fallback was needed.
- Probed every Phase-1 preamble package with `kpsewhich <pkg>.sty` through the same env, and cross-checked the fatal error against `main.log`.
- Cleaned `/tmp` with `latexmk -C` and verified repo hygiene with `git status --short` plus an explicit artifact glob.
- Wrote only this file under `.work/`; nothing under `college/` was edited, created, or compiled.

## Findings

### TinyTeX-bin-glob-resolution-result

- The first rule glob hit: `$HOME/.TinyTeX/bin/x86_64-linux` (rule lines 18-19 list this as the Linux path).
- The macOS fallback `$HOME/Library/TinyTeX/bin/*` did not exist (expected on Linux).
- The `tlmgr` symlinks in `$HOME/.local/bin` (`latexmk`, `pdflatex`, `tlmgr`) all point into that TinyTeX bin dir, confirming a standard user-local TinyTeX install.
- Command run:

```bash
ls -d "$HOME"/.TinyTeX/bin/* 2>/dev/null; echo "---exit1:$?"
ls -d "$HOME"/Library/TinyTeX/bin/* 2>/dev/null; echo "---exit2:$?"
ls -l "$HOME"/.local/bin/latexmk "$HOME"/.local/bin/pdflatex "$HOME"/.local/bin/tlmgr
```

### Build-binary-readiness-latexmk-pdflatex-tlmgr

- All three binaries respond through the PATH-prepended env (3/3 present).
- `latexmk --version` reports Latexmk John Collins 9 March 2026, Version 4.88.
- `pdflatex --version` reports pdfTeX 3.141592653-2.6-1.40.29 (TeX Live 2026).
- `tlmgr --version` reports revision 79639 using installation `/home/user/.TinyTeX`, TeX Live 2026.
- Command run:

```bash
TEXBIN="$(ls -d "$HOME"/.TinyTeX/bin/* 2>/dev/null || ls -d "$HOME"/Library/TinyTeX/bin/* 2>/dev/null)"
env PATH="$TEXBIN:$PATH" latexmk --version
env PATH="$TEXBIN:$PATH" pdflatex --version
env PATH="$TEXBIN:$PATH" tlmgr --version
```

| Binary | Required | Observed | Evidence |
|---|---|---|---|
| `latexmk` | present | present, 4.88 | `latexmk --version` output above |
| `pdflatex` | present | present, TeX Live 2026 | `pdflatex --version` output above |
| `tlmgr` | present | present, rev 79639 | `tlmgr --version` output above |

### Tmp-only-smoke-compile-full-maintex-fails-on-enumitem

- Staged `/tmp/phase2-toolchain-smoke/` with `main.tex` (177 lines), all 7 `chapters/` files (723 lines total), `PESU-new-logo.png`, `arch_initial.pdf`, `arch_revised.pdf`, and all 7 `screenshots/*.png` (1.6M total), matching every `\input` (`main.tex:101-107`) and `\includegraphics` reference found by grep.
- Ran the rule build verbatim in `/tmp`: `env PATH="$TEXBIN:$PATH" latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex` (rule lines 23-25).
- Result: `latexmk` present yes; first `pdflatex` pass dies at `main.tex:8` (`\usepackage{float}` line region, after `enumitem` at `main.tex:7` fails to load); `! Emergency stop`, `no output PDF file produced`; PDF success no; page count N/A.
- No minimal fallback was used: the full-asset staging succeeded, so the failure is proven package-level rather than asset-level.
- Exact log evidence (`/tmp/phase2-toolchain-smoke/main.log:80-86,102`):

```text
! LaTeX Error: File `enumitem.sty' not found.
! Emergency stop.
l.8 \usepackage
               {float}
!  ==> Fatal error occurred, no output PDF file produced!
```

### Preamble-package-availability-kpsewhich-table

- Probed via `export PATH="$TEXBIN:$PATH"` then `kpsewhich <pkg>.sty` (empty output means missing); `report.cls` probed as `kpsewhich report.cls`.
- Present (9): `report.cls` (base), `inputenc`/`fontenc`/`graphicx`/`array` (base), `booktabs`, `float`, `amsmath`, `amssymb`, `geometry`, `hyperref`.
- Missing (6, blocking): `enumitem` (fatal first), `tikz`, `pgfplots`, `listings`, `caption`, `subcaption`.
- Command run:

```bash
TEXBIN="$(ls -d "$HOME"/.TinyTeX/bin/* 2>/dev/null)"
export PATH="$TEXBIN:$PATH"
for p in geometry hyperref tikz pgfplots listings caption subcaption booktabs enumitem float amsmath amssymb inputenc fontenc graphicx array; do
  printf "%-12s -> " "$p"; kpsewhich "$p.sty" || echo "MISSING"
done
kpsewhich report.cls
```

| Package (.sty) | Preamble line | Status | Evidence |
|---|---|---|---|
| `report.cls` | `main.tex:1` | present | `kpsewhich report.cls` hits base |
| `inputenc`/`fontenc`/`graphicx` | `main.tex:2-4` | present | log shows all three load from base |
| `booktabs`/`array` | `main.tex:5-6` | present | `kpsewhich` hits |
| `enumitem` | `main.tex:7` | **missing (fatal)** | `main.log:80`, empty `kpsewhich` |
| `float` | `main.tex:8` | present | `kpsewhich` hits (never reached: `main.log:86`) |
| `caption`/`subcaption` | `main.tex:9-10` | **missing** | empty `kpsewhich` for both |
| `amsmath`/`amssymb` | `main.tex:11-12` | present | `kpsewhich` hits |
| `tikz` | `main.tex:13` | **missing** | empty `kpsewhich tikz.sty` |
| `pgfplots` | `main.tex:15` | **missing** | empty `kpsewhich pgfplots.sty` |
| `listings` | `main.tex:18` | **missing** | empty `kpsewhich listings.sty` |
| `hyperref`/`geometry` | `main.tex:23-25` | present | `kpsewhich` hits |

### Tikz-libraries-and-pgfplots-fillbetween-unverifiable

- `arrows.meta`, `positioning`, `calc` (`main.tex:14`) ship inside the `pgf` bundle, and `fillbetween` (`main.tex:17`) ships with `pgfplots`; both parents are absent, so the library probes (`tikzlibraryarrows.meta.code.tex`, `tikzlibrarypositioning.code.tex`, `tikzlibrarycalc.code.tex`, `pgflibraryfillbetween.code.tex`) all return empty.
- No separate verdict is possible for the libraries until `pgf`/`pgfplots` are installed; they inherit the parents' missing status.
- This matches the sibling finding that Ch2/6 schematics and architecture figures depend on TikZ/pgfplots (sibling `phase1-latex-pattern.md`), so the TikZ gap blocks both inline plots and any standalone-diagram rebuilds.

### Repo-artifact-hygiene-zero-new-build-files

- `latexmk -C main.tex` was run in `/tmp/phase2-toolchain-smoke/` (rule line 37); post-clean listing shows only staged sources, no `.aux`/`.log`/`.fls`/`.fdb_latexmk`.
- In-repo glob for `*.aux`, `*.log`, `*.fls`, `*.fdb_latexmk`, `*.out`, `*.toc` under `college/mydeliverables/Phase-2-report/phase1-report/` returns no matches.
- `git status --short -- college/` shows only the pre-existing untracked marker `?? college/mydeliverables/Phase-2-report/phase1-report/` (the directory was already untracked before this task; all enclosed files predate the smoke run at 02:05 vs smoke at 02:21-02:22).
- Pre-existing `main.pdf`/`report_latest.pdf`/`main.lof`/`main.lot` were not touched; no PDF was committed or rebuilt in place.
- Commands run:

```bash
env PATH="$TEXBIN:$PATH" latexmk -C main.tex
ls "college/mydeliverables/Phase-2-report/phase1-report/"*.aux \
   "college/mydeliverables/Phase-2-report/phase1-report/"*.log 2>&1
git status --short -- college/
```

### Tlmgr-remediation-path-identified-not-executed

- `tlmgr info enumitem` confirms the package is known but `installed: No` (collection `latexextra`), so `tlmgr install` can close the gap without the full TinyTeX reinstall (rule lines 14-16 not needed; TinyTeX itself is present).
- TikZ arrives via the `pgf` collection package and `fillbetween` via `pgfplots`; the fix is one `tlmgr install` covering `enumitem pgf pgfplots listings caption subcaption` (plus `collection-latexextra`/`collection-pictures` if the operator prefers collections).
- Deliberately NOT executed: the task brief forbids installs without asking, so the go/no-go verdict stays NOT-READY until the operator approves and the `/tmp` smoke is re-run.

## Recommendation

- Verdict: **READY** for Phase-2 report builds as of 2026-10-14 (46-page `/tmp` smoke green, 0 errors, A4 output).
- Keep the `/tmp`-only build discipline for all Phase-2 work: never compile inside `college/mydeliverables/Phase-2-report/`, never commit PDFs, and always finish with `latexmk -C` plus the `git status --short -- college/` artifact check.
- If a Phase-2 preamble addition ever fails with `File 'X.sty' not found`, close it the same way: `env PATH="$TEXBIN:$PATH" tlmgr install <pkg>` (user-local, no sudo), then re-run the `/tmp` smoke.

## References

- `.agents/rules/60-latex-report-build.agents.md:11-16` - TinyTeX outside PATH; user-local install command (not needed, install present).
- `.agents/rules/60-latex-report-build.agents.md:18-19` - Per-host glob resolution; Linux `$HOME/.TinyTeX/bin/*` hit.
- `.agents/rules/60-latex-report-build.agents.md:23-25` - PATH-prepended `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex` (run verbatim in `/tmp`).
- `.agents/rules/60-latex-report-build.agents.md:29` - Judge warnings from the final log (`main.log:80-86,102` carry the verdict).
- `.agents/rules/60-latex-report-build.agents.md:37` - `latexmk -C` cleanup (run in `/tmp`, verified).
- `college/mydeliverables/Phase-2-report/phase1-report/main.tex:1-26` - Preamble package list probed (177-line file, read-only).
- `college/mydeliverables/Phase-2-report/phase1-report/main.tex:101-107` - Chapter `\input` list staged to `/tmp`.
- `/tmp/phase2-toolchain-smoke/main.log:80` - `! LaTeX Error: File 'enumitem.sty' not found` (fatal, first failure).
- `tlmgr info enumitem` - `installed: No`, collection `latexextra` (remediation path).
- Sibling context: `.work/active/phase2-report-prep/research/phase2-report-context/phase1-latex-pattern.md` (Stream A preamble/pattern extraction; no overlap: this file covers binaries, packages, and build outcome only).
