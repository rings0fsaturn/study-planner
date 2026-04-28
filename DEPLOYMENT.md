# Deployment Guide

## Overview

Study Tracker Web consists of two Vercel deployments under one apex domain:

1. **Marketing site** (`studytracker.app/*`) — Astro static site
2. **App** (`studytracker.app/study/*`) — Vite + React SPA

## Prerequisites

- Vercel account
- Domain name (`studytracker.app` or your chosen domain)

## Step 1: Create Vercel Projects

### 1. Marketing Site (Astro)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import from GitHub: select this repository
4. Framework Preset: Astro (auto-detected)
5. Build Command: `pnpm --filter @study-tracker/marketing build`
6. Output Directory: `dist`
7. Install Command: `pnpm install`
8. Click "Deploy"

Note the deployed URL (e.g., `study-tracker-marketing.vercel.app`)

### 2. App (Vite + React)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import from GitHub: select this repository
4. Framework Preset: Vite (auto-detected)
5. Build Command: `pnpm --filter @study-tracker/app build`
6. Output Directory: `dist`
7. Install Command: `pnpm install`
8. Click "Deploy"

Note the deployed URL (e.g., `study-tracker-app.vercel.app`)

## Step 2: Configure Routing

The marketing site's `vercel.json` rewrites `/study/*` requests to the React app:

```json
{
  "rewrites": [
    {
      "source": "/study/:path*",
      "destination": "https://study-tracker-app.vercel.app/study/:path*"
    }
  ]
}
```

Update `apps/marketing/vercel.json` with your actual React app URL before deploying.

## Step 3: Configure DNS

### Apex domain (`studytracker.app`)

1. Go to your domain registrar
2. Add an ALIAS record:
   - Name: `@` or your apex domain
   - Value: Your Vercel deployment URL (marketing site)
   - TTL: Auto or 300

### WWW subdomain (optional)

- Name: `www`
- Value: Your Vercel deployment URL

### For subdomains pointing to React app

If you want `app.studytracker.app` to point directly to the React app:

- Name: `app`
- Value: Your React app Vercel URL

## Step 4: Environment Variables

No environment variables are required for this tracer slice.

For future slices, you may need:
- `PUBLIC_SUPABASE_URL` — Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

## Step 5: Verify Deployment

After deployment, verify:

1. **Marketing site**: Visit `https://studytracker.app/`
   - Homepage should load with design tokens (cream background, terracotta accent)
   - "Get started" button should be visible
   - Privacy and Terms pages should load

2. **React app**: Visit `https://studytracker.app/study/`
   - Placeholder page should load with design tokens
   - Card, Button, Tag components should be visible
   - Design tokens CSS should be present in styles

3. **Routing**: Visiting `/study/*` should serve the React app

## Step 6: Run Smoke Tests

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium

# Run smoke tests
pnpm test:e2e
```

## Troubleshooting

### Marketing site 404 on refresh

Ensure `vercel.json` has proper rewrites or the Astro config outputs static files with proper routing.

### React app shows 404 on routes

Ensure `vercel.json` in the React app has SPA rewrite:
```json
{
  "rewrites": [{ "source": "/study/:path*", "destination": "/study/index.html" }]
}
```

### Design tokens not loading

Verify:
1. `@study-tracker/design-tokens` is installed in both apps
2. CSS imports are present in `main.tsx` and `BaseLayout.astro`

## Future Slices

For subsequent slices, you will need to:
1. Create a Supabase project
2. Add environment variables to Vercel for Supabase credentials
3. Deploy Edge Functions for metadata fetching and LLM proxy