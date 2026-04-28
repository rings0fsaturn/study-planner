# Study Tracker Web

## Overview

A mobile-first responsive web app for self-directed learners. The app mirrors the user's discipline — quietly, respectfully — without enforcing it.

**PRD:** [`prd/PRD-study-tracker-web.md`](prd/PRD-study-tracker-web.md)
**Issues:** [`issues/`](issues/)

## Architecture

```
study-planner-web/
├── pnpm-workspace.yaml          # workspace: apps/* + packages/*
├── package.json                  # root scripts + devDeps
├── apps/
│   ├── marketing/                # Astro static site (apex domain)
│   │   ├── astro.config.mjs
│   │   ├── vercel.json          # rewrites /study/* → React app
│   │   └── src/
│   │       ├── layouts/
│   │       └── pages/
│   └── app/                      # Vite + React 19 SPA (/study/*)
│       ├── vite.config.ts        # base: '/study/'
│       ├── vercel.json           # SPA rewrite
│       └── src/
│           ├── main.tsx
│           ├── App.tsx           # BrowserRouter basename="/study"
│           ├── pages/
│           └── components/
└── packages/
    └── design-tokens/            # @study-tracker/design-tokens
        └── src/
            ├── tokens.css       # CSS custom properties
            ├── components.css   # Primitive component classes
            ├── global.css      # Reset, typography, fonts
            └── index.ts
```

**Two deployments under one apex domain:**
- Marketing site → Vercel project 1 (Astro) → serves `studytracker.app/*`
- App → Vercel project 2 (Vite) → serves `studytracker.app/study/*`
- Routing: Marketing's `vercel.json` rewrites `/study/*` to React app's URL

## Tech Stack

| Category | Version |
|---|---|
| Package Manager | pnpm 10 |
| Static Site | Astro 4 |
| Build Tool | Vite 5 |
| UI Framework | React 19 |
| Language | TypeScript 5.4 |
| E2E Testing | Playwright |
| Deployment | Vercel |
| Design System | Marginalia (custom) |

## Directory Map

| Path | Purpose |
|---|---|
| `apps/marketing/` | Astro marketing site (homepage, about, privacy, terms) |
| `apps/app/` | Vite + React SPA (placeholder at `/study/`) |
| `packages/design-tokens/` | Shared design tokens package |
| `e2e/` | Playwright smoke tests |
| `prd/` | Product Requirements Document |
| `issues/` | Implementation issue tickets (vertical slices) |
| `design/` | Marginalia design system HTML document |
| `DEPLOYMENT.md` | Vercel + DNS setup guide |

## Project Rules

Patterns, rules, and learnings from past development sessions. **Always check these before making changes** to avoid repeating mistakes.

See [`.opencode/rules/`](.opencode/rules/):

| Rule File | Prevents |
|---|---|
| [`css-workspace-packages.md`](.opencode/rules/css-workspace-packages.md) | CSS imports failing to resolve in workspace packages |
| [`playwright-config.md`](.opencode/rules/playwright-config.md) | E2E tests failing due to config issues |
| [`astro-selectors.md`](.opencode/rules/astro-selectors.md) | Selector strict mode violations in Astro dev mode |

## Commands

```bash
# Development
pnpm dev              # Both apps in parallel (Astro :4321, Vite :5173)
pnpm dev:marketing   # Astro only → http://localhost:4321
pnpm dev:app         # Vite only → http://localhost:5173/study/

# Build
pnpm build              # Both apps
pnpm build:marketing    # Astro → apps/marketing/dist
pnpm build:app          # Vite → apps/app/dist

# Testing
pnpm test:e2e           # Run Playwright smoke tests
pnpm lint              # Lint all packages
pnpm typecheck          # TypeScript check all packages
```

## Routing

### Vercel (Production)

Marketing `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/study/:path*", "destination": "https://study-tracker-app.vercel.app/study/:path*" }
  ]
}
```

### Local Development

- Marketing: `http://localhost:4321`
- App: `http://localhost:5173/study/`

### React Router

```tsx
<BrowserRouter basename="/study">
  <Routes>
    <Route path="/" element={<Home />} />
  </Routes>
</BrowserRouter>
```

Vite `vite.config.ts`:
```ts
base: '/study/'
```

## Design System: Marginalia

Tokens live in `packages/design-tokens/src/`:

| File | Contents |
|---|---|
| `tokens.css` | Raw colors (`--paper`, `--ink`), semantic tokens (`--text-primary`), spacing, radii, elevation, motion, z-index |
| `components.css` | Primitive classes: `.btn`, `.btn-accent`, `.card`, `.card-elevated`, `.tag`, `.tag-moss`, `.field`, `.progress`, `.stat` |
| `global.css` | Font imports (Fraunces, Inter Tight, JetBrains Mono), reset, named type roles (`.t-display-1`, `.t-body`, `.t-mono`) |

**Usage:**

```tsx
// React
import '@study-tracker/design-tokens/global.css';
import '@study-tracker/design-tokens/tokens.css';
import '@study-tracker/design-tokens/components.css';
```

```astro
<!-- Astro -->
import '@study-tracker/design-tokens/global.css';
import '@study-tracker/design-tokens/tokens.css';
import '@study-tracker/design-tokens/components.css';
```

## Testing

**E2E Tests:** [`e2e/smoke.spec.ts`](e2e/smoke.spec.ts)

Current coverage (12 tests):
- Marketing: homepage loads with design tokens, components render, privacy/terms pages load
- React: placeholder loads with design tokens, components render

**Run tests:**
```bash
pnpm test:e2e
```

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for:
1. Creating two Vercel projects
2. Configuring path-based routing
3. Setting up DNS (apex domain → Marketing)
4. Environment variables for future slices (Supabase)

## Related Documentation

- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Vercel + DNS setup
- [`prd/PRD-study-tracker-web.md`](prd/PRD-study-tracker-web.md) — Full PRD with 58 user stories
- [`issues/`](issues/) — 17 implementation issues (vertical slices)
- [`design/marginalia.html`](design/marginalia.html) — Visual design system documentation