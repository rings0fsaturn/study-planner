# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Self-directed learners working through structured material toward a self-chosen
deadline: courses, textbooks, long PDFs, video series, articles. They already
bring the discipline; they want a respectful record of it, not a coach enforcing
it. Desktop is the primary studying surface (reading, video sessions, re-plan
deliberation, weekly review); mobile is the convenience surface for logging,
glance-checks, and reminders. The project is also an M.Tech dissertation
vehicle, so researchers and review panels are a secondary audience for the same
product.

## Product Purpose

Plan a roadmap of study materials, book and log study sessions, and see an
honest projection of finishing. The product ingests the learner's own
materials, turns them into grounded assessments and guided practice, grades the
work server-side, and feeds the resulting per-skill mastery signal back into
pace and roadmap decisions. Success means the learner finishes what they chose
to study, with the app mirroring their actual progress throughout.

## Positioning

A verified closed loop. Assessments grounded in the learner's own materials
produce per-skill mastery signals that recalibrate pace and the roadmap, so
adaptation is evidence-based rather than guesswork. Every generated question
traces back to the learner's sources, and answers are graded server-side with
hidden keys. The whole thing stays a quiet, local-first log that mirrors
discipline instead of enforcing it. A neighbouring study planner can copy the
tracker shell or the generated quiz; it cannot truthfully copy the loop that
turns the learner's own material into verified signals that change the plan.

## Operating Context

Learners study from their own materials: uploaded PDFs, article URLs, YouTube
videos, and manual entries. Long-form reading and video sessions happen at a
desk; quick logging happens on a phone. Sessions are time-boxed against a
planned end, and the weekly review is a reflection ritual rather than a
dashboard. The app installs as a PWA, works offline, and syncs per user across
devices. Assessment and practice flows sit alongside the original session loop:
a learner configures an assessment against ready materials, takes it, reviews
graded answers with explanations and citations, and can run Socratic practice
with hints and gated reveals.

## Capabilities and Constraints

Confirmed functionality:

- Auth (email/password and Google OAuth, email confirmation, password reset).
  Sign-in is required to use the app because mobile Safari can evict local data.
- Onboarding that builds a roadmap from a deadline, weekly hours, and materials
  (article URL, YouTube video, PDF upload, manual entry), with an editable
  preview before commit.
- Roadmap and session loop: capacity-aware booking, active session with a
  planned-end signal, walk-away and stale-session handling, manual past
  logging, replan with extend-deadline / add-hours / cut-scope options, weekly
  progress review with a generated narrative, pace calibration, and finish-date
  projection.
- Materials library: PDF ingestion into retrieval data, PDF viewer, archive,
  contentless materials; readiness gates grounded generation.
- Grounded assessments (objective and written live; coding landing through a
  server-side sandbox), server-authoritative grading, review with citations and
  attempt history, practice runs with Socratic guidance, hints, gated reveals,
  and a mastery projection.
- Local-first Dexie event log per user with write-ahead sync, snapshots, and
  fresh-device restore.

Constraints:

- Web only (installable PWA); no native apps.
- No push notifications, no real-time websocket sync, no CRDT, no social
  features, and no engagement mechanics at v1.
- Heavy ML (calibration, generation, grading, mastery) lives server-side in the
  Intelligence Service as the single source of truth; TypeScript and Python
  engine behavior stays aligned.
- Learner-facing terminology follows `CONTEXT.md`.

## Brand Commitments

- Name: Study Tracker.
- Voice: "A quiet companion for the work you've chosen." It mirrors progress,
  never enforces it. Respectful, honest, unhurried; no pressure, guilt, or
  gamified streak mechanics.
- Marginalia is the committed design system: paper, not glass; book-page
  density over magazine airiness, with the marketing surface as the one
  magazine exception; sparing rust/terracotta and deep-green accents; no glow,
  gradient text, or extra shadow levels. Reference: `design/marginalia.html`;
  implemented tokens in `packages/design-tokens/`.

## Evidence on Hand

- A working three-part product (Astro marketing site, React app at `/study`,
  FastAPI Intelligence Service) with a large automated suite, live E2E specs,
  and captured screenshots under `e2e/` and `.work/`.
- A real grounded corpus used in research: a 572-page ACCA textbook PDF (754
  retrieval chunks) with frozen retrieval-quality baselines and Qwen3 sidecar
  parity gates.
- M.Tech dissertation artifacts under `college/mydeliverables/` (reports, decks,
  IEEE paper) and a research workspace under `research/` (datasets, results,
  claims ledger).
- Absences future work must not fabricate: no real user accounts, testimonials,
  customer metrics, or pricing exist; no analytics is wired; no production
  deployment is confirmed live in-repo (the `studytracker.app` domain in docs is
  a placeholder).

## Product Principles

1. Mirror, never enforce. Show the learner their real studying; never optimize
   for engagement.
2. Adapt only on evidence. Pace, difficulty, and roadmap changes follow verified
   assessment and mastery signals, not guesswork.
3. Ground everything in the learner's own material. Questions, citations, and
   explanations trace back to their sources; hidden keys stay server-side.
4. Local-first honesty. The app works offline, the event log is durable history,
   and sync is a background concern, never a gate.
5. Quiet craft. A well-set page: dense where useful, sparing with accent, honest
   about state including partial results and failures.
