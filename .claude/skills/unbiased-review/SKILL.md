---
name: unbiased-review
description: Spawn one or more independent reviewer subagents to do a strict, unbiased review of a plan/PRD/design-doc or of code. Surfaces every deviation from earlier-agreed decisions, every shortcut, every hallucination, every cheat, every standards violation. Use whenever the user wants to "review my plan", "review my PRD", "review my code", "audit this", "check the implementation against the plan", "make sure I didn't miss anything", "red-team this", "tear this apart", or any time the user wants an adversarial second opinion on either a planning artifact or an implementation before they commit to it. Especially after a `/grill-me` + `/to-prd` flow, or after a coding task is "done".
---

# Unbiased Review

Spawn an independent subagent — or several in parallel — to strictly review either:

- **A plan / PRD / design doc** — checking it actually covers the decisions agreed upon earlier in the conversation (typically from a `/grill-me` session, but any source of decisions works)
- **Code** — checking it follows the project's standards, doesn't deviate from the plan it was supposed to implement, and contains no shortcuts, hallucinations, or cheating

The reviewer is intentionally adversarial and isolated. It does not see the conversation that produced the artifact. **This is what "unbiased" means here:** the same context that justified the artifact is exactly the context that biases a reviewer toward approving it. The point of spawning a separate subagent is to deny it that context.

## When to use this skill

After any planning or implementation step where missing something has real cost. Typical points:

- Right after `/to-prd` produces a PRD, before submitting it as an issue
- Right after a coding task wraps up, before declaring it done
- Any time the user says "is this actually right", "did I miss anything", "review this", "audit this"

## Core principle: starve the reviewer of the author's reasoning

The reviewer must work from artifacts, not from the chat. If you hand it the transcript that led to the plan, it will absorb the same assumptions and rubber-stamp the result. The skill works only if you do the synthesis work upfront and pass tight, structured inputs.

The subagent is also told, in its brief, that it does not trust the artifact — its job is to find what's wrong, not to confirm what's right. The phrasing matters; see the templates below.

---

## Mode 1: Reviewing a plan / PRD / doc

### Step 1: Build the Decisions Ledger

Before spawning the subagent, extract a numbered list of every decision agreed upon in the prior conversation. One line per decision. **No justification text** — justification biases the reviewer.

Example:

```
1. Storage layer is Postgres, not MongoDB.
2. Auth is OAuth via the existing identity provider; no new password store.
3. Ingest is async via the job queue; the API never blocks on ingest.
4. Failures during ingest must be retryable without producing duplicates.
5. The dashboard must show live counts (lag <1 minute).
6. Out of scope: backfilling historical data older than 90 days.
7. Out of scope: multi-tenant isolation in v1.
...
```

Scan carefully — any "ok let's go with X", "fine, we'll do Y", or "no, not that, this" is a decision. **Out-of-scope items count**: they are explicit decisions, and the reviewer needs them to flag sneaky scope creep in the plan.

If you genuinely cannot find clean decisions in the conversation, ask the user to confirm a list before proceeding. Do not skip this step — it is the entire pillar of the plan-review path. A plan review without a ledger devolves into vague impressions.

### Step 2: Spawn the reviewer subagent

Use the Task / sub-agent tool available in your environment. Pass the brief below, with the placeholders filled in. **Do not include the chat transcript or your own commentary on the plan** — only the artifacts.

Subagent brief template:

> You are an unbiased reviewer. You do not trust the plan attached. Your job is to find every place where the plan fails to cover a decision from the Decisions Ledger, contradicts a decision, waters one down, or hand-waves over a hard part.
>
> You have not seen the conversation that produced this plan. Do not try to fill in what you think was meant — work only from what is written. If something is implied but not stated, that is a finding.
>
> **Inputs:**
> - Decisions Ledger:
>   <paste numbered list>
> - Plan / PRD / Doc:
>   <paste content, or path to the file>
>
> **For each decision in the ledger, verify:**
> - Is it explicitly addressed in the plan?
> - Does the plan agree with it, or does it quietly diverge?
> - Are dependent decisions handled coherently together (e.g., the auth decision and the session-storage decision agree)?
>
> **Then independently check the plan for:**
> - Internal contradictions
> - Hand-waving on the genuinely hard parts (vague verbs like "handle", "manage", "support" with no detail behind them)
> - Scope creep — anything the plan introduces that no decision authorized
> - Missing pieces a competent implementer would still need
>
> **Output format:** see the Findings format section at the end of this brief.
>
> Only flag things that meaningfully affect whether the plan can be implemented faithfully. No bikeshedding, no nits — but also no severity ranking. If a finding made it into your list, it is worth addressing. The author is required to address every item in the list, so do not pad it, and do not soften it either.
>
> <paste the Findings format block from this skill>

