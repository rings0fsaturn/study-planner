# Verification — e2e-explore-base

Round-trip log between the implementing agent (Codex/Sonnet) and the reviewer (Cowork).
Structure per phase: **Acceptance criteria** (reviewer pre-filled) → **Implementer report** →
**Reviewer findings** → **Resolution** (loop until `✅ Verified`).

- Plan: [`PLAN.md`](PLAN.md)
- A phase is not done until the reviewer marks it `✅ Verified`.
- **Step 0 reminder:** commit this file + `PLAN.md` verbatim before writing any code
  (`docs(plan): add e2e-explore-base plan + verification`). Cowork cannot commit.

**Run command referenced throughout:**

```bash
env COREPACK_NPM_REGISTRY=https://registry.npmjs.org \
  pnpm exec playwright test -c e2e/playwright.config.ts <spec> --project=app --reporter=list
```

If `SUPABASE_SERVICE_ROLE_KEY` is unset, hermetic specs auto-skip — a **skip is not a pass**;
record it explicitly and note it must be run green on a machine that has the key.

---

## Phase 1 — Auth + app-ready fixtures

### Acceptance criteria (reviewer pre-filled)

- [ ] `e2e/support/appReady.ts` exports `userDbName(page)` and `waitForAppReady(page)`; `waitForAppReady` uses **no** `page.waitForTimeout` and waits on (a) URL past `/sign-in`, (b) `.boot-screen` count 0, (c) per-user DB present.
- [ ] `e2e/support/auth.ts` exports `hasServiceRole`, `hermeticEmail`, `createHermeticUser`, `deleteHermeticUser`, `signIn`; `signIn` clicks the button named **`'Continue'`** (exact), not `'Sign in'`.
- [ ] `e2e/support/fixtures.ts` extends `test` with `appUser` (hermetic default; live via `E2E_EXPLORE_MODE=live`) and `signedInPage`; auto-skips when the required env is missing; tears down the hermetic user after use.
- [ ] The smoke spec `e2e/support/__smoke__/base.spec.ts` reaches `/study/(home|onboarding)` after sign-in.
- [ ] Smoke spec runs **green** on a machine with `SUPABASE_SERVICE_ROLE_KEY` (or explicitly documented skip + reason).
- [ ] `tsc`/typecheck over `e2e` is clean.
- [ ] No files created/modified outside `e2e/support/**` (+ the `__smoke__` spec).

### Implementer report

- Commit SHA:
- Files changed:
- What was done:
- Deviations + why:
- Self-check vs. criteria (paste run output):

### Reviewer findings

- Per-criterion verdict:
- Issues:
- Required changes:
- **Status:** ☐ Pending · 🔁 Changes requested · ✅ Verified

### Resolution (implementer, on redo)

---

## Phase 2 — Seed/read helpers + selector registry

### Acceptance criteria (reviewer pre-filled)

- [ ] `e2e/support/seed.ts` exports `seedEvents(page, events)`, `readEvents(page)`, `sampleRoadmapEvents()`; reuses `userDbName` from `appReady.ts` (no duplicated IndexedDB boilerplate).
- [ ] `e2e/support/selectors.ts` exports a registry whose strings match source as of 2026-07-04 (`Continue`, `Add manually`, `Build my plan`, `Looks good`, `Go to home`, `Duration (minutes)`, `Log session`, `Add session`, `Choose material`, `Use this material`, `No material · pick at start`, `Abandon roadmap`, `Projected finish`, testids `roadmaps-active-hero`/`roadmaps-draft-card`).
- [ ] The seeded-roadmap assertion (`getByTestId('roadmaps-active-hero')` visible after `seedEvents(sampleRoadmapEvents())`) passes green (or documented skip).
- [ ] Payload field names in `sampleRoadmapEvents()` match `apps/app/src/sync/types.ts`.
- [ ] No app-source `data-testid`/`aria-label` added (D-04).

### Implementer report

- Commit SHA:
- Files changed:
- What was done:
- Deviations + why:
- Self-check vs. criteria:

### Reviewer findings

- Per-criterion verdict:
- Issues:
- Required changes:
- **Status:** ☐ Pending · 🔁 Changes requested · ✅ Verified

### Resolution (implementer, on redo)

---

## Phase 3 — Flagship `app-explore.spec.ts`

### Acceptance criteria (reviewer pre-filled)

