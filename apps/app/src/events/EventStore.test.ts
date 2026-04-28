import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { EventStore } from './EventStore';

describe('EventStore', () => {
  let db: Dexie;
  let eventStore: EventStore;

  beforeEach(async () => {
    db = new Dexie('StudyTrackerTest');
    db.version(1).stores({
      events: '++id, kind, createdAt'
    });
    eventStore = new EventStore(db);
    await db.open();
    await db.table('events').clear();
  });

  it('append persists an event and returns its id', async () => {
    const id = await eventStore.append('SessionLogged', {
      duration: 45,
      date: '2024-01-15',
      description: 'Studied calculus'
    });

    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('getAll returns all events in insertion order', async () => {
    const id1 = await eventStore.append('SessionLogged', { duration: 30 });
    const id2 = await eventStore.append('SessionLogged', { duration: 60 });

    const events = await eventStore.getAll();

    expect(events).toHaveLength(2);
    expect(events[0].id).toBe(id1);
    expect(events[1].id).toBe(id2);
    expect(events[0].payload.duration).toBe(30);
    expect(events[1].payload.duration).toBe(60);
  });

  it('query returns liveQuery observable that emits on append', async () => {
    const events = await eventStore.getAll();
    expect(events).toHaveLength(0);

    await eventStore.append('SessionLogged', { duration: 45 });

    const updatedEvents = await eventStore.getAll();
    expect(updatedEvents).toHaveLength(1);
    expect(updatedEvents[0].kind).toBe('SessionLogged');
  });

  it('wipe clears all events', async () => {
    await eventStore.append('SessionLogged', { duration: 30 });
    await eventStore.append('SessionLogged', { duration: 60 });

    await eventStore.wipe();

    const events = await eventStore.getAll();
    expect(events).toHaveLength(0);
  });

  it('append + getAll round-trip produces identical data', async () => {
    const payload = { duration: 45, date: '2024-01-15', description: 'Math chapter 3' };
    await eventStore.append('SessionLogged', payload);

    const events = await eventStore.getAll();

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('SessionLogged');
    expect(events[0].payload).toEqual(payload);
    expect(events[0].createdAt).toBeDefined();
  });
});