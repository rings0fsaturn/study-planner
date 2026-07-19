---
title: Handover — Phase 2 calibration client fix (typed-error normalization)
date: 2026-06-25
from: Cowork (review session)
to: Codex / Sonnet (implementer)
workstream: "[APP]"
plan: ../plans/active/2026-06-20-dev-production-readiness/PLAN.md
verification: ../plans/active/2026-06-20-dev-production-readiness/VERIFICATION.md
status: Phase 2 🔁 Changes requested — single bug fix + test
---

# Handover — Phase 2 calibration client fix

## Step 0 (before any code)

Commit the pending review edits already in the working tree (they are NOT yet
committed — Cowork can't commit in the sandbox):

```
docs(review): record dev-readiness verification (4/5 verified; phase 2 changes requested)
```

These edits are: `VERIFICATION.md` (per-phase reviewer findings), `PLAN.md`
(Phase 2 status → 🔁), `STATUS.md` (`[APP]` row). Commit them first so the diff
baseline is clean, then start the fix below.

## Context (one paragraph)

The dev-production-readiness plan's five phases are all implemented and
committed. Cowork review on 2026-06-25 verified Phases 1, 3, 4, and 5. **Phase 2
(the resilient calibration client) is the only one returned for changes.** It is
one focused bug — the retry/timeout/typed-error machinery is otherwise correct
and stays as-is.

## The bug

File: `apps/app/src/lib/intelligenceClient.ts` (commit `5cabf41`, current at HEAD).

```ts
function normalizedError(err: unknown): Error {
  return err instanceof Error ? err : new CalibrationServiceError('calibration failed')
}
```

`postCalibration` is contracted (Phase 2 acceptance criterion #2) to surface
non-auth failures as `CalibrationServiceError`. But on the two **transient
exhaustion** paths — request timeout and genuine network failure — the thrown
value is:

- **timeout:** a `DOMException` named `AbortError` (from `controller.abort()`), and
- **network failure:** a `TypeError` (from `fetch` rejecting).

Both are `instanceof Error` in real browsers, so `normalizedError` returns them
**unchanged**. Callers therefore receive a raw `DOMException` / `TypeError`
instead of a `CalibrationServiceError` — the typed contract leaks.

### Why the existing test didn't catch it

`intelligenceClient.test.ts:81` ("aborts timed out attempts…") asserts
`rejects.toBeInstanceOf(CalibrationServiceError)` and **passes** — but only
because **jsdom's `DOMException` is not an `instanceof Error`**, so in the test
runtime `normalizedError` wraps it. In a real browser it does not. The test gives
false confidence. There is also **no test** for the genuine network-`TypeError`
exhaustion path (which leaks even under jsdom, since `TypeError` is an `Error`
everywhere).

### Impact

Low functional impact today: the only consumer, `useCalibrationState`
(`apps/app/src/progress/useCalibration.ts`), catches type-agnostically and serves
the stale cache or an error state regardless of the thrown type. This is a
contract/robustness fix to prevent future callers (e.g. progress/roadmap clients)
from relying on a type that isn't actually guaranteed — not a user-facing outage.

## The fix

In `intelligenceClient.ts`, normalize abort and network errors to
`CalibrationServiceError`. Detect by error `name`/shape rather than relying on
`instanceof Error` (which is exactly what masks the bug). Keep `CalibrationAuthError`
and existing `CalibrationServiceError` instances passing through untouched.

Suggested shape (adjust to taste — the contract is what matters, not the exact lines):

```ts
function normalizedError(err: unknown): Error {
  if (err instanceof CalibrationAuthError) return err
  if (err instanceof CalibrationServiceError) return err
  // AbortError (timeout) and fetch network TypeError must surface as the typed error
  if (err instanceof Error) {
    return new CalibrationServiceError(err.name === 'AbortError' ? 'calibration timed out' : err.message)
  }
  return new CalibrationServiceError('calibration failed')
}
```

Do **not** change: the retry loop, `shouldRetry`, `TIMEOUT_MS`/`MAX_RETRIES`,
backoff, the single `console.warn`, or the 401 → `CalibrationAuthError` path.
Those all passed review.

## Tests to add/adjust (`apps/app/src/lib/intelligenceClient.test.ts`)

1. **Make the timeout test guard real semantics.** It currently rejects a
   `new DOMException('…','AbortError')` and asserts `CalibrationServiceError`.
   That assertion is correct as the target — but ensure it would still hold if
   `DOMException` *were* an `Error` subclass (i.e. the fix must wrap by `name`,
   not by `instanceof Error`). Keep the `toHaveBeenCalledTimes(3)` + one
   `console.warn` assertions.
2. **Add a network-`TypeError` exhaustion case:** `fetch` rejects with
   `new TypeError('Failed to fetch')` on every attempt → `postCalibration`
   rejects with `CalibrationServiceError`, `fetch` called 3 times, one warn.
3. Confirm the 401-no-retry and 500-retry-then-succeed cases still pass unchanged.

## Verification (DONE)

```bash
export FNM_PATH="$HOME/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env --shell bash)" && fnm use 22
export PNPM_HOME="$HOME/.local/share/pnpm" && export PATH="$PNPM_HOME:$PATH"

pnpm --filter @study-tracker/app test -- intelligenceClient   # all client cases pass
pnpm --filter @study-tracker/app typecheck                    # clean
```

## Round-trip / definition of done

1. Commit Step 0 review docs.
2. Apply the fix + tests; commit (suggested: `fix(client): normalize calibration timeout/network errors to CalibrationServiceError`).
3. Fill the **Resolution** block under Phase 2 in `VERIFICATION.md` (files changed,
   commit SHA, what changed, self-check vs the two required changes).
4. Hand back to Cowork to re-verify Phase 2 → flip it to ✅ and complete the
   sign-off (5/5), then update the `[APP]` row in `STATUS.md`.

## Not in scope (already verified — do not touch)

Phases 1, 3, 4, 5. One optional non-blocking item noted in Phase 5 review: enforce
`https://` on `SUPABASE_URL` before the JWKS fetch in
`services/intelligence/app/security.py` — defer unless you're already in that file.
