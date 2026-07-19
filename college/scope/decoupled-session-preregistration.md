# Decoupled Session Generator Pre-registration

Date: 2026-06-30

This document freezes the extra parameters for the `decoupled` synthetic
generator regime. It does not replace or edit
`college/scope/archetype-preregistration.md`; the original archetype and latent
pace parameters remain the base A-series contract.

## 1. Regime identity

- Regime name: `decoupled`
- Dataset id shape: `synthetic-decoupled-<combined_hash>-seed0-n<count>`
- Combined hash: `sha256(PARAMS_VERSION_HASH ":" DECOUPLED_PARAMS_HASH)[:12]`
- Generator version: `0.2.0`

## 2. Study-day cadence

Each learner receives a planned weekly study-day set. The number of study days
is sampled once per learner:

| study days per week | probability |
|---:|---:|
| 3 | 0.20 |
| 4 | 0.35 |
| 5 | 0.30 |
| 6 | 0.15 |

The actual weekdays are sampled without replacement and sorted Monday to Sunday.
The generator lays one booked session on selected study days, then injects a
target fraction of ad-hoc sessions on non-study days. This models the new
capacity-booking design without material packing.

## 3. Ad-hoc sessions

Per learner target ad-hoc fraction:

- `adhoc_rate ~ Uniform(0.10, 0.20)`

The emitted ad-hoc count is rounded from `target_sessions * adhoc_rate`, with
at least one ad-hoc session when the learner has enough sessions. Ad-hoc
sessions are only placed on non-study days and receive auto-created booking ids.

## 4. Interrupted partial chunks

Per learner target interruption fraction:

- `interruption_rate ~ Uniform(0.15, 0.25)`

Interrupted sessions consume a partial material chunk:

- `position_fraction ~ Uniform(0.25, 0.70)`
- `plannedMinutes = position_fraction * full_chunk_minutes`
- `activeMinutes = plannedMinutes * latent_ratio`

Complete sessions consume the full chunk. This preserves the D-02 invariant:
for every active event, including partials, `activeMinutes / plannedMinutes`
equals the latent pace ratio for that event.

## 5. Dial/adherence side-channel

The session dial is generated as a separate field from the throughput
denominator:

- `adherence_bias ~ LogNormal(mu=0, sigma=0.12)`, clipped to `[0.85, 1.20]`
- `plannedSessionMinutes = full_chunk_minutes * adherence_bias`

This field exists so the new event stream carries the session-length
mis-estimation signal. It is not used by the R2/R3 throughput readers.

## 6. Non-goals

- Do not retune `m_global`, role multipliers, context multipliers, regime
  shifts, fatigue, deadline, trend, clipping, or AR(1) noise.
- Do not modify `PARAMS_VERSION_HASH` or the A-series reference dataset ids.
- Do not build an adherence-model benchmark in this workstream.
