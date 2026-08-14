-- =============================================================================
-- 008: enforce server-owned column protection with a BEFORE UPDATE guard
-- =============================================================================
--
-- 007's column-level REVOKE turned out to be ineffective against Supabase's
-- table-level UPDATE grants for anon/authenticated (the column grant remained,
-- verified live: PATCH chunk_count as the dev user still returned 204).
-- A BEFORE UPDATE trigger is the reliable enforcement: it rejects changes to
-- server-owned columns unless the writer runs as a server role (service_role)
-- or a SECURITY DEFINER function (complete_material_upload, the worker RPCs).

CREATE OR REPLACE FUNCTION public.guard_server_owned_material_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF NEW.chunk_count IS DISTINCT FROM OLD.chunk_count
       OR NEW.grounding_version IS DISTINCT FROM OLD.grounding_version
       OR NEW.extracted_text_path IS DISTINCT FROM OLD.extracted_text_path
       OR NEW.upload_complete_at IS DISTINCT FROM OLD.upload_complete_at THEN
      RAISE EXCEPTION 'server-owned material columns cannot be updated'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materials_guard_server_owned_columns ON public.materials;

CREATE TRIGGER materials_guard_server_owned_columns
  BEFORE UPDATE OF chunk_count, grounding_version, extracted_text_path, upload_complete_at
  ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_server_owned_material_columns();
