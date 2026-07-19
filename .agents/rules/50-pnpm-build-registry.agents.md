---
name: pnpm-build-registry
description: Route Corepack through the configured registry when public pnpm resolution fails on this machine.
---

# pnpm Build Registry

Run the normal repository build first unless the current environment is already known to block the public npm registry.
If Corepack fails while resolving pnpm from `registry.npmjs.org`, inspect the configured npm registry:

```bash
npm config get registry
```

Then pass that registry to Corepack for the build:

```bash
configured_registry="$(npm config get registry)"
env COREPACK_NPM_REGISTRY="$configured_registry" pnpm build
```

Do not disable TLS verification or rewrite the lockfile to solve registry reachability.
Do not hard-code a machine-specific registry into application package metadata.

Verify that both `apps/marketing/dist/` and `apps/app/dist/` are produced.
Treat the Vite large-chunk notice as a warning unless the command exits nonzero or the changed code materially worsens the bundle.
