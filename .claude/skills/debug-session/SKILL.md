---
name: debug-session
description: Run a disciplined debugging session — discover the project's stack, reproduce the bug deterministically, isolate the root cause through bottom-up testing (or bisection / boundary-first when faster), verify the fix empirically, and report back with exact file:line references. Use whenever the user says "debug this", "fix this bug", "why is X not working", "find the issue", "this is broken", or pastes a stack trace, error log, or failing test — even when they don't explicitly ask for a "debugging session". Especially valuable when the bug is non-obvious, the codebase is unfamiliar, the user has already tried a fix that didn't work, or there's a concrete failure (test, error, exception) without a clear cause. Prevents the common failure modes of theorizing without running tests, guessing at fixes, and fixing the wrong thing.
---

# Debug Session

A disciplined debugging methodology. The whole skill is built on one principle:

> **Don't just think — run a test and observe what happens.**

Theorizing about why code is broken without empirically testing the theory is the single biggest reason debugging sessions wander. Every hypothesis gets a real test, real output, real evidence. If you can't construct a test for a hypothesis, you don't yet understand the hypothesis well enough to act on it.

## The phases

1. Discover the stack
2. Gather context and lock in a reproduction
3. Set up the workspace (snapshot + scratch)
4. Hunt the bug (hypothesis → test → observe → repeat)
5. Verify the fix
6. Clean up and promote a regression test
7. Report

The phases are sequential. Skipping ahead — especially skipping phase 2 — is how sessions go wrong.

---

## Phase 1: Discover the stack

Before anything else, learn what kind of project this is. The right test command, the right way to run a script, and the right test conventions all depend on this.

Look for, in roughly this order:

- **Node / JavaScript / TypeScript** — `package.json` (read `scripts`, `dependencies`, `devDependencies`; note the test runner: jest, vitest, mocha, etc.)
- **Java** — `pom.xml` (Maven) or `build.gradle` / `build.gradle.kts` (Gradle); note JUnit version, Spring/Quarkus/etc.
- **Python** — `pyproject.toml`, `setup.py`, `requirements.txt`; note pytest vs unittest, framework (Django/Flask/FastAPI)
- **Go** — `go.mod`; standard `testing` package
- **Rust** — `Cargo.toml`
- **Ruby** — `Gemfile`; note rspec vs minitest
- **.NET** — `.csproj` / `.sln`
- **Other** — look for any manifest or build file at the repo root

Capture and remember:
- **Language + version**
- **Framework(s)** in use
- **Test runner** and how to invoke it (the exact command)
- **How to run a single test file** (so iteration is fast — running the whole suite every cycle is wasteful)

If the project type is genuinely unidentifiable, ask the user — but only after looking. Don't ask what you can read.

## Phase 2: Gather context and lock in a reproduction

This phase is non-negotiable. Without a deterministic reproduction, you cannot verify any fix actually worked — you'll just be guessing. Many debugging sessions go wrong because the agent skipped this and started "fixing" things based on a vague description.

### Step 2a — Self-serve sweep

Look at what's already available before asking the user anything. Check:

- `/mnt/user-data/uploads/` — screenshots, logs, error dumps the user already attached
- The existing test suite — run it. What's currently failing?
- Recent commits (`git log --oneline -20`) — was something just changed?
- Recent diffs (`git diff HEAD~5`) — what's been touched lately?
- Open error files, console output the user pasted into chat
- Issue trackers / linked tickets if mentioned

You'll often find half the context for free.

### Step 2b — Insist on a concrete reproduction

After the self-serve sweep, you need a deterministic trigger for the bug. One of:

- A **failing test** (ideal — already deterministic)
- An **exact command** + expected output + actual output
- A **specific input** that breaks a function + expected output + actual output
- A **sequence of steps** in an app + what should happen + what does happen

If the user gave you one, great — confirm it reproduces on your end before going further.

If the user *didn't* give you one, your first job is to construct one *with* them. This is not an interruption of debugging — **this is the first phase of debugging**. The first scratch test you write is usually the one that reproduces the bug.

When pushing for a repro, ask only what you can't figure out yourself. "What error do you see?" is fine if there's no error in the uploads. "What database are you using?" is not fine if you can read the config.

### Escape hatch: repro-impossible

If, even with the user's help, the bug genuinely can't be reproduced deterministically (intermittent race, environment-only, third-party flake), **stop and say so explicitly**:

> "I can't trigger this reliably. Without a deterministic repro, I can't verify any fix actually works — I'd just be guessing. Here's what we'd need to make progress: [specific things, e.g. logs from when it fails, access to staging, a way to run the failing scenario]."

