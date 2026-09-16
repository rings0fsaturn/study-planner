# marginalia-visual-refresh — task spec

## Goal

Bring every user-facing surface of the product into line with the Marginalia design
system, starting from the Home page, without changing product truth or behavior.
The incumbent visual world is preserved; the work is distillation, system conformance,
and honest-state polish, not a rebrand.

## Governing documents (the contract)

- [`DESIGN.md`](../../DESIGN.md) — the visual system (North Star: "The Reading Room").
  Written 2026-09-16 by `$impeccable document`; it is the normative visual contract.
- [`PRODUCT.md`](../../PRODUCT.md) — product truth (users, purpose, positioning, brand).
- [`design/marginalia.html`](../../design/marginalia.html) — the original design reference.
- [`packages/design-tokens/`](../../packages/design-tokens/) — tokens and component primitives.
- Critique snapshot: `.impeccable/critique/2026-09-16T14-12-30Z__apps-app-src-pages-home-tsx.md`
  (Home, 23/40, first persisted run).

## Scope

In: `apps/app` surfaces (Home first, then Week, Roadmap, Materials, Session, onboarding),
the app shell (nav, sync indicator, banners), and the shared primitives in
`packages/design-tokens/`. Out: the marketing site (its own later pass), product behavior,
copy that carries factual claims, and the research/dissertation surfaces.

## Sequence (agreed 2026-09-16)

1. `$impeccable document` — done: DESIGN.md + `.impeccable/design.json`.
2. `$impeccable distill` on Home — done.
3. `$impeccable bolder` (year streak calendar) — done (TS + Python engine, parity fixtures).
4. Clarify/harden system states — partially done (service banner copy); the rest is open.
5. Extract missing primitives into `packages/design-tokens` — open.
6. Layout rhythm — open.
7. Adapt (touch targets, nav a11y) — open.
8. Whole-app propagation — paused until the user reviews the Home pass.
9. Polish + critique re-run — open.

## Done criteria

- Every priority issue in the Home critique snapshot is fixed or explicitly deferred by the user.
- `pnpm --filter app test`, `pnpm typecheck`, `pnpm lint`, and `uv run pytest` are green
  (the two pre-existing WSL TZ failures excepted).
- A re-run of `$impeccable critique` on Home scores higher and trends in `.impeccable/critique/`.
- The user confirms the Home pass before any further screen is touched.
