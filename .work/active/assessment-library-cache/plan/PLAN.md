# Plan – assessment-library-cache (cache-first library hubs)

_Spec: `.work/specs/issues/assessment-library-cache.md` · Status: planned, unimplemented · Updated: 2026-10-09_

## Goal

Make `/study/assessments` (and `/study/practice`, same hook) paint instantly from local state on reload.
Keep every contract that made the library shippable: per-user isolation, honest states, typed errors, request-id logging.

## Mechanism being fixed

The hub blocks first paint on `hydrated`, which flips only after the full network waterfall finishes.
`hydrateEnvelopes` does two serial pooled passes at concurrency 4: N detail GETs, then N attempt refreshes.
`hydrateTitles` runs after envelopes and also gates first paint.
The Dexie cache is populated on success but consulted only on failure, so unchanged data still costs the full waterfall.
The fix inverts that order: read local first, paint, then revalidate in background and merge.

## Design

Split `loading` into two signals inside `useLibraryRows`.
Keep `loading` for the true-cold case (no event store, no events yet, zero pointers).
Add `refreshing` (or `revalidating`) for background network work once rows can paint from cache.
Seed `envelopes` plus `rowsByAssessment` from Dexie (`cachedAssessment`, `listLocalAttempts`) synchronously with pointer derivation, before any fetch.
Run `hydrateTitles` concurrently with envelope revalidation and render a neutral pending placeholder (`MATERIAL_TITLE_PENDING`) until titles land; a failed list resolves referenced ids to `MATERIAL_UNAVAILABLE`.
Keep `mergeEnvelopes` as the only merge path so assessment identity stays stable.
Keep the active-subset poll untouched; it already covers `generating` plus in-flight attempts.
Keep `reload()` semantics: retry only ids that failed revalidation, never blank painted rows.
Keep per-user reset exactly as today: envelopes, rows, failures, titles, `hydrated`-equivalent, flow, and owner all reset on account switch.
No new Dexie table, no version bump, no server change in this slice.

## TDD slices (vertical, one behavior at a time)

### P1 – hook behavior in `useLibraryRows.test.tsx`

- Slice 1: cached envelope paints without network success (seed Dexie cache, fail or delay `getAssessment`, expect cached row painted plus `loading` false).
- Slice 2: background revalidation merges fresh envelope over stale cache (stale cached `generating` becomes network `ready`, same identity).
- Slice 3: failed revalidation keeps cached rows and surfaces retry only for failed ids (existing `reload()` contract extended, no blanking).
- Slice 4: account switch still resets cached envelopes (existing user-switch test extended to the cache-seeded path).
- Slice 5: titles resolve late without blocking rows (rows paint with fallback, titles fill in).

### P2 – hook change in `useLibraryRows.ts`

- Implement the minimum for slices 1-5 in order.
- Extract a small `seedFromCache(ids, flow)` helper only if slice 1 plus slice 4 both need it (rule of three, no speculative abstraction).
- Leave generation call sites, `assessmentClient.ts`, and server routers untouched.

### P3 – hub polish

- `AssessmentLibrary.tsx` plus `PracticeHub.tsx`: skeleton only when there are no rows to show; otherwise rows plus a subtle refreshing indicator.
- Reuse `LibraryHubShell` states; no new visual language.

## Verification

- Focused: `pnpm --filter app exec vitest run src/library/useLibraryRows.test.tsx src/library/libraryModel.test.ts`.
- Typecheck plus lint on touched paths.
- Full app suite once green (baseline carries 2 pre-existing TZ flakes in `seedTestData.test.ts`; anything beyond that is a regression).
- `plan/VERIFICATION.md` AC1-AC5 ticked with evidence per row.
- Live: reload `/study/assessments` with unchanged data paints cached rows immediately, network panel shows background revalidation, offline reload keeps cached rows with honest retry states, account switch shows no cross-user rows.
- Request-id join on one revalidated call (`./full-app logs intelligence --grep <request-id>`).

## Review gates

- R1 code review (standards plus spec axis) after P2 green, refix, re-PASS required.
- R2 thermo / maintainability review after P2 green, refix, re-PASS required.
- Reviews recorded in `plan/VERIFICATION.md`; no merge on first-pass PASS-WITH-MINORS without fixing or explicitly deferring each item.

## Risks

- Stale cache masking a fresh failure: mitigated by failed-id tracking plus retry that never blanks painted rows.
- Cache write races across tabs: Dexie `put` is last-writer-wins and envelopes merge by identity; acceptable for this slice.
- Over-fetching on huge libraries: concurrency for idempotent GET revalidation may rise only with measured p95 evidence; generation bounds stay fixed.

## Out of scope

Bulk list endpoint, generation fan-out, Dexie migration, server changes, mastery or feedback contract changes.
