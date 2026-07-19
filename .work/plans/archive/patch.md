# Playlist picker — mobile fix patch

This document patches the original `playlist-picker-redesign-implementation.md`. The TSX from the original is unchanged. **Only the CSS in §2 is replaced.** The rest of the original document (locked decisions, behavior details, watchouts, verification checklist) still applies.

## Root cause

The original CSS used same-specificity selectors (`.playlist-picker-modal` competing with `.modal-card`, both at specificity 0,1,0). Because the redesigned playlist-picker block replaces lines 517–549 in `components.css` and `.modal-card` lives at line 627+, the modal-card defaults appear *later* in source and **win every collision** — meaning my `padding: 0`, `border-radius` overrides, and overlay alignment changes were silently ignored.

Three concrete consequences on mobile:
1. `.modal-card { padding: var(--space-5) }` won → my section padding stacked on top → ~80px of total horizontal padding on a 380px viewport, content collapsed
2. `.modal-overlay { padding: 16px }` won → "bottom sheet" floated 16px above the screen edge
3. `.modal-card { border-radius: var(--radius-lg) }` won → rounded bottom corners, didn't meet the screen edge

Plus two iOS bugs not caught in v1:
- 14px font on the search input triggers auto-zoom on focus (iOS only zooms when input font is <16px)
- No safe-area-inset handling for notched phones — Confirm button could sit under the home indicator

## The fix

Use combo selectors (`.modal-card.playlist-picker-modal`, `.modal-overlay.playlist-picker-overlay`) to bump specificity to 0,2,0. This beats the 0,1,0 modal defaults regardless of source order. No `!important`, no source-order dependency.

## §2 — Replacement CSS (revised)

