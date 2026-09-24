"""Shared OpenRouter adapter construction (D-07).

The worker arms and the in-request guide router build the same client from
`<prefix>_*` env vars. Extracting the factory here keeps one definition of the
provider identity, retry policy, and per-task budgets (#53).
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger("generation.factory")


def build_openrouter_adapter(prefix: str, schema_name: str):
    """One OpenRouter adapter, configured by `<prefix>_*` env vars.

    The generation arm, the written-grading arm, and the guide tasks use the
    same provider and client; each passes the schema name the provider must
    answer with (`grounded_mcq`, `written_rubric`, or `guide_hint`).
    """
    from app.generation.openrouter_client import OpenRouterGenerationClient

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        logger.warning(
            "OPENROUTER_API_KEY is not set: %s jobs will fail with provider_credentials",
            prefix.lower(),
        )
    return OpenRouterGenerationClient(
        api_key=api_key,
        base_url=os.getenv("GENERATION_BASE_URL", "https://openrouter.ai/api/v1"),
        model=os.getenv(f"{prefix}_MODEL", "deepseek/deepseek-v4-flash-0731"),
        timeout_ms=int(os.getenv(f"{prefix}_TIMEOUT_MS", "30000")),
        max_output_tokens=int(os.getenv(f"{prefix}_MAX_OUTPUT_TOKENS", "4096")),
        temperature=float(os.getenv(f"{prefix}_TEMPERATURE", "0.3")),
        reasoning_effort=os.getenv(f"{prefix}_REASONING_EFFORT", "off"),
        schema_name=schema_name,
    )
