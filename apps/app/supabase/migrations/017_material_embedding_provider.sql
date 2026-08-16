-- Migration 017: material embedding provider marker
--
-- Records which embedding model produced a material's chunk vectors, so the
-- worker can refuse to mix vectors from different models in one material
-- (they do not share an embedding space) and an operator can see which
-- provider a material was last embedded with. Written by the ingestion
-- worker at embed-stage start; read by the mixing guard and by the
-- reembed_materials.py script. Legacy rows stay NULL until they are embedded
-- or re-embedded by a provider-aware worker.

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS embedding_provider TEXT
  CHECK (
    embedding_provider IS NULL
    OR embedding_provider IN ('gemini', 'qwen-sidecar')
  );

COMMENT ON COLUMN public.materials.embedding_provider IS
  'Embedding provider that produced this material''s chunk vectors (NULL until first embed; mixing providers on one material is refused by the worker)';
