---
name: github-cli-and-token
description: Use the GitHub CLI for issue-tracker work via the gitignored token, and treat transient api.github.com TLS/EOF failures as flakiness to retry, not a config bug to fix.
---

# GitHub CLI and Token

Read this before any `gh` command against `github.com` from this repository, above all the wayfinder issue-tracker workflow (map and tickets on `rings0fsaturn/study-planner`).

## Token usage

The `gh` CLI authenticates with a token held in `.env.git.local` at the repository root.
This file is gitignored (`.gitignore` matches `.env.*.local`); keep it that way and never move the token into a tracked file.
Export the token into the shell before calling `gh`.
`.env.git.local` may carry CRLF line endings on a Windows checkout, which leaves a trailing `\r` on the token value; strip it with `tr -d '\r'` so `gh` does not fail with `invalid header field value for Authorization`:

```bash
export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
```

Install `gh` with `sudo apt-get install -y gh` on this Ubuntu host.
When sudo is unavailable, download the official Linux release into `~/.local/bin/gh` instead.
Resolve `gh` with `command -v gh` instead of hard-coding a path, because the install location differs by host.
Never print, echo, log, cat, or commit the token, and never paste its value into a message, a commit, or an issue body.
Reading the file to extract only the `TOKEN=` line is fine; dumping the whole file to stdout is not, because it exposes the secret.

## Transient api.github.com failures are flakiness, not misconfiguration

`gh` calls from this machine intermittently fail with `net/http: TLS handshake timeout`, `EOF`, or `Recv failure: Software caused connection abort` reaching `api.github.com`.
This is transient egress flakiness on the corporate network path, not a broken configuration.
Do not "fix" it by adding an HTTP/HTTPS proxy, disabling TLS verification, swapping certificates, or editing git/npm/gh config.

The diagnosis tell is that the failures are intermittent and host-split: `curl` can return `200` from `api.github.com` in under a second while `github.com` aborts in the same probe.
No proxy is configured on this machine (`env` shows no `http_proxy`, `https_proxy`, or `all_proxy` variables).
The `NODE_EXTRA_CA_CERTS=...` entry points at a transparent TLS-interception CA bundle that is present and correct; it is not the cause.

## The fix: bounded retry

Wrap every `gh` call in a short retry loop and it succeeds within a few attempts:

```bash
export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
for i in 1 2 3 4 5; do
  gh issue view 9 --repo rings0fsaturn/study-planner && break || sleep 3
done
```

Only investigate configuration when failures are consistent and uniform across every retry; a genuine auth or proxy fault fails the same way every time, while this flakiness clears on its own.

## When to Apply

- Any `gh` command in this repository, including issue view, comment, close, edit, and list.
- Working the wayfinder map and tickets, where the prompt itself warns that GraphQL returns transient EOF and to retry.
- Diagnosing a `gh` or `api.github.com` connection failure before changing any network, proxy, or certificate setting.
