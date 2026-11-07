# Gap-8 dip-window replay (2026-10-22, uniform pin 2026-09-05)

- Drive: temporary Playwright spec (deleted after the run) through the real chain - sign in as synth user, pinned browser clock, local-only OnboardingCompleted gate marker (rebound-replay precedent, cloud untouched), roadmap page, verdict settle read from the client settled line, replan path armed but never taken (all holds).
- Pin choice: 2026-09-05T12:00Z (week-3 trough week for struggling 0.144; uniform across archetypes for comparability). The roadmap page renders even though the pin predates RoadmapCreated (2026-09-10); a Sept-12 pin was also measured for struggling.
- Cloud verification after all runs: per-user event counts unchanged (steady 60, crammer 51, struggling 52, returning 49), no new writes, no marker synced.

## Dip-era verdicts (all hold, 0 conversions - Keep writes nothing)

| user | pin | choice | conf | suff | verdict | verdictId | decidedAt |
|---|---|---|---|---|---|---|---|
| struggling | 2026-09-05 | hold | 0.28 | 0.77 | hold | bc5a2f1f | 2026-09-05T12:00:05.785Z |
| crammer | 2026-09-05 | hold | 0.30 | 0.75 | hold | 6d726b54 | 2026-09-05T12:00:05.766Z |
| returning | 2026-09-05 | hold | 0.35 | 0.66 | hold | 98632f8e | 2026-09-05T12:00:05.218Z |
| steady | 2026-09-05 | hold | 0.33 | 0.76 | hold | 65e91839 | 2026-09-05T12:00:05.144Z |
| struggling | 2026-09-12 | suggest_replan | 0.61-0.69 (3 samples) | 0.77 | hold (gate) | 7d4960eb | 2026-09-12T12:00:06.173Z |

- Backend lines join by request_id in `intelligence.log` (choice/conf/suff/verdict, jev-1.13).
- Gradient reading: trough week - Jev's own choice is hold (0.28-0.35); week 4 - choice flips to suggest_replan but confidence (0.61-0.69) sits below the 0.7 gate; rebound eve (Oct 14, prior evidence) - choice suggest_replan at 1.0, verdict converts. The gate is pressure-sensitive in the intended direction; the trough holds on the merits, not on a defect.

## JEV spend (15-call cap, approved gap 9)

- This session: 7 loop-verdict calls (~24.5k input tokens, ~$0.001 at the listed price). Cap remaining: 8. No stop-rule trigger (no 2x overrun, no credential errors, no prior-moving result - trough holds are consistent with the 0.6/0.10 prior).

## Downstream note (gap 7)

- The replay drove verdicts only; no new graded attempts were produced, so the difficulty pool is unchanged (1 eligible question). Gap 7 closes as unmeasurable on current data: scope the Adaptive chip to uncalibrated-advisory.
