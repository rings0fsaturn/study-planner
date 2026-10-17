# DECISIONS - synthetic users + sessions for Phase-2 report results

_Task: `synthetic-users-seeding` - Status: grill closed 2026-10-16 - Next: `/plan` (one vertical slice per archetype), then `/tdd` seeder._
_This file is the agreed contract._
_No product behavior changes, no prod backdoors, no committed secrets._

## Canonical glossary (locked)

- **Closed loop**: plan (roadmap-engine bookings) → study (SessionLogged) → practice/assessment (server grade authoritative) → recalibrate (mastery + loop-decision) → replan (RoadmapReplanned).
- Display-only feedback copy is not closure.
- **Loop-close proof**: a `suggest_replan` verdict converting into a `RoadmapReplanned` event plus next-week adherence rebound.
- **Synthetic user / TEST USER**: a real, isolated Supabase Auth account whose history is seeded through real product paths, never a row injected behind the sync boundary.
- **Analyzable event**: a durable event that replays through existing engines unchanged (SessionLogged, PracticeRunFinished, QuestionGraded).
- **Shared React set**: one YouTube video + one PDF + one code-bearing article reused across all 4 archetypes, so behavior (not content) is the report variable.
- **Env-only creds**: passwords living solely in ignored local files or shell env, never in git, logs, or chat.

## D1 - Report portrays 3 effectiveness claims (locked 2026-10-16)

- Claim 1: plan adherence is measurable (planned vs actual minutes, booking completion rate).
- Claim 2: mastery moves with practice (BKT `bkt-v1` projection deltas per archetype, pre/post per material).
- Claim 3: the loop closes (loop-decision verdict distribution + replan adoption: N suggest_replan → N replans → pace recovery).
- Tables: archetype × week adherence %, mastery delta per material, loop-verdict counts.
- Figures: burn-up/adherence curve, mastery trajectory, one loop walkthrough timeline.
- Stats are descriptive + trajectory only on N=4 users, never p-values.

## D2 - Closed-loop definition + proof metric (locked 2026-10-16)

- Loop stages: RoadmapCreated + SessionBooked (via roadmap-engine) → SessionLogged → PracticeRunStarted/Finished + QuestionAttempted + server-authoritative QuestionGraded → mastery projection + calibration (via `@study-tracker/progress`) + loop-decision verdict (via `POST /v1/loop/decision`) → RoadmapReplanned (Keep = acknowledgement only).
- Proof metric: suggest_replan verdicts that convert into RoadmapReplanned events plus post-replan pace recovery the following week.
- Counting feedback-copy display as "closed" is explicitly rejected.

## D3 - Four archetypes × 1 user (locked 2026-10-16)

- Steady: pace ~0.85-1.0, attendance ~95%, mastery rises steadily.
- Crammer: low early pace ~0.4, late spike ~1.2, bursty attendance.
- Struggling: pace ~0.5-0.65 flat, attendance ~70%, mastery flat/low, triggers ≥1 suggest_replan → replan.
- Returning (stalled-then-recovering): gap weeks near ~0 sessions, then replan + rebound (cleanest loop-close story).
- Each archetype is parametrized by weekly pace multiplier, skip probability, grade distribution per family (objective/written/coding), and BKT observation sequence.
- Grades enter only via server-authoritative paths, never hand-set outside QuestionGraded.

## D4 - Session matrix + binding N (locked 2026-10-16)

- 5 weeks per user × 4 booked sessions/week = 20 study slots per user (80 cohort-wide), each slot emitting SessionBooked → SessionLogged.
- Plus 1 practice run + 1 graded assessment per user per week (weekly PracticeRunStarted/Finished pointers + graded attempts).
- Binding N: ≥160 analyzable events cohort-wide (≥80 SessionLogged + ≥20 PracticeRunFinished + ≥60 QuestionGraded).
- Every user spans ≥5 calendar weeks including one replan → rebound window for struggling and returning.
- Cadence reuses the Mon/Wed/Fri/Sat seed pattern already proven in `apps/app/src/dev/seedTestData.ts`.

## D5 - Emulation boundary: live TEST USERs, no backdoor API (locked 2026-10-16, see ADR-0001)

