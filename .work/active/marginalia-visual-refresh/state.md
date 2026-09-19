# State – marginalia-visual-refresh
_Spec: .work/specs/marginalia-visual-refresh.md · Plan: active/marginalia-visual-refresh/plan/ · STATUS row: marginalia-visual-refresh · Status: active · Updated: 2026-09-16_

## Current state & next

- Session 2 fixed all three Home critique P1s, all four P2s, and the in-scope P3s. Typecheck, lint, `pnpm build` (both apps), app suite 877/879 (2 = documented WSL TZ baseline), progress 101/101, py-progress 79/79, and e2e smoke 10/10 are green.
- Verified in a real browser at 1280px and 375px this session (a vision-capable pass, unlike session 1): heading order is now H1 28px → H2 22px "Last 12 months" → H2 19px "Recent activity"; one accent button on Home; the year calendar fits its card at both widths with zero horizontal overflow.
- **The user's review gate is open.** No other screen may be touched until they confirm the Home pass.
- Next: present for review; then, on confirmation, cut the remaining P3s and propagate to Week/Roadmap/Materials/Session/onboarding/marketing (spec sequence steps 6-8).

## Done so far

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
- **Remaining P3s (not yet fixed):** no `aria-current` in the nav; no skip link; loading is still a bordered text row rather than the three-dots pattern; no path from the year calendar to the weekly review; Home greets by raw email local-part.
- **Design-detector findings left standing (pre-existing, attribution unknown, neither introduced this session):** `roadmap.css:118` gives `.roadmap-ended-banner` a 4px rust left edge on top of a 1px terracotta border and a terracotta tint — DESIGN.md pins the banner edge at 3px, and terracotta (act) plus rust (attention) on one element mixes two meanings. `components.css:341` transitions `width` on `.progress-fill`; the performant form is `transform: scaleX()`, but that changes how the rounded pill renders at partial widths, so it needs a design decision rather than a silent swap.
- **Critique re-run pending:** the re-run that scores the session-2 Home (spec done-criteria) has not been run.
- **`e2e/material-ingestion-live.spec.ts` sign-out fix is UNVERIFIED** — it needs live credentials and the service-role environment to run.
- **Deferred by scope, not by rejection:** the marketing site pass, and the four screens that earn a real desktop layout.
