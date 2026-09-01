-- =============================================================================
-- 018: assessments + questions (server-owned hidden blocks), generation jobs
-- =============================================================================
--
-- Issue #38 (single grounded objective assessment): assessments and questions
-- tables, the ingestion_jobs uniqueness fix for generation-kind rows, the
-- amended GenerationTelemetry columns, the assessment_generate pgmq queue, and
-- the DB-atomic enqueue RPC that the API calls with only the user token.
--
-- Hidden-content rule: answer_block lives only in questions.answer_block,
-- readable by service_role alone. The browser reads questions through the
-- redacted service API; assessments carries no hidden content.

-- (a) Allow one generation job per (kind, material, attempt) so a second
--     assessment on the same material can carry attempt 1.
ALTER TABLE public.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_material_attempt_unique;
ALTER TABLE public.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_kind_material_attempt_unique
  UNIQUE (kind, material_id, attempt);

-- (b) Assessments: owner-scoped, browser-safe metadata (no hidden content).
CREATE TABLE IF NOT EXISTS public.assessments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  recipe JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'ready', 'partial', 'failed')),
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  grounding_version TEXT,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessments_owner_client_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_user ON public.assessments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_material ON public.assessments(material_id);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own assessments" ON public.assessments;
CREATE POLICY "Users can read own assessments"
  ON public.assessments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own assessments" ON public.assessments;
CREATE POLICY "Users can create own assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO service_role;
GRANT SELECT, INSERT ON public.assessments TO authenticated;

-- (c) Questions: server-owned rows with a hidden answer block.
--     No authenticated INSERT/UPDATE/DELETE; SELECT limited by column grant.
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'objective'
    CHECK (format IN ('objective', 'written', 'coding')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  authored_difficulty INTEGER NOT NULL
    CHECK (authored_difficulty BETWEEN 1 AND 5),
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_block JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment ON public.questions(assessment_id);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own questions" ON public.questions;
CREATE POLICY "Users can read own questions"
  ON public.questions FOR SELECT
  USING (auth.uid() = user_id);

-- Column-level grants: authenticated sees public columns only; the hidden
-- answer_block column is service_role-only (RLS alone cannot hide columns).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO service_role;
GRANT SELECT
  (id, assessment_id, user_id, material_id, format, prompt, options,
   skill_tags, authored_difficulty, citations, created_at)
  ON public.questions TO authenticated;

-- (d) Telemetry: columns required by the amended GenerationTelemetry contract.
ALTER TABLE public.generation_telemetry
  ADD COLUMN IF NOT EXISTS questions_requested INTEGER NOT NULL DEFAULT 0
    CHECK (questions_requested >= 0),
  ADD COLUMN IF NOT EXISTS questions_accepted INTEGER NOT NULL DEFAULT 0
    CHECK (questions_accepted >= 0),
  ADD COLUMN IF NOT EXISTS reasoning_tokens INTEGER
    CHECK (reasoning_tokens >= 0);

-- (e) pgmq queue for assessment generation (reuses the generic wrappers).
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.create('assessment_generate');
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;

-- (f) DB-atomic enqueue RPC: the API holds only the user token and
--     ingestion_jobs has no authenticated INSERT grant. The RPC verifies the
--     caller owns the assessment, inserts the generation job, and sends the
--     queue message in one transaction (pattern: retry_material_ingestion).
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
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'assessment not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ingestion_jobs
    (id, user_id, material_id, kind, status, attempt, correlation_id, result_id)
  VALUES
    (p_job_id, v_user_id, p_material_id, 'generation', 'queued', 1,
     p_correlation_id, p_assessment_id);

  PERFORM pgmq.send('assessment_generate', jsonb_build_object(
    'jobId', p_job_id,
    'assessmentId', p_assessment_id,
    'materialId', p_material_id,
    'correlationId', p_correlation_id
  ));

  RETURN jsonb_build_object(
    'jobId', p_job_id,
    'kind', 'generation',
    'status', 'queued',
    'ownerId', v_user_id,
    'materialId', p_material_id,
    'correlationId', p_correlation_id,
    'resultId', p_assessment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_assessment_generation(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_assessment_generation(TEXT, TEXT, TEXT, TEXT) TO authenticated;