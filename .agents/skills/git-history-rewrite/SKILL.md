---
name: git-history-rewrite
description: Rewrite a repository's Git history to permanently remove or replace sensitive data, prohibited files, and unwanted content from every commit, branch, and tag. Use when the user asks to "sanitize the repo", "remove sensitive data from history", "rewrite git history", "purge files from all commits", "remove credentials from the repo", or "run git filter-repo". Produces a rewritten mirror with no cleanup commit — every change is baked into the original commit history so the prohibited content appears never to have existed.
---

# Git History Rewrite

A disciplined six-phase workflow for full-history sanitization using `git filter-repo --sensitive-data-removal`.
The whole skill is built on one principle:

> **Scan everything before you write any replacement. Verify every object after you rewrite. Never create a cleanup commit.**

Guessing what to remove and running a rewrite without exhaustive scanning is the single biggest reason rewrites need multiple rounds.
Every prohibited pattern gets a count before filtering and a zero-match gate after.

---

## Phase 0: Gather requirements from the user

Before touching any repository, ask the user exactly what must be removed or transformed.
Run through this checklist:

| What to ask | Why |
|---|---|
| Prohibited words or phrases | Company names, product codes, internal project names |
| Replacement text for each word | What should the prohibited word become? Or just `***REMOVED***`? |
| Directories to delete entirely | `.cursor/`, `.agents/`, `.claude/`, `.codex/`, internal tooling dirs |
| File extensions to delete | Archive packages (`.zip`, `.tar`), certificate files (`.pem`, `.crt`) |
| Specific files to delete | Credential files (`.env.local`), screenshots with prohibited content |
| Credentials to scrub | API keys, tokens, passwords, personal emails |
| CA and certificate references | Internal CA bundles, corporate proxy certs, TLS interception config |
| Commit metadata to sanitize | Author names/emails containing prohibited content |
| Branch and tag names to rename | Any ref name containing a prohibited word |

If the user answers any question with "I don't know", tell them:
> "I'll scan the repo and surface what I find. But I need you to decide what gets removed vs kept. This is a destructive operation — once pushed, there's no undo without restoring the prohibited history."

Wait for explicit answers on every item before moving to Phase 1.

---

## Phase 1: Set up the rewrite workspace

Create a completely separate workspace from any existing checkout.

```bash
export REMOTE_URL='<canonical remote URL>'
export REWRITE_ROOT='<absolute path to a NEW, nonexistent directory>'
export CONTROL_DIR="$REWRITE_ROOT/control"
export BACKUP_MIRROR="$REWRITE_ROOT/pre-rewrite-backup.git"
export SANITIZED_MIRROR="$REWRITE_ROOT/sanitized-mirror.git"
export VALIDATION_CHECKOUT="$REWRITE_ROOT/validation-checkout"

umask 077
test ! -e "$REWRITE_ROOT"
mkdir -p "$CONTROL_DIR"
chmod 700 "$REWRITE_ROOT" "$CONTROL_DIR"
```

**Safety rules that must never be violated in this phase:**

- Do NOT run the rewrite in an existing checkout or worktree.
- Do NOT use `git worktree` — it shares the source object database.
- Do NOT let `REWRITE_ROOT` be `/` or an existing directory.
- Never put credentials in `REMOTE_URL`. Use a credential store file.

Set up authentication without exposing credentials in commands or URLs:

```bash
CRED_FILE="$CONTROL_DIR/.git-credentials"
echo "https://oauth2:${TOKEN}@github.com" > "$CRED_FILE"
chmod 600 "$CRED_FILE"
git config --global credential.helper "store --file $CRED_FILE"
```

**Prerequisites to verify:**

```bash
git filter-repo --version        # must be 2.47+ for --sensitive-data-removal
rg --version                     # ripgrep for zero-match gates
python3 --version                # for callback scripts
```

Now clone two fresh mirrors:

```bash
git clone --mirror "$REMOTE_URL" "$BACKUP_MIRROR"
git clone --mirror "$REMOTE_URL" "$SANITIZED_MIRROR"
```

Record the pre-rewrite ref inventory and verify integrity:

