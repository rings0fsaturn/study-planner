# Scratchpad - synthetic-users-seeding · session 2026-10-16 (Phase 4)
_state.md: .work/active/synthetic-users-seeding/state.md · Updated: 2026-10-16_

## Now / Next
- Doing: Phase 4 DONE (code + review + journal updated, uncommitted)
- Next: commit on explicit request; then report assembly (live artifact emission)
- Blocked: none

## Session log (Phase 4)
- START: read state.md + PLAN.md Phase 4 + DECISIONS + past-phase pushed items (amended N=113, 4x hold verdicts, local QuestionGraded=0, wipe/queue defect, password rotation). Prereqs green (computeProgress + generateBookings exports). Runtime stopped per user FYI; Phase 4 is pure offline extraction, no containers needed.
- Design: reuse mapSessions/findRoadmap/mapBookings (no new mapping); assertTraceable takes Event[] | Set<string> (server grades live outside local events); rows carry traceIds (+n on MasteryRow).
- TDD 5 slices RED->GREEN: trace gate (5) -> adherenceTable (9) -> computeProgress parity (10) -> masteryTable (14) -> verdictTable (18).
- Parity finding: table activeMinutes-first vs computeProgress duration-only; synth equal, divergence pinned by dedicated test (gap = duration - activeMinutes), not masked.
- REVIEW code-reviewer subagent (ocr delegate, both files): APPROVE-WITH-FIXES, 3 med + 10 low. Applied test-first 3 med + 8 low (skipped L4 permissive-ids, L5 unreachable-on-synth). Post-fix 22/22, src/dev/ 61/61, typecheck + eslint clean, no console.*, no em-dashes.
- DONE verification: extract 22/22 incl. fabrication-negatives; src/dev/ 61/61; full app 1238/1240 (2 pre-existing TZ flakes, forks-green); backend pytest flakes pre-existing/order-dependent (frontend-only diff, recorded).
- Honest holds: 4x hold verdicts -> 0 conversions, D-02 proof absent in data; plan/evidence/ emission deferred to report assembly (needs live reads). PLAN Notes + state.md + STATUS updated; uncommitted per AGENTS.md.

## Prior session log (Phase 3, retained)

