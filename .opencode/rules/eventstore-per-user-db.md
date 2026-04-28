---
name: eventstore-per-user-db
description: Prevent cross-account data bleed by isolating IndexedDB per user
type: guard
---

# EventStore: Per-User IndexedDB Isolation

## Problem

All Supabase users on the same browser share the same origin. If the app creates a single Dexie database (e.g., `StudyTracker`), every user's events go into the same IndexedDB. This creates two failure modes:

1. **Cross-account bleed:** User B sees User A's sessions.
2. **Data loss on switch:** A "wipe on sign-in as different user" strategy permanently destroys the original user's data — they can't sign back in and see their history.

## Rule

**Create one Dexie database per user, named `StudyTracker_<userId>`. Never share a single DB across users. Never wipe the DB on account switch.**

### Correct: Per-user database

```tsx
// EventStoreProvider.tsx
function dbNameForUser(userId: string): string {
  return `StudyTracker_${userId}`;
}

function createEventStore(userId: string): EventStore {
  const db = new Dexie(dbNameForUser(userId));
  db.version(1).stores({
    events: '++id, kind, createdAt'
  });
  return new EventStore(db);
}

// EventStoreProvider accepts userId as a prop
function EventStoreProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [store, setStore] = useState<EventStore | null>(null);

  useEffect(() => {
    if (!userId) {
      setStore(null);
      return;
    }
    setStore(createEventStore(userId));
  }, [userId]);

  return (
    <EventStoreContext.Provider value={{ eventStore: store, ready: !!store }}>
      {children}
    </EventStoreContext.Provider>
  );
}
```

### Incorrect: Shared database with wipe

```tsx
// WRONG — shared DB
const db = new Dexie('StudyTracker'); // All users share this!

// WRONG — wipe on account switch destroys User A's data
if (newUserId !== previousUserId) {
  await eventStore.wipe(); // User A's data is gone forever
}
```

## Architecture

| Component | Responsibility |
|---|---|
| `EventStoreProvider` | Reads `user.id` from auth context, creates per-user DB, tracks `ready` state |
| `EventStore` (deep module) | Appends, queries, wipes — operates on whichever DB it was constructed with |
| `useEventStore()` | Returns the current user's EventStore; throws if no active user |
| `App.tsx` | Wraps routes with `EventStoreRouter` which passes `user.id` into provider |

## Why Per-User DB

| Approach | Cross-account bleed | Data loss on switch | Scales to 100 users |
|---|---|---|---|
| Single DB + wipe on switch | No (data destroyed) | **Yes** (permanent) | No |
| Single DB + userId column + filter queries | **Yes** (query bugs) | No | Fragile |
| Per-user DB (this rule) | **No** (storage isolation) | **No** (each keeps their DB) | **Yes** |

## Pattern Checklist

- [ ] EventStoreProvider accepts `userId: string | null` prop
- [ ] Database name includes the user ID: `StudyTracker_${userId}`
- [ ] When `userId` changes, close old DB connection, create new EventStore for new user
- [ ] `useEventStore()` throws if called when no user is signed in (defense in depth)
- [ ] AuthProvider has **no knowledge** of EventStore — no imports, no wipe calls, no localStorage tracking
- [ ] No `localStorage.setItem('last_user_id', ...)` or equivalent tracking

## When to Apply

- Any new local storage module that stores user-specific data
- When refactoring existing storage to support multiple users
- When adding cloud sync — each user's DB becomes the replay target for their events
