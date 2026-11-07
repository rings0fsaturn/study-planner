# How to Build the Phase-2 Report PDF on Windows

Share this whole `phase2-report` folder as-is.
Your friend needs nothing except the files already inside it plus free tools installed once below.
All commands are for Windows PowerShell.
No Python code runs during the build.
Python is only checked first because you asked for it.

## What is in this folder

`main.tex` is the master file.
It pulls in the front matter, the definitions table, the bibliography, and every chapter.
Each chapter is one text file under `chapters/`, named `01-introduction.tex` through `07-conclusion.tex` plus `appendix.tex`.
`PESU-new-logo.png` and `screenshots/*.png` are the images the report embeds.
The finished PDF is generated next to `main.tex`.

## Step 0 - Open PowerShell in this folder

Open the `phase2-report` folder in File Explorer.
Click the address bar, type `powershell`, and press Enter.
Every command below runs from this folder, the one that contains `main.tex`.
Confirm with `dir main.tex`.

## Step 1 - Check whether Python is present

Run `python --version`.
If a version like `Python 3.10` or newer prints, Python is ready and you can skip to Step 3.
If you see `'python' is not recognized`, install Python next.

## Step 2 - Install Python only if Step 1 failed

Download the installer from `https://www.python.org/downloads/`.
Run it, tick `Add python.exe to PATH`, and finish the wizard.
Close and reopen PowerShell, then repeat Step 1 to confirm.

## Step 3 - Check whether LaTeX is present

Run `pdflatex --version`.
Run `latexmk --version`.
Run `perl --version`.
All three must print a version.
`pdflatex` is the compiler, `latexmk` is the build tool, and `perl` is required because `latexmk` is a Perl script.
`latexmk --version` can work even when `perl --version` fails because TinyTeX runs its bundled Perl internally.
To make the `perl --version` check pass, run `$env:PATH += ";$env:APPDATA\TinyTeX\tlpkg\tlperl\bin"` once and repeat `perl --version`.
Only install Strawberry Perl if the build itself complains that `perl` is missing.
If all three print versions, skip to Step 5.

## Step 4 - Install LaTeX (one time only)

Pick exactly one option.
Option A is the smallest download and needs no admin rights.
Option B is the easiest for beginners because it auto-installs missing packages.

Option A - TinyTeX.
In PowerShell run `Invoke-WebRequest 'https://tinytex.yihui.org/install-bin-windows.ps1' -OutFile 'install-bin-windows.ps1'; powershell -ExecutionPolicy Bypass -File "install-bin-windows.ps1"`.
Delete the installer afterwards with `Remove-Item -Force install-bin-windows.ps1, install-bin-windows.bat -ErrorAction SilentlyContinue`.
Close and reopen PowerShell afterwards.
If a new PowerShell still says `pdflatex is not recognized`, reload PATH once with `$env:PATH = [Environment]::GetEnvironmentVariable("Path","User") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine")` and repeat Step 3.
Do not use the older `install-bin-windows.bat` wrapper from PowerShell.
It fails because its internal `curl.exe` call quotes the URL with single quotes, so the download never happens.

Option B - MiKTeX.
Download from `https://miktex.org/download`, run the installer, and accept the defaults.
Open MiKTeX Console, set `Install missing packages on-the-fly` to `Yes`, then skip to Step 6.

After installing, repeat Step 3.

## Step 5 - Install the report packages (TinyTeX only, one time only)

MiKTeX users skip this step.
TinyTeX users run these two PowerShell commands.
Run `tlmgr update --self` first.
TinyTeX refuses to install anything before its own updater is current.
Then run `tlmgr install latexmk booktabs enumitem float caption subcaption amsmath amssymb pgfplots titlesec hyperref fancyhdr geometry xcolor listings tools psnfss helvetic rsfs`.
Two warnings are expected and harmless: `package amssymb not present in repository` and `package subcaption not present in repository`.
Both files are already provided (`amssymb.sty` by `amsfonts`, `subcaption.sty` by `caption`).
Confirm with `kpsewhich amssymb.sty` and `kpsewhich subcaption.sty`, each must print a path.
If the first build fails on `Font rsfs10 ... not loadable`, run `tlmgr install rsfs` and rebuild.
If a later build complains `File '<name>.sty' not found`, run `tlmgr install <name>` for that name and rebuild.

## Step 6 - Compile the PDF

Run `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex`.
Let it run to the end.
It runs `pdflatex` several times automatically to resolve the table of contents, figure numbers, and cross-references.
The output file is `main.pdf` in the same folder.

## Step 7 - Check the result

Open `main.pdf` from File Explorer.
Confirm the title page, certificate, declaration, acknowledgement, abstract, table of contents, list of figures, list of tables, chapters 1 to 7, appendix, and bibliography all appear.
Check that the screenshots in chapter 5 render instead of showing empty boxes.
If you need the submission filename, run `Copy-Item main.pdf ROHITSAJI-PES2PGE24DS201-REPORT.pdf` and share the copy.
Keep `main.tex` as the source and treat the PDF as a generated artifact.

## Step 8 - Edit text and rebuild

Edit only the `.tex` files.
Chapter text lives in `chapters/01-introduction.tex` through `chapters/07-conclusion.tex` and `chapters/appendix.tex`.
Title, front matter, and bibliography live in `main.tex`.
Use a plain-text editor such as Notepad, VS Code, or TeXworks.
Do not use Word.
Save the file, then run the exact same command from Step 6 again.
`latexmk` rebuilds incrementally, so the second build is faster.
There is no separate clean step for normal edits.

## Step 9 - Clean only when needed

A normal edit never needs cleaning.
If the build behaves strangely after moving files, run `latexmk -c main.tex` to remove temporary `.aux`, `.log`, `.toc`, `.lof`, `.lot`, and `.out` files.
The PDF is kept.
Use `latexmk -C main.tex` only if you want to delete the PDF as well and rebuild from zero.

## Troubleshooting (Windows)

`'pdflatex' is not recognized` means LaTeX is not on PATH.
Close and reopen PowerShell, then repeat Step 3.
If it still fails, reload PATH once with `$env:PATH = [Environment]::GetEnvironmentVariable("Path","User") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine")`, then repeat Step 3.
`'latexmk' needs perl` means add the bundled Perl with `$env:PATH += ";$env:APPDATA\TinyTeX\tlpkg\tlperl\bin"`, then repeat Step 3.
Install Strawberry Perl from `https://strawberryperl.com/` only if the build itself complains that `perl` is missing.
`tlmgr itself needs to be updated` means run `tlmgr update --self` first, then rerun the install command.
`package amssymb not present` and `package subcaption not present` are expected and harmless when those two names appear.
Confirm with `kpsewhich amssymb.sty` and `kpsewhich subcaption.sty`, then continue with Step 6.
`Font rsfs10 ... not loadable` means the calligraphic font package is missing.
Run `tlmgr install rsfs` and rebuild.
`File '<name>.sty' not found` means one LaTeX package is missing.
Run `tlmgr install <name>` for TinyTeX or let MiKTeX auto-install it, then rebuild.
`Cannot find image` means PowerShell is in the wrong folder.
Run `dir main.tex` to confirm, `cd` back to the folder containing `main.tex`, then rebuild.
A stale PDF after editing means the editor saved to a different copy of the folder.
Confirm the edited file path, save, and rebuild.
