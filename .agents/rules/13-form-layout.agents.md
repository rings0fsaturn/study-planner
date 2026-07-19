---
name: form-layout
description: Preserve Marginalia field grouping, vertical rhythm, and responsive form behavior.
---

# Form Layout

Use the shared `.field-group` primitive for a label, control, hint, and validation message that belong together.
Keep the primitive's vertical spacing in `packages/design-tokens/src/components.css` based on Marginalia spacing tokens.
Do not recreate field-group margins independently on each page.

Use layout `gap` for spacing between sibling groups when the container owns the rhythm.
Avoid margin collapse between form groups.
Verify labels, hints, errors, and actions at mobile and desktop widths after changing form layout.
