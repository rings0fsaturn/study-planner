# Jev Slice-1 Graduation: Suitability Bands + Citation Enforce

## Problem
Slice-1 Jev judgments (suitability pre-gate + citation adjudication) run shadow-only behind `JEV_SLICE1_ENABLED` with cookbook starting thresholds (`APPROVE_AT=0.9`, `BLOCK_AT=0.1`, `AUTO_ACCEPT=0.8`).
The developer operating generation cannot claim overall improvement while confident Jev verdicts only log and never act, so bad coding questions on codeless material and unverified citations keep shipping.

## Evidence
- Assumption — needs validation via Phase A stress sweep.
- #74 proves the measurement method and Jev Score quality, not slice-1 bands: rubric-first on 75 real pairs (by-question 9/9 split, zero overlap), test agreement 0.974 at cutoff 0.6, 39 pairs, 0 malformed, p95 2.4 s under the 15 s ceiling, spend $0.0007 reconciled to dashboard within -1.9%.
- Zero suitability approve/review/block splits and zero citation verified/contradicted/unsupported splits exist on real rows as of #74 close.

## Users
- **Primary**: developer operating the generation pipeline, deciding whether shadow judgments are trustworthy enough to enforce.
- **Not for**: learners directly; they feel only the downstream effect (fewer bad questions, fewer unverified citations).

## Hypothesis
We believe **slice-1 enforce (suitability bands + citation drops)** will **improve generation quality** for **the developer operating generation**.
We'll know we're right when **suitability bands hold with separation above run-to-run jitter (~0.08) and citation confident-reject precision clears the bar on review rows, with fail-open kept on every Jev error path**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Suitability band separation | approve/block gap exceeds jitter with review band bounded | Phase A sweep distributions on ~30 fresh hand-labeled rows per question |
| Citation confident-reject precision | clears the bar on review rows | Phase A sweep on real generation rows |
| Agreement reporting hygiene | no train-on-test; band-picking rows never report final agreement | by-question split with declared overlap and bias direction |
| Cost and latency | within key-level $0.5 cap; p95 under 15 s ceiling | spend-guarded sweep script + dashboard reconciliation |

## Scope
**MVP** — Phase A stress sweep (2 prompt variants per question x small threshold grid x 2 repeats, ~30 fresh hand-labeled rows per question, #74-scale spend) posting distributions, then Phase B enforce flip (bands enforce, citation confident-reject drops with the existing `citation_missing`/`malformed_output` split and no repair, `supports` clears the soft warning) behind the existing `JEV_SLICE1_ENABLED` flag with fail-open kept.

**Out of scope**
- #76 RAG enforce — sequenced after #75, separate ticket.
- #77 rubric flag queue — queued last, separate ticket.
- New flags — reuse `JEV_SLICE1_ENABLED`; no new flag in #75.
- Guardrails battery — out of scope per map #69.
- Browser-side Jev — keys stay server-side in gitignored `services/intelligence/.env`.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Phase A stress distributions posted | Suitability + citation band candidates with separation evidence on fresh rows | pending | — |
| 2 | Phase B enforce flipped | Confident suitability blocks and citation drops act in generation; shadows retire | pending | — |

## Open Questions
- [ ] Where do fresh rows come from and who hand-labels derivable/review/refuse and accept/review per row?
- [ ] What confident-reject precision clears citation enforce?
- [ ] Do suitability bands need per-family splits beyond coding (objective/written stay advisory per #75)?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hand-labeled rows skew toward easy cases | Medium | High | Sample every disagreement class; declare overlap and bias direction |
| Probability jitter (~0.08) collapses band separation | Medium | High | Jitter-separation gate; bands stay far apart with review in the middle |
| Builder wording change mid-sweep poisons rows | Low | High | Any builder/client change re-runs the dry run and restarts affected rows |
| Spend overrun on repeats | Low | Medium | `--limit 2` dry run first; spend guard with key-level $0.5 cap |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
