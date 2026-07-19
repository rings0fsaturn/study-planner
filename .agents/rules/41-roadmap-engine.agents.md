---
name: roadmap-engine
description: Keep roadmap and booking algorithms deterministic, pure, package-owned, and aligned across language implementations.
---

# Roadmap Engine

Put reusable roadmap and booking logic in `packages/roadmap-engine/` instead of pages, hooks, or UI components.
Keep public engine functions deterministic and free of browser, network, clock, and framework side effects.
Pass dates, configuration, and randomness explicitly when an algorithm needs them.

Preserve public input and output contracts or provide backward-compatible adapters.
Keep pinned user decisions and stable roadmap identity intact across replanning.
Use property tests for invariants and focused examples for boundary behavior.

Check `packages/py-roadmap-engine/` whenever shared engine behavior changes.
Update TypeScript and Python parity tests when the same contract exists in both stacks.
Update `design/algo/ROADMAP_ENGINE_GUIDE.md` when public algorithm behavior or guarantees change.
