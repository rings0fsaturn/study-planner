---
name: astro-selectors
description: Use specific selectors with Astro dev mode to avoid matching injected toolbar elements
---

# Astro Dev Mode Selector Rules

## Problem

When running Astro with `astro dev`, the dev server injects a floating toolbar into the DOM. This toolbar contains its own elements (headings, buttons, etc.) that can interfere with Playwright selectors.

Example error:
```
strict mode violation: locator('h1') resolved to 5 elements:
  1) <h1 class="t-display-2">Privacy Policy</h1>  ← actual page element
  2) <h1>No islands detected.</h1>               ← Astro toolbar
  3) <h1>Audit</h1>                              ← Astro toolbar
  4) <h1>No accessibility or performance issues detected.</h1> ← Astro toolbar
  5) <h1>Settings</h1>                          ← Astro toolbar
```

## Rule

**Never use bare element selectors (`page.locator('h1')`, `page.locator('div')`, etc.) when testing against Astro dev mode.**

Instead, use:
1. **Class-based selectors** — target elements by their CSS classes
2. **Role selectors** — use `getByRole()` for semantic elements
3. **Data attributes** — if available, use `data-astro-*` attributes

## Examples

| Broken | Fixed |
|--------|-------|
| `page.locator('h1')` | `page.locator('h1.t-display-2')` |
| `page.locator('button')` | `page.getByRole('button', { name: 'Submit' })` |
| `page.locator('.card')` | `page.locator('.card').first()` |
| `page.locator('nav a')` | `page.locator('nav.site-nav a')` |

## Selector Priority

1. **First:** Use semantic roles (`getByRole`, `getByLabel`, `getByText`)
2. **Second:** Use CSS classes that are specific to your app
3. **Third:** Use data attributes if available (Astro adds `data-astro-cid-*`)
4. **Avoid:** Bare element selectors (`div`, `span`, `h1-h6`, `a`, `button`)

## Quick Reference

```typescript
// ❌ BAD - matches Astro toolbar too
await expect(page.locator('h1')).toContainText('Privacy');

// ✅ GOOD - class-based
await expect(page.locator('h1.t-display-2')).toContainText('Privacy');

// ✅ GOOD - role-based
await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();

// ✅ GOOD - class + filter
await expect(page.locator('.card').filter({ hasText: 'Privacy' })).toBeVisible();
```

## When to Apply

- All Playwright tests against `astro dev` (Astro port 4321)
- Tests for any framework that injects dev tooling (Next.js, Nuxt, etc.)
- Any time you see "strict mode violation" with multiple matched elements