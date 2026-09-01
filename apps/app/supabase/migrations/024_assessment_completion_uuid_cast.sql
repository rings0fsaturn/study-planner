-- =============================================================================
-- 024: cast user_id to uuid in complete_assessment_generation (issue #38)
-- =============================================================================
--
-- `->>` returns text and Postgres has no implicit text -> uuid cast, so the
-- question insert failed with 42804 whenever the guard passed. The RPC now
-- casts the user id explicitly; the remaining text/jsonb columns cast fine.

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
    (id, assessment_id, user_id, material_id, format, prompt, options,
     skill_tags, authored_difficulty, citations, answer_block)
  VALUES
    (p_question->>'id', v_assessment_id, (p_question->>'user_id')::uuid,
     p_question->>'material_id', p_question->>'format', p_question->>'prompt',
     p_question->'options', p_question->'skill_tags',
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