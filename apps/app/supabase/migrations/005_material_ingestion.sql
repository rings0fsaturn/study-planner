-- Migration 005: Material ingestion pipeline (Phase 2 ticket #37)
--
-- Adds the approved ingestion topology: private Storage for raw files and
-- extracted text, owner-scoped ingestion jobs, content chunks with
-- halfvec(768) embeddings, pgmq stage queues, trigger-driven enqueue,
-- upload-completion gating for file materials, atomic ready publish
-- guards, and Realtime publication of material status.
--
-- Source of truth: Postgres. The browser only owns material metadata rows
-- (materials) and private Storage uploads; jobs, chunks, vectors, and
-- queue messages are server-owned.

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

-- =============================================================================
-- MATERIALS: ingestion metadata columns
-- =============================================================================

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS upload_complete_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0
    CHECK (chunk_count >= 0),
  ADD COLUMN IF NOT EXISTS grounding_version TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text_path TEXT;

-- =============================================================================
-- INGESTION JOBS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ingestion'
    CHECK (kind IN ('ingestion', 'generation', 'grading', 'roadmap_feedback')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  attempt INTEGER NOT NULL DEFAULT 1,
  correlation_id TEXT NOT NULL,
  result_id TEXT,
  error_code TEXT,
  error_message TEXT,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT ingestion_jobs_material_attempt_unique UNIQUE (material_id, attempt)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_user ON public.ingestion_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_material ON public.ingestion_jobs(material_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON public.ingestion_jobs(status);

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- Owners may observe their own jobs; writes belong to the service/worker.
DROP POLICY IF EXISTS "Users can read own ingestion jobs" ON public.ingestion_jobs;
CREATE POLICY "Users can read own ingestion jobs"
  ON public.ingestion_jobs FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_jobs TO service_role;

-- =============================================================================
-- CONTENT CHUNKS + EMBEDDINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.content_chunks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  start_seconds DOUBLE PRECISION,
  embedding halfvec(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_chunks_material_ordinal_unique UNIQUE (material_id, ordinal)
);

-- Filtered HNSW index over normalized cosine vectors (approved #8 decision).
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding_hnsw
  ON public.content_chunks USING hnsw (embedding halfvec_cosine_ops)
  WHERE embedding IS NOT NULL;

-- NULL-scan resume: the embedder finds unembedded chunks for a material.
CREATE INDEX IF NOT EXISTS idx_content_chunks_embedding_null
  ON public.content_chunks (material_id)
  WHERE embedding IS NULL;

ALTER TABLE public.content_chunks ENABLE ROW LEVEL SECURITY;

-- Chunks are server-owned. No client read/write policy: extracted content
-- reaches the learner only through the service preview API.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_chunks TO service_role;

-- RLS-scoped retrieval RPC (server-internal; mandatory material_id).
CREATE OR REPLACE FUNCTION public.match_content_chunks(
  query_embedding halfvec(768),
  match_material_id TEXT,
  top_k INTEGER DEFAULT 10
)
RETURNS TABLE(
  chunk_id TEXT,
  material_id TEXT,
  chunk_text TEXT,
  ordinal INTEGER,
  start_seconds DOUBLE PRECISION,
  similarity DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT c.id,
         c.material_id,
         c.text,
         c.ordinal,
         c.start_seconds,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.content_chunks c
  WHERE c.material_id = match_material_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(top_k, 1), 50)
$$;

REVOKE ALL ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER) TO service_role;

-- =============================================================================
-- PRIVATE STORAGE: material-raw bucket
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('material-raw', 'material-raw', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "material-raw owner read"   ON storage.objects;
DROP POLICY IF EXISTS "material-raw owner insert" ON storage.objects;
DROP POLICY IF EXISTS "material-raw owner update" ON storage.objects;
DROP POLICY IF EXISTS "material-raw owner delete" ON storage.objects;

CREATE POLICY "material-raw owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'material-raw' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "material-raw owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'material-raw' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "material-raw owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'material-raw' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'material-raw' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "material-raw owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'material-raw' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- PGMQ STAGE QUEUES
-- =============================================================================

DO $$
DECLARE
  queue_name TEXT;
BEGIN
  FOREACH queue_name IN ARRAY ARRAY['material_extract', 'material_embed', 'material_publish']
  LOOP
    BEGIN
      PERFORM pgmq.create(queue_name);
    EXCEPTION
      WHEN unique_violation THEN NULL;
    END;
  END LOOP;
END $$;

-- Worker-facing queue access. These wrappers exist so the queue contract is a
-- public-schema RPC surface for the service role and nothing is exposed
-- directly to browsers.
CREATE OR REPLACE FUNCTION public.ingestion_send(p_queue TEXT, p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.send(p_queue, p_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.ingestion_poll(p_queue TEXT, p_vt INTEGER DEFAULT 30)
RETURNS TABLE(msg_id BIGINT, read_ct INTEGER, payload JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
    SELECT r.msg_id, r.read_ct, r.message::jsonb
    FROM pgmq.read(p_queue, p_vt) AS r;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingestion_complete(p_queue TEXT, p_msg_id BIGINT, p_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF p_success THEN
    PERFORM pgmq.archive(p_queue, p_msg_id);
  ELSE
    PERFORM pgmq.set_vt(p_queue, p_msg_id, 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ingestion_send(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingestion_poll(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingestion_complete(TEXT, BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingestion_send(TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingestion_poll(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingestion_complete(TEXT, BIGINT, BOOLEAN) TO service_role;

-- =============================================================================
-- TRIGGER-DRIVEN ENQUEUE + UPLOAD COMPLETION
-- =============================================================================

-- The browser never talks to the queue. A Postgres trigger enqueues a new
-- ingestion attempt whenever a material moves into `pending` and (for file
-- materials) the private upload has been marked complete. Retry and
-- replace-keep-id both land here through their existing pending transition.
CREATE OR REPLACE FUNCTION public.enqueue_material_ingestion()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_correlation_id TEXT;
  v_attempt INTEGER;
  v_job_id TEXT;
  v_payload JSONB;
BEGIN
  IF NEW.ingestion_state <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.kind = 'file' AND NEW.upload_complete_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(attempt), 0) + 1
    INTO v_attempt
    FROM public.ingestion_jobs
   WHERE material_id = NEW.id;

  v_correlation_id := gen_random_uuid()::text;
  v_job_id := gen_random_uuid()::text;

  INSERT INTO public.ingestion_jobs
    (id, user_id, material_id, kind, status, attempt, correlation_id)
  VALUES
    (v_job_id, NEW.user_id, NEW.id, 'ingestion', 'queued', v_attempt, v_correlation_id);

  v_payload := jsonb_build_object(
    'jobId', v_job_id,
    'materialId', NEW.id,
    'ownerId', NEW.user_id,
    'attempt', v_attempt,
    'correlationId', v_correlation_id,
    'kind', NEW.kind,
    'title', NEW.title,
    'source', NEW.source
  );

  PERFORM pgmq.send('material_extract', v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materials_enqueue_ingestion ON public.materials;

CREATE TRIGGER materials_enqueue_ingestion
  AFTER INSERT OR UPDATE OF ingestion_state, upload_complete_at ON public.materials
  FOR EACH ROW
  WHEN (NEW.ingestion_state = 'pending')
  EXECUTE FUNCTION public.enqueue_material_ingestion();

REVOKE ALL ON FUNCTION public.enqueue_material_ingestion() FROM PUBLIC;

-- Marks a file material's private-Storage upload complete. Only the owner can
-- do this; the state transition itself re-fires the enqueue trigger.
CREATE OR REPLACE FUNCTION public.complete_material_upload(p_material_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner
    FROM public.materials
   WHERE id = p_material_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'material not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.materials
     SET upload_complete_at = now(),
         ingestion_state = 'pending',
         ingestion_progress = 0,
         ingestion_error = NULL
   WHERE id = p_material_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_material_upload(TEXT) TO authenticated;

-- =============================================================================
-- REALTIME: material status changes stream to the app
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'materials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
  END IF;
END $$;
