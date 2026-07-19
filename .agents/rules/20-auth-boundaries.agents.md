---
name: auth-boundaries
description: Preserve the dependency-injected Supabase auth boundary and provider responsibilities.
---

# Auth Boundaries

Keep Supabase auth operations inside `apps/app/src/auth/AuthGate.ts`.
Add new auth capabilities to the narrow `AuthGateDeps` contract and inject that dependency into `AuthGate`.

Keep `AuthProvider` responsible for session state, user state, recovery state, auth subscriptions, and the bounded initialization guard.
Preserve the 500 ms initialization fallback unless a measured replacement is designed and verified.
Always unsubscribe and clear timers during provider cleanup.

Keep route protection in the existing auth guard components.
Do not import EventStore, wipe local data, or track account switching through local storage from the auth module.
User-specific persistence belongs behind `EventStoreProvider` and sync belongs behind `SyncProvider`.

Verify sign-in, sign-up, sign-out, recovery, unconfirmed-email, and authenticated redirect behavior when their shared boundary changes.
