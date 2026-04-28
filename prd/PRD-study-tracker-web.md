# Study Tracker — Web Version PRD

## Problem Statement

The original Study Tracker PRD described a respectful, local-first study companion for self-directed learners working through structured material — quietly mirroring the user's discipline rather than enforcing it. That product was specified for native mobile.

Two realities have shifted since:

1. **Building and shipping native mobile apps is impractical from the developer's current environment.** Native iOS in particular requires a Mac and an active Apple Developer account; native Android requires its own toolchain. Neither is a fight worth picking when the same product can reach users via the open web.

2. **Discovery matters.** A native app behind two app stores is invisible by default; it has to be marketed *in*. A web app at a memorable domain with an SEO-optimized landing surface is visible to anyone who searches. Self-directed learners — the target user — overwhelmingly find tools through search and word-of-mouth web links, not store listings.

The user needs a web version of Study Tracker that preserves the product's character (local-first feel, respectful tone, paper-like aesthetic, honest reflection of their actual studying) while honestly handling the differences the web platform introduces — notification limits, storage eviction risks on mobile Safari, multi-device sync expectations, offline behavior, and the fact that on the web, a "session" can mean three different things (browser tab, auth session, study session) that all need to be reasoned about together.

## Solution

A mobile-first responsive web app at `studytracker.app/study/*`, paired with a static SEO-optimized marketing site at the apex domain.

**Where the studying actually happens:** Desktop is the primary surface for the studying-shaped flows — active sessions with embedded YouTube videos, onboarding's materials curation, re-plan deliberation, and weekly progress review. The desktop layout for these screens is genuinely designed (not a stretched-up phone), with horizontal space used to put video, charts, or two-column comparisons in front of the user without scrolling.

**Where mobile fits:** Mobile is the convenience surface — checking the streak, quickly logging a session done away from the laptop, glancing at the weekly verdict, getting the morning's "up next" reminder when the app is open. Mobile flows match the existing `all-screens.html` design exactly, up to a 1024px breakpoint.

**How users find it:** A separate Astro-built marketing site lives at `studytracker.app/`, `/about`, `/how-it-works`, `/privacy`, `/terms`. Static HTML, ships zero JavaScript for content pages, indexable by search engines, fast on every device. The "Get started" call-to-action navigates into the app at `studytracker.app/study/sign-in`.

**Auth from minute one.** Sign-in is required to use the app — not because the product wants to gate the experience, but because mobile Safari evicts site data after seven days of no interaction with the site, which would silently destroy a signed-out user's streak after a single vacation. Auth-required is the only honest answer on the web platform.

**Sync that actually works across devices.** A per-event sync model (events to Postgres, periodic snapshots for fast restore) replaces the original PRD's blob-backup design. The user can log a session on their phone in the morning, open their laptop in the afternoon, and the session is there. Conflicts are resolved at the record level via timestamps; concurrent edits (rare in a study tracker) accept last-write-wins.

**Honest reminders.** No push notifications in v1. The planned-end ping during an active session uses `setTimeout` while the tab is open, and recomputes on tab refocus to deliver the signal whenever the user returns. Tab title flash and favicon dot give the signal a chance to be seen from another tab. Web Push lands in v1.1 as an additive upgrade.

**Local-first feel preserved.** Dexie (IndexedDB) holds the projection of the user's events on every device; the app reads from local storage, writes to local storage, and the sync engine pushes events to Postgres in the background. Going offline doesn't break the app — sessions can be logged, the local UI stays current, and pending events flush when the network returns.

## User Stories

### Discovery and onboarding

