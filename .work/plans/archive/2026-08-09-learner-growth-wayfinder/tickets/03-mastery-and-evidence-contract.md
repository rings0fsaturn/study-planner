## Question

What does "mastery" mean for achievements, and what evidence backs each one? Decide:

- The authoritative mastery source: the Phase 2 mastery projection (`/v1/mastery`, `masteryCache`, `QuestionGraded.perSkill`) once it ships — no parallel model invented here.
- Whether achievement "mastery" uses the same threshold or an achievement-specific interpretation.
- Which concrete evidence each achievement shows (materials completed, sessions logged, assessment scores, mastery level, dates).
- How cold-start / uncertain mastery is represented (neutral, not-yet, in-progress).
- Scoping: roadmap-specific, material-specific, skill-specific, or global achievements.

## Context

Phase 2 (map #4) resolved that mastery is a derived projection from graded attempts ("Grading → mastery signal mapping"; estimator bake-off tracked in its #18). This ticket defines the achievement-side contract and must remain compatible with it. It gates what the shareable-evidence model can promise.

---
Part of the Learner Growth map #__MAP__ · type: grilling (decision)

Blocked by: __BLOCKED_BY__
