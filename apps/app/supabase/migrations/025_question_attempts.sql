-- =============================================================================
-- 025: question_attempts (#39 assessment taking and objective grading)
-- =============================================================================
--
-- Issue #39: the server-owned attempt record. The learner's answer lives here
-- (never in the event log — QuestionAttempted is answer-free by contract),
-- grading compares it against questions.answer_block under service_role, and
-- the public grade is written back onto the attempt row.
--
-- Style follows 018: TEXT ids from the service, owner RLS by auth.uid(),
-- column-grant discipline, pgmq queue via the generic wrappers, and a
-- DB-atomic submit RPC that mirrors enqueue_assessment_generation.

-- (a) Attempts: owner-scoped rows; the answer is learner input, not a key.
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id TEXT PRIMARY KEY,
  client_attempt_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'graded', 'failed')),
  elapsed_seconds INTEGER,
  correlation_id TEXT NOT NULL,
  grade JSONB,
  job_id TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  CONSTRAINT question_attempts_client_attempt_unique UNIQUE (user_id, client_attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_question_attempts_assessment
  ON public.question_attempts(assessment_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question
  ON public.question_attempts(question_id, submitted_at);

ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own attempts" ON public.question_attempts;
CREATE POLICY "Users can read own attempts"
  ON public.question_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own attempts" ON public.question_attempts;
CREATE POLICY "Users can create own attempts"
  ON public.question_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No authenticated UPDATE/DELETE: grades land only through the service path.
GRANT SELECT, INSERT ON public.question_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_attempts TO service_role;

-- (b) pgmq queue for grading (generic wrappers; arm joins the shared worker).
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.create('assessment_grade');
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;

-- (c) DB-atomic submit RPC: verify ownership, dedupe on client_attempt_id
--     (idempotency: a replay returns the existing attempt), insert the
--     grading job, and send the queue message in one transaction. Pattern:
--     enqueue_assessment_generation (018).
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
  SELECT q.user_id, q.format, q.assessment_id
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

-- (d) DB-atomic grading completion: attempt status/grade + job success in one
--     transaction, so a crash cannot split them (pattern: 023 completion RPC).
--     Called by the grading worker with the service role only.
CREATE OR REPLACE FUNCTION public.complete_attempt_grading(
  p_attempt_id TEXT,
  p_job_id TEXT,
  p_status TEXT,
  p_grade JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('graded', 'failed') THEN
    RAISE EXCEPTION 'invalid attempt completion status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.question_attempts
  SET status = p_status, grade = p_grade, graded_at = now()
  WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.ingestion_jobs
  SET status = 'succeeded', completed_at = now()
  WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_attempt_grading(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
-- service_role only: the worker calls this with its own key, never a user token.
GRANT EXECUTE ON FUNCTION public.complete_attempt_grading(TEXT, TEXT, TEXT, JSONB) TO service_role;
