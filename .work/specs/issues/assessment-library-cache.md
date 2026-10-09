# Spec – assessment-library-cache (cache-first library hubs)

## Problem

Reloading `/study/assessments` (and `/study/practice`) shows `Loading assessments…` until every assessment envelope, attempt list, and material title has been refetched over the network.
A learner with zero new assessments still waits for the full refetch on every reload.

## Current mechanism (verified in tree)

`AssessmentLibrary` renders `LibraryHubLoading` while `useLibraryRows().loading` is true (`apps/app/src/pages/assessments/AssessmentLibrary.tsx:34`).
`loading` is `!eventStore || events == null || !hydrated` (`apps/app/src/library/useLibraryRows.ts:333`).
`hydrated` flips only after `hydrateEnvelopes(ids)` plus `hydrateTitles(...)` both complete (`useLibraryRows.ts:220-238`).
`hydrateEnvelopes` runs two serial pooled passes at concurrency 4 (`useLibraryRows.ts:25,121,151`): one `GET /v1/assessments/{id}` per assessment, then one attempt refresh plus local list per assessment.
Each detail GET assembles one assessment row plus its questions server-side (`services/intelligence/app/routers/assessments.py:292-320`).
The Dexie envelope cache (`attemptFlow.ts:482-491`) is written after each fetch but only read on fetch failure (`useLibraryRows.ts:128-143`), so it never short-circuits first paint.
Only `generating` / in-flight ids keep polling after hydration (`useLibraryRows.ts:259-297`).

## Contract

The library hubs must paint instantly from local state (events plus Dexie cache) on reload.
Network revalidation must happen in the background and merge without identity churn (`mergeEnvelopes` stays the merge authority).
A failed revalidation must never blank already-painted cached rows.
Per-user isolation must hold: account switch resets envelopes, rows, failures, titles, and flow exactly as today (`useLibraryRows.ts:75-94`).
Generation stays one family and one question per call; bounded generation concurrency is unchanged (rule 42).
No Dexie version change unless a new table or index is genuinely needed (rule 31); widen reader payloads additively instead (rule 42 pointer precedent).

## Acceptance criteria

AC1: Reload with unchanged assessments paints cached rows without waiting for network (skeleton only when there is nothing cached to show).
AC2: Background revalidation converges to the same rows a full network hydration would produce.
AC3: Offline reload still renders cached rows with the existing honest `unavailable` / retry states intact.
AC4: Account switch never renders the previous user's cached envelopes.
AC5: No generation, attempt, grading, or logging contract changes (rules 42/22/17 green).

## Non-goals

No bulk list endpoint in this slice.
No generation-fan-out change.
No Dexie schema migration unless the implementation proves one is required.
