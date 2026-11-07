# Prompt - Ch03 requirements STE + humanizer review

Target: `college/mydeliverables/Phase-2-report/phase2-report/chapters/03-requirements.tex` (79 lines, Sections 3.1 to 3.4 plus Table `tab:hardware` plus Table `tab:software` plus FR-1 to FR-15 plus NFR-1 to NFR-9, no equations, no figures, no citations).

## Read first (in order)

1. `.work/active/phase2-prose-review/AGENTS.md` for the lint-first protocol and reviewer rule.
2. `.work/specs/phase2-prose-review-ste-humanizer.md` for the contract.
3. Target chapter in full with Read. Never judge from previews.
4. `.agents/skills/ste-writing/SKILL.md` (flavored), `.agents/skills/humanizer/SKILL.md`, `college/mydeliverables/REPORT_WRITING_GUIDE.md` (roadmap shape, honest numbers, guide voice).
5. Live files only where the chapter names a version or number: `docker-compose` files plus `services/embedder/docker-compose.yml` for the sidecar and sandbox, `.env.example` plus factory defaults for providers, `package.json` files for React plus Vite plus Vitest, `services/intelligence` requirements for Python plus FastAPI. Grep the file before calling a number invented.
6. `.work/STATUS.md` archive rows for ground truth beside the chapter numbers: retrieval floor 0.77 slash 0.97 slash 0.858, groundedness 0.867, days span 32.

## Do

1. Lint first with the script: run `python3 .work/active/phase2-prose-review/ste_check.py <target>` from the repo root and attach its rows to the judgment pass; do not hand-count. It already strips LaTeX commands, replaces `~` with space, drops `\texttt` wrappers and `FR-`/`NFR-` labels from counts, counts words per sentence (fail past 25) and sentences per paragraph (fail past 6), and flags British spellings, present or past perfect, semicolons, contractions, the 7 Ch01 phrasals, `quietly` plus bare `robust`, body en dashes, and `\textbf` emphasis. Chapter-specific notes: `stand in for` in the assumptions line is on the ban list; table cells take commas per Ch02 retro (the script flags `;`); Ch03 has no TikZ so every `--` it flags is real; FR/NFR IDs plus NFR lead-ins are requirement labels and stay (the script reports them as info).
2. Judge second, one pass: apply flavored bar from AGENTS.md. Guide passive-leaning body is allowed. `using` stays. `gated` and `robust` stay only with a named lock or metric. `shall` stays in FR/NFR items; it is requirement register, not an STE violation.
3. Ch03 extras: roadmap paragraph names Sections 3.1 to 3.4 with topics. Assumptions line states single learner plus workstation GPU plus hosted model APIs plus synthetic histories as classroom stand-in with the Section~1.4 pointer. Hardware table names the project machine as project machine, not a minimum. Software tiers match the live files read above. FR-1 to FR-8 carry the Phase-I planner and FR-9 to FR-15 add the assessment-verified loop with one question per call, per-family server-side arms, `bkt-v1` difficulty, gated reveal, advisory copy, mixed practice, verdict replan. NFR-1 to NFR-6 carry Phase-I qualities with NFR-2 restated for the GPU and NFR-7 to NFR-9 add measurable Phase-II floors. Check numeric cross-refs (`Section~3.1`, `Table~\ref`). Check project terms stay stable (`schedule regeneration`, `feedback copy`, `authoritative arm`, `self-directed learner`).
4. Never edit the chapter in this pass. Output findings only.

## Return

Table rows as `file:line - rule - excerpt - minimal fix`, grouped under STE, humanizer, guide. Close with two verdict lines: `STE: PASS or FAIL (counts)` and `Humanizer: PASS or FAIL (counts)`. List anything left alone and why in one line.
