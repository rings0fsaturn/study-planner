---
title: Deploy tracer — both surfaces live and styled, no auth
type: HITL
blocked_by: []
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

The first tracer bullet through the deployment topology. After this slice merges, a visitor can hit the apex domain and see a styled Astro placeholder, and hit `/study/` and see a styled React placeholder. No auth, no business logic — but the routing split, both Vercel projects, DNS, and the design system are all wired and demonstrably working.

The point is to surface deployment, routing, and design-system integration risk on slice #1 rather than letting it ambush a feature slice later.

## Acceptance criteria

- [ ] Visiting the apex domain returns a styled Astro page with placeholder content
- [ ] Visiting `/study/` returns a styled React page with placeholder content
- [ ] Visiting `/privacy` and `/terms` return placeholder Astro pages
- [ ] Vercel routing correctly directs apex requests to the Astro project and `/study/*` requests to the React project
- [ ] DNS and subdomain configuration are in place; both URLs resolve over HTTPS
- [ ] Design-system tokens (color, spacing, type scale) are imported and applied on both the Astro and the React surfaces
- [ ] At least 2–3 design-system primitive components render on each placeholder page so the design system is visibly active, not just imported
- [ ] A Playwright smoke test asserts both URLs return 200 and that a known design-system class or token is present in the rendered HTML
- [ ] HITL: Vercel projects, DNS records, and any required environment variables are documented in a `DEPLOYMENT.md`

## Blocked by

None — can start immediately.
