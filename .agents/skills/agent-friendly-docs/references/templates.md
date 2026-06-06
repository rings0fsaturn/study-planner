# Document Templates

Templates for each document type supported by the `agent-friendly-docs` skill. Each template specifies the recommended YAML frontmatter, section structure, length range, and a compact worked example. Use the template that matches the user's request.

## Table of contents

- [Code documentation](#code-documentation)
- [Code pattern guide](#code-pattern-guide)
- [Code implementation plan](#code-implementation-plan)
- [Code research](#code-research)
- [General documentation](#general-documentation)
- [General analysis](#general-analysis)
- [Index file (for multi-file documents)](#index-file-for-multi-file-documents)

---

## Code documentation

**For:** API references, module docs, function-level docs, library overviews.

**Frontmatter:**

```yaml
---
title: <Module or API name>
purpose: <What this module/API does, in one sentence>
applies_to: <path or package name>
audience: implementers, consumers of this API
status: <current | deprecated | beta>
last_updated: <ISO date>
---
```

**Section structure:**

```
## Quick start
## Public API
### <Function or endpoint name 1>
### <Function or endpoint name 2>
## Examples
## Internal notes      (optional — implementation details consumers don't need)
## See also
```

**Length:** Typically 100-500 lines per module. If a single module exceeds 500 lines, split each major class or endpoint group into its own file under a folder.

**Key patterns:**

- Each function/endpoint gets its own `###` header with the exact name as it appears in code. This makes Grep land precisely.
- Document signature, parameters, return value, errors, and one example for each.
- Cross-reference with relative links to source files: `[implementation](../src/auth.py)`.

**Compact example:**

```markdown
---
title: auth module
purpose: JWT-based authentication for the public API
applies_to: src/auth/
audience: implementers, API consumers
status: current
last_updated: 2026-05-21
---

## Quick start

Import and call `verify_token(token)` on every protected route. Returns a `UserContext` on success, raises `AuthError` on failure.

## Public API

### verify_token(token: str) -> UserContext

Validates a JWT and returns the associated user context.

- **token**: Bearer token from the `Authorization` header
- **Returns**: `UserContext` with `user_id`, `scopes`, and `expires_at`
- **Raises**: `AuthError` if the token is missing, malformed, expired, or revoked

Example:

\`\`\`python
ctx = verify_token(request.headers["Authorization"].removeprefix("Bearer "))
if "write" not in ctx.scopes:
    raise PermissionDenied()
\`\`\`

### revoke_token(token: str) -> None

Adds a token to the revocation list. Effective immediately across all instances.

## See also

- [auth-flow.md](./auth-flow.md) — full request lifecycle
- [error-codes.md](./error-codes.md) — AuthError subclasses
```

---

## Code pattern guide

**For:** How-we-do-X in this codebase. Idioms, conventions, recurring patterns the team has agreed on.

**Frontmatter:**

```yaml
---
title: <Pattern name>
purpose: <When to use this pattern and what problem it solves>
applies_to: <paths or modules where this pattern applies>
audience: implementers
status: <current | proposed | deprecated>
last_updated: <ISO date>
---
```

**Section structure:**

```
## When to use this pattern
## When NOT to use this pattern
## The pattern
## Worked example
## Variations            (optional)
## Common mistakes
## See also
```

**Length:** Typically 100-300 lines. Patterns should be focused — if you find yourself documenting three related patterns, split into three files.

**Key patterns:**

- Lead with "when to use" and "when NOT to use." The reader is deciding whether this applies to them right now.
- `## Common mistakes` is high-value — call out the things people get wrong.
- Include at least one full worked example with realistic code, not toy snippets.

**Compact example:**

```markdown
---
title: Idempotency keys on write endpoints
purpose: Prevent duplicate side effects when clients retry failed requests
applies_to: services/payments/, services/orders/
audience: implementers
status: current
last_updated: 2026-05-21
---

## When to use this pattern

Any HTTP endpoint that mutates state and is exposed to retrying clients (mobile apps, partner integrations, async workers).

## When NOT to use this pattern

Read-only endpoints. Internal-only RPC where retries are controlled by us. Endpoints where the side effect is naturally idempotent (PUT to a fixed resource).

## The pattern

Clients send `Idempotency-Key: <uuid>` on every mutating request. The server stores the (key, response) pair for 24 hours. If the same key arrives again, return the stored response without re-executing.

[... rest of the doc ...]
```

---

## Code implementation plan

**For:** Design documents, proposals, RFCs, ADRs — describing a feature or change before it's built.

**Frontmatter:**

```yaml
---
title: <Plan title>
purpose: <One-sentence summary of what's being proposed>
status: <draft | proposed | approved | implemented | rejected>
author: <name>
last_updated: <ISO date>
related:
  - <link to issue, ticket, or prior doc>
---
```

**Section structure:**

```
## Problem statement
## Goals and non-goals
## Proposed approach
## Alternatives considered
## Implementation steps
## Risks and rollback
## Open questions       (optional, for in-progress drafts)
## See also
```

**Length:** 200-600 lines. If approaching 600, split implementation steps into a separate file (`implementation-steps.md`) and reference from the plan.

**Key patterns:**

- `## Goals and non-goals` prevents scope creep. The non-goals section is often more important than the goals section.
- `## Alternatives considered` is mandatory — even if just to record "we considered X and rejected it because Y." Future readers will ask.
- `## Implementation steps` should be ordered and each step should be a Grep target on its own — e.g. `### Step 3: migrate existing tokens to the new format`.
- `## Risks and rollback` covers what could go wrong and how to undo it.

---

## Code research

**For:** Investigation findings — comparing alternatives, benchmark results, trade-off analyses.

**Frontmatter:**

```yaml
---
title: <Research question or topic>
purpose: <What question this research answers>
question: <The specific question being investigated>
status: <in-progress | complete>
author: <name>
last_updated: <ISO date>
---
```

**Section structure:**

```
## Question
## TL;DR
## Methodology
## Findings
### <Finding 1 — distinct keyword-rich heading>
### <Finding 2 — distinct keyword-rich heading>
## Recommendation
## References
```

**Length:** 200-500 lines.

**Key patterns:**

- `## TL;DR` comes second (right after restating the question). Most readers stop here — make it count.
- Each finding gets its own `###` with a keyword-rich heading. Don't bury findings under generic "Results" or "Analysis" headers.
- `## Recommendation` is the call to action. Be specific: "Use X. Don't use Y. Revisit when Z."
- `## References` lists sources, prior art, benchmarks consulted — with links.

**Compact example:**

```markdown
---
title: Comparing queue backends for the notification pipeline
purpose: Decide between SQS, Kafka, and Redis Streams for the new notification queue
question: Which queue backend best fits our throughput, durability, and ops requirements?
status: complete
author: jane
last_updated: 2026-05-21
---

## Question

We need a queue for the notification pipeline. Expected load: 50k msg/min peak, 10k msg/min steady. Durability: must survive a single AZ failure. Team has Kubernetes expertise but not Kafka.

## TL;DR

Use SQS. Kafka offers higher throughput than we need at significant operational cost; Redis Streams doesn't meet our durability bar.

[... rest ...]
```

---

## General documentation

**For:** Product docs, runbooks, onboarding guides, internal handbooks.

**Frontmatter:**

```yaml
---
title: <Doc title>
purpose: <Who this is for and what they'll be able to do after reading>
audience: <new hires | on-call | external customers | etc.>
status: <current | draft | deprecated>
last_updated: <ISO date>
---
```

**Section structure (varies by sub-type):**

For a **runbook**:

```
## When to use this runbook
## Prerequisites
## Procedure
### Step 1: <action>
### Step 2: <action>
## Verification
## Rollback
## Troubleshooting
### Symptom: <specific symptom 1>
### Symptom: <specific symptom 2>
## See also
```

For an **onboarding guide**:

```
## Day 1
## First week
## First month
## Resources
```

For a **how-to**:

```
## What you'll learn
## Prerequisites
## Steps
### Step 1: <action>
### Step 2: <action>
## Verification
## See also
```

**Length:** Varies. Favor splitting — an onboarding guide should be one folder with a short index + per-topic files, not one long document.

**Key patterns:**

- Runbook troubleshooting sections use `### Symptom: <specific symptom>` so an on-call can Grep their symptom directly.
- Steps are numbered and each step has its own `###` so they're individually linkable.
- Use the `## Prerequisites` section instead of assuming context.

---

## General analysis

**For:** Post-mortems, market analyses, data analyses, retrospectives.

**Frontmatter:**

```yaml
---
title: <Analysis title>
purpose: <What this analysis answers or covers>
scope: <what's in scope and what's out>
status: <draft | final>
author: <name>
last_updated: <ISO date>
---
```

**Section structure:**

```
## Executive summary
## Background
## Key findings
### <Finding 1 — distinct keyword-rich heading>
### <Finding 2 — distinct keyword-rich heading>
## Supporting data
## Conclusions
## Recommendations
## Appendix         (optional — raw data, methodology details)
```

**Length:** 200-600 lines. Push raw data and detailed methodology to the appendix or a separate file.

**Key patterns:**

- `## Executive summary` is two or three paragraphs max. Should stand alone for someone who reads nothing else.
- Each finding gets a distinct `###` — never "Finding 1", "Finding 2"; use the actual keyword the finding is about.
- `## Recommendations` should be actionable and ordered by impact.
- For post-mortems specifically: include a `## Timeline` section under `## Background` with timestamps; and a `## Action items` section after `## Recommendations` with owners and due dates.

**Post-mortem variant:**

```
## Executive summary
## Impact
## Timeline
## Root cause
## Contributing factors
## What went well
## What went poorly
## Action items
```

---

## Index file (for multi-file documents)

**For:** The entry point of a folder-based multi-file document. Lives at `README.md` or `INDEX.md` inside the folder.

**Frontmatter:**

```yaml
---
title: <Folder/topic title>
purpose: <What this collection of documents covers>
audience: <who should read these>
last_updated: <ISO date>
---
```

**Section structure:**

```
## Overview
## Files in this folder
## Where to start
## See also          (optional, for cross-folder references)
```

**Length:** 30-100 lines. The index is a navigation aid, not a place for content. Keep it short.

**Key patterns:**

- `## Files in this folder` lists every file with a one-line description. This is the most important section — it's what the agent reads to decide where to go next.
- `## Where to start` gives a recommended reading order for newcomers.
- Don't duplicate content from sub-files. If you find yourself explaining a concept in the index, move it to its own file and link.

**Compact example:**

```markdown
---
title: Auth system documentation
purpose: Everything related to authentication and authorization in the platform
audience: implementers, security reviewers
last_updated: 2026-05-21
---

## Overview

This folder documents the auth system end-to-end: request flow, token lifecycle, error handling, and operational runbooks.

## Files in this folder

- [`auth-flow.md`](./auth-flow.md) — Full request lifecycle from login to authenticated request
- [`token-rotation.md`](./token-rotation.md) — Refresh token rotation logic and timing
- [`error-handling.md`](./error-handling.md) — All AuthError subclasses, when each is raised, and recommended client handling
- [`runbook-token-revocation.md`](./runbook-token-revocation.md) — On-call procedure for emergency token revocation

## Where to start

- **New implementer:** Start with `auth-flow.md`, then `error-handling.md`.
- **On-call:** Jump to `runbook-token-revocation.md`.
- **Security review:** Read all four in order.

## See also

- [../api/](../api/) — API reference (the auth module is documented under `api/auth.md`)
- [../security/threat-model.md](../security/threat-model.md) — auth-relevant threats
```