- [ ] `e2e/app-explore.spec.ts` imports `{ test, expect }` from `./support/fixtures` and uses `signedInPage` + `selectors.ts` (no inlined auth, no hardcoded labels).
- [ ] The journey exercises, in order: sign-in → onboarding Step1–4 (draft roadmap) → add a sample material → land Home → **start a session** (branching `Start session` vs `Start ad-hoc session`) → **log an ad-hoc session** via `/log` → open `/roadmaps` (active hero visible) → open `/roadmap` (Projected finish visible) → **book a session** (Add session sheet → attach material via Choose material picker).
- [ ] Guarded to the `app` project; `test.setTimeout` raised for the long journey.
- [ ] `grep -c waitForTimeout e2e/app-explore.spec.ts` → `0` (D-05).
- [ ] Spec runs **green** on a machine with `SUPABASE_SERVICE_ROLE_KEY` and `dev:full` up (or documented skip/blocker with the exact failing step + trace).
- [ ] Any selector that didn't match reality was fixed in `selectors.ts` (single source), not hardcoded in the spec — recorded in the phase Notes.

### Implementer report

- Commit SHA:
- Files changed:
- What was done:
- Deviations + why (esp. any selector reconciliations):
- Self-check vs. criteria (paste run output + trace path if it failed):

### Reviewer findings

- Per-criterion verdict:
- Issues:
- Required changes:
- **Status:** ☐ Pending · 🔁 Changes requested · ✅ Verified

### Resolution (implementer, on redo)

---

## Phase 4 — Refactor `session-log.spec.ts` onto the base

### Acceptance criteria (reviewer pre-filled)

- [ ] `session-log.spec.ts` imports from `./support/*`; no inlined `createTestUser`/`generateTestEmail`/`signIn`.
- [ ] `grep -c "'Sign in'" e2e/session-log.spec.ts` → `0` (uses `'Continue'` via the base).
- [ ] `grep -c waitForTimeout e2e/session-log.spec.ts` → `0`.
- [ ] `grep -c "catch (error)" e2e/session-log.spec.ts` → `0` (no failure-swallowing; any `try/finally` is teardown-only).
- [ ] Preserves the original intent: user A's logged session is **not** visible to user B (per-user isolation).
- [ ] Runs **green** on a machine with `SUPABASE_SERVICE_ROLE_KEY` (or documented skip).

### Implementer report

- Commit SHA:
- Files changed:
- What was done:
- Deviations + why:
- Self-check vs. criteria:

### Reviewer findings

- Per-criterion verdict:
- Issues:
- Required changes:
- **Status:** ☐ Pending · 🔁 Changes requested · ✅ Verified

### Resolution (implementer, on redo)

---

## Phase 5 — Docs + canonical rule

### Acceptance criteria (reviewer pre-filled)

- [ ] `e2e/README.md` documents: `e2e/support/` layout, how to author a new spec on the base, the run command (with `COREPACK_NPM_REGISTRY`), hermetic-vs-live modes, and the forbidden anti-patterns (`waitForTimeout`, inlined setup, hardcoded labels, failure-swallowing `try/catch`).
- [ ] `.agents/rules/e2e-explore-base.agents.md` created as the canonical rule.
- [ ] `AGENTS.md` rules table gains an `e2e-explore-base` row.
- [ ] Cross-links to `playwright-config`, `playwright-full-app-lifecycle`, `eventstore-per-user-db` present.

### Implementer report

- Commit SHA:
- Files changed:
- What was done:
- Deviations + why:
- Self-check vs. criteria:

### Reviewer findings

- Per-criterion verdict:
- Issues:
- Required changes:
- **Status:** ☐ Pending · 🔁 Changes requested · ✅ Verified

### Resolution (implementer, on redo)

---

## Global sign-off (all phases `✅ Verified`)

- [ ] All 5 phases verified.
- [ ] `e2e/app-explore.spec.ts` and refactored `e2e/session-log.spec.ts` proven green on a machine with `SUPABASE_SERVICE_ROLE_KEY` + `dev:full` (paste final run output).
- [ ] `.work/STATUS.md` row moved to Done; `last_updated` bumped.
- [ ] Follow-ups filed: OQ-02 (fragile onboarding selectors) and OQ-04 (migrate remaining specs) as `issues/` tickets if pursued.
