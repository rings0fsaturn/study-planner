-- Migration 003: Sync events to Postgres; restore on a fresh device
-- Issue: https://github.com/study-tracker/study-planner-web/issues/3

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

-- Indexes for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_client_id ON public.events(client_id);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Users can read only their own events
CREATE POLICY IF NOT EXISTS "Users can read own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own events (RLS forces user_id = auth.uid())
CREATE POLICY IF NOT EXISTS "Users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own events (for account deletion cascade)
CREATE POLICY IF NOT EXISTS "Users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy — events are immutable once written

-- =============================================================================
-- SYNC SNAPSHOTS STORAGE BUCKET
-- =============================================================================

-- Create the storage bucket for sync snapshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sync-snapshots', 'sync-snapshots', false, 5242880, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects

-- Users can read own snapshots (path format: {user_id}/snapshot.json)
CREATE POLICY IF NOT EXISTS "Users can read own snapshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can insert own snapshots
CREATE POLICY IF NOT EXISTS "Users can insert own snapshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update own snapshots
CREATE POLICY IF NOT EXISTS "Users can update own snapshots"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete own snapshots
CREATE POLICY IF NOT EXISTS "Users can delete own snapshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sync-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);
