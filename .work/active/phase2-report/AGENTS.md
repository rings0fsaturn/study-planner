# phase2-report — task-local notes

Full dissertation at `college/mydeliverables/Phase-2-report/phase2-report/`
(Phase-I recap + Phase-II focus). Ch1-Ch7 plus Appendix A drafted; the fresh
examiner build is 47pp Letter, 0 errors, 0 undefined, 3 overfull. The
2026-10-23 examiner review rates the fresh build 6.0/10 and records the P0/P1
findings and rating-10 batches in
`plan/2026-10-23-examiner-review-rating-10-plan.md`. The checked-in `main.pdf`
is stale (05:27) against the 09:27 sources; rebuild before submission. Front
matter restyled 2026-10-22 (cover cream plus border, one page; certificate
white plus border plus logo plus viva table plus 3 signatures); do not restyle
either without asking.

## Read order

1. `.work/STATUS.md` (phase2-report row)
2. `state.md` (this dir) for current state and next step
3. `plan/GRILL.md` for settled grill decisions (Q1-Q53 + G1 RESOLVED;
   never re-open resolved Qs; Ch4 starts Q22, Ch5 Q27, Ch6 Q38, Ch7 Q48)
4. `plan/CHAPTERS.md` for the pinned 7-chapter split
5. `plan/2026-10-23-examiner-review-rating-10-plan.md` for the review findings, P0/P1 batches, and author decisions
6. `SCRATCHPAD.md` for the running session log

## Session protocol

Grill with exactly one question at a time, each carrying a recommendation
and why, and wait for the answer. Record each Q and answer in `plan/GRILL.md`
(Q-numbers keep rising), then `state.md`, `SCRATCHPAD.md`, and the STATUS row
in the same turn.
Anchor every `GRILL.md` append on the full previous Question block
(Question plus Recommendation plus Why), never on the short
Answer/Status tail, and never batch two edits to the same file: the tail matched several Qs and cost repair turns
   twice in the Ch5 session (2026-10-20), and same-file batches
   clobbered each other twice in the Ch3 session.
   A blanket go-ahead records all remaining Qs in ONE GRILL.md edit
   anchored on the last Question block (Ch6 Q42-Q47, 2026-10-22).
Derive every edit's `oldString` from the last Read of that file,
never from memory: a guessed `state.md` anchor missed in the Ch4 session
(2026-10-20) and cost a re-read round trip, while a re-read caught real
Q26 wording drift in the Ch5 session.
Glob for a path before reading it; never guess it.
Check deployment and code reality (compose files, `.env.example`, live
service code) before recommending on any hardware, tier, architecture, or
pipeline question; the Q18 CPU-only call was overturned by the user for
skipping this, while the Q19 JEV check that did it held.
Enumerate models and providers from `.env.example` plus factory defaults
before recommending on any tools, dataset, or parity question; the Ch5
handoff memo omitted the feedback-copy model and the first grep set
followed the memo, so the user caught the muse-spark omission (Q27,
2026-10-20).

## state.md hygiene

`state.md` carries exactly one live Next line, in `## Current state & next`
at the top. Update it every session. Never keep a second Next at the file
bottom; the Ch3 session left the header pointing at Chapter 2 while the
bottom moved on.

## Draft constraints

- STE-flavored plus humanizer apply to body prose only. Boilerplate, code,
  identifiers, captions, labels, and bibliography stay verbatim.
- The STE/humanizer manual pass checks sentence length (split past 25 words), one `Table~` opener per section, hyphens before nouns only, and one hedge per claim (Ch6 2026-10-22); at most two passes.
  Count length with `\ref|...` replaced by a placeholder first: stripping to end-of-line merges sentences and reports false long lines (Ch7 2026-10-23).
  The placeholder must keep the sentence-final stop: a `Section~[\d.]+` pattern swallows the closing period and merges the same false long lines (appendix 2026-10-23).
- Literature entries (Ch2 only) use the 4-beat shape (attribution,
  mechanism, metric, gap) with a real metric and gap in every entry.
- Methodology prose (Ch4 onward) cross-references instead of restating:
  the BKT equation stays where Ch2 put it, Ch2 Fig 2.1 is extended or
  reused but never silently duplicated, and Ch1/Ch3 claims are pointed at,
  not repeated.
- Ground every number and every named gate, route, and client in `phase1-report/` prose or live code reality
  (STATUS archive rows). Grep the gate, route, or client each section names
  before drafting it (Q22 made code-first drafting explicit). Never invent numbers. Paper-side scope without a
  reusable number stays qualitative with the project number beside it,
  labelled as the project's.
