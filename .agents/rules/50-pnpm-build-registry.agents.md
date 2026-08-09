---
name: pnpm-build-registry
description: Use the public npm registry by default and route Corepack through an explicit override only when a host blocks it.
---

# pnpm Build Registry

This repository builds against the public npm registry (`registry.npmjs.org`) by default.
No registry is configured in package metadata and none should be hard-coded.

Run the normal repository build:

```bash
pnpm build
```

If a host blocks `registry.npmjs.org` and Corepack fails while resolving pnpm,
inspect the operator-configured npm registry:

```bash
npm config get registry
```

Then pass that registry to Corepack as an explicit operator override:

```bash
configured_registry="$(npm config get registry)"
env COREPACK_NPM_REGISTRY="$configured_registry" pnpm build
```

Do not disable TLS verification or rewrite the lockfile to solve registry reachability.
Do not commit machine-specific registry settings or proxy configuration.

Verify that both `apps/marketing/dist/` and `apps/app/dist/` are produced.
Treat the Vite large-chunk notice as a warning unless the command exits nonzero or the changed code materially worsens the bundle.
