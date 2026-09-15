-- =============================================================================
-- 029: page provenance on content_chunks + page-bounded hybrid retrieval (#62)
-- =============================================================================
--
-- Phase 2 of #62 (scoped question generation) gives every chunk the 1-based
-- page range it was extracted from and lets retrieval filter on a range, so a
-- chapter or a typed page range can ground generation in exactly those chunks.
--
-- (a) `content_chunks.page_start` / `page_end` - NULL for sources without pages
--     (url / manual / youtube). Two columns because a chunk straddles a page
--     boundary: page_start is the page of its first part, page_end of its last.
-- (b) `match_content_chunks` gains nullable page bounds, applied inside both
--     the dense and the lexical CTE, and returns the two page columns.
--
-- The function body below is migration 016's **verbatim** (the latest
-- definition: k=60, dense 1.0, lexical 0.7, BM25 pool 25) plus the two range
-- predicates and the two returned columns. 027 already broke this repo by
-- re-creating a function from a stale body, and a function body is only parsed
-- on first execution - so nothing here is retyped from memory.
--
-- Range semantics: a chunk matches when [page_start, page_end] *overlaps* the
-- requested range. Containment would drop the chunk carrying the section's
-- opening text across a straddling boundary - the one chunk a scoped question
-- most needs. A chunk with NULL pages never matches a non-NULL range, so a page
-- scope on a pageless material returns nothing rather than everything.
--
-- The 4-arg hybrid overload (016) is dropped rather than kept side by side: the
-- new 6-arg signature defaults both page bounds, so every existing
-- 4-named-argument caller (app/generation/context.py, app/routers/retrieval.py,
-- scripts/retrieval_probe.py, scripts/diagnose_generation_context.py) resolves
-- to it unambiguously. The legacy 3-arg overload (005) is left untouched.
-- CREATE OR REPLACE cannot change a function's parameters or return type, which
-- is why the DROP comes first; both run in the migration's transaction.
--
-- Verification: rule 36 (supabase db push --dry-run first, then push); then a
-- live re-ingest asserting 754/754 chunks carry pages within 1..572, and a
-- page-bounded RPC call whose hits all overlap the requested range.

ALTER TABLE public.content_chunks
  ADD COLUMN IF NOT EXISTS page_start INTEGER;

ALTER TABLE public.content_chunks
  ADD COLUMN IF NOT EXISTS page_end INTEGER;

DROP FUNCTION IF EXISTS public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.match_content_chunks(
  query_embedding halfvec(768),
  match_material_id TEXT,
  top_k INTEGER DEFAULT 10,
  query_text TEXT DEFAULT NULL,
  p_page_start INTEGER DEFAULT NULL,
  p_page_end INTEGER DEFAULT NULL
)
RETURNS TABLE(
  chunk_id TEXT,
  material_id TEXT,
  chunk_text TEXT,
  ordinal INTEGER,
  start_seconds DOUBLE PRECISION,
  similarity DOUBLE PRECISION,
  page_start INTEGER,
  page_end INTEGER
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
           c.page_start,
           c.page_end,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank
    FROM public.content_chunks c
    WHERE c.material_id = match_material_id
      AND c.embedding IS NOT NULL
      AND (p_page_start IS NULL OR c.page_end >= p_page_start)
      AND (p_page_end IS NULL OR c.page_start <= p_page_end)
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
           c.page_start,
           c.page_end,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text)) DESC
           ) AS rank
    FROM public.content_chunks c
    WHERE c.material_id = match_material_id
      AND c.embedding IS NOT NULL
      AND c.search_vector @@ plainto_tsquery('english', query_text)
      AND (p_page_start IS NULL OR c.page_end >= p_page_start)
      AND (p_page_end IS NULL OR c.page_start <= p_page_end)
    ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text)) DESC
    LIMIT 25
  ),
  fused AS (
    SELECT chunk_id, material_id, chunk_text, ordinal, start_seconds,
           similarity, page_start, page_end,
           ROW_NUMBER() OVER (ORDER BY rrf_score DESC) AS fused_rank
    FROM (
      SELECT d.chunk_id, d.material_id, d.chunk_text, d.ordinal, d.start_seconds,
             d.similarity, d.page_start, d.page_end,
             1.0 / (60 + d.rank) AS rrf_score
      FROM dense d
      UNION ALL
      SELECT l.chunk_id, l.material_id, l.chunk_text, l.ordinal, l.start_seconds,
             l.similarity, l.page_start, l.page_end,
             0.7 / (60 + l.rank) AS rrf_score
      FROM lexical l
    ) unioned
  )
  SELECT chunk_id, material_id, chunk_text, ordinal, start_seconds, similarity,
         page_start, page_end
  FROM fused
  ORDER BY fused_rank
  LIMIT LEAST(GREATEST(top_k, 1), 50);
$$;

REVOKE ALL ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_content_chunks(halfvec, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO service_role;

-- P3 note: the plan places `materials.outline/page_count/page_offset` in this
-- file. Do that only while this migration is still unpushed; once 029 has been
-- applied, a changed file is never re-run and P3's live check reads nothing.
