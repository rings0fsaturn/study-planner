---
name: supabase-live-stack
description: Operate and verify against the hosted Supabase project: CLI push and query, PostgREST, Storage, pgmq, and halfvec contracts.
---

# Supabase Live Stack

## CLI and credentials

The supabase CLI lives at `~/.local/bin/supabase` on this host and is not on PATH.
The project is linked in `apps/app/` (config.toml `project_id = kabpmbhlvfbrhtbxjaua`).

Run CLI commands from `apps/app/`:

```bash
~/.local/bin/supabase db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua
~/.local/bin/supabase db query --linked --project-ref kabpmbhlvfbrhtbxjaua "SELECT ..."
```

The CLI holds a cached database credential from the original `supabase link`.
Do not pass `--password` to `db push`: a wrong value overrides the cached credential and auth fails.
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
The worker and browser write the same object layout: `material-raw/<ownerId>/<materialId>/<file>` with the bucket selected by the client.

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
