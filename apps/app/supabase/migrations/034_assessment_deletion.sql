-- =============================================================================
-- 034: assessment deletion (owner-scoped enqueue RPC + delete queue)
-- =============================================================================
--
-- The /assessments hub needs an honest exit for failed, stale, or duplicate
-- assessments. Deletion rides a pgmq job rather than a synchronous DELETE
-- because migration 018 grants `authenticated` only SELECT/INSERT on
-- assessments (and no write at all on questions/attempts/flags): the enqueue
-- RPC is owner-checked and the service-role worker performs the delete.
-- Cascades already wipe every dependent (questions 018, question_attempts 025,
-- jev_review_flags 033), so no FK work lands here.
--
-- A second confirm while a deletion is open must answer `conflict`. The partial
-- unique index makes that check a property of the INSERT itself (PostgREST maps
-- the unique violation to 409), so two concurrent confirms cannot race a double
-- delete.

-- (a) ingestion_jobs accepts deletion-kind rows. The kind CHECK predates this
--     list (005); drop-and-readd keeps the live constraint authoritative.
ALTER TABLE public.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_kind_check;
ALTER TABLE public.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_kind_check
  CHECK (kind IN ('ingestion', 'generation', 'grading', 'roadmap_feedback', 'deletion'));

-- (b) At most one open deletion job per assessment.
CREATE UNIQUE INDEX IF NOT EXISTS ingestion_jobs_open_deletion_unique
  ON public.ingestion_jobs (result_id)
  WHERE kind = 'deletion' AND status IN ('queued', 'running');

-- (c) pgmq queue for assessment deletion (reuses the generic wrappers).
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.create('assessment_delete');
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;

-- (d) DB-atomic enqueue RPC: verifies the caller owns the assessment (a
--     cross-owner delete reads as missing, never forbidden), sequences the
--     attempt under the material lock (032 precedent: the read-then-insert
--     must serialize or the (kind, material_id, attempt) uniqueness races),
--     inserts the deletion job, and sends the queue message in one transaction.
CREATE OR REPLACE FUNCTION public.enqueue_assessment_deletion(
  p_assessment_id TEXT,
  p_job_id TEXT,
  p_correlation_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_user_id UUID;
  v_material_id TEXT;
  v_attempt INTEGER;
BEGIN
  SELECT user_id, material_id INTO v_user_id, v_material_id
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'assessment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Serialize read-then-insert per material (released at commit).
  PERFORM pg_advisory_xact_lock(
    hashtext('enqueue_assessment_deletion:' || v_material_id)
  );

  SELECT COALESCE(MAX(attempt), 0) + 1
    INTO v_attempt
    FROM public.ingestion_jobs
   WHERE material_id = v_material_id
     AND kind = 'deletion';

  INSERT INTO public.ingestion_jobs
    (id, user_id, material_id, kind, status, attempt, correlation_id, result_id)
  VALUES
    (p_job_id, v_user_id, v_material_id, 'deletion', 'queued', v_attempt,
     p_correlation_id, p_assessment_id);

  PERFORM pgmq.send('assessment_delete', jsonb_build_object(
    'jobId', p_job_id,
    'assessmentId', p_assessment_id,
    'correlationId', p_correlation_id
  ));

  RETURN jsonb_build_object(
    'id', p_job_id,
    'user_id', v_user_id,
    'material_id', v_material_id,
    'kind', 'deletion',
    'status', 'queued',
    'attempt', v_attempt,
    'correlation_id', p_correlation_id,
    'result_id', p_assessment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_assessment_deletion(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_assessment_deletion(TEXT, TEXT, TEXT) TO authenticated;
