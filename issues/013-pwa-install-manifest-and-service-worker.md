---
title: PWA install — manifest, scoped service worker, persistence request, iOS nudge
type: AFK
blocked_by: [1b]
covers_user_stories: [54, 55, 58]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

Make `/study/*` installable as a PWA. A `PWAShell` module owns manifest registration, service-worker registration, and the iOS-Safari home-screen-install nudge. The service worker is scoped to `/study/` so it cannot intercept the Astro marketing surface at the apex.

At sign-in, the app requests Storage Persistence (`navigator.storage.persist()`) so IndexedDB isn't evicted under storage pressure — critical for the local-first model. iOS Safari users see a dismissible "Add to Home Screen to keep your progress safe" nudge since iOS doesn't fire `beforeinstallprompt`.

## Acceptance criteria

- [ ] A `manifest.json` is served from `/study/manifest.json` with name, icons, start URL, display mode, theme color
- [ ] A service worker is registered with `scope: '/study/'`
- [ ] The service worker does not intercept requests to the apex marketing site
- [ ] At sign-in, the app calls `navigator.storage.persist()` and surfaces the result in the sync-status detail (slice 15) for diagnostics
- [ ] On installable browsers (Chrome, Edge), the install prompt is deferrable and surfaced at an appropriate moment (not on first load)
- [ ] On iOS Safari, a dismissible "Add to Home Screen to keep your progress safe" banner appears once per user; dismissal is remembered (via PreferenceSet from slice 15, or a local-only flag if slice 15 hasn't shipped yet)
- [ ] Tests cover: service worker scope correctness, manifest validity, install prompt deferral logic, iOS nudge dismissal persistence
- [ ] An end-to-end test asserts the manifest is served and the service worker registers on `/study/`

## Blocked by

- Blocked by #1b
