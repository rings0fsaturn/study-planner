---
name: dexie-schema-migration
description: Add new tables to existing Dexie databases without breaking production data
type: guard
---

# Dexie Schema Migration

## Problem

Adding new tables to a Dexie database in production is easy to get wrong:

1. **Overwriting version 1** — calling `db.version(1).stores({ ... })` again resets the schema and deletes all data
2. **Forgetting existing tables** — each version must declare ALL tables, not just new ones
3. **Migrations run automatically** — Dexie auto-migrates, but only if schema is correctly versioned

## Rule

**When adding new tables to an existing Dexie database, create a NEW version number and re-declare ALL tables:**

```tsx
// BEFORE: v1 with single table
const db = new Dexie('StudyTracker_user-123');
db.version(1).stores({
  events: '++id, kind, createdAt'
});

// AFTER: v2 adds new tables
const db = new Dexie('StudyTracker_user-123');
db.version(1).stores({
  events: '++id, kind, createdAt'
});
db.version(2).stores({
  events: '++id, kind, createdAt',          // must re-declare existing
  sync_queue: '++id, kind, createdAt, retries', // new table
  sync_meta: 'key'                               // new table
});
```

### Why This Works

- **v1 stays frozen** — existing users with v1 schema keep their data
- **v2 inherits v1** — Dexie auto-runs migration (creates new tables)
- **All tables in one version** — `version(N).stores()` defines ALL tables at that schema version

### Anti-Patterns

| Pattern | Why It Fails |
|---------|--------------|
| Calling `version(1)` again with new tables | Resets schema to v1, loses all existing data |
| Only declaring new tables in new version | Migration runs but new tables aren't visible |
| Using string instead of number for version | `version('2')` doesn't work — must be number |
| Forgetting to bump version number | New tables not created (schema unchanged) |

## Migration in EventStoreProvider

```tsx
// apps/app/src/events/EventStoreProvider.tsx
function createEventStore(userId: string): EventStore {
  const db = new Dexie(dbNameForUser(userId));

  // v1: original schema
  db.version(1).stores({
    events: '++id, kind, createdAt'
  });

  // v2: added sync tables
  db.version(2).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key'
  });

  return new EventStore(db);
}
```

Users upgrading from v1 to v2:
1. Dexie detects schema version mismatch (1 → 2)
2. Auto-creates `sync_queue` and `sync_meta` tables
3. Existing `events` table untouched

## Pattern Checklist

- [ ] Existing `version(1)` stays unchanged
- [ ] New tables added in `version(N+1)` (where N is current version)
- [ ] ALL tables declared in new version (existing + new)
- [ ] Version number is an integer, not string
- [ ] Test migration with existing data (simulate upgrade)

## When to Apply

- Adding any new table to Dexie-backed storage (`sync_queue`, `sync_meta`, `cache`, etc.)
- When EventStore needs new capabilities that require new tables
- Before shipping to production — always version the schema

## Related Rules

- [eventstore-per-user-db.md](./eventstore-per-user-db.md) — for per-user database isolation
- [dexie-test-setup.md](./dexie-test-setup.md) — for test setup with fake-indexeddb