## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Implement the approved line-aware anchored coach popover for Practice. Learners can request or receive offered hints, read streamed Socratic guidance through the tier ladder, and encounter a separately gated reveal without answer leakage.

## Acceptance criteria

- [ ] Learner request, idle, and failed-test triggers offer help without forcing it.
- [ ] Stream frames are ordered, resumable before completion, and rendered without duplicate sequence numbers.
- [ ] The guide follows `nudge -> hint -> targeted -> gated-reveal` and remains anchored to the active line.
- [ ] Reveal gating, ownership, prompt injection boundaries, hidden-content exclusion, and reconnect behavior are tested.

## Blocked by

- Ticket #12 — Written Practice Runs
- Ticket #13 — Coding Practice Runs
