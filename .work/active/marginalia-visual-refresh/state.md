# State – marginalia-visual-refresh
_Spec: .work/specs/marginalia-visual-refresh.md · Plan: active/marginalia-visual-refresh/plan/ · STATUS row: marginalia-visual-refresh · Status: active (session 3; user review gate still open) · Updated: 2026-09-20_

## Current state & next

- Session 3 fixed every remaining unblocked P3 and the two P1s the critique re-run surfaced. The user's Home review gate is **still open**; no other screen may be touched until they confirm.
- Added: `aria-current="page"` on both navs; a skip link + focusable `#main-content`; the three-dots loading state (`LoadingState` on the route-level waits, an inline variant on Home's calibrating row, and the canonical `.processing-dots` CSS that `PlaylistLoadingPopup` referenced but was never defined); a "Week review →" link in the calendar header; a greeting that never uses the email local-part; the ended-roadmap banner pinned to the DESIGN.md 3px single-meaning edge.
- Verified in a real browser at 1280 and 375 this session: skip link -9999 → 12,12 on focus, `aria-current` on Home, `/study/week` href, greeting "Good afternoon.", zero horizontal overflow at both widths, zero page errors.
- **Critique re-run: 32/40, up from 23/40** (two isolated sub-agents + detector; detector clean on the changed TSX). Remaining findings recorded under Open.
- Next: the user's Home verdict; then the deferred P2/P3s below and spec steps 6-8.

## Done so far

- Session 3 (2026-09-20) — remaining unblocked P3s + the critique re-run's P1s:
  - **Nav a11y:** `aria-current="page"` on the active destination in both nav variants (`NavBar.tsx`); a "Skip to content" link (`AppShell.tsx`, `.skip-link`) targeting a focusable `#main-content`.
  - **Loading states (No-Spinner Rule):** new `LoadingState` component used on the route-level waits (`ProtectedRoute`, both `App` gates); Home's calibrating row gets the dots inline; and the canonical `.processing-dots`/`.processing-dot` CSS is now defined in the token package, which also fixes `PlaylistLoadingPopup` (it referenced the classes but they had never been defined anywhere).
  - **Calendar → week path:** `StreakCalendar` gained a `headerAction` slot and Home passes a "Week review →" link, replacing the orphaned ghost button the critique flagged.
  - **Greeting:** Home greets by `user_metadata.full_name`/`name` when present, else just the time-of-day greeting; it never renders the raw email local-part.
  - **Ended-roadmap banner:** pinned to DESIGN.md's 3px single-meaning edge (rust warning), dropping the 4px edge + terracotta border/tint mix.
  - **Critique re-run:** 32/40 (from 23/40), two isolated sub-agents + detector; detector clean on the changed TSX.
- Session 1 (2026-09-16): DESIGN.md + `.impeccable/design.json`; Home distilled; year streak calendar with TS+Python parity; service-banner copy; critique re-run at 23/40.
- Session 2 - P1a two accents on an ended roadmap: `RoadmapEndedBanner` "Extend deadline" is now `btn-primary` and "Abandon" is `btn-destructive`, so the Up-next card keeps the screen's only accent.
- Session 2 - P1b heading inversion: the streak title became a real `<h2 class="t-display-3">` (22px) and "Recent activity" dropped to the 19px `card-title` tier.
- Session 2 - P1c hollow no-roadmap Home: the reference's empty state (title/body/action) now fills the hero slot, and the signature calendar is un-gated from roadmap progress.
- Session 2 - P2 ink-faint contrast: darkening to `#6F6252` makes tertiary text AA on every surface it sits on (4.66 / 5.18 / 5.54:1).
- Session 2 - P2 streak-ramp separability: re-spaced for even steps (worst pair 1.22 -> 1.41) plus the reference's inset hairline as a non-color channel; the 3:1 ceiling is derived and documented in DESIGN.md.
- Session 2 - P2 Settings composite: `.settings-group`/`.settings-row` extracted from the reference into the token package, and Settings now has an identity row and a guarded destructive action.
- Session 2 - P2 projection referent: the verdict names its deadline ("12 days past Oct 3"), and the stat label keeps its "provisional" honesty signal.
- Session 2 - P3s fixed: touch targets under `pointer: coarse`, `prefers-reduced-motion` for `pulse-sync`, year-grid `role="img"` + aria-label, month labels that cannot force overflow, format lexicon (`1h 20m`, "Xh of Yh"), `.btn-flag`.
- Session 2 - stale e2e repaired: `material-ingestion-live` and `session-log` sign-out helpers, plus a pre-existing strict-mode failure in `smoke.spec.ts`.

## Flow trace

1. `buildYearStreakGrid(sessions, today)` at `packages/progress/src/streak.ts` returns one `YearStreakCell { date, level 0-4, minutes, isToday }` per day over a 12-month window; `calculateStreak(sessions, today)` (same file, newly exported from the package index) returns `{ current, longest }`.
2. Home owns both: `yearSessions` is built from `SessionLogged` events alone, so the calendar no longer depends on `progress` (which `useProgress.ts:18` returns as null without an active roadmap). `progress` still drives the projection row.
3. Home renders in this order: banners → empty state *or* Up-next card → year calendar → projection → recent activity.
4. `findActiveRoadmap` returns the active-but-overdue roadmap, so `roadmapEnded.ended` and a non-null `roadmapPayload` are true together; that is why the ended banner and the Up-next card used to show at once.
5. Settings sign-out is a two-step row: the collapsed button opens the confirm, the confirm commits. Both share the name "Sign out" and only one is mounted at a time.
6. `signOut()` (`AuthGate.ts:64`) only calls `supabase.auth.signOut()`; it does not touch local data, which is why the confirm's consequence line promises the sessions stay on the device.
7. Critique flow: Setup → target slug `apps-app-src-pages-home-tsx` → two isolated sub-agents → synthesis → `critique-storage write` with `IMPECCABLE_CRITIQUE_META` → `critique-storage trend`.

## Files affected

- Session 3: `apps/app/src/components/LoadingState.tsx` (new); `apps/app/src/components/AppShell.tsx` (skip link + `#main-content`); `apps/app/src/components/NavBar.tsx` (`aria-current`); `apps/app/src/components/StreakCalendar.tsx` (`headerAction`); `apps/app/src/auth/ProtectedRoute.tsx`, `apps/app/src/App.tsx` (route-level `LoadingState`); `apps/app/src/pages/Home.tsx` (greeting, week link, inline dots) + `Home.test.tsx`; `apps/app/src/roadmap/roadmap.css` (ended banner edge); `packages/design-tokens/src/components.css` (`.processing-state`/`.processing-dots`/`.skip-link`/`.streak-calendar-link`; `.btn-flag` 44px).
- `packages/design-tokens/src/tokens.css` – `--ink-faint` -> `#6F6252`; `--streak-1/2/3` re-spaced for even separation.
- `packages/design-tokens/src/components.css` – dropped `.streak-calendar-title`; inset hairline on cells and legend swatches; `.settings-group`/`.settings-row` extracted from the reference; `.btn-flag`; `pointer: coarse` touch targets; `prefers-reduced-motion` for `pulse-sync`; calendar grid is `minmax(0, 1fr)` at `width: 100%` with clipped month labels.
- `packages/progress/src/index.ts` – exports `calculateStreak` (Python already exported `calculate_streak`; no engine behaviour changed, so no new parity fixtures).
- `apps/app/src/components/StreakCalendar.tsx` – `<h2 class="t-display-3">` title, `role="img"` + summary aria-label, `aria-hidden` month labels, labels narrower than 3 weeks dropped, singular/plural fix, `minmax(0, 1fr)` columns.
- `apps/app/src/pages/Home.tsx` – no-roadmap empty state; calendar un-gated and fed by `calculateStreak`; duration formatter to lexicon; "X of Y" instead of "% complete"; projection verdict names its deadline; flag button uses `.btn-flag`.
- `apps/app/src/pages/Settings.tsx` – identity row + grouped destructive action with confirm and consequence line.
- `apps/app/src/roadmap/RoadmapEndedBanner.tsx` – accent removed, destructive action marked.
- `apps/app/src/pages/Home.test.tsx` – 2 new tests (empty state, calendar-through-a-gap).
- `apps/app/src/roadmap/RoadmapEndedBanner.test.tsx` – 1 new test locking the one-accent invariant.
- `e2e/material-ingestion-live.spec.ts`, `e2e/session-log.spec.ts` – sign-out now goes through Settings and its confirm.
- `e2e/smoke.spec.ts` – `exact: true` on the Continue button (pre-existing strict-mode failure).
- `DESIGN.md` – ink-faint and streak ramp values; the ramp's contrast ceiling is now derived in prose. `.impeccable/design.json` – ink-faint canonical.
- `apps/app/src/components/StreakCard.tsx` – deleted in session 1 (only Home used it).

## Pitfalls & rules

- **Never edit committed parity fixtures as a side effect.** Re-exporting regenerates 14 pre-existing files with float-formatting drift; restore with `git checkout -- tests/fixtures/pillar-a/progress/` and keep only new files.
- **The fixture export must run under `TZ=Asia/Kolkata`**, because the py conftest pins that TZ.
- **`pnpm typecheck` does not cover `e2e/`.** Verify spec edits with `pnpm exec playwright test -c e2e/playwright.config.ts --project=app --list`.
- **The sign-in button's accessible name is `Continue`; use `exact: true`.** Strict mode also matches "Continue with Google" (this was a live failure in `smoke.spec.ts`).
- **`playwright-cli eval` echoes the code it ran, so any credential interpolated into it lands in the transcript.** Use length-only checks; `playwright-cli fill` with shell env vars silently fills empty, and `run-code` has no `process` global to read them from.
- **WSL/Vite:** restart `./full-app restart full` after source edits before any browser verification; Vite does not watch `/mnt/d`. Confirmed again this session: the browser kept serving `min-width: 600px` until the restart.
- **A fixed `min-width` on a square-cell grid makes rows drive columns.** The calendar grew to 1031px inside a 574px card. `minmax(0, 1fr)` + `width: 100%` lets the container drive instead.
- **`--ink-faint`'s binding surface is Paper Deep (the sync pill's own ground), not Cream Paper.** Measure the darkest surface a text token sits on, not the most common one.
- **Rule 41 (engine parity):** `calculateStreak` already exists in both stacks; exporting it from the TS index adds no behaviour and needed no fixtures.
- **Two pre-existing app test failures** (`src/dev/seedTestData.test.ts`, WSL TZ) are the accepted baseline; do not chase them.
- **Live test credentials:** `.work/specs/test-login-cred.txt`, values in backticks; strip them and `\r`. The password is 6 characters and is correct as-is.
- **The Impeccable design hook is active** and scans on every UI edit. Its `components.css` findings are advisory and pre-existing (60+ literal font sizes off the documented ramp, the 3px banner edges DESIGN.md's own Banners rule specifies, and the `--ease-spring` token); a clean TSX scan is not a clean bill of health.
- **The dev seeder is `window.__seed()` / `window.__wipe()`**, reachable once signed in. `__wipe()` destroys the shared dev account's data; get the user's approval before calling it.

## Decisions in force

- North Star **"The Reading Room"**; earthen color names; quiet-journal character (user, 2026-09-16).
- Keep **six nav destinations** and amend the design system (user, 2026-09-16).
- Home shape: **distill to the one job** (Up-next hero, year streak, one honest projection line) (user, 2026-09-16).
- Priority order: **hierarchy first** (user, 2026-09-16).
- Critique fixes and the review happen in a **new session with a different model**; no further screens until the user confirms (user, 2026-09-16).
- **`--ink-faint` darkens**; the contrast-token fix was explicitly deferred to session 2 and applied there (user, 2026-09-16).
- **The streak ramp keeps its cream-to-moss endpoints** and is not darkened toward black to chase 3:1; level is carried by the inset hairline as a second channel (session 2, from the design-system rules).
- **Sign out is a guarded two-step row** on Settings rather than a bare destructive button (session 2).
- **The year calendar is a lifetime surface**, fed by the event log rather than roadmap progress (session 2, from DESIGN.md's "it never resets").

## Open

- **User review of the Home pass** · blocks spec sequence steps 6-8 · the user must confirm before any other screen is touched.
- **Critique re-run done (32/40, from 23/40).** Its remaining findings, deferred pending the user's review (all P2/P3, none a regression from session 3):
  - P2 container consistency: the projection/total stat is a hand-rolled inline div in one branch and a `Card` in the other (`Home.tsx`); the projection block re-declares border/radius/padding inline instead of using the `Card` primitive.
  - P2 banner stacking: up to five banners can coexist above content (`Home.tsx`), pushing the day's one job below the fold.
  - P3 redundant empty copy: eyebrow `No active roadmap` + title `No active roadmap yet.` say the same thing twice.
  - P3 `.progress-fill` width transition (detector): **decision taken 2026-09-20 - keep `width`.** `transform: scaleX()` would flatten the pill's rounded leading edge (the container clips only the far edge), a visual regression for a 6px bar whose transition cost is negligible. Recorded, not silently swapped.
  - Detector CSS advisory (52 off-ramp literal font sizes, 4 off-scale radii, 3 undocumented colors) is pre-existing and out of scope for the Home pass.
- **Sign-out helper VERIFIED live 2026-09-20.** `e2e/session-log.spec.ts` was repaired twice over: it used the stale `Sign in` button name (the app renders `Continue`) and it swallowed every assertion in a `catch`, so it always reported green. It now signs in with the real label, seeds a roadmap through `window.__seed()` (a fresh account is gated into onboarding), logs a session, asserts it survives a reload, signs out through the Settings two-step, and proves user B does not inherit user A's session — and it can actually fail. `e2e/material-ingestion-live.spec.ts` uses the same two-step sign-out helper; the full ingestion spec (600 s, 572-page upload) was not re-run for this, since the helper path is what was in question and it is now verified.
- **Deferred by scope, not by rejection:** the marketing site pass, and the four screens that earn a real desktop layout.
