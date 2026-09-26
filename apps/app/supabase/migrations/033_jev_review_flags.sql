-- =============================================================================
-- 033: jev_review_flags (#77 slice-4 rubric disagreement queue)
-- =============================================================================
--
-- Issue #77 graduates the slice-4 rubric shadow (#73) into a human-review
-- queue. The grading worker maps its per-criterion Jev scores through
-- RUBRIC_THRESHOLDS (app/jev/measure.py::map_scores) and, when
-- JEV_SLICE4_FLAGS is on, writes one row per flagged criterion here.
--
-- Contract (rule 42): the queue is advisory. The server grade stays
-- authoritative and is never modified by this path; nothing reads this table
-- from the browser, so no rubric-shaped content ships to the client. The row
-- carries a truncated answer excerpt for reviewer context only - the answer
-- itself lives on question_attempts, and no excerpt reaches a log line.
--
-- Style follows 018/025: TEXT ids from the service, owner RLS by auth.uid() on
-- both predicates, service_role for the worker write.
--
-- Access posture, verified live 2026-09-26: this table carries the Supabase
-- default privileges (anon and authenticated hold SELECT/INSERT/UPDATE/DELETE
-- at the table level, exactly as assessments and question_attempts do). RLS is
-- therefore the sole gate for those roles, which is why the two policies below
-- must stay owner-scoped - the predicates are the security boundary, not the
-- GRANT list. Do not "harden" this by revoking the defaults without migrating
-- every table in the same change; a per-table divergence is worse than a
-- uniform default plus a proven policy.
--
-- There is no owner-facing review surface yet, so no authenticated read path is
-- documented; the worker (service_role) is the only writer.

CREATE TABLE IF NOT EXISTS public.jev_review_flags (
  id TEXT PRIMARY KEY,
  owner UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL REFERENCES public.question_attempts(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  jev_score NUMERIC(5, 4) NOT NULL,
  server_met BOOLEAN NOT NULL,
  answer_excerpt TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviewer read order: newest flags first, per owner.
CREATE INDEX IF NOT EXISTS idx_jev_review_flags_owner_created
  ON public.jev_review_flags(owner, created_at DESC);

-- One row per (attempt, criterion): a redelivered grading message cannot
-- duplicate a flag. The worker inserts per flagged criterion, so this makes
-- the best-effort write idempotent without a client-side check.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_review_flags_attempt_criterion
  ON public.jev_review_flags(attempt_id, criterion);

ALTER TABLE public.jev_review_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own review flags" ON public.jev_review_flags;
CREATE POLICY "Users can read own review flags"
  ON public.jev_review_flags FOR SELECT
  USING (auth.uid() = owner);

DROP POLICY IF EXISTS "Users can create own review flags" ON public.jev_review_flags;
CREATE POLICY "Users can create own review flags"
  ON public.jev_review_flags FOR INSERT
  WITH CHECK (auth.uid() = owner);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jev_review_flags TO service_role;

-- Verification (rule 35/36): the worker's service-role write succeeds, and a
-- cross-owner authenticated read returns nothing. See plan/VERIFICATION.md.
