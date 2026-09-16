---
target: home page refresh
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/mnt/d/study/git/study-planner-web/apps/app/src/pages/Home.tsx"
target_fingerprint: "sha256:fe174ae18259c2269bf0320d362e19c670dc75139cbcc2809b206ba6c697ba26"
target_path: /mnt/d/study/git/study-planner-web/apps/app/src/pages/Home.tsx
timestamp: 2026-09-16T14-12-30Z
slug: apps-app-src-pages-home-tsx
---
# Critique: Home page (refresh re-run)

Method: dual-agent (A: ses_f5579d905ffevtNtKjxVEXL1i1 · B: ses_f5579a365ffezQVP9xm4fUbM). Target slug: apps-app-src-pages-home-tsx.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sync pill + plain-language banners; up to three role="status" regions can stack |
| 2 | Match System / Real World | 3 | Voice calibrated; "16% complete" and "1 hr 20 min" violate its own format lexicon |
| 3 | User Control and Freedom | 2 | Recalibration/service banners not dismissible; sign out is one unguarded tap |
| 4 | Consistency and Standards | 2 | Token discipline near-flawless; heading scale inverted, ServiceStatusBanner is a non-banner shape, Settings ignores its composite |
| 5 | Error Prevention | 2 | Unusual toggle reversible (aria-pressed); 28px flag target invites mis-taps |
| 6 | Recognition Rather Than Recall | 2 | "12 days late" requires recalling the deadline; double-dated activity rows |
| 7 | Flexibility and Efficiency | 2 | Sync pill + inline toggle are accelerators; no history view, no keyboard path into the year grid |
| 8 | Aesthetic and Minimalist Design | 2 | Quiet by default holds; banner stacks, two hero actions on rest days, orphaned stat strip |
| 9 | Error Recovery | 3 | "Your sessions are safe on this device"; no concrete action offered |
| 10 | Help and Documentation | 2 | Legend + "provisional" educate; nothing explains the year grid or the deadline referent |
| **Total** | | **23/40** | **Acceptable (was 22/40)** |

## Design Specificity Verdict

The refresh moved the page from "a Marginalia-skinned admin dashboard" to an authored surface. The projection row ("Projected finish · provisional" with a confidence range), "A planned rest day.", the plain-language pace banner, and a streak ramp that counts a 14-minute day as level 1 are decisions only a study mirror would make. The calendar survives roadmap completion by construction. Two corporate-dashboard residues remain: "% complete" and "1 hr 20 min" durations.

Deterministic scan: `impeccable detect` exited 0 with an empty array; TSX regex mode cannot validate contrast/semantics, so this is not a clean bill of health. All real findings are static, listed below.

## Overall Impression

The hierarchy work landed: one job, one accent, one honest projection. The remaining problems are mostly systemic (token contrast, touch targets, a11y semantics) plus three things the refresh itself exposed: the no-roadmap page is hollow, the signature surface has no heading and is invisible to assistive tech, and Sign out now sits unguarded in a skeleton Settings page.

## What's Working

1. The projection row: one serif number, mono label, honest "provisional", verdict in words and moss/rust (Home.tsx:322-341).
2. The streak ramp honors its ethics: thresholds not quotas, "No streak" without judgment, lifetime habit independent of the roadmap (streak.ts:120-168).
3. Plain-language honesty in the pace banner (ServiceStatusBanner.tsx:8-15).

## Priority Issues

**[P1] Two accent buttons when a roadmap has ended** (RoadmapEndedBanner.tsx:31 + Home.tsx:282). The One Accent Button Rule is the hierarchy mechanism; demote "Extend deadline" to primary, or suppress the up-next card in the ended state. `$impeccable quieter`

**[P1] Heading-scale inversion on the signature surface.** "Last 12 months" (16px, no heading element) vs "Recent activity" (22px h2). Promote the streak title to Title tier and demote Recent activity. `$impeccable typeset`

**[P1] No-roadmap Home is a hollow page.** With no active roadmap the hero vanishes and progress is null, violating the Empty-State Rule (title/body/action). The reference's "No active roadmap yet · Create a roadmap" state is missing. `$impeccable onboard`

**[P2] Settings is a skeleton and Sign out is a landmine.** One ungrouped destructive button, no identity row, no consequence line, against the documented Settings composite. `$impeccable harden`

**[P2] Projection verdict without its referent.** "12 days late" with no deadline on screen forces recall; fold the deadline into the label. `$impeccable clarify`

**[P2] Token-level contrast defect.** text-tertiary (#8B7B6B) measures 3.57:1 on paper and 3.82:1 on card, not the 4.5:1 DESIGN.md claims; it fails AA at the small mono sizes used throughout Home, StreakCalendar, NavBar, SyncIndicator. The ink-faint token needs to darken. `$impeccable audit`

**[P2] Streak ramp is not luminance-separable.** Adjacent levels: 1.22-1.91:1; level is encoded by background color alone. Today's inset border is the one non-color state. `$impeccable harden`

**[P3] Year grid invisible to assistive tech and blind-scroll on mobile.** Cells are title-only divs, no role/aria-label, no heading; min-width 600px scrolls ~6 months off-screen on a phone. `$impeccable harden`

**[P3] Touch targets under the 44px commitment.** Flag toggle ~28px (Home.tsx:413-425), sync pill ~23px, btn-destructive ~37px, btn-sm ~27px. `$impeccable adapt`

**[P3] Formatting violations of the system lexicon.** "16% complete" and "1 hr 20 min" vs "5h of 32h" / "1h 20m". `$impeccable distill`

## Persona Red Flags

- Alex: 3-row activity cap with no history surface; no tap-through from the year grid; no desktop accelerators.
- Sam: the signature surface is silent (no cell aria-labels, no role="grid"); no skip link; no aria-current in nav; 18-28px targets; stacked status regions read in sequence.
- Casey: year calendar is a horizontal swipe with no hint and no per-day tap; banner stacks can push the accent below the fold.
- Maya: largely served; "12 days late" without context can't be honestly read; post-completion home is hollow; greeting uses the raw email local-part.

## Minor Observations

- Home.tsx:311-355 recreates card styling inline instead of using Card.
- StreakCalendar legend left-aligned vs reference right-aligned; year-span header missing; cells lack the inset hairline.
- Eyebrow + title repeat "Study session".
- Loading is a bordered text row, not the three-dots processing pattern.
- pulse-sync ignores prefers-reduced-motion.
- No path from the year calendar to the weekly review.
