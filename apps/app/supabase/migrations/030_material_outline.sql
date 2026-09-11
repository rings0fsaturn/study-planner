-- =============================================================================
-- 030: Material outline (Phase 2 ticket #62, P3)
-- =============================================================================
--
-- P3 derives the material's chapter list at ingestion (deterministic contents
-- page parse, page offset measured from the body running headers) and stores
-- it here so the assessment config can offer a chapter as a page range (P4).
--
-- 029 is already applied on the dev project and an applied migration never
-- re-runs, so these columns ship as their own migration.
--
-- `outline` is the server-derived chapter list:
--   {"entries": [{"title": "Chapter 5 Budgeting and control", "page": 156}], "source": "contents"}
-- `page` is a PDF page number (the same numbering as content_chunks.page_start
-- and the viewer), not the number printed on the page; `page_offset` keeps the
-- printed -> PDF conversion that produced it.

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS outline JSONB,
  ADD COLUMN IF NOT EXISTS page_count INTEGER
    CHECK (page_count IS NULL OR page_count >= 1),
  ADD COLUMN IF NOT EXISTS page_offset INTEGER;

COMMENT ON COLUMN public.materials.outline IS
  'Chapter list derived at ingestion: {"entries": [{"title", "page"}], "source"}; `page` is a PDF page number.';
COMMENT ON COLUMN public.materials.page_count IS
  'PDF page count for page-bearing sources; NULL for url/manual/youtube materials.';
COMMENT ON COLUMN public.materials.page_offset IS
  'printed_page - pdf_page, measured from the running headers; NULL when not derivable.';

-- 008's guard lists the server-owned columns explicitly. The outline is
-- server-derived too, so extend the list (the worker and the RPCs write it as
-- service_role and pass the current_user check; a client token cannot).
CREATE OR REPLACE FUNCTION public.guard_server_owned_material_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF NEW.chunk_count IS DISTINCT FROM OLD.chunk_count
       OR NEW.grounding_version IS DISTINCT FROM OLD.grounding_version
       OR NEW.extracted_text_path IS DISTINCT FROM OLD.extracted_text_path
       OR NEW.upload_complete_at IS DISTINCT FROM OLD.upload_complete_at
       OR NEW.outline IS DISTINCT FROM OLD.outline
       OR NEW.page_count IS DISTINCT FROM OLD.page_count
       OR NEW.page_offset IS DISTINCT FROM OLD.page_offset THEN
      RAISE EXCEPTION 'server-owned material columns cannot be updated'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materials_guard_server_owned_columns ON public.materials;

CREATE TRIGGER materials_guard_server_owned_columns
  BEFORE UPDATE OF chunk_count, grounding_version, extracted_text_path, upload_complete_at, outline, page_count, page_offset
  ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_server_owned_material_columns();