## Session log
- 05:00 START: read state.md + PLAN.md Phase 2; runtime full healthy (sidecar/piston/intelligence/app/worker); SYNTH_STEADY_* missing; synthDriver.ts + 15 tests present uncommitted with difficulty fix.
- 05:24 VERIFY: prereqs green (submitAssessmentAttempt, createMaterial, :8000 ok, sidecar healthy); synthDriver 15/15, src/dev/ 22/22, typecheck clean, no console.*.
- 05:30 REVIEW: code-reviewer subagent (ocr delegate, both files) APPROVE-WITH-FIXES, 4 med + 4 low.
- 05:32 FIX test-first: RED 3/23 (requestId reuse, upload markFailed, multi-material guard) then GREEN 23/23; src/dev/ 30/30, typecheck clean, no console/em-dash; skipped resultId-fallback throw (production precedent). PLAN Notes + state.md updated.
- PILOT (spend approved): creds in .work/specs/test-login-cred.txt (keys only ever read); article URL recovered from docs/materials.txt, recorded in DECISIONS D-06. Ingest x3 PASS (book 422, talk 167, article 15 chunks). Temp spec study-half LOCAL 53/19/5/1, CLOUD 0 (sync-gap: bulkAppend bypasses sync_queue; spec deleted after). Weeks attempted 12 graded 12 (coding self-check 3/5 honest terminals, judge0 w4-5, w5 obj 1.0). Mastery 10/8/9. Verdict hold via jev-1.13 (needed Idempotency-Key; join verified). Full suite 1213 green. PLAN/state/STATUS updated; uncommitted per AGENTS.md.
- 06:00 START Phase 3: read state.md + PLAN.md Phase 3 + pushed items (sync gap, N>=160, junk e7923cc9/c7f4957d, password rotation). Prereqs green (RoadmapReplannedPayload sync/types.ts:225, full runtime healthy). No SYNTH_*/E2E_LIVE_* names in env.
- 06:05 FOUND DevSeeder mounts OUTSIDE SyncRouter (App.tsx:270 vs 271-277); logged-out render has no provider, so useSync/logEvent unreachable without a move + guard + rule-34 tests. Sync-gap fix options surfaced for live session: (A) move DevSeeder inside with optional-sync guard, loop logEvent preserving createdAt; (B) new SyncEngine enqueue method with rule-33 tests. Recommend A. Live verification (cloud rows + restore) needs creds + spend regardless.
- 06:10 TDD slice 1 RED (struggling replan 0 vs 1) then GREEN (replan param + emission, 6/6).
- 06:12 TDD slice 2 GREEN (returning/steady/crammer/additive/past-gate pins, 10/10).
- 06:15 REVIEW code-reviewer subagent (ocr delegate rule: system TS group; both files passed explicitly): APPROVE-WITH-FIXES, 2 warnings + 4 suggestions.
- 06:20 EDIT synthSeed.ts/synthSeed.test.ts - hoisted replan const (! fix), qualified gap-week comment, +1h timestamp + strict-boundary pins, dropped redundant Date copy, fixed jammed test line - verified src/dev/ 36/36 + typecheck clean + no console.*. Skipped: afterWeek rename (plan sketch names afterWeek; semantics pinned by tests instead), out-of-range warn (optional), prettier binary absent (file style semicolon-free, matched).
- 06:25 DECIDED N>=160 stays surfaced not solved: study-half logged 19+10+10+11=50, runs 5+5+5+3=18, graded ~48 at pilot shape (12/user) -> N~116 vs gate 160 (80/20/60). Logged-80 unreachable under locked skip params; needs a D-04 decision (amend vs raise graded density), recorded in PLAN Notes + state.md Open.
- 06:26 NEXT hand back for SYNTH_* creds + spend sign-off (step 2 runbook, junk cleanup, e2e replay); sync-gap fix rides that live session.
- 06:35 DONE Phase 3 code half: full app suite 105/1219 green; work journal updated (PLAN Notes + state.md); uncommitted per AGENTS.md. Live remainder BLOCKED as recorded.
- 06:40 UNBLOCKED creds (.work/specs/test-login-cred.txt holds synth-*-email/password key pairs, names only read) + spend sign-off approved. Sidecar/piston were stopped, restarted healthy.
- 06:45 FOUND SyncProvider test pattern reusable (createFakeSupabase + unique Dexie + waitFor). useSync throws outside provider; SyncContext unexported.
- 06:50 TDD sync-gap slice 1 RED (53 local, 0 queued - the exact gap) then GREEN: useOptionalSyncContext export + DevSeeder logEvent loop preserving createdAt + bulkAppend fallback + App.tsx DevSeeder moved inside SyncRouter. Slice 2 fallback pin GREEN. src/dev/ 38/38, typecheck clean, no console.*.
- 06:55 DONE full app suite 105/1221 green (covers App.tsx move). App restarted (rule 53 stale Vite). Phase 3 ingest launched detached (/tmp/opencode/synth_phase3_ingest.py -> phase3_ingest.log); crammer ready 422/167/15. Weeks script (/tmp/opencode/synth_phase3_weeks.py) + cloudcheck + temp browser append spec (e2e/synth-phase3-append.spec.ts, delete after) written.
- 07:05 DONE ingest all 3 accounts ready 422/167/15 each (INGEST PASS). Spec fixes: Continue exact button, waitForFunction for __seedSynth (BootScreen restore gate).
- 07:10 FOUND run-1 seeded queue but context closed pre-flush (cloud 0); wipe() clears events only, not sync_queue (latent defect, follow-up, not changed here). Spec now resets both IDB stores pre-seed + holds 25s for flush.
- 07:15 DONE study halves appended synced: cloud crammer 44/44 (10/5/0), struggling 45/45 (10/5/1 replan), returning 42/42 (11/3/1 replan). SYNC GAP CLOSED live. Crammer weeks launched detached (-> phase3_weeks_crammer.log).
- 07:40 DONE crammer weeks: attempted 14 graded 14 (1 honest coding terminal skipped), verdict hold (jev-1.13, Idempotency-Key http 200, no 422), mastery rows 10/8/8. Low-effort weeks all 0.0 incorrect (honest); high-effort weeks mixed (w4 coding judge0 1.0; w4-5 written 0.0, w5 all 0.0 - server honest, no gaming). Struggling weeks launched detached.
- 08:10 DONE struggling weeks 11/11 hold, mastery 7/8/6. Returning launched (9 slots).
- 08:30 FOUND run-1 pre-flush close (cloud 0) + wipe() skips sync_queue (latent defect, follow-up). Steady pilot study half was cloud-0 (bulkAppend); re-appended synced 53/53 (19/5/0). Steady replay: onboarding gate holds TEST USERs at step 1 (never onboarded) - replay asserts render + zero pageerrors, library verified API-side.
- 08:45 DONE returning 6/9-slots hold. Cleanup PASS (typed assessment delete, 2 junk materials 204, steady 3 remain, assessment row gone). User decisions: retry all 8 terminals + amend gate (server grades count).
- 09:00 DONE retries +2/8 (crammer w2, returning w1; struggling 0/4 twice accepted). Final grades 12/15/11/7 = 45. Amended N = 50 + 18 + 45 = 113. Temp specs deleted.
- 09:15 REVIEW sync-fix round (ocr, 4/4 files): APPROVE-WITH-FIXES. Applied test-first: __wipeSynth queue drain + wipe-drain test (RED then GREEN), ref stabilization for effect churn, cast simplification, BootScreen note. Post-fix src/dev/ 39/39, full suite 105/1222, typecheck clean.
- 09:20 DONE Phase 3 COMPLETE: PLAN Status + Notes, state.md, STATUS row updated; uncommitted per AGENTS.md. Runtime left running (user call on stop).
- 09:30 RETRO (skill): 4 proposals applied to project rules (no code changes, no subagent review needed): rule 33 wipe/queue independence + BootScreen-gating lines; rule 16 SYNTH_* export pattern + sign-in Continue-exact lines. Rejected (recorded, no change): reviewer semicolon false positive, `&& &` precedence footgun, N-gate lateness (process worked), ocr test-exclusion (already in state trace).
