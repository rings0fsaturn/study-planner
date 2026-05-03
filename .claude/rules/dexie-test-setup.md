---
name: dexie-test-setup
description: Prevent Dexie test failures due to fake-indexeddb issues or stale DB state
type: guard
---

# Dexie Test Setup

## Problem

Dexie tests fail for three common reasons:
1. **Missing fake-indexeddb:** Tests crash with "IndexedDB not available" in jsdom
2. **Stale DB state:** Events from previous tests leak into the current test
3. **Same DB name across test files:** Parallel tests collide and overwrite each other's data

## Rule

**Initialize fake-indexeddb globally, use unique DB names per test file, and clear tables in `beforeEach`.**

### 1. Global fake-indexeddb setup

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto'; // Must be imported once before any Dexie usage
```

### 2. Per-test file Dexie instance

```ts
// src/events/EventStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { EventStore } from './EventStore';

describe('EventStore', () => {
  let db: Dexie;
  let eventStore: EventStore;

  beforeEach(async () => {
    // Unique DB name prevents cross-test and cross-file collisions
    db = new Dexie('StudyTrackerTest-EventStore');
    db.version(1).stores({
      events: '++id, kind, createdAt'
    });
    eventStore = new EventStore(db);
    await db.open();
    await db.table('events').clear(); // Clean slate for each test
  });

  afterEach(async () => {
    db.close(); // Clean up connection
  });
});
```

### 3. Test via constructor DI, not via React context

```ts
// CORRECT: test the class directly via DI
const eventStore = new EventStore(db);
const id = await eventStore.append('SessionLogged', { duration: 45 });
expect(typeof id).toBe('number');

// WRONG: don't mount React components or use EventStoreProvider in unit tests
// React context adds unnecessary complexity for testing storage logic
```

## Anti-patterns

| Pattern | Why it fails |
|---|---|
| `new Dexie('StudyTracker')` in tests | Same name as production DB — collides with browser state |
| No `fake-indexeddb/auto` import | `ReferenceError: indexedDB is not defined` in jsdom |
| No `await db.table('events').clear()` | Events from test N-1 appear in test N |
| Using `EventStoreProvider` in unit tests | Adds React lifecycle complexity; test the class directly instead |
| Opening DB without `await db.open()` | Race conditions between schema creation and table access |

## Pattern Checklist

- [ ] `fake-indexeddb/auto` imported in `src/test/setup.ts`
- [ ] Each test file uses a unique DB name (e.g., `StudyTrackerTest-<ModuleName>`)
- [ ] `await db.open()` before using the DB
- [ ] `await db.table('events').clear()` in `beforeEach`
- [ ] `db.close()` in `afterEach` to release connections
- [ ] Test `EventStore` class directly via constructor, not through React context

## When to Apply

- Any new Dexie-backed module
- When Dexie tests fail mysteriously (check for stale state or missing fake-indexeddb)
- When refactoring EventStore or adding new Dexie tables
