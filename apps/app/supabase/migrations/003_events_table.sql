-- Migration 003: Sync events to Postgres; restore on a fresh device

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  client_id UUID NOT NULL,
  device_local_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_client_id ON public.events(client_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating (idempotent workaround for missing IF NOT EXISTS)
DROP POLICY IF EXISTS "Users can read own events"   ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;

CREATE POLICY "Users can read own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- SYNC SNAPSHOTS STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sync-snapshots', 'sync-snapshots', false, 5242880, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own snapshots"   ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own snapshots" ON storage.objects;

CREATE POLICY "Users can read own snapshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can insert own snapshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own snapshots"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own snapshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);