---
name: docker-colima-setup
description: Docker Compose, Buildx, Colima, and corporate CA setup for this machine
---

# Docker Colima Setup

## When to Apply

Building/running Docker images, `docker compose`, `docker buildx`, or Colima in this repo
(the only Dockerfile is `services/intelligence/Dockerfile`). Full troubleshooting flow
(baseline checks, Buildx/Compose plugin install, Colima port-forwarding diagnostics) lives in
[`services/intelligence/README.md`](../../services/intelligence/README.md#docker--colima-troubleshooting).

## Baseline checks

```bash
docker info              # Context: colima
docker ps --format '{{.Names}} {{.Ports}}'
colima status
```

Don't stop/restart Colima just because a command is confusing — unrelated containers may be
running (e.g. `wiremock-simulator` on port `9999`; never kill its SSH forward).

## Corporate registry + CA bundle (the reusable pattern)

Public Docker Hub/GHCR pulls fail from Colima with `x509: certificate signed by unknown
authority`. Use the internal mirror (`docker.io/...`) and pass the local CA
bundle as a BuildKit secret instead of committing a certificate:

```bash
docker buildx build \
  # corporate CA bundle secret removed; use public registry \
  --load -f services/intelligence/Dockerfile -t study-tracker-intelligence:phase6 .
```

```dockerfile
RUN uv sync --frozen --package intelligence --no-dev
```

Compose passes the same bundle as a secret (see `docker-compose.yml`). Avoid
`UV_INSECURE_HOST` or disabling TLS verification as the default fix.

## When host curl can't reach a published port

`docker port` can show `0.0.0.0:8000->8000/tcp` while macOS localhost still refuses the
connection. Verify from inside the container, then the Lima VM, before changing app code —
see the full SSH-forward diagnostic chain in `services/intelligence/README.md`.
