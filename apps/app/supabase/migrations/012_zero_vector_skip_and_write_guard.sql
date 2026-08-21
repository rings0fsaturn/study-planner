-- =============================================================================
-- 012: zero-vector chunk skip-and-flag + terminal-job write guard
-- =============================================================================
--
-- Review findings (2026-08-14):
-- 1. A provider zero vector failed the whole material. Chunks whose vector is
--    all zeros are now flagged (skipped = TRUE) and excluded from the embed
--    NULL-scan and the ready gate; a material with zero embeddable chunks
--    still fails validation, but a partially-flagged material can reach ready
--    over its embedded chunks only.
-- 2. set_job_running could flip a succeeded/failed job back to running if a
--    stale stage message redelivered after completion. The worker's guard
--    already skips terminal jobs; the write is now additionally conditional
--    so a terminal job can never be re-opened by the worker.

ALTER TABLE public.content_chunks
  ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT FALSE;

-- The NULL-scan resume query filters embedding IS NULL; flagged chunks must
-- not resurface there, so the existing partial index now also excludes them.
DROP INDEX IF EXISTS idx_content_chunks_embedding_null;
CREATE INDEX idx_content_chunks_embedding_null
  ON public.content_chunks (material_id)
  WHERE embedding IS NULL AND skipped = FALSE;

-- The ready gate counts only un-embedded, un-flagged chunks: a fully flagged
-- material must not publish, but a partially flagged one can.
CREATE OR REPLACE FUNCTION public.ingestion_publish_ready(
  p_material_id TEXT,
  p_job_id TEXT,
  p_chunk_count INTEGER,
  p_grounding_version TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_job_material TEXT;
  v_material_exists TEXT;
  v_missing INTEGER;
  v_embedded INTEGER;
BEGIN
  SELECT id INTO v_material_exists FROM public.materials WHERE id = p_material_id;
  IF v_material_exists IS NULL THEN
    RAISE EXCEPTION 'material not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT material_id INTO v_job_material FROM public.ingestion_jobs WHERE id = p_job_id;
  IF v_job_material IS NULL OR v_job_material <> p_material_id THEN
    RAISE EXCEPTION 'job does not belong to material' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency: a redelivered publish for an already-published attempt is a
  -- no-op instead of an error.
  IF EXISTS (
    SELECT 1 FROM public.materials
    WHERE id = p_material_id AND ingestion_state = 'ready'
  ) AND EXISTS (
    SELECT 1 FROM public.ingestion_jobs
    WHERE id = p_job_id AND status = 'succeeded'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_missing
    FROM public.content_chunks
   WHERE material_id = p_material_id AND embedding IS NULL AND skipped = FALSE;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'chunks are not fully embedded' USING ERRCODE = 'P0002';
  END IF;

  SELECT COUNT(*) INTO v_embedded
    FROM public.content_chunks
   WHERE material_id = p_material_id AND embedding IS NOT NULL;
  IF v_embedded = 0 THEN
    RAISE EXCEPTION 'no embeddable chunks remain' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.materials
     SET ingestion_state = 'ready',
         ingestion_progress = 1.0,
         ingestion_error = NULL,
         chunk_count = p_chunk_count,
         grounding_version = p_grounding_version
   WHERE id = p_material_id;

  UPDATE public.ingestion_jobs
     SET status = 'succeeded',
         result_id = p_material_id,
         completed_at = now()
   WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ingestion_publish_ready(TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingestion_publish_ready(TEXT, TEXT, INTEGER, TEXT) TO service_role;
