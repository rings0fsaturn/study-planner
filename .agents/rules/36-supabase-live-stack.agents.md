---
name: supabase-live-stack
description: Operate and verify against the hosted Supabase project: CLI push and query, PostgREST, Storage, pgmq, and halfvec contracts.
---

# Supabase Live Stack

## CLI and credentials

The supabase CLI is not installed on PATH and no longer lives at
`~/.local/bin/supabase` on this host; fetch it on demand with npx from
`apps/app/`:

```bash
npx --yes supabase@latest --version
```

The project is linked in `apps/app/` (config.toml `project_id = kabpmbhlvfbrhtbxjaua`),
and the link cache lives in `apps/app/supabase/.temp/` (project-ref, pooler-url).

The personal access token is `SUPABASE_ACCESS_TOKEN` in the gitignored
`services/intelligence/.env` (never commit it; the file is in `.gitignore`).
The root `.env.git.local` also carries `SUPABASE_ACCESS_TOKEN`; prefer the
intelligence env file.
Log the CLI in with that token before any remote command; the login persists
to the CLI profile so later invocations need no token:

```bash
export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' services/intelligence/.env | cut -d= -f2- | tr -d '\r\n')
npx --yes supabase@latest login --token "$SUPABASE_ACCESS_TOKEN"
```

The CLI ignores the `SUPABASE_ACCESS_TOKEN` environment variable for remote
commands in practice; use `supabase login --token` instead.

Run CLI commands from `apps/app/`:

```bash
npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua
npx --yes supabase@latest db push --linked --project-ref kabpmbhlvfbrhtbxjaua
npx --yes supabase@latest db query --linked --project-ref kabpmbhlvfbrhtbxjaua "SELECT ..."
```

`db push` connects to the remote Postgres through the pooler, applies each
pending migration, and dumps the schema to diff against the previous state.
That dump phase plus the host's flaky egress (rule 52) can make a push appear
stuck; give it minutes, and read `--debug` output before assuming failure.
A final "Remote database is up to date." in a dry-run means every local
migration is already applied remotely, including one an earlier interrupted
push actually finished.

Do not pass `--password` to `db push`: a wrong value overrides the cached
credential and auth fails.
The service-role key is not the database password for this project.
A migration already applied on the remote is recorded in `supabase_migrations.schema_migrations` and will not re-run.
Before trusting the SQL, confirm the live contract: wrapper signatures, grants, and schema can all drift from the migration text.

## PostgREST

Bulk inserts need a bare JSON array body.
`{"rows": [...]}` is rejected by the hosted PostgREST with PGRST204 (`Could not find the 'rows' column`).
Inspect live function signatures with `supabase db query` before calling or wrapping them.

## Storage

Add `x-upsert: true` on uploads that overwrite a deterministic path, so redelivered work is idempotent.
Object names inside a bucket must not repeat the bucket id.
`storage.foldername(name)[1]` is the first folder inside the bucket, so an object named `material-raw/<uid>/...` fails the owner policy even though the folder text matches.
The worker and browser write the same object layout: the object name is `<ownerId>/<materialId>/<file>` inside the `material-raw` bucket, with the bucket selected by the client.

## pgmq

The hosted pgmq has no two-argument `pgmq.read(queue, vt)`.
Its signature is `pgmq.read(queue_name text, vt integer, qty integer, conditional jsonb)`.
Check `pg_proc` with `supabase db query` when a security-definer wrapper fails with `function pgmq.read(text, integer) does not exist`.

## Gemini embeddings

`batchEmbedContents` returns the model default of 3072 dimensions for `gemini-embedding-001`, which does not fit `halfvec(768)`.
Always send `outputDimensionality` equal to `EMBEDDING_DIMENSIONS` in every request.
A valid key is around 53 characters and starts with `AQ.Ab8`; a placeholder ends in `LE_KEY`.
Probe the API once before diagnosing the embedder:

```bash
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents" \
  -H "x-goog-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"requests":[{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"probe"}]},"outputDimensionality":768}]}'
```

## Probing with credentials

Use the publishable key from `apps/app/.env.local` for table probes.
Use a real access token from `POST /auth/v1/token?grant_type=password` with the dev credentials for RLS-scoped operations.
Keep secret values in shell variables and never print them.
