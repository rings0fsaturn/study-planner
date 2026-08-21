---
name: live-e2e-authoring
description: Author live E2E specs that survive real-stack runs against the shared dev account.
---

# Live E2E Authoring

Model live specs on `e2e/material-library-live.spec.ts` and `e2e/material-ingestion-live.spec.ts`.
Gate the whole suite on `E2E_LIVE_EMAIL` / `E2E_LIVE_PASSWORD` and keep credentials out of source.

## Skip scoping

A module-level `test.skip()` skips every test in the file, no matter where it appears.
Gate one scenario with `test.skip()` only inside a `test.describe()` that owns that scenario.
Check skip reasons in `--reporter=json` output (annotations) before assuming env variables were lost.
Workers inherit the shell environment: if a spec skips with vars exported, the reason is in the annotations, not the env.

## Assert what the UI actually renders

Ready material cards intentionally hide the status badge and show a `Practice this` button instead.
The library card renders `Practice this` as a button; the material detail page renders it as a link.
Use `getByRole('button', { name: 'Practice this' })` in the card and `getByRole('link', ...)` on the detail page.
Failed cards show the badge and a `Retry` action, so assert the failed state through those elements.

## Locator scope

Library cards contain the same words as the create-page source choices (`Plain text`, `PDF document`, `Web article`).
Scope create-page clicks to the source grid so strict-mode collisions cannot happen:

```ts
const createSourceGrid = (page: Page) => page.locator('.material-source-grid')
await createSourceGrid(page).getByRole('button', { name: /PDF document/i }).click()
```

## Shared-account hygiene

Live runs mutate the shared dev account.
Failed runs leave materials behind, and leftover cards break strict-mode locators on the next run.
Delete created materials at the end of every scenario, and clean leftovers with a service-role delete before re-running.
The PDF scenario uploads the real fixture `e2e/pdf/sample-textbook-572page.pdf` (572 pages, ~23 MB) so extraction, chunking, and embedding run on realistic content.
The 572-page fixture is the canonical PDF scenario; `e2e/pdf/sample-textbook-632page.pdf` is not referenced by any live scenario.
Give that scenario its own `test.setTimeout(...)` (600 s) and a card-ready wait of several minutes, because the whole book must reach `ready`.

## Stale app code

Vite on WSL does not reliably watch `/mnt/d` source changes.
After editing app or service source, restart the managed runtime before re-running live specs, or the browser exercises stale modules.
