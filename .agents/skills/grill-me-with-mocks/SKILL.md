---
name: grill-me-with-mocks
description: Interview the user about a UI — a new screen or an upgrade to an existing one — the way grill-me does, but resolve each decision visually. For every open UI question, build a single-file HTML mock with the competing variations wired to a live toggle, let the user flip between them and pick, then record the pick in DECISIONS.md against the baseline. At the end, fold every chosen variation back into one working mock that captures the agreed structure, design, and behavior — ready to seed an implementation plan. Use whenever the user wants to design or redesign a UI, "mock this up", "grill me on this screen", "let me see some options/variations", "help me decide the layout/design", compare visual treatments before committing, or turn a vague UI idea into a concrete, buildable mock. Reach for this over plain grill-me any time the decisions are visual and the user would rather see options than argue them in prose.
---

# Grill Me With Mocks

This is [[grill-me]] for UI work. Plain grilling resolves decisions in words; UI decisions are hard to judge in words. A user cannot really tell whether "segmented OTP field" beats "single wide input" until they see both. So here every decision is resolved the same way a designer resolves it: **build the options, look at them side by side, pick.**

The loop is: grill the user on the highest-leverage open UI question → build the competing answers as variations in a single-file HTML mock wired to a live toggle → let them flip between them and choose → record the choice in `DECISIONS.md` → fold the winner into the baseline → move to the next question. When the tree is exhausted, you merge the baseline plus every chosen variation into one **combined working mock** — a concrete artifact with real structure, styling, and interaction — that an implementing agent (or you) can turn into an implementation plan.

The mock is the point. It is simultaneously the decision-making instrument, the running record of what was agreed, and the spec handed to the builder. Everything below serves keeping that mock honest and the decisions traceable.

## What this skill produces

By the end of a session, the working folder holds:

- `baseline.html` — the starting-point screen (see granularity modes below), updated as decisions land.
- `decisions/decision-NN-<slug>.html` — one self-contained mock per grilled decision, each showing that decision's variations behind a live toggle. These are the evidence behind each choice; they are kept, not thrown away.
- `DECISIONS.md` — the ordered log: for each decision, the question, the variations considered, which one was chosen, why, and a link to the mock file that shows it.
- `final.html` — the combined working mock: baseline with every chosen variation folded in. This is the deliverable.

Use the `assets/` templates in this skill as starting points: `assets/variation-toggle-template.html` for the per-decision mocks and `assets/DECISIONS-template.md` for the log.

## Step 0 — Set up the workspace and the baseline

Before grilling, do two things.

**Pick the output location.** This project keeps UI planning under `.work/`. If a `.work/` directory exists at the project root, create the session folder there: `.work/active/<feature-slug>/mocks/`. If there is no `.work/`, fall back to `mocks/<feature-slug>/` relative to where the user is working, and tell them where you put it. Either way, state the path once so the user can open the files.

**Establish the baseline.** How you build it depends on whether the screen's *contents* are already settled or still unknown. Detect this from what the user gives you; when it's genuinely ambiguous, ask one question at the start.

- **Mode A — refine a known layout.** The user roughly knows what's on the screen (an existing screen being upgraded, or a clear description). Build a *complete first-draft screen* — every section present with a reasonable first-guess treatment. This whole screen is the baseline. Each later decision then varies **one element** and layers the winner back in context. This is the common case for redesigns and for porting an existing screen.

- **Mode B — discover an unknown layout.** The user isn't sure what the screen should even contain. Build a bare **skeleton** — labelled boxes, no real design. Each later decision then adds a **whole section/feature** with variations, and the screen grows one section at a time.

If the two are mixed — some sections known, some not — start in Mode A with the known parts stubbed and drop into Mode B for the unsettled sections. Don't announce "I am now in Mode B"; just build the right kind of baseline and grill accordingly. The mode is a tool for you, not ceremony for the user.

If an existing UI is being upgraded and its source is accessible (React components, PEXML templates, CSS, screenshots), read it first and make the baseline actually resemble it. A baseline that looks like the real screen makes every subsequent variation judgment trustworthy. Don't ask the user what the current screen looks like when you can open it.

## The core loop

