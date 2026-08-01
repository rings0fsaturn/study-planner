import Dexie from 'dexie';
import { liveQuery } from 'dexie';

export interface Event {
  id?: number;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export class EventStore {
  private readonly db: Dexie;

  constructor(db: Dexie) {
    this.db = db;
  }

  async append(kind: string, payload: Record<string, unknown>, createdAt = new Date().toISOString()): Promise<number> {
    const event: Omit<Event, 'id'> = {
      kind,
      payload,
      createdAt,
    };

    return await this.db.table('events').add(event) as number;
  }

  async getAll(): Promise<Event[]> {
    return await this.db.table('events').toArray();
  }

  query() {
    return liveQuery(() => this.db.table('events').toArray());
  }

  async bulkAppend(events: Omit<Event, 'id'>[]): Promise<number[]> {
    if (events.length === 0) return [];
    return await this.db.table('events').bulkAdd(events, { allKeys: true }) as number[];
  }

  async getMaxId(): Promise<number | null> {
    const events = await this.db.table('events').orderBy('id').last();
    return events?.id ?? null;
  }

  async getEventsSince(id: number): Promise<Event[]> {
    return await this.db.table('events').where('id').above(id).toArray();
  }

  table(name: string) {
    return this.db.table(name);
  }

  async wipe(): Promise<void> {
    await this.db.table('events').clear();
  }

  close(): void {
    this.db.close();
  }
}
