---
title: Email/password sign-in protects /study/home
type: HITL
blocked_by: [1a]
covers_user_stories: [5, 7, 42, 44, 46, 53]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

A user can sign up with email and password, receive a confirmation email, click the link, sign in, land on a protected `/study/home` route that greets them by email, and sign out. Unauthenticated users hitting `/study/home` get bounced to `/study/sign-in`. Supabase is provisioned in `ap-south-1` and is the only auth backend.

`/study/home` is still minimal at this slice — just a greeting. Real Home content (recent activity, streak, projection) arrives in later slices. The point of this slice is the auth lifecycle and the protected-route gate.

## Acceptance criteria

- [X] A new user can complete email/password sign-up at `/study/sign-up`
- [X] Sign-up sends a confirmation email; the account cannot sign in until the email is confirmed
- [X] Clicking the confirmation link from the email lands the user on a confirmed-success state
- [X] A confirmed user can sign in at `/study/sign-in` with email and password
- [X] After sign-in, the user lands on `/study/home` and sees a greeting using their email
- [X] An unauthenticated user navigating to `/study/home` is redirected to `/study/sign-in`
- [X] An authenticated user can sign out from `/study/home`; afterward, navigating to `/study/home` redirects to `/study/sign-in`
- [X] Sign-in, sign-up, and sign-out screens use design-system primitives from slice 1a
- [X] AuthGate has unit tests covering: sign-in lifecycle, sign-out lifecycle, route protection, unconfirmed-email rejection
- [X] HITL: Supabase project provisioned in `ap-south-1`; project URL and anon key documented in `DEPLOYMENT.md`; email templates reviewed

## Blocked by

- Blocked by #1a
