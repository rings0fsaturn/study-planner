---
name: supabase-migrations-and-rls
description: Keep remote event and snapshot storage user-scoped through committed migrations and RLS.
---

# Supabase Migrations and RLS

Treat `apps/app/supabase/migrations/` as the remote schema source of truth.
Add a new migration for remote schema or policy changes instead of rewriting an already-applied migration.

Enable row-level security on every user-owned table.
Require `auth.uid()` ownership in both read predicates and write checks.
Keep event deduplication keys indexed and preserve user-scoped query indexes used by sync.

Keep snapshot storage private.
Prefix snapshot object paths with the authenticated user ID and enforce that prefix in storage policies.
Do not expose service-role credentials to the browser or commit them to the repository.

Update sync types, engine behavior, local fixtures, and migration verification together when the remote contract changes.
