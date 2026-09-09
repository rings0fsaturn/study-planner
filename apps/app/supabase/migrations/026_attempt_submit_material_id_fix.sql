-- =============================================================================
-- 026: submit_assessment_attempt material_id fix (#39 live leg)
-- =============================================================================
--
-- Live-verified 2026-09-09: the 025 submit RPC selected
--   q.user_id, q.format, q.assessment_id
-- into v_question but then read v_question.material_id for the grading job
-- row, so every submit failed with:
--   record "v_question" has no field "material_id" (42703).
-- The route tests mock UserScopedClient.submit_attempt, so the SQL shape was
-- never exercised before the live leg. This repair re-creates the function
-- with material_id in the SELECT; everything else is unchanged.
CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(
  p_assessment_id TEXT,
  p_question_id TEXT,
  p_client_attempt_id TEXT,
  p_attempt_id TEXT,
  p_job_id TEXT,
  p_answer JSONB,
  p_submitted_at TIMESTAMPTZ,
  p_elapsed_seconds INTEGER,
  p_correlation_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_user_id UUID;
  v_question RECORD;
  v_existing TEXT;
  v_attempt INTEGER;
BEGIN
  -- The question must exist and belong to this assessment and this owner.
  SELECT q.user_id, q.format, q.assessment_id, q.material_id
    INTO v_question
  FROM public.questions q
  WHERE q.id = p_question_id;

  IF v_question IS NULL
     OR v_question.assessment_id <> p_assessment_id
     OR v_question.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'question not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_question.format <> 'objective' THEN
    RAISE EXCEPTION 'only objective questions grade in this slice' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent replay: same (user, clientAttemptId) returns the first attempt.
  SELECT id INTO v_existing
  FROM public.question_attempts
  WHERE user_id = auth.uid() AND client_attempt_id = p_client_attempt_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('attemptId', v_existing, 'replayed', true);
  END IF;

  -- Grading job rows sequence per (kind, material) per the 018 uniqueness.
  SELECT COALESCE(MAX(attempt), 0) + 1 INTO v_attempt
  FROM public.ingestion_jobs
  WHERE kind = 'grading' AND material_id = v_question.material_id;

  INSERT INTO public.question_attempts
    (id, client_attempt_id, user_id, assessment_id, question_id, answer,
     status, elapsed_seconds, correlation_id, job_id, submitted_at)
  VALUES
    (p_attempt_id, p_client_attempt_id, auth.uid(), p_assessment_id,
     p_question_id, p_answer, 'queued', p_elapsed_seconds,
     p_correlation_id, p_job_id, p_submitted_at);

  INSERT INTO public.ingestion_jobs
    (id, user_id, material_id, kind, status, attempt, correlation_id, result_id)
  VALUES
    (p_job_id, auth.uid(), v_question.material_id, 'grading', 'queued',
     v_attempt, p_correlation_id, p_attempt_id);

  PERFORM pgmq.send('assessment_grade', jsonb_build_object(
    'jobId', p_job_id,
    'attemptId', p_attempt_id,
    'questionId', p_question_id,
    'correlationId', p_correlation_id
  ));

  RETURN jsonb_build_object(
    'attemptId', p_attempt_id,
    'questionId', p_question_id,
    'status', 'queued',
    'jobId', p_job_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_assessment_attempt(
  TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_assessment_attempt(
  TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT
) TO authenticated;
