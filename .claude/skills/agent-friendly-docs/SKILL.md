---
name: agent-friendly-docs
description: Write documents structured so AI coding agents (Claude Code, Cursor, Copilot, etc.) can navigate them efficiently via Read, Grep, and Glob without loading the whole file. Use this skill whenever the user asks to write, create, draft, or produce any of the following — code documentation, code pattern guides, code implementation plans, code research notes, design docs, RFCs, ADRs, runbooks, onboarding guides, post-mortems, general documentation, or general analysis documents. Trigger on phrases like "write docs", "document this", "create a guide", "write an implementation plan", "spec this out", "document the pattern", "write a research note", "create an analysis doc", "draft a design doc", "write an RFC", "write a runbook", "write up the findings", or any similar phrasing — even if the user does not explicitly say "agent-friendly". Produces Markdown with YAML frontmatter, distinctive greppable headers, progressive disclosure, and ~500-line file budgets so agents can locate and load just the slice they need.
---

# Agent-Friendly Document Writing

Write documents that AI coding agents can navigate. An agent reads files with a fixed toolkit — Read (with offset/limit for partial reads), Grep (returns matching line numbers), Glob (filename patterns), Bash (cat/head/tail/sed). The job of the writer is to make those tools land precisely on the right slice without the agent having to load the whole document.

## The core principle

**Navigability beats density.** A 5,000-line monolith is worse than five 1,000-line focused files, because the agent can read just one of the five cheaply. The same logic applies inside a file: a Grep-arrived reader should not need to have read three earlier sections.

This skill applies to documents written for agents, but the same structure works for humans navigating large doc sets — they Cmd-F and skim headers the way agents Grep.

## Decision: single file or folder

Estimate the final document's length before writing.

- **Under ~500 lines**: single `.md` file.
- **500 lines or more**: folder layout with an index file (`README.md` or `INDEX.md`) pointing to one-topic-per-file sub-documents.

When in doubt, prefer multi-file. Three small focused files beat one sprawling one.

Example folder layout:

```
auth-system/
├── README.md               (short index, ~50 lines)
├── auth-flow.md            (~300 lines)
├── token-rotation.md       (~200 lines)
└── error-handling.md       (~150 lines)
```

The index file is the entry point. It lists each sub-file with a one-line description so the agent can pick where to go without loading the others. See the "Index file" section of `references/templates.md` for the index template.

## Format rules (apply to every document)

### 1. YAML frontmatter at the top

Open with 3-7 lines of YAML between `---` markers. The agent reads the first ~20 lines and needs to know immediately what the document is and whether to keep reading. Don't bury the lede.

Always include:

- `title:` — human-readable title
- `purpose:` — one sentence describing what this document is for

Include when relevant:

- `audience:` — e.g. `implementers`, `reviewers`, `on-call`, `agents`
- `status:` — `draft` / `proposed` / `approved` / `deprecated` / `implemented`
- `last_updated:` — ISO date
- `related:` — list of paths to related docs
- `applies_to:` — paths or modules this doc covers (for code docs and pattern guides)

Example:

```yaml
---
title: Payment Webhook Retry Logic
purpose: Document the retry strategy and decision tree for payment webhook delivery
audience: implementers, on-call engineers
status: approved
last_updated: 2026-05-21
related:
  - ./webhook-overview.md
  - ./error-codes.md
---
```

### 2. Distinctive, greppable headers

Every `##` header should be unique within the document and contain specific keywords an agent or human would search for. Generic headers like `## Overview` or `## Details` appearing more than once defeat Grep.

Good:

```
## Authentication flow
## Refresh token rotation
## Token revocation on logout
```

Bad:

```
## Overview
## Details
## More details
```

Why: agents will `grep ^## ` to skim structure and `grep "token rotation"` to land precisely. Both need distinctive headers to work.

### 3. Hierarchy via `##` and `###`, not deeper

Limit to two or three header levels (`##`, `###`, and rarely `####`). Deeper nesting becomes hard to grep, hard to anchor-link, and is usually a sign that the section should be split into its own file.

### 4. Self-contained sections

A reader who Greps and lands on `### Refresh token rotation` should be able to understand it without having read three earlier sections. Either repeat the small amount of context needed, or link to it explicitly:

```
See [Token lifecycle](#token-lifecycle) for the underlying state machine.
See [auth-flow.md#token-lifecycle](./auth-flow.md#token-lifecycle) for cross-file context.
```

