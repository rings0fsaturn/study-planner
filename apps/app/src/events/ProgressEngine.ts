import type { Event } from './EventStore';

export function totalMinutesLogged(events: Event[]): number {
  return events
    .filter(event => event.kind === 'SessionLogged')
    .reduce((total, event) => {
      const duration = event.payload.duration;
      if (typeof duration === 'number') {
        return total + duration;
      }
      return total;
    }, 0);
}