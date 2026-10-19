# Closed-loop HOLD bug ledger
_Task: closed-loop-hold-analysis · Date: 2026-10-19 · Status: reviewed (unbiased-review REQUEST_CHANGES addressed below)_
_Symptom: 4/4 synthetic users loop verdict `hold` from jev-1.13, 0 `suggest_replan`; D-02 proof absent._

Conventions: every item carries file:line plus a failing test, log evidence, or both.
`BUG` means code or locked constant is wrong for the loop contract.
`CAL` means a tuned value or prompt behavior needs app-data recalibration, not a code defect.
Unbiased-review findings are answered inline under `Review:`.

## B1 (high) BUG: confidence gate unreachable on live loop states

Where: `services/intelligence/app/jev/questions.py:15` (`APPROVE_AT = 0.9`),
`services/intelligence/app/jev/questions.py:96-100` (suitability router, the gate's original home),
`services/intelligence/app/jev/questions.py:365-376` (`route_loop_action` reuses it at `:374`).

Evidence (logs): 26/26 `loop decision` lines in `.dev/full-app/logs/intelligence.log` hold.
21x 2026-10-12 `choice=reprioritize` with confidence 0.23-0.37, sufficiency 0.42-0.52.
4x 2026-10-16 synth verdicts: steady `hold` 0.34/0.76 (`pilot-verdict-6b688c99`),
crammer `reprioritize` 0.30/0.78 (`p3-crammer-verdict-14055d40`),
struggling `hold` 0.18/0.77 (`p3-struggling-verdict-a14e0e8f`),
returning `hold` 0.31/0.65 (`p3-returning-verdict-067f06ee`).
Live maximum outside textbook-perfect states is 0.83 (probe B/E below).

Evidence (gate location pin, offline, no spend):
`route_loop_action('suggest_replan', 0.85, 0.9) == 'hold'`,
`route_loop_action('suggest_replan', 0.95, 0.9) == 'suggest_replan'`.
This pin proves where the gate sits (any confidence below 0.9 holds whatever the choice),
not that the gate misfires; the bug evidence is the live distribution above.

Evidence (live probes, 6 JEV calls total, request_ids logged):
dry-run neutral+span0: `hold` 0.67 / suff 0.21.
Probe B dip + real posture + span21: choice `suggest_replan` 0.82 / suff 0.71, routed HOLD.
Probe C textbook replan + span21: `suggest_replan` 1.0 / 0.78, routed suggest_replan (only pass).
Probe D same + span0: `suggest_replan` 1.0 / 0.37, routed HOLD.
Probe E crammer mixed: `reprioritize` 0.83 / 0.72, routed HOLD.
Probe F week-5 rebound: `suggest_replan` 0.35 / 0.8, routed HOLD.
Spend: about 6.2k input tokens, output free, estimated $0.0003 at `JEV_PRICE_PER_MTOK_DEFAULT`.

Judgment: BUG with a CAL tail.
The 0.9 constant was locked for slice-1 suitability gating and reused for the loop
without loop-data retuning (questions.py header calls thresholds cookbook starting points).
jev-1.13 choice confidences on loop-shaped states live in 0.2-0.8; the gate passes
only textbook-perfect states (probe C at exactly 1.0).
Fix needs new values from `sweep_evidence_floor`-discipline measurement (see PLAN Phase 1),
not intuition.

Review: the 0.85 example is correct-per-code behavior and is now labeled a gate-location
pin; live distribution plus probes B/E carry the bug claim, with request_ids above.

## B2 (high) BUG: `days_span` hardcoded 0 starves the sufficiency Noul

Where: `apps/app/src/roadmap/feedback/useLoopDecision.ts:50-52` (comment admits it),
`apps/app/src/roadmap/feedback/useLoopDecision.ts:97` (`days_span: 0`, sole repo-wide producer).

Evidence: prompt rewards spread across days
(`services/intelligence/app/jev/questions.py:347-360`, true-case "spread across days",
false-case "from one sitting").
Probe C vs D are identical signals and posture, differing only in `days_span`:
span21 sufficiency 0.78 (pass) vs span0 sufficiency 0.37 (fail), same choice 1.0.
The 2026-10-16 synth verdicts all ran through this envelope, so every one of them
asked Jev to judge multi-week histories with a zero day-span.

Judgment: BUG. The prompt needs a signal the client never supplies.
Fix computes the span from durable event dates (PLAN Phase 2), no Dexie change.

## B3 (medium) CAL with a BUG trigger: neutral posture flips Jev's choice on dip states

Where: `apps/app/src/roadmap/feedback/useLoopDecision.ts:118-145` (`buildLoopPosture`,
neutral behind 0 / pace 1 when projection unknown),
`apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:57-63` (`NEUTRAL_POSTURE` default),
real-posture path `apps/app/src/roadmap/RoadmapCalendar.tsx:256-274,618`.

Evidence: dry-run (neutral posture, span0) Jev itself chooses `hold` 0.67 / suff 0.21,
while probe B (same skill rows, real dip posture behind 5 / days_left 14 / pace 0.5)
gets choice `suggest_replan` 0.82.
The neutral fallback code is correct and intentional (degrade to mastery-only, never noise);
the defect is invocation context, the fallback systematically fires on the dip states
that need schedule pressure because verdicts are captured where the projection is
unknown or after the rebound (see B4).

Judgment: CAL for the fallback values, BUG for the capture context.
PLAN Phase 2 captures verdicts at the dip with the real posture and records which
posture was used; fallback stays for genuinely unknown projections.

## B4 (medium) BUG: verdict timing misses the dip and ordering is uncheckable

Where: `apps/app/src/dev/synthExtract.ts:163-190`
(`VerdictRow` has no timestamp field; `:175` comment assumes order, never checks),
`apps/app/src/dev/synthSeed.ts:280-304` (scripted replan fires 22:00 on the last booking
of `afterWeek: 2`),
`apps/app/src/dev/synthSeed.ts:21-26` (struggling pace `[0.6, 0.55, 0.5, 0.62, 0.8]`, dip at index 2, rebound at index 4).

Evidence (logs): all four live verdict request_ids
(`pilot-verdict-6b688c99`, `p3-crammer-verdict-14055d40`,
`p3-struggling-verdict-a14e0e8f`, `p3-returning-verdict-067f06ee`)
were captured after the graded weeks completed, i.e. at the week-5 rebound,
not at the week-3 dip the scripted replans answer.
Probe F (rebound shape) still returns choice `suggest_replan` at 0.35, so timing alone
does not explain the hold, but without a verdict timestamp the D-02 join cannot
distinguish a dip verdict from a rebound verdict recorded after a scripted replan.

Judgment: BUG. Add an additive optional verdict timestamp (PLAN Phase 3);
widen the reader per the additive-evolution rule, no Dexie migration.

## B5 (medium) BUG: no verdict-to-replan join key and `option` is a dead field

Where: `apps/app/src/roadmap/replan/commitReplan.ts:74-89`
(payload spread plus `option: 'edit'` hardcoded at `:86`),
`apps/app/src/sync/types.ts:225-230`
(`RoadmapReplannedPayload.option` union, no verdict id / timestamp / hash field),
`apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:420-429`
(preselect on `suggest_replan`, confirm navigates to `/replan`, writes nothing).

Evidence (tests): `apps/app/src/roadmap/replan/commitReplan.test.ts` contains zero
`option` assertions; `apps/app/src/dev/synthExtract.test.ts:190-199` pins that hold
verdicts never convert with or without a replan, and `:200-210` pins conversion only
for synthetic `suggest_replan` entries paired with scripted replans, never a real
verdict-triggered flow.
Evidence (logs + data): 4x hold, 0 conversions in the synth histories;
struggling/returning scripted replans carry `increase-hours` / `extend-deadline`
(`synthSeed.ts:24-25`) with no verdict link, so they cannot prove D-02.

Judgment: BUG, second half of the D-02 absence (B1-B4 explain why no `suggest_replan`
was emitted; B5 explains why even a future one could not be joined).
Fix mints additive optional join fields; the Keep-writes-nothing contract
(`RoadmapFeedbackSection.test.tsx:198-214`) stays green.

## H1 healthy: `LOOP_EVIDENCE_SUFFICIENT_MIN = 0.5` floor

Where: `services/intelligence/app/jev/questions.py:279` (declaration),
`services/intelligence/app/jev/questions.py:372` (use),
`services/intelligence/app/jev/thresholds.py:1-40`
(`sweep_evidence_floor`, tie-break strictest, raises on empty input).

Evidence: all four synth holds passed the floor (sufficiency 0.65-0.78);
the Oct-12 holds failed confidence first (0.23-0.37), so the floor was not the blocker.
The declaration comment cites the context-package probe (0.47-0.49 to 0.76-0.84 on real
volumes) as its data basis.
Probe C/D shows the floor correctly separating span21 (0.78) from span0 (0.37).

Judgment: healthy, do not retune. PLAN reuses `sweep_evidence_floor` for the confidence
gate only.

## H2 healthy: BKT mastery (both stacks)

Where: `packages/progress/src/mastery.ts:13-26` (`MODEL_VERSION = 'bkt-v1'`, params
`pInit 0.15 / pLearn 0.1 / pSlip 0.05 / pGuess 0.2`),
`packages/py-progress/src/py_progress/mastery.py:21-45` (identical values),
forward filter `mastery.ts:59-78` vs `mastery.py:83-109`,
entropy and `recentTrend` in both.

Evidence: `py_progress` reproduction of 1-correct-then-4-incorrect yields mastery
`[0.51, 0.155, 0.11, 0.107, 0.107]`, matching the reported struggling-like 1/5 to 0.109
within observation-order tolerance.
Parity fixtures: `packages/py-progress/tests/test_fixtures.py:329`.
No mastery change is proposed or needed.

Judgment: healthy, do not re-tune (explicit task constraint).

## H3 healthy: loop endpoint validation, owner scope, fail-closed mapping, Idempotency-Key

Where: `services/intelligence/app/routers/loop.py:158-201` (`_validate` ceilings),
`:236-242` (owner check over `materialIds` plus signal materials),
`:258-281` (non-numeric coercion to hold with warning),
`:204-222` (`_jev_error` typed mapping), `:230` (`Idempotency-Key` min 16).

Evidence (tests): `services/intelligence/tests/test_loop_decision.py:156-262`
12/12 green 2026-10-19: pass-through per verdict at 0.95/0.9, thin-evidence hold,
mid-confidence hold, unknown-choice hold, string-number coercion hold,
pre-Jev 400s, unowned 404s, typed 500s, missing-key 422, bad-auth 401.
Evidence (logs): `pilot-verdict-cf3cddd6` and `pilot-verdict-dbg-a03060` answered 422
without the header, then `pilot-verdict-6b688c99` answered 200 with the header.

Judgment: healthy contract. Fail-closed behavior is the korum, not the defect;
the defect is gate calibration (B1) plus starved inputs (B2/B3).

## H4 healthy: loop transport, typed errors, X-Request-ID join

Where: `apps/app/src/assessments/assessmentClient.ts:101-126` (`normalizeAssessmentError`),
`:132-244` (`HttpAssessmentFetch`, caller X-Request-ID reused across the retry loop),
`:257-274` (`post` mints fresh X-Request-ID plus Idempotency-Key per logical call),
`apps/app/src/assessments/types.ts:233-256` (`AssessmentServiceError` with `requestId`).

Evidence (tests): `apps/app/src/assessments/assessmentClient.test.ts:119-120,280,309-310,374,389-390`
(Idempotency-Key present, length at least 16);
`apps/app/src/roadmap/feedback/useLoopDecision.test.ts:189-208`
(AbortError / TypeError / unknown rejection all resolve null, never throw).
Evidence (logs): every probe request_id joins `jev decide` and `loop decision` lines
in `intelligence.log` (rule 17).

Judgment: healthy.

## H5 healthy: updated-only firing plus session memo (mechanism)

Where: `apps/app/src/roadmap/feedback/useLoopDecision.ts:170-253`
(fires on `updated` only, clears on leave, failures never cached),
`:38-44,148-156` (canonical-input plus modelVersion hash memo, 50-entry cap).
Related state machine: `apps/app/src/roadmap/feedback/useRoadmapFeedback.ts:86-111`.
Lifecycle and preselect:
`apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx:262-279` (verdict wiring,
reprioritize reorder), `:420-429` (preselect plus confirm navigation).

Evidence (tests): `useLoopDecision.test.ts:155-163` (never calls for cold/stale/rebuilding),
`:246-256` (dedupe across remounts), `:271-283` (stale-to-updated refire),
`:285-295` (clears on leave), `:297-309` (retry after failure);
`RoadmapFeedbackSection.test.tsx:198-214` (Keep writes nothing),
`:216-228` (Open replan navigates), `:230-244` (preselect), `:246-273` (late verdict),
`:275-321` (evidence ordering per verdict).
Note: the memo input carries no verdict timestamp, which is the B4 gap, not a memo defect.

Judgment: healthy mechanism. No behavior change proposed here.

## T1 test gap (not a code bug): suites pin current behavior, not the live distribution

Where: `services/intelligence/tests/test_loop_decision.py:156-174`
(pass-through at 0.95/0.9),
`apps/app/src/roadmap/feedback/useLoopDecision.test.ts:43-95`
(`days_span: 0` pinned as expected output; neutral posture pinned at `:117-133`).

Evidence: both suites green 2026-10-19 (12/12 backend, 21/21 hook) while the live
distribution (max 0.83 on real dips, 0.23-0.37 typical) never reaches the pinned
pass-through band. The suites prove the gates work as coded; they cannot catch
calibration drift because no test feeds a dip-shaped state at live confidences.

Judgment: calibration gap in coverage, not a code defect.
PLAN Phase 1 adds BUG-pin probes (assert CURRENT hold behavior with a pin comment)
plus dip-shape cases, keeping the suite green throughout.

## Sweep coverage check

1. questions.py: B1 (APPROVE_AT reuse), H1 (floor), wording judged healthy:
loop criteria correctly describe replan territory (time pressure plus weak mastery);
probe B shows the wording elicits `suggest_replan` from Jev on a real dip,
so wording is not the defect. Inputs and gates are.
2. loop.py: H3 (all sub-items).
3. client.py plus thresholds: healthy
(`services/intelligence/app/jev/client.py:91-103` env build, `:105-171` single decide
with typed `JevError` mapping `:131-143`, per-call `request_id`/`trace_id` `:124-127`;
all 6 probes returned answers, no `JevError`; failure mapping covered by H3 tests).
Thresholds: `thresholds.py` healthy mechanism, reused by PLAN Phase 1.
4. useLoopDecision.ts: B2 (days_span), B3 (posture context), H5 (hook/memo),
filter judged healthy (`:59-76` observed-set plus n>0 plus sort plus 200-cap;
`useLoopDecision.test.ts:71-82` pins the cap and the unobserved drop;
live synth density 10-15 attempts over 4 skills with min 2-3 per skill passes totals
while staying thin per skill, which is an input-density CAL note for the sweep,
not a filter defect).
5. assessmentClient.ts plus types.ts: H4 (all sub-items).
6. RoadmapFeedbackSection.tsx plus useRoadmapFeedback.ts plus commitReplan.ts: H5
(lifecycle/preselect/ordering) plus B5 (join key/option).
7. synthSeed/Driver/Extract plus tests: grade density CAL note (pilot 12, crammer 15,
struggling 11, returning 7 server grades; per-skill min_obs 1-3; Jev sufficiency
0.65-0.78 says sufficient, so density did not block these verdicts);
gap weeks healthy (`synthSeed.ts:199,244-249`, `synthExtract.test.ts:60-69`);
verdict timing plus ordering B4.
8. progress plus py-progress parity: H2.
9. loop suites: T1.

## Needs-user-decision

N1: retuned confidence-gate value(s). PLAN Phase 1 runs `sweep_evidence_floor`-discipline
measurement over the 26 logged verdicts plus fresh dip-shape probes with explicit
candidate grids and strictest-tie-break, then proposes values for user sign-off.
No intuition tuning.

N2: live probe spend beyond the 6 calls already made (about $0.0003).
PLAN Phase 1 bounds any further probing (at most 10 more calls, cheap shapes only);
stop and ask before more.
