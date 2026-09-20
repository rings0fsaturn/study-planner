import { createContext, useContext, useRef, useEffect, useState, type ReactNode } from 'react';
import Dexie from 'dexie';
import { EventStore } from './EventStore';

interface EventStoreValue {
  eventStore: EventStore | null;
  ready: boolean;
}

const EventStoreContext = createContext<EventStoreValue>({
  eventStore: null,
  ready: false
});

function dbNameForUser(userId: string): string {
  return `StudyTracker_${userId}`;
}

export function createEventStore(userId: string): EventStore {
  const db = new Dexie(dbNameForUser(userId));
  db.version(1).stores({
    events: '++id, kind, createdAt'
  });
  db.version(2).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key'
  });
  db.version(3).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key',
    onboardingDraft: 'id',
  });
  db.version(4).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key',
    onboardingDraft: 'id',
    activeSession: 'id',
  });
  db.version(5).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key',
    onboardingDraft: 'id',
    activeSession: 'id',
    calibrationCache: 'key',
  });
  db.version(6).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key',
    onboardingDraft: 'id',
    activeSession: 'id',
    calibrationCache: 'key',
    // #39: local attempt log (the only client-side home for the answer) and
    // the redacted content cache (envelope + visible payload only, AC1).
    // Keyed by clientAttemptId: the server mints attemptId on submit and the
    // row is patched with it afterwards (retry = new clientAttemptId row).
    // Neither table syncs (calibrationCache precedent).
    assessmentAttempts: 'clientAttemptId, attemptId, questionId, assessmentId, status, submittedAt',
    assessmentContentCache: 'assessmentId',
  });
  // #43: derived mastery projections keyed by (material, skill). Non-synced,
  // rebuildable from durable grades via GET /v1/mastery (calibrationCache
  // precedent, map #4 #10); a fresh fetch overwrites the row in place.
  db.version(7).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key',
    onboardingDraft: 'id',
    activeSession: 'id',
    calibrationCache: 'key',
    assessmentAttempts: 'clientAttemptId, attemptId, questionId, assessmentId, status, submittedAt',
    assessmentContentCache: 'assessmentId',
    masteryCache: 'materialId, skillTag',
  });
  return new EventStore(db);
}

interface EventStoreProviderProps {
  children: ReactNode;
  userId: string | null;
}

export function EventStoreProvider({ children, userId }: EventStoreProviderProps) {
  const [store, setStore] = useState<EventStore | null>(null);
  const [ready, setReady] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousUserId = currentUserIdRef.current;

    if (previousUserId && previousUserId !== userId) {
      const oldDbName = dbNameForUser(previousUserId);
      const allDbs = Dexie.getDatabaseNames();
      allDbs.then(names => {
        if (names.includes(oldDbName)) {
          const tempDb = new Dexie(oldDbName);
          tempDb.open().then(() => {
            tempDb.close();
          }).catch(() => {
            // DB might already be closed or unavailable
          });
        }
      });
    }

    if (!userId) {
      currentUserIdRef.current = null;
      setStore(null);
      setReady(false);
      return;
    }

    if (previousUserId === userId && store) {
      return;
    }

    const newStore = createEventStore(userId);
    currentUserIdRef.current = userId;
    setStore(newStore);
    setReady(true);

    return () => {
      // Cleanup on unmount only
    };
  }, [userId]);

  return (
    <EventStoreContext.Provider value={{ eventStore: store, ready }}>
      {children}
    </EventStoreContext.Provider>
  );
}

export function useEventStoreContext() {
  const context = useContext(EventStoreContext);
  if (!context) {
    throw new Error('useEventStoreContext must be used within EventStoreProvider');
  }
  return context;
}
