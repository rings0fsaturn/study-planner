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

  describe('bulkAppend', () => {
    it('inserts multiple events and returns all ids', async () => {
      const events = [
        { kind: 'SessionLogged', payload: { duration: 30 }, createdAt: '2024-01-15T10:00:00Z' },
        { kind: 'SessionLogged', payload: { duration: 60 }, createdAt: '2024-01-15T11:00:00Z' },
        { kind: 'RoadmapCreated', payload: { title: 'My Roadmap' }, createdAt: '2024-01-15T12:00:00Z' }
      ];

      const ids = await eventStore.bulkAppend(events);

      expect(ids).toHaveLength(3);
      expect(ids[0]).toBeGreaterThan(0);
      expect(ids[1]).toBeGreaterThan(ids[0]);
      expect(ids[2]).toBeGreaterThan(ids[1]);

      const stored = await eventStore.getAll();
      expect(stored).toHaveLength(3);
      expect(stored[0].payload.duration).toBe(30);
      expect(stored[1].payload.duration).toBe(60);
      expect(stored[2].kind).toBe('RoadmapCreated');
    });

    it('returns empty array when given empty array', async () => {
      const ids = await eventStore.bulkAppend([]);
      expect(ids).toHaveLength(0);
      const stored = await eventStore.getAll();
      expect(stored).toHaveLength(0);
    });
  });

  describe('getMaxId', () => {
    it('returns null for empty store', async () => {
      const maxId = await eventStore.getMaxId();
      expect(maxId).toBeNull();
    });

    it('returns correct max id after multiple appends', async () => {
      const id1 = await eventStore.append('SessionLogged', { duration: 30 });
      const id2 = await eventStore.append('SessionLogged', { duration: 60 });
      const id3 = await eventStore.append('SessionLogged', { duration: 45 });

      const maxId = await eventStore.getMaxId();
      expect(maxId).toBe(id3);
      expect(maxId).toBeGreaterThan(id2);
      expect(maxId).toBeGreaterThan(id1);
    });

    it('returns correct max id after bulkAppend', async () => {
      const ids = await eventStore.bulkAppend([
        { kind: 'SessionLogged', payload: { duration: 30 }, createdAt: '2024-01-15T10:00:00Z' },
        { kind: 'SessionLogged', payload: { duration: 60 }, createdAt: '2024-01-15T11:00:00Z' }
      ]);

      const maxId = await eventStore.getMaxId();
      expect(maxId).toBe(ids[ids.length - 1]);
    });
  });

  describe('getEventsSince', () => {
    it('returns only events with id greater than given id', async () => {
      const id1 = await eventStore.append('SessionLogged', { duration: 30 });
      await eventStore.append('SessionLogged', { duration: 60 });
      await eventStore.append('SessionLogged', { duration: 45 });

      const events = await eventStore.getEventsSince(id1);

      expect(events).toHaveLength(2);
      expect(events[0].payload.duration).toBe(60);
      expect(events[1].payload.duration).toBe(45);
    });

    it('returns all events when given id is 0', async () => {
      await eventStore.append('SessionLogged', { duration: 30 });
      await eventStore.append('SessionLogged', { duration: 60 });

      const events = await eventStore.getEventsSince(0);

      expect(events).toHaveLength(2);
    });

    it('returns empty array when no events after given id', async () => {
      await eventStore.append('SessionLogged', { duration: 30 });
      const lastId = await eventStore.append('SessionLogged', { duration: 60 });

      const events = await eventStore.getEventsSince(lastId);

      expect(events).toHaveLength(0);
    });
  });

  describe('table accessor', () => {
    it('returns the Dexie table for the given name', async () => {
      const table = eventStore.table('events');
      expect(table).toBeDefined();
      expect(table.name).toBe('events');
    });

    it('allows direct table operations', async () => {
      await eventStore.append('SessionLogged', { duration: 30 });
      const table = eventStore.table('events');
      const count = await table.count();
      expect(count).toBe(1);
    });
  });
});