1. As a self-directed learner searching for "study time tracker" or "focused study app," I want to find Study Tracker on the first page of search results, so that I can evaluate whether it fits my needs.
2. As a visitor to the marketing site, I want to read a clear explanation of what the app does without having to sign up, so that I can decide if it's for me.
3. As a visitor to the marketing site, I want to see screenshots of the actual app so that I have an accurate sense of what I'm getting into.
4. As a visitor to the marketing site, I want to read the privacy policy and terms of service before signing up, so that I understand what I'm agreeing to.
5. As a new user, I want to sign up with my email and a password, so that I can get started without depending on a third-party identity provider.
6. As a new user, I want to sign up with Google in one tap, so that I don't have to invent another password.
7. As a new user, I want to receive a confirmation email at sign-up, so that I'm protected from someone using my email address by mistake.
8. As a new user, I want to be guided through a short onboarding flow that captures my deadline, weekly hours, and study materials, so that the app can build a roadmap that fits my actual life.
9. As a new user pasting URLs of YouTube videos or articles during onboarding, I want the app to fetch titles and length estimates automatically, so that I don't have to type them.
10. As a new user, when the app can't read one of my pasted URLs (a paywalled article, a deleted video, an anti-bot-protected page), I want to fill in just the title and length inline, with whatever the app *did* manage to extract pre-filled, so that I don't have to start from scratch.
11. As a new user, I want to add manual entries for things that don't have URLs (a textbook on my desk, a course PDF on my drive, my own notes), so that the roadmap reflects everything I'm actually studying.
12. As a new user adding a manual entry, I want to optionally include a URL pointing to where I'll read it (a Google Drive link, a Dropbox PDF, a Notion page), so that the active-session screen can give me a one-tap "open it" affordance.
13. As a new user reviewing the proposed schedule, I want to see the projected daily breakdown and edit individual sessions inline before committing, so that the schedule reflects how I actually want to spend my time.

### Daily loop

14. As a returning user, I want the home screen to lead with what I'm studying next, so that opening the app translates immediately into starting work.
15. As a returning user on the home screen, I want to see my current streak, projected finish date, and recent activity at a glance, so that I have the context I need without navigating.
16. As a returning user, I want to start the next planned session with one tap from the home screen, so that the friction between intent and action is minimal.
17. As a user starting a session whose material is a YouTube video, I want the video to embed inside the active-session screen with the timer above it, so that I can watch and track time without switching tabs.
18. As a user starting a session whose material is an article, I want the article to open in a new tab with a clear "come back here when you're done" message in the original tab, so that I know where to return to log my time.
19. As a user starting a session whose material is a manual entry with a URL, I want a one-tap "Open material" button that opens the URL in a new tab, so that I can get to my reading without copy-pasting.
20. As a user starting a session whose material is a manual entry without a URL, I want the active-session screen to just show the title and run the timer, so that I can study from a physical book or local file without the app getting in the way.
21. As a user in an active session, I want the planned end time to be clearly visible, so that I can pace myself.
22. As a user in an active session, I want a gentle signal when planned end is reached, so that I can choose to wrap up or continue with intention.
23. As a user in an active session, when I switch to another tab (the YouTube video, an article), I want the planned-end signal to still find me — through a tab title flash, a favicon dot, and an in-app banner when I return — so that I don't accidentally study way past my planned time.
24. As a user, when I tap End on a session, I want it logged immediately to local storage and synced to the cloud within seconds, so that I never lose a logged session.
25. As a user finishing a session that ran ten or more minutes past planned end without my intervention, I want the app to ask whether I was still studying — with options to log it all, trim to my best guess, or discard — so that the data reflects what actually happened.
26. As a user who closed the tab during an active session and reopened within a few minutes, I want to be silently dropped back on the active-session screen, so that I can keep going without ceremony.
27. As a user who closed the tab during an active session and didn't return until much later, I want the same "were you still studying?" dialog as the walk-away case, so that I can resolve the ambiguity instead of having a wildly stale timer auto-resume.
28. As a user who left a session running past midnight or past six hours, I want the session to be passively abandoned and a small dismissible notice on home to tell me, with a hint that I can manually log it if I actually did study, so that I'm not surprised by silent data loss but also not stuck with a stuck timer.
29. As a user who studied something away from the app (offline reading, a class), I want to log a past session by entering duration, date, and what I worked on, so that my activity log reflects reality.

### Re-planning and progress

