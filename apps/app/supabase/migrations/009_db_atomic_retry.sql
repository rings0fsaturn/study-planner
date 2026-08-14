-- =============================================================================
-- 009: DB-atomic retry RPC (Gate 7 decision)
-- =============================================================================
--
-- Retry ownership moves to a single database function. The previous retry
-- path was a client PATCH (ingestion_state -> pending) relying on the enqueue
-- trigger; double-clicking retry after a failure could create two jobs. The
-- RPC locks the material row, is idempotent while an attempt is in flight,
-- and creates the new attempt + queue message in one transaction.
--
-- The FastAPI retry endpoint (header-only Idempotency-Key validation, no real
-- dedup) is removed from the service in the same change.

CREATE OR REPLACE FUNCTION public.retry_material_ingestion(p_material_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_owner UUID;
  v_latest_status TEXT;
  v_latest_job TEXT;
  v_attempt INTEGER;
  v_job_id TEXT;
  v_correlation_id TEXT;
  v_payload JSONB;
  v_kind TEXT;
  v_title TEXT;
  v_source TEXT;
  v_user_id UUID;
BEGIN
  SELECT id, user_id INTO v_owner, v_user_id
  FROM public.materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'material not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT status, id INTO v_latest_status, v_latest_job
  FROM public.ingestion_jobs
  WHERE material_id = p_material_id
  ORDER BY attempt DESC
  LIMIT 1;

  IF v_latest_status IN ('queued', 'running') THEN
    -- Idempotent no-op: an attempt is already in flight. Returns the same
    -- job for a double-clicked retry instead of stacking a second job.
    RETURN v_latest_job;
  END IF;

  IF v_latest_status IS NULL THEN
    RAISE EXCEPTION 'upload must complete before retrying' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(attempt), 0) + 1
    INTO v_attempt
    FROM public.ingestion_jobs
   WHERE material_id = p_material_id;

  v_correlation_id := gen_random_uuid()::text;
  v_job_id := gen_random_uuid()::text;

  INSERT INTO public.ingestion_jobs
    (id, user_id, material_id, kind, status, attempt, correlation_id)
  VALUES
    (v_job_id, v_user_id, p_material_id, 'ingestion', 'queued', v_attempt, v_correlation_id);

  SELECT kind, title, source INTO v_kind, v_title, v_source
  FROM public.materials WHERE id = p_material_id;

  v_payload := jsonb_build_object(
    'jobId', v_job_id,
    'materialId', p_material_id,
    'ownerId', v_user_id,
    'attempt', v_attempt,
    'correlationId', v_correlation_id,
    'kind', v_kind,
    'title', v_title,
    'source', v_source
  );

  PERFORM pgmq.send('material_extract', v_payload);

  -- The pending transition re-fires the enqueue trigger, but the trigger's
  -- in-flight guard sees the job created above and skips.
  UPDATE public.materials
     SET ingestion_state = 'pending',
         ingestion_progress = 0,
         ingestion_error = NULL
   WHERE id = p_material_id;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_material_ingestion(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_material_ingestion(TEXT) TO authenticated;
