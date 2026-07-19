---
title: Password reset and email confirmation polish
type: AFK
blocked_by: [1b]
covers_user_stories: [43]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

Round out the auth surface: a "Forgot password?" link on `/study/sign-in` triggers Supabase's password reset email; the reset link lands on a `/study/reset-password` route where the user sets a new password and is signed in.

Also tighten the email-confirmation experience from slice 1b: in production, sign-in attempts on an unconfirmed account show a clear "please confirm your email — resend?" prompt with a working resend action, rather than a generic auth error.

## Acceptance criteria

- [ ] `/study/sign-in` shows a "Forgot password?" link
- [ ] Clicking it opens a flow that asks for the user's email and sends a reset link via Supabase
- [ ] Clicking the reset link lands the user on `/study/reset-password` where they set a new password
- [ ] Successful password reset signs the user in and redirects to `/study/home`
- [ ] In production, attempting to sign in with an unconfirmed account shows a "please confirm your email — resend?" message with a working resend button
- [ ] Resend sends a fresh confirmation email via Supabase
- [ ] AuthGate tests cover: password reset request flow, password reset application flow, unconfirmed-email prompt with resend
- [ ] An end-to-end test covers: request reset → consume reset link (via Supabase test inbox or fake) → set new password → land on Home

## Blocked by

- Blocked by #1b
