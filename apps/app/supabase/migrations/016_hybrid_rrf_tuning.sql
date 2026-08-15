-- =============================================================================
-- 016: hybrid RRF weight tuning (redefines 015's fused function)
-- =============================================================================
--
-- 015 shipped equal-weight RRF (k=60, dense 1.0, lexical 1.0, pool 50), which
-- on the 30-question probe gained recall@3 (+0.07) but regressed recall@1
-- (0.70 -> 0.67) because noisy lexical candidates displaced strong dense hits.
--
-- Swept k in {30, 60, 100}, lexical weights in {0.5, 0.7, 1.0}, BM25 pools in
-- {25, 50}: the strictly-dominant config is k=60, dense 1.0, lexical 0.7,
-- pool 25 -> recall@1 0.73, recall@3 0.90, MRR 0.816 (all >= dense-only
-- 0.70 / 0.83 / 0.788). Only the function changes; schema objects from 015
-- (search_vector column, GIN index) are unchanged.

CREATE OR REPLACE FUNCTION public.match_content_chunks(
  query_embedding halfvec(768),
  match_material_id TEXT,
  top_k INTEGER DEFAULT 10,
  query_text TEXT DEFAULT NULL
)
RETURNS TABLE(
  chunk_id TEXT,
  material_id TEXT,
  chunk_text TEXT,
  ordinal INTEGER,
  start_seconds DOUBLE PRECISION,
  similarity DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH dense AS (
    SELECT c.id AS chunk_id,
           c.material_id,
           c.text AS chunk_text,
           c.ordinal,
           c.start_seconds,
           1 - (c.embedding <=> query_embedding) AS similarity,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank
    FROM public.content_chunks c
    WHERE c.material_id = match_material_id
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT 50
  ),
  lexical AS (
    SELECT c.id AS chunk_id,
           c.material_id,
           c.text AS chunk_text,
           c.ordinal,
           c.start_seconds,
           ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text)) AS similarity,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text)) DESC
           ) AS rank
    FROM public.content_chunks c
    WHERE c.material_id = match_material_id
      AND c.embedding IS NOT NULL
      AND c.search_vector @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text)) DESC
    LIMIT 25
  ),
  fused AS (
    SELECT chunk_id, material_id, chunk_text, ordinal, start_seconds,
           similarity,
           ROW_NUMBER() OVER (ORDER BY rrf_score DESC) AS fused_rank
    FROM (
      SELECT d.chunk_id, d.material_id, d.chunk_text, d.ordinal, d.start_seconds,
             d.similarity,
             1.0 / (60 + d.rank) AS rrf_score
      FROM dense d
      UNION ALL
      SELECT l.chunk_id, l.material_id, l.chunk_text, l.ordinal, l.start_seconds,
             l.similarity,
             0.7 / (60 + l.rank) AS rrf_score
      FROM lexical l
    ) unioned
  )
  SELECT chunk_id, material_id, chunk_text, ordinal, start_seconds, similarity
  FROM fused
  ORDER BY fused_rank
  LIMIT LEAST(GREATEST(top_k, 1), 50);
$$;

REVOKE ALL ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT) TO service_role;
