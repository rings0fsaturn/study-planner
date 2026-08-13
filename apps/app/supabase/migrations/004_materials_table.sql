-- Migration 004: Owner-scoped material library records (Phase 2 ticket #36)
--
-- Materials are server-owned library entities. The browser reads and writes
-- metadata rows through RLS with the authenticated user id; ingestion
-- execution, chunks, vectors, and generation remain service-owned (#37+).

-- =============================================================================
-- MATERIALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'url', 'youtube', 'file')),
  source TEXT NOT NULL DEFAULT '',
  ingestion_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (ingestion_state IN ('pending', 'extracting', 'chunking', 'embedding', 'ready', 'failed')),
  ingestion_progress REAL NOT NULL DEFAULT 0
    CHECK (ingestion_progress >= 0 AND ingestion_progress <= 1),
  ingestion_error TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  content_version TEXT NOT NULL,
  replaced_at TIMESTAMPTZ,
  estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Manual (contentless) materials may omit a source; every other kind needs one.
  CONSTRAINT materials_source_required CHECK (kind = 'manual' OR char_length(source) >= 1),
  CONSTRAINT materials_client_id_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_materials_user_created ON public.materials(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_user_state ON public.materials(user_id, ingestion_state);
CREATE INDEX IF NOT EXISTS idx_materials_user_archived ON public.materials(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_materials_user_title ON public.materials(user_id, title);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Drop policies before recreating (idempotent workaround for missing IF NOT EXISTS)
DROP POLICY IF EXISTS "Users can read own materials"   ON public.materials;
DROP POLICY IF EXISTS "Users can insert own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can delete own materials" ON public.materials;

CREATE POLICY "Users can read own materials"
  ON public.materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own materials"
  ON public.materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own materials"
  ON public.materials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own materials"
  ON public.materials FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS materials_set_updated_at ON public.materials;

CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
