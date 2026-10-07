# Reviews - practice-coach-sources-overflow

_Merge rule per PLAN.md: three parallel `code-reviewer` agents after every coding phase (delegate lens, thermo-nuclear lens, impeccable plus a11y)._
_A gate passes only on three APPROVEs (waived minors allowed); findings are fixed inside the producing phase with tests re-run._

## R1 (after Phase 1 tests-only diff, commit f4bd1b3)

- Agent A (open-code-review-delegate lens): REQUEST_CHANGES with 2 correctness items and 3 minors.
- Agent B (thermo-nuclear lens): APPROVE with waived minors (no production abstraction, no file over 1k lines, duplication matches live-spec convention).
- Agent C (impeccable Operate plus a11y lens): REQUEST_CHANGES with 6 correctness items and 4 minors.

### Disposition (all fixed inside Phase 1, unit plus desktop e2e re-run red-for-right-reason)

- A1 (missing `Got it` reachability): fixed, `expectContainedCard` now asserts Dismiss, Go deeper, and Got it by role plus bbox.
- A2 plus C7 (style leaks on RED): fixed, test body wrapped in try/finally.
- A3 (document-wide queries): fixed, render `container` scoping.
- A4 (no attempts-cascade check): fixed, cleanup asserts `question_attempts` cascade like the modeled reference spec.
- A5 (unscoped stuck button): fixed, scoped to the Problem 1 region.
- C1 (no horizontal containment): fixed, `inViewport` checks all four edges.
- C2 (toBeVisible is not reachable): fixed, every action asserts bbox inside the viewport.
- C3 (programmatic focus is not keyboard proof): fixed, shared `expectDisclosureToggle` drives Tab from Dismiss, then Enter, Space, Enter.
- C4 (phone leg never toggles, nothing phone-specific): fixed, phone runs the shared toggle plus 44px target checks.
- C5 (scrollable is not capped-in-card): fixed, list bbox asserted inside the card bbox.
- C6 (not-none passes with 9999px): fixed, ul cap parsed as px and bounded at 200, card pinned to display flex plus overflow hidden plus the exact `min(70vh, 560px)` token (jsdom echoes it raw, verified by probe).
- C8 (fullPage defeats viewport evidence): fixed, viewport screenshots.
- C9 (focusability): covered by the Tab plus toBeFocused leg.
- C10 (console.warn in cleanup): waived, identical to the modeled `practice-guide-live.spec.ts` cleanup pattern.
- Agent B minors: waived by the agent, no change.

### R1 gate

- PASS: every correctness finding is fixed in Phase 1 with tests re-run (unit red on overflowY, desktop e2e red on card-top containment).
- The new Tab/Space and phone toggle legs execute only once the card is contained, so their first execution is the Phase 3 green run.

## R2 (after Phase 2 CSS fix, commit 44b44d1)

- Agent A (open-code-review-delegate lens): APPROVE with waived minors (no contract drift, caps match plan verbatim, phone guard consistent, standards clean).
- Agent B (thermo-nuclear lens): APPROVE with waived minors (no abstraction, no size breach, no spaghetti).
- Agent C (impeccable Operate plus a11y lens): APPROVE with waived minors (order and rhythm preserved, identity intact, focus outline survives, 44px targets intact, dvh guard clears the tab bar, body owns the scroll).

### Disposition

- Waived minors applied: collapsed the duplicated jsdom-rationale comments in `PracticeCoach.test.tsx` (flagged by A and B).
- Waived minors accepted as-is: exact-string `min(70vh, 560px)` pin (stabilizes the plan value), nested scroll regions and short-landscape clipping note (both inside plan-prescribed values, browser proof in Phase 3 decides).

### R2 gate

- PASS: three APPROVEs with explicitly waived minors; no carried findings.

## R3 (final pre-wrap gate)

- Agent A (open-code-review-delegate lens): APPROVE with waived minors (no blocking defect; AC1-AC5 match rules 11/12/16/17/42/53).
- Agent B (thermo-nuclear lens): clean APPROVE (no abstraction, helpers earn their keep, 283-line spec justified).
- Agent C (impeccable Operate plus a11y lens): APPROVE with waived minors (card in viewport both widths, 180px region usable, identity intact, no visual regression in captures).

### Disposition

- Waived minors accepted: no request-id join (stream mocked, rationale in VERIFICATION.md), unclassified desktop transient (recorded honestly, re-run spec on next coach touch), exact-string min() pin (R2-accepted stabilizer).
- Waived design notes re-challenged against captures with no harm found: nested scroll regions show no trap, short-landscape clipping stays theoretical at 720/812px.
- Agent A process note: SESSION END distills `state.md` and resets the scratchpad before WRAP flips STATUS (done below).

### R3 gate

- PASS: three APPROVEs; WRAP authorized.
