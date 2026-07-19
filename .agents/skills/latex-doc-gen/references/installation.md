# LaTeX Installation & Compilation Guide

## Installing LaTeX

### macOS — MacTeX (Recommended)

Full installation (~5 GB, includes everything):
```bash
# Via Homebrew (recommended)
brew install --cask mactex

# Or download the installer directly from:
# https://www.tug.org/mactex/
```

Minimal installation (~100 MB, install packages as needed):
```bash
brew install --cask basictex
# Then install packages via tlmgr:
sudo tlmgr update --self
sudo tlmgr install <package-name>
```

After install, open a new terminal to pick up PATH changes.

---

### Windows — MiKTeX (Recommended)

1. Download the installer from **https://miktex.org/download**
2. Run `basic-miktex-xx.x-x64.exe`
3. During setup, set **"Install missing packages on-the-fly"** → **Yes** (auto-installs packages as needed)
4. After install, open **MiKTeX Console** → Check for Updates

Install `biber` (required for biblatex):
- Open MiKTeX Console → Packages → search "biber" → Install

Alternatively via Chocolatey:
```powershell
choco install miktex
```

---

### Linux — TeX Live (Recommended)

#### With sudo (system-wide install)

Full installation:
```bash
# Debian/Ubuntu
sudo apt-get install texlive-full

# Fedora/RHEL
sudo dnf install texlive-scheme-full

# Arch
sudo pacman -S texlive-most texlive-lang
```

Minimal + manual package management:
```bash
sudo apt-get install texlive-base texlive-latex-recommended
# Install additional packages:
sudo apt-get install texlive-science texlive-pictures texlive-fonts-extra
```

Ensure `biber` is installed:
```bash
sudo apt-get install biber
```

#### Without sudo (user-level install)

**Step 1: Download installer**
- Visit: https://www.tug.org/texlive/acquire-netinstall.html
- Or download directly: https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz

**Step 2: Extract and run installer**
```bash
tar -xzf install-tl-unx.tar.gz
cd install-tl-*/

# Create profile for user installation
cat > texlive.profile <<EOF
selected_scheme scheme-basic
TEXDIR $HOME/texlive/$(date +%Y)
TEXMFCONFIG ~/.texlive$(date +%Y)/texmf-config
TEXMFHOME ~/texmf
TEXMFLOCAL $HOME/texlive/texmf-local
TEXMFSYSCONFIG $HOME/texlive/$(date +%Y)/texmf-config
TEXMFSYSVAR $HOME/texlive/$(date +%Y)/texmf-var
TEXMFVAR ~/.texlive$(date +%Y)/texmf-var
binary_x86_64-linux 1
instopt_adjustpath 0
EOF

# Run installer (takes 10-30 minutes)
./install-tl --profile=texlive.profile
```

**Step 3: Add to PATH**
```bash
echo 'export PATH="$HOME/texlive/2026/bin/x86_64-linux:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Step 4: Install required packages**
```bash
tlmgr install biblatex biber geometry fancyhdr titlesec tocloft \
  hyperref xcolor graphicx caption subcaption amsmath amssymb \
  amsthm enumitem listings algorithm2e booktabs multirow longtable
```

**Verify:**
```bash
pdflatex --version
biber --version
```

---

## Compilation Workflow

### Standard Compile (no bibliography)
```bash
pdflatex main.tex
```

### Full Compile (with bibliography via biblatex + biber)
Run in this exact order:
```bash
pdflatex main.tex    # First pass — generates .aux file
biber main           # Processes bibliography (no .tex extension)
pdflatex main.tex    # Second pass — inserts citations
pdflatex main.tex    # Third pass — resolves cross-references
```

### Watching for Changes (auto-recompile)
```bash
# latexmk handles the full compile sequence automatically
latexmk -pdf -pvc main.tex

# Install latexmk if missing:
# macOS: sudo tlmgr install latexmk
# Linux: sudo apt-get install latexmk
# Windows: available in MiKTeX package manager
```

`latexmk` is strongly recommended for iterative editing — it detects when biber is needed and reruns passes automatically.

---

## When to Use xelatex Instead of pdflatex

Switch to `xelatex` when:
- The document uses custom system fonts (`fontspec` package)
- Unicode characters appear in the source and cause encoding errors
- The template explicitly specifies `\usepackage{fontspec}`

```bash
xelatex main.tex
biber main
xelatex main.tex
xelatex main.tex
```

Note: `xelatex` does not support `inputenc` or `fontenc` — remove those packages from the preamble.

---

## Recommended Editors

| Editor | Platform | Notes |
|--------|----------|-------|
| **VS Code + LaTeX Workshop** | All | Best experience; live PDF preview, syntax highlighting, auto-compile |
| **Overleaf** | Browser | Zero-install, great for collaboration |
| **TeXstudio** | All | Feature-rich dedicated LaTeX IDE |
| **Vim + vimtex** | All | For terminal users |

### VS Code Setup
1. Install VS Code: https://code.visualstudio.com
2. Install extension: **LaTeX Workshop** (James Yu)
3. Open the `.tex` file — it auto-detects and compiles on save

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `File 'xxx.sty' not found` | Missing package | Install via `tlmgr install xxx` (macOS/Linux) or MiKTeX Console (Windows) |
| `biber: command not found` | biber not installed | Install separately (see above) |
| `Undefined control sequence` | Typo in command or missing package | Check spelling; add the relevant `\usepackage{}` |
| `Overfull \hbox` | Text exceeds line width | Add `\sloppy` locally or break long words with `\-` |
| `I found no \bibstyle command` | Wrong bibliography setup | Ensure `\usepackage[backend=biber,...]{biblatex}` is in preamble |
| `! Missing $ inserted` | Math outside math mode | Wrap math in `$...$` or `\(...\)` |
| `Too many }'s` | Mismatched braces | Count `{` vs `}` in the offending line |

---

## Output Files Reference

After compilation, LaTeX produces several auxiliary files — these are safe to delete and regenerate:

| File | Purpose |
|------|---------|
| `.pdf` | The compiled document (keep) |
| `.aux` | Cross-reference data (regenerated) |
| `.bbl` | Processed bibliography (regenerated) |
| `.bcf` | biber control file (regenerated) |
| `.log` | Compilation log — read this when errors occur |
| `.toc` | Table of contents data (regenerated) |
| `.lof` / `.lot` | List of figures/tables (regenerated) |
| `.out` | Hyperref bookmarks (regenerated) |

Clean auxiliary files:
```bash
latexmk -c        # Clean all except PDF
latexmk -CA       # Clean everything including PDF
```
