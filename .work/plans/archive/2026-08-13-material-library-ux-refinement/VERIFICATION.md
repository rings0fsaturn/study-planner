# VERIFICATION — 2026-08-13 Material Library UX refinement

## Acceptance criteria

- [ ] Prototype reflects every Q1–Q22 decision.
- [ ] Losing layout variants + variant-choice UI removed; card grid is canonical.
- [ ] `pnpm --filter app typecheck` clean.
- [ ] `pnpm --filter app lint` clean.
- [ ] Browser desktop + mobile pass across all states with zero console errors.
- [ ] `.work/` updated (plan + STATUS row).
- [ ] Wayfinder map #4 (GitHub) + local mirror `.work/active/map` updated.
- [ ] Issue #33 follow-up comment posted.

## Log

- **2026-08-13** Grilling Q9–Q22 locked via HITL rounds (see PLAN.md). Refined the throwaway prototype to match every decision, updated `.work/`, map #4, and issue #33.

### Verification evidence (2026-08-13)

- `pnpm --filter app typecheck` ✅ clean.
- `pnpm --filter app lint` ✅ clean (0 errors).
- Vite dev server served a stale module on the drvfs mount after the rewrite; `./full-app restart full` fixed it (watcher cannot be relied on there — future sessions should restart after large prototype rewrites).
- **Desktop 1280×900** (headless Chrome via browser-harness CDP): 5 cards rendered (archived hidden), no horizontal overflow, ready cards show "Practice this"; detail opens with primary Practice + lower Replace keep-ID / Archive / Delete; delete view leads with "permanently removes" + 2 listed references; picker renders as right side panel (top 0 → viewport height) with 5 rows, 3 disabled, persistent footer + backdrop; overflow menu shows Archive | Replace keep-ID | Delete and closes via the catcher; Practice-this config page renders (count / focus / difficulty / Start / Add another material); stale banner and failed-retry actions present. Zero console errors (`window.__errs = []`).
- **Mobile 390×844** (deviceScaleFactor 2): single-column grid, spacious cards (padding 20px, 48px icon), no horizontal overflow; picker renders as bottom sheet (top 141 → bottom 844, 16px top radius) with 5 rows / 3 disabled. Zero console errors.
- Screenshots saved to `/tmp/ml-desktop-library.png`, `/tmp/ml-desktop-picker.png`, `/tmp/ml-mobile-library.png`, `/tmp/ml-mobile-picker.png` (not committed; visual review by human recommended — agent model cannot render images).
- GitHub: map #4 decision line updated (Q1–Q22 gist + #33/#36 links); issue #33 follow-up comment posted (https://github.com/rings0fsaturn/study-planner/issues/33#issuecomment-5275217847).

*(Verification evidence appended above.)*
