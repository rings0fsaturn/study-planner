# VERIFICATION — 2026-08-13 Material Library and Attachment (#36)

## Acceptance criteria (from issue #36)

- [x] Material records are owner-scoped and support the approved source types
      (`manual`, `url`, `youtube`, `file`) and contentless planning state.
      Migration `004` (RLS, `auth.uid()` checks, per-user indexes), typed client,
      contentless manual materials create with empty source and render a
      "contentless (planning only)" marker.
- [x] Library, detail, archive/restore, and responsive picker flows work on mobile
      and desktop. Verified by unit/component tests and live E2E at desktop and
      390×844 (2/2 passed, zero page errors).
- [x] Assessment and Practice entry points attach one or more materials without
      duplicating entities. The reusable `MaterialPicker` returns material ids;
      the attachment payload (materialIds) is ready for #38. Non-ready rows are
      disabled and open detail instead of dead-ending (Q18).
- [x] Cross-user access and account switching are covered by tests. RLS policies
      are declared in the migration (read/insert/update/delete all require
      `auth.uid() = user_id`); the client classifies ownership violations
      (`42501`) as `unauthorized`; `materialClient.test.ts` has an explicit
      session-aware test that creates a row as user A, proves user B sees an
      empty library and a `not_found` on A's row, then switches back to A.

## Verification evidence (2026-08-13)

- `pnpm --filter app typecheck` ✅ clean.
- `pnpm --filter app lint` ✅ clean (0 errors).
- Focused tests: material client (15 incl. cross-user/account-switch), picker (8),
  library (8), detail (10 incl. replace with each source kind), create (5),
  practice-this (3) — 49/49 green.
- Full app suite: **612/612** tests, 68 files (`--pool=forks`).
- `pnpm --filter app build` ✅ (large-chunk notice is pre-existing).
- Migration applied to the dev Supabase project via `supabase db push`
  (003 re-applied idempotently; 004 created `public.materials`; REST probe 200).
  `apps/app/supabase/config.toml` added so the CLI can resolve the project.
- Live E2E `e2e/material-library-live.spec.ts` (credentials via env only,
  skipped when unset; AGENTS.md credential rule):
  - Desktop: create contentless manual material → detail shows Pending +
    "Grounded generation is disabled" → back to library → picker shows the row
    disabled with a View link → View opens detail → delete via confirm dialog →
    back at library, row gone. Zero page errors.
  - Mobile 390×844: create → detail → delete round trip. Zero page errors.
  - Account left clean (0 leftover materials; debug rows removed).
- Dev-only prototype route `/material-library-prototype` removed from `App.tsx`
  (prototype sources remain for reference, issue #33).

## Review fixes (code-review pass, 2026-08-13)

- Replace flow used an invalid `'text'` kind (DB CHECK and `MaterialSourceKind`
  only allow `manual`); the flow now shares `SOURCE_FIELDS`/`SOURCE_LABELS` with
  create, uses `'manual'`, and is covered by a manual-replace test.
- Detail "Used by" no longer derives usage from `MaterialAdded` events (library
  ids and onboarding material ids are distinct id spaces); the section honestly
  states attachments arrive with the assessment slice (#38) and the delete
  confirm keeps the affected-references list seam for when links exist.
- E2E spec no longer carries credential fallbacks (AGENTS.md).
- Create copy for the file source no longer promises upload before #37.

## Known boundaries

- Ingestion stays at `pending`/`failed` until #37 wires the pipeline; retry resets
  to `pending` and marks for re-processing.
- "Regenerate" for stale dependent content appears with #38; the detail page
  explains the boundary instead of showing a dead button.
- Assessment-creation continues from the picker selection in #38; the library
  shows a selection notice rather than a fake assessment.
