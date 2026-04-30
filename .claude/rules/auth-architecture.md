# Auth Architecture

Dependency-injected deep module pattern. Supabase logic isolated and testable.

## Files

| File | Purpose |
|---|---|
| `apps/app/src/auth/AuthGate.ts` | Deep module wrapping Supabase Auth. Accepts client via constructor for DI. |
| `apps/app/src/auth/AuthGate.test.ts` | Unit tests using hand-written fake client |
| `apps/app/src/auth/AuthProvider.tsx` | React context with 500ms init timeout (prevents hang) |
| `apps/app/src/auth/ProtectedRoute.tsx` | Redirects unauthenticated to `/sign-in` |
| `apps/app/src/auth/useAuth.ts` | Hook: `{ user, loading, signIn, signUp, signOut }` |

## DI Pattern

```ts
class AuthGate {
  constructor(private supabase: SupabaseClient) {}
  async signIn(email: string, password: string) { ... }
}
```

Tests use hand-written fakes (see `auth-testing-fakes.md`), not `jest.mock()`.

## Routes

| Path | Component | Protection |
|---|---|---|
| `/sign-in` | SignIn | Public (redirects if authenticated) |
| `/sign-up` | SignUp | Public (redirects if authenticated) |
| `/auth-confirmed` | AuthConfirmed | None |
| `/reset-password` | ResetPassword | Public (redirects if authenticated) |
| `/` | RootRedirect | Auto-redirects to /home or /sign-in |

AuthProvider has **zero knowledge** of EventStore — no imports, no wipe calls, no localStorage tracking.
