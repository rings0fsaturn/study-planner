# Handoff — Phase 2 wayfinder, Wave 0 (2026-07-31)

Baton for a **new session** to work Wave 0 of the Phase 2 chart with the `wayfinder` skill.
Canonical artifact = GitHub map [#9]; index = `.work/plans/active/2026-07-31-phase2-wayfinder/`.

Wave 0 tickets (grilling decisions, one per session, order flexible — start with #10):
- **#10** App IA & navigation for Assessments + Practice
- **#11** Assessment types, formats & scoring spec
- **#15** Persistence & local-first fit

---

## Paste-ready prompt

```
/wayfinder 9 10

Work through the Phase 2 wayfinder map (GitHub issue #9, repo NotTheRealRohit/study-planner-web)
in "work through the map" mode. This session: resolve Wave 0, ticket #10 (App IA & navigation for
Assessments + Practice). One decision ticket per session — do NOT resolve more than one.

Context you must load first:
- Read the map #9 (low-res view: destination, Notes, Decisions so far, fog, out-of-scope).
- Read .work/plans/active/2026-07-31-phase2-wayfinder/PLAN.md for the locked decisions + wave order.
- Standing principle: this is an M.Tech CAPSTONE — feature-rich and complete, NO ship-fast / MVP /
  deferral tradeoffs. Development cost is not a constraint.
- Research already banked: research/external/open-notebook-findings.md (port its patterns, do NOT run
  it as a service) and research/external/code-sandbox-comparison.md (#16 resolved = self-host Judge0 CE).

How to work the ticket:
1. Claim it — assign #10 to me (NotTheRealRohit) before any work.
   gh env: export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2-)
   gh at /opt/homebrew/bin/gh. (.env.git.local is gitignored; never print/commit the token.)
   GraphQL sometimes returns transient EOF — just retry.
2. Resolve via the grilling + domain-modeling skills: one question at a time, each with your
   recommended answer; look up facts in the repo (don't ask me for them); put decisions to me.
   Ground #10 in apps/app/src/pages/, NavBar, AppShell, and the react-router-v7-basename rule.
3. On resolution: post the answer as a resolution comment on #10, close #10, and append a one-line
   pointer to the map #9 "Decisions so far".
4. Update .work: append a dated entry + next-action to
   .work/plans/active/2026-07-31-phase2-wayfinder/VERIFICATION.md, tick #10 in PLAN.md, and refresh
   the STATUS.md row. Graduate any fog the answer sharpens into new tickets (create-then-wire); rule
   anything past the destination out of scope instead of resolving it.

After #10, start a fresh session and repeat for #11, then #15 (both independent — can run in
parallel sessions). Frontier query: gh issue list --label wayfinder:phase2 --state open.
```

---

## Notes for the next agent

- **One ticket per session** is a hard wayfinder rule (research tickets are the only exception, and Wave 0 has none).
- #10, #11, #15 are mutually independent, so they can be run as **parallel sessions** if you want; expect concurrent edits to the tracker and the `.work/` files.
- Wave 0 unblocks nothing directly by itself, but #11 + #15 together unblock **#19** (grading → mastery) later, and #10 frames where everything lives.
- If a Wave-0 answer reveals new sharp questions, create tickets and wire them; if it reveals something beyond the destination, close it into the map's **Out of scope** section.
- Do not commit `.work/` unless asked; it is tracked but changes are currently uncommitted.
