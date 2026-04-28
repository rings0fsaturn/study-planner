---
name: grill-me
description: Interview the user relentlessly about a plan, design, or proposal until reaching shared understanding, walking down each branch of the decision tree and resolving dependencies between decisions one at a time. Use whenever the user wants to stress-test a plan, pressure-test a design, get grilled, "interview me", "poke holes in this", "interrogate this plan", "find the gaps", or any time the user signals they want adversarial questioning to sharpen their thinking before they commit to an approach.
---
 
# Grill Me
 
Interview the user relentlessly about every aspect of their plan until you both reach a shared understanding of the design. The goal is to surface unstated assumptions, force decisions on ambiguous branches, and catch gaps before the user commits to building.
 
## Core loop
 
1. Identify the top open question — the decision that most blocks or constrains everything downstream.
2. Ask exactly one question about it.
3. Provide your recommended answer alongside the question, with brief reasoning.
4. Wait for the user's response.
5. Internally update the decision tree based on what they said. New branches almost always open up — that's expected.
6. Repeat until every branch is resolved and you can summarize the plan back to them without holes.
One question at a time. Never batch. Batching lets the user gloss over the hard ones; the whole point is to make each decision feel forced.
 
## What to grill on
 
Walk down the decision tree systematically. For each node, consider:
 
- **Scope** — what's in, what's out, what's deferred, and why
- **Assumptions** — what is the user taking for granted that might not hold
- **Dependencies** — what has to be true or done first for this to work
- **Failure modes** — what breaks this, what happens when it breaks, who notices
- **Alternatives** — what was rejected and why; is the rejection still valid given what we've now decided
- **Tradeoffs** — what is being given up; is the user comfortable with that
- **Edge cases** — empty inputs, huge inputs, concurrent access, partial failure, untrusted input
- **Success criteria** — how will the user know this worked
Don't march through this list mechanically. Use it as a checklist for the parts of the tree you haven't covered yet.
 
## Resolving dependencies between decisions
 
Decisions aren't independent. If question B's answer depends on how A was resolved, ask A first. When the user answers A in a way that changes what's reasonable for B, surface that explicitly: "Given you went with X for the storage layer, the caching question I was going to ask next changes — now the question is really about Y."
 
This is what "walking down the tree" means. You're not running through a flat list of concerns; you're navigating a graph where each answer prunes or grows the remaining branches.
 
## Recommend, don't just ask
 
For every question, give your recommended answer with one or two sentences of reasoning. The user can accept it (fast path) or push back (which itself is informative — their pushback usually reveals a constraint you didn't know about). A bare question without a recommendation forces the user to do all the work and is less useful.
 
Format roughly:
> **Question:** [the decision that needs making]
> **My recommendation:** [your answer]
> **Why:** [one or two sentences]
 
## When to explore the codebase instead of asking
 
If a question can be answered by looking at code, configuration, or existing artifacts that are accessible to you, look it up yourself. Don't ask the user "what database are you using?" when you could open their config file and find out. Reserve questions for things only the user knows: intent, priorities, constraints from outside the system, and their tolerance for various tradeoffs.
 
After exploring, you can still surface what you found and confirm: "I see you're on Postgres 15 with the pgvector extension already installed — I'll assume we're building on that unless you want to revisit it."
 
## When to stop
 
Stop when you can restate the plan back to the user and neither of you can find an unresolved branch. At that point, give a clean summary of the decisions made, in dependency order, so the user has a single artifact they can act on or share.
 
If the user signals they're done before you think you're done ("ok, that's enough, let's just build it"), respect that — but flag the top one or two unresolved branches so they're at least visible: "Sounds good. Two things we didn't pin down: [X] and [Y]. Worth keeping in mind as you go."