30. As a user whose pace has consistently outrun or fallen behind the original plan, I want the app to offer a re-plan with three concrete options (extend the deadline, increase weekly hours, cut scope), so that I can adapt without doing math.
31. As a user reviewing re-plan options, I want to see each option's implied projection and tradeoffs side by side on desktop, so that I can compare without cognitive overhead.
32. As a user choosing the "cut scope" re-plan option, I want a clear two-column picker showing what I'd cut and what I'd keep, so that I can make an informed decision.
33. As a user, I want a weekly progress screen that gives me a one-line verdict, a short narrative of how the week went, and the relevant charts, so that I have a reflection moment without it feeling like a corporate dashboard.
34. As a user, I want the weekly narrative to be written in plain prose, generated fresh each week, so that the reflection feels personal rather than templated.
35. As a user opening the weekly narrative, I want it to render progressively as it streams from the LLM, so that I see something happening within a second instead of staring at a loader.

### Multi-device and sync

36. As a user signed in on both my laptop and phone, I want a session I logged on one device to appear on the other when I open it, so that I'm not living in two divergent timelines.
37. As a user opening the app on a different device than I last used, I want the latest data to be there automatically without my having to "refresh" or "sync" — pull happens at sign-in and on tab focus after a meaningful idle period.
38. As a user, I want a small "Synced X ago" indicator on the home screen that I can tap to force a sync, so that I have a manual escape valve for the rare moment I want the latest immediately.
39. As a user looking at the sync indicator after a successful pull, I want to briefly see how many new events came in from another device, so that I have context for any UI changes I'm about to see.
40. As a user, when sync fails (offline, network error), I want the indicator to show "Sync failed · tap to retry" so that I know the state and have an action.
41. As a user who edits the app on Device A while Device B is also open and editing, I accept that the later write will overwrite the earlier on the rare same-record collision — but additive writes (two new sessions on two devices) should both survive.

### Auth and account

42. As a returning user, I want to sign in with email and password or Google with the same screen, so that I can pick whichever I used at signup.
43. As a user who forgot my password, I want a "Forgot password?" link on the sign-in screen that emails me a reset link, so that I can recover without contacting support.
44. As a signed-in user on a single device, I want to stay signed in across browser restarts, so that I don't have to re-enter credentials every day.
45. As a user signing in on a brand-new device, I want my full data history to restore from the cloud (the latest snapshot plus any newer events), so that I'm not starting from scratch.
46. As a user signing out, I want my local data retained on this device, so that signing back in on the same browser is fast and offline-friendly.
47. As a user signing in on a browser that has another account's local data, I want the local data wiped before the new account's data is loaded, so that there's no cross-account bleed.
48. As a user, I want a "Delete my account" option in settings that permanently removes my data from the cloud, so that I can exercise my data rights without contacting support.

### Settings and preferences

49. As a user, I want my preference toggles (sync indicator visible, prompt cooldowns, dismissed banners) to follow me across devices, so that I don't have to re-dismiss the same nudges on every browser.
50. As a user who dismissed a prompt (recalibration, PWA install nudge), I want it to stay dismissed for the cooldown period across all my devices, so that the app doesn't pester me twice.
51. As a user, I want the settings screen to show when the app last successfully synced, so that I have an honest signal about my data's freshness.

### Web platform behavior

52. As a user, I want the marketing site to load fast and look polished on first visit so that I form a good impression before any JavaScript is evaluated.
53. As a user clicking "Get started" on the marketing site, I want to land in the app's sign-in screen, so that the path from interest to action is one click.
54. As a user, I want the app to be installable to my home screen on mobile and to my desktop, so that it feels like a real app and stays accessible.
55. As a user who installed the app to my home screen, I want it to launch in a standalone window without browser chrome, so that the focus on the studying surface is preserved.
56. As a user with a flaky connection, I want to be able to log a session offline and have it sync when the network returns, so that connectivity issues don't derail my studying.
57. As a user closing the tab unexpectedly during a session, I want the session's current state preserved locally so that on next open I can resume or resolve cleanly.
58. As a user on iOS Safari, I want the same full functionality as on Chrome — including offline-first behavior — provided I install the app to my home screen, so that platform isn't a second-class experience.

## Implementation Decisions

