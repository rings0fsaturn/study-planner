# Scratchpad — third-review-report-work / research (stage 3: independent verification of doc 04)
_Plan: (no PLAN.md — pure documentation-gathering task, ceremony=normal) · Log: this file doubles as log until work-journal wrap · Updated: 2026-07-03T22:05 (verification + corrections complete, handing off to work-journal)_

## Now
**Verification complete, doc 04 corrected.** 8 independent agents (era 0-6 + 1 meta-auditor)
each re-fact-checked every specific, checkable claim in `04-application-evolution-trace.md`
against fresh `git log`/`git show`/`grep` output, instructed to actively hunt for errors
rather than confirm the original text. Findings, synthesized and applied as inline
corrections plus a new "Verification notice" section at the top of the doc:

- **Systematic, non-error pattern**: eras 1/2/4/5/6's stated commit counts (16/58/42/57/48)
  initially looked "off by one" vs a naive `git log START..END`. Root cause: every era
  consistently counts inclusive of its own start SHA (`START^..END`), undocumented until now
  — added a counting-convention footnote to §0, no numbers changed (they were internally
  consistent, just under an unstated convention).
- **Real, standalone error**: §0 claimed "341 commits" total — doesn't reconcile under any
  interpretation I or the agents tried; corrected to reference the actual 304 (§1's sum).
  Caught by me directly (not by any of the 8 agents — none were specifically asked to check
  this number, since I didn't include it in their prompts; worth remembering for next time:
  a meta-auditor prompt should include a full read-through checklist, not just the specific
  numbers I thought to ask about).
- **Real error**: era 0's topology explanation (why naive count is 41 not 37) misattributed
  the mechanism to the wrong parent commit. Corrected.
- **Completeness gap**: era 0 silently omitted 5 real commits from its own narrated set.
  Added a one-line mention.
- **Real error**: era 3's "reviewer-verified... 9/12 reality" claim — no review actually
  happened in that era (VERIFICATION.md sections still "pending"), and 9/12 was the wrong
  phase's number (discovery commit's own evidence was 10/12). Corrected.
- **Overstatement**: era 4's "verbatim" calibrator lift had one added guard clause. Now
  "near-verbatim" with the specific diff named.
- **Imprecision**: era 5's quoted user direction was a paraphrase blend, not verbatim; its
  "first commit with booking vocabulary" claim conflated app-code vs planning-doc first-use
  dates (four days vs three). Both corrected.
- **Structural bug**: "Cross-era resolutions" is §9, not §8 as five internal citations
  claimed (plus one dangling, non-existent "§8.3"). All fixed.
- **Staleness (not an original error)**: the coda (§10) claimed "no code commits for
  2026-07-03" and "Phases 6-8 zero implementation" — both now false because a *concurrent,
  unrelated* session (`2026-07-02-material-session-ui-bugs`, Phase 6) landed `33a98c9` +
  `f70126b` later the same day, after doc 04's own commit. Updated §10 to show both the
  original point-in-time snapshot and what's changed since, rather than chasing a moving
  HEAD.
- Everything else (the large majority of claims: SHAs, timestamps, diff contents, quoted
  decisions, numeric results) held up exactly. No fabrication or unfounded claim was found
  in the substantive research content — only counting-convention gaps, one standalone
  number error, one unsupported "reviewer-verified" phrase, one overstated adjective, one
  imprecise quote/claim pairing, and a section-numbering bug.

## Alignment
Complete, on scope. User's original ask (git-log-grounded evolution trace, no false/stale
info, via agents, using /scratchpad + /work-journal) is now satisfied via the
verify-and-correct path they explicitly chose over redo-from-scratch or accept-as-is.

## Open
— none.

## Blockers
— none.

## Deferrals
— none.

## Checklist
- [x] Read docs 01-04 + prior scratchpads for context.
- [x] Cleaned up stale pre-clear task list; created stage-3 tasks.
- [x] Wrote this scratchpad seeded with the stage-3 plan.
- [x] Launched 8 parallel independent verification agents (era 0-6 + meta).
- [x] Collected all 8 reports; cross-checked one additional number myself (the "341"
      total in §0) that no agent's prompt specifically covered.
- [x] Applied all corrections to `04-application-evolution-trace.md` via targeted edits:
      new verification-notice section, §0 footnote, §1 total explanation, era 0/2/3/4/5
      inline fixes, section-number fixes (§8→§9 ×3, dangling §8.3→§8), §10 coda rewrite.
- [x] Sanity-check grep pass confirming no stray unfixed "§8"/"341"/"verbatim" mislabels
      remain (the 4 hits found are all intentional: the notice's own prose, the correct
      §8→Era-6 reference, "near-verbatim", and an unrelated "verbatim-grounded" heading).
- [ ] Work-journal wrap: update `.work/STATUS.md`'s row to link doc 04 + note the
      verification pass; resolve the `SCRATCHPAD-research-2.md` uncommitted deletion;
      decide whether to commit this stage's changes.

## In-flight edits
- `04-application-evolution-trace.md` — fully edited, no further changes planned.
- This scratchpad — final state before handoff.
- Nothing else touched. Did NOT touch `.work/plans/active/2026-07-02-material-session-ui-bugs/`
  (concurrent, unrelated, still active).

## Decisions in force
- Corrections were applied as visible, dated edits with an explanatory "Verification
  notice" section (matching the established pattern from docs 01-03's "Correction notice"
  sections) rather than silently rewriting history — so a reader can see what changed and
  why, consistent with "no false or stale info" meaning corrected-and-shown, not
  quietly-fixed.
- Did not attempt to keep chasing the concurrent session's advancing HEAD for an exact
  current commit count — instead documented the mechanism (this doc's own commit plus
  same-day unrelated work both add to any live recount) so the doc stays honest without
  needing to be re-edited every time the other session commits again.
- STATUS.md wrap (linking doc 04, noting the verification pass) is being done carefully
  against a fresh read of STATUS.md at wrap time, since the concurrent session has already
  modified that file once during this stage (Phase 6 completion) — never blind-overwrite it.

## Resolved (recent)
- All 8 verification agents' findings reconciled and applied — see "Now" above for the
  full list.
- The "341 commits" error — caught only via my own direct check, not any agent's — is a
  reminder that a meta-auditor should be asked to read the *whole* document for
  free-floating numeric claims, not just a pre-selected checklist, next time this pattern
  (verify-an-existing-doc) comes up.