```bash
git -C "$BACKUP_MIRROR" for-each-ref --format='%(refname)%09%(objectname)' | sort > "$CONTROL_DIR/before-refs.tsv"
git ls-remote "$REMOTE_URL" | sort > "$CONTROL_DIR/before-ls-remote.tsv"
git -C "$BACKUP_MIRROR" fsck --full
git -C "$SANITIZED_MIRROR" fsck --full
```

Stop if:
- Either clone fails.
- Either `fsck --full` reports corruption.
- The writable refs differ between the mirror and `ls-remote` output (excluding `HEAD`).

---

## Phase 2: Scan the backup mirror for ALL sensitive content

This is the most important phase. **Do not write any filter controls until this phase is complete.**
Missing a pattern here means an extra rewrite round.

### Step 2a: Extract all author/committer/tagger metadata

```bash
echo "=== AUTHORS ==="
git -C "$BACKUP_MIRROR" log --all --format='%an %ae' | sort -u
echo "=== COMMITTERS ==="
git -C "$BACKUP_MIRROR" log --all --format='%cn %ce' | sort -u
echo "=== TAGGERS ==="
git -C "$BACKUP_MIRROR" for-each-ref refs/tags --format='%(taggername) %(taggeremail)' 2>/dev/null | sort -u
```

Flag every identity that contains a prohibited word, personal email, or corporate address.

### Step 2b: Scan all stored objects for prohibited text patterns

Use `cat-file --batch-all-objects` to scan every reachable and unreachable object.
Only print **counts**, never the matched values.

```bash
for pattern in '<prohibited-word-1>' '<prohibited-word-2>' '<credential-pattern>'; do
  count=$(git -C "$BACKUP_MIRROR" cat-file --batch-all-objects --batch 2>/dev/null | rg -c -i "$pattern" 2>/dev/null | wc -l)
  echo "  $pattern: matched in $count blobs"
done
```

### Step 2c: Scan for CA and certificate references

These live in orthogonal locations from the main prohibited content — scan them independently:

```bash
for pattern in \
  'acme_proxy_cacerts' 'NODE_EXTRA_CA_CERTS' 'SSL_CERT_FILE' \
  'REQUESTS_CA_BUNDLE' 'CURL_CA_BUNDLE' 'GIT_SSL_CAINFO' \
  'cafile' 'BEGIN CERTIFICATE' 'BEGIN PRIVATE KEY'; do
  count=$(git -C "$BACKUP_MIRROR" cat-file --batch-all-objects --batch 2>/dev/null | rg -c -i "$pattern" 2>/dev/null | wc -l)
  echo "  $pattern: matched in $count blobs"
done
```

### Step 2d: Scan for files to delete

```bash
echo "=== Hidden agent dirs ==="
git -C "$BACKUP_MIRROR" rev-list --objects --all | rg -i '(^|/)[.]agents?(/|$)|(^|/)[.](claude|codex|cursor|agent)(/|$)'

echo "=== Archive/cert files ==="
git -C "$BACKUP_MIRROR" rev-list --objects --all | rg -i '[.](bundle|skill|zip|7z|rar|tar|tar[.]gz|tgz|tbz|tbz2|tar[.]bz2|txz|tar[.]xz|gz|bz2|xz|jar|war|ear|whl|egg|pem|crt|cer|p12|pfx|jks|keystore|truststore)$'

echo "=== Specific credential files ==="
git -C "$BACKUP_MIRROR" rev-list --objects --all | rg '\.env\.(local|production|git\.local)'
```

### Step 2e: Trace ambiguous matches to their source files

When a scan finds a match, trace it to the specific file path before deciding how to handle it:

```bash
# Find the blob containing the match
git -C "$BACKUP_MIRROR" cat-file --batch-all-objects --batch-check | awk '/blob/{print $1}' | while read blob; do
  if git -C "$BACKUP_MIRROR" cat-file -p "$blob" 2>/dev/null | rg -q -i '<pattern>'; then
    echo "BLOB: $blob"
    git -C "$BACKUP_MIRROR" log --all --find-object="$blob" --format='%H %s' --name-only | head -5
    break
  fi
done
```

If the match is in a binary file, use `strings` to extract readable text:
```bash
git -C "$BACKUP_MIRROR" cat-file -p <blob-id> | strings | rg -i '<pattern>'
```