### Step 3: Present findings to the user

Show the verdict and the full findings list to the user. Do not auto-edit the plan. The user decides which findings to act on. See "Acting on findings" below.

---

## Mode 2: Reviewing code

### Step 1: Identify what's being reviewed

Get a precise scope:

- A diff (against `main`, against a branch, or since a specific commit) — preferred, because the reviewer can focus
- A specific list of files
- A directory

Avoid "review the whole repo". The reviewer needs a clear surface area to reason carefully about.

### Step 2: Identify the plan the code was supposed to follow

Code review only makes sense relative to an intent. Locate:

- The PRD / GitHub issue / design doc that motivated the change
- Or, if there isn't one, the user's natural-language description of what the code was supposed to do

If neither exists, ask the user to give you one before you spawn the reviewer. Do not review code against vibes — the reviewer will have nothing to anchor "deviation" to and the review collapses into generic style commentary.

### Step 3: Spawn the reviewer subagent

The subagent reads the project's environment **itself**. Do not pre-summarize it for them — that's another vector for bias, and you might miss the rule that matters. Tell the subagent which files to inspect; it will pick whichever apply:

- `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md` — explicit project conventions
- `package.json`, `pom.xml`, `build.gradle`(`.kts`), `go.mod`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json` — declared dependencies and tooling
- `.eslintrc*`, `.prettierrc*`, `tsconfig.json`, `.editorconfig`, `ruff.toml`, `.rubocop.yml`, pre-commit configs, CI configs — formatting / lint / test expectations
- A sampling of existing code in the affected area — internal conventions that aren't written down anywhere

Subagent brief template:

> You are an unbiased code reviewer. You do not trust this implementation. Assume the author cut corners somewhere. Your job is to find where.
>
> You have not seen the conversation that produced this code. Work only from the artifacts.
>
> **Inputs:**
> - Repo root: <path>
> - Code under review: <diff command, file list, or directory>
> - The plan / PRD / intent the code was meant to implement:
>   <paste content, or path>
>
> **Before reviewing the code, inspect the project to determine the standards bar.** Read whichever of these exist: `CLAUDE.md`, `AGENTS.md`, dependency manifests (`package.json`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`, etc.), lint/format configs, CI config, and a sampling of existing code in the same area. The standards you apply must match this project, not generic best-practice advice from your training data.
>
> **Then check the code for:**
>
> 1. **Deviation from plan** — anything in the plan that the code skipped, did differently, or quietly redefined. Also: anything the code does that the plan didn't ask for.
> 2. **Shortcut / easy way out** — TODOs, hardcoded values that should be config, mocks left in production paths, swallowed exceptions, "good enough" hacks, missing error handling on paths the plan said matter, missing tests for behavior the plan called out, copy-pasted code instead of extracted helpers.
> 3. **Hallucination** — calls to functions, classes, modules, APIs, config keys, env vars, CLI flags, or libraries that do not actually exist in the codebase or in the declared dependencies. **Verify by grep, by reading the dependency manifest, or by checking the language's standard library — do not assume.** Hallucinations are common and frequently survive smoke tests because the smoke test path doesn't hit them.
> 4. **Cheating** — work marked "done" that isn't actually done; tests that test the mock and not the behavior; assertions that always pass (e.g., `assert True`, `expect(x).toBeDefined()` on something that's already truthy); commented-out code that should be live; debug logs / prints / `console.log`s left from development; stubs / `pass` bodies / `throw new NotImplementedError()` treated as implementation; tests skipped or marked `xit`/`@Disabled` without justification.
> 5. **Standards violations** — places where the code contradicts the project's own conventions (the ones you read in the inspect step). Cite which file or rule it violated.
>
> **Output format:** see the Findings format section at the end of this brief.
>
> Only flag things that meaningfully affect correctness, faithfulness to the plan, or adherence to the project's own standards. No bikeshedding, no style nits the project itself doesn't enforce — but also no severity ranking. If a finding made it into your list, it is worth fixing. The author is required to address every item, so do not pad the list, and do not soften it either.
>
> <paste the Findings format block from this skill>

