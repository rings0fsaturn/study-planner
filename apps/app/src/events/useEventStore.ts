import { useEventStoreContext } from './EventStoreProvider';

export function useEventStore() {
  const { eventStore } = useEventStoreContext();
  return eventStore;
}