---

## Phase 3: Build the filter controls

Based on the scan results, create four types of control files.

### Step 3a: `replacements.txt`

Combine specific literal replacements (first) with a generic regex (last).
**Order is critical** — the generic regex must come AFTER all specific literal rules.

```text
# private-replacements.txt (specific, processed first)
literal:<exact-sensitive-phrase>==>***REMOVED***
literal:<credential-value>==>***REMOVED***
literal:<personal-email>==>***REMOVED***

# static-replacements.txt (generic, processed last)
regex:(?i)<prohibited-word>==><neutral-replacement>
```

Concatenate in the correct order:
```bash
cat "$CONTROL_DIR/private-replacements.txt" "$CONTROL_DIR/static-replacements.txt" > "$CONTROL_DIR/replacements.txt"
```

**Why ordering matters**: If the generic regex runs first, it can rename parts of a value that should have been deleted entirely.
For example, `regex:(?i)payment-provider==>payment-provider` applied to `acme_proxy_cacerts.pem` produces `payment-provider_proxy_cacerts.pem` — a renamed internal reference, not a removed one.

### Step 3b: `file_info_callback.py`

Handles file deletion and path renaming:

```python
import re

drop_directories = {b".agent", b".agents", b".claude", b".codex", b".cursor"}
archive_suffixes = (
    b".bundle", b".skill", b".zip", b".7z", b".rar", b".tar",
    b".tar.gz", b".tgz", b".tbz", b".tbz2", b".tar.bz2",
    b".txz", b".tar.xz", b".gz", b".bz2", b".xz",
    b".jar", b".war", b".ear", b".whl", b".egg",
    b".pem", b".crt", b".cer", b".p12", b".pfx",
    b".jks", b".keystore", b".truststore",
)
drop_paths = {
    b".env.git.local",
    b"apps/app/.env.local",
    # ... add all specific files from Phase 2d scan
}

lower_filename = filename.lower()
path_parts = set(lower_filename.split(b"/"))

if path_parts.intersection(drop_directories):
    return (None, mode, blob_id)

if lower_filename in drop_paths or lower_filename.endswith(archive_suffixes):
    return (None, mode, blob_id)

new_filename = re.sub(br"<prohibited-word>", b"<neutral-word>", filename, flags=re.IGNORECASE)
contents = value.get_contents_by_identifier(blob_id)

if value.is_binary(contents):
    return (new_filename, mode, blob_id)

new_contents = value.apply_replace_text(contents)
if new_contents == contents:
    return (new_filename, mode, blob_id)

new_blob_id = value.insert_file_with_contents(new_contents)
return (new_filename, mode, new_blob_id)
```

### Step 3c: `commit_callback.py`

Sanitizes author and committer metadata:

```python
def prohibited(value):
    return b"<prohibited-word>" in value.lower()

if prohibited(commit.author_name) or prohibited(commit.author_email):
    commit.author_name = b"Repository Contributor"
    commit.author_email = b"redacted@example.invalid"

if prohibited(commit.committer_name) or prohibited(commit.committer_email):
    commit.committer_name = b"Repository Contributor"
    commit.committer_email = b"redacted@example.invalid"
```

### Step 3d: `tag_callback.py`

```python
if b"<prohibited-word>" in tag.tagger_name.lower() or b"<prohibited-word>" in tag.tagger_email.lower():
    tag.tagger_name = b"Repository Contributor"
    tag.tagger_email = b"redacted@example.invalid"
```

### Step 3e: `refname_callback.py`

```python
import re
return re.sub(br"<prohibited-word>", b"<neutral-word>", refname, flags=re.IGNORECASE)
```

### Step 3f: Set secure permissions

```bash
chmod 600 "$CONTROL_DIR"/*.py "$CONTROL_DIR"/*.txt
```

---

## Phase 4: Rewrite the fresh mirror

Run the rewrite only inside the sanitized mirror — never in any existing checkout.