- Seeding runs live-only as 4 isolated Supabase Auth accounts (one per archetype), each with its own `StudyTracker_<userId>` IndexedDB and owner-scoped rows.
- Writes go exclusively through `EventStore.append`/`bulkAppend` and real UI/worker paths, never direct Supabase writes and never past SyncEngine/RLS ownership.
- Zero new HTTP seed endpoints, zero service-role keys in the browser, zero prod-route seeding affordances (dev seam `seedTestData.ts` + `DevSeeder.tsx` stays test-only, never linked from prod nav).
- Histories are never merged across users; cleanup is `wipeTestData` + test-user/material deletion.
- Recorded as ADR-0001 because it is hard to reverse once histories exist, surprising without context, and a real trade-off against a server seed API.

## D6 - Shared React materials (locked 2026-10-16)

- One set shared across all 4 users (titles suffixed per archetype): YouTube `LDB4uaJ87e0`, `e2e/pdf/learningreact.pdf` (350 pages, 7.2 MB, verified text-selectable), Comeau CSS-in-RSC article.
- Source links (recorded 2026-10-16 so they are not lost): ARTICLE-URL `https://www.joshwcomeau.com/react/css-in-rsc/`, YOUTUBE-URL `https://www.youtube.com/watch?v=LDB4uaJ87e0`, PDF `e2e/pdf/learningreact.pdf`. Canonical copy: `.work/active/synthetic-users-seeding/docs/materials.txt`.
- Sharing keeps ingestion cost ×1 and isolates learner behavior as the report variable instead of confounding it with content difficulty.
- `learningreact.pdf` has no frozen retrieval baseline, so one full ingestion run (extract → chunk → embed via sidecar :8200) must precede grounded generation.
- Per-user coverage per family: YouTube for session variety, PDF for scoped generation, code-bearing article for the coding arm (bare-notes refusal `code_not_derivable` is honest output, never patched around).

## D7 - Four accounts provisioned (done 2026-10-16)

- Roles steady, crammer, struggling, returning each own one email-confirmed Supabase Auth account with no pre-existing history.
- Role → Supabase UUID map for cleanup: struggling `97cb20be-604b-443e-8f4f-437771fe8c4d`, returning `f4eddc97-9184-4b18-a2fb-741babaaa512`.
- Steady and crammer UUIDs are unrecorded (operator-created before scripted provisioning); resolve them via the Auth dashboard before cleanup and keep them out of chat and logs.
- Passwords live only in the now-ignored working-tree cred file, never in this doc.

## D8 - Credential hygiene repair (done 2026-10-16)

- `.gitignore` pattern fixed from Windows backslashes to `.work/specs/test-login-cred.txt`.
- Cred file untracked via `git rm --cached`; working-tree passwords preserved on disk and now unstageable.
- The `.gitignore` fix + index removal sit staged-but-uncommitted for the next normal commit; nothing was committed by this task.
- Git history still holds previously committed bytes, so rotating the first-two passwords remains advisable.

## D9 - Parallel loop-quality lane stays independent (locked 2026-10-16)

- A separate agent is testing/hardening current loop quality while this design lands.
- This task assumes loop contracts as documented and never modifies phase-2 product behavior to flatter results.
- Whatever the parallel lane fixes only strengthens the seeded proof; no forked engine behavior on this side.

## Standing constraints (restated, non-negotiable)

- Keep Supabase behind auth/sync boundaries.
- Keep browser persistence local-first per-user.
- Event log is durable history, additive only.
- Roadmap/progress logic lives in packages, never duplicated in components.
- `/study` basename stays out of app routes.
- No fabricated grades: every report number traces to a seeded metric via existing engines.

## Explicitly NOT decided here (for `/plan` + `/tdd`)

- Per-archetype vertical-slice specs (event sequences, timestamps, grade distributions).
- Seeder implementation shape (red: failing seed test, green: minimal seeder).
- STATUS row + `state.md`/`SCRATCHPAD.md` lifecycle (work-journal-orchestrator owns these, opens at `/plan` time).
- Embedding dry-run scoping per rule 80 before the 350-page ingest.
- One live-browser seeded-user replay per rule 10 at verification time.