- Edit under `college/` only the chapter file the grill cleared.
  `phase1-report/` is untracked read-only source: read it, leave it alone.
- Simple progressive chains may stay inline TikZ in the chapter file,
  matching the Ch2/Ch4 figure precedent (Ch5 `fig:appflow1-5`,
  2026-10-20); reserve the rule-61 standalone plus vector-PDF recipe
  for complex diagrams with lanes, containers, or crossings.

## Front matter (cover + certificate, settled 2026-10-22)

Cover and certificate share one TikZ overlay border (line width 3pt,
0.5in inset from the page edge).
Only the cover carries page color (`\pagecolor{frontpagebg}` with
`\nopagecolor` after its `\newpage`); the certificate stays white.
`frontpagebg` is RGB 246,232,177, sampled from `frontpage-color.png`
with a stdlib zlib PNG decode (no PIL/Pillow or ImageMagick on this host).
Bordered pages default to vertical fill (`\vspace*{\fill}` plus `\vfill`
spread across blocks): top-aligned bordered content reads as broken, and
the certificate needed a respread plus the missing logo on review.
Never build in the repo dir, even for one-line fixes: the 2026-10-22
front-matter session built in place, dirtied the tree with aux files, and
burned cleanup turns (including a failed `rm` from a doubled workdir path).
Always use the /tmp copy-back recipe above.

## Build recipe (rule 60)

1. Copy the report dir to a fresh `/tmp/phase2-XX/` dir.
2. Build there with TinyTeX on PATH, with the tool workdir parameter set
   to `/tmp/phase2-XX/` (running `latexmk` from the repo root silently
   builds nothing: no `main.tex` there, Ch5 session 2026-10-20, repeated
   Ch6 session 2026-10-22 with a wasted rebuild turn):
   `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex`
   Force the verification rebuild with `-g`: after copying an edited chapter into the /tmp dir, a plain run can report up-to-date and skip the draft (appendix 2026-10-23 burned one turn before `-g` surfaced its two Overfulls).
3. Gate the log before copying back: `grep -c "^! " main.log` must be 0,
   `grep -ci undefined main.log` must be 0, and no `Overfull` line may
   touch the drafted chapter (Ch6 2026-10-22: judge-identifier and
   dip-window lines passed the error-free gate and were caught only by
   raster inspection).
   Separate the gate greps with `;`, never `&&`: a zero-match grep exits 1 and kills the rest of the gate (appendix 2026-10-23).
   The lot lines count too: a long caption overfulls in the list-of-tables from the chapter's own caption, so keep appendix captions to one sentence (appendix Table A.2, 2026-10-23).
4. Copy back with an absolute source path (`cp /tmp/phase2-XX/main.pdf`
   into the report dir), `main.pdf` only (never aux, log, toc, lof, lot).
   A bare relative `cp main.pdf ...` from the repo root copies nothing
   (Ch6 session 2026-10-22).
5. Check `git status -- college/` shows only intended files.

## Toolchain gotchas (this host)

- TinyTeX bin resolves per host; this host uses
  `$HOME/.TinyTeX/bin/x86_64-linux`.
- Put TinyTeX on PATH with `export`, not bare `env PATH="..."`: Windows
  PATH spaces split the `env` assignment (Ch7 2026-10-23 burned one turn).
- `tlmgr install rsfs` already ran here: mathptmx requests rsfs10 for math
  minus/fraction internals and the minimal TinyTeX lacked it (fatal,
  no PDF). Full TeX Live ships it, so examiners are unaffected.
- On any font failure, read `/tmp/phase2-XX/missfont.log` first: it names
  the missing font and beats bisecting.
- `ste-lint.py` does not ship with the ste-writing skill (SKILL.md only),
  so apply its manual checklist instead, at most two passes.
- Preview figures on Linux with `pdftoppm -png -r 80 -f N -l M main.pdf`
  in `/tmp/phase2-XX/`, then Read each PNG: rule 61 names macOS-only
  `sips`, and the Ch5 flow figures were verified this way (2026-10-20).
- Keep display equations free of minus inside `\frac` numerators where a
  plain reading works; prefer a defined intermediate (`u = P(L_{n-1})`).
- `mkdir -p` every scratch and preview dir before use: `/tmp/opencode/*`
  was reaped between turns on 2026-10-22 and a `pdftoppm` render failed
  until the dir was recreated.
- Break one verbatim file path per itemize item: `\texttt` never wraps, so three paths in one sentence overful by 101pt (appendix endpoint pointers, 2026-10-23).
- Split a long appendix table with `\ContinuedFloat` (subcaption is already loaded): one table number across two floats with no `main.tex` edit (appendix DDIA Q1-15 plus Q16-30, 2026-10-23).
