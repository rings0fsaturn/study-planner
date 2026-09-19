---
name: Study Tracker
description: A quiet, paper-and-ink study companion that mirrors discipline rather than enforcing it.
colors:
  fired-clay: "#B85C38"
  fired-clay-deep: "#8E4429"
  quiet-moss: "#4A6B3A"
  moss-soft: "#7A9362"
  rust-ink: "#A0432A"
  clay: "#C28E5A"
  cream-paper: "#F5EFE4"
  paper-deep: "#EDE3D2"
  card: "#FBF7EE"
  warm-ink: "#2A1F18"
  ink-soft: "#5C4D40"
  ink-faint: "#6F6252"
  rule: "#D9CDB8"
  rule-soft: "#E6DCC8"
  streak-0: "#EDE3D2"
  streak-1: "#B8C79C"
  streak-2: "#8EA872"
  streak-3: "#658A52"
  streak-4: "#4A6B3A"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "clamp(32px, 5vw, 48px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Fraunces, Iowan Old Style, Charter, Georgia, serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Tight, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.06em"
    textTransform: "uppercase"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
spacing:
  "0": "0"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  "9": "96px"
components:
  button-accent:
    backgroundColor: "{colors.fired-clay}"
    textColor: "{colors.cream-paper}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-accent-hover:
    backgroundColor: "{colors.fired-clay-deep}"
  button-primary:
    backgroundColor: "{colors.warm-ink}"
    textColor: "{colors.cream-paper}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "11px 12px"
  button-ghost-dark:
    backgroundColor: "transparent"
    textColor: "{colors.cream-paper}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.rust-ink}"
    rounded: "{rounded.md}"
    padding: "11px 12px"
  button-sm:
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  field:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-inverted:
    backgroundColor: "{colors.warm-ink}"
    textColor: "{colors.cream-paper}"
    rounded: "{rounded.lg}"
    padding: "24px"
  tag:
    backgroundColor: "{colors.paper-deep}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  chip-selected:
    backgroundColor: "{colors.warm-ink}"
    textColor: "{colors.cream-paper}"
    rounded: "{rounded.pill}"
  sync-indicator:
    backgroundColor: "{colors.paper-deep}"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  choice:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Study Tracker

## Overview

**Creative North Star: "The Reading Room"**

Study Tracker is the calm, well-lit reading room you keep your study in: cream paper, warm ink, hairline rules, and a quiet serif voice. Surfaces are laid down, never floated; the interface reads like a well-set book page, not a SaaS dashboard. Attention belongs to the work the learner chose, so the room stays still: no glass, no glow, no motion that does not mean something, no decoration that does not carry information.

Density is the discipline. Marginalia errs toward dense over airy, like a book page rather than a magazine spread; the one exception is the marketing site, which gets the magazine treatment. Color is the rarest resource in the room. Nearly everything is monochrome paper-and-ink, and the three accents are reserved for the moments where they carry meaning: Fired Clay means "act on this," Quiet Moss means "you're good," Rust Ink means "pay attention." If everything is emphasized, nothing is.

The product mirrors discipline rather than enforcing it. The streak calendar is the signature surface: a year of days the learner can read at a glance, surviving roadmaps, completions, and abandonments. Statistics are honest and provisional where they must be. Errors tell the truth about what is safe. The interface never nags, gamifies, or guilt-trips, and it never claims an AI tell.

**Key Characteristics:**

- Paper, not glass; cream backgrounds with warm near-black ink and hairline rules.
- Serif headlines (Fraunces) lead; serif stats feel weighted, not flashy; mono is reserved for metadata.
- Dense like a well-set book page; the marketing site is the one magazine exception.
- Color carries meaning only: Fired Clay (act), Quiet Moss (good), Rust Ink (attention).
- Honest states: provisional projections, truthful errors, local-first trust.

## Colors

A warm, earthen palette on cream paper. Accents are few and reserved for meaning; neutrals carry the room.

