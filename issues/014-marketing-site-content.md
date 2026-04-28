---
title: Marketing site content — about, how-it-works, privacy, terms
type: HITL
blocked_by: [1a]
covers_user_stories: [1, 2, 3, 4, 52]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

Replace the slice 1a placeholder Astro pages with real marketing content: a landing page, an `/about` page, a `/how-it-works` page with screenshots, and the `/privacy` and `/terms` pages with real legal copy. Add SEO metadata (Open Graph, Twitter Card, structured data) so links share well. The "Get started" CTA on every page links to `/study/sign-in`.

HITL because the copy needs to be written by a human, screenshots need to be captured from the working app (so this slice should sit late in the queue), and legal pages need a human review.

## Acceptance criteria

- [ ] `/` shows the landing page with hero, value proposition, and a "Get started" CTA linking to `/study/sign-in`
- [ ] `/about` explains the project's premise and approach
- [ ] `/how-it-works` walks through the user journey with screenshots from the working app
- [ ] `/privacy` shows a real privacy policy
- [ ] `/terms` shows real terms of service
- [ ] All pages include Open Graph and Twitter Card meta tags so link previews render correctly
- [ ] Structured data (JSON-LD) is present on the landing page
- [ ] All pages use design-system primitives from slice 1a
- [ ] Build-output assertion test: each page contains its expected meta tags and the CTA link
- [ ] HITL: copy written and reviewed; screenshots captured from the working app; legal pages reviewed

## Blocked by

- Blocked by #1a
