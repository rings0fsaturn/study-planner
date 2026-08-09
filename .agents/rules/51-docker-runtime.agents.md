---
name: docker-runtime
description: Use the docker-app lifecycle launcher and safe Docker Compose practices for the containerized full stack.
---

# Docker Runtime

Use `./docker-app` from the repository root for all containerized full-stack
lifecycle work: `start`, `stop`, `restart`, `status`, `logs`, and `config`.
The launcher resolves the env file (`--env-file PATH`, else `apps/app/.env.local`,
else `.env`) and delegates to `docker compose`.
`docker compose` remains available as the lower-level fallback.

Inspect `docker info`, `docker compose version`, and `./docker-app status` before
restarting or stopping containers.
Do not stop containers or kill port listeners until the owning process has been
identified.
The lifecycle manager `./full-app` manages local development processes only; do
not use it for Docker work.

If a published port is unreachable, verify the service inside the container
(`docker compose exec -T intelligence ...`) before changing application code.

Use public registries for all base images by default.
Keep corporate mirrors or private CA bundles as operator-local overrides: never
commit them, bake them into an image layer, or make disabled TLS verification the
default.
Override build args such as `PYTHON_IMAGE` and `UV_IMAGE` in the shell only.

Do not commit credentials.
The compose env file holds `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the
optional HS256-only `SUPABASE_JWT_SECRET`; `.dockerignore` keeps `.env*` out of
image layers.

Verify the image build, container health, web endpoints (`/`, `/study/sign-in`),
service `/health`, the `/api/v1/` proxy, and host port access after container
changes.
