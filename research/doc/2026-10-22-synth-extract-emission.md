# Gap-5 synthExtract emission (2026-10-22, cloud reads)

- Method: temporary vitest spec importing `apps/app/src/dev/synthExtract.ts` (adherenceTable, masteryTable, verdictTable, assertTraceable); spec deleted after the run, `git status` verified clean. Cloud `public.events` read via service key for the 4 synth UIDs (UIDs resolved by password grant, never printed); attempts joined through `questions.user_id` with material-owner fallback.
- Timestamp note: the seed writes `RoadmapCreated.createdAt` as `+00:00` but booking `roadmapCreatedAt` refs as `.000Z`; `mapEvents` joins with strict string equality, so the same instant silently misses and every row mistraces. Emission canonicalizes `createdAt` to ISO (instant-preserving, documented here). FINDING for the owning task: normalize one side (seed shape or tolerant join) - filed in this doc, product untouched.
- Trace gate: assertTraceable passes per user over the canonicalized evidence.

## Adherence (24 rows: 6 weeks x 4 users)

| user | w0 | w1 | w2 | w3 | w4 | w5 |
|---|---|---|---|---|---|---|
| steady | 0.692 | 0.921 | 0.879 | 0.954 | 0.933 | 0.000 |
| crammer | 0.215 | 0.138 | 0.385 | 0.254 | 0.923 | 0.000 |
| struggling | 0.323 | 0.169 | 0.385 | 0.144 | 0.554 | 0.000 |
| returning | 0.656 | 0.000 | 0.000 | 0.700 | 0.900 | 0.000 |

(rates actual/planned; planned w0-w4 390 min, w5 360 min.)

- Next-week adherence finding: week 5 (the post-replan extension week) measures 0.000 for all four - no sessions were logged after the replan because capture ran one day before deadline (rebound-era caveat on record). Reported as measured-zero with that caveat, not as a learning result.

## Mastery (12 rows, before = pInit 0.15 throughout)

- Every row: after ~= 0.1067, delta negative. Verified honest: synth observations are genuinely ~90% incorrect (steady 33F/3T, crammer 40F/5T, returning 19F/3T, struggling 30F/2T across 12 material cells). The seeded driver scripts prioritize grading-path coverage (including honest terminals) over learner success, so these rows measure the scripts, not a learning claim. Do not cite them as BKT validation; the BKT rows live in the harness summary.

## Verdicts (4/4 converted)

| user | verdict | decidedAt | converted |
|---|---|---|---|
| steady | suggest_replan | 2026-10-14T12:00:11.235Z | true |
| crammer | suggest_replan | (per-user) | true |
| struggling | suggest_replan | (per-user) | true |
| returning | suggest_replan | (per-user) | true |

- Each row joins its `RoadmapReplanned` by exact (verdictId, verdictDecidedAt) mirror with createdAt >= decidedAt. Full per-user decidedAt values in the JSON beside this doc.

## Cost

- Supabase reads only; no GPU, no paid APIs.
