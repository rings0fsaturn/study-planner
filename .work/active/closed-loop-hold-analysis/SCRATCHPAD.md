# Scratchpad - closed-loop-hold-analysis · session 2026-10-19 (Phase 1)
_state.md: .work/active/closed-loop-hold-analysis/state.md · Updated: 2026-10-19_

## Now / Next
- Doing: session close - runtime shutdown + journal finalize (Phase 1 complete, uncommitted)
- Next: user decision on commit; Phase 2 (days_span + dip-timed posture) not started
- Blocked: none

## Session log
- 2026-10-19 START: resumed task per user instruction (Phase 1 of closed-loop-hold-fix PLAN; no Phase 0 exists). Read state/PLAN/LEDGER/SCRATCHPAD + rules; confirmed N1/N2 sign-off via user selection. Prior analysis session distilled into state.md; scratchpad reset.
- 2026-10-19 PREREQS green: APPROVE_AT at questions.py:15 with uses :96/:374; 26 loop-decision log lines; test_loop_decision.py 12/12.
- 2026-10-19 FOUND probe rids absent from intelligence.log (direct-client probes never hit the service) -> Phase 1 probes run through the real endpoint so the rule-17 join is real.
- 2026-10-19 DONE runtime: ./full-app start full (intelligence :8000, app :5173); sidecar + piston demand-stopped after (rule 54). Health ok.
- 2026-10-19 DONE rule-80 dry-run PASS: endpoint POST /v1/loop/decision as synth-steady, rid hold-probe-dryrun-thin-9000a129, 200, choice hold 0.66 / suff 0.24 -> hold; join verified (jev decide -> jev ok -> loop decision -> request). ~1149 in-tokens, 1 JEV call used.
- 2026-10-19 DONE confirmation probes 1/5 (rids hold-probe-B/B2/E/F/F2-*): B 0.85 SR, B2 0.94 SR, E 0.91 R, F 0.37 SR, F2 0.64 hold/noise. All 200, rids echoed + logged.
- 2026-10-19 SWEEP v1 (N=16): gates 0.5-0.8 tie at 0.813 (0.9 -> 0.625), strictest = 0.8; floor 0.5 re-confirms (1.0, band 0.4-0.6; H1 keeps 0.5).
- 2026-10-19 TDD RED (4 failing: live dip 0.82/0.83 hold; missing LOOP_APPROVE_AT) -> GREEN 17/17: LOOP_APPROVE_AT = 0.8, route_loop_action uses it, suitability APPROVE_AT untouched.
- 2026-10-19 FOUND live confirmation falsified 0.8: post-restart B-dip sample 0.79 (rid hold-probe-B-dip-e53fff34) routed hold at gate 0.8 -> 0.8 sits inside the real-dip variance band.
- 2026-10-19 DONE B-dip stability repeats (3 calls, rids 04d7bfde/ba44e9c9/00db0e73): 0.82/0.83/0.80; full B sample set 0.79-0.85. Probe budget now 10 confirmation calls + 1 dry-run (cap reached, no more without asking).
- 2026-10-19 SWEEP v2 (N=20): gates 0.5-0.7 tie at 0.850 (0.8 -> 0.800, 0.9 -> 0.500), strictest = 0.7. DECIDED LOOP_APPROVE_AT = 0.7 (clears observed dip minimum by 0.09).
- 2026-10-19 EDIT questions.py (LOOP_APPROVE_AT 0.7 + evidence comment, route_loop_action) + test_loop_decision.py (dip pins 0.79/0.82/0.85, boundary, suitability isolation) -> verified: 17/17 pytest, ruff check + format clean.
- 2026-10-19 DONE live E2E at gate 0.7: restart intelligence, B-dip probe rid hold-probe-B-dip-4c4e27f1 -> choice suggest_replan 0.83/0.72 -> verdict suggest_replan; 4-line join verified.
- 2026-10-19 CORRECTED evidence arithmetic: the final 0.83 sample joins the sweep case set -> N=21, gates 0.5-0.7 = 0.857, 0.8 = 0.810, 0.9 = 0.476; comment + Notes updated to match.
- 2026-10-19 REVIEW (OCR delegate preview/rule + code-reviewer subagent, both files, reviewer re-ran the sweep): APPROVE-WITH-FIXES, 3 low, no higher. Applied: 0.9-gate claim corrected (keeps 10/21, discards B-dip 0.79-0.85), test BUG-pin comment narrowed, brittle `LOOP_APPROVE_AT < APPROVE_AT` assert dropped. Post-fix: loop 17/17, loop+jev 35/35, ruff clean.
- 2026-10-19 DONE Phase 1 COMPLETE (uncommitted per AGENTS.md): PLAN Status + Notes, state.md, STATUS.md row updated; runtime stopped; probe scripts kept in /tmp/opencode (print no secrets).

