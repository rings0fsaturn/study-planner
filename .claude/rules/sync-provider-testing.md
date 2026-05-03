---
name: sync-provider-testing
description: Test React context providers that own engine instances with browser event listeners
type: guard
---

# SyncProvider Testing Patterns

## Problem

Testing React context providers that wrap deep modules (`SyncEngine`, `AuthGate`, etc.) with lifecycle hooks (`visibilitychange`, `pagehide`, `beforeunload`) is tricky:

1. **The engine instance is created inside `useEffect`** — no way to get a reference to spy on it from outside
2. **jsdom never fires browser events** — `visibilitychange`, `pagehide`, `beforeunload` are never triggered automatically
3. **EventStore factory mismatches** — returning `EventStore` from a helper but destructuring `{ db, eventStore }` silently produces `undefined`
4. **React 19 strict mode double-mounts** — effects run mount → cleanup → mount, creating a micro-window where event listeners are detached

## Rule

**Follow these patterns when testing providers that own engines with lifecycle hooks:**

### 1. EventStore Factory Returns Object, Not Instance

```ts
// WRONG — returns EventStore instance only
function createEventStore(userId: string): EventStore {
  const db = new Dexie(`StudyTracker_${userId}`);
  db.version(1).stores({ events: '++id, kind, createdAt' });
  return new EventStore(db);
}

// In beforeEach, this fails silently:
const created = createEventStore(userId);
eventStore = created.eventStore; // undefined! EventStore has no .eventStore property

// CORRECT — returns { db, eventStore } object
function createEventStore(userId: string): { db: Dexie; eventStore: EventStore } {
  const db = new Dexie(`StudyTracker_${userId}`);
  db.version(1).stores({ events: '++id, kind, createdAt' });
  return { db, eventStore: new EventStore(db) };
}

// In beforeEach:
const created = createEventStore(userId);
eventStore = created.eventStore; // works ✓
```

This is the pattern used in `SyncEngine.test.ts:121`.

### 2. Spy on Prototype, Not Instance

```ts
// The engine is created inside useEffect — no reference to spy on
// WRONG — can't get a reference to the engine instance
const engine = new SyncEngine(...);
const spy = vi.spyOn(engine, 'method');

// CORRECT — spy on the prototype catches all instances
const spy = vi.spyOn(SyncEngine.prototype, 'restoreFromCloud');
```

The provider creates a new engine internally via `new SyncEngine(...)`. Prototype spies catch all instances.

### 3. Dispatch Browser Events Manually in jsdom

```ts
// jsdom never fires visibilitychange, pagehide, beforeunload automatically
// WRONG — renders and waits, but nothing triggers the handler
render(<SyncProvider ...>...</SyncProvider>);
await waitFor(() => expect(spy).toHaveBeenCalled()); // times out

// CORRECT — dispatch the event after render
render(<SyncProvider ...>...</SyncProvider>);

document.dispatchEvent(new Event('visibilitychange'));
// or
window.dispatchEvent(new Event('pagehide'));

await waitFor(() => expect(spy).toHaveBeenCalled());
```

### 4. Wrap Manual Dispatches in act()

```ts
// React 19 strict mode runs useEffect: mount → cleanup → mount
// Between cleanup and re-mount, listeners are detached
// WRONG — dispatch might fire while listeners are detached
document.dispatchEvent(new Event('visibilitychange'));

// CORRECT — wrap in act() to ensure React has settled
await act(async () => {
  document.dispatchEvent(new Event('visibilitychange'));
});
```

### 5. Dispatch First, Then waitFor

```ts
// WRONG — waitFor polls before event is dispatched
await waitFor(() => expect(spy).toHaveBeenCalled());
document.dispatchEvent(new Event('pagehide'));

// CORRECT — dispatch first, then waitFor polls the condition
document.dispatchEvent(new Event('pagehide'));
await waitFor(() => expect(spy).toHaveBeenCalled());
```

## Pattern Checklist

- [ ] EventStore factory returns `{ db, eventStore }` object (not `EventStore` instance)
- [ ] Spies are on `ModuleName.prototype.methodName`, not instance methods
- [ ] Browser events (`visibilitychange`, `pagehide`, `beforeunload`) are dispatched manually after render
- [ ] Manual dispatches are wrapped in `await act(async () => { ... })`
- [ ] Event is dispatched BEFORE `waitFor` checks the assertion

## When to Apply

- Any new React context provider that wraps a deep module (`SyncEngine`, `AuthGate`, `SessionLifecycle`)
- When testing providers with `useEffect` lifecycle hooks that listen to browser events
- When tests timeout waiting for async handlers to be called

## Related Rules

- [dexie-test-setup.md](./dexie-test-setup.md) — for Dexie-internal test setup (unique DB names, fake-indexeddb)
- [auth-testing-fakes.md](./auth-testing-fakes.md) — for hand-written fake Supabase clients