### Step 4: Present findings to the user

Same as plan-review. Show the verdict and the full findings list. Do not auto-apply fixes. The user decides what to do with each finding.

---

## When to fan out to parallel subagents

Default to a single subagent. Fan out only when one of these applies:

- **The diff splits cleanly into independent modules.** Spawn one reviewer per module (or per logical concern: schema, API, UI, jobs) so each fits in context and gets serious attention. Aggregate findings at the end and dedupe overlaps.
- **You want diverse perspectives on the same artifact.** For a security-sensitive PRD, spawn one strict-correctness reviewer and one threat-modeling reviewer with distinct briefs — same input, different lenses. Combine findings, dedupe.
- **The artifact is genuinely too large for one subagent to hold and still reason carefully about.** Split by section or file.

Do not fan out just to seem thorough. Two reviewers reading the same small artifact with the same brief produce nearly identical findings and waste tokens. The fan-out has to add something — different scope, or different lens.

When you do fan out, after collecting all findings:
1. Deduplicate (same file:line + same category = one finding)
2. Merge into a single list
3. The combined verdict is `APPROVED` only if every reviewer returned `APPROVED`. Otherwise `REQUEST_CHANGES`.

---

## Findings format

The subagent must return exactly this shape:

```
Verdict: APPROVED
   — or —
Verdict: REQUEST_CHANGES

Findings:
- [category] <one-sentence statement of the issue>
  Where: <file:line, or section reference, or "global">
  Detail: <one short paragraph — what's wrong, what was expected, what evidence supports the finding>

- [category] <next finding...>
  ...
```

If the verdict is `APPROVED`, the Findings list is empty. If there is even one finding, the verdict must be `REQUEST_CHANGES`.

**Categories** — use exactly these strings:

For plan review:
- `missing-decision` — a Decisions Ledger item is not addressed
- `contradicts-decision` — the plan goes against a Ledger item
- `watered-down` — the plan addresses a Ledger item but weakens it
- `hand-waving` — the plan glosses over a hard part with vague language
- `internal-inconsistency` — two parts of the plan contradict each other
- `scope-creep` — the plan introduces work no decision authorized

For code review:
- `deviation-from-plan` — the code does something the plan didn't say to do, or doesn't do something the plan said to do
- `shortcut` — TODO, mock-as-real, swallowed errors, missing tests the plan asked for, etc.
- `hallucination` — references to nonexistent symbols, APIs, dependencies, or config
- `cheating` — work claimed done that isn't done, tests that don't test, debug residue, stubs treated as implementation, etc.
- `standards-violation` — contradicts a rule from `CLAUDE.md` / lint config / project convention

### Why no severity tags

Severity tags (`BLOCKER` / `MAJOR` / `MINOR` / `NIT`) sound rigorous but in practice license the author to fix the loud ones and ignore the quiet ones. That is the exact failure mode this skill exists to prevent. Every finding in the list must be addressed — either by fixing the artifact or by arguing back substantively. The way you keep the list honest is not by ranking inside it, but by being strict about what gets *into* it: no bikeshedding, no nits the project doesn't enforce. If the reviewer raised it, it's real.

---

## Acting on findings

When the review comes back, for each finding the author (you, on the next turn) must do exactly one of:

1. **Fix it** in the artifact, then re-spawn the reviewer on the updated version.
2. **Push back with a real argument** — a substantive reason the reviewer was wrong, surfaced to the user. Not "I don't think it matters". Not "out of scope" (the reviewer already knows the scope). A real, specific reason. The user gets to sanity-check the pushback before it's accepted.

Do not silently drop findings. Do not "we'll get to it later" them. The whole point of having spawned an unbiased reviewer is that you committed in advance to take its findings seriously.

If the verdict was `REQUEST_CHANGES`, after addressing all findings, **spawn the reviewer again** on the updated artifact. Loop until `APPROVED`. The reviewer should be a fresh subagent each iteration so it doesn't accumulate sympathy for the author across rounds.

---

## What this skill is not for

- **Style preferences and personal taste.** The reviewer enforces project conventions, not its own opinions. If the project doesn't lint for it, it shouldn't be flagged.
- **Architecture exploration.** Use `/grill-me` for that. Review is for after decisions are made, not for re-litigating them.
- **A rubber stamp.** If you find yourself spawning a reviewer hoping for approval, you're using it wrong. The expected outcome is findings — the question is which ones.