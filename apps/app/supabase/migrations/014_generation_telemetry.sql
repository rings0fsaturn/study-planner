-- =============================================================================
-- 014: generation_telemetry (approved phase-2 GenerationTelemetry contract)
-- =============================================================================
--
-- Telemetry baseline (2026-08-14): the worker now emits one contract-shaped
-- record per pipeline stage and per Gemini batchEmbedContents call, keyed by
-- the ingestion job correlation id (traceId). The table mirrors the approved
-- generation-telemetry.schema.json wire shape plus persistence-only columns
-- (id, material_id, attempt, stage, created_at).
--
-- Server-owned and redacted: RLS is enabled with no policies, so only the
-- service role (which bypasses RLS) can read or write. Browsers never see it.

CREATE TABLE IF NOT EXISTS public.generation_telemetry (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trace_id TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL DEFAULT '',
  attempt INTEGER NOT NULL DEFAULT 1,
  stage TEXT NOT NULL DEFAULT '',
  task TEXT NOT NULL
    CHECK (task IN ('ingestion', 'embedding', 'assessment_generation', 'written_grading', 'guide_hint', 'guide_reveal')),
  model TEXT NOT NULL DEFAULT '',
  prompt_template_version TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL
    CHECK (outcome IN ('ok', 'partial', 'safety_block', 'quota_failure', 'timeout', 'malformed_output', 'provider_error')),
  latency_ms DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  texts_count INTEGER NOT NULL DEFAULT 0 CHECK (texts_count >= 0),
  repair_attempted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_telemetry_owner
  ON public.generation_telemetry(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_telemetry_trace
  ON public.generation_telemetry(trace_id);

ALTER TABLE public.generation_telemetry ENABLE ROW LEVEL SECURITY;

-- No policies: telemetry is server-owned. The service role bypasses RLS.
REVOKE ALL ON public.generation_telemetry FROM anon, authenticated;
GRANT SELECT, INSERT ON public.generation_telemetry TO service_role;
