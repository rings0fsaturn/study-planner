-- =============================================================================
-- 027: written questions (subtype column) + submit gate accepts written (#41)
-- =============================================================================
--
-- Phase 2 of #41 makes written generation real, which needs three schema-level
-- changes and no others:
--
-- (a) `questions.subtype` - the authored short_answer/long_form marker on the
--     visible payload (openapi `Question.subtype`, optional). The authenticated
--     read path is a column grant (018/022), so the new column is added to that
--     grant; `answer_block` (rubric + reference answer) stays service_role-only.
-- (b) `complete_assessment_generation` (023) enumerated the accepted question
--     columns, so it must carry `subtype` or the worker's written row loses it.
-- (c) `submit_assessment_attempt` (026) rejected every non-objective question
--     with 'only objective questions grade in this slice'. Written attempts now
--     enqueue on the same `assessment_grade` queue; the `llm_rubric` grading arm
--     that drains them lands in Phase 3.
--
-- Verification: rule 36 (supabase db push --dry-run first, then push), plus a
-- service_role insert of a written question row and an authenticated read of
-- the redacted columns.

-- (a) Written question subtype. NULL for objective rows; a subtype on a
--     non-written row is a schema error, not a client problem.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subtype TEXT;

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_subtype_valid;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_subtype_valid
  CHECK (subtype IS NULL OR (format = 'written' AND subtype IN ('short_answer', 'long_form')));

-- 022 revoked the Supabase default table-level SELECT and kept an explicit
-- public-column grant; add the new column to that list (grants are additive).
GRANT SELECT
  (id, assessment_id, user_id, material_id, format, subtype, prompt, options,
   skill_tags, authored_difficulty, citations, created_at)
  ON public.questions TO authenticated;

-- (b) Accept the written row: same RPC as 023 plus `subtype`.
CREATE OR REPLACE FUNCTION public.complete_assessment_generation(
  p_question JSONB,
  p_job_id TEXT,
  p_status TEXT,
  p_warnings JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assessment_id TEXT;
  v_status TEXT;
BEGIN
  v_assessment_id := p_question->>'assessment_id';

  SELECT status INTO v_status
  FROM public.assessments
  WHERE id = v_assessment_id;

  IF v_status IS NULL OR v_status <> 'generating' THEN
    RAISE EXCEPTION 'assessment is not generating' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.questions
    (id, assessment_id, user_id, material_id, format, subtype, prompt, options,
     skill_tags, authored_difficulty, citations, answer_block)
  VALUES
    (p_question->>'id', v_assessment_id, p_question->>'user_id',
     p_question->>'material_id', p_question->>'format', p_question->>'subtype',
     p_question->>'prompt', p_question->'options', p_question->'skill_tags',
     (p_question->>'authored_difficulty')::int,
     p_question->'citations', p_question->'answer_block');

  UPDATE public.assessments
     SET status = p_status, warnings = p_warnings, updated_at = now()
   WHERE id = v_assessment_id;

  UPDATE public.ingestion_jobs
     SET status = 'succeeded', result_id = v_assessment_id, completed_at = now()
   WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_assessment_generation(JSONB, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_assessment_generation(JSONB, TEXT, TEXT, JSONB) TO service_role;

-- (c) Written attempts grade on the same path: the format gate widens from
--     `= 'objective'` to `IN ('objective', 'written')`; the grading job row,
--     the queue message, and the idempotent replay are unchanged.
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

  IF v_question.format NOT IN ('objective', 'written') THEN
    RAISE EXCEPTION 'only objective and written questions grade in this slice'
      USING ERRCODE = 'P0001';
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
