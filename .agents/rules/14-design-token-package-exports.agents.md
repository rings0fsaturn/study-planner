---
name: design-token-package-exports
description: Keep shared CSS package exports aligned exactly with consumer import specifiers.
---

# Design Token Package Exports

Treat `packages/design-tokens/package.json` as the public contract for shared CSS.
Every exported subpath must match the consumer import exactly, including the `.css` suffix.

```json
{
  "./global.css": {
    "import": "./src/global.css",
    "default": "./src/global.css"
  }
}
```

Update the export map and at least one real consumer in the same change when adding a shared stylesheet.
Do not add JavaScript module settings solely for a CSS-only package.
Verify both the Astro and Vite builds after changing shared CSS exports.
