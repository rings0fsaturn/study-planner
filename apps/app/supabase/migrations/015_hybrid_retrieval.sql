-- =============================================================================
-- 015: hybrid BM25 + dense retrieval for content chunks
-- =============================================================================
--
-- Phase 1 of the retrieval-quality program: adds full-text search over chunk
-- text and fuses BM25 ranks with the existing vector cosine ranks using
-- Reciprocal Rank Fusion (RRF).
--
-- Public RPC signature (backward compatible):
--
--     match_content_chunks(query_embedding halfvec(768),
--                           match_material_id TEXT,
--                           top_k INTEGER DEFAULT 10,
--                           query_text TEXT DEFAULT NULL)
--
-- When query_text is NULL or empty the RPC behaves exactly as before
-- (dense-only, cosine over halfvec(768), capped at 50). When query_text is
-- supplied, a lexical branch ranks the same material's chunks by
-- ts_rank_cd over a generated tsvector, and the dense + lexical candidate
-- sets (each capped at 50) are fused with RRF (k = 60).
--
-- NOTE: the initial equal-weight RRF (dense 1.0 / lexical 1.0) regressed
-- recall@1 on the 30-question probe; migration 016 redefines the function
-- with the swept weights (k=60, dense 1.0, lexical 0.7, pool 25).
--
-- FTS setup:
--   - Generated tsvector column on content_chunks.text (english config).
--   - GIN index for fast per-material tsquery scans.
--   - Partial index scoped to non-null embeddings so the lexical branch never
--     ranks chunks that have no vector (keeps hybrid results embeddable).
--
-- RRF formula: score(chunk) = SUM over each ranked list of 1 / (k + rank),
-- where rank is the 1-based position in that list (dense or BM25).

ALTER TABLE public.content_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;

CREATE INDEX IF NOT EXISTS idx_content_chunks_search_vector
  ON public.content_chunks USING gin (search_vector)
  WHERE embedding IS NOT NULL;

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
    LIMIT 50
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
             1.0 / (60 + l.rank) AS rrf_score
      FROM lexical l
    ) unioned
  )
  SELECT chunk_id, material_id, chunk_text, ordinal, start_seconds, similarity
  FROM fused
  ORDER BY fused_rank
  LIMIT LEAST(GREATEST(top_k, 1), 50);
$$;

-- Re-grant after the rewrite (replace drops nothing, but keep grants explicit).
REVOKE ALL ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT) TO service_role;
