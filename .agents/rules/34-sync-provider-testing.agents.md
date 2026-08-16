---
name: sync-provider-testing
description: Test provider-owned engines and browser lifecycle listeners without depending on inaccessible instances.
---

# Sync Provider Testing

When a provider creates an engine internally, spy on the relevant class prototype before rendering.
Restore prototype spies after each test.

Dispatch the lifecycle events `visibilitychange`, `pagehide`, and `beforeunload` manually in jsdom.
`DurabilityHooks` registers all three, while `SyncProvider` acts on visibility changes and pagehide.
Wrap manual dispatches that can trigger React state changes in `act()`.
Dispatch the event before waiting for the assertion.

Return the exact object shape expected by test helpers.
Do not return an `EventStore` instance from a factory whose callers destructure `{ db, eventStore }`.

Wait for provider effects to attach before asserting lifecycle behavior.
Cover listener cleanup on unmount so repeated mounts do not accumulate handlers.
