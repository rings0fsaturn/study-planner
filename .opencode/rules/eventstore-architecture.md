# EventStore Architecture

Local-first event storage using Dexie (IndexedDB). Per-user DB isolation — see `eventstore-per-user-db.md`.

## Files

| File | Purpose |
|---|---|
| `apps/app/src/events/EventStore.ts` | Deep module: append, bulkAppend, getAll, getMaxId, getEventsSince, query (liveQuery), table(name), wipe, close |
| `apps/app/src/events/EventStoreProvider.tsx` | Creates per-user Dexie DB (`StudyTracker_<userId>`), manages v1→v2→v3 schema |
| `apps/app/src/events/useEventStore.ts` | Hook returning current user's EventStore (throws if no user) |
| `apps/app/src/events/ProgressEngine.ts` | Pure function: `totalMinutesLogged(events)` |

## Schema (v3)

```ts
db.version(1).stores({ events: '++id, kind, createdAt' });
db.version(2).stores({ events: '++id, kind, createdAt', sync_queue: '++id, kind, createdAt, retries', sync_meta: 'key' });
db.version(3).stores({ events: '++id, kind, createdAt', sync_queue: '++id, kind, createdAt, retries', sync_meta: 'key', onboardingDraft: 'id' });
```

| Table | Purpose |
|---|---|
| `events` | Main event log (SessionLogged, OnboardingCompleted, MaterialAdded, RoadmapCreated) |
| `sync_queue` | Write-ahead queue for pending cloud sync |
| `sync_meta` | Sync cursor state (last synced remote ID) |
| `onboardingDraft` | Onboarding wizard draft persistence |

When adding tables, see `dexie-schema-migration.md`.

## Event Shape

```ts
interface Event {
  id?: number;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string; // ISO 8601
}
```

## Generic Table Access

`EventStore.table(name)` returns any Dexie table by name. Used by OnboardingProvider for `onboardingDraft` and by SyncEngine for `sync_queue`/`sync_meta`.