### Primary
- **Fired Clay** (#B85C38): the single action accent. "Start now" buttons, links, the active nav icon, the current-step dot. It means "act on this," and it appears once per screen at most.
- **Fired Clay Deep** (#8E4429): hover and pressed states of Fired Clay; the safe accent text color below 14px on cream.

### Secondary
- **Quiet Moss** (#4A6B3A): status good. On-track verdicts, streak cells at the top of the ramp, sync-idle dot, the "ideal pace" chart line.
- **Moss Soft** (#7A9362): muted moss for chart lines and secondary good-status marks.

### Tertiary
- **Rust Ink** (#A0432A): pay attention. Behind-pace verdicts, error borders, destructive text actions, sync-failure dot, warning banners.
- **Clay** (#C28E5A): the eyebrow text on inverted (ink) surfaces; the warmest neutral in the room.

### Neutral
- **Cream Paper** (#F5EFE4): the page background and the light side of every inverted pairing (AA 14.8:1 with Warm Ink).
- **Card** (#FBF7EE): the surface of cards, the bottom nav, and the desktop nav bar; one step lighter than the page.
- **Paper Deep** (#EDE3D2): recessed surfaces, chip and tag grounds, the streak ramp's empty cell.
- **Warm Ink** (#2A1F18): primary text, inverted card surfaces, primary buttons, selection borders. It is warm, never pure black.
- **Ink Soft** (#5C4D40): secondary text (AA 7.5:1 on paper).
- **Ink Faint** (#6F6252): tertiary text and metadata (AA 4.66:1 on the darkest surface it sits on, Paper Deep; 5.18:1 on Cream Paper, 5.54:1 on Card); the floor for small text.
- **Rule** (#D9CDB8): default hairlines and dividers.
- **Rule Soft** (#E6DCC8): subtle hairlines, progress-bar track, calendar week bands.

### Streak Ramp
- **streak-0** (#EDE3D2) to **streak-4** (#4A6B3A): the five-level cream-to-moss day buckets for the streak calendar (0 / under 15m / 15-45m / 45-90m / 90+ minutes).
- Measured adjacent separations (1.41 / 1.46 / 1.51 / 1.54:1) sit below the 3:1 non-text contrast target, and cannot reach it: five stops spanning cream to moss need an 81x luminance range, and even a black endpoint caps any uniform five-stop ramp at ~1.9:1 between neighbours. Level is therefore also carried by a non-color channel, the inset hairline every cell and legend swatch shares. Do not "fix" the ramp by darkening it toward black; that abandons the fixed cream-to-moss shape the Streak Ramp Rule pins.

### Named Rules
**The Meaning-Bearing Accent Rule.** Fired Clay means act on this. Quiet Moss means you're good. Rust Ink means pay attention. If a color appears for any other reason, for "visual interest," for "warmth," to "break things up," it does not belong here.

**The Quiet-by-Default Rule.** Most of the UI is monochrome paper-and-ink. Color is reserved for the few moments where it carries meaning: the Up-next card, a behind-pace verdict, a re-plan call to action. If everything is emphasized, nothing is.

**The Streak Ramp Rule.** Buckets are thresholds, not quotas. A learner who studied 14 minutes still gets a level-1 cell; they showed up. The ramp shape (cream to moss in five levels) is fixed.

## Typography

**Display Font:** Fraunces (Iowan Old Style, Charter, Georgia, serif)
**Body Font:** Inter Tight (system sans fallbacks)
**Label/Mono Font:** JetBrains Mono (ui-monospace, SF Mono, Menlo, monospace)

**Character:** A serif field-journal headline with a quiet, slightly squarer sans body and a narrow mono for metadata. The pairing is literary but restrained: Fraunces gives numbers and headlines weight without shouting; the mono keeps labels and timestamps calm and legible.

### Hierarchy
- **Display** (Fraunces 500, clamp(32px, 5vw, 48px), line-height 1.05, -0.02em, opsz 144): hero headlines on the marketing site. Rare in the app.
- **Headline** (Fraunces 500, 28px, line-height 1.15, -0.015em, opsz 96): page titles and the greeting.
- **Title** (Fraunces 500, 22px, line-height 1.2, -0.01em, opsz 48): card titles and section headings.
- **Body** (Inter Tight 400, 15px, line-height 1.5): primary reading text; body prose never tighter than 1.5 because this is a reading product.
- **Label** (JetBrains Mono 500, 11px, uppercase, 0.06em): metadata, timestamps, units, eyebrow lines, stat labels. Mono caps is the only place caps belong.
- **Mono Small** (JetBrains Mono 500, 10px, uppercase, 0.08em): the smallest tier, for eyebrow captions and ultra-compact metadata.

### Named Rules
**The One Italic Rule.** Italic Fraunces appears once or twice per screen, never more. Allowed in three places: a single emphasized word inside a display headline ("a quiet companion"), an italic Fraunces subtitle under a display headline, and the weekly-narrative pull-quote. Anywhere else it is a designer flourish, and this system does not do those.

**The No-Bold Rule.** No weight 700 or higher anywhere. The brand voice does not shout. If a heading needs more weight, scale up the size or use the italic accent; do not reach for bold.

**The Mono-Metadata Rule.** Stats are serif, never mono. Mono is reserved for labels, timestamps, units, and eyebrow lines. Proportional numerals jitter in stats; use tabular figures. ALL CAPS belongs only to mono labels.

## Layout

Mobile-first up to 1024px, where the phone shape is preserved exactly; centered with cream margins on tablets. Above 1024px exactly four screens earn a genuine desktop layout (active session with centered video, onboarding materials + preview two-column, re-plan as three side-by-side cards, weekly progress as a magazine split). Every other screen stays column-shaped, centered, at a 640-680px max width with type scaled up via clamp().

Spacing follows a 4px-based scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. The rhythm is tight and deliberate; vertical space is the first divider between groups, and an actual rule is reached for only when spacing alone is not enough signal. Edge gutters are 16px on phones. Containers: narrow 640px, default 880px, wide 1240px.

### Named Rules
**The Density Rule.** When two values look acceptable, pick the smaller one. Marginalia errs toward dense over airy, like a well-set book page, not a magazine spread. The marketing site is the one magazine exception.

**The Vertical-Space-First Rule.** Vertical space alone is the first divider. Reach for an actual rule only when the spacing is not sufficient signal, typically between a content block and a different kind of content (settings group to next group, materials list to schedule preview).

**The Column-Shape Rule.** Mobile shape is preserved exactly up to 1024px. Only four screens get genuine desktop layouts; everything else stays column-shaped at 640-680px. Treating every screen as a responsive rearrangement is busy work.

## Elevation & Depth

The system is flat by default and "laid down" rather than floated: cream surfaces separated by hairlines and tonal steps (page, card, recessed), not by shadows. Shadows exist, but they are warm and gentle, built from the ink color at low opacity, and capped at three levels. Frosted glass, neon glows, and dark-mode-by-default are absent by doctrine.

### Shadow Vocabulary
- **shadow-sm** (`0 1px 0 rgba(42,31,24,0.04), 0 2px 4px rgba(42,31,24,0.04)`): resting elevation for elevated cards and default buttons.
- **shadow-md** (`0 1px 0 rgba(42,31,24,0.05), 0 6px 16px rgba(42,31,24,0.06)`): hovered or raised surfaces.
- **shadow-modal** (`0 1px 0 rgba(42,31,24,0.05), 0 24px 48px -16px rgba(42,31,24,0.18)`): the one elevated moment, for modals.
- **shadow-inset-faint** (`inset 0 0 0 1px rgba(42,31,24,0.04)`): subtle inset definition for recessed wells.

### Named Rules
**The Warm Shadow Rule.** Shadows are warm, built from the ink color at low opacity, never pure black. A pure-black shadow on cream paper looks like a Photoshop drop-shadow; a warm shadow looks like an object resting on a desk.

**The Paper-Not-Glass Rule.** No frosted glass, no neon glows, no dark-mode-by-default. Studying is a slow, considered activity; the interface should feel that way too.

**The Three-Level-Ceiling Rule.** Two shadows plus one for modals. If a third level of elevation feels needed, the hierarchy is wrong: fix the hierarchy, do not add another shadow.

## Shapes

Gentle, organic radii on a small scale: 6px (small), 10px (default), 16px (large cards), 24px (extra-large), and 999px for pills (tags, chips, sync indicator, progress). Borders are hairlines (1px) in rule tones; the focus and selection stroke is 2px Warm Ink. Form language is quiet: rounded rectangles and pills only, no clipped corners, no chamfers, no drawn silhouettes.

### Named Rules
**The Border-Thickens, Card-Doesn't-Grow Rule.** When a card uses a 2px border to signal selection, its internal padding shrinks by 1px so the visual weight stays identical to the unselected state. The border thickens; the card does not grow.

## Components

### Buttons
- **Shape:** rounded rectangles, 10px (6px small). Ink-on-cream, calm, tactile: pressing moves the button down 1px.
- **Accent (Fired Clay):** the one action the user is most meant to take on the screen. Maximum one per screen; the Up-next card's "Start now" is the canonical owner.
- **Primary (Warm Ink):** the safe default, save, confirm. Most screens have one.
- **Secondary:** transparent with a rule border; alternative actions, cancel, edit, manage.
- **Ghost:** transparent, ink-soft text; tertiary actions, skip, dismiss, back.
- **Ghost-dark:** on inverted surfaces only (the Up-next card).
- **Destructive:** transparent, Rust Ink text; sign out, abandon roadmap, delete account.
- **Hover / Focus:** background shifts 160ms on hover; focus is a 2px Warm Ink outline with 2px offset via `:focus-visible` only. Small size: 13px type, 6px radius, 7x12px padding.

### Fields
- **Shape:** rounded rectangles, 10px, cream-paper background on a rule border.
- **Label:** always a mono caps label above the field, never floating, never placeholder-only.
- **Focus:** border turns Warm Ink with a faint ink halo (0 0 0 3px ink at 6%). Error: Rust Ink border and halo; the helper line below carries the message.
- **Disabled:** paper-deep background, ink-faint text.

### Cards / Containers
- **Corner Style:** 10px default; 16px for large and inverted cards.
- **Background:** Card (#FBF7EE) with a rule-soft border; elevated cards drop the border for shadow-sm; inverted cards are Warm Ink with cream text, 24px padding.
- **Internal Padding:** 16px default, 24px large/inverted.
- **Anatomy:** mono-caps eyebrow (when/then), Fraunces title (what), body meta (how long), action row.

### Tags & Chips
- **Tag:** paper-deep pill, ink-soft text; carries state, never action, never tappable. Colored variants (moss/rust/clay) are translucent tints of the accent.
- **Chip:** card pill, ink-soft text; the tappable selection control. Selected is Warm Ink with cream text. Use chips for 2-5 short options; six or more becomes a select. Multi-select chips are not part of the system.

### Navigation
- **Shape:** six destinations, no nesting: Home, Session, Week, Roadmaps, Materials, Settings. Session and Materials were earned as first-class destinations in phase 2 (the active-session flow and the materials library); each new destination must be earned the same way, by proving it needs its own surface rather than living inside an existing one. Hamburger menus do not exist.
- **Mobile:** fixed bottom bar, icon + mono caps label per item (9-10px). Active item is Warm Ink with a Fired Clay icon; inactive is ink-faint.
- **Desktop:** sticky top bar with the italic Fraunces wordmark on the left, text tabs, and the sync indicator in the corner. Active tab is a Warm Ink pill with cream text.
- **Active state:** identical meaning across both layouts.

### Sync Indicator
- **Shape:** a small paper-deep pill, mono caps, dot + label, in a corner, never the headline.
- **States:** idle (moss dot), syncing (fired-clay dot, pulsing), failed (rust dot), offline (ink-faint dot). Tappable to force a pull; aria-label announces state and action.

### Modals
- **Shape:** bottom-sheet on mobile, centered on desktop; warm-ink backdrop at 40%, card on cream, never glass.
- **Use:** rare, at most three named moments in v1 (walk-away, recalibration, restore-on-new-device). Anything else is a banner, a screen, or a settings row. Choices inside modals are clearly priced option rows, never free-text prompts.

### Banners
- **Shape:** a row of vertical space at the top of the screen that pushes content down; 3px colored left edge carries urgency; a small dismiss button closes it.
- **Kinds:** neutral, attention (terracotta edge), success (moss edge), warning (rust edge).
- **Behavior:** banners never overlay content; toast-style floats are not part of the system.

### Charts
- **Burn-up:** three lines with fixed meaning, ink actual, moss ideal, terracotta dashed projection; read at a glance, not studied.
- **Daily bars:** 7-day bars, no y-axis labels; the header carries the week total. Unusual days render in terracotta.

### Signature Component: Streak Calendar
- **Year grid:** 53 columns by 7 rows, a year of days, each cell aspect-ratio 1, radius 2px, 3px gap (2px compact), tinted by the five-level streak ramp. It never resets: sessions persist across roadmap completions, abandonments, and gap years. Tooltip on hover shows date and minutes.
- **Mini-week:** a 7-cell row for the weekly progress screen; day letters sit inside the cells and stay legible on every ramp level (pale on dark greens, ink on cream). Today is marked with a 1.5px inset ink border.

### Named Rules
**The One Inverted Card Rule.** One inverted card per screen, maximum. The Up-next card on home, or the "selected to cut" total in trim-scope. If two screens both want one, the screen has too much going on.

**The One Accent Button Rule.** The Up-next card carries the only accent button on the screen. Other screens may have an accent button, but never alongside this one. The hierarchy is clear: today, this is what matters.

**The Six-Destination Rule.** Six destinations, no nesting: Home, Session, Week, Roadmaps, Materials, Settings. Each new destination is earned by proving it needs its own surface; until then it lives inside an existing one. Hamburger menus are not part of this system.

**The No-Spinner Rule.** No spinning circle. Spinners signal "wait"; this app signals "here's what's happening" (three pulsing dots plus a calm title and an italic sub-line). The user is allowed to leave during processing; progress is preserved.

**The Empty-State Rule.** An empty state always has a title, body, and action. Two of three is incomplete. If there is genuinely no action, the body has to acknowledge that and say when the state will change.

**The Tags-Carry-State Rule.** Tags carry state, not action, and are never tappable. If something needs to be tappable, use a chip or a button.

**The Progress-Is-a-Glance Rule.** Progress bars are 6px tall, no taller. They are a glance at status; the headline is the projected-finish stat.

**The Modals-Are-Rare Rule.** Modals are rare, at most three named moments in v1. An interruption asked for is twice as expensive as one we earned.

## Do's and Don'ts

### Do:
- **Do** lead each screen with the day's one job, with the Up-next card as the single block of strong contrast.
- **Do** let the streak calendar carry the long view; sessions persist across roadmaps.
- **Do** keep color semantic: Fired Clay to act, Quiet Moss for good, Rust Ink for attention, and nothing else.
- **Do** set stats in Fraunces with tabular figures and mono caps labels; the numbers should feel weighted, not flashy.
- **Do** keep the sync indicator small and in a corner.
- **Do** tell the truth in error states: what is broken, what is safe locally, and one concrete action.
- **Do** deliver focus with a 2px Warm Ink ring via `:focus-visible` only, and keep touch targets at 44px minimum on mobile.
- **Do** respect `prefers-reduced-motion`: non-essential animation collapses to instant state changes.

### Don't:
- **Don't** use weight 700 or higher on any face, anywhere.
- **Don't** use mono for body prose or for stat numbers; stats are serif.
- **Don't** use italic Inter Tight; italics are a Fraunces-only move, once per screen.
- **Don't** use display sizes without adjusting `opsz`; Fraunces at 48px with opsz 9 looks broken.
- **Don't** use proportional numerals in stats; they jitter when values change.
- **Don't** use ALL CAPS in body sans; caps belong to mono labels only.
- **Don't** use emoji as decoration in headlines or stats, and never sparkles or robot avatars; the brand explicitly disallows AI-tell ornament.
- **Don't** set body prose line-height tighter than 1.5; this is a reading product.
- **Don't** use decorative icons; an icon must save a word, label a control, or carry status.
- **Don't** add a third shadow level; fix the hierarchy instead.
- **Don't** ship Fired Clay as text below 14px on cream; use Fired Clay Deep. Verified contrast wins over assumed contrast (WCAG 2.1 AA minimum, AAA on body where the palette already gets there).