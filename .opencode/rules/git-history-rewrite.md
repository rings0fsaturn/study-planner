# Git History Rewrite Guidelines

Rules learned from executing a full-history sanitization with `git filter-repo --sensitive-data-removal`.
Apply these when planning or executing any future history rewrite in this repository.

## Pre-rewrite Scanning Must Be Exhaustive

Run a full object scan against the fresh backup mirror before writing any filter controls.
Missing patterns cause extra rewrite rounds.

```bash
git -C "$BACKUP_MIRROR" cat-file --batch-all-objects --batch | rg -c -i '<pattern>'
```

Check ALL these categories before writing the first replacement file:

| Category | Examples |
|---|---|
| Prohibited words/phrases | company names, product codes |
| Internal hostnames and domains | corp proxy URLs, internal registries |
| Credentials and tokens | API keys, PATs, passwords |
| Personal identifiers | real names, personal emails, usernames |
| CA and certificate references | env vars like `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE` |
| Certificate bundle filenames | `.pem`, `.crt`, internal CA paths |
| Proxy setup instructions | `brew install docker`, `colima start` adjacent to CA text |
| Directory names to drop | `.agent`, `.agents`, `.claude`, `.codex`, `.cursor` |
| File extensions to drop | `.pem`, `.crt`, `.cer`, `.p12`, `.pfx`, `.jks`, `.keystore`, `.truststore` |

## Replacement Ordering Is Critical

Specific literal replacements MUST appear before generic regex replacements in the combined file.
Otherwise a generic regex can rename parts of a value that should have been deleted entirely.

**Correct order** (private then static):
```
private-replacements.txt (specific literals first)
static-replacements.txt (generic regex last)
```

**Example failure mode**: `regex:(?i)acme==>vendor` applied to `acme_proxy_cacerts.pem` produces `vendor_proxy_cacerts.pem` -- a renamed internal reference, not a removal.

**Fix**: Add `literal:acme_proxy_cacerts.pem==>***REMOVED***` BEFORE the acme regex.
The literal match consumes the full string; the regex never sees it.

## Account for CA and Certificate Content Separately

CA and certificate references live in orthogonal locations from the main prohibited content.
Common locations in this repository:

- Docker setup rules under hidden agent directories
- Environment variable references in Dockerfiles and READMEs
- Work planning documents referencing corporate network setup
- Research documentation referencing corporate mirror/CA fallbacks

Scan for these patterns independently of the main prohibited-word scan.
Treat `file_info_callback.py` drop_paths for files that cannot be safely text-replaced.

## Plan for 2--4 Rewrite Rounds

The first verification run will surface missed patterns.
Budget for iteration instead of trying to achieve a perfect one-shot rewrite.

Workflow per round:
1. Run rewrite with current controls
2. Run all verification gates
3. If any gate fails, investigate the match
4. Classify: true removal needed, or false positive to retain with justification
5. Update private-replacements.txt with new literal rules
6. Discard sanitized mirror and validation checkout
7. Clone a fresh mirror from the untouched backup
8. Re-run rewrite

Do NOT try to fix by creating commits in the rewritten mirror.
Every content change must come through `git filter-repo`.

## Verification Gate Regexes Must Be Narrow

Broad regexes like `corporate.*CA` match false positives in unrelated text.
Academic paper abstracts, license headers, and general documentation can contain
the character sequence "CA" in words like "capacity", "education", "academic".

Use specific literal patterns as the primary verification gates.
Reserve broad regexes for a final sweep, and classify any match that is not a true
internal/corporate reference. Record retained matches with a justification.

## Always Check Binary Content

`git filter-repo --replace-text` skips files it detects as binary.
Use `strings` on matched blobs to extract text from binary or mixed-content files.

The `file_info_callback.py` handles file deletion/renaming but text replacement
inside detected-binary files requires separate handling.
If a binary file contains prohibited text, add its path to `drop_paths`.

## Comprehensive Verification Checklist

After each rewrite round and before every push, run ALL of these:

| Check | Command |
|---|---|
| Repository integrity | `git fsck --full` |
| Prohibited word in all objects | `git cat-file --batch-all-objects --batch \| LC_ALL=C rg -a -i -q '<word>'` (expect exit 1) |
| Ref names | `git for-each-ref --format='%(refname)' \| rg -i '<word>'` |
| Commit metadata | `git log --all --format='%an%n%ae%n%cn%n%ce%n%B' \| rg -i '<word>'` |
| File paths in history | `git rev-list --objects --all \| rg -i '<word>'` |
| Hidden dirs absent | `git rev-list --objects --all \| rg '(^\|/)[.]agents?\|[.](claude\|codex\|cursor)'` |
| Archive/cert files absent | `git rev-list --objects --all \| rg '\.(pem\|crt\|cer\|zip\|tar\|gz\|...)'` |
| Working tree scan | `rg -uuu -a -i '<word>' . --glob '!.git/**'` |
| Remote clone verification | Repeat above on a fresh clone from remote after push |

## Safety Rules That Must Never Be Violated

- Never run `git filter-repo --force`.
- Never run the rewrite in an existing checkout or worktree.
- Always clone a fresh mirror from remote before rewriting.
- Never put credentials in the remote URL, a command, or the plan text.
- Use `git credential.helper` with a store file for authentication.
- Never print a credential, personal email, or replacement-file content.
- Keep every replacement file and scan report outside the repository.
- Run `umask 077` before creating control files.
- Keep an untouched local backup mirror until remote cleanup is confirmed.
- Discard and re-clone on any verification failure -- never create a cleanup commit.
- Stop if the remote ref manifest changes between snapshot and push.

## Post-push Remote Cleanup

GitHub `refs/pull/*` refs are read-only and cannot be overwritten by a mirror push.
GitHub Support must remove affected pull-request refs and cached views.
Forks and collaborator clones must be deleted or correctly cleaned -- a normal pull
from an old clone can restore the old history.
