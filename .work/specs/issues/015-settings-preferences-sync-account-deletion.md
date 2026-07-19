---
title: Settings, preferences sync, and account deletion
type: AFK
blocked_by: [3]
covers_user_stories: [48, 49, 50, 51]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

A `/study/settings` route consolidates account and preference controls. It surfaces the sync indicator detail (last synced timestamp, queued events, storage-persistence status) for diagnostics, exposes user toggles (e.g. dismissed banners, notification opt-ins) backed by a `PreferenceSet` event so preferences follow the user across devices, and offers a "Delete my account" action.

Account deletion is destructive and cascading: it removes `auth.users`, the user's rows from `events`, and their snapshots from Supabase Storage. The action requires a typed confirmation ("delete my account") and shows a clear summary of what will be removed before the user can proceed.

## Acceptance criteria

- [ ] `/study/settings` shows a sync detail panel: last-synced timestamp, queued event count, storage-persistence granted/denied
- [ ] User-level preferences (dismissed banners, toggles) emit `PreferenceSet` events that sync via slice 3
- [ ] Setting a preference on device A is reflected on device B after sync
- [ ] "Delete my account" requires typed confirmation ("delete my account") before the destructive action enables
- [ ] Before confirmation, the user sees a summary of what will be deleted (account, events, snapshots)
- [ ] Confirmed deletion removes the row from `auth.users`, all rows from `events` for that `user_id`, and all snapshots from Supabase Storage for that user
- [ ] After deletion, the user is signed out and bounced to the marketing landing page
- [ ] Tests cover: PreferenceSet round-trip across the sync path, deletion cascading correctness (mock Supabase admin), typed-confirmation gating
- [ ] An end-to-end test covers: set a preference on one client → verify on a second client; delete account → verify subsequent sign-in fails

## Blocked by

- Blocked by #3
