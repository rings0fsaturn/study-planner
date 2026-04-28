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

  async append(kind: string, payload: Record<string, unknown>): Promise<number> {
    const event: Omit<Event, 'id'> = {
      kind,
      payload,
      createdAt: new Date().toISOString()
    };

    return await this.db.table('events').add(event) as number;
  }

  async getAll(): Promise<Event[]> {
    return await this.db.table('events').toArray();
  }

  query() {
    return liveQuery(() => this.db.table('events').toArray());
  }

  async wipe(): Promise<void> {
    await this.db.table('events').clear();
  }

  close(): void {
    this.db.close();
  }
}