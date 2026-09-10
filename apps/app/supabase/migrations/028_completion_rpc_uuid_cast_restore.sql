-- =============================================================================
-- 028: restore the uuid cast in complete_assessment_generation (issue #41 P2)
-- =============================================================================
--
-- 027 re-created `complete_assessment_generation` (to add the `subtype` column)
-- from the migration-023 text instead of the latest live text, which silently
-- dropped 024's `(p_question->>'user_id')::uuid` cast. `->>` returns text and
-- Postgres has no implicit text -> uuid cast, so every accept died with
--   ERROR: 42804: column "user_id" is of type uuid but expression is of type text
-- for objective AND written rows alike.
--
-- Caught by the P2 live probe (`BEGIN; ... ROLLBACK;` calling the RPC against
-- the dev project) before any UI work depended on it. This restores the cast
-- and keeps 027's `subtype` column in the insert.
--
-- Lesson for future phases: before CREATE OR REPLACE-ing a function, grep the
-- whole migrations directory for that function name and copy its most recent
-- body -- plpgsql bodies are only parsed at first execution, so a stale copy
-- is created without error and fails at runtime.

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
    (p_question->>'id', v_assessment_id, (p_question->>'user_id')::uuid,
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
