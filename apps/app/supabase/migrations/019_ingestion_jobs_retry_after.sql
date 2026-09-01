-- =============================================================================
-- 019: retry_after_seconds on ingestion_jobs (issue #38 D-06)
-- =============================================================================
--
-- Generation-kind jobs carry a provider retry hint (quota/timeout). The
-- AsyncJob error envelope exposes retryAfterSeconds, so the value is
-- persisted on the row and surfaced by the job serialization.

ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS retry_after_seconds INTEGER
    CHECK (retry_after_seconds >= 1);