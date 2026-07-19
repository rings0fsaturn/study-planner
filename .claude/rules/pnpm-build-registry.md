---
name: pnpm-build-registry
description: Build this workspace with Corepack pointed at the configured internal npm registry
---

# pnpm Build Registry

## Problem

Running a plain build on this machine can fail before the project build starts:

```bash
pnpm build
```

Corepack tries to resolve `pnpm/latest` from the public npm registry and fails
with either DNS or HTTP 403 errors:

```text
Error when performing the request to https://registry.npmjs.org/pnpm/latest
Server answered with HTTP 403 when performing the request to https://registry.npmjs.org/pnpm/latest
```

The root `package.json` currently does not pin a `packageManager`, so Corepack
falls back to resolving the latest pnpm release before it can run workspace
scripts.

## Rule

**Use the machine's configured internal npm registry for Corepack before running
the build.**

First confirm the registry if needed:

```bash
npm config get registry
```

On this machine the registry is:

```text
https://registry.npmjs.org/
```

Run the build with `COREPACK_NPM_REGISTRY` set:

```bash
env COREPACK_NPM_REGISTRY=https://registry.npmjs.org pnpm build
```

This lets Corepack download pnpm from the internal Artifactory-backed registry
and then run the normal root build script:

```bash
pnpm -r run build
```

## Expected Output

A successful build compiles both deployable apps:

| Workspace | Build output |
|---|---|
| `apps/marketing` | `apps/marketing/dist/` |
| `apps/app` | `apps/app/dist/` |

The app build may warn that a Vite chunk is larger than 500 kB after
minification. That warning does not fail the build.

## When to Apply

- Building this repo on this machine with `pnpm build`
- Seeing Corepack errors for `https://registry.npmjs.org/pnpm/latest`
- Seeing Corepack DNS failures such as `getaddrinfo ENOTFOUND registry.npmjs.org`
- Seeing Corepack HTTP 403 responses from the public npm registry
