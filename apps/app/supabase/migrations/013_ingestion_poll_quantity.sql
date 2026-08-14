-- =============================================================================
-- 013: ingestion_poll bounded quantity (backpressure knob)
-- =============================================================================
--
-- Review finding (2026-08-14): the worker now bounds in-flight work through
-- the INGESTION_MAX_IN_FLIGHT env knob, which must reach pgmq as the read
-- quantity. Migration 006 is already applied on the remote with the
-- two-argument signature, so the parameter ships as a fix-forward
-- replacement: the same function name is re-created with p_qty (default 1,
-- preserving the previous behavior for any caller that omits it).

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

REVOKE ALL ON FUNCTION public.ingestion_poll(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingestion_poll(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingestion_poll(TEXT, INTEGER, INTEGER) TO service_role;
