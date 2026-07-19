# Paper Claim Audit

**Paper:** `college/mydeliverables/3rd-Review/journal/paper.tex`

**Checklist source:** `college/mydeliverables/3rd-Review/journal/ai_pattern_revision_checklist.md`

**Evidence source:** `.work/plans/active/2026-07-03 third-review-report-work/research/`

**Status:** First evidence-strict audit before rewriting, with revision-pass updates added afterward.

## Revision-Pass Update

The revised `paper.tex` now avoids the word "deployed" and uses "implemented prototype" language.

The split-conformal correction is now framed as an evaluated research finding and future app-promotion item, not as current prototype behavior.

The compact result extraction is now reproducible through `extract_paper_results.py` and summarized in `paper_results_extract.md`.

The pending pace-calibration ablation-style table is now added to the paper and extractor output.

It reports decoupled prospective context-prediction error across baseline, context-aware, and promoted calibration families, with a caveat that it is a candidate-family comparison rather than a strict causal ablation.

## Audit Rule

Only keep a claim if it is true, documented, or directly recoverable from project files.

If a claim is true for the research but not yet promoted into the app, the paper should present it as a research result and move promotion into future work.

If a claim is true for the app but not validated by research, the paper should present it as implementation context, not as an evaluated method result.

## Priority Findings

1. The initial draft incorrectly said the split-conformal interval correction was used in the delivered system.

2. The split-conformal correction is a validated research finding and a future app-promotion item.

3. The tuned dual-arm CUSUM detector is a research finding, while the app uses a simpler single-arm CUSUM.

4. The scheduling optimizer result is valid research for the retired packed-slot formulation, but the product redesign retired that problem in favor of blank bookings and late material binding.

5. The app should be described as an implemented local-first prototype or implementation context unless exact public deployment evidence is added.

## Claim Table