Don't push past this. A guessed fix is worse than no fix because it gives the user false confidence.

### Escape hatch: "is this actually a bug?"

Sometimes during context-gathering, the behavior the user calls "broken" is the *intended* behavior — the user's mental model of "correct" is wrong, or they're looking at a different version, or the spec changed. If you suspect this, surface it *before* attempting any fix:

> "Before I dig in — are you sure this is a bug? The current behavior matches what's documented in `[file:line]` / what the test in `[path]` asserts. Can you confirm what the *expected* behavior is and why?"

Fixing the wrong thing is one of the most expensive failure modes. Catching it before phase 4 saves hours.

## Phase 3: Set up the workspace

You're about to instrument source code, write throwaway tests, and run things. Set up so the codebase doesn't get polluted.

### Snapshot-and-go (preferred)

If the repo is a git repo:

1. Run `git status`. If the working tree is clean, you're fine — make all your changes directly; you'll restore with `git checkout .` or `git stash` at the end.
2. If the working tree has uncommitted user changes, **stash them first** (`git stash push -u -m "debug-session pre-snapshot"`) or create a working branch (`git checkout -b debug-session-<short-desc>`). Tell the user what you did.
3. From this point you may freely edit source code — add `console.log` / `System.out.println` / `print()`, comment out blocks to bisect, swap implementations to A/B test. Just remember: nothing you edit during the hunt is final. The only edits that survive are the verified fix.

### Read-only fallback (no VCS, or user objects)

If there's no git, or the user doesn't want their working tree disturbed, **don't edit source files for diagnosis**. Instead, do all hypothesis testing from the scratch directory: write tests there that *import* the suspect code and call it with controlled inputs. Slower, but safe.

### Scratch directory

Create `.debug-scratch/` at the repo root (add a `.gitignore` entry if needed) or use `/tmp/debug-session/` if you don't want to touch the repo at all. This is where throwaway tests live during the hunt. Nothing in this directory is meant to survive the session.

## Phase 4: Hunt the bug

Now the actual loop. Every cycle:

1. State the hypothesis in one sentence ("I think `parseDate` returns null when the input has a timezone suffix").
2. Write a scratch test that would distinguish "hypothesis true" from "hypothesis false".
3. Run it.
4. Observe what actually happened.
5. Update your hypothesis based on the evidence.

Repeat. The point is empirical: you don't *know* anything until you've run a test that proves it.

### Strategy: bottom-up (default)

Start at the leaf functions / pure utilities the suspect code depends on. Verify each works correctly with controlled inputs. Walk up the call stack one layer at a time. At some layer, things will start failing — that's near your bug.

This is the default because it builds confidence from primitives upward, and because once you find the failing layer, you've also localized which dependencies are *not* the cause.

### Strategy: bisection (when the suspect surface is large)

When the suspect region is too big to walk through function-by-function (e.g. a 500-line method, a 50-file module that "stopped working last week"), bisect:

- Comment out / stub half the suspect region. Does the bug still reproduce?
- If yes, the bug is in the *other* half (the part you didn't touch). If no, it's in the half you stubbed.
- Narrow to that half and repeat.

For "it worked last week" bugs, the same idea applies to history: `git bisect` between a known-good commit and the current broken state.

### Strategy: boundary-first (when data looks weird)

A large fraction of bugs live at boundaries — input parsing, output serialization, API requests/responses, framework lifecycle hooks firing in the wrong order, ORM mapping. If the bug smells like "wrong shape of data" rather than "wrong logic", test the boundaries first:

- What does the input *actually* look like at the entry point? (Log it, assert against it.)
- What's the output of each external/framework call? (Are you getting what you expected?)
- Is a framework hook (lifecycle method, middleware, decorator) firing when you think it is?

### Picking a strategy

- Suspect surface is small or you have no idea where it breaks → **bottom-up**
- Suspect surface is large or the bug appeared after a known change → **bisection**
- The data crossing a boundary looks wrong, or the bug involves a framework / external system → **boundary-first**

These compose: bisect to a region, then bottom-up within it; or boundary-test first to confirm the shape of data, then bottom-up the logic that processes it.

### Categorizing causes as you hunt

As you build hypotheses, keep these categories in mind. Bugs usually fall into one (sometimes a combination):

- **Framework** — wrong API usage, wrong lifecycle, version mismatch, plugin misconfigured
- **Logical** — the algorithm is wrong; produces wrong output for correct inputs
- **Syntax** — typo, wrong operator, wrong type coercion
- **Positional / placement** — code is correct but in the wrong place; runs in the wrong order, scope, or context
- **Config** — code is correct but configured wrong (env var, feature flag, build setting)
- **Data** — code is correct but the input data violates an unstated assumption (null, encoding, off-by-one, timezone)
- **Concurrency** — race condition, deadlock, wrong thread / async ordering
- **Other** — anything that doesn't fit; name it specifically in the report

Naming the category early helps you pick the right strategy. "Framework" bugs reward boundary-first; "logical" bugs reward bottom-up; "positional" bugs often reveal themselves to bisection.

### Escape hatch: cycle budget

If you've completed roughly **5 hypothesis → test cycles without converging on a root cause**, stop and report progress to the user. Don't push past this silently — that's how sessions spin for hours.

> "I've tried [N] hypotheses without converging. Here's what I've ruled out: [list]. Here's what I'd try next: [list]. Want me to keep going, or do you have context I'm missing?"

Hitting the budget is a normal outcome, not a failure — it usually means the user knows something you don't.

## Phase 5: Verify the fix

Once you think you've found and fixed the root cause:

1. **Rerun the scratch test** that originally reproduced the bug. It must now pass.
2. **Rerun the project's test suite** (or at least the affected module's tests). Nothing should have regressed.
3. If your fix involved removing/changing instrumentation (logs, stubs), re-verify with that instrumentation cleaned up — the fix shouldn't depend on debug code.

