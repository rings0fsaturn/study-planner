# Gap 9 plan - JEV probe budget sign-off (2026-10-22)

_Goal: a written spend decision for further JEV loop probes, so gap 8 (and any future verdict work) has an approved budget instead of spending into an exhausted one._

## Ground facts

- Spent: 1 dry-run + 10 confirmation probes (`closed-loop-hold-analysis/state.md:11,75`); slice-1 178 calls ~$0.0034, slice-2 ~$0.0012 on record.
- Price basis is a list-price estimate ($0.042/Mtok input, no `usage.cost` surface); dashboard confirmation pending (`jev-integration/state.md:122`).
- Held prior: cutoff/margin 0.6/0.10 (train 0.7/0.05 contradicted on test; test met-class thin at 2 pairs).

## Steps

1. Draft the sign-off memo: spent to date (calls x price with the list-price caveat), requested budget (calls x purpose: dip replay needs N verdict calls across 4 archetypes), stop rule (halt and re-ask if spend exceeds 2x estimate or a probe changes the held prior).
2. Get the human decision: approve / approve-capped / deny (deny scopes the paper to the existing 4/4 rebound replay + offline calibration report, which is already a complete result).
3. Record the decision in the brief's JEV row and in this plan; close gap 9 in the brief either way (a deny is a decided outcome, not an open gap).

## Acceptance

- A dated approve/approve-capped/deny with numbers attached. No further loop probes run without it.

## Cost

- Zero until decided. This gap resolves first if gap 8 needs verdict calls; otherwise it resolves standalone.