Replace the existing `/* ---- PLAYLIST PICKER ---- */` block in `components.css` with this. (If you've already applied the v1 CSS, replace that with this one.)

```css
/* ---- PLAYLIST PICKER ---- */

/* Overlay — combo selector beats .modal-overlay defaults */
.modal-overlay.playlist-picker-overlay {
  /* Inherits flex-end alignment for mobile bottom sheet */
}

@media (min-width: 1024px) {
  .modal-overlay.playlist-picker-overlay {
    align-items: center;
  }
}

/* Mobile: kill overlay padding so the sheet meets all three edges */
@media (max-width: 1023px) {
  .modal-overlay.playlist-picker-overlay {
    padding: 0;
  }
}

/* Modal frame — combo selector beats .modal-card defaults (padding, radius) */
.modal-card.playlist-picker-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  max-height: 80dvh;
  padding: 0;
  overflow: hidden;
}

@media (max-width: 1023px) {
  .modal-card.playlist-picker-modal {
    max-width: none;
    max-height: 90vh;
    max-height: 90dvh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
}

/* Per-zone horizontal padding (replaces the modal-card outer padding we zeroed out) */
.playlist-picker-modal > .playlist-picker-header,
.playlist-picker-modal > .playlist-picker-list-wrap,
.playlist-picker-modal > .playlist-picker-footer {
  padding-left: var(--space-5);
  padding-right: var(--space-5);
}

@media (max-width: 1023px) {
  .playlist-picker-modal > .playlist-picker-header,
  .playlist-picker-modal > .playlist-picker-list-wrap,
  .playlist-picker-modal > .playlist-picker-footer {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
}

/* Header zone */
.playlist-picker-header {
  flex-shrink: 0;
  padding-top: var(--space-5);
  padding-bottom: var(--space-3);
}
.playlist-picker-header .modal-eyebrow { margin-bottom: 6px; }
.playlist-picker-header .modal-title { margin-bottom: var(--space-3); }

.playlist-picker-search {
  padding: 9px 12px;
  font-size: 16px;        /* 16px prevents iOS Safari auto-zoom on focus */
  margin-bottom: var(--space-3);
  max-width: none;
}

.playlist-picker-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.playlist-picker-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* List zone — flex child that scrolls internally */
.playlist-picker-list-wrap {
  flex: 1 1 auto;
  min-height: 0;          /* critical: lets flex child respect parent max-height */
  position: relative;
  border-top: 1px solid var(--rule);
  margin-top: var(--space-3);
}

/* Bottom fade hint — spans the full wrap, not inset */
.playlist-picker-list-wrap::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 16px;
  background: linear-gradient(to bottom, transparent, var(--surface-card));
  pointer-events: none;
}

.playlist-picker-list {
  max-height: 360px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: 4px;
  padding-bottom: 4px;
}

@media (max-width: 1023px) {
  .playlist-picker-list {
    max-height: none;     /* let flex layout decide list height on mobile */
  }
}

/* Row */
.playlist-picker-row {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--rule-soft);
  cursor: pointer;
  transition: background var(--duration-2) var(--ease-out);
}
.playlist-picker-row:last-child { border-bottom: none; }
.playlist-picker-row:hover { background: var(--paper-deep); }

/* Thumbnail (image and fallback share dimensions) */
.playlist-picker-thumb,
.playlist-picker-thumb-fallback {
  width: 80px;
  height: 45px;
  border-radius: 4px;
  flex-shrink: 0;
  object-fit: cover;
  background: var(--paper-deep);
}
.playlist-picker-thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-faint);
}

/* Title + author column */
.playlist-picker-content {
  flex: 1;
  min-width: 0;
}
.playlist-picker-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.playlist-picker-author {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playlist-picker-duration {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* Deselected state */
.playlist-picker-row.deselected .playlist-picker-title {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.playlist-picker-row.deselected .playlist-picker-author {
  color: var(--text-tertiary);
}
.playlist-picker-row.deselected .playlist-picker-thumb,
.playlist-picker-row.deselected .playlist-picker-thumb-fallback {
  opacity: 0.55;
}
.playlist-picker-row.deselected .playlist-picker-duration {
  opacity: 0.7;
}

/* Empty state (zero search matches) */
.playlist-picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Footer */
.playlist-picker-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: var(--space-3);
  padding-bottom: var(--space-5);
  border-top: 1px solid var(--rule);
  flex-wrap: wrap;        /* allows summary + actions to stack on very narrow phones */
}
.playlist-picker-summary {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.playlist-picker-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;      /* keep actions right-aligned when wrap kicks in */
}

@media (max-width: 1023px) {
  .playlist-picker-footer {
    /* Respect notched-phone home indicator */
    padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
  }
}

/* Mobile responsive — row sizing tweaks */
@media (max-width: 1023px) {
  .playlist-picker-thumb,
  .playlist-picker-thumb-fallback {
    width: 60px;
    height: 34px;
  }
  .playlist-picker-row {
    gap: 10px;
  }
  .playlist-picker-count {
    display: none;
  }
}
```

## What changed vs. v1

The seven concrete deltas:

1. **Modal selector bumped from `.playlist-picker-modal` to `.modal-card.playlist-picker-modal`.** Specificity 0,2,0 now beats `.modal-card`'s 0,1,0 regardless of source order. Same change for `.modal-overlay.playlist-picker-overlay`.
2. **Added `overflow: hidden` to the modal frame.** Clips content to the modal's `border-radius` — without it, hover backgrounds on the first/last rows can poke past the rounded corners.
3. **Mobile overlay gets `padding: 0`.** Bottom sheet now meets all three edges of the screen instead of floating 16px in.
4. **Mobile modal gets `border-bottom-left-radius: 0` and `border-bottom-right-radius: 0`.** Sheet's bottom edge sits flush against the screen bottom, only the top corners are rounded.
5. **Search input font-size: 14px → 16px.** iOS Safari auto-zooms on focus when input font is below 16px. This is the standard fix.
6. **Bottom fade gradient: `left/right: var(--space-5)` → `left/right: 0`.** With per-zone padding now correctly applied (no double-padding), the fade should span the full list-wrap width.
7. **Footer mobile: added `padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px))`.** Confirm button no longer sits under the home indicator on notched iPhones.

Plus two minor additions:
- `-webkit-overflow-scrolling: touch` on the list for momentum scrolling on older iOS
- `flex-wrap: wrap` on the footer with `margin-left: auto` on the actions, so on very narrow viewports the summary can wrap above the buttons without breaking right-alignment

## Verification additions

Add these to the original §6 verification checklist:

15. On mobile (<1024px), the modal sits flush against the bottom edge of the screen, with the top corners rounded and the bottom corners square (touching the screen edge cleanly).
16. The modal sits flush against both side edges of the screen on mobile (no 16px gap from the overlay padding).
17. Tapping the search input on iOS Safari does not zoom the page in.
18. On a notched iPhone (e.g., iPhone 14 Pro), the Confirm button sits comfortably above the home indicator, not partially under it.
19. Modal content is no longer double-padded — the row content extends to a sensible inset from the screen edge (~16px on mobile, ~20px on desktop), not collapsed by stacked paddings.
20. Bottom fade gradient spans the full width of the row list, lining up with the row borders, not inset.