-- =============================================================================
-- 011: bulk chunk embedding write (worker embedding stage)
-- =============================================================================
--
-- Review finding (2026-08-14): the worker PATCHed one chunk row per embedding,
-- which is ~100 REST round trips per material. PostgREST cannot bulk-patch
-- different values per row, so the embedding stage writes a whole batch
-- through this server-side RPC. Every row is guarded on p_material_id so a
-- misbehaving caller cannot overwrite another material's chunks.
--
-- The embedding value arrives as a halfvec literal string ("[0.1,0.2,...]")
-- produced by the worker's normalized-embedding serializer.

CREATE OR REPLACE FUNCTION public.ingestion_update_chunk_embeddings(
  p_material_id TEXT,
  p_chunks JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chunk JSONB;
BEGIN
  IF jsonb_typeof(p_chunks) <> 'array' THEN
    RAISE EXCEPTION 'p_chunks must be a jsonb array' USING ERRCODE = 'P0002';
  END IF;

  FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
  LOOP
    UPDATE public.content_chunks
       SET embedding = (v_chunk->>'embedding')::halfvec
     WHERE id = v_chunk->>'chunkId'
       AND material_id = p_material_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ingestion_update_chunk_embeddings(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingestion_update_chunk_embeddings(TEXT, JSONB) TO service_role;
