# study-planner-web — STATUS
_Last reconciled: 2026-09-03_

Read first. One line per task — follow Detail for everything else. No stale line survives an edit.

Tags: `[APP]` product web app · `[RESEARCH]` research tier · `[KT]` knowledge-tracing · `[PILLAR-A]` calibration/change-detection rigour · `[DISSERTATION]` M.Tech deliverables · `[INFRA]` repo infra. Code is ground truth — fix the row, don't paper over it.

## Active
| Tag | Task | Where it stands (one line) | Detail |
|---|---|---|---|
| [APP][RESEARCH][KT] | phase2-wayfinder | Phase 2 umbrella (map #4); Wave 0 done, execution on the #33–#49 spine; frontier #35/#12/#50; #34 resolved (split-pane), #39 done (taking+grading live). | active/phase2-wayfinder/state.md |
| [APP][RESEARCH][KT] | issue-34-assessment-review-prototype | Done 2026-09-03: #34 prototype P1–P4 implemented + verified; HITL chose split-pane (B); recommendation recorded, #34 closed, map #4 appended; #40 next. | archive/issue-34-assessment-review-prototype/state.md |

## Queued
| Tag | Task | Note (one line) | Detail |
|---|---|---|---|
| [APP][RESEARCH] | retrieval-followups-2nd-corpus | Second corpus to confirm retrieval levers generalize (rerank wiring itself is DONE). | specs/issues/ |
| [APP][RESEARCH] | full-book-pdf-e2e-sidecar | Full-book PDF E2E through the Qwen3 sidecar — scheduled when the Gemini re-run closed as superseded. | specs/issues/ |
| [APP] | learner-growth-wayfinder | Charted 2026-08-09; frontier #24 (scope/release) with blocked #25–#31, all OPEN. | https://github.com/rings0fsaturn/study-planner/issues/23 |
| [PILLAR-A] | a6-phase6-detection | Change-detection decision ON HOLD (2026-08-23); detection stays a documented robust NULL. | plans/archive/2026-06-18-pillar-a-custom-calibration-detection/ |
| [RESEARCH] | phase5-phase6-report | Phase 5 N=1 real-data validation + Phase 6 report wiring. | ../college/scope/research-tasklist.md |
| [APP] | roadmap-calendar-followups | issue 018 mobile swipe vertical-intent guard (low-sev); issue 010 `/replan` UI (gated on OQ-03 deploy). | specs/issues/018-roadmap-calendar-mobile-swipe-vertical-guard.md |
| [APP] | pwa-plausible-week-narrative | PWA install (013, absent) · Plausible analytics (017, absent) · Week streaming narrative (011). | specs/issues/ |
| [APP][INFRA] | deferred-oqs | OQ-01 projection wiring (burn-up/ETA); OQ-03 Intelligence deploy + auth + CORS. | master-tracker-detail.md |
| [DISSERTATION] | review-2-3-phase2 | Review 2 (assemble) → Review 3 (full comparison + demo + journal draft) → Phase II closed-loop demo. | ../college/mydeliverables/ |

## Done
| Tag | Task | Durable record |
|---|---|---|
| [APP][RESEARCH][KT] | issue-39-assessment-taking-objective-grading | Implemented + live-verified 2026-09-09: P1–P6 (contracts 15/15, grader 9/9, worker 7/7, routes 48/48, data layer 14/14, P5 UI 25/25; live: 025 pushed, 026 material_id RPC fix, submit 201 → graded, browser 2/2 + AC4 walk Score 1.00 redaction CLEAN); AC1–AC4 met; #39 closed, map #4 line recorded. | archive/issue-39-assessment-taking-objective-grading/state.md |
| [APP][RESEARCH][KT] | issue-38-grounded-objective-assessment | Implemented + live-verified 2026-08-23: single grounded objective assessment (P0–P7 + hardening `1149649`, AC1–AC4 met, service 391/7 golden, app 699/699, contracts 12/12); wrapped + archived 2026-08-31. | archive/issue-38-grounded-objective-assessment/state.md |
| [RESEARCH] | wayfinder-#53-generation-runtime | Resolved + closed 2026-08-22: objective gen runs DeepSeek V4 Flash via OpenRouter, reasoning off, temp 0.3, 30 s timeout, provider-neutral GENERATION_* knobs. | https://github.com/rings0fsaturn/study-planner/issues/53 |
| [RESEARCH] | wayfinder-#54-contract-amendment | Resolved + closed 2026-08-22: neutralize the Gemini pack behind an OpenAI-style envelope; file edits landed in #57 (now done). | https://github.com/rings0fsaturn/study-planner/issues/54 |
| [RESEARCH] | wayfinder-#55-deepseek-mechanics | Resolved + closed 2026-08-22 from official sources. | ../research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md |
| [RESEARCH] | wayfinder-#56-gen-quality-probe | Resolved + closed 2026-08-22: 395-call offline probe; reasoning tiers breach budget → reasoning off; cost ~$0.17. | ../research/doc/deepseek-generation-probe/ |
| [INFRA] | wayfinder-#52-openrouter-access | Closed 2026-08-22. | handovers/2026-08-22-deepseek-provider-switch-handoff.md |
| [APP][INFRA][RESEARCH] | productionize-worker-embedder | Implemented + live-verified 2026-08-21: docker-compose worker/intelligence, EMBEDDING_PROVIDER=qwen-sidecar, hybrid retrieval → MRR 0.703. | plans/archive/2026-08-20-productionize-worker-and-query-embedder/ |
| [APP][RESEARCH][KT] | issue-37-material-ingestion | Implemented + live-verified 2026-08-14: migrations 005–013, atomic RPCs, real bugs fixed; service 186(+5), contracts 6/6, app 668/668. | plans/archive/2026-08-14-material-ingestion-readiness/ |
| [APP][RESEARCH] | dockerize-embed | Implemented + verified 2026-08-16: services/embedder parity gate passed at 4,297 chunks/min on RX 9070 XT; EMBEDDING_PROVIDER=gemini\|sidecar. | plans/archive/2026-08-16-dockerize-embed/ |
| [APP][RESEARCH] | sidecar-embed-live-e2e | Implemented + live-verified 2026-08-17: batch sweep → 128 + HTTP 16 = 4,381 chunks/min; canonical 572-page PDF ready (754 chunks, 0 NULL). | plans/archive/2026-08-17-sidecar-embed-live-e2e/ |
| [APP][RESEARCH] | corpus-restore | Implemented + live-verified 2026-08-19: wipe-then-re-ingest the frozen 572p corpus at stable ID; 754-chunk baseline accepted as new durable baseline. | plans/archive/2026-08-19-corpus-restore/ |
| [APP][RESEARCH] | retrieval-quality-program | Implemented + verified 2026-08-15: hybrid BM25+dense +7 r@3; Qwen3-Reranker +4 r@1/+7 r@3; final r@1 0.77, r@3 0.97, MRR 0.858. | plans/archive/2026-08-15-retrieval-quality-program/ |
| [APP][RESEARCH] | ingestion-performance-baseline | Closed 2026-08-23 as superseded (sidecar path verifies parity); telemetry contract (migration 014), C8 throttle, C2 resume, C3 overlap 60→30. | plans/archive/2026-08-14-ingestion-performance-baseline/ |
| [APP][INFRA] | docker-full-app-public-registry | Implemented + live-verified 2026-08-09: docker-compose web + intelligence; public npm default; ./docker-app. | plans/archive/2026-08-09-docker-full-app-and-public-registry-migration/ |
| [APP][INFRA] | docker-lifecycle-launcher | Implemented 2026-08-09: root ./docker-app launcher; rule 51 rewritten. | plans/archive/2026-08-09-docker-lifecycle-launcher-and-docs/ |
| [APP][INFRA] | full-app-start-blockers | Fixed 2026-08-08: CRLF shebangs (eol=lf), JWT-secret gate relaxed, intelligence venv, node_modules reinstall. | plans/archive/2026-08-08-full-app-start-blockers/ |
| [APP][INFRA] | recover-wf17-prototype | Fixed 2026-08-08: toolchain/deps/tsc fault layers cleared; Phase 3 variant loop handed to #12. | plans/archive/2026-08-08-prototype-wf17-build-test-fix/ |
| [APP][RESEARCH][KT] | issue-36-material-library | Implemented + live-verified 2026-08-13: migration 004, MaterialClient, MaterialsProvider, library/detail/create; 49 focused tests, suite 612/612; #36 closed. | plans/archive/2026-08-13-material-library-implementation/ |
| [APP][RESEARCH][KT] | material-library-ux | Resolved 2026-08-11 / refined 2026-08-13: Q1–Q22 interaction decisions locked; throwaway prototype retained. | plans/archive/2026-08-13-material-library-ux-refinement/ |
| [APP] | progress-lab-pace-indicators | Implemented + self-verified 2026-07-19; independent reviewer waived 2026-08-23. | plans/archive/2026-07-19-progress-lab-pace-indicators/ |
| [APP] | finish-date-projection-inconsistency | Diagnosis captured 2026-07-18; implementation never started; reopen only with a fresh diagnosis. | plans/archive/2026-07-18-projection-inconsistency/ |
| [APP] | week-progress-lab | Implemented + verified 2026-07-18: burn-up modal workspace, range presets, shared capacity model, exact finish parity. | plans/archive/2026-07-18-week-progress-lab/ |
| [APP] | demo-seed-no-slot-model | Verified 2026-07-05: no-slot roadmaps, terminal events, local-calendar-day model. | plans/archive/2026-07-04-demo-seed-new-model/ |
| [APP] | roadmap-calendar | All 7 phases Cowork-verified 2026-06-26. | plans/archive/2026-06-26-roadmap-calendar/ |
| [APP] | roadmaps-dashboard | Phases 1–7 implemented 2026-06-26; Phase 7 verdict waived 2026-08-23. | plans/archive/2026-06-26-roadmaps-dashboard/ |
| [APP] | roadmaps-dashboard-fixes | Phases A/B/D implemented 2026-06-27; reviewer verdicts waived 2026-08-23. | plans/archive/2026-06-27-roadmaps-dashboard-fixes/ |
| [APP] | material-session-ui-bugs | Phases 1–8 (verdicts waived 2026-08-23); Phase 9 (suggested upcoming sessions) parked open, not abandoned. | plans/archive/2026-07-02-material-session-ui-bugs/ |
| [APP][RESEARCH] | material-session-decoupling | All 7 phases Cowork-verified 2026-07-02: retires prescriptive dated-slot packer; capacity-aware live replan. | plans/archive/2026-06-30-material-session-decoupling/ |
| [DISSERTATION] | 3rd-review-report | Done 2026-07-03: full app trace cross-referenced; findings filed as issues 019–022. | plans/archive/2026-07-03-third-review-report-work/ |
| [APP][RESEARCH][KT] | phase2-charted-and-decisions | Charted 2026-07-31; #5–#22 resolved/closed 2026-08-13; folded into the Active phase2-wayfinder row. | active/phase2-wayfinder/state.md |
| [APP] | enriched-shrink-prod | Cowork-verified 2026-06-20: enriched_shrink shipped server-side; net win with small-band caveat (claims ledger). | plans/archive/2026-06-20-enriched-shrink-production-integration/ |
| [INFRA] | agent-rules-skills-refresh | Added work-journal skill mirrors + typed-error rule + architecture PNG (`944ce56`). | ../.agents/skills/work-journal/SKILL.md |
| [APP] | dev-production-readiness | All 5 phases Cowork-verified 2026-06-25: auth on all /v1, resilient calibration client, Dexie stale cache, one-command dev. | plans/archive/2026-06-20-dev-production-readiness/ |
| [APP] | web-app-v1-core | Slices 1a–12, 14–16 shipped (auth, session log, sync/restore, onboarding, sessions, URL/YouTube, ProgressEngine, replan, Google OAuth, settings, marketing, reset). | specs/issues/ |
| [PILLAR-A] | pillar-a-rigour-a0-a5 | A0–A5 verified (`e1c6455`…`68f4a12`); pace calibration was an honest null under rigour. | plans/archive/2026-06-14-pillar-a-rigour.md |
| [PILLAR-A] | a6-calibration | enriched_shrink overturns the null; archetype layer not recommended; Phase 6 detection deferred (→ Queued). | plans/archive/2026-06-18-pillar-a-custom-calibration-detection/ |
| [PILLAR-A] | change-detection-null | Probe → robust NULL (no candidate dominates the CUSUM/CSD frontier). | ../research/doc/2026-06-20-change-detection-literature-survey.md |
| [RESEARCH] | research-tier-phases | Phases 0–4, 7 done. | ../college/scope/research-tasklist.md |
| [KT] | kt-bench-phase4 | Credibility-gated: 9 pyKT cells reportable (5 NIPS2020 + 4 ACcoding). | ../research/doc/2026-06-14-kt-credibility-tracker.md |
| [DISSERTATION] | 2nd-review-bundle | Done 2026-06-27: 7-slide deck + presenter note + runnable zip. | handovers/2026-06-27-2nd-review-deck-and-submission.md |
| [DISSERTATION] | phase-1-delivered | 1st Review report/deck; 1st & 2nd Guidance calls done. | ../college/mydeliverables/ |

## Reference
- **Full workstream detail:** [`master-tracker-detail.md`](master-tracker-detail.md) · **Folder map:** [`README.md`](README.md)
- **PRD:** [`specs/prd/PRD-study-tracker-web.md`](specs/prd/PRD-study-tracker-web.md) · **Issues:** [`specs/issues/README.md`](specs/issues/README.md)
- **Research KB:** [`../research/doc/`](../research/doc/) · **Tasklist:** [`../college/scope/research-tasklist.md`](../college/scope/research-tasklist.md)
- **Pillar-A claims ledger:** [`../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`](../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md)
- **Dissertation:** [`../college/mydeliverables/`](../college/mydeliverables/) · **Deploy:** [`../DEPLOYMENT.md`](../DEPLOYMENT.md)
- **Contracts & rules:** [`.agents/rules/`](../.agents/rules/) · **Working-memory skills:** [`.agents/skills/work-journal-orchestrator/`](../.agents/skills/work-journal-orchestrator/)

## Gotchas (active only)
- **pnpm builds against the public npm registry by default:** hosts that block `registry.npmjs.org` pass `COREPACK_NPM_REGISTRY` as an operator override ([`../.agents/rules/50-pnpm-build-registry.agents.md`](../.agents/rules/50-pnpm-build-registry.agents.md)).
- **LaTeX** builds via TinyTeX on PATH ([`../.agents/rules/60-latex-report-build.agents.md`](../.agents/rules/60-latex-report-build.agents.md)).
- **Dexie schema changes must version-up** ([`../.agents/rules/31-dexie-schema-migrations.agents.md`](../.agents/rules/31-dexie-schema-migrations.agents.md)).
- **React Router** `basename="/study"` — never include `/study` in `to` ([`../.agents/rules/12-react-router-basename.agents.md`](../.agents/rules/12-react-router-basename.agents.md)).
- **A6 stop-gate:** referenced in `../research/doc/2026-06-20-change-detection-literature-survey.md` but no gate code found in `research/scripts/` (checked 2026-08-23) — confirm before any Phase 6 dataset change.
- **WSL dev runtime (rule 53):** Vite does not reliably watch `/mnt/d` — restart the managed runtime after edits; env vars load at process start (restart to apply); bare `node` may be missing (use `corepack pnpm` or a Linux Node on PATH).
- **WSL vitest threads pool** ignores mid-run `process.env.TZ` — run TZ-sensitive tests with `--pool=forks` (2 tests in `apps/app/src/dev/seedTestData.test.ts`).
- **`pnpm install` EACCES-prunes on Windows** can leave dangling `.pnpm` dirs — wipe root + per-workspace `node_modules` and reinstall to recover.
- **Node ≥25 experimental webstorage** shadows jsdom's `localStorage` in vitest — guard in `apps/app/src/test/setup.ts` installs an in-memory `Storage`.
- **Live E2E specs** need env-gated credentials (`E2E_LIVE_EMAIL`/`E2E_LIVE_PASSWORD`) + the managed runtime; live runs mutate the shared dev account ([`../.agents/rules/16-live-e2e-authoring.agents.md`](../.agents/rules/16-live-e2e-authoring.agents.md)).