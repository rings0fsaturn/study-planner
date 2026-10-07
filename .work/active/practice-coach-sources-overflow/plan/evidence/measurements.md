# Phase 0 measurements - practice-coach-sources-overflow

_Method: deterministic fallback per plan Risks (five long quotes injected into a faithful `.coach` replica with the real `practiceCoach.css` from disk, native `<details open>`, via `playwright-cli` on `http://localhost:5173/study/sign-in` at 1280x720 and 375x812)._
_No provider calls, no shared-account mutations, no credentials used._
_Screenshots: `coach-open-1280.png`, `coach-open-375.png`, `coach-collapsed-1280.png` in this folder._

## 1280x720, sources open

- Viewport height is 720px.
- `.coach` rect is top -117px, bottom 632px, height 749px (taller than the viewport, header above the visible area).
- `.coach` computed style is `max-height: none`, `overflow: visible`, `display: block` (no cap, no containment).
- `.coach-citations ul` is 560px tall with `max-height: none`, `overflow-y: visible`, `scrollHeight == clientHeight == 560` (no internal scroll path).
- `.coach-close` (dismiss `x`) is NOT visible (its rect leaves the viewport top), so the header controls are unreachable with sources open.
- `Got it` / `Go deeper` remain visible at this height, but the disclosure summary sits under an unreachable header region once quotes grow further.

## 375x812, sources open

- Viewport height is 812px.
- `.coach` rect is top -151px, bottom 736px, height 888px (taller than the viewport, header above the visible area).
- `.coach-citations ul` is 669px tall with `max-height: none`, `overflow-y: visible`, `scrollHeight == clientHeight == 669` (no internal scroll path).
- `.coach-close` is NOT visible here either.

## 1280x720, sources collapsed (contrast)

- `.coach` rect is top 443px, bottom 624px, height 181px (fully inside the 720px viewport).
- The overflow is caused purely by the open disclosure: collapsed fits, open exceeds.

## Exit gate verdict

- Gate passes: the card exceeds the viewport at both widths, the citations list has no scroll path, and the dismiss control leaves the viewport.
- Root cause confirmed in browser: uncapped `.coach` (`practiceCoach.css:6-19`) plus uncapped `.coach-citations ul` (`:137-143`).
