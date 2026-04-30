# Supabase Schema

Migration file: `apps/app/supabase/migrations/003_events_table.sql`

## `public.events` Table

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL | Primary key |
| `user_id` | UUID | References auth.users, default `auth.uid()`, cascade delete |
| `kind` | TEXT | Event type |
| `payload` | JSONB | Event data |
| `client_id` | UUID | Deduplication key |
| `device_local_id` | INTEGER | Local EventStore ID |
| `created_at` | TIMESTAMPTZ | Server timestamp |

Indexes: `(user_id, id DESC)`, `(client_id)`.

RLS: users can SELECT, INSERT, DELETE own events only.

## `sync-snapshots` Storage Bucket

Private bucket, 5MB limit, `application/json` only.

Path convention: `<userId>/snapshot.json`.

RLS: users can read/insert/update/delete objects in their own folder (matched via `storage.foldername(name)[1]`).
