# Fetch Client: Typed-Error Normalization (and the jsdom `DOMException` trap)

## Problem

A `fetch` client that promises callers a **typed** error (e.g. `CalibrationServiceError`)
can silently leak the wrong type on its two transient-failure paths:

- a **request timeout** rejects with a `DOMException` named `AbortError` (from
  `AbortController.abort()`), and
- a **network failure** rejects with a `TypeError` (`fetch` itself rejecting).

Both are `instanceof Error` **in real browsers**, so a normalizer written as
`err instanceof Error ? err : wrap(err)` returns them **unchanged** — the caller gets a
raw `DOMException`/`TypeError` instead of the documented typed error, defeating
`catch (e) { if (e instanceof MyServiceError) ... }`.

This bit `apps/app/src/lib/intelligenceClient.ts` (`postCalibration`): the original
`normalizedError` passed any `Error` through, so timeouts/network failures escaped the
`CalibrationServiceError` contract. Fixed in commit `abbac65`.

### The test that hides it

jsdom's `DOMException` is **not** an `instanceof Error` (unlike real browsers). So a Vitest
test that aborts with `new DOMException('...','AbortError')` and asserts the typed error
**passes under jsdom while the bug remains live in production**. The test gives false
confidence.

## Rule

**1. Normalize by identity/`name`, not by `instanceof Error`.** Pass through only your own
typed errors; wrap everything else:

```ts
function normalizedError(err: unknown): Error {
  if (err instanceof CalibrationAuthError) return err          // keep auth typed
  if (err instanceof CalibrationServiceError) return err       // already typed
  if (err instanceof Error) {
    const message = err.name === 'AbortError' ? 'calibration timed out' : err.message
    return new CalibrationServiceError(message || 'calibration failed')
  }
  return new CalibrationServiceError('calibration failed')
}
```

The fix is that the **other-`Error`** branch now wraps (it used to return `err`), so
`AbortError`/`TypeError` can no longer escape the typed contract regardless of
`instanceof Error`.

**2. In tests, simulate the abort as a real `Error` subclass — never rely on jsdom's
`DOMException` shape:**

```ts
class BrowserAbortError extends Error { name = 'AbortError' }   // mimics real-browser semantics
// reject the fetch with new BrowserAbortError('request aborted')
```

This makes the timeout test fail against the *un*-normalized code (as it should), and adds
a genuine guard. Also cover the **network-`TypeError` exhaustion** path explicitly
(`fetch` rejects with `new TypeError('Failed to fetch')` on every attempt -> typed error,
N attempts, one warn).

## Why

| Approach | Timeout (`AbortError`) | Network (`TypeError`) | jsdom test |
|---|---|---|---|
| `instanceof Error ? err : wrap` | leaks raw in browser | leaks raw everywhere | **passes (masks bug)** |
| pass-through only own typed errors, else wrap | wrapped | wrapped | real `Error`-subclass abort guards it |

## When to Apply

- Any client (`fetch`/XHR) that exposes typed errors to callers and uses `AbortController`
  timeouts and/or retry.
- Any Vitest/jsdom test that simulates an aborted/timed-out request — do not assert typed
  errors against `new DOMException(...)`; use a real `Error` subclass named `AbortError`.

## Pattern Checklist

- [ ] Normalizer passes through only the client's own typed error classes; wraps all else.
- [ ] Wrapping does **not** gate on `instanceof Error` (that is what leaks `AbortError`/`TypeError`).
- [ ] Timeout test rejects with a real `Error` subclass (`name = 'AbortError'`), not `DOMException`.
- [ ] A network-`TypeError` exhaustion test exists (typed error, correct attempt count, one warn).
- [ ] Auth/`401` errors still surface as their own type (not collapsed into the service error).
