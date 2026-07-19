---
title: Google OAuth sign-in
type: HITL
blocked_by: [1b]
covers_user_stories: [6]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

Add a "Sign in with Google" option to `/study/sign-in` and `/study/sign-up`. Wires up Google as a Supabase Auth provider, passes through the OAuth round-trip, and lands the user on `/study/home` (or `/study/onboarding` if they're new) on success.

HITL because Google Cloud Console project setup, OAuth consent screen configuration, and Supabase redirect URL registration are human steps that can't be scripted.

## Acceptance criteria

- [ ] `/study/sign-in` shows a "Sign in with Google" button alongside the email/password fields
- [ ] `/study/sign-up` shows a "Sign up with Google" button
- [ ] Clicking the button initiates Google OAuth via Supabase
- [ ] On successful OAuth, an existing user lands on `/study/home`
- [ ] On successful OAuth for a first-time user, they land on `/study/onboarding`
- [ ] OAuth users skip email confirmation (Google has already verified the email)
- [ ] Account-switch wipe (from slice 2) works correctly when switching between an email/password account and a Google account
- [ ] Tests cover the OAuth happy-path lifecycle using a Supabase Auth fake
- [ ] HITL: Google Cloud Console project, OAuth consent screen, redirect URLs, and Supabase provider configuration documented in `DEPLOYMENT.md`

## Blocked by

- Blocked by #1b