### Architecture and deployment

- **Two deployments under one apex domain.** The Astro-built marketing site is deployed to Vercel and serves the apex (`studytracker.app/`, `/about`, `/how-it-works`, `/privacy`, `/terms`). The Vite + React app is deployed to a separate Vercel project and serves everything under `/study/*`. Vercel's path-based routing handles the split at the edge.
- **Hosting region.** Supabase project provisioned in `ap-south-1` (Mumbai) given the developer's location and expected early-user geography.
- **Single origin, scoped service worker.** Same-origin deployment means we get clean URLs at the cost of needing discipline around storage scope. The Vite app's service worker is registered with `scope: '/study/'` so it cannot intercept marketing pages. The Astro site does not register a service worker. IndexedDB is opened only by the app, never by the marketing pages.

### Sync engine and event model

- **Per-event sync replaces blob backup.** Every meaningful user action is a typed domain event written to a Postgres `events` table (RLS-scoped to `auth.uid()`). Each device is the sole writer of events it generates.
- **Hybrid event model.** Events are domain-level (e.g., `SessionLogged`, `RoadmapCreated`, `MaterialAdded`, `SessionTaggedExceptional`, `RecalibrationPromptResolved`, `RoadmapReplanned`), not row-level. Derived state (streak grids, projected finish dates, calibration multipliers, daily totals, weekly verdicts) is recomputed on each device from the event log and never synced as its own data.
- **Event kinds for v1** are a small enumerable set: `SessionLogged`, `SessionEdited`, `SessionTaggedExceptional`, `RoadmapCreated`, `RoadmapEdited`, `RoadmapReplanned`, `RoadmapMarkedComplete`, `RoadmapMarkedAbandoned`, `MaterialAdded`, `MaterialRemoved`, `RecalibrationPromptResolved`, `OnboardingCompleted`, `PreferenceSet`. Two kind-buckets in code: user actions vs. preference state, sharing the same event log.
- **Local Dexie state is a projection.** On startup, the app pulls events newer than its last known event_id, replays them against local Dexie state, and subscribes the UI to Dexie liveQueries.
- **Periodic snapshot for fast restore.** A serialized projection of current state is written to Supabase Storage on a debounced cadence; brand-new devices restore the snapshot first, then replay only the events newer than the snapshot.
- **Pull-on-foreground sync.** Pull happens at sign-in, on tab refocus after >5 minutes idle, and before every local write (to detect cloud-newer state and avoid writing on stale base). No real-time websocket subscription.
- **Manual sync trigger.** A tappable "Synced X ago" indicator on home and a "Sync now" row in settings let the user force a pull.
- **Backup cadence:** every ended session triggers an immediate event push; calibration updates and roadmap edits push immediately on user action; failed pushes go into a local pending-events queue and retry on next sync trigger.
- **Conflict resolution:** record-level last-write-wins by event timestamp. Additive writes from multiple devices (two new sessions) both survive because they're separate event rows. Concurrent edits to the same record (rare) accept that the later write wins. No CRDT layer.
- **Schema versioning.** Every snapshot blob carries a `schemaVersion` integer. On restore, snapshots with a newer version than the local app refuse to load and prompt the user to refresh; snapshots with an older version run a forward-only migration on import. Backward migrations are explicitly never supported.

### Storage and durability

- **Dexie.js over IndexedDB** is the local storage layer. `liveQuery` provides reactive subscriptions; `db.export()` / `db.import()` provide snapshot serialization.
- **Auth required to use the app.** Signed-out usage is not supported; sign-in gates all `/study/*` routes except `/study/sign-in`. This is a deliberate response to mobile Safari's seven-day storage eviction rule under ITP — without an account anchor and cloud backup, signed-out users would silently lose data.
- **Storage Persistence API requested at sign-in.** On Chrome/Edge/Firefox the request usually auto-grants for sites the browser considers important; on Safari it requires PWA install. We request it once and surface a dismissible "Add to Home Screen to keep your progress safe" nudge to iOS Safari users specifically.
- **Save-on-close pattern.** Every meaningful state change writes synchronously to Dexie (which persists immediately to IndexedDB). `visibilitychange → hidden` and `pagehide` handlers fire `navigator.sendBeacon()` to flush any pending event uploads. Tab close is treated as "the page might be about to die" rather than trying to distinguish closing from backgrounding.
- **Account switch wipes local first.** Signing in as a different user on the same browser triggers a local-data wipe before restoring the new account's snapshot.

