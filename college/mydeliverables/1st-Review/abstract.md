# Abstract — First Review (Phase I)

**Project:** Adaptive Study Planning for Self-Directed Learners
**Candidate:** Rohit Saji · M.Tech Data Science & AI, PES University (Great Learning)

---

## Abstract (draft)

Self-directed learners routinely build fixed study plans that diverge from reality
within days — they fall behind or move ahead — yet the plan never adapts, and learners
have no reliable signal of how far off-track they are or whether they are genuinely
learning. This work proposes an adaptive study-planning system that learns a learner's
true pace, detects when their behaviour shifts, projects their completion date with
calibrated uncertainty, and regenerates their schedule accordingly. The system is
organised around two interlocking research pillars. The first, **closed-loop
adaptation**, combines hierarchical Bayesian pace calibration, CUSUM change-point
detection, and Gaussian-process progress projection with constraint-based schedule
generation. The second, **assessment-based verification**, generates concept-tagged
assessment items from the learner's own study material using large language models and
applies cold-start knowledge tracing to estimate genuine concept mastery — providing an
honest learning signal that guards against unreliable self-reported study data and feeds
verified estimates back into calibration. Candidate algorithms for each component are
compared offline against established baselines on a literature-grounded synthetic dataset
with known ground truth and on public knowledge-tracing benchmarks, using detection
latency, interval calibration, AUC, and schedule-adherence metrics. Phase I delivers and
evaluates the open-loop system; Phase II closes the loop and introduces assessment-based
verification as the principal novelty, evaluated by comparing closed-loop adaptive
planning against a static open-loop baseline on schedule adherence and measured learning
gain. The expected contribution is a verified closed-loop study-planning system that
integrates learner calibration, behavioural-shift detection, uncertainty-aware
projection, and assessment-grounded verification for self-directed learners.

---

*~250 words. Draft for Review 1. Notes:*
- *Written in "proposes/expected" voice — works whether framed as proposed or in-progress, and is now substantially honest (assessment subsystem + research pipeline genuinely unbuilt).*
- *Title kept short for continuity with zeroth/guidance decks; a fuller subtitle reflecting both pillars is an option if you want the verification pillar visible in the title.*
