# Study Tracker — v1 implementation issues

Vertical-slice breakdown of `PRD-study-tracker-web.md`, generated via the `to-issues` skill. Each file in this directory is one independently-grabbable unit of work. When a real GitHub repo exists, these can be filed verbatim with `gh issue create --body-file <file>`.

## Slices

| # | Title | Type | Blocked by |
|---|---|---|---|
| 1a | Deploy tracer + design system | HITL | — |
| 1b | Email/password sign-in | HITL | 1a |
| 2 | Log past session + account-switch wipe | AFK | 1b |
| 3 | Sync events + restore on fresh device | AFK | 2 |
| 4 | Onboarding with manual-only materials | AFK | 2 |
| 5 | Active session for manual materials | AFK | 4 |
| 6 | URL materials with metadata fetch | AFK | 4 |
| 7 | Active session with YouTube embed | AFK | 5, 6 |
| 8 | Planned-end ping (NotificationStrategy v1) | AFK | 5 |
| 9 | ProgressEngine + PaceCalibration | AFK | 4 |
| 10 | Re-plan flow with three options | AFK | 9 |
| 11 | Weekly progress with streaming narrative | AFK | 9 |
| 12 | Google OAuth sign-in | HITL | 1b |
| 13 | PWA install (manifest, service worker) | AFK | 1b |
| 14 | Marketing site content | HITL | 1a |
| 15 | Settings, preferences sync, account deletion | AFK | 3 |
| 16 | Password reset + email-confirmation polish | AFK | 1b |
| 17 | Plausible Analytics | AFK | 1b |

## Dependency graph

```
1a ──┬── 1b ──┬── 2 ──┬── 3 ──── 15
     │        │       │
     │        │       └── 4 ──┬── 5 ──┬── 7
     │        │               │       └── 8
     │        │               ├── 6 ──┘
     │        │               └── 9 ──┬── 10
     │        │                       └── 11
     │        ├── 12
     │        ├── 13
     │        ├── 16
     │        └── 17
     └── 14
```

## Parallelization opportunities

- Once **1b** lands, slices 12 / 13 / 16 / 17 can run in parallel with the spine 2 → 3
- Once **2** lands, slices 3 and 4 can run in parallel
- Once **4** lands, slices 5 / 6 / 9 can run in parallel
- Once **9** lands, slices 10 and 11 can run in parallel
- **14** can start any time after 1a and stay decoupled from the app spine entirely

## Hard dependency spine (sequential)

`1a → 1b → 2 → 4 → 9` is the longest critical path. Everything else fans off this spine.

## HITL slices that need scheduling

- **1a** — Vercel projects, DNS, design-system bootstrap
- **1b** — Supabase project provisioning in `ap-south-1`
- **12** — Google Cloud Console + OAuth consent screen
- **14** — copywriting, screenshots, legal review

## Deferred from v1 (per PRD)

- Web Push notifications → v1.1 (NotificationStrategy abstraction in slice 8 keeps the door open)
- Data export → v2
- Apple Sign-In → out of scope
