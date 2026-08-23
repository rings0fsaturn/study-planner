-- =============================================================================
-- 022: questions column-level grants without table-level leak (issue #38)
-- =============================================================================
--
-- Supabase default privileges grant authenticated table-level SELECT on new
-- public tables, which makes the migration-018 column grant ineffective: the
-- table-level privilege outranks the column list. Revoke table-level access
-- and keep only the explicit public-column grant; answer_block then stays
-- service_role-only (verified live).

REVOKE ALL ON public.questions FROM anon, authenticated;
GRANT SELECT
  (id, assessment_id, user_id, material_id, format, prompt, options,
   skill_tags, authored_difficulty, citations, created_at)
  ON public.questions TO authenticated;