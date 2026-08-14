-- =============================================================================
-- 006: fix ingestion_poll for the hosted pgmq read signature
-- =============================================================================
--
-- The hosted pgmq extension exposes read(queue_name, vt, qty, conditional)
-- with no two-argument overload, so the security-definer wrapper shipped in
-- 005 failed at runtime (function pgmq.read(text, integer) does not exist).
-- Replace the wrapper with the three-argument contract the worker uses:
-- read_ct surfaced for bounded redelivery and p_qty for bounded in-flight
-- work (backpressure). The worker configures p_qty through the
-- INGESTION_MAX_IN_FLIGHT env knob (default 1).

CREATE OR REPLACE FUNCTION public.ingestion_poll(p_queue TEXT, p_vt INTEGER DEFAULT 30, p_qty INTEGER DEFAULT 1)
RETURNS TABLE(msg_id BIGINT, read_ct INTEGER, payload JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
    SELECT r.msg_id, r.read_ct, r.message::jsonb
    FROM pgmq.read(p_queue, p_vt, p_qty, NULL) AS r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingestion_poll(TEXT, INTEGER, INTEGER) TO service_role;
