---
name: playwright-cli
description: Use playwright-cli for interactive browser automation, debugging E2E tests, and the plan-to-generate-to-heal Playwright test workflow.
---

# Playwright CLI

Use `playwright-cli` for interactive browser work: open a page, snapshot it,
click and type, inspect console or requests, mock routes, and record traces.
Read `~/.agents/skills/playwright-cli/SKILL.md` for the full command list and
`references/` for the debug-attach and test-generation workflows before
relying on them.

The command resolves from `/home/user/.local/node/bin/playwright-cli` on this
host and matches the repository Playwright 1.59.1 runtime.
It manages its own browser sessions, so it needs no dedicated Chromium harness
and no CDP endpoint setup.

## Prerequisite on this host

Export `LD_LIBRARY_PATH` before every run because the cached Chromium needs the
NSS and ALSA libraries extracted under `$HOME/.local/chrome-deps` (built with
`apt-get download libnspr4 libnss3 libasound2t64` then `dpkg-deb -x` into that
directory):

```bash
export LD_LIBRARY_PATH="$HOME/.local/chrome-deps/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
```

Always pass `--browser=chromium`.
The default channel is the system `chrome` install, which does not exist on
this host, so a bare `open` fails with `Chromium distribution 'chrome' is not
found`.

## Quick start

```bash
export LD_LIBRARY_PATH="$HOME/.local/chrome-deps/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
playwright-cli open --browser=chromium http://localhost:5173/study/sign-in
playwright-cli snapshot
playwright-cli fill e13 "user@example.com"
playwright-cli fill e16 "password"
playwright-cli click e17
playwright-cli find "Forgot password?"
playwright-cli eval "location.href"
playwright-cli close
```

Interact with page elements through snapshot refs such as `e13`.
The refs come from the current snapshot and change between runs.
CSS selectors and Playwright role locators also work as targets:

```bash
playwright-cli click "getByRole('button', { name: 'Continue' })"
playwright-cli click "#main > button.submit"
```

Prefer role and label locators over CSS, matching rule 11.

## Open parameters

```bash
playwright-cli open --browser=chromium --mobile
playwright-cli open --browser=chromium --device="iPhone 15"
playwright-cli open --browser=chromium --persistent
playwright-cli open --browser=chromium --profile=/path/to/profile
```

The default session is in-memory and per-run.
Use `-s=<name>` for named sessions and `playwright-cli list` to see them.

## Debugging a failing Playwright test

Run a single test with the CLI debugger in the background, then attach:

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/smoke.spec.ts --debug=cli
# wait for the "Debugging Instructions" block and its tw-XXXX session name
playwright-cli attach tw-XXXX
playwright-cli resume
playwright-cli snapshot
```

Every `playwright-cli` action prints the equivalent Playwright TypeScript,
which you can paste into the test.
See `~/.agents/skills/playwright-cli/references/playwright-tests.md` for the
full debug-attach flow.
Stop the background test run after fixing the test.

## Test generation and healing

Use the plan, generate, heal workflow from
`~/.agents/skills/playwright-cli/references/test-generation.md` to author E2E
specs.
Every scenario starts from a seed test that the CLI pauses inside.
Write the scenario spec to `specs/<feature>.plan.md`, walk the steps with the
CLI, and collect the generated TypeScript into one test file per scenario.
Heal failures one at a time through the same attach flow, and reconcile the
spec with reality when the app behavior changes.

## Storage, network, and devtools

```bash
playwright-cli state-save auth.json
playwright-cli state-load auth.json
playwright-cli cookie-list
playwright-cli localstorage-get theme
playwright-cli route "https://api.example.com/**" --body='{"mock": true}'
playwright-cli console warning
playwright-cli requests
playwright-cli run-code "async page => await page.context().grantPermissions(['geolocation'])"
playwright-cli tracing-start
playwright-cli tracing-stop
```

Never commit `state-save` output that contains real session credentials.

## Snapshots and artifacts

`playwright-cli` writes snapshots, console logs, and traces to `.playwright-cli/`
in the working directory.
The directory is gitignored and local to the run; leave it alone.

## WSL notes

No `--remote-debugging-port=9222` setup is needed; `playwright-cli` launches
the Playwright-cached Chromium itself.
If the host reports an unsupported Ubuntu label, use the
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` workaround from rule 53.
Restart the managed runtime after editing app source before browser
verification, because Vite on WSL does not reliably watch `/mnt/d`.