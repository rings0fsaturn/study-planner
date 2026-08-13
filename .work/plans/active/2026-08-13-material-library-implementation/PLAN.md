# PLAN — 2026-08-13 Material Library and Attachment (wayfinder #36)

## Context

- GitHub ticket **#36 Material Library and Attachment** (Phase 2 map #4, spec #32) is the
  first production vertical slice of the Material Library.
- The UI contract is issue **#33** and its Q1–Q22 locked decisions
  (`.work/plans/active/2026-08-13-material-library-ux-refinement/PLAN.md`).
- The contract pack (`services/intelligence/contracts/phase2/`) is the implementation
  authority for material objects and boundaries.

## Boundary decision (recorded deviation from the draft plan)

- Materials are **server-owned Supabase rows** (migration `004`), owner-scoped by RLS,
  accessed through a typed dependency-injected `MaterialClient`.
- The Intelligence Service **does not** get material endpoints in this ticket: the
  contract's `POST /v1/materials` creates an ingestion `AsyncJob`, which belongs to
  ticket **#37 (ingestion execution)**; the service currently has no database
  connectivity. This keeps the slice reviewable and contract-aligned.
- `#36` records create rows in `pending`; `#37` wires extraction/chunking/embedding.
- Replace keep-ID bumps `content_version` and sets `replaced_at` so dependent content
  is recognizable as stale (regeneration boundary stays in #38).

## Scope

- `apps/app/supabase/migrations/004_materials_table.sql` — materials table, RLS, indexes.
- `apps/app/src/materials/` — types, `MaterialClient` (normalized typed errors), provider,
  library hook, status/progress badges, reusable `MaterialPicker`, CSS.
- `apps/app/src/pages/materials/` — library, detail (readiness-led), create, practice-this.
- Routes `/materials`, `/materials/new`, `/materials/:materialId`,
  `/materials/:materialId/practice`; nav entry; dev prototype route removed.
- `e2e/material-library-live.spec.ts` — desktop + mobile live round trips.
- `.work/` plan + verification + STATUS row.

## Non-goals

- Ingestion execution (#37), assessment generation (#38), taking/grading (#39),
  practice generation/guide (#44+), mastery, roadmap feedback, community.
- Dexie/local-first material cache (server is authoritative; offline read-only cache
  deferred with #37/#38); no new durable events (assessment pointer events are #38).

## Verification

- `pnpm --filter app typecheck` and `pnpm --filter app lint` clean.
- Focused material tests (client, picker, library, detail, create, practice) green.
- Full app suite green (610 tests, `--pool=forks`).
- `pnpm --filter app build` green.
- Migration pushed to the dev Supabase project (`supabase db push`), table reachable,
  create/delete round trips exercised live at desktop and 390×844 with zero page errors.
