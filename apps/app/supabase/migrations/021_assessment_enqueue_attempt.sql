-- =============================================================================
-- 021: enqueue_assessment_generation picks the next attempt (issue #38)
-- =============================================================================
--
-- The (kind, material_id, attempt) uniqueness constraint means a retry on the
-- same material must carry attempt > 1 (pattern: retry_material_ingestion in
-- migration 009). The RPC now computes max(attempt) + 1 per generation kind
-- instead of hardcoding 1.

CREATE OR REPLACE FUNCTION public.enqueue_assessment_generation(
  p_assessment_id TEXT,
  p_job_id TEXT,
  p_material_id TEXT,
  p_correlation_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_user_id UUID;
  v_attempt INTEGER;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'assessment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(attempt), 0) + 1
    INTO v_attempt
    FROM public.ingestion_jobs
   WHERE material_id = p_material_id
     AND kind = 'generation';

  INSERT INTO public.ingestion_jobs
    (id, user_id, material_id, kind, status, attempt, correlation_id, result_id)
  VALUES
    (p_job_id, v_user_id, p_material_id, 'generation', 'queued', v_attempt,
     p_correlation_id, p_assessment_id);

  PERFORM pgmq.send('assessment_generate', jsonb_build_object(
    'jobId', p_job_id,
    'assessmentId', p_assessment_id,
    'materialId', p_material_id,
    'correlationId', p_correlation_id
  ));

  RETURN jsonb_build_object(
    'id', p_job_id,
    'user_id', v_user_id,
    'material_id', p_material_id,
    'kind', 'generation',
    'status', 'queued',
    'attempt', v_attempt,
    'correlation_id', p_correlation_id,
    'result_id', p_assessment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_assessment_generation(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_assessment_generation(TEXT, TEXT, TEXT, TEXT) TO authenticated;