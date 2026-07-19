---
title: URL materials (YouTube + article) with metadata fetch and partial-data fallback
type: AFK
blocked_by: [4]
covers_user_stories: [9, 10]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

The onboarding materials step (and any future "add material" flow) accepts a pasted URL. A new `MaterialsMetadataProxy` Edge Function looks up the URL: YouTube URLs go through the YouTube Data API for title and duration; article URLs are fetched and parsed with Readability for title and reading-time estimate.

Metadata fetch has three branches: full success (auto-fill the form, user just confirms), partial success (auto-fill what was returned, prompt the user inline for what's missing), full failure (drop the user into the manual-entry form with the URL prefilled). The user is never blocked by a metadata failure.

`MaterialAdded` events now carry a `kind` field (`youtube`, `article`, `manual`) so downstream slices (notably slice 7's active-session embed) can branch on it.

## Acceptance criteria

- [ ] A `MaterialsMetadataProxy` Supabase Edge Function exists and accepts a URL
- [ ] YouTube URLs (`youtube.com/watch?v=...`, `youtu.be/...`) are resolved via the YouTube Data API for title and duration
- [ ] Article URLs are fetched server-side and parsed with Readability for title and reading-time estimate
- [ ] The onboarding materials step accepts a pasted URL and calls the proxy
- [ ] On full-success metadata, the form auto-fills and the user confirms in one click
- [ ] On partial metadata (e.g., title returned but no duration), the form prefills returned fields and prompts inline for missing ones
- [ ] On full failure, the user is dropped into the manual-entry form with the URL prefilled
- [ ] `MaterialAdded` events include a `kind` field with value `youtube`, `article`, or `manual`
- [ ] The Edge Function never exposes the YouTube API key to the client
- [ ] MaterialsMetadataClient has tests for all three branches (full, partial, failure) using fakes for the Edge Function
- [ ] Edge Function has tests for: YouTube parsing, article fetch + Readability extraction, error handling

## Blocked by

- Blocked by #4