### Active session

- **YouTube embeds inside the active-session screen** via the IFrame Player API. Timer sits above the video. Planned-end ping fires reliably because the tab stays foregrounded.
- **Articles open in a new tab** with a clear in-app banner reading "Article opened in new tab — come back here when you're done." Iframe-fallback is not attempted because most modern publishers block iframe embedding.
- **Manual-entry materials with an optional URL pointer** get a one-tap "Open material" affordance on the active-session screen. Manual entries without a URL just show the title and run the timer.
- **Planned-end ping mechanism (v1):** `setTimeout` set when the session starts, plus a recompute-on-`visibilitychange` safety net that delivers the signal on tab refocus if the timeout missed. Visual delivery is tab title flash + favicon dot + in-app banner when the tab is visible. Tab title flash auto-restores after 60 seconds; favicon dot persists until the user taps End or dismisses the banner.
- **Walk-away dialog** fires when elapsed exceeds planned + 10 minutes and the user did not tap End. Three options: log all, trim to my best guess, discard.
- **Tab-close-and-reopen recovery (Q19):** silent resume below 5 minutes past planned end; walk-away dialog otherwise.
- **Stale-session abandonment (Q7):** sessions whose elapsed exceeds 6 hours OR whose start_time is before today's calendar date are passively abandoned on next open. A small dismissible notice on home reads "We didn't hear back from your session yesterday — it wasn't logged. You can log it manually if you studied." The 10-minute walk-away threshold is unchanged for normal returns.
- **YouTube re-embed on resume:** the video reloads from the beginning because YouTube's IFrame API doesn't expose persisted playback position. A 10-second hint above the embed reads "Video reloaded — scrub to where you were."

### Layout and routing

- **URL structure:** marketing pages at root (`/`, `/about`, `/how-it-works`, `/privacy`, `/terms`); app at `/study/*` (`/study/sign-in`, `/study/home`, `/study/onboarding`, `/study/session`, `/study/log`, `/study/week`, `/study/replan`, `/study/roadmap`, `/study/roadmaps`, `/study/settings`).
- **Two-tier responsive layout.** Mobile design from `all-screens.html` is preserved exactly up to 1024px (covering phone and small tablet). Above 1024px, four screens get genuinely different desktop layouts:
  - **Active session:** YouTube embed at ~880px width centered, timer + material info as a slim panel above, end-session as a fixed bottom-right floating affordance.
  - **Onboarding materials and preview steps:** two-column — input/forms on the left, growing preview on the right.
  - **Re-plan options:** three options as side-by-side cards rather than stacked. Trim-scope override as a two-column to-cut/to-keep picker.
  - **Weekly progress:** magazine layout — verdict and narrative left, charts right.
- **Other screens stay column-shaped at desktop**, just wider (max-width ~640–680px) with type scaled up via CSS clamp().
- **Navigation is consistent across all sizes:** small bottom-or-top nav bar, no sidebar at any breakpoint.

### Notifications

- **No push notifications in v1.** All reminders are in-app. The "Up next in 12 min" home-screen card and the active-session planned-end ping are the only reminder surfaces.
- **NotificationStrategy module designed for v1.1 Web Push upgrade.** v1 implementation does setTimeout + tab title flash + banner. v1.1 implementation will add Web Push delivery via a Supabase Edge Function on a `pg_cron` schedule, without changing the SessionLifecycle call site.

### Auth

- **Email/password and Google OAuth** at v1, both via Supabase Auth.
- **Email confirmation required** at signup in production.
- **Password reset** via Supabase's built-in email flow, surfaced as a "Forgot password?" link on the sign-in screen.
- **Apple Sign-In is deferred** (out of scope at v1) — there's no App Store rule forcing pairing on the open web, and the setup overhead is high for marginal user benefit.

