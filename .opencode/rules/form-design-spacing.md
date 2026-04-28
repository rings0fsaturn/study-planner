---
name: form-design-spacing
description: Use consistent spacing between form field groups using Marginalia tokens
---

# Form Design Spacing

## Problem

Consecutive field groups (e.g., Email + Password on SignIn page) collapse into each other with no spacing. The submit button sits directly against the last field — visually tight and inconsistent with the design system.

```css
/* ❌ BROKEN — no spacing between groups */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
```

Result: User sees a cramped form with no breathing room between input groups.

## Rule

**Add `margin-bottom: var(--space-4)` to `.field-group` in `packages/design-tokens/src/components.css`.**

The Marginalia design system defines this spacing scale:

| Token | Value | Role |
|---|---|---|
| `--space-2` | 8px | Gap inside `.field-group` (label → input) — micro spacing |
| `--space-4` | 16px | **Between field groups** — component spacing |
| `--space-5` | 24px | Between form sections / card padding — section spacing |

16px (`--space-4`) is the system's "component spacing" level — consistent with card content padding, tag row gaps, and component block separation.

## Fix

```css
/* ✅ CORRECT — proper inter-group spacing */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 420px;
  margin-bottom: var(--space-4);
}
```

## Why `--space-4` Specifically

- **Multiples of base unit**: 16px is a multiple of the 4px base unit — maintains rhythm
- **System consistency**: Used throughout Marginalia for component-to-component gaps
- **Card padding alignment**: Matches the padding inside `.card` elements
- **Future-proof**: Adding more fields won't require ad-hoc spacing overrides

## When to Apply

- Any new form with multiple `.field-group` elements
- When the form looks "too tight" or fields bleed into each other
- This single CSS fix cascades to SignIn, SignUp, ResetPassword, and all future forms

## Pattern Checklist

- [ ] Use `--space-4` (16px) for spacing between field groups
- [ ] Use `--space-2` (8px) for label-to-input gap inside a group
- [ ] Use `--space-5` (24px) for section-level spacing (e.g., "Or" divider)
- [ ] Never use pixel values directly — always use design tokens