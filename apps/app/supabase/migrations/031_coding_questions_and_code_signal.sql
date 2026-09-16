-- =============================================================================
-- 031: coding questions (visible payload columns) + code-bearing material signal (#42)
-- =============================================================================
--
-- Phase 2 of #42 makes coding generation real. Two surfaces change and no
-- others:
--
-- (a) `questions.language` / `starter_code` / `visible_tests` - the visible
--     coding payload on the column-granted read path (D-09: columns over JSON
--     packing). All nullable; NULL = pre-coding rows. The hidden side (hidden
--     tests + reference solution) already rides `answer_block` (JSONB,
--     service_role-only since 018), so no hidden column exists here.
-- (b) `questions_subtype_valid` widens so `(format='coding', subtype IN
--     ('implement_fn','debug','output_prediction','complete_code'))` is legal;
--     the written and NULL branches are unchanged (027).
-- (c) `complete_assessment_generation` must carry the three columns or the
--     worker's coding row loses them (the 027 rule). Copied from the 028 body
--     (uuid cast restored) and extended - never rebuilt from 023 text (028
--     lesson: grep the whole migrations directory first).
-- (d) `submit_assessment_attempt` widens the format gate to accept coding
--     attempts; the grading arm that drains them lands in #42 P2. The P1
--     router stubs coding submits before this RPC is reachable.
-- (e) `materials.has_code` / `code_languages` - the deterministic code-bearing
--     signal computed at ingestion (D-04/D-10). Server-derived, so they join
--     the 008/030 server-owned-column guard. NULL means unknown (no backfill).
--
-- Verification: rule 36 (supabase db push --dry-run first, then push), plus a
-- service_role insert of a coding question row and an authenticated read of
-- the redacted columns.

-- (a) Visible coding payload on questions.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS starter_code TEXT,
  ADD COLUMN IF NOT EXISTS visible_tests JSONB;

COMMENT ON COLUMN public.questions.language IS
  'Coding questions only: the submission language (Day 1: python). NULL on pre-coding rows.';
COMMENT ON COLUMN public.questions.starter_code IS
  'Coding questions only: the authored starter code shown in the editor. NULL on pre-coding rows.';
COMMENT ON COLUMN public.questions.visible_tests IS
  'Coding questions only: learner-visible test cases the advisory runner may execute. Never carries hidden tests (those live in answer_block).';

-- (b) Widen the subtype CHECK: written stays as 027, coding adds its four
--     subtypes; a subtype on an objective row remains a schema error.
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_subtype_valid;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_subtype_valid
  CHECK (
    subtype IS NULL
    OR (format = 'written' AND subtype IN ('short_answer', 'long_form'))
    OR (format = 'coding' AND subtype IN ('implement_fn', 'debug', 'output_prediction', 'complete_code'))
  );

-- 022/027 keep the authenticated read on an explicit public-column grant;
-- add the three coding columns to that list (grants are additive).
GRANT SELECT
  (id, assessment_id, user_id, material_id, format, subtype, prompt, options,
   skill_tags, authored_difficulty, citations, created_at, language,
   starter_code, visible_tests)
  ON public.questions TO authenticated;

-- (c) Accept the coding row: 028's body plus the three coding columns.
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
     skill_tags, authored_difficulty, citations, answer_block, language,
     starter_code, visible_tests)
  VALUES
    (p_question->>'id', v_assessment_id, (p_question->>'user_id')::uuid,
     p_question->>'material_id', p_question->>'format', p_question->>'subtype',
     p_question->>'prompt', p_question->'options', p_question->'skill_tags',
     (p_question->>'authored_difficulty')::int,
     p_question->'citations', p_question->'answer_block',
     p_question->>'language', p_question->>'starter_code',
     p_question->'visible_tests');

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

-- (d) Coding attempts enqueue on the same path: the format gate widens from
--     IN ('objective','written') to IN ('objective','written','coding'); the
--     grading job row, the queue message, and the idempotent replay are
--     unchanged. 027 is still the latest submit body (grep confirms).
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

  IF v_question.format NOT IN ('objective', 'written', 'coding') THEN
    RAISE EXCEPTION 'only objective, written and coding questions grade in this slice'
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

-- (e) Code-bearing material signal. NULL = unknown (D-10: no backfill).
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS has_code BOOLEAN,
  ADD COLUMN IF NOT EXISTS code_languages JSONB;

COMMENT ON COLUMN public.materials.has_code IS
  'Code-bearing signal derived at ingestion from fenced code blocks; NULL when not yet derived (pre-existing materials).';
COMMENT ON COLUMN public.materials.code_languages IS
  'Fenced code block languages found at ingestion, e.g. ["python", "sql"]; NULL when not yet derived.';

-- 008's guard lists the server-owned columns explicitly; has_code and
-- code_languages are server-derived too, so extend the list (the 030 pattern).
CREATE OR REPLACE FUNCTION public.guard_server_owned_material_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF NEW.chunk_count IS DISTINCT FROM OLD.chunk_count
       OR NEW.grounding_version IS DISTINCT FROM OLD.grounding_version
       OR NEW.extracted_text_path IS DISTINCT FROM OLD.extracted_text_path
       OR NEW.upload_complete_at IS DISTINCT FROM OLD.upload_complete_at
       OR NEW.outline IS DISTINCT FROM OLD.outline
       OR NEW.page_count IS DISTINCT FROM OLD.page_count
       OR NEW.page_offset IS DISTINCT FROM OLD.page_offset
       OR NEW.has_code IS DISTINCT FROM OLD.has_code
       OR NEW.code_languages IS DISTINCT FROM OLD.code_languages THEN
      RAISE EXCEPTION 'server-owned material columns cannot be updated'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materials_guard_server_owned_columns ON public.materials;

CREATE TRIGGER materials_guard_server_owned_columns
  BEFORE UPDATE OF chunk_count, grounding_version, extracted_text_path, upload_complete_at, outline, page_count, page_offset, has_code, code_languages
  ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_server_owned_material_columns();