### LLM and external data

- **MaterialsMetadataProxy Edge Function** wraps YouTube Data API and article fetch + Mozilla Readability. API keys live server-side. CORS is not an issue because the Edge Function is the network egress point.
- **LLMProxy Edge Function** wraps OpenAI for the weekly narrative, with server-held API key. Streams responses back to the client via Server-Sent Events for progressive rendering.
- **Materials metadata fallback (Q13):** when a URL fetch returns partial or no data, the per-item form pre-fills whatever was extracted (e.g., the title from `<title>` tag if Readability bailed) and asks the user only for the gaps.

### Account deletion

- **"Delete my account" in settings** at v1. Deletion permanently removes the user's row in `auth.users`, all events, and all snapshots. Cascades via Postgres foreign keys.
- **Data export is deferred to v2.** Users with an installed app effectively have a self-export path through their local Dexie state.

### Telemetry

- **Plausible Analytics** for basic page-view and event analytics on both the marketing site and the app. No consent banner needed under EU law given Plausible's privacy-respecting design.
- **No session replay tools, no behavioral analytics, no third-party trackers** at v1.

### Module decomposition

The app is built as twelve modules with clean boundaries and dependency injection at every external touchpoint:

- **SyncEngine** (deep) — `pushEvent`, `subscribe`, internal queue + retry + sendBeacon flush + snapshot scheduling + conflict detection.
- **EventStore** (deep) — Dexie-backed event log + projection state, reactive liveQuery subscriptions.
- **SessionLifecycle** (deep) — owns active session row, transitions, planned-end timer, walk-away/stale detection, composes with NotificationStrategy.
- **ProgressEngine** (deep, pure) — derives streak, projection, burn-up, daily totals from events.
- **PaceCalibration** (deep, pure) — derives pace multiplier from "normal"-tagged sessions, manages cooldown.
- **ReplanEngine** (deep, pure) — computes the three re-plan options.
- **NotificationStrategy** (designed deep, shallow at v1) — abstracts planned-end ping delivery; v1 setTimeout+banner, v1.1 Web Push.
- **AuthGate** — Supabase Auth wrapper, route protection, account-switch local-wipe.
- **MaterialsMetadataClient** — typed wrapper around the Edge Function with fallback handling.
- **WeeklyNarrativeService** — calls LLMProxy with streaming, caches narratives.
- **PWAShell** — service worker, manifest, install prompt deferral.
- **DurabilityHooks** (cross-cutting) — encapsulates the visibilitychange/pagehide/sendBeacon/recompute-on-visibility patterns; consumed by SessionLifecycle and SyncEngine.

Edge Functions: **MaterialsMetadataProxy**, **LLMProxy**.

Marketing site: standalone Astro deployment with no code dependencies on the app.

Shared: **DesignTokens** workspace package consumed by both Astro and Vite.

## Testing Decisions

Per the developer's directive: every module is fully testable, and every module has tests written. Testability is a structural constraint applied at design time, not deferred.

**Design implications applied to every module:**

- Every module exposes a small, stable interface — operations are functions or methods on a single object, not pervasive globals.
- Every module that touches an external service (Supabase Postgres, Supabase Storage, Supabase Auth, the Edge Functions, browser APIs like Notifications/IndexedDB/visibility events) accepts the dependency via constructor injection rather than importing it directly. This permits in-memory or fake implementations during tests.
- Pure logic modules (ProgressEngine, PaceCalibration, ReplanEngine, EventStore replay, snapshot serialization) have no I/O at all — they're tested as pure functions over event lists and roadmap shapes.
- No module reads or writes module-scope mutable state. State that needs to be shared lives behind a typed accessor that is itself injectable.

**What constitutes a good test in this codebase:**

