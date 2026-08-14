# Project Rules Index

Use this index to select repository-specific guidance before planning, editing, reviewing, debugging, or verifying work.
Read each selected rule file completely.

## Workflow

1. Read `AGENTS.md` and `.work/STATUS.md` first.
2. Select every rule whose trigger matches the task.
3. Read the selected files before making decisions or changes.
4. Check the rule against the live code when implementation details may have changed.
5. Flag stale guidance and update it with `$add-project-rule` instead of silently working around it.

## Application and Runtime

| Rule | Read when |
|---|---|
| [`10-runtime-and-e2e.agents.md`](10-runtime-and-e2e.agents.md) | Starting services, running Playwright, diagnosing browser failures, or changing Playwright configuration. |
| [`11-playwright-selectors.agents.md`](11-playwright-selectors.agents.md) | Writing or reviewing Playwright locators, especially against Astro dev mode. |
| [`12-react-router-basename.agents.md`](12-react-router-basename.agents.md) | Adding routes, links, redirects, navigation, or route assertions. |
| [`13-form-layout.agents.md`](13-form-layout.agents.md) | Building or reviewing forms and field-group spacing. |
| [`14-design-token-package-exports.agents.md`](14-design-token-package-exports.agents.md) | Changing shared CSS exports or imports from the design-token package. |
| [`15-browser-use-cli.agents.md`](15-browser-use-cli.agents.md) | Using the browser-use CLI and its dedicated WSL automation Chromium, including the browser start and stop lifecycle. |
| [`16-live-e2e-authoring.agents.md`](16-live-e2e-authoring.agents.md) | Writing live E2E specs against the real stack: skip scoping, ready-state assertions, locator scope, and shared-account cleanup. |

## Auth, Storage, and Sync

| Rule | Read when |
|---|---|
| [`20-auth-boundaries.agents.md`](20-auth-boundaries.agents.md) | Changing authentication behavior, providers, guards, or Supabase auth calls. |
| [`21-auth-testing.agents.md`](21-auth-testing.agents.md) | Testing auth logic or provider behavior. |
| [`22-fetch-error-normalization.agents.md`](22-fetch-error-normalization.agents.md) | Changing fetch clients, timeouts, retries, or typed service errors. |
| [`30-eventstore-boundaries.agents.md`](30-eventstore-boundaries.agents.md) | Changing event persistence, event shapes, user switching, or local database ownership. |
| [`31-dexie-schema-migrations.agents.md`](31-dexie-schema-migrations.agents.md) | Adding, removing, or changing Dexie tables or indexes. |
| [`32-dexie-testing.agents.md`](32-dexie-testing.agents.md) | Writing tests that use Dexie or IndexedDB. |
| [`33-sync-boundaries.agents.md`](33-sync-boundaries.agents.md) | Changing local-to-cloud sync, snapshots, retry, or restore behavior. |
| [`34-sync-provider-testing.agents.md`](34-sync-provider-testing.agents.md) | Testing providers that own engines and browser lifecycle listeners. |
| [`35-supabase-migrations-and-rls.agents.md`](35-supabase-migrations-and-rls.agents.md) | Changing Supabase tables, storage, policies, or sync contracts. |
| [`36-supabase-live-stack.agents.md`](36-supabase-live-stack.agents.md) | Pushing migrations or probing the hosted Supabase project: CLI credentials, PostgREST bulk syntax, storage paths, pgmq signatures, and embedding dimensions. |

## Product Engines and Flows

| Rule | Read when |
|---|---|
| [`40-onboarding-flow.agents.md`](40-onboarding-flow.agents.md) | Changing onboarding, roadmap creation, booking generation, or re-entrant setup. |
| [`41-roadmap-engine.agents.md`](41-roadmap-engine.agents.md) | Changing roadmap or booking algorithms, public engine types, or cross-language parity. |

## Build and Local Infrastructure

| Rule | Read when |
|---|---|
| [`50-pnpm-build-registry.agents.md`](50-pnpm-build-registry.agents.md) | Running a build when Corepack cannot reach the public npm registry. |
| [`51-docker-runtime.agents.md`](51-docker-runtime.agents.md) | Running the containerized full stack with the `docker-app` launcher or Docker Compose. |
| [`52-github-cli-and-token.agents.md`](52-github-cli-and-token.agents.md) | Running any `gh` command, using the gitignored token, or diagnosing transient `api.github.com` TLS/EOF failures. |
| [`53-wsl-dev-runtime.agents.md`](53-wsl-dev-runtime.agents.md) | Handling stale Vite code on `/mnt/d`, env-file loading into dev processes, and background process or `pkill` safety. |

## Reports and Papers

| Rule | Read when |
|---|---|
| [`60-latex-report-build.agents.md`](60-latex-report-build.agents.md) | Editing or compiling dissertation reports. |
| [`61-tikz-flow-diagrams.agents.md`](61-tikz-flow-diagrams.agents.md) | Creating or revising report architecture and flow diagrams. |
| [`70-ieee-conference-class.agents.md`](70-ieee-conference-class.agents.md) | Configuring or reviewing the IEEE conference document class and preamble. |
| [`71-ieee-conference-authoring.agents.md`](71-ieee-conference-authoring.agents.md) | Editing the IEEE title, authors, abstract, sections, or appendices. |
| [`72-ieee-conference-equations.agents.md`](72-ieee-conference-equations.agents.md) | Adding or reviewing equations in the IEEE paper. |
| [`73-ieee-conference-floats-and-citations.agents.md`](73-ieee-conference-floats-and-citations.agents.md) | Adding or reviewing figures, tables, algorithms, citations, or references in the IEEE paper. |

## Maintenance Conventions

- Use the `NN-topic.agents.md` filename pattern with two-digit ordering.
- Keep each rule focused on one stable topic.
- Write direct, repository-specific instructions and durable pitfalls.
- Point to live code or canonical documentation instead of copying volatile architecture snapshots.
- Keep each full sentence on its own physical line.
- Update this index in the same change whenever a rule is added, renamed, split, removed, or materially repurposed.
- Check changed files for em dash and en dash characters before finishing.
