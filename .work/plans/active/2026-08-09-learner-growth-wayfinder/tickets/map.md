> **Wayfinder map.** This issue is the shared map for the Learner Growth effort (achievements, evidence-backed sharing, community). It indexes the decisions made and points at the child tickets that hold their detail. Child tickets carry a `wayfinder:<type>` label plus `wayfinder:learner-growth`; find the live frontier with the query below.

## Destination

An implementation-ready specification (product, UX, privacy, and architecture) for three connected learner-growth features:

1. **Achievements** — visible feedback on progress, achievements, and mastery: streaks, milestones, awards, and a growth visual (tree, badge collection, or skill map).
2. **Evidence-backed sharing** — shareable achievement pages that show *what the learner actually did* (roadmap, milestones, study period, sessions, scores, mastery evidence), postable to LinkedIn and other social platforms — never generic.
3. **Community** — a discussion forum where learners connect for chat and Q&A.

Output: decisions plus working prototypes of the riskiest UX and privacy surfaces; nothing is implemented until the specification is approved. This effort is independent of the Phase 2 map (#4) and does not extend Phase 2's scope.

## Notes

- **Domain:** `apps/app` (Vite/React), `packages/progress` (derived progress/streak projection), `apps/app/src/events` (event-sourced local-first history), `apps/app/src/sync` (Supabase sync boundary), `apps/app/supabase` (migrations + RLS), `services/intelligence` (future Phase 2 mastery/KT). Achievements are **derived** from existing history and projections — never stored as mutable user claims.
- **Skills every session should consult:** `grilling` + `domain-modeling` for decision tickets; `prototype` for prototype tickets. Repository rules: `30-eventstore-boundaries`, `33-sync-boundaries`, `35-supabase-migrations-and-rls`, `12-react-router-basename`, `13-form-layout`, `14-design-token-package-exports`.
- **Phase 2 integration:** mastery achievements must consume the Phase 2 mastery contract (map #4; `/v1/mastery` projection, `masteryCache`) — do not invent a parallel mastery model. Phase 2's out-of-scope (multiplayer/peer) stays out here too unless a ticket says otherwise.
- **Standing preferences:** the local-first event log stays authoritative and private; community data lives in Supabase, never in the study event log; public sharing is strictly opt-in with per-page consent; moderation and abuse controls land before community launch; mobile-first within the Marginalia design language.
- **Release shape is itself a decision:** ticket "Scope and release shape for learner growth features" chooses spec-only vs spec-plus-implementation vs a staged roadmap.
- **Tracker ops:** child tickets = issues labelled `wayfinder:learner-growth` + a `wayfinder:<type>` label. Frontier query: `gh issue list --label wayfinder:learner-growth --state open` then exclude any with an open "Blocked by:" ref. Claim a ticket by assigning it to yourself before work.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

## Tickets (chart-time frontier)

<!-- GitHub-native tracking of children; authoritative status is each issue's own state -->

| # | Ticket | Type | Blocked by |
|---|---|---|---|
| — | Scope and release shape for learner growth features | grilling | — (frontier) |
| — | Achievement model for learner growth features | grilling | Scope and release shape |
| — | Mastery and evidence contract for achievements | grilling | Achievement model |
| — | Badge and growth UX direction (prototype) | prototype | Achievement model |
| — | Shareable achievement model | grilling | Mastery and evidence contract · Privacy and identity |
| — | Privacy and identity for public sharing | grilling | Scope and release shape |
| — | Share cards and social distribution | grilling | Shareable achievement model |
| — | Community scope: Q&A vs chat vs both | grilling | Scope and release shape |

## Not yet specified (fog)

- **Community information architecture** — spaces, question/answer/comment shapes, search — after "Community scope: Q&A vs chat vs both".
- **Moderation and safety model** — reporting, blocking, rate limits, moderator roles — after "Community scope: Q&A vs chat vs both".
- **Community UX prototype** — after "Community scope: Q&A vs chat vs both".
- **Public projection + backend schema** — Supabase tables, RLS, and storage for share pages and community — after "Privacy and identity for public sharing", "Shareable achievement model", and "Community scope: Q&A vs chat vs both".
- **Achievement computation and cache strategy** — derived projection mechanics and any new event kinds — after "Achievement model for learner growth features" and "Mastery and evidence contract for achievements".
- **Notifications and engagement** — after "Community scope: Q&A vs chat vs both".
- **Search and discovery** — after the community IA decision.
- **Evaluation metrics and rollout/migration strategy** — after the model decisions settle.

## Out of scope

- **Multiplayer / peer study features** (also excluded from the Phase 2 map).
- **Competitive leaderboards and public rankings of learners.**
- **Direct messaging and real-time chat**, unless "Community scope: Q&A vs chat vs both" explicitly pulls them in.
- **Platform-specific posting APIs** — sharing ships as a public URL + cards + share buttons per "Share cards and social distribution".
- **Exposing the raw study event log or private assessment answers** through public links.
- **Replacing or duplicating the Phase 2 knowledge-tracing / mastery model.**
- **Anonymous unmoderated posting.**
