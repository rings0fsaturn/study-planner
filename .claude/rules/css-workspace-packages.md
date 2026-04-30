---
name: css-workspace-packages
description: CSS workspace package exports must match import specifiers exactly
---

# CSS Workspace Package Exports

## Problem

Vite couldn't resolve imports like `@study-tracker/design-tokens/global.css` because the `exports` map keys in `package.json` didn't include the `.css` extension:

```json
// ❌ BROKEN - keys don't match import specifiers
"exports": {
  "./global": "./src/global.css",       // import uses ".css"
  "./tokens": "./src/tokens.css",       // import uses ".css"
  "./components": "./src/components.css" // import uses ".css"
}
```

Error encountered:
```
Missing "./global.css" specifier in "@study-tracker/design-tokens" package
```

## Rule

**Export keys MUST match the import specifier exactly.** If consumers import with `.css`, the export key must include `.css`:

```json
// ✅ CORRECT - keys match import specifiers
"exports": {
  "./global.css": "./src/global.css",
  "./tokens.css": "./src/tokens.css",
  "./components.css": "./src/components.css"
}
```

Also use subpath import conditions for proper bundler resolution:

```json
"exports": {
  "./global.css": {
    "import": "./src/global.css",
    "default": "./src/global.css"
  }
}
```

## Additional Rule

**Do NOT set `"type": "module"` on CSS-only packages.** It can confuse bundlers and isn't needed for CSS files.

```json
// ❌ UNNECESSARY
{
  "name": "@scope/design-tokens",
  "type": "module",  // Don't need this for CSS-only package
  "exports": { ... }
}

// ✅ OK
{
  "name": "@scope/design-tokens",
  "exports": { ... }
}
```

## When to Apply

- Any new workspace package that exports CSS files
- Any time you add new CSS export paths to an existing design-tokens package