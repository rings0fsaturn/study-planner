-- =============================================================================
-- 006: fix ingestion_poll for the hosted pgmq read signature
-- =============================================================================
--
-- The hosted pgmq extension exposes read(queue_name, vt, qty, conditional)
-- with no two-argument overload, so the security-definer wrapper shipped in
-- 005 failed at runtime (function pgmq.read(text, integer) does not exist).
-- Replace the wrapper with the same two-argument contract the worker uses:
-- one message per poll with read_ct surfaced for bounded redelivery.
-- NOTE: the bounded in-flight quantity parameter ships as a fix-forward
-- migration (013); this file is already applied on the remote and must not
-- be edited again.

CREATE OR REPLACE FUNCTION public.ingestion_poll(p_queue TEXT, p_vt INTEGER DEFAULT 30)
RETURNS TABLE(msg_id BIGINT, read_ct INTEGER, payload JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
    SELECT r.msg_id, r.read_ct, r.message::jsonb
    FROM pgmq.read(p_queue, p_vt, 1, NULL) AS r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingestion_poll(TEXT, INTEGER) TO service_role;
