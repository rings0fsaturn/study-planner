---
name: auth-testing-fakes
description: Use hand-written fake client for testing auth, not mocked Supabase
---

# Auth Testing: Hand-Written Fakes

## Problem

Mocking Supabase with Jest/ Vitest `jest.mock()` creates brittle tests that don't reflect real behavior. Mocks often return incorrect types, miss edge cases, and break when Supabase updates their API.

## Rule

**Use the Dependency Injection pattern + hand-written fake client for auth tests.**

The AuthGate class accepts a Supabase client via its constructor:

```ts
// AuthGate.ts — the class accepts client via DI
export class AuthGate {
  constructor(private supabase: SupabaseClient) {}

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    // ...
  }
}
```

```ts
// AuthGate.test.ts — hand-written fake client
const fakeClient = {
  auth: {
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
  },
} as unknown as SupabaseClient;

// Inject fake into AuthGate
const authGate = new AuthGate(fakeClient);
```

## Why This Works Better Than Mocks

| Aspect | jest.mock() | Hand-written Fake |
|--------|-------------|-------------------|
| Type safety | Loses types via `as` | Preserves real types |
| Behavioral accuracy | May not match real API | Mirrors actual Supabase behavior |
| Debugging | Hard to inspect | Easy to add console.logs |
| Maintenance | Breaks on API changes | Updates with real code |

## Pattern Checklist

- [ ] AuthGate accepts `SupabaseClient` via constructor
- [ ] Tests create a simple object with only the methods needed
- [ ] Use `vi.fn()` (Vitest) or `jest.fn()` for method spies
- [ ] Cast fake to `SupabaseClient` type once with `as unknown`
- [ ] Test both success and error paths

## When to Apply

- Any new test file for auth logic (`AuthGate.test.ts`, auth integration tests)
- When refactoring auth code to add new test coverage
- Never use `jest.mock('@supabase/supabase-js')` in this codebase