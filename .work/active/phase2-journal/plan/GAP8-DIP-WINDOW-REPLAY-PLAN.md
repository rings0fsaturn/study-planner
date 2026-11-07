# Gap 8 plan - week-3 dip-window replay (2026-10-22)

_Goal: verdict-gated replay timed at the week-3 dip (not rebound era), so the paper's closed-loop claim covers the hard case instead of only the recovery._

## Ground facts

- Existing 4/4 conversions are rebound-era by caveat on record (`synthetic-users-seeding/state.md:6,70`); clock was pinned 2026-10-14 with deadline 2026-10-15.
- Tooling exists: synthSeed / synthDriver / synthExtract suites green at commit `9f7d08e` (22/22, 11/11, 23/23); gate `LOOP_APPROVE_AT` 0.7 with sweep agreement 0.857 at 0.5-0.7.
- JEV verdicts flow through `jev-1.13` propose + code-router dispose; further loop probes may spend budget (see gap 9). Confirm remaining budget before replaying.
- Extract-from-cloud-only and exact `verdictId`/`verdictDecidedAt` mirror rules carry over from the post-fix replay.

## Steps

1. Read the synthDriver history-shape code and the postfix `.json` inputs; define the dip-window history profile (pace dip, skips, gaps) per archetype before running.
2. Dry run per rule 80: one archetype (struggling) through seed, drive, verdict, extract; verify verdict records join and the mirror holds.
3. Full replay across 4 archetypes with dip timing; emit verdict + adherence tables via `synthExtract`.
4. Write `research/doc/2026-XX-dip-window-replay.md` (dip vs rebound side by side: conversions, conf, sufficiency, options); update the brief's loop rows with both eras. Close gap 8 in the brief.

## Acceptance

- Dip-window conversions reported with the same mirror checks (createdAt >= decidedAt, exact pair join) or hold outcomes explained per verdict trace.
- Rebound caveat stays attached to the old numbers; no era is silently generalized.

## Cost

- Synthetic pipeline compute + possible JEV probe spend (blocked on gap 9 sign-off if budget is exhausted). Sequential, shared-account hygiene applies.
