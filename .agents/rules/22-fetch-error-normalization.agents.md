---
name: fetch-error-normalization
description: Normalize browser fetch failures into stable typed service errors across realms and test environments.
---

# Fetch Error Normalization

Every service client must expose its documented typed errors after retries are exhausted.
Do not leak raw `AbortError`, `TypeError`, `DOMException`, or unknown values to React consumers.

Pass through errors owned by the client.
Classify foreign errors by stable fields such as `name` and `message` instead of relying only on `instanceof Error`.
Treat abort-shaped failures as timeouts and network-shaped failures as service errors.
Preserve the retryable classification when wrapping an error.

Test with an `Error` subclass whose `name` is `AbortError`, a rejected `TypeError`, and an unknown non-Error value.
Do not rely on jsdom's `DOMException` behavior as proof that real browser normalization works.

Keep the normalization path centralized in the service client rather than repeating catch logic in hooks or pages.
