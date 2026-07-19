import { describe, it, expect } from 'vitest';
import { totalMinutesLogged } from './ProgressEngine';
import type { Event } from './EventStore';

describe('ProgressEngine', () => {
  describe('totalMinutesLogged', () => {
    it('returns 0 for empty list', () => {
      expect(totalMinutesLogged([])).toBe(0);
    });

    it('returns duration for single SessionLogged event', () => {
      const events: Event[] = [
        {
          kind: 'SessionLogged',
          payload: { duration: 45 },
          createdAt: '2024-01-15T10:00:00Z'
        }
      ];

      expect(totalMinutesLogged(events)).toBe(45);
    });

    it('returns correct sum for multiple SessionLogged events', () => {
      const events: Event[] = [
        {
          kind: 'SessionLogged',
          payload: { duration: 30 },
          createdAt: '2024-01-15T10:00:00Z'
        },
        {
          kind: 'SessionLogged',
          payload: { duration: 60 },
          createdAt: '2024-01-15T11:00:00Z'
        },
        {
          kind: 'SessionLogged',
          payload: { duration: 45 },
          createdAt: '2024-01-15T12:00:00Z'
        }
      ];

      expect(totalMinutesLogged(events)).toBe(135);
    });

    it('ignores non-SessionLogged events', () => {
      const events: Event[] = [
        {
          kind: 'SessionLogged',
          payload: { duration: 30 },
          createdAt: '2024-01-15T10:00:00Z'
        },
        {
          kind: 'RoadmapCreated',
          payload: { title: 'My Roadmap' },
          createdAt: '2024-01-15T11:00:00Z'
        },
        {
          kind: 'PreferenceSet',
          payload: { key: 'theme', value: 'dark' },
          createdAt: '2024-01-15T12:00:00Z'
        }
      ];

      expect(totalMinutesLogged(events)).toBe(30);
    });
  });
});