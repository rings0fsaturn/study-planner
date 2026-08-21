-- =============================================================================
-- 010: fix retry_material_ingestion uuid cast (009 shipped a bad INTO target)
-- =============================================================================
--
-- 009's retry RPC selected `id, user_id INTO v_owner, v_user_id`; v_owner is a
-- UUID but materials.id is client-generated TEXT, so any non-UUID material id
-- failed with `invalid input syntax for type uuid` (22P02). Only user_id is
-- needed for the ownership check.

CREATE OR REPLACE FUNCTION public.retry_material_ingestion(p_material_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_user_id UUID;
  v_latest_status TEXT;
  v_latest_job TEXT;
  v_attempt INTEGER;
  v_job_id TEXT;
  v_correlation_id TEXT;
  v_payload JSONB;
  v_kind TEXT;
  v_title TEXT;
  v_source TEXT;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'material not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT status, id INTO v_latest_status, v_latest_job
  FROM public.ingestion_jobs
  WHERE material_id = p_material_id
  ORDER BY attempt DESC
  LIMIT 1;

  IF v_latest_status IN ('queued', 'running') THEN
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
