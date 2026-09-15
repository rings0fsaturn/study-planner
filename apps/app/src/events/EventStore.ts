import Dexie from 'dexie';
import { liveQuery } from 'dexie';

/** Durable event kind for a server-owned assessment generation request. */
export const ASSESSMENT_CREATED = 'AssessmentCreated' as const;

/** Durable event kind: the learner submitted an answer (answer-free payload). */
export const QUESTION_ATTEMPTED = 'QuestionAttempted' as const;

/** Durable event kind: the server returned the authoritative grade. */
export const QUESTION_GRADED = 'QuestionGraded' as const;

/** Durable event kind: a practice run's thin local pointer was minted (D-02). */
export const PRACTICE_RUN_STARTED = 'PracticeRunStarted' as const;

/** Durable event kind: the run closed, completed or abandoned (D-11). */
export const PRACTICE_RUN_FINISHED = 'PracticeRunFinished' as const;

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
