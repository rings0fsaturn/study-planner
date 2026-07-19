# IEEE Conference Class Setup (`IEEEtran`)

Source of truth: [`IEEEtran_HOWTO.pdf`](../../college/mydeliverables/3rd-Review/journal/IEEEtran_HOWTO.pdf)
and [`IEEEtran.cls`](../../college/mydeliverables/3rd-Review/journal/IEEEtran.cls), based on
the official template
[`conference_101719.tex`](../../college/mydeliverables/3rd-Review/journal/conference_101719.tex).
This is a **different LaTeX setup from the dissertation** — see
[`latex-report-build.md`](./latex-report-build.md) for the plain `report`-class build
(no author-block macros, no command lockouts, different class entirely).

## Problem

`IEEEtran` conference mode silently swallows several journal-only commands instead of
erroring, and offers many class options that look interchangeable but aren't. Getting
either wrong produces a paper that compiles cleanly but is non-compliant with IEEE's
submission format — the kind of mistake that isn't caught until camera-ready review.

## Rule

**Canonical invocation:**

```latex
\documentclass[conference]{IEEEtran}
```

`10pt` and `twocolumn` are already the defaults — don't restate them unless deviating.

### Class options (choose at most one per category)

| Category | Options | Notes |
|---|---|---|
| Major mode | `conference`, `journal` (default), `technote`, `peerreview`, `peerreviewca` | Use `conference` for this paper. `technote` should be paired with `9pt`. |
| Draft | `draft`, `draftcls`, `draftclsnofoot`, `final` (default) | `draftcls` keeps draft mode confined to the class (figures still render); plain `draft` puts every loaded package into draft mode too. |
| Paper size | `letterpaper` (default), `a4paper`, `cspaper` | Use `letterpaper` unless the venue explicitly says otherwise. `cspaper` is only for when Computer Society editors request it. |
| Columns | `onecolumn`, `twocolumn` (default) | IEEE submissions are always two-column; `onecolumn` is for draft-mode review only. |
| Society mode | `comsoc`, `compsoc`, `transmag` | None by default. Don't invoke `comsoc`/`compsoc` for a standard IEEE conference paper unless specifically instructed — easy to confuse `comsoc` (Communications Society) with `compsoc` (Computer Society). |
| Misc | `romanappendices`, `captionsoff`, `nofonttune` | Rarely needed; `romanappendices` numbers appendices I, II, ... instead of A, B, ... |

### Conference-mode command lockouts

These commands are **journal-only** — in conference mode they silently swallow their
argument and print a one-shot console warning instead of erroring:

| Locked-out command | Normal use |
|---|---|
| `\thanks{...}` | Author footnote (funding, etc.) |
| `\IEEEPARstart{X}{xyz}` | Drop-cap first paragraph letter |
| `\IEEEbiography{...}{...}` / `\IEEEbiographynophoto{...}` | Author bio blocks |
| `\IEEEpubid{...}` / `\IEEEpubidadjcol` | Publication ID stamp |
| `\IEEEmembership{...}` | "Member, IEEE" style credential text |
| `\IEEEaftertitletext{...}` | Text inserted after the title block |

**Never manually add a publication ID** — `\IEEEpubid` is locked out anyway; IEEE inserts
this at publication time and the class already reserves the margin space for it.

If a draft genuinely needs one of these (rare — nonstandard for a conference submission),
restore them with `\IEEEoverridecommandlockouts` in the preamble, placed before `\begin{document}`.

### Never hand-tune the class

Do not override margins, fonts, baseline spacing, or column style — no `geometry.sty`, no
`pslatex`/`mathptm` font swaps, no manually shrinking an equation's font size to make it
fit. This is the HOWTO's explicitly called-out #1 category of user error ("doing too much
rather than too little"): IEEE's production process resets non-compliant values, and
authors who try to squeeze in extra content this way can trigger overlength charges.
`\CLASSINPUT...` override macros exist in the class but are documented as producing
non-compliant output — don't use them for a real submission.

### Package load order

- **`amsmath` before `cases.sty`** — if `cases.sty` loads first, `\subequations` gets
  redefined and throws `Command \subequations already defined`.
- **`comsoc` mode** requires a Times-compatible math package (`newtxmath`, `mtpro2`,
  `mt11p`, or `mathtime`); if none is loaded, `IEEEtran.cls` force-loads `newtxmath` itself
  with a `** Times compatible math font not found, forcing.` warning. Not relevant unless
  `comsoc` is actually in use.

### Build

- pdfLaTeX is **mandatory** if any figure is anything other than EPS (PNG/JPG/PDF all
  require it) — plain LaTeX+dvips only works for pure-EPS figure sets.
- TinyTeX PATH setup and `latexmk` invocation are identical to the dissertation build — see
  [`latex-report-build.md`](./latex-report-build.md) rather than duplicating the export
  command here.

## Pattern Checklist

- [ ] `\documentclass[conference]{IEEEtran}` — no redundant `10pt`/`twocolumn` options
- [ ] No `\thanks`, `\IEEEPARstart`, `\IEEEbiography`, `\IEEEpubid`, `\IEEEmembership`, or
      `\IEEEaftertitletext` used without understanding they're locked out in conference mode
- [ ] No `geometry.sty`, manual font substitution, or hand-tuned spacing/margins
- [ ] `amsmath` loaded before `cases.sty` if both are used
- [ ] Figures are EPS, or the build uses pdfLaTeX

## When to Apply

Any `.tex` file under `college/mydeliverables/3rd-Review/journal/` targeting `IEEEtran` in
conference mode, or when choosing/reviewing `\documentclass` options for this paper.