- Tests assert on **observable behavior** through the module's public interface, not on internal state shapes or call patterns.
- Tests use real Dexie against an in-memory IndexedDB shim (via `fake-indexeddb` or equivalent) rather than mocking Dexie itself — this keeps the tests honest about how the projection layer actually behaves.
- Tests use a fake Supabase client (a hand-written test double, not a generated mock) for AuthGate, SyncEngine network operations, and MaterialsMetadataClient. The fake exposes the same shape but operates on in-memory state.
- Tests for browser-API-dependent modules (NotificationStrategy, DurabilityHooks, PWAShell, parts of SessionLifecycle) run in `vitest` with `happy-dom` or `jsdom`, and use fake timers for any time-based assertions.

**Module-by-module test coverage:**

- **SyncEngine:** event ordering correctness, queue durability across simulated tab-close, retry behavior on simulated network failure, sendBeacon emission on visibilitychange, conflict resolution when cloud is newer, snapshot generation cadence, schema-version refusal logic.
- **EventStore:** replay determinism (same event list produces identical projection on every device), liveQuery subscription firing on writes, Dexie write-flush semantics, snapshot import/export round-trip.
- **SessionLifecycle:** start → planned-end → end happy path, walk-away dialog trigger at the threshold, tab-close-and-reopen silent resume below threshold, walk-away dialog above threshold, stale-session abandonment at the 6-hour and calendar-date boundaries, planned-end ping delivery on visible vs. hidden tab.
- **ProgressEngine:** streak calculation across calendar boundaries and timezones, projected finish under varying pace multipliers, burn-up shape across edge-case event sequences (empty roadmap, all-exceptional sessions, etc.).
- **PaceCalibration:** multiplier derivation correctness, cooldown enforcement, "exceptional has become the norm" prompt trigger.
- **ReplanEngine:** option computation across roadmap shapes (small/large, early/late in plan, near/far deadline), trim-scope picker output correctness.
- **NotificationStrategy:** v1 implementation delivers tab title flash, favicon dot, and banner in the right combinations across visible/hidden states; v1.1 Web Push integration tested via fake push subscription.
- **AuthGate:** sign-in/sign-out lifecycle, route protection, account-switch local-wipe, sign-in-on-fresh-device snapshot restore.
- **MaterialsMetadataClient:** success path, partial-data fallback path with pre-fill, full-failure path with empty form.
- **WeeklyNarrativeService:** streaming consumption from a fake EventSource, caching, offline-degrade path.
- **PWAShell:** service worker registration with correct scope, manifest correctness, install prompt deferral logic.
- **DurabilityHooks:** visibilitychange and pagehide handlers fire registered callbacks; sendBeacon called with correct payload.

**Edge Function tests** live alongside the function code: MaterialsMetadataProxy tested with a fake fetch and fake YouTube API client; LLMProxy tested with a fake OpenAI streaming response.

**Marketing site tests** are limited to build-output assertions: the static HTML is produced for each known route, links between pages resolve, no client-side JavaScript is shipped on content pages.

**Prior art:** since this is a greenfield codebase, there is no prior art in-repo. The testing patterns above are conventional for Vite + React + Dexie projects: `vitest` with `happy-dom`, `fake-indexeddb`, and hand-written test doubles for external services.

## Out of Scope

- **Native mobile apps** (iOS, Android) — deferred indefinitely given the developer's environment constraints. The web product *is* the mobile experience via PWA install.
- **Web Push notifications** at v1 — planned for v1.1 as an additive upgrade, with the NotificationStrategy module designed to absorb it without changing call sites.
- **Apple Sign-In** at v1 — no App Store pairing requirement on the web, and setup cost is disproportionate to user benefit. Reconsider in v2 if user demand emerges.
- **Magic-link auth** — every sign-in would require an inbox round-trip, which is friction for a daily-use app.
- **Real-time WebSocket sync** — pull-on-foreground covers the realistic cross-device usage pattern (sequential, not concurrent). Real-time would pay infrastructure and complexity cost for benefit users would rarely experience.
- **CRDT or operational-transform sync** — true concurrent-edit merge is a v2-scale architectural investment. v1 accepts last-write-wins on the rare same-record collision.
- **Data export** at v1 — deferred to v2. Users with the installed app have a self-export path via their local Dexie state.
- **Cloud upload of study materials** (PDFs, files) — deferred per the original PRD. Manual entries with optional URL pointers cover the realistic case (Google Drive link, Dropbox link, Notion page).
- **In-app PDF viewer** — out of scope at v1; PDFs hosted elsewhere open in a new tab via the article-fallback path.
- **Behavioral analytics, A/B testing, session replay** — Plausible covers v1 needs; richer telemetry can land later if behavioral funnels become necessary.
- **Multi-user features** (sharing roadmaps, leaderboards, social) — explicitly out of scope; the original PRD's "respectful, mirror not enforcer" voice rules these out as engagement-optimized features.

