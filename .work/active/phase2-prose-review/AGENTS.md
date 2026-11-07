# phase2-prose-review - task-local notes

Review-only task for `college/mydeliverables/Phase-2-report/phase2-report/chapters/` STE-flavored plus humanizer passes.
Build task stays in `active/phase2-report/`. Never build, draft, or restyle from here. Work in two passes: the review pass outputs findings plus exact fix spans only; the apply pass edits the chapter and only on explicit request.

## Read order

1. `.work/STATUS.md` (phase2-prose-review row)
2. `state.md` (this dir) for current chapter and next step
3. `SCRATCHPAD.md` for the running session log
4. `.work/specs/phase2-prose-review-ste-humanizer.md` for the review contract
5. `../phase2-report/plan/CHAPTERS.md` for the pinned split
6. Target chapter file plus `REPORT_WRITING_GUIDE.md`, ste-writing and humanizer skills

## Review protocol (retro from Ch01 2026-10-22)

Lint first, judge second. Never count by eye or by subagent alone.
1. Read the full chapter file with Read, never from a 500-char preview. Truncation merged two Ch01 sentences into one and broke counts.
2. Run `ste_check.py` in this dir for every count and flag row. It strips LaTeX commands, replaces `~` with space, drops citations and math to one token, and protects `et al.` plus decimals plus `Section~2.1` when splitting. Never hand-count: naive `split()` counts `\item` and `\textbf` as words, and the Ch01 hand count of 14 missed the deterministic 13.
3. Attach lint output to exactly one judgment pass. Ch01 ran two parallel counters that disagreed and needed a full manual recount. One counter plus one judge is cheaper and more accurate.
4. Reserve subagents for nuance only: is `robust` technical, is a 3-item list a real triad, does a contrast carry new information per humanizer §1.
5. Check hidden deps before judging numbers: `phase1-report/` prose for recap claims, live code grep for each named gate, route, or client, `main.tex` for bib keys in first-citation order, `research/doc/2026-10-22-*` for live endpoint numbers.
6. Apply at most two STE passes per chapter. Fix smallest span that removes the violation. Never drop a fact to meet a length cap. Keep the longer sentence and flag it.
7. In the apply pass, fold a word-level fix and a paragraph split on the same para into one edit. Ch02 needed 16 edits; the combined Mai and Uzun edits each saved a turn.
8. Verify every new finding against file bytes before planning it.
Re-read the exact cited line first: the Ch03 re-reviewer hallucinated a `ghcr.io/engineer/man/piston` excerpt that one `sed -n '40p'` disproved, so a finding with a false excerpt is rejected, never planned.
9. Treat prompt ground-truth lines as stale until rechecked.
The 03-review prompt's own retrieval line (0.77 slash 0.97 slash 0.858) was superseded by `research/doc/2026-10-22-reranked-754.md` plus the Ch06 verdict table, so check the newest dated evidence under `research/doc/` plus the consuming chapter before passing any number.
10. Grep stable terms across all chapters before judging term stability.
Ch03's `server-side arm` stood alone against `authoritative arm` in Ch01, Ch02, and Ch04, and one grep settled it, so run the term grep in every chapter prompt.
11. Metrics travel with their corpus-split label.
The 0.77 slash 0.97 slash 0.858 set belonged to the retired 788 split while 0.67 slash 0.90 slash 0.797 belonged to the 754 split, so flag any metric whose split label is missing or mismatched as a guide grounding issue.
12. Scope the second judge to the linter's blind spots once STE and humanizer both read clean.
The Ch03 blind re-review confirmed all 9 STE rows and added only guide findings on terms and grounding, so order a guide-scoped brief instead of a full re-review at that point; full re-review stays mandatory only while fail-tier hits remain.

## Reviewer rule (flavored wins, guide register wins on passive)

- Bar is STE-flavored, not strict. Guide register overrides on passive: third-person passive-leaning technical body (`was implemented`, `was compared`) is allowed. Flag passive only when active is clearer with a known actor.
- `using` stays in flavored mode. Strict `use` or `with` swap is not required.
- `robust` and `gated` stay only with a named metric or lock behind them (`gated reveal` with confirm step). Bare figurative use goes.
- Phrasal ban list from Ch01, flag every sighting: `sets out`, `wired into`, `feeds back into`, `hands over`, `draws on`, `stand in for`, `carries into`. Fixes: `describes`, `linked to`, `sends to`, `gives`, `uses`, `replaces`, `passes to`.
- American spelling always: `realized`, `organized`, never `realised`.
- Abbreviation defined at first use in the chapter (`Cumulative Sum (CUSUM)`), then bare.
- Sentence caps: 25 words descriptive, 6 sentences per paragraph. At-cap sentences pass: 25 words and 6 sentences are the cap, not past it, so never hand-flag them (NFR-9 held 25 words, the Ch04 roadmap holds 6 sentences); the script already encodes this. Roadmap paragraphs run long by nature (Ch01 had 6 for 5 subsections). Note guide 2-4 preference as info, fail only on STE 6-sentence cap. Standard split points for over-long lit paras are the project-contrast pivots: `Against this`, `The project therefore`, `The limitation`, `The feedback copy`, `This project answers` (Ch02 retro).
- Humanizer hard fails: §1 contrasts with empty negative half, §2 repeat closers, §6 forced triads, §8 any em or en dash in body, §12 `quietly` plus bare `robust`, §19 `\textbf` emphasis in body prose. LaTeX `--` in body prose renders an en dash, so compounds take a single hyphen (`Transformer-Bayesian`); TikZ `--` arrows are code and stay excluded (Ch02 retro).
- Table cells count as body prose for STE 8.1: separate cell fragments with commas, never semicolons (Ch02 retro).
- Keep project terms stable across chapters: `schedule regeneration`, `feedback copy`, `authoritative arm`, `self-directed learner`. Do not rename one chapter without checking all seven.

## Scope hygiene

- Only files this task owns: `active/phase2-prose-review/*`, `specs/phase2-prose-review-ste-humanizer.md`, STATUS row for phase2-prose-review.
- Parallel sessions share this checkout. `git status --short` before every edit. Never stage or touch `active/phase2-report/*`, `college/**/main.pdf`, or research evidence files.
- STATUS.md is already dirty from the build session. Append the review row by anchoring on the last Read, never rewrite the whole Active table.

## Toolchain gotchas (this host)

- `ste_check.py` ships in this dir (stdlib-only, underscore name so tests can import it, matching `scripts/full_app.py`). Run it for the lint step and re-run it for verify: `python3 ste_check.py chapters/02-literature-survey.tex`. `--strict`, `--json`, `--add-phrasal`, `--abbr` documented in `--help`. Golden tests pin Ch01-Ch03 clean after the fix pass; 36 tests run via `.venv/bin/python -m pytest .work/active/phase2-prose-review/test_ste_check.py`.
- TinyTeX builds belong to the build task only. This task never runs `latexmk` and never copies `main.pdf`.
- `node_modules` is symlinked to Linux fs. No cold `pnpm install`.
