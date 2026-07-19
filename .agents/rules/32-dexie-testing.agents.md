---
name: dexie-testing
description: Isolate Dexie tests with fake IndexedDB, unique database names, and explicit cleanup.
---

# Dexie Testing

Load `fake-indexeddb/auto` before code that opens Dexie in Vitest.
Use a database name unique to the test file or test case.
Never use a production `StudyTracker_<userId>` name in unit tests.

Open the database before assertions that depend on schema creation.
Clear or delete test state between cases and close every database connection after the test.
Await all asynchronous cleanup.

Test storage deep modules through constructor injection when React lifecycle is not part of the behavior under test.
Use provider tests only for provider ownership, user switching, readiness, and React integration.

For schema work, seed the previous schema version before opening the new version and verify data survival explicitly.
