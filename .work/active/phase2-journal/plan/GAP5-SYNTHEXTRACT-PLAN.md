# Gap 5 plan - synthExtract table emission (2026-10-22)

_Goal: the full adherence/mastery/verdict tables (including next-week adherence rebound numbers) emitted from post-2026-10-19 cloud reads, for the paper's verdict Table 1 and adherence figure._

## Ground facts

- Post-fix evidence exists (`synthetic-users-results-2026-10-19-postfix.json/.html`) but full package-based emission via `synthExtract` still runs at report assembly (`synthetic-users-seeding/state.md:12,69`).
- Hard rules from that state: extract from cloud only (cold-restore local duplication: struggling 132 local vs 51 cloud); clock was pinned 2026-10-14 with deadline 2026-10-15; existing verdicts are rebound-era.
- Next-week adherence is defined in `tab:phase2-metrics` but has no measured values.

## Steps

1. Read `synthetic-users-seeding/state.md` + its SCRATCHPAD for the exact `synthExtract` invocation and `report_use` line in postfix `.json`.
2. Dry run per rule 80: emit tables for one archetype only; verify shape (verdict/conf/sufficiency/option/converted + adherence columns) before the full emission.
3. Full emission across 4 archetypes against current cloud reads; capture next-week adherence rebound numbers.
4. Write results into the brief's verdict-table row (sec 4: 4 rows x verdict/conf/sufficiency/option/converted + selection sentence) and record the adherence figure data; close gap 5 in the brief.

## Acceptance

- Tables reconcile with postfix `.json` (4/4 conversions, conf 1.0, sufficiency 0.66-0.77) or deltas explained.
- Adherence numbers present with their rebound-era caveat attached, never silently generalized.

## Cost

- Supabase reads only; no GPU, no paid APIs. Sequential with other live sessions (shared-account hygiene).
