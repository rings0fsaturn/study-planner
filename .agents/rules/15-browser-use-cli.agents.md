---
name: browser-use-cli
description: Use the browser-use CLI and its dedicated WSL automation Chromium, including the browser start and stop lifecycle.
---

# Browser-Use CLI

Browser automation with the `browser-use` command runs against a dedicated headless Chromium inside this WSL host.
Read `~/.config/opencode/skills/browser-use/SKILL.md` for the full CLI interface and helper names before relying on them.
The repo symlink `.opencode/skills/browser-use` points at that user skill directory, so recreating the skill also fixes a stale symlink target.

## Install and Upgrade

If `command -v browser-use` fails, install it first:

```bash
uv tool install --python 3.12 --upgrade --force browser-use
browser-use skill install --target opencode
browser-use --update -y
```

The same command upgrades it to the latest stable release.
The install also provides the `browser`, `browseruse`, and `bu` aliases.
Run `browser-use --reload` after a CLI upgrade so the daemon restarts with the new code.

## Chromium prerequisite

This WSL host has no apt `chromium` package (Ubuntu 26.04 offers only a sudo-gated snap).
Install the Playwright-cached Chrome for Testing binary instead.
Use the repository Playwright version with the Linux Node from rule 53, because the Windows pnpm shim fails with `sh is not recognized` and the installed Playwright rejects the Ubuntu 26.04 host label:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64
node node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/cli.js install chromium
```

Resolve the actual CLI entry with `ls node_modules/.pnpm/playwright@*/node_modules/playwright/cli.js` because the version path changes on upgrades.

## Start the Automation Chromium

This host's Chromium needs NSS and ALSA libraries that are not installed system-wide.
They are extracted without sudo under `$HOME/.local/chrome-deps/usr/lib/x86_64-linux-gnu/` (built with `apt-get download libnspr4 libnss3 libasound2t64` then `dpkg-deb -x` into that directory), so export `LD_LIBRARY_PATH` before launching:

```bash
export LD_LIBRARY_PATH="$HOME/.local/chrome-deps/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
CHROME="$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | head -1)"
mkdir -p "$HOME/.config/browser-harness/chrome-profile"
nohup "$CHROME" --headless=new --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.config/browser-harness/chrome-profile" \
  --no-first-run --no-default-browser-check about:blank \
  > "$HOME/.config/browser-harness/chrome.log" 2>&1 &
curl -s http://127.0.0.1:9222/json/version
```

The dedicated profile directory avoids the Chrome M136/M144 "Allow remote debugging" dialog and the default-profile lockdown.

## Connect

Export `BU_CDP_URL` for every command because the browser is a dedicated instance, not a standard Chrome profile:

```bash
export BU_CDP_URL=http://127.0.0.1:9222
browser-use doctor
browser-use <<'PY'
goto_url("https://example.com")
print(page_info())
PY
```

Do not rely on automatic browser discovery; `BU_CDP_URL` is the documented override.

## Stop

Stop the browser when finished so the background process is not left running:

```bash
pkill -f 'remote-debugging-port=9222'
```

Confirm the stop with `browser-use doctor` (chrome running FAIL is expected after stop) or a failing `curl -s http://127.0.0.1:9222/json/version`.

## Pitfalls

- Recording defaults to off; leave it off unless the user explicitly asks.
- Cloud auth and cloud browsers are optional; local Chromium needs no Browser Use API key.
- The daemon auto-starts on the first command and state lives under `~/.config/browser-harness/`.
- The Playwright cache directory name (for example `chromium-1217`) changes when Playwright upgrades; always resolve it with the glob above.
