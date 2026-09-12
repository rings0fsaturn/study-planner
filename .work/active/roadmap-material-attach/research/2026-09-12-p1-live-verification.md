# P1 live verification - roadmap material attachment (#63)

_2026-09-12 · worktree `/mnt/d/study/git/study-planner-web-issue-63` · stack: `./full-app start full` (app 5173 + intelligence 8000)_

## What was checked

P1's gate: a library material attached from the roadmap's Materials directory "+"
must show in the directory, in New session -> Attach, and in session setup.

A temporary Playwright spec (`e2e/tmp-rm-p1-live.spec.ts`, deleted after the run
with its config `e2e/tmp-p1.config.ts`) signed in with the shared dev account and
walked that path. Credentials came from `.work/specs/test-login-cred.txt` through
`E2E_LIVE_EMAIL`/`E2E_LIVE_PASSWORD` in the shell, never from a file in the tree.

## Result - green at 1280

```
[app] > e2e/tmp-rm-p1-live.spec.ts:34:3 > P1 live attach (real login) > the roadmap "+" attaches a library material and New session lists it
P1 live: attached "grokking-algorithms-2nd-edition-2nd_compress"
P1 live: header before "ACTIVE ROADMAP · 1 MATERIALS · 3 WEEKS" after "ACTIVE ROADMAP · 2 MATERIALS · 3 WEEKS"
P1 live: session setup lists the attached material as Foundations

  1 skipped
  1 passed (1.5m)
```

Re-run with the session-setup leg added:

```
P1 live: attached "grokking-algorithms-2nd-edition-2nd_compress"
P1 live: header before "ACTIVE ROADMAP · 1 MATERIALS · 3 WEEKS" after "ACTIVE ROADMAP · 2 MATERIALS · 3 WEEKS"
P1 live: session setup lists the attached material as Foundations
  1 passed (1.5m)
```

So, against the running app and a real Supabase login:

- the "+" in the directory header opened the planning picker;
- continuing logged `MaterialAttached` and the material appeared as a directory
  row while the header count moved 1 -> 2 materials;
- New session -> Attach listed it;
- session setup's chooser listed it as `Foundations` (the P1 `role` default);
- zero page errors.

## What the 375 leg showed

At 375 the picker opens and behaves correctly, but by then every library material
was already attached to that roadmap, so the run exercised the `excludeIds`
empty state ("Every library material is already on this roadmap.") rather than a
fresh attach. A deliberate stop: attaching more library materials leaves rows on
the shared dev account that nothing can remove until P3 ships `MaterialDetached`.
Re-run the attach at 375 after P3.

## Residue on the shared dev account

The active roadmap now carries **3 attached library materials** (the runs attached
the picker's first row each time; the library has at least three). They are
additive `MaterialAttached` rows and are the intended output of the feature, but
they cannot be taken off the roadmap until P3 lands. Nothing else was created.

## Two findings worth keeping

1. **The repo Playwright config does not work in a worktree.** `e2e/playwright.config.ts`
   declares a marketing webServer on port 4321 (`pnpm --filter @study-tracker/marketing dev`);
   in this worktree that command never becomes reachable, so `config.webServer`
   times out after 120 s and *every* project fails before a single test runs, the
   app project included. Running the live check needed a temporary config that
   declares only the app webServer (which reuses the already-running 5173).
   Worth a one-line note in rule 10/16 before the next worktree-based live pass.
2. **`e2e/playwright.config.ts` pins `app-mobile` to `testMatch: /roadmap\.spec\.ts/`**,
   so `--project=app-mobile` runs zero tests for any other spec. Use `--project=app`
   plus an explicit viewport (`test.use` inside a describe) for a phone pass, and
   remember rule 16's file-scope leak: the `test.use` must live inside the describe
   that needs it.
