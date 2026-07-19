---
title: ProgressEngine and PaceCalibration — streak, projection, burn-up, calibration
type: AFK
blocked_by: [4]
covers_user_stories: [14, 15]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

The Home screen graduates from "stub showing total time" to a real progress dashboard. A pure `ProgressEngine` module derives streak (consecutive days with at least one logged session), projected finish date, burn-up against the roadmap, and an "Up next" card pointing at the next scheduled material.

A pure `PaceCalibration` module watches the gap between planned and actual session durations. When the user's pace consistently differs from estimates, it nudges the projection multiplier with a cooldown to avoid jitter, and shows a "this exceptional pace has become your norm — recalibrate?" prompt when warranted. Tagging a session as exceptional emits `SessionTaggedExceptional` so calibration can exclude it from the rolling baseline.

Both modules are pure — they take EventStore state as input and return derivations as output, no I/O. This makes them straightforward to test across timezones, edge-case event sequences, and varied roadmap shapes.

## Acceptance criteria

- [ ] `/study/home` shows a streak grid (consecutive days with at least one logged session)
- [ ] `/study/home` shows a projected finish date computed under the current calibration multiplier
- [ ] `/study/home` shows a burn-up chart against the roadmap
- [ ] `/study/home` shows an "Up next" card pointing at the next scheduled material
- [ ] PaceCalibration adjusts the projection multiplier when actual durations consistently diverge from planned, with a documented cooldown to avoid jitter
- [ ] When a sustained exceptional pace is detected, the user sees a "this exceptional pace has become your norm — recalibrate?" prompt
- [ ] A user can tag a session as exceptional, emitting `SessionTaggedExceptional`; tagged sessions are excluded from the calibration rolling baseline
- [ ] ProgressEngine tests cover: streak across timezone boundaries, streak with gaps, projection with varied multipliers, burn-up edge cases (empty roadmap, completed roadmap)
- [ ] PaceCalibration tests cover: multiplier adjustment under sustained drift, cooldown prevents thrash, exceptional-tagging excludes from baseline, recalibration prompt threshold
- [ ] An end-to-end test covers: log several sessions across days → see streak update, projection update, burn-up update on Home

## Blocked by

- Blocked by #4
