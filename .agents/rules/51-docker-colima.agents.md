---
name: docker-colima
description: Use safe Docker, Buildx, Colima, and public registry practices for the Intelligence Service.
---

# Docker and Colima

Read `services/intelligence/README.md` before changing the service container workflow.
Inspect `docker info`, `docker ps`, and `colima status` before restarting infrastructure.
Do not stop Colima or kill port forwards until unrelated containers and listeners have been identified.

Use public registries for all base images by default.
Keep corporate mirrors or private CA bundles as operator-local overrides: never commit them, bake them into an image layer, or make disabled TLS verification the default.

If a published port is unreachable from macOS, verify the service inside the container and then inside the Colima VM before changing application code.
Keep Docker Compose secrets and the Dockerfile's BuildKit secret contract aligned.

Verify the image build, container health, authenticated service endpoint behavior, and host port access after container changes.
