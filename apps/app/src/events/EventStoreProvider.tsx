import { createContext, useContext, useMemo, type ReactNode } from 'react';
import Dexie from 'dexie';
import { EventStore } from './EventStore';

interface EventStoreValue {
  eventStore: EventStore;
}

const EventStoreContext = createContext<EventStoreValue | null>(null);

const DB_NAME = 'StudyTracker';

let globalEventStore: EventStore | null = null;

function createEventStore(): EventStore {
  const db = new Dexie(DB_NAME);
  db.version(1).stores({
    events: '++id, kind, createdAt'
  });
  return new EventStore(db);
}

export function getEventStoreWipe(): (() => Promise<void>) | null {
  return globalEventStore ? globalEventStore.wipe.bind(globalEventStore) : null;
}

export function EventStoreProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const store = createEventStore();
    globalEventStore = store;
    return { eventStore: store };
  }, []);

  return (
    <EventStoreContext.Provider value={value}>
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