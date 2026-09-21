-- =============================================================================
-- 032: enqueue_assessment_generation allocates the attempt under a lock (#45)
-- =============================================================================
--
-- 021 computes max(attempt) + 1 per generation kind so the
-- (kind, material_id, attempt) uniqueness holds across retries. The SELECT and
-- the INSERT are not atomic, so two concurrent generations for the *same*
-- material both read the same max and one INSERT loses the race with a unique
-- violation.
--
-- Observed live 2026-09-21 while verifying a coding practice run: a 2-problem
-- run on one material fans out GENERATION_CONCURRENCY (2) calls, this RPC
-- answered `409 Conflict` for the second, and the run opened with one problem
-- instead of two. The same race is latent in every multi-question practice run
-- and in any client that generates two assessments on one material at once; it
-- is timing-dependent, so it surfaces as flakiness rather than a hard failure.
--
-- Take a transaction-scoped advisory lock keyed by the material before reading
-- the max. The RPC transaction is short (one insert plus one queue send), so
-- same-material enqueues serialize while different materials stay concurrent.
-- A hashtext collision only costs unnecessary serialization, never correctness.

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

  -- Serialize read-then-insert per material (released at commit).
  PERFORM pg_advisory_xact_lock(
    hashtext('enqueue_assessment_generation:' || p_material_id)
  );

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
