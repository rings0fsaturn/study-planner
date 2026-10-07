# Verification - practice-coach-sources-overflow

_Fix commit: `44b44d1` (CSS only) plus `f76bb87` (R2 comment cleanup); no `PracticeCoach.tsx` change._
_Evidence in `plan/evidence/`: pre-fix `coach-open-1280.png`, `coach-open-375.png`, `coach-collapsed-1280.png`, `measurements.md`; post-fix `coach-fixed-open-1280.png`, `coach-fixed-open-375.png`, `coach-fixed-collapsed-1280.png` (deterministic browser pass) plus `coach-e2e-open-1280.png`, `coach-e2e-open-375.png` (live spec)._

## AC1 - card stays in viewport with sources open at 1280 and 375

- Met: the live overflow spec asserts all four card edges inside the viewport at both widths (2 passed).
- The deterministic post-fix browser pass measures the open card at 369px tall (top 263, bottom 632 of 720) at 1280 and 399px tall (top 337, bottom 736 of 812) at 375, both fully inside.
- Collapsed state is unchanged at 181px (pre- and post-fix identical), so the fix only binds the open disclosure.

## AC2 - sources list scrolls internally and toggles by pointer and keyboard

- Met: the spec asserts `scrollHeight > clientHeight` for the five-quote list at both widths (post-fix synthetic: 560 over 180 at 1280, 669 over 180 at 375, capped at 180px).
- The shared `expectDisclosureToggle` helper proves pointer close/reopen plus Tab-from-Dismiss focus plus Enter-close, Space-open, Enter-close at both widths.
- The unit test pins the mechanics: list `overflow-y auto` with a 180px cap, card flex plus hidden plus `min(70vh, 560px)`, body `overflow-y auto`.

## AC3 - Dismiss, Got it, and tier actions stay reachable with sources open

- Met: the spec asserts Dismiss, Go deeper, and Got it visible with bounding boxes inside the viewport at both widths (post-fix synthetic: all three inside).
- Pre-fix the Dismiss control left the viewport (measured top-negative card at both widths); post-fix it is inside.

## AC4 - hint, ladder, reveal-gate, and run-pointer contracts unchanged

- Met by construction and review: `PracticeCoach.tsx` has an empty diff, the native `<details>` disclosure is untouched, and no stream, tier, gate, or pointer logic was edited (R2 delegate item 1).
- The spec mocks only the hint SSE body with exact server `GuideFrame` shapes; generation, grading, and reveal paths run their real code untouched.

## AC5 - unit tests plus browser evidence green with zero console errors

- Met: `PracticeCoach.test.tsx` 11/11, guide suite 34/34, `pnpm typecheck` clean, `pnpm lint` clean (0 errors).
- The live spec asserts zero console/page errors via the shared `errors()` fixture at both widths.
- Full app suite is 1078/1080 with the only 2 failures in `seedTestData.test.ts`, the documented pre-existing WSL TZ flake that passes under `--pool=forks` and is unrelated to this change.

## Request IDs and redaction (rules 16, 17)

- No request-id log join: the hint stream is mocked, so no live `/v1/guide/stream` call was exercised; the one live call per run (question generation) is covered by the generation path's own tracing.
- Redaction holds by construction: the only citation content rendered is probe text, the spec performs no submit or grading, and no reference solution or hidden test ever enters the page; no DOM sweep was needed because no secret-bearing endpoint is called.
- Shared-account hygiene (rule 16): every spec run deletes its windowed assessments via service-role and asserts the cascade emptied attempts; in-spec assertions enforce it.

## Stability note

- The first post-fix full-file run showed one desktop failure at an uncaptured step, then desktop passed twice consecutively and phone passed twice; no code changed between runs.
- The failure artifacts were auto-cleaned before the step could be identified, so the transient is recorded as unclassified rather than explained.
