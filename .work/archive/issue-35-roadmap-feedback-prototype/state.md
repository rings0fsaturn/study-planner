# State - issue-35-roadmap-feedback-prototype
_Spec: specs/phase2-tickets/03-roadmap-feedback-prototype.md (ticket #35, parent #32, map #4) · Plan: archive/issue-35-roadmap-feedback-prototype/plan/ · STATUS row: issue-35-roadmap-feedback-prototype · Status: done · Updated: 2026-09-23_

## Current state & next
- **Done 2026-09-23.** All four acceptance criteria met; HITL chose **Variant B - learner-facing learning story with an inspectable evidence trail**; ticket #35 closed as completed; wayfinder exit run finished.
- AC3 + AC4 (the two gaps) closed: choice recorded to URL + localStorage (no roadmap event), and the approved `bkt-v1` vocabulary consumed from the shared engine behind a collapsed `Model context`.
- Wayfinder exit: resolution comment posted on #35 (`issuecomment-5788487293`), ACs ticked in the ticket body, ticket CLOSED, map #4 Decisions-so-far gained the #34 + #35 decision lines and the #20 + #21 cluster annotations (canonical GitHub body + local snapshot `active/phase2-wayfinder/research/map-4.md`).
- Next: #47 Roadmap Feedback implementation (now unblocked) and #50 LLM feedback contract; recommendation + interaction notes are in `research/decisions-35.md`.

## Done so far
- Re-opened the task record via work-journal-orchestrator: `active/issue-35-roadmap-feedback-prototype/` created (state + scratchpad + plan/prompts/research), STATUS Active row added, `_Last reconciled_` bumped to 2026-09-23.
- Audited what existed: prototype at `apps/app/src/prototype/roadmap-feedback/` (tsx + css), dev-only route `App.tsx:173-175`, dev-only entry link `roadmap/RoadmapCalendar.tsx:467-475`; AC1/AC2 already met, AC3/AC4 partial.
- **AC3 closed** - recorded choice: `RecordedChoice {variant?, boundary?}` persisted to URL (`?pick=<variant>&choice=keep|replan`) + `localStorage['prototype:roadmap-feedback:choice']`, with a visible `Recorded:` status line and a `Record Variant X for implementation` control. No roadmap event, no Dexie, no sync (throwaway scope).
- **AC4 closed** - approved vocabulary consumed: projections from `projectMastery` and the one-band recommendation from `recommendBand` (`@study-tracker/progress`), `DEFAULT_BAND` reused from `apps/app/src/assessments/masteryBands.ts`, rendered as an inspectable collapsed `Model context` (`bkt-v1`, `n`, uncertainty, band, target 0.70). No BKT math duplicated (rule 41). Replaced the false `Model v0.1` / `LLM summary` labels.
- **Impeccable Variant B polish**: Marginalia tokens only; removed the non-token `--ochre`; terracotta small text darkened to `--terracotta-d` for 4.5:1; `--text-on-inverted-dim` for story-card secondary text; focus-visible rings on custom controls; 44px coarse-pointer targets; reduced-motion for the meter; dialog a11y (focus trap, Esc, focus restore, `aria-describedby`, `role="radiogroup"`); `aria-live` state pill; grid `align-items: start` (killed the stretched evidence card); mobile date-column width fixed (the "Yesterday" collision).
- **Code review applied** (`open-code-review-delegate` + `thermo-nuclear-code-quality-review`): fixed 5 findings - nested-ternary chains replaced by a typed `STATE_COPY` model + `let view` if/else; duplicated parse logic collapsed into one `normalizeChoice` validator; the `as RecordedChoice` cast replaced by `Record<string, unknown>` narrowing; `ReactNode` annotation removed evolving-`any`; redundant truthiness guard dropped.
- **Verified**: typecheck green, lint green, app suite 935/937 (2 = known WSL TZ flake), `pnpm --filter app build` green and the prototype is tree-shaken from shipped JS (0 hits for its h1 in `dist/assets/*.js`); live browser at 1280/375 with 0 console errors, no horizontal overflow, all four states cycling with real engine values (updated: n=5/uncertainty .40/band 3→4; stale: n=4/uncertainty .90/band 3→3 + "Needs rebuild").

## Flow trace
1. Ticket #35 = Prototype: Roadmap and Progress Feedback UX - `wayfinder:prototype`, `wayfinder:phase2`, `ready-for-agent`, OPEN, assignee `rings0fsaturn`.
2. HITL comments on #35: direction = **Variant B**; principle = plain language leads, raw mastery decimals / expected-correctness % must not be primary learner UX; hierarchy = summary → what we know / what we are watching → evidence trail → advisory action + pinned boundary; exact LLM presentation deferred to #50.
3. Prototype mounts at `/roadmap-feedback-prototype` with `?variant=A|B|C`; shared `PrototypeSwitcher` (`prototype/practice-guide/PrototypeSwitcher.tsx`) cycles variants and listens for ArrowLeft/ArrowRight.
4. State machine `ProjectionState = 'cold' | 'updated' | 'stale' | 'rebuilding'`; `stale`/`rebuilding` project from a 4-observation prefix, `updated` from all 5, so a rebuild genuinely recomputes.
5. Approved mastery vocabulary lives in `packages/progress/src/mastery.ts` (`MODEL_VERSION = 'bkt-v1'`, `MasteryProjection`, `DifficultyRecommendation`, `recommendBand` one-band at target 0.7); the app reader wrapper is `apps/app/src/assessments/masteryBands.ts` (`DEFAULT_BAND = 3`).
6. Implementation follow-up is #47 (`.work/specs/phase2-tickets/15-roadmap-feedback-implementation.md`), blocked by #11 (done) + this prototype; the LLM feedback contract is #50 (blocked by #35).

## Files affected
- `.work/archive/issue-35-roadmap-feedback-prototype/` - state.md, research/decisions-35.md, plan/evidence/*.png - task record + HITL decision + live evidence.
- `.work/STATUS.md` - Active row `issue-35-roadmap-feedback-prototype` added, then flipped to Done; `_Last reconciled_` bumped to 2026-09-23.
- `.work/active/phase2-wayfinder/state.md` + `research/map-4.md` - frontier updated (#35 closed), map #4 decision line + #21 cluster annotation mirrored.
- GitHub `rings0fsaturn/study-planner` - #35 resolution comment + ACs ticked + closed; map #4 body gained the #34 + #35 decision lines and the #20 + #21 cluster annotations (also fixed the #34 line the earlier exit had only written to the local snapshot).
- `apps/app/src/prototype/roadmap-feedback/RoadmapFeedbackPrototype.tsx` - AC3 choice recording (URL + localStorage + validator), AC4 real-engine vocabulary + `Model context`, dialog a11y, rebuild-timer cleanup, `STATE_COPY` typed copy model, if/else variant render.
- `apps/app/src/prototype/roadmap-feedback/roadmap-feedback.css` - Marginalia tokens only, focus-visible, 44px coarse targets, reduced-motion, model-context + recorded styles, grid `align-items: start`, mobile date width.

## Pitfalls & rules
- HITL hard constraint: plain-language feedback leads; raw mastery decimals and expected-correctness percentages must NOT be the primary learner UX (#35 comments). Model numbers live behind a collapsed `Model context` only.
- AC4 is a hard gate: consume the approved mastery/adaptive vocabulary without redefining the algorithm. Reuse `@study-tracker/progress` + `masteryBands`; never duplicate BKT math in the prototype (rule 41).
- Throwaway scope: no persistence events, no roadmap bookings, no Dexie bump, no service calls. The recorded choice is prototype-local (URL + localStorage), never a roadmap event.
- Rule 12: write the route path without the `/study` prefix; basename is a deployment concern.
- Dev-only route guard: keep `import.meta.env.DEV` on the route and the Roadmap detail link; verified tree-shaken from `dist/assets/*.js`.
- WSL stale Vite (rule 53): every source edit needs `./full-app restart full` before browser verification.
- Wayfinder prototype tickets are HITL: the human picks the recommendation; the agent must not decide it alone.

## Decisions in force
- Working direction = Variant B (learner-facing learning story + inspectable evidence trail), recorded by HITL on #35 (2026-09).
- Polish + AC gaps in scope; Variants A/C are not polished (throwaway, not the chosen direction).
- Record the prototype choice as URL + localStorage (user-selected 2026-09-23), no roadmap events.
- Proceed with simulated plain-language copy; exact LLM feedback presentation stays with #50 (user-selected 2026-09-23).
- Per-state copy lives in one `STATE_COPY` map, not per-component condition chains (2026-09-23).

## Open
- none. #47 Roadmap Feedback implementation and #50 LLM feedback contract are separate tickets, tracked on map #4.
