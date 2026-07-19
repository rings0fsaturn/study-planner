# VERIFICATION — dev production-readiness (auth · resilience · hardening)

Companion to [`PLAN.md`](PLAN.md). The **review round-trip** artifact for the build → test → review loop.

**How this file is used (each phase):**

1. **Cowork** pre-fills *Acceptance criteria* (below) from the plan. *(done — checkboxes start unchecked.)*
2. **Codex/Sonnet** fills *Implementer report* after building the phase: files changed, commit SHA, what was done, deviations + why, self-check vs criteria. Then **STOP for review**.
3. **Cowork** fills *Reviewer findings*: diff the committed SHA (`git show <sha>`), give a per-criterion verdict + required changes; set `✅ Verified` or `🔁 Changes requested`.
4. **Codex** fills *Resolution* on redo. Loop until `✅ Verified`.

**Step 0 (before any code):** commit these planning docs verbatim — `docs(plan): add dev-production-readiness plan + verification`. Cowork cannot commit (it bricks `.git` locks in the sandbox); the native side establishes the baseline so later diffs are meaningful. If a reviewer leaves edits here, the next Step 0 commits the review before acting on it.

**Global rules every phase is checked against:** Dexie schema bumps re-declare all tables and add a new version (`dexie-schema-migration`); Dexie tests use fake-indexeddb + unique DB names (`dexie-test-setup`); auth tests use hand-written fakes, never `jest.mock` (`auth-testing-fakes`); never include `/study` in router `to` (`react-router-v7-basename`); no secrets committed (use `.env.example` placeholders); E2E is written, **not run** (`CLAUDE.md`); the `CalibrationState` contract and CUSUM/GP/scheduling stay untouched (carried from the prior plan's D-03/D-04).

---

## Phase 1 — Real Supabase-JWT auth on all `/v1` endpoints

### Acceptance criteria (Cowork pre-filled)

- [ ] `pyjwt` added to `services/intelligence/pyproject.toml`.
- [ ] `app/security.py` `require_user` verifies the bearer token via `SUPABASE_JWT_SECRET` (HS256, `audience="authenticated"`), returns the `sub`; 401 on missing/malformed/invalid/expired/no-sub; 500 (loud) if the secret is unset.
- [ ] All three `/v1` routers mounted with `dependencies=[Depends(require_user)]`; `/health` stays open (no token).
- [ ] `intelligenceClient.ts` attaches `Authorization: Bearer <supabase access_token>` from `supabase.auth.getSession()`.
- [ ] `services/intelligence/.env.example` created (`SUPABASE_JWT_SECRET`, `CORS_ORIGINS`); `apps/app/.env.example` notes the service-side secret. No real secret committed.
- [ ] `test_auth.py`: 401 (no/!valid/expired/wrong-secret), 200 (valid), `/health` open. `uv run --package intelligence pytest services/intelligence/tests -q` passes.

### Implementer report (Codex/Sonnet fills)
_Files changed:_ `services/intelligence/pyproject.toml`, `uv.lock`, `services/intelligence/app/security.py`, `services/intelligence/app/main.py`, `services/intelligence/tests/test_auth.py`, `services/intelligence/tests/test_v1_integration.py`, `services/intelligence/.env.example`, `apps/app/src/lib/intelligenceClient.ts`, `apps/app/.env.example`, `PLAN.md`, `VERIFICATION.md`.
_Commit SHA:_ `b71d962`
_What was done:_ Added PyJWT, a service-side `require_user` dependency that verifies Supabase HS256 bearer tokens with `audience="authenticated"` and returns `sub`, protected all `/v1` routers while leaving `/health` open, and attached the current Supabase session access token from the app client. Added service env documentation and auth coverage for missing/malformed/invalid/expired/no-sub/unconfigured/valid token cases.
_Deviations + why:_ Updated existing service golden-test helper to mint a valid JWT because the suite exercises protected `/v1` endpoints and would otherwise fail after the planned router dependency. The app `.env.example` uses a comment-only note for `SUPABASE_JWT_SECRET` because this Vite app exposes `SUPABASE_*` env vars.
_Self-check vs criteria:_ All Phase 1 criteria satisfied. Verified with `uv run --package intelligence pytest services/intelligence/tests -q` (`46 passed, 1 warning`), manual unauthenticated `/v1/calibration` probe (`401`), manual `/health` probe (`{"status":"ok"}`), and `pnpm --filter @study-tracker/app typecheck`.

### Reviewer findings (Cowork fills)
_Reviewed:_ `git show b71d962` + HEAD state (2026-06-25, Cowork).
_Per-criterion verdict:_
- ✅ **pyjwt dep** — `pyjwt>=2.9` added to `pyproject.toml`; `uv.lock` updated.
- ✅ **`require_user` semantics** — as committed: `jwt.decode(..., algorithms=["HS256"], audience="authenticated")`; 401 on missing/malformed/invalid/expired/no-sub; 500 (loud) when secret unset; returns `sub`. Note: later amended by `3c7092a` (alg-branching HS256/JWKS) — HS256 contract preserved at HEAD (missing-secret→500, `PyJWTError`→401, no-sub→401).
- ✅ **/v1 routers protected, /health open** — all three routers (`calibration`/`progress`/`roadmap`) mounted with `dependencies=[Depends(require_user)]`; `/health` open. At HEAD `_V1_DEPENDENCIES` adds the rate-limit dep too.
- ✅ **Client attaches Bearer** — `authHeaders()` reads `supabase.auth.getSession()` → `access_token`; only call site (`postCalibration`) at this commit.
- ✅ **.env.example, no real secret** — `services/intelligence/.env.example` (placeholder `<project JWT secret…>` + `CORS_ORIGINS`); `apps/app/.env.example` comment-only note. No credential in diff.
- ✅ **test_auth.py** — covers no/malformed/wrong-secret/expired/no-sub (401), unset-secret (500), valid (200), `/health` open.
_Issues / required changes:_ None blocking. (Follow-on note carried to Phase 5: confirm any future progress/roadmap client calls also attach `authHeaders()`.)
_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

---

## Phase 2 — Resilient calibration client

### Acceptance criteria (Cowork pre-filled)

- [ ] `postCalibration` uses an `AbortController` timeout (~8s), bounded retry/backoff (≤2 retries) on transient 5xx/network only.
- [ ] **Never retries 401** — throws `CalibrationAuthError` immediately; 5xx/other → `CalibrationServiceError`.
- [ ] Bearer token attached on every attempt; one `console.warn` on final failure (no silent swallow).
- [ ] `intelligenceClient.test.ts`: token attached; retry-then-succeed on 500 (2 calls); no-retry on 401 (1 call); timeout aborts. `pnpm --filter app test` + `typecheck` pass.

### Implementer report (Codex/Sonnet fills)
_Files changed:_ `apps/app/src/lib/intelligenceClient.ts`, `apps/app/src/lib/intelligenceClient.test.ts`, `PLAN.md`, `VERIFICATION.md`.
_Commit SHA:_ `5cabf41`
_What was done:_ Added typed `CalibrationAuthError` and `CalibrationServiceError`, an 8s `AbortController` timeout, bounded retry/backoff for network/abort and 5xx failures, immediate no-retry 401 handling, and final failure warning for service/network failures. Added client tests for bearer token attachment, retry-then-success, no-retry auth failure, and timeout abort behavior.
_Deviations + why:_ The retry loop intentionally does not retry non-401 4xx responses even though the illustrative code block would have retried any `CalibrationServiceError`; this matches the acceptance criterion that retries are for transient 5xx/network failures only. The test uses a hand-written fake for the local `./supabase` module because importing the real singleton in Vitest requires app env vars before the client behavior can be tested.
_Self-check vs criteria:_ All Phase 2 criteria satisfied. Verified with `pnpm --filter @study-tracker/app test` (`32 files / 373 tests passed`) and `pnpm --filter @study-tracker/app typecheck`.

### Reviewer findings (Cowork fills)
_Reviewed:_ `git show 5cabf41` + HEAD `intelligenceClient.ts` / `.test.ts` (2026-06-25, Cowork).
_Per-criterion verdict:_
- ✅ **Timeout + bounded retry on transient only** — `TIMEOUT_MS=8000`, `AbortController.abort()`; loop `attempt<=MAX_RETRIES(2)`, backoff `250*2**attempt`. `shouldRetry`: 5xx (`retryable=true`) and network/abort retry; non-401 4xx not retried.
- ✅ **No 401 retry; typed errors** — `401 → CalibrationAuthError` (thrown immediately, `shouldRetry` false); `≥500 → CalibrationServiceError(retryable)`; other non-2xx → `CalibrationServiceError`.
- ✅ **Token every attempt; single warn** — `authHeaders()` inside the loop (fresh token on retry); one `console.warn` on final failure; `CalibrationAuthError` intentionally not warned.
- ✅ **Tests** — token attach; retry-then-succeed on 500 (2 calls); no-retry on 401 (1 call); timeout abort (3 calls, 1 warn). Uses hand-written fake of local `./supabase` (not `jest.mock` of `@supabase/supabase-js`) — honors `auth-testing-fakes`.
- 🔁 **Typed-error contract leaks on timeout/network exhaustion** — `normalizedError` (line 34) returns `err` unchanged when `err instanceof Error`. A timeout produces a `DOMException` (`AbortError`) and a real network failure a `TypeError`; both are `instanceof Error` in real browsers, so `postCalibration` rejects with a **raw `DOMException`/`TypeError`**, not `CalibrationServiceError` — violating the criterion "5xx/**other** → `CalibrationServiceError`". The timeout test (`.test.ts:81`) asserts `CalibrationServiceError` and passes only because jsdom's `DOMException` is **not** `instanceof Error` — i.e. the test gives false confidence and masks the production behavior. The genuine-network-`TypeError` exhaustion path is untested.
_Issues / required changes:_
1. Normalize the final thrown error so timeouts (`AbortError`) and network failures (`TypeError`) surface as `CalibrationServiceError` (e.g. detect by `name`/instance rather than relying on `instanceof Error`), so callers can rely on the typed contract.
2. Add/adjust a test that guards this against real `DOMException`/`TypeError` semantics (not jsdom's `DOMException` shape), plus a network-`TypeError` exhaustion case.
_Severity:_ Low functional impact today — the sole consumer (`useCalibrationState`) catches type-agnostically and serves stale/error — but it is a real deviation from the stated criterion and the passing test is misleading. Flagging rather than waving through.

_Re-review (2026-06-25, Cowork — `git show abbac65`):_
- ✅ **Required change 1** — `normalizedError` now returns `CalibrationAuthError`/`CalibrationServiceError` unchanged and wraps every other `Error` (incl. `AbortError`, network `TypeError`) as `CalibrationServiceError` (`'calibration timed out'` for `AbortError`, else the original message). No longer depends on `instanceof Error` masking; auth path still surfaces typed (no regression).
- ✅ **Required change 2** — timeout test replaced `DOMException` with `class BrowserAbortError extends Error { name='AbortError' }` (real-browser semantics — would have failed the old code); added a network-`TypeError` exhaustion test (3 attempts, 1 warn, rejects `CalibrationServiceError`). Both traced and pass; implementer ran full suite (`380 passed`), `typecheck` clean.
- _Note:_ couldn't execute the suite in the Cowork sandbox (linux-arm64 vs the repo's macOS-installed `node_modules` → missing native rollup binary); verified by diff + line-by-line trace + the native-side run.
_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

_Files changed:_ `apps/app/src/lib/intelligenceClient.ts`, `apps/app/src/lib/intelligenceClient.test.ts`.
_Commit SHA:_ `abbac65`
_What was fixed:_ `normalizedError` now preserves only `CalibrationAuthError` and existing `CalibrationServiceError` instances. Timeout aborts (`name === 'AbortError'`) and exhausted fetch/network failures such as `TypeError('Failed to fetch')` are wrapped as `CalibrationServiceError`, so the typed contract no longer depends on browser/jsdom `instanceof Error` differences.
_Self-check vs required changes:_ The timeout test now rejects with an `Error` subclass named `AbortError`, guarding the browser-like path that previously leaked raw abort errors. Added a network-`TypeError` exhaustion test that verifies three attempts, one final `console.warn`, and a `CalibrationServiceError` rejection. Existing 401 no-retry and 500 retry-then-success coverage remains unchanged.
_Verification:_ `pnpm --filter @study-tracker/app test -- intelligenceClient` (`35 files / 380 tests passed`); `pnpm --filter @study-tracker/app typecheck` (clean).

---

## Phase 3 — Resilient UI + Dexie stale cache

### Acceptance criteria (Cowork pre-filled)

- [ ] Dexie `version(5)` added re-declaring all existing tables (`events`, `sync_queue`, `sync_meta`, `onboardingDraft`, `activeSession`) plus `calibrationCache: 'key'`; v4 data preserved on upgrade.
- [ ] `useCalibrationState` returns `{ calibration, status }` (`loading|ready|stale|error`); writes last-good to `calibrationCache`; on failure serves cached value as `stale`, or `error` with `calibration:null` when no cache. **No** in-browser recompute fallback (D-03). No null-flicker (previous value kept during refetch).
- [ ] `ErrorBoundary` created and wraps `AppRoutes` in `App.tsx`; `ServiceStatusBanner` shows stale/error affordance.
- [ ] `Home.tsx`/`Week.tsx` destructure `{ calibration, status }` (downstream `useProgressSnapshot`/`usePromptDetail` unchanged); skeleton on first load.
- [ ] Tests: hook ready/stale/error transitions + cache write; v4→v5 migration preserves events; ErrorBoundary fallback. `pnpm --filter app test` + `typecheck` pass.

### Implementer report (Codex/Sonnet fills)
_Files changed:_ `apps/app/src/events/EventStoreProvider.tsx`, `apps/app/src/events/EventStoreProvider.test.ts`, `apps/app/src/progress/useCalibration.ts`, `apps/app/src/progress/useCalibration.test.ts`, `apps/app/src/components/ErrorBoundary.tsx`, `apps/app/src/components/ErrorBoundary.test.tsx`, `apps/app/src/components/ServiceStatusBanner.tsx`, `apps/app/src/components/ServiceStatusBanner.test.tsx`, `apps/app/src/App.tsx`, `apps/app/src/pages/Home.tsx`, `apps/app/src/pages/Home.test.tsx`, `apps/app/src/pages/Week.tsx`, `apps/app/src/pages/Week.test.tsx`, `PLAN.md`, `VERIFICATION.md`.
_Commit SHA:_ `3655f34`
_What was done:_ Added Dexie schema version 5 with `calibrationCache`, rewrote `useCalibrationState` to return `{ calibration, status }`, write last-good calibration to cache, serve stale cached calibration on fetch failure, and return an error state when no cache exists. Added app-wide `ErrorBoundary`, inline `ServiceStatusBanner`, Home/Week loading/stale/error UI, migration coverage, hook transition/cache coverage, and component tests.
_Deviations + why:_ Exported `createEventStore` so the migration test can exercise the production schema factory directly. The hook effect depends on `requestKey` rather than the `eventStore` object identity to avoid refetch loops and preserve the plan's no-null-flicker behavior. Manual browser stale-cache verification was not run because the local env lacks the service-side Supabase JWT signing secret needed to complete an authenticated live service fetch before stopping the service.
_Self-check vs criteria:_ Automated Phase 3 criteria satisfied. Verified with `pnpm --filter @study-tracker/app test` (`35 files / 378 tests passed`) and `pnpm --filter @study-tracker/app typecheck`. Manual stale-cache browser scenario remains not run for the env reason above.

### Reviewer findings (Cowork fills)
_Reviewed:_ `git show 3655f34` + HEAD touched files (2026-06-25, Cowork).
_Per-criterion verdict:_
- ✅ **Dexie v5 additive** — `db.version(5).stores({...})` re-declares all five existing tables + `calibrationCache: 'key'`; v1–v4 blocks untouched (pure addition) — complies with `dexie-schema-migration`.
- ✅ **Hook `{calibration,status}`** — statuses `loading|ready|stale|error`; writes last-good to `calibrationCache` key `'last'`; failure → cached `stale` else `error`/`null`; no in-browser recompute (D-03); no null-flicker (keeps `previous.calibration` while `loading`).
- ✅ **ErrorBoundary + banner** — `ErrorBoundary.tsx` (class, `getDerivedStateFromError`/`componentDidCatch`, `role="alert"`) wraps `<AppRoutes/>` in `App.tsx`; `ServiceStatusBanner` renders for `stale`/`error`.
- ✅ **Home/Week call sites** — both destructure `{calibration,status}`; downstream `useProgressSnapshot`/`usePromptDetail` still receive `CalibrationState|null`; first-load skeleton guarded on `status==='loading' && !calibration`.
- ✅ **Tests** — hook ready/stale/error + cache-write; v4→v5 migration preserves a seeded event and exercises `calibrationCache`, unique per-test DB names + cleanup (`dexie-test-setup`); ErrorBoundary fallback. No `/study` in any added `to`/`navigate` (`react-router-v7-basename`).
_Issues / required changes:_ None. (Manual stale-cache browser scenario not run — env lacked the service JWT secret; automated coverage substitutes adequately. `createEventStore` exported solely for the migration test — acceptable.)
_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

---

## Phase 4 — Service hardening

### Acceptance criteria (Cowork pre-filled)

- [ ] Middleware sets/propagates `X-Request-ID`, logs one structured JSON line/request (request_id, method, path, status, latency_ms), and stamps `X-Model-Version` (= `PRODUCTION_PRIOR_STRATEGY`) on responses.
- [ ] Uncaught-exception handler returns `{error, code, request_id}` 500 (no stack leak); `HTTPException` 401/422 detail still flows.
- [ ] `sessions` length-bounded (`max_length`) → oversized payload returns 422; applied to `CalibrationRequest` (+ `ProgressRequest`).
- [ ] `/readiness` (open) returns `{status:"ready", model:...}` after a trivial `production_calibrator().fit_global([])`.
- [ ] In-memory per-user rate-limit stub (keyed on JWT `sub`) returns 429 past threshold; labelled as a dev stub.
- [ ] `docker-compose.yml` has a `/health` healthcheck. `test_hardening.py` covers request-id, 422, `/readiness`, version, rate-limit; service suite passes.

### Implementer report (Codex/Sonnet fills)
_Files changed:_ `services/intelligence/app/middleware.py`, `services/intelligence/app/main.py`, `services/intelligence/app/security.py`, `services/intelligence/app/schemas/progress.py`, `services/intelligence/tests/test_hardening.py`, `docker-compose.yml`, `PLAN.md`, `VERIFICATION.md`.
_Commit SHA:_ `dcb1069`
_What was done:_ Added request-id propagation/generation, `X-Model-Version` stamping, structured JSON request logging, an uncaught-exception JSON envelope, open `/readiness`, session max-length bounds, an in-memory per-user dev rate-limit dependency, and a compose `/health` healthcheck. Added hardening tests for request headers/logging, readiness, oversize 422 responses, 500 envelope, and rate-limit 429 behavior.
_Deviations + why:_ The rate limit threshold is configurable with `INTELLIGENCE_RATE_LIMIT_PER_MINUTE` so tests can set a low limit while the dev default stays generous. `PromptDetailRequest.sessions` also gets the same max-length bound as calibration/progress because it shares the same session payload shape.
_Self-check vs criteria:_ All Phase 4 criteria satisfied. Verified with `uv run --package intelligence pytest services/intelligence/tests -q` (`51 passed, 1 warning`), live `curl -s -D- http://127.0.0.1:8000/readiness` (`200`, `X-Model-Version: dual_prior`, ready body), and `docker compose config`.

### Reviewer findings (Cowork fills)
_Reviewed:_ `git show dcb1069` + HEAD touched files (2026-06-25, Cowork).
_Per-criterion verdict:_
- ✅ **Request-ID + structured log + version stamp** — `request_context_middleware` sets/propagates `X-Request-ID`, logs one JSON line (`request_id, method, path, status, latency_ms`) in `finally`, stamps `X-Model-Version = PRODUCTION_PRIOR_STRATEGY` (`"dual_prior"`).
- ✅ **Error envelope, no stack leak** — `@app.exception_handler(Exception)` → `{error, code:"internal_error", request_id}` 500, no exc text (`"exploded" not in response.text`); `HTTPException`/`RequestValidationError` keep their own handlers (401/422 flow).
- ✅ **Session bound → 422** — `MAX_SESSIONS=5000`, `Field(..., max_length=MAX_SESSIONS)` on `CalibrationRequest`, `ProgressRequest`, and `PromptDetailRequest`; 5001 → 422.
- ✅ **/readiness open** — registered before authed routers (no `require_user`); `production_calibrator().fit_global([])` then `{"status":"ready","model":…}`.
- ✅ **Rate-limit stub** — `rate_limit_user(user_id=Depends(require_user))`, in-memory, docstring "Dev-only…stub", threshold `INTELLIGENCE_RATE_LIMIT_PER_MINUTE` (default 120), 429 past limit; wired into all `/v1` via `_V1_DEPENDENCIES`.
- ✅ **Compose healthcheck + tests** — `/health` healthcheck (interval 10s/timeout 4s/retries 5); `test_hardening.py` covers request-id/version/log, 422, `/readiness`, 500 envelope, rate-limit 429.
_Issues / required changes:_ None. Phase 4 content intact at HEAD despite later edits to `security.py`/`docker-compose.yml` (asymmetric-JWT + env wiring).
_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

---

## Phase 5 — One-command dev stack

### Acceptance criteria (Cowork pre-filled)

- [ ] Root `package.json` gains `dev:full` (runs Vite + uvicorn via `concurrently`) and devDeps `concurrently` + `wait-on`.
- [ ] README (root and/or `apps/app`) documents: service required for calibration, `pnpm dev:full`, `SUPABASE_JWT_SECRET` in env, `docker compose up` alternative.
- [ ] Manual: `pnpm dev:full` brings up :5173 and :8000; `/health` 200; Home shows live pace. (No automated test; script + docs only.)

### Implementer report (Codex/Sonnet fills)
_Files changed:_ `package.json`, `pnpm-lock.yaml`, `README.md`, `services/intelligence/README.md`, `scripts/dev-intelligence.mjs`, `apps/app/src/progress/useCalibration.ts`, `apps/app/src/progress/useCalibration.test.ts`, `apps/app/src/components/ServiceStatusBanner.tsx`, `apps/app/src/components/ServiceStatusBanner.test.tsx`, `PLAN.md`, `VERIFICATION.md`.
_Commit SHA:_ `18dd144`
_What was done:_ Added one-command dev orchestration with `dev:intelligence` and `dev:full`, root devDeps `concurrently` and `wait-on`, a Node launcher that loads `services/intelligence/.env`, validates `SUPABASE_JWT_SECRET`, and starts uvicorn, plus root/service README setup notes. Changed `wait-on` to `http-get://localhost:8000/health` after FastAPI returned 405 to HEAD. Added an auth-specific calibration status/banner so a `/v1/calibration` 401 tells the user to check `SUPABASE_JWT_SECRET` instead of reporting a generic service outage.
_Deviations + why:_ Added `scripts/dev-intelligence.mjs` rather than keeping all logic inside a package-script one-liner so `services/intelligence/.env` can be loaded and child-process signal handling stays readable. The app status enum now includes `auth-error`; this is a narrow response to live browser evidence that a wrong service JWT secret otherwise appears as "Couldn't reach the calibration service."
_Self-check vs criteria:_ Script/docs criteria satisfied and automated checks pass. Verified `env CI=true pnpm install --frozen-lockfile --offline`, `pnpm --filter @study-tracker/app test -- useCalibration ServiceStatusBanner` (`35 files / 379 tests passed`), `pnpm --filter @study-tracker/app typecheck`, `pnpm dev:intelligence` fail-fast with no secret, and `pnpm dev:full` startup with a temporary test secret (`:8000` uvicorn, `:5173` Vite, `/health` 200, `/readiness` 200). Headless browser verification with a synthetic matching JWT got `POST /v1/calibration` 200 and rendered seeded Home progress content. Real-account browser verification initially reproduced `401 Unauthorized`; the root cause was that the live Supabase project issues `ES256` access tokens, not legacy `HS256` tokens.

### Reviewer findings (Cowork fills)
_Reviewed:_ `git show 18dd144` + `git show 3c7092a` + HEAD (2026-06-25, Cowork).
_Per-criterion verdict (Phase 5 + the 3c7092a follow-up):_
- ✅ **One-command dev** — `dev:full` (concurrently: `wait-on http-get://localhost:8000/health && pnpm dev:app`) + `dev:intelligence`; devDeps `concurrently@^9.1.0`, `wait-on@^8.0.1` locked.
- ✅ **Docs** — root `README.md` + `services/intelligence/README.md` cover: service required for calibration, `pnpm dev:full`, `SUPABASE_JWT_SECRET` (+ `SUPABASE_URL`), `docker compose up` alternative.
- ✅ **Launcher correctness** — `scripts/dev-intelligence.mjs` loads service `.env`, fail-fasts when `SUPABASE_JWT_SECRET` unset, forwards signals; `http-get://` fix avoids FastAPI 405-on-HEAD.
- ✅ **Asymmetric JWT branching (3c7092a)** — `_decode_token` branches on header `alg`: HS256 → shared secret; ES256/RS256 → JWKS at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` validating `audience="authenticated"` **and** `issuer`; unknown alg → `InvalidAlgorithmError` (401). Legacy HS256 preserved; `pyjwt[crypto]`+`cryptography` added.
- ✅ **Tests + no secrets** — all prior HS256 cases retained + 3 ES256 cases (valid-from-JWKS 200, wrong-issuer 401, `SUPABASE_URL` unset 500); ES256 keys generated at runtime; `.env`/`.env.local` gitignored & untracked; only placeholders in `.env.example`.
- ✅ **Compose + env reuse** — compose passes `SUPABASE_URL` + `SUPABASE_JWT_SECRET`; launcher falls back to `apps/app/.env.local` `SUPABASE_URL` when service env omits it.
_Security check:_ No alg-confusion / `alg=none` (explicit single-alg allow-list per branch); audience checked both branches; issuer checked on asymmetric. **Minor (non-blocking):** nothing enforces `SUPABASE_URL` scheme is `https`, so a misconfigured `http://` would fetch JWKS over plaintext — low severity (operator misconfig). Optional hardening: assert `https://` in the URL resolver.
_Issues / required changes:_ None blocking. Optional: enforce `https` on `SUPABASE_URL` before JWKS fetch.
_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

_Files changed:_ `services/intelligence/app/security.py`, `services/intelligence/tests/test_auth.py`, `services/intelligence/pyproject.toml`, `uv.lock`, `scripts/dev-intelligence.mjs`, `services/intelligence/.env.example`, `services/intelligence/README.md`, `README.md`, `apps/app/.env.example`, `docker-compose.yml`.
_Commit SHA:_ `3c7092a`
_What was fixed:_ Added Supabase asymmetric JWT support while preserving the legacy HS256 path. `require_user` now branches by JWT `alg`: `HS256` verifies with `SUPABASE_JWT_SECRET`; `ES256`/`RS256` verifies against the Supabase JWKS endpoint under `SUPABASE_URL` and validates issuer plus `audience="authenticated"`. The dev launcher reuses `SUPABASE_URL` from `apps/app/.env.local` when the service env does not set it, and compose now passes the service auth env vars.
_Verification:_ `uv run --package intelligence pytest services/intelligence/tests/test_auth.py -q` (`11 passed, 1 warning`); `uv run --package intelligence pytest services/intelligence/tests -q` (`54 passed, 1 warning`); `docker compose config`; `git diff --check`; `pnpm --filter @study-tracker/app typecheck`; live `/health` 200; live `/readiness` 200; direct real Supabase-issued access token probe reported `alg:"ES256"`, `/v1/calibration` status `200`, `hasGlobalMultiplier:true`; Chrome browser verification using Rohit's account loaded `/study/home` with `calibrationStatuses:[200]`, `hasCalibration401:false`, `hasAuthBanner:false`, `hasServiceBanner:false`.

---

## Sign-off

- [x] All five phases `✅ Verified` by Cowork review. **(5/5 as of 2026-06-25: Phases 1, 3, 4, 5 verified in the first pass; Phase 2 verified on re-review after fix `abbac65`.)**
- [x] `../../../STATUS.md` updated (new dev-readiness row/note; OQ-02 of the prior plan resolved here); `last_updated` bumped if a new day.
- [x] Carry-forward: production hosting/secrets (OQ-03 of prior plan) still deferred; rate-limit thresholds (OQ-01) and toast system (OQ-02) noted.
