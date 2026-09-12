# Verification – roadmap-material-attach

_Ticket: GitHub #63 (filed 2026-09-12) · Parent spec #32 · Plan: plan/PLAN.md · Updated: 2026-09-12_

## AC tick-down (all unchecked until proven)

- [ ] AC1 — The roadmap's Materials panel has a "+" that opens a picker of library materials not already on this roadmap, and attaching affects this roadmap only. — Evidence required: `RoadmapCalendar.test.tsx` (opens picker, logs one `MaterialAttached` per selection, material appears in the directory); a two-roadmap unit case proving the attach does not leak to the other roadmap; a live click-through at 1280 and 375.
- [ ] AC2 — Each attached material carries its own minutes budget **and role**, both set at attach time, and the directory shows consumed/total. — Evidence required: picker minutes + role control tests; live attach as `practice` at a non-default budget, a "0m of Nh" directory row, and the role label in session setup.
- [ ] AC3 — Attached materials appear in the add-session and booking-edit pickers and in session setup. — Evidence required: `MaterialPickerSheet`/`AddSessionSheet` tests plus a live "Add session → Attach +" listing the new material; session-setup material list includes it.
- [ ] AC4 — Attached materials survive Replan and count in roadmap progress; no duplicate readers remain. — Evidence required: `mapToRegenerateRequest.test.ts` + `roadmapProgress.test.ts` fixtures with an attached material; `grep -rn "event.kind === 'MaterialAdded'\|event.kind !== 'MaterialAdded'" apps/app/src` shows the join only inside `progress/mapEvents.ts`.
- [ ] AC5 — Material detail lists the roadmaps a library material is attached to and the delete warning names them. — Evidence required: `useMaterialUsage` unit test + `MaterialDetail.test.tsx`; live `/materials/:id` showing the roadmap name.
- [ ] AC6 — A material can be removed from a roadmap's set, with the affected upcoming sessions disclosed, and existing bookings keep their material label. — Evidence required: `MaterialRemoveSheet` + `mapEvents.test.ts` detach cases (declared id masked, attach-after-detach restores, other roadmaps unaffected) + a live pass where a booked bubble keeps its title after removal; re-attach restores consumed minutes.
- [ ] AC7 — No server, schema or Dexie change; old roadmaps replay byte-identically. — Evidence required: `git diff --stat` shows no `supabase/migrations/*` and no `events/EventStoreProvider.tsx` change; the pre-existing `mapEvents`/`RoadmapCalendar` suites pass unchanged on a fixture with no `MaterialAttached`/`MaterialDetached` rows.

## Phase gates

- [x] P0 ticket: GitHub issue filed on the #33–#49 spine, claimed, branch cut, number recorded in the plan header + `state.md` + the STATUS row. — Evidence: https://github.com/rings0fsaturn/study-planner/issues/63 (`gh issue view 63 --json state,assignees`); branch `phase2/issue-63-roadmap-material-attach` off `2091d8e` in worktree `../study-planner-web-issue-63`.
- [ ] P1 attach + shared reader: app suite green; typecheck/lint clean; a live attach shows the material in the directory, the New session picker and session setup; two-roadmap scoping case green; header count uses the active set while a detached/unrelated booking still labels correctly. — **Unit side done 2026-09-12:** typecheck/lint clean, app suite 800/802 (2 = the documented WSL TZ pair, green under `--pool=forks`); two-roadmap scoping (`mapEvents.test.ts` "scopes an attachment to its own roadmap and keeps that roadmap budget"), header count from the active set and directory listing (`RoadmapCalendar.test.tsx`), attached material counted in progress and surviving the regenerate request. **Outstanding: the live click-through.**
- [ ] P2 minutes + role: picker control tests green; live attach at 90 minutes as `practice` renders "0m of 1h 30m" and the practice label in session setup. — Evidence required: test names + live measurement note; record whether the per-row controls crowded the mobile sheet (OQ-07).
- [ ] P3 detach: detach masks declared and attached ids, re-attach restores, bookings keep their labels, the header count and `% done` drop. — Evidence required: `mapEvents.test.ts`/`RoadmapCalendar.test.tsx` output + live pass transcript.
- [ ] P4 session surfaces + live E2E: `e2e/roadmap-material-attach-live.spec.ts` green with `--workers=1` at 1280 and 375 with zero console errors. — Evidence required: playwright output + the spec path.
- [ ] P5 library usage: hook + detail tests green; live `/materials/:id` names the roadmap. — Evidence required: test output + live note.

## Live evidence

- none yet (2026-09-12: planning only, no code written).