This is the single most important rule. Density is fine; assumed context is not.

### 5. ~500 lines max per file

Anthropic's official guidance for SKILL.md is to stay under 500 lines, and the same threshold works well for any agent-facing document. If you cross 500 lines, split into a folder.

### 6. Descriptive filenames

`payment-webhook-retry.md`, not `doc3.md` or `notes.md`. Glob and `find` work on names. The filename should match what someone would Grep for.

### 7. Stable anchor points

Wrap at semantic boundaries (sentence or clause endings), not at column 80. Avoid reflowing existing content during revisions — if an agent previously Grepped a section and cached a line number, that line number should still be in the right neighborhood after edits.

### 8. Markdown features that work well

- **Pipe tables**, not ASCII tables that depend on visual alignment
- **Fenced code blocks with language hints** — ` ```python ` not just ` ``` `
- **Bullet lists** for genuine enumerations; **prose** for argumentation
- **Relative links** between files in the same folder — `[error-codes.md](./error-codes.md)`
- **Anchor links** for in-file references — `[token rotation](#token-rotation)`

### 9. Things to avoid

- ASCII art and complex column layouts (break under terminal truncation)
- Mixed-purpose files — one topic per file
- Generic boilerplate sections an agent has to skim past to reach signal
- Images of text or diagrams as the only source (provide a text equivalent)
- Deeply nested bullet lists more than 2 levels deep — flatten with sub-headers instead

## Document type templates

For each document type, see `references/templates.md` for the recommended frontmatter, section structure, and length guidance. **Always read `references/templates.md` before writing** and use the matching template — the templates encode patterns specific to each doc type that aren't repeated here.

Supported document types:

- **Code documentation** — API references, module docs, function-level docs
- **Code pattern guide** — how-we-do-X in this codebase (patterns, idioms, conventions)
- **Code implementation plan** — design or proposal for a feature or change before it's built; also covers RFCs and ADRs
- **Code research** — investigation findings, alternatives evaluated, benchmarks, trade-offs
- **General documentation** — product docs, runbooks, onboarding guides
- **General analysis** — post-mortem, market analysis, data analysis output

## Workflow

1. **Identify the document type** from the user's request. If ambiguous, ask one clarifying question.
2. **Estimate length.** If under 500 lines, plan a single file. Otherwise plan a folder with an index.
3. **Read `references/templates.md`** for the matching template.
4. **Draft frontmatter first** — title, purpose, audience, status.
5. **Outline headers** before writing prose — make sure they're distinctive and greppable.
6. **Write sections** — self-contained, with explicit cross-links where context is needed.
7. **Run the self-check** below before finalizing.

## Self-check before finalizing

Walk this list. Fix any "no" before declaring the doc done.

- YAML frontmatter present with at least `title` and `purpose`?
- First 20 lines tell the reader what the document is and whether to keep reading?
- All `##` headers unique within the file?
- All `##` headers keyword-rich (not "Overview" / "Details" / "Notes")?
- No `####` or deeper headers? (If you wanted to, split into a separate file instead.)
- Does each section make sense if landed on directly via Grep?
- File under ~500 lines? If not, split into a folder with an index.
- Filenames descriptive (matches what someone would Grep for)?
- Pipe tables used, not ASCII tables?
- Code blocks have language hints?
- Relative links to related files where applicable?
- No assumed context that would confuse a Grep-arrived reader?

## Saving the output

Save the document(s) to `/mnt/user-data/outputs/` so the user can download them. For folder layouts, save the whole folder there. Use `present_files` to surface the result.

## When the user asks for non-Markdown output

If the user explicitly asks for DOCX, PDF, etc., produce that format — but also offer to save a Markdown source alongside, since the binary format will be harder for agents (and the user's future self) to navigate, edit, and diff.

## Edge cases

- **The user gives you a topic but no document type.** Pick the closest match from the supported types, name your assumption inline, and proceed. Don't ask if you can infer.
- **The document is genuinely tiny (under ~50 lines).** Frontmatter and one or two headers are still required; the format rules don't change.
- **The user provides existing prose to convert.** Don't paraphrase the content — just restructure it: extract frontmatter, group into distinctive sections, split if over 500 lines, run the self-check.
- **The user is iterating on an existing doc.** Preserve existing line ranges where you can (rule 7). Add new sections at the end or in a logical place rather than reflowing.

## References

- `references/templates.md` — section structure and frontmatter for each supported document type, plus the index file template for multi-file documents.
