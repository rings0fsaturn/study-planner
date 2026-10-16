# Live TEST USER emulation boundary, no server seed API

Synthetic report histories are built as real isolated Supabase Auth accounts (one per archetype) writing through EventStore and real product paths, with zero new seed endpoints and zero service-role keys outside gitignored server env.

## Considered Options

A server-side seed API (or direct service-role inserts) would be faster and scriptable, but it creates a prod-accessible backdoor the report would have to disclaim and bypasses exactly the SyncEngine/RLS/event-order contracts the report claims to exercise.

## Consequences

Seeded histories are disposable by construction: cleanup is per-user wipe plus test-user/material deletion, never a shared-account scrub.
Credentials for the four accounts stay env-only (ignored local file), so a routine commit can never publish them; rotating any password that once sat in a tracked file remains advisable.
