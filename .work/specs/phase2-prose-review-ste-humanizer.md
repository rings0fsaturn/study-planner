# Spec - phase2-prose-review: STE + humanizer chapter review

_Task: phase2-prose-review - Status: active - Updated: 2026-10-22_

## Contract

Review every line of `college/mydeliverables/Phase-2-report/phase2-report/chapters/` for STE-flavored plus humanizer compliance.
Start with 01 (done 2026-10-22), then 02 through 07 plus appendix, one chapter per pass.

## Authorities (read before each chapter review)

1. `.agents/skills/ste-writing/SKILL.md` - STE-flavored mode: 25-word max descriptive sentences, simple tenses, active voice when actor known, short words, one name for one thing, 3-word noun cap, articles restored, no semicolons, no contractions, no phrasal verbs.
2. `.agents/skills/humanizer/SKILL.md` v3.1.0 - 26 patterns, strongest first: §1 Not X but Y, §2 closers, §6 triads, §8 no em or en dashes in final text, §12 AI words, §13 inflated significance, §19 bold decoration.
3. `college/mydeliverables/REPORT_WRITING_GUIDE.md` - human researcher voice, roadmap paragraph per chapter, 4-beat lit entries in Ch2 only, honest numbers with mechanism, third-person passive-leaning, tense discipline, numeric cross-refs.
4. `.work/active/phase2-report/plan/CHAPTERS.md` - pinned 7-chapter split.
5. `college/mydeliverables/Phase-2-report/phase2-report/main.tex` - bibliography in first-citation order, labels, captions stay verbatim.

## Scope rules (from phase2-report AGENTS.md 2026-10-20)

- STE-flavored plus humanizer apply to body prose only.
- Boilerplate, code, identifiers, captions, labels, bibliography stay verbatim.
- `phase1-report/` is untracked read-only source: read it, leave it alone.
- Never invent numbers. Ground every metric, gate, route, client in Phase~I prose or live code.
- Edit under `college/` only the chapter file under review.

## Done means

Per chapter: findings list as `file:line - rule - excerpt - minimal fix`, verdict PASS or FAIL per STE and per humanizer, and exact edit spans ready to apply.