```bash
cd "$SANITIZED_MIRROR"
git filter-repo \
  --sensitive-data-removal \
  --replace-text "$CONTROL_DIR/replacements.txt" \
  --replace-message "$CONTROL_DIR/replacements.txt" \
  --file-info-callback "$(cat "$CONTROL_DIR/file_info_callback.py")" \
  --commit-callback "$(cat "$CONTROL_DIR/commit_callback.py")" \
  --tag-callback "$(cat "$CONTROL_DIR/tag_callback.py")" \
  --refname-callback "$(cat "$CONTROL_DIR/refname_callback.py")" \
  2>&1 | tee "$CONTROL_DIR/filter-repo.log"
```

Note the first changed commits from the output — they are needed for GitHub Support later.

**If the rewrite fails or any verification gate fails later:**

1. Discard `$SANITIZED_MIRROR` and `$VALIDATION_CHECKOUT`.
2. Do NOT create a commit in the rewritten mirror.
3. Update the control files based on what was missed.
4. Clone a fresh mirror from the backup:
   ```bash
   git clone --mirror "$BACKUP_MIRROR" "$SANITIZED_MIRROR"
   ```
5. Re-run Phase 4.
6. **Never use `git filter-repo --force`.**

---

## Phase 5: Verify every rewritten ref and object

Run ALL of these gates. Any failure means go back to Phase 3 (or Phase 2 if a new pattern was missed).

### Gate 1: Repository integrity

```bash
git -C "$SANITIZED_MIRROR" fsck --full
```

### Gate 2: Prohibited word in all objects

Must exit with status 1 (no match):

```bash
set +e
git -C "$SANITIZED_MIRROR" cat-file --batch-all-objects --batch | LC_ALL=C rg -a -i -q '<prohibited-word>'
match_status=$?
set -e
test "$match_status" -eq 1
```

### Gate 3: CA and certificate patterns

```bash
for pattern in '<ca-pattern-1>' '<ca-pattern-2>' ...; do
  count=$(git -C "$SANITIZED_MIRROR" cat-file --batch-all-objects --batch 2>/dev/null | rg -c -i "$pattern" 2>/dev/null | wc -l)
  [ "$count" -eq 0 ] && echo "PASS: $pattern" || echo "FAIL: $pattern ($count matches)"
done
```

### Gate 4: Hidden directories and archive files in history

Both must produce no output:

```bash
git -C "$SANITIZED_MIRROR" rev-list --objects --all | rg -i '(^|/)[.]agents?(/|$)|(^|/)[.](claude|codex|cursor)(/|$)'
git -C "$SANITIZED_MIRROR" rev-list --objects --all | rg -i '[.](bundle|skill|zip|7z|rar|tar|...|pem|crt|cer)$'
```

### Gate 5: Ref and metadata

```bash
git -C "$SANITIZED_MIRROR" for-each-ref --format='%(refname)' | rg -i '<prohibited-word>'
git -C "$SANITIZED_MIRROR" log --all --format='%an%n%ae%n%cn%n%ce%n%B' | rg -i '<prohibited-word>'
git -C "$SANITIZED_MIRROR" for-each-ref refs/tags --format='%(taggername)%n%(taggeremail)%n%(contents)' | rg -i '<prohibited-word>'
```

### Gate 6: Fresh validation working tree

```bash
git clone --no-local "$SANITIZED_MIRROR" "$VALIDATION_CHECKOUT"
rg -uuu -a -i '<prohibited-word>' "$VALIDATION_CHECKOUT" --glob '!.git/**'
rg -uuu -a '<ca-pattern-1>|<ca-pattern-2>' "$VALIDATION_CHECKOUT" --glob '!.git/**'
```

### Gate 7: Binary content gate

Enumerate every reachable PDF, Office document, image, and other binary blob.
Extract text or OCR and scan for prohibited content.
If a binary match exists, add every historical path for that blob to `drop_paths` and restart from Phase 3.

### Gate 8: Credential and PII gate

Run a full-history secret scanner against `$SANITIZED_MIRROR`.
Verify that every known credential and personal identifier has zero matches.

### On any failure

Classify the match before adding replacements:

| Match type | Action |
|---|---|
| True positive — internal/corporate reference | Add literal replacement to `private-replacements.txt` |
| False positive — academic text, public code, coincidental character sequence | **Retain** and record a justification; do not blindly remove |

Then discard, re-clone from backup, and re-run Phase 4.

---

## Phase 6: Force-push and remote verification

