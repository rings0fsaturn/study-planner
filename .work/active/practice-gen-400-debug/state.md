# State – practice-gen-400-debug
_Spec: .work/specs/issues/phase2-assessments-practice.md · Plan: active/practice-gen-400-debug/plan/ · STATUS row: practice-gen-400-debug · Status: active · Updated: 2026-10-07_

## Current state & next
- All 5 plan phases done 2026-10-07: orient, generate retry (`de09507`), stream parity plus observability (`8d0fdf9`), honest learner copy (`0306bda`), strict contract plus live dry run (`5be9a54`, VERIFICATION.md recorded).
- Next: wrap decision (archive task) or follow-up ticket for the residual retry-then-terminal-400 park-in-generating.

## Done so far
- 2026-10-07: opened task folder + STATUS row; read STATUS, README, rules 10/17/22/42.
- 2026-10-07: traced UI (`PracticeRun.tsx:526`) through worker (`worker.py:763-794`) to adapter (`openrouter_client.py:158-178,333-345,365-367`).
- 2026-10-07: matched live row `7084b42a` (same material `be7e88a0`, coding, 300-char warning) and CSAPP stats (2065 chunks, ~1900 tokens).
- 2026-10-07: live dry-run reproduction (w3 try0 400 / try1 ok; raw provider `Sail Research`); wrote findings doc.
- 2026-10-07: Phases 0-3 executed (adapter one-retry-400, stream parity, honest warning); each gated by dual review PASS plus commit.
- 2026-10-07: Phase 4 done - strict contract test (`test_generation_schema_contract.py`, coding oneOf as known exception), focused suites 203 plus 62 green, rule-80 live probe 3 calls (ok, retry-then-terminal-400, ok on identical bytes) recorded in `plan/VERIFICATION.md`; dual re-review PASS after one FAIL round (5 findings fixed).

## Flow trace
1. Practice banner renders `warnings[].message` - `apps/app/src/pages/practice/PracticeRun.tsx:526`.
2. Worker provider-error branch fails job, keeps assessment `generating` with warning, acks queue - `services/intelligence/app/generation/worker.py:763-794`.
3. Adapter retries only 429/5xx/timeout/connection; 400 goes to `provider_error` non-retryable - `services/intelligence/app/generation/openrouter_client.py:158-178,333-345`.
4. Message truncation hides provider - `openrouter_client.py:365-367` (`[:300]`).
5. Context builder pages at 1000 and code-seeks 5 picks - `services/intelligence/app/generation/context.py:44,196-212`.

## Files affected
- `.work/active/practice-gen-400-debug/research/400-debug-findings.md` - diagnosis evidence, recreation, fix proposal.
- `.work/active/practice-gen-400-debug/plan/PLAN.md` - sequential fix plan with review plus commit gates.

## Pitfalls & rules
- Must follow rules 10 (managed runtime), 17 (request-id logging), 22 (typed errors), 42 (one family per call, failed is terminal).
- Hypotheses proved with executed code, not assumptions; live probe kept to 1-3 calls per rule 80.
- No production edit made: `repair-validation-resilience` holds uncommitted changes; fix needs user approval.

## Decisions in force
- Decided to propose (not yet apply) bounded one-retry-400 + provider_name logging because the transient was proved retryable (2026-10-07).

## Open
- Task wrap (archive) or follow-up ticket for residual retry-then-terminal-400 park-in-generating.
- Latent `oneOf` strict risk for the coding arm now guarded by the contract test (passes today, fails loudly on shape drift).