1. Identify the top open UI question — the decision that most constrains everything downstream (page structure and primary layout usually come before element-level treatments; a choice about navigation model changes what every screen can contain).
2. Ask exactly one question about it, and **build its variations** as a live-toggle mock (next section). One question at a time — batching lets the user gloss over the hard ones, and more importantly they can only really compare a couple of variations at once.
3. Give your recommended variation with brief reasoning, so the user has a fast path (accept) and an informative slow path (push back — their pushback usually reveals a constraint you didn't know).
4. Wait for the user to flip through and choose. They may pick a variation, ask for a new one, or combine parts ("B's layout, A's button"). All are fine; build the combination if asked.
5. Record the decision in `DECISIONS.md` and fold the winner into `baseline.html`.
6. Update the decision tree. Choices open new branches and prune others — surface that explicitly: "Since you took the two-column layout, the mobile question changes — now it's really about what collapses first."
7. Repeat until you can restate the whole screen back with no unresolved branch.

## Building the variation mock (live toggle, single file)

Each grilled decision gets one self-contained `.html` file that renders the **current baseline screen** with the element (Mode A) or section (Mode B) under decision swappable via an on-screen control. The user opens the file, clicks between A / B / C, and sees each option in full context — not floating in isolation. That context is what makes the choice real.

Start from `assets/variation-toggle-template.html`. The essential shape:

- Everything inline — one HTML file, `<style>` and `<script>` in-page, no external assets or network calls, so it opens straight from disk on any machine.
- A small fixed toolbar with one button per variation (and a short label describing each, e.g. "A — single wide field", "B — 6-box OTP", "C — inline paste helper").
- Each variation is a container; the toggle shows one and hides the rest. Keep the rest of the screen identical across variations so the user is comparing only the thing under decision.
- A visible caption naming the decision and the currently shown variation, so a screenshot or a glance is self-describing.

Give 2–4 variations, not more — beyond that the user can't hold them in mind, and it usually means the decision isn't framed tightly enough. Each variation must be a *genuinely different answer*, not a colour tweak; if two variations differ only trivially, cut one. Make them real: actual copy, plausible data, working-looking controls. A mock that says "Lorem ipsum" and has dead buttons can't be judged.

Match the target platform's visual language enough that the choice transfers. For an existing product surface, approximate its real spacing, component chrome, and button styling rather than browser defaults — otherwise the user is choosing between two things that both look wrong. You don't need pixel perfection; you need enough fidelity that the winning variation obviously maps to something buildable.

## Recommend, don't just present

For every decision, name the variation you'd pick and why, in a sentence or two. Format roughly:

> **Decision:** [what has to be decided]
> **Variations:** A — …, B — …, C — …
> **My recommendation:** B
> **Why:** [one or two sentences — the tradeoff that makes B win]
> **Mock:** `decisions/decision-03-authcode-input.html`

A bare "here are three options, which do you want?" pushes all the work onto the user and wastes the reasoning you already did. The recommendation is also falsifiable — when the user rejects it, you learn the real constraint.

## Logging decisions

Append to `DECISIONS.md` the moment a decision is made, using `assets/DECISIONS-template.md`. Each entry records: the decision number and title, the question, each variation with a one-line description, the **chosen** one, the reasoning (theirs and yours), and a relative link to both the decision mock and the baseline state it applies to. Convert any relative timing ("just now") to a real date.

The log is written for a future reader who wasn't in the room — an implementing agent, or the user in three weeks. "Chose B" is useless later; "Chose B (6-box OTP) over A (single field) because the auth code is always 6 digits and segmenting cuts paste errors; rejected C's inline-paste helper as redundant once segmented" survives. Keep entries in dependency order so the log reads as the actual path taken.

If a later decision overturns an earlier one, don't silently rewrite history — add a new entry that supersedes the old and note which number it replaces. The tree really does change as you walk it; the log should show that it did.

## Explore before asking

If a question can be answered from code, config, screenshots, or existing mocks, answer it yourself instead of spending a grill turn on it. Don't ask "what's the current button style?" when the stylesheet is right there. Reserve questions for what only the user knows: intent, priorities, which tradeoffs they'll tolerate, what the screen is *for*. After exploring, confirm what you found rather than asking from scratch: "The current screen uses the yellow legacy CTA gradient — I've matched it in the baseline; say if you want to modernize it and I'll make that a decision."

## Combining into the final working mock

When grilling is done, build `final.html`: the baseline with **every chosen variation folded in**, as one coherent, self-contained screen. This is not a toggle mock — it's the single agreed design, working. It should:

- Reflect every decision in `DECISIONS.md` (cross-check the log against the mock; a decision that isn't visible in `final.html` is a decision that got lost).
- Be genuinely interactive where the real screen would be — fields validate, buttons show their states, conditional sections show/hide on the triggers the decisions established. The interaction *is* part of the spec; a builder reading a static picture has to guess the behavior, and guesses drift from intent.
- Carry brief inline annotations (HTML comments or a small side panel) linking regions of the screen back to their decision numbers, so the builder can trace any piece of the UI to the decision that produced it.

Then write a short handoff at the top of `DECISIONS.md` (or a sibling `HANDOFF.md`): what the screen is, the final mock path, and the ordered decision list. This is the bridge to an implementation plan — the mock supplies structure, design, and behavior, so the plan can focus on wiring it to real data, services, and the target framework. If the project has a planning skill or a `.work/plans/` convention, point the handoff at it.

## When to stop

Stop when you can restate the whole screen — every section, every element treatment, every conditional — and neither of you can find an unresolved branch. Then deliver the summary in dependency order plus the `final.html` path.

If the user calls it early ("that's enough, let's build"), respect it, but combine what's decided into `final.html` anyway and flag the top one or two branches you didn't resolve: "Done — final mock is at <path>. Two things we never pinned: the error-state treatment and the mobile breakpoint. Worth deciding before build." An unflagged gap becomes a builder's silent guess.
