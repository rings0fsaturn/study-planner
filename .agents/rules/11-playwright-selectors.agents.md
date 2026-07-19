---
name: playwright-selectors
description: Use user-facing, scoped Playwright locators that do not collide with Astro dev-toolbar elements.
---

# Playwright Selectors

Prefer locators in this order:

1. Use accessible roles and names such as `getByRole` and `getByLabel`.
2. Use stable application test IDs when a user-facing locator is not precise enough.
3. Use application-specific CSS classes only when the first two options cannot express the target.

Do not use bare element locators such as `page.locator('h1')` against Astro dev mode.
The Astro toolbar injects headings, buttons, and other elements that can cause strict-mode collisions.
Scope marketing locators to the page surface or identify the intended element by its accessible name.

Do not add `.first()` merely to silence an ambiguous locator.
Make the locator express which user-visible element the test intends to exercise.
