# Gap 9 sign-off memo - JEV probe budget (2026-10-22)

## Spent to date (loop lane only; slice tickets tracked separately)

- Analysis session: 6 JEV calls, ~6.2k input tokens, ~$0.0003.
- Phase 1 (N1/N2 sign-off 2026-10-19): 1 dry-run + 10 confirmation probes, ~12.3k input tokens, ~$0.0005.
- Loop-lane total: 17 calls, under $0.001. The N2 cap (at most 10 more cheap calls, then stop and ask) is reached.

## Price basis (caveat attached)

- TypeSafe list $0.042/Mtok input, output free; OpenRouter returns no `usage.cost`, so all figures are estimates. Observed ~1,155 input tokens per loop verdict call, about $0.00005 per call.

## Requested (gap 8 dip-window replay)

- 1 dry-run + 4 archetype verdict calls + up to 5 repeats/contingency = at most 15 calls, about $0.001 at the listed price.
- Proposed stop rule: halt and re-ask if spend exceeds 2x estimate, if any probe errors on provider credentials, or if a probe moves the held 0.6/0.10 prior (that becomes a new finding, not background spend).

## Options

- Approve: 15-call cap for the dip replay under the stop rule above.
- Approve-capped: 5-call cap (1 dry-run + 4 archetypes, zero repeats; any failure returns for re-ask).
- Deny: no further loop probes. The paper keeps the existing 4/4 rebound replay + offline calibration report, which is already a complete result; gap 8 closes as scoped-out.

## Decision (to be recorded with date)

- APPROVED 15-call cap 2026-10-22 (user sign-off, dip replay may proceed under the stop rule above).