| ID | Current claim or topic | Location | Status | Evidence | Action |
|---|---|---:|---|---|---|
| C01 | The paper presents an adaptive study-planning system that uses the learner session log as evidence. | paper.tex:35 | Confirmed | `01-app-architecture-and-data-flow.md` lines 213-220, 226-232, 353-376. | Keep, but state whether this is research framing, app behavior, or both. |
| C02 | Hierarchical Bayesian calibration refined by context-aware shrinkage estimates pace from few sessions. | paper.tex:35, 119-124 | Confirmed with detail needed | `01-app-architecture-and-data-flow.md` lines 353-376; `02-research-to-app-mapping.md` lines 79, 131. | Keep and add hyperparameters `ridge=2.0` and `shrink=6.0`, plus the 10 context features. |
| C03 | The shrinkage calibrator uses observable context. | paper.tex:119 | Confirmed | `01-app-architecture-and-data-flow.md` lines 358-363. | Keep and replace broad feature wording with the exact feature list. |
| C04 | The delivered calibrator is a dual-prior ensemble. | paper.tex:124 | Confirmed | `01-app-architecture-and-data-flow.md` lines 364-376; `02-research-to-app-mapping.md` lines 64-66, 79. | Keep, but note it is server-side Python and overrides the plain Bayesian global multiplier. |
| C05 | A CUSUM statistic detects pace shifts and raises a recalibration prompt. | paper.tex:35, 128-133, 182 | Confirmed with qualification | `01-app-architecture-and-data-flow.md` lines 30-32, 213-220, 288-292; `02-research-to-app-mapping.md` lines 80, 132. | Keep for the app, but distinguish production single-arm CUSUM from research-tuned dual-arm CUSUM. |
| C06 | The tuned dual-arm CUSUM is the detector to adopt next. | paper.tex:219 | Confirmed as future work | `02-research-to-app-mapping.md` lines 80, 166-169; `03-research-to-literature-mapping.md` lines 57-58. | Keep in future work, not as delivered behavior. |
| C07 | No tested alternative consistently improves over CUSUM. | paper.tex:182, 212 | Should be reframed | `2026-06-30-frozen-vs-decoupled-comparability.md` lines 73-85; `2026-06-18-pillar-a-report-claims-and-caveats.md` lines 44-48, 137-143. | Replace "robust null" with the more precise drift and step findings, including fading-flame exceptions. |
| C08 | Gaussian-process projection with a cold-start composite is part of the app. | paper.tex:83, 142 | Confirmed | `01-app-architecture-and-data-flow.md` lines 226-232, 322-335; `02-research-to-app-mapping.md` lines 81, 133. | Keep, but state it is a small-band or cold-start fallback layered on GP. |
| C09 | Split-conformal interval correction is used in the delivered system. | paper.tex:35, 100, 142, 186, 202, 217 | Should be reframed | `01-app-architecture-and-data-flow.md` lines 344-351, 558-559; `02-research-to-app-mapping.md` lines 44-47, 70-71, 82, 134, 156-158; `03-research-to-literature-mapping.md` line 61. | Change to research result and future work. |
| C10 | Split-conformal correction restores interval coverage near nominal. | paper.tex:186, 202 | Confirmed as research result | `2026-06-18-pillar-a-report-claims-and-caveats.md` lines 26-35; `2026-06-30-frozen-vs-decoupled-comparability.md` lines 98-105. | Keep as evaluated research, not as a delivered app claim. |
| C11 | The paper uses synthetic ground truth. | paper.tex:155, 158, 214, 219 | Confirmed | `02-research-to-app-mapping.md` line 86; `2026-06-30-frozen-vs-decoupled-comparability.md` lines 30-39. | Keep and add a Synthetic Data Generator subsection. |
| C12 | The public LMS dataset should be named. | paper.tex:155, 158 | Needs detail | `research/datasets/synthetic-reality-c545404bcacf-seed0-n5400/manifest.json` identifies OULAD, CC-BY 4.0, 571356 kept rows, 1440 usable series, and moment bounds. | Replace "large public LMS dataset" with OULAD and explain it was used for moment bounds, not direct learner validation. |
| C13 | The synthetic generator used 200 seeds and held-out archetypes. | paper.tex:155, 158 | Confirmed | `2026-06-30-frozen-vs-decoupled-comparability.md` lines 18-20, 41-53; manifest files under `research/datasets/*-n5400/`. | Keep and add experiment configuration table with 200 seeds, 5400 learners, 9 archetypes, 3 bands, 5 train archetypes, and 4 held-out archetypes. |
| C14 | The paper uses Holm and Benjamini-Hochberg correction plus bootstrap delta confidence intervals. | paper.tex:35, 55, 155, 158, 217 | Confirmed | `2026-06-30-frozen-vs-decoupled-comparability.md` lines 18-20, 41-53; `2026-06-18-pillar-a-report-claims-and-caveats.md` lines 37-42, 116-122. | Keep and define the correction family and bootstrap unit. |
| C15 | Context-aware shrinkage improves short-history pace prediction. | paper.tex:35, 53, 162-178, 217 | Confirmed with exact-number check needed | `2026-06-30-frozen-vs-decoupled-comparability.md` lines 55-71; `2026-06-18-pillar-a-report-claims-and-caveats.md` lines 60-95, 123-131. | Keep, but tie the table values to result JSON or replace with Holm-win counts if exact deltas cannot be traced quickly. |
| C16 | Retrospective recovery is a null while prospective prediction improves. | paper.tex:162, 217 | Confirmed with wording change | `2026-06-18-pillar-a-report-claims-and-caveats.md` lines 12-24, 60-95; `2026-06-30-frozen-vs-decoupled-comparability.md` lines 62-71. | Keep, but define both metrics and replace "honest null" with neutral technical wording. |
| C17 | The schedule-generation DP allocator reduces deadline drift. | paper.tex:151, 208, 217 | Confirmed as retired research result | `02-research-to-app-mapping.md` lines 31-38, 83, 135, 159-163; `03-research-to-literature-mapping.md` line 62. | Keep as an evaluated result for the retired packed-slot formulation, and state that it is not a live product gap. |
| C18 | Capacity-based booking is the current product representation. | paper.tex:35, 54, 83, 85, 101, 151, 208, 217 | Confirmed | `01-app-architecture-and-data-flow.md` lines 153-181, 411-431; `02-research-to-app-mapping.md` lines 31-38, 83, 135. | Keep and make the data-model change concrete. |
| C19 | Capacity-based booking regenerates the schedule when the learner accepts a change. | paper.tex:35, 54, 217 | Needs narrower wording | `01-app-architecture-and-data-flow.md` lines 168-172 and 424-430. | Say the app rebooks blank capacity blocks through `generateBookings`; avoid implying the retired DP optimizer is used. |
| C20 | The app is deployed. | paper.tex:35, 56, 72, 217 | Needs evidence or weakening | Current research notes prove implementation architecture, not public deployment status. | Replace with "implemented local-first web application" unless deployment evidence is supplied. |
| C21 | The app realizes all selected models end to end. | paper.tex:35, 56, 217 | Should be reframed | `02-research-to-app-mapping.md` lines 56-73, 129-137; `03-research-to-literature-mapping.md` lines 121-136. | Say the app realizes selected production components and serves as implementation context; unpromoted research findings remain future work. |
| C22 | The architecture split is server-side fitting and client-side derivation from local events. | paper.tex:81-83 | Confirmed | `01-app-architecture-and-data-flow.md` lines 28-38, 211-235. | Keep and use this as the System Architecture anchor. |
| C23 | Supabase provides auth, event synchronization, and snapshot storage. | paper.tex:83 | Confirmed with caveat | `01-app-architecture-and-data-flow.md` lines 378-380 and 4.2 section around sync behavior; line 552 flags session-runtime sync gaps. | Keep, but avoid implying every event kind is currently synced. |
| C24 | Session-runtime events are fully cloud-synced. | Implied by paper.tex:83 | Should be weakened | `01-app-architecture-and-data-flow.md` lines 43-46, 548-552. | Add limitation if the architecture section mentions event synchronization broadly. |
| C25 | The system adapts to verified learning or mastery. | Implied by Phase-II wording | Confirmed as future work only | `02-research-to-app-mapping.md` lines 88-118; `03-research-to-literature-mapping.md` lines 75-98, 132-136. | Add limitation: logged time is not equivalent to mastery. |
| C26 | Phase II will add verified mastery feedback. | paper.tex:83, 219 | Confirmed as future work | `02-research-to-app-mapping.md` lines 88-118 and 136-137. | Keep as future work; do not imply current product measures learning outcomes. |
| C27 | The related-work citations support the exact claims made. | paper.tex:62-70, 222-231 | Needs external verification | `03-research-to-literature-mapping.md` lines 18-73 maps internal citation trails, but the current paper bibliography is shorter and incomplete. | Run a separate reference audit before final rewrite. |
| C28 | The bibliography is IEEE-complete and consistent. | paper.tex:221-232 | Needs revision | The current entries use vague author fields such as "Chen, et al." and omit many DOI, venue, volume, page, or arXiv details. | Run the reference audit and reformat after deciding final citation set. |
| C29 | The discussion uses neutral technical reporting. | paper.tex:162, 182, 208, 212, 217 | Needs rewrite | Checklist flags "genuine win", "honest null", "robust null", and "clearest finding" as rhetorical. | Replace with precise technical statements tied to metrics. |
| C30 | The abstract and conclusion avoid repeating the same method chain. | paper.tex:35, 217 | Needs rewrite | Checklist Priority 1.1 and 4.8. | Rewrite after the evidence corrections are applied. |

## Rewrite Implications

The revised paper should lead with the research evaluation, not with a claim that every winning variant is deployed.

The app should be framed as an implemented local-first study-planning prototype that currently realizes selected production components.

The paper can still report split-conformal correction strongly, but only as an evaluated research result and a future app-promotion item.

The paper can still report tuned dual-arm CUSUM as the research direction, but the current app should be described as using simpler single-arm CUSUM.

The scheduling section should become a design lesson: a stronger optimizer won on the retired packed-slot problem, then the product changed the representation so that problem no longer existed.

## Next Evidence Tasks

- Completed: exact compact tables were extracted into `paper_results_extract.md` by `extract_paper_results.py`.
- Completed: OULAD generator details from the manifests were added to the revised paper's Offline Evaluation Dataset subsection.
- Completed: the pace-calibration ablation-style table was added from the decoupled `context_pred_winner_per_band` means.
- Verify the 10 current bibliography entries against external sources before using them as support.
- If the word "deployed" is reintroduced, confirm the exact deployment status first.
- Decide whether the journal paper should include Pillar B at all or stay focused on Pillar A adaptive planning.
