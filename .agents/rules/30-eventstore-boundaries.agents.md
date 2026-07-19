---
name: eventstore-boundaries
description: Preserve local-first event history and per-user IndexedDB isolation.
---

# EventStore Boundaries

Create one Dexie database per authenticated user with the `StudyTracker_<userId>` naming contract.
Never share the production database across accounts.
Never wipe one user's database merely because another user signs in.

Keep IndexedDB access behind `EventStore` and `EventStoreProvider`.
Keep `AuthProvider` independent of local persistence.
Close or release the previous user's database resources when the active user changes.

Treat stored events as durable product history.
Prefer additive event evolution and backward-compatible readers over rewriting existing records.
Keep event timestamps in ISO 8601 form and preserve event ordering semantics.

Use the live schema declarations in `apps/app/src/events/EventStoreProvider.tsx` as the current schema source.
Do not copy the current version number or table list into architecture rules.
Read `31-dexie-schema-migrations.agents.md` before changing the schema.
