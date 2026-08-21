-- =============================================================================
-- 007: atomic ready publish, duplicate-enqueue guard, server-owned column hardening
-- =============================================================================
--
-- Gate 6 findings (2026-08-14 live probes + worker review):
-- 1. A client UPDATE that keeps ingestion_state = 'pending' re-fires the
--    enqueue trigger, creating duplicate jobs/queue messages for the same
--    attempt window. The trigger now skips when a job is already in flight.
-- 2. Ready publish was two separate REST updates (material -> ready, then
--    job -> succeeded); a crash between them could leave a ready material
--    with a non-succeeded job. Publish now runs through the transactional
--    ingestion_publish_ready RPC (service role only).
-- 3. Owners could PATCH server-owned columns (chunk_count, grounding_version,
--    extracted_text_path, upload_complete_at). Column-level UPDATE is revoked
--    for anon/authenticated; complete_material_upload becomes SECURITY
--    DEFINER so the ownership-checked RPC still performs its update.

-- =============================================================================
-- 1) DUPLICATE-ENQUEUE GUARD
-- =============================================================================

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

  -- Repeated pending transitions (e.g. replace-keep-id while already
  -- pending) must not stack duplicate jobs for the same attempt window.
  IF EXISTS (
    SELECT 1 FROM public.ingestion_jobs
    WHERE material_id = NEW.id AND status IN ('queued', 'running')
  ) THEN
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

-- =============================================================================
-- 2) ATOMIC READY PUBLISH
-- =============================================================================

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
   WHERE material_id = p_material_id AND embedding IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'chunks are not fully embedded' USING ERRCODE = 'P0002';
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

-- =============================================================================
-- 3) SERVER-OWNED COLUMN HARDENING
-- =============================================================================

-- chunk_count / grounding_version / extracted_text_path are written only by
-- the worker; upload_complete_at only through complete_material_upload (now
-- SECURITY DEFINER, so the ownership check still applies). Owners must not be
-- able to forge ingestion metadata through a direct PATCH.
REVOKE UPDATE (chunk_count, grounding_version, extracted_text_path, upload_complete_at)
  ON public.materials FROM anon, authenticated;

-- The ownership-checked RPC runs as the function owner so the revoke above
-- cannot break the legitimate upload-completion path.
CREATE OR REPLACE FUNCTION public.complete_material_upload(p_material_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
