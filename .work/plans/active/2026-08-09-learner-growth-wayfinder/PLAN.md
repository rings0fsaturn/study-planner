# Learner Growth wayfinder chart — achievements, evidence-backed sharing, community

**Task id:** `2026-08-09-learner-growth-wayfinder`
**Type:** wayfinder charting (planning; destination = implementation-ready spec + prototypes)
**Tracker:** GitHub Issues on `rings0fsaturn/study-planner` (the map + tickets are the canonical artifact; this doc is the `.work/` index/pointer).
**Map:** [#23 Learner Growth map: achievements, evidence-backed sharing, and community (wayfinder)](https://github.com/rings0fsaturn/study-planner/issues/23)

> Independent of the Phase 2 map (#4). The Phase 2 effort's mastery contract (map #4) is an **input** to the mastery/evidence ticket, never duplicated.

## Destination

An implementation-ready specification (product, UX, privacy, and architecture) for three connected learner-growth features: (1) **achievements** — visible feedback on progress, achievements, and mastery (streaks, milestones, awards, growth visual); (2) **evidence-backed sharing** — shareable achievement pages that show *what the learner actually did*, postable to LinkedIn and other social platforms — never generic; (3) **community** — a discussion forum for chat and Q&A. Output: decisions plus working prototypes of the riskiest UX/privacy surfaces; nothing implemented until the spec is approved.

## Decisions locked during charting (grilling)

1. Destination shape — implementation-ready **spec + prototypes**; implementation is a later effort (unless "Scope and release shape" overrides).
2. Ticket set — the 8 clarifying questions charted as the 8 initial child issues (see Tickets).
3. Out-of-scope fence — multiplayer/peer, competitive leaderboards, platform posting APIs, raw event-log exposure, parallel mastery model, anonymous unmoderated posting.
4. Community default — asynchronous Q&A first; chat/DMs out unless "Community scope" says otherwise (recommended default, re-decidable on that ticket).
5. Sharing default — opt-in immutable snapshots, one achievement per link, revocable, anyone-with-the-link visibility (recommended default on "Shareable achievement model").
6. Privacy default — no public profiles initially; individual achievement pages only; per-page consent with hideable evidence fields (recommended default on "Privacy and identity").
7. Mastery integration — achievements consume the Phase 2 mastery projection (`/v1/mastery`, `masteryCache`); no parallel model.

## Tickets

### Frontier (takeable now)

| # | Ticket | Type | Status |
|---|---|---|---|
| [#24](https://github.com/rings0fsaturn/study-planner/issues/24) | Scope and release shape for learner growth features | grilling | ☐ open — **frontier** |
| [#25](https://github.com/rings0fsaturn/study-planner/issues/25) | Achievement model for learner growth features | grilling | ☐ open (← #24) |
| [#29](https://github.com/rings0fsaturn/study-planner/issues/29) | Privacy and identity for public sharing | grilling | ☐ open (← #24) |
| [#31](https://github.com/rings0fsaturn/study-planner/issues/31) | Community scope: Q&A vs chat vs both | grilling | ☐ open (← #24) |

### Blocked (wired, wait for upstream)

| # | Ticket | Type | Blocked by |
|---|---|---|---|
| [#26](https://github.com/rings0fsaturn/study-planner/issues/26) | Mastery and evidence contract for achievements | grilling | #25 |
| [#27](https://github.com/rings0fsaturn/study-planner/issues/27) | Badge and growth UX direction (prototype) | prototype | #25 |
| [#28](https://github.com/rings0fsaturn/study-planner/issues/28) | Shareable achievement model | grilling | #26, #29 |
| [#30](https://github.com/rings0fsaturn/study-planner/issues/30) | Share cards and social distribution | grilling | #28 |

### Fog (not yet specified) / see map

Community information architecture · moderation and safety model · community UX prototype · public projection + backend schema (Supabase tables/RLS/storage) · achievement computation and cache strategy · notifications and engagement · search and discovery · evaluation metrics and rollout/migration strategy.

### Out of scope / see map

Multiplayer/peer · competitive leaderboards and public rankings · DM and real-time chat (unless #31 pulls them in) · platform-specific posting APIs · raw event log / private assessment answers on public links · parallel mastery model · anonymous unmoderated posting.

## How to continue

Run `/wayfinder 23` (optionally naming a ticket). One decision ticket per session; no research tickets charted. Frontier query: `gh issue list --label wayfinder:learner-growth --state open`. Claim a ticket by assigning it to yourself first.
