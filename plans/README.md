# plans/

Implementation plans for this project. Each plan is a single Markdown file at `plans/YYYY-MM-DD-<slug>.md`, written collaboratively by humans and AI agents to capture how a coherent piece of work will be implemented.

## What's in a plan

Each plan contains:

- **Operating-manual preamble** — instructions for any AI agent picking up the plan.
- **TL;DR + Context** — what's being built and why.
- **Decisions log** — what was decided, why, what alternatives were rejected, and where the user pushed back. Numbered (D-01, D-02, ...) so phase steps can reference them.
- **Architecture overview + Files-touched index** — the shape of the change at a glance.
- **Phases** — vertical slices of work, each independently implementable in a fresh agent context window. Each phase carries exact files, code, tests, verification commands, rollback notes, and a status marker.
- **Open questions + Out of scope + References** — what's deferred, what's deliberately not included, and the external links the implementing agent should have available.

## How to use them

**If you're a human contributor:** read the plan to understand a piece of in-flight or upcoming work. The Decisions log is the most useful section for catching up — it tells you *why* the plan looks the way it does.

**If you're an AI agent (Claude Code, Cursor, Copilot, etc.) asked to implement a phase:** open the plan and read the "How to use this plan" preamble at the top — it's your operating manual. Don't skip it.

## Naming convention

`YYYY-MM-DD-<slug>.md` where the date is when the plan was *written* and the slug is a short kebab-case identifier of what's being built.

## Status

Plans are living documents. Each phase has a status marker (`☐ Not started` / `🟡 In progress` / `🛑 Blocked` / `✅ Complete — <commit-sha>`) that gets updated as work progresses, and the plan file is committed alongside the code change for that phase. A plan with all phases marked `✅ Complete` is done; it stays in `plans/` as historical record.

## Why this lives in the repo

Putting plans alongside the code (rather than in an external tracker) means:

- The plan and the code evolve together; the plan gets reviewed in the PR.
- The plan is versioned with the code it describes — you can `git blame` a decision back to the planning conversation that produced it.
- A fresh agent has everything it needs in one checkout — no extra logins, no missing context.
