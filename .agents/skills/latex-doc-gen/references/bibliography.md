# Bibliography Guide — biblatex + biber

## Setup

In the preamble (before `\begin{document}`):
```latex
\usepackage[
    backend=biber,
    style=ieee,       % citation style — see options below
    sorting=none      % none = citation order; nyt = name-year-title
]{biblatex}
\addbibresource{references.bib}
```

At the end of the document (before `\end{document}`):
```latex
\printbibliography[heading=bibintoc, title={References}]
% heading=bibintoc adds it to the table of contents
```

---

## Compilation Sequence

biblatex requires `biber` (not BibTeX) to process the `.bib` file:

```bash
pdflatex main.tex    # generates .bcf file
biber main           # processes references (no extension)
pdflatex main.tex    # inserts citations
pdflatex main.tex    # resolves page numbers
```

Or with latexmk (recommended — handles order automatically):
```bash
latexmk -pdf main.tex
```

---

## Citation Styles

| Style | Use case | Example output |
|-------|----------|----------------|
| `ieee` | Engineering, CS conferences | [1], [2,3] |
| `numeric` | General technical | [1] |
| `authoryear` | Humanities, some sciences | (Smith, 2021) |
| `apa` | Psychology, social sciences | (Smith, 2021) |
| `nature` | Life sciences | 1,2 (superscript) |
| `chicago-authoryear` | Humanities | Smith 2021 |
| `alphabetic` | CS theory | [Smi21] |

Change the `style=` option in the preamble to switch. The citation commands stay the same.

---

## Citation Commands

| Command | Output example | When to use |
|---------|----------------|-------------|
| `\cite{key}` | [1] or Smith (2021) | Standard citation |
| `\parencite{key}` | (Smith, 2021) | Parenthetical citation |
| `\textcite{key}` | Smith (2021) | Inline: "As Smith (2021) showed..." |
| `\cite[p.~5]{key}` | [1, p. 5] | Page-specific |
| `\cite{key1,key2}` | [1,2] | Multiple sources |
| `\fullcite{key}` | Full formatted reference | Footnote references |
| `\nocite{*}` | (no output) | Include all .bib entries in bibliography |

---

## The .bib File

Create `references.bib` in the same directory as your `.tex` file.

### Journal Article
```bibtex
@article{smith2021deep,
    author    = {Smith, John A. and Jones, Mary B.},
    title     = {Deep Learning for Fault Detection in Automotive Systems},
    journal   = {IEEE Transactions on Industrial Informatics},
    year      = {2021},
    volume    = {17},
    number    = {4},
    pages     = {2345--2356},
    doi       = {10.1109/TII.2021.000000}
}
```

### Conference Paper
```bibtex
@inproceedings{chen2022warranty,
    author    = {Chen, Wei and Liu, Fang},
    title     = {Automated Warranty Claim Evaluation Using Hybrid ML Pipelines},
    booktitle = {Proceedings of the International Conference on Machine Learning},
    year      = {2022},
    pages     = {1234--1243},
    publisher = {PMLR},
    address   = {Baltimore, MD}
}
```

### Book
```bibtex
@book{bishop2006pattern,
    author    = {Bishop, Christopher M.},
    title     = {Pattern Recognition and Machine Learning},
    publisher = {Springer},
    year      = {2006},
    address   = {New York},
    isbn      = {978-0-387-31073-2}
}
```

### Book Chapter
```bibtex
@incollection{lecun2015deep,
    author    = {LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},
    title     = {Deep Learning},
    booktitle = {Nature},
    year      = {2015},
    volume    = {521},
    pages     = {436--444}
}
```

### Technical Report
```bibtex
@techreport{openai2023gpt4,
    author      = {{OpenAI}},
    title       = {{GPT-4} Technical Report},
    institution = {OpenAI},
    year        = {2023},
    type        = {Technical Report}
}
```

### Website / Online Resource
```bibtex
@online{python2023docs,
    author  = {{Python Software Foundation}},
    title   = {Python 3.11 Documentation},
    year    = {2023},
    url     = {https://docs.python.org/3.11/},
    urldate = {2024-01-15}
}
```

### Thesis
```bibtex
@thesis{jones2020automotive,
    author      = {Jones, Alice},
    title       = {Machine Learning Approaches to Automotive Warranty Analysis},
    type        = {PhD Thesis},
    institution = {University of Manchester},
    year        = {2020}
}
```

---

## Citation Key Convention

Use a consistent key format: `authorYEARkeyword`
- `smith2021deep` — single author
- `smithjones2021deep` — two authors
- `smithetal2021deep` — three or more authors
- `ieee2021standard` — organisation as author

Keep keys lowercase, no spaces or special characters.

---

## Multiple .bib Files

```latex
\addbibresource{primary.bib}
\addbibresource{supplementary.bib}
```

---

## Filtering the Bibliography

Print only cited references (default). To subdivide:
```latex
% Print only articles:
\printbibliography[type=article, title={Journal Articles}]

% Print everything else:
\printbibliography[nottype=article, title={Other References}]
```

---

## natbib (Alternative for Older Templates)

Some journal templates use `natbib` instead of `biblatex`. If the template imports `natbib`, use `\bibliographystyle{}` instead:

```latex
\usepackage{natbib}
% ...
\bibliographystyle{plainnat}  % or: ieeenat, apalike, unsrtnat
\bibliography{references}     % no .bib extension
```

Citation commands differ slightly:
- `\citep{key}` → parenthetical: (Smith, 2021)
- `\citet{key}` → inline: Smith (2021)
- `\cite{key}` → basic

Do **not** mix `biblatex` and `natbib` in the same document.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `biber: command not found` | Install biber separately (see installation.md) |
| Citation shows `[?]` or `??` | Run the full compile sequence (pdflatex → biber → pdflatex × 2) |
| `.bib` entry not appearing | Check the citation key matches exactly; check `\addbibresource` path |
| `Package biblatex Warning: File 'main.bcf' is wrong format` | Delete all auxiliary files and recompile from scratch |
| Accented characters broken in names | Use `{\'e}` or enable UTF-8 in .bib with `\usepackage[utf8]{inputenc}` |