## Further Notes

### Deliberate deviations from the original PRD

This PRD knowingly deviates from the original in several places. Each deviation is intentional and the reasoning is captured here so future readers can re-evaluate if conditions change.

1. **Per-event sync replaces blob backup** (the largest deviation). The original PRD specified a single-blob upload to Supabase Storage with last-write-wins at the blob level. This PRD uses a per-event Postgres model with snapshot for fast restore. The trade is upfront engineering complexity for a meaningfully better cross-device experience — the user's stated priority is "do not be a bottleneck or pain in the user's process of studying," and silent data loss on cross-device use would violate that.

2. **Auth-required from minute one.** The original PRD permitted signed-out usage with sign-in landing later in the slice sequence as a backup gate. On the web, mobile Safari's seven-day storage eviction under ITP makes signed-out usage a vector for silent data loss. Auth-required is the only honest answer.

3. **No native mobile, web is the mobile experience.** The original PRD assumed React Native + Expo with native push notifications, native deep-linking to YouTube, and native lifecycle hooks. This PRD treats the web (with PWA install) as the only target platform. Web Push lands at v1.1 as a partial replacement for the native push capability.

4. **Marketing surface added.** The original PRD did not specify a public landing page because native apps don't typically have one. This PRD adds an Astro-built marketing site at the apex domain to make the product discoverable via search.

5. **Genuine desktop layout for studying-shaped flows.** The original PRD's design was phone-shaped throughout. This PRD designs four screens (active session, onboarding materials/preview, re-plan, weekly progress) for desktop because the developer indicated desktop is the primary studying surface.

### Assumptions made when context was thin

- **Domain name** is assumed to be `studytracker.app`. This is a placeholder; the actual domain registration and configuration is the developer's call.
- **Google OAuth client setup** is assumed to be a manageable one-time configuration step in Google Cloud Console plus Supabase. Setup instructions and redirect URLs are not captured here.
- **Supabase pricing** is assumed to fit within the free tier for v1 user volume. The free tier covers 50,000 monthly active users on auth, plus generous database/storage allowances.
- **Vercel pricing** is assumed to fit within the hobby tier for both deployments at v1 volume.
- **OpenAI cost** for the weekly narrative is assumed to be acceptable at low volume; cost monitoring should be built into the LLMProxy Edge Function from day one and a hard daily cap applied per user.
- **Plausible Analytics cost** is acknowledged as paid (no free tier for production use). An open-source self-hosted alternative could substitute if cost is a concern at v1 launch.
- **Browser support targets** are assumed to be the latest two major versions of Chrome, Edge, Safari, and Firefox on both desktop and mobile. Older browsers are not explicitly supported.

### Open questions to revisit

- **PWA install prompt timing.** The plan calls for a deferred install prompt rather than an interstitial, but the exact trigger (after first session logged? after onboarding complete? after second session?) is not pinned down. Decide during implementation based on user research or first-week analytics.
- **Snapshot frequency.** The plan calls for periodic snapshots without committing to an interval. A reasonable starting point is "after every 50 events or every 24 hours, whichever comes first," but this is tunable post-launch.
- **Pull-on-foreground idle threshold.** The plan uses ">5 minutes" as the threshold for triggering an auto-pull on tab refocus. This is a reasonable starting point but should be revisited if users report stale data.
- **Streaming weekly narrative cancellation.** If the user navigates away mid-stream, the LLMProxy call should be cancelled to avoid wasted OpenAI cost. Implementation detail to nail down during build.
