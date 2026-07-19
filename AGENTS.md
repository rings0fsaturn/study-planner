# Study Tracker Web

## Purpose

This repository contains a mobile-first study planning product and its supporting research workspace.
The product combines an Astro marketing site, a React application mounted at `/study`, and a Python Intelligence Service.

## Start Here

Before planning, editing, reviewing, or running project workflows:

1. Read [`.work/STATUS.md`](.work/STATUS.md) for the current project state and active work.
2. Read [`.agents/rules/README.agents.md`](.agents/rules/README.agents.md), then read every rule selected by its index for the task.
3. Read the relevant contract under [`.work/specs/`](.work/specs/) and any active plan under [`.work/plans/active/`](.work/plans/active/).
4. Inspect the live implementation and tests before relying on architecture summaries or prior-session notes.
5. Check `git status --short` and preserve unrelated worktree changes.

The live checkout is the source of truth.
If a rule or planning document conflicts with the code, verify the behavior and record the discrepancy instead of guessing.

## Project-Local Agent Resources

Use only the repository-local rules and skills for work in this checkout:

- Rules: [`.agents/rules/`](.agents/rules/)
- Skills: [`.agents/skills/`](.agents/skills/)

When a skill is named or triggered, read `.agents/skills/<skill>/SKILL.md` and follow that local copy.
Do not use `.opencode/`, `.codex/`, `.claude/`, plugin-cache, user-home, or sibling-checkout copies unless the user explicitly requests an external fallback.
Use `$add-project-rule` for any addition, update, rename, split, or reorganization under `.agents/rules/`.

## Repository Map

| Path | Responsibility |
|---|---|
| `apps/marketing/` | Astro marketing site served at the apex domain. |
| `apps/app/` | Vite and React application mounted under `/study`. |
| `services/intelligence/` | FastAPI service for calibration, projection, and roadmap intelligence. |
| `packages/design-tokens/` | Shared Marginalia design tokens and component primitives. |
| `packages/progress/` | TypeScript progress and projection logic. |
| `packages/roadmap-engine/` | TypeScript roadmap and booking engine. |
| `packages/py-progress/` | Python progress-engine counterpart. |
| `packages/py-roadmap-engine/` | Python roadmap-engine counterpart. |
| `e2e/` | Playwright configuration, browser tests, and visual evidence. |
| `research/` | Research code, datasets, results, and durable research documentation. |
| `college/mydeliverables/` | Dissertation reports, papers, decks, and submission artifacts. |
| `.work/` | Tracked project state, specs, plans, verification logs, prompts, and handovers. |

For deeper structure, use [`design/architecture.md`](design/architecture.md), [`design/algo/ROADMAP_ENGINE_GUIDE.md`](design/algo/ROADMAP_ENGINE_GUIDE.md), and the live package entrypoints.

## Working Contracts

The main product contract is [`.work/specs/prd/PRD-study-tracker-web.md`](.work/specs/prd/PRD-study-tracker-web.md).
Vertical-slice issue contracts live under [`.work/specs/issues/`](.work/specs/issues/).
Active implementation plans and their verification logs live under [`.work/plans/active/`](.work/plans/active/).
The Marginalia visual reference is [`design/marginalia.html`](design/marginalia.html).
Application test credentials are stored in `.work/specs/test-login-cred.txt` and must not be copied into source, tests, logs, or responses.

## Common Commands

```bash
# Managed product runtime
./full-app status full
./full-app start full
./full-app stop full

# Frontend development
pnpm dev
pnpm dev:marketing
pnpm dev:app
pnpm dev:intelligence

# Verification
pnpm --filter app test
uv run pytest
pnpm typecheck
pnpm lint
pnpm test:e2e
pnpm build
```

Use the applicable runtime, Playwright, registry, Docker, and document rules before running sensitive workflows.
Run the smallest relevant check first, then broaden verification in proportion to the change.
For UI changes, verify the real browser flow at relevant desktop and mobile viewports and inspect the rendered result, console, and layout behavior.

## Stable Architecture Boundaries

- Keep Supabase access behind the existing dependency-injected auth and sync boundaries.
- Keep browser persistence local-first and isolated per signed-in user.
- Treat the event log as the durable product history and preserve backward compatibility for existing events.
- Keep roadmap and progress algorithms in their packages instead of duplicating them in page components.
- Keep the React Router basename as a deployment concern and write application routes without the `/study` prefix.
- Keep shared visual primitives in `packages/design-tokens/` and preserve the Marginalia design language.
- Keep TypeScript and Python engine behavior aligned when a contract is implemented in both stacks.

Read the indexed rule files before changing any of these boundaries.

## `.work/` Safety and Lifecycle

`.work/` is tracked intentionally.
Never add `.work/` to `.gitignore`.
Never run `git clean -fdx` at the repository root.

Follow [`.work/README.md`](.work/README.md) for the planner, developer, verifier, and archive workflow.
When work changes state, update the affected status row and the active plan's `VERIFICATION.md` in the same task.
Keep durable specifications separate from volatile execution state.

## Deployment

The marketing site and React app deploy separately under one apex domain.
The marketing deployment rewrites `/study/*` to the app deployment.
Use [`DEPLOYMENT.md`](DEPLOYMENT.md) as the deployment contract and verify live configuration before changing routing or environment settings.
