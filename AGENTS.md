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
| Auth Backend | Supabase |
| E2E Testing | Playwright |
| Unit Testing | Vitest |
| Deployment | Vercel |
| Design System | Marginalia (custom) |

## Directory Map

| Path | Purpose |
|---|---|
| `apps/marketing/` | Astro marketing site (homepage, about, privacy, terms) |
| `apps/app/` | Vite + React 19 SPA (auth-protected at `/study/`) |
| `apps/app/src/auth/` | Auth deep module (AuthGate with DI), AuthProvider, ProtectedRoute, useAuth |
| `apps/app/src/lib/supabase.ts` | Supabase client singleton |
| `apps/app/src/components/` | Shared components (Field.tsx) |
| `apps/app/src/pages/` | Route pages (SignIn, SignUp, Home, AuthConfirmed, ResetPassword) |
| `apps/app/src/test/` | Vitest test setup |
| `apps/app/.env.example` | Required env vars template |
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
| [`react-router-v7-basename.md`](.opencode/rules/react-router-v7-basename.md) | Double basename prefixes in navigation |
| [`auth-testing-fakes.md`](.opencode/rules/auth-testing-fakes.md) | Brittle Supabase mock tests |
| [`form-design-spacing.md`](.opencode/rules/form-design-spacing.md) | Collapsed form field groups |
| [`auth-init-timeout.md`](.opencode/rules/auth-init-timeout.md) | React hanging on slow auth init |

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
pnpm --filter app test           # Run Vitest unit tests
pnpm --filter app test:watch     # Run Vitest in watch mode
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

## Auth Architecture

### Overview

The auth layer uses a dependency-injected deep module pattern to keep Supabase logic isolated and testable.

| File | Purpose |
|---|---|
| `apps/app/src/auth/AuthGate.ts` | Deep module wrapping Supabase Auth. Accepts client via constructor for DI. |
| `apps/app/src/auth/AuthGate.test.ts` | 6 unit tests using hand-written fake client |
| `apps/app/src/auth/AuthProvider.tsx` | React context with 500ms init timeout (prevents React hang) |
| `apps/app/src/auth/ProtectedRoute.tsx` | Auth guard — redirects unauthenticated to `/sign-in` |
| `apps/app/src/auth/useAuth.ts` | Hook exposing `{ user, loading, signIn, signUp, signOut }` |

### Routes

| Path | Component | Auth Required |
|---|---|---|
| `/sign-in` | SignIn | No (redirects if authenticated) |
| `/sign-up` | SignUp | No (redirects if authenticated) |
| `/auth-confirmed` | AuthConfirmed | No |
| `/reset-password` | ResetPassword | No (redirects if authenticated) |
| `/home` | Home | Yes (ProtectedRoute) |
| `/` | RootRedirect | Yes (auto-redirects to /home or /sign-in) |

### DI Pattern

```ts
// AuthGate accepts client via constructor — enables hand-written fakes in tests
class AuthGate {
  constructor(private supabase: SupabaseClient) {}
  async signIn(email: string, password: string) { ... }
}
```

## Environment Variables

Required in `apps/app/.env.local`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

Template provided in `apps/app/.env.example`.

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

Current coverage (20 tests):
- Marketing: homepage loads with design tokens, components render, privacy/terms pages load
- React: sign-in/sign-up/home/auth-confirmed/reset-password pages load and render correctly
- Auth: unauthenticated users redirected to sign-in

**Unit Tests:** Vitest in `apps/app/src/auth/AuthGate.test.ts`

Current coverage (6 tests):
- AuthGate: sign-in lifecycle, sign-out lifecycle, route protection, unconfirmed-email rejection

**Run tests:**
```bash
pnpm test:e2e           # Run Playwright smoke tests
pnpm --filter app test  # Run Vitest unit tests
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