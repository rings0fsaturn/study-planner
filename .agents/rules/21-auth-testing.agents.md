---
name: auth-testing
description: Test auth through narrow hand-written dependencies instead of global Supabase module mocks.
---

# Auth Testing

Construct `AuthGate` with a hand-written object that implements only the required `AuthGateDeps` methods.
Use `vi.fn()` for observable calls and return the same result shapes as the real Supabase client.
Do not globally mock `@supabase/supabase-js` for `AuthGate` unit tests.

Cover success and error results for every changed auth operation.
Keep the unconfirmed-email behavior covered when sign-in logic changes.
Test provider lifecycle and route behavior separately from the deep-module unit tests.

Prefer typed local fakes over broad `as unknown as SupabaseClient` casts.
If the production dependency contract changes, update the fake and its assertions in the same change.
