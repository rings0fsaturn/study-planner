import { useEventStoreContext } from './EventStoreProvider';

export function useEventStore() {
  const { eventStore, ready } = useEventStoreContext();
  if (!ready || !eventStore) {
    throw new Error('useEventStore called without an active user session');
  }
  return eventStore;
}