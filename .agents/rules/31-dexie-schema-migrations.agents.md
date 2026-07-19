---
name: dexie-schema-migrations
description: Evolve the per-user Dexie schema without destroying existing browser data.
---

# Dexie Schema Migrations

Never edit a released Dexie version declaration to represent a new schema.
Add a new integer version after the current highest version.
Declare the complete intended table and index schema for that new version so omitted stores are not removed accidentally.

```ts
db.version(nextVersion).stores({
  events: '++id, kind, createdAt',
  existingTable: 'key',
  newTable: 'key',
})
```

Add an `upgrade()` transform when existing records need data changes.
Make upgrade logic idempotent at the record level where practical.
Do not wipe the database as a migration strategy.

Test an upgrade from the previous released schema with representative existing data.
Assert that old records remain readable and that every expected table and index is available after the upgrade.
