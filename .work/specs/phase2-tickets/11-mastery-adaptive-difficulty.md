## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Turn valid graded observations into the approved mastery projection and adaptive recommendation. The learner receives an uncertain cold-start projection, immediate concept-level BKT updates, and one-band recommendations targeting approximately 0.7 expected correctness.

## Acceptance criteria

- [ ] Mastery is stateless, owner-scoped, rebuildable, and exposed behind the agreed interface.
- [ ] BKT updates consume per-skill observations without creating a parallel mastery model.
- [ ] Adaptive recommendations move one band at a time and include model-version context.
- [ ] TypeScript/Python parity, cold start, rebuild, and boundary tests pass.

## Blocked by

- Ticket #07 — Assessment Taking and Objective Grading