If verification fails, you don't have the fix yet. Go back to Phase 4. Don't report a "fix" you haven't verified.

## Phase 6: Clean up and promote a regression test

Before reporting, leave the codebase in a better state than you found it.

1. **Promote one regression test.** Take the scratch test that most cleanly reproduces the original bug, port it to the project's real test suite (matching the project's test conventions discovered in Phase 1 — file location, naming, framework idioms), and confirm it fails *without* your fix and passes *with* it. This single test is the durable proof the bug can't silently come back.
2. **Delete the scratch directory.** Everything in `.debug-scratch/` was throwaway. Remove it.
3. **Restore the working tree.** Revert any diagnostic edits (logs, stubs, commented-out code, A/B swaps). The only diff that should remain is the verified fix plus the new regression test.
4. **Sanity-check the diff.** Run `git diff` and read it. It should contain *only* the fix and the regression test — nothing else. If there's debug cruft, remove it.

## Phase 7: Report

Default to a structured chat message — the user wants the answer in front of them, not buried in a file. Use this template exactly:

```
## Bug fixed: [one-line description]

**Symptom:** [what was broken, observable behavior]

**Root cause:** [one sentence, plain English]

**Category:** [framework | logical | syntax | positional | config | data | concurrency | other]

**Evidence:** [the scratch test that proved it, briefly — what you ran, what you observed]

**Fix:**
- File: `path/to/file.ext` (line N)
- Diff:
  ```diff
  - broken line
  + fixed line
  ```

**Regression test added:** `path/to/test_file.ext` — fails without the fix, passes with it.

**Scratch cleaned up:** yes
```

Then offer the optional artifact:

> "Want me to write this up as a `DEBUG_REPORT.md` for a PR description or postmortem?"

Only create the file if they say yes — for most sessions the inline report is what they need.

---

## Stop conditions, summarized

The skill has three named escape hatches. Treat hitting any of them as a normal outcome — they exist precisely because pushing past them produces bad fixes.

| Hatch | Fires when | What to do |
|---|---|---|
| Repro-impossible | Bug can't be triggered deterministically even with user's help | Stop. State what's missing. Don't guess a fix. |
| "Is this actually a bug?" | Behavior looks intended; user's mental model may be wrong | Surface the hypothesis before fixing anything. Confirm "expected" vs "actual" with the user. |
| Cycle budget | ~5 hypothesis cycles without convergence | Report progress, list what's ruled out and what's next, ask the user for context. |

---

## Anti-patterns to avoid

- **Theorizing without testing.** "I think the bug is X" is not progress until you've run a test that distinguishes X from not-X.
- **Reading code endlessly without running it.** A 30-line scratch test that calls the function with the suspect input tells you more in 10 seconds than 20 minutes of staring at the implementation.
- **Editing the fix before reproducing the bug.** If you don't have a failing test, you can't tell whether your fix worked.
- **"Fix" by adding a try/catch that swallows the error.** That's not a fix; that's hiding the bug. Fix the root cause unless the user explicitly asks for graceful degradation.
- **Leaving debug cruft in the diff.** `console.log("HERE")` shipped to main is the calling card of a debugging session that didn't finish.
- **Reporting without verification.** Never say "this is fixed" without having rerun the failing test and watched it pass.
