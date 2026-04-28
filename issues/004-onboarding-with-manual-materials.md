---
title: Onboarding with manual-only materials produces a roadmap
type: AFK
blocked_by: [2]
covers_user_stories: [8, 11, 12, 13, 15]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

A new user signs in for the first time and is walked through a multi-step onboarding flow: pick a deadline, set weekly study hours, add at least one study material (manual entry only at this slice — URL paste comes in slice 6), preview the generated session breakdown, and commit. Committing emits `OnboardingCompleted`, `RoadmapCreated`, and one or more `MaterialAdded` events. After commit, `/study/home` shows the projected finish date and days-until-deadline alongside the activity list from slice 2.

The preview step is editable — the user can adjust the proposed session breakdown before committing. Desktop layout uses a two-column arrangement for the materials and preview steps; mobile stays single-column.

## Acceptance criteria

- [ ] A first-time user (no `OnboardingCompleted` event in their EventStore) is routed to `/study/onboarding` instead of `/study/home`
- [ ] Onboarding captures: deadline date, weekly study hours, and at least one manual-entry material with title and estimated duration
- [ ] The preview step shows a session breakdown derived from the inputs; the user can edit it before committing
- [ ] On commit, `OnboardingCompleted`, `RoadmapCreated`, and `MaterialAdded` events are appended (and synced via slice 3)
- [ ] After onboarding, `/study/home` shows the projected finish date and days-until-deadline
- [ ] A user with `OnboardingCompleted` already in their store skips onboarding on subsequent sign-ins
- [ ] Desktop layout for the materials and preview steps is two-column; mobile is single-column
- [ ] Onboarding screens use design-system primitives
- [ ] Tests cover: first-time routing, onboarding completion event sequence, projection appearing on Home after commit, edit-preview round-trip
- [ ] An end-to-end test walks the full onboarding flow and verifies Home shows projection afterward

## Blocked by

- Blocked by #2