### Step 6a: Ref drift gate

Immediately before pushing, verify the remote hasn't changed:

```bash
git ls-remote "$REMOTE_URL" | sort > "$CONTROL_DIR/pre-push-ls-remote.tsv"
cmp "$CONTROL_DIR/before-ls-remote.tsv" "$CONTROL_DIR/pre-push-ls-remote.tsv"
```

If `cmp` reports any difference, stop. The remote changed since the snapshot.
Restart from Phase 1 or account for the new remote work with the human.

### Step 6b: Push

```bash
git -C "$SANITIZED_MIRROR" remote remove origin 2>/dev/null || true
git -C "$SANITIZED_MIRROR" remote add origin "$REMOTE_URL"
git -C "$SANITIZED_MIRROR" push --force --mirror origin 2>&1 | tee "$CONTROL_DIR/mirror-push.log"
```

Failures for `refs/pull/*` are expected — GitHub makes those refs read-only.
Any other rejected or failed ref makes the push incomplete.
Fix branch protection as needed and repeat until the only failures are `refs/pull/*`.

### Step 6c: Remote clone verification

```bash
REMOTE_CLONE="$REWRITE_ROOT/remote-clone"
rm -rf "$REMOTE_CLONE"
git clone "$REMOTE_URL" "$REMOTE_CLONE"
```

Repeat ALL Phase 5 zero-match gates against the remote clone.
If any gate fails, the push was incomplete — the prohibited content is still reachable on the remote.
Do not proceed to cleanup until the remote clone passes every gate.

### Step 6d: Clean up credentials

```bash
git config --global --unset credential.helper 2>/dev/null
```

---

## Phase 7: Post-push cleanup

Tasks the agent must itemize but typically cannot execute alone:

- Contact GitHub Support with the repository name, first changed commits, and affected PR count.
- Ask GitHub Support to remove `refs/pull/*` references, cached views, and unreachable objects.
- Identify every fork — coordinate rewrite or deletion.
- Require every collaborator to delete the old clone and create a new clone.
- Invalidate CI caches, release artifacts, deployment caches, and backups.
- Keep the local `$BACKUP_MIRROR` offline and access-restricted until remote cleanup is confirmed.
- Delete `$BACKUP_MIRROR` and `$CONTROL_DIR` only after explicit human approval.

---

## Completion criteria

The task is done only when ALL conditions are true:

- Every writable remote branch and tag points to the rewritten history.
- A fresh clone from the remote passes all zero-match gates.
- No prohibited hidden directory or archive package is reachable from any rewritten ref.
- No case-insensitive prohibited word match exists in objects, paths, refs, messages, or metadata.
- No known credential or personal value remains reachable.
- No cleanup commit was created.
- Branch protections and automation are restored.
- GitHub pull-request refs and caches are handled.
- Forks and collaborator clones cannot reintroduce the old history.

---

## Stop conditions

| Condition | Action |
|---|---|
| User cannot specify what to remove | Do not proceed. A rewrite without clear targets destroys history for no reason. |
| `git filter-repo` is not installed or below version 2.47 | Install it first. The `--sensitive-data-removal` flag is required. |
| Remote ref drift detected in Phase 6 | Stop. Restart from Phase 1 or account for the new work with the human. |
| Non-PR refs rejected during push | Stop. Fix branch protection and re-push. |
| Verification gate fails on remote clone | The push was incomplete. Investigate and re-push. |

---

## Anti-patterns to avoid

- **Writing filter controls before scanning.** A 5-minute full-object scan prevents hours of rework.
- **Putting the generic regex before specific literal replacements.** Causes renamed artifacts instead of removals.
- **Creating a cleanup commit.** If the rewritten tip is invalid, discard and re-clone. Every content change must come through `git filter-repo`.
- **Running the rewrite in an existing checkout or worktree.** Always use a fresh mirror clone.
- **Using `git filter-repo --force`.** Never. The fresh-clone safety check must remain active.
- **Printing sensitive values.** Show counts, never the actual matched content or credentials.
- **Putting credentials in URLs or commands.** Use `git credential.helper` with a store file.
- **Using broad regex verification patterns like `corporate.*CA`.** They match false positives in unrelated text. Use narrow literal patterns and classify each match.
