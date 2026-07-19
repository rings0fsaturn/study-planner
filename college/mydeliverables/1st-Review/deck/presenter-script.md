# Presenter Script — Review 1 Deck
**Adaptive Study Planning for Self-Directed Learners**
Rohit Saji · PES2PGE24DS201 · Phase I First Review · 7 June 2026

---

> **How to use this document**
> - **Script** — read this aloud. ~130–150 words per slide, ~100 seconds each. Total talk time ≈ 20 min.
> - **Key Terms** — study these before the review; use them if a reviewer asks "what do you mean by X?"
> - **Likely Q&A** — rehearse these answers so they come out naturally, not from a script.
> - PPTX speaker notes contain a 2–3 sentence cue per slide for use in Presenter View on stage.

---

## Slide 1 — Title
**Target duration:** ~45 seconds

### Script

Good morning, Professor — and welcome to the panel if there are additional members joining us. I am Rohit Saji, registration number PES2PGE24DS201, working on my M.Tech in Data Science and Artificial Intelligence at PES University.

This is the Phase I First Review for my project: Adaptive Study Planning for Self-Directed Learners.

Over the next 20 minutes, I will take you through the two-pillar design of this system, the algorithms behind each pillar, the literature that grounds the work, how we plan to evaluate it, and where we stand today at the 30% milestone.

There will be space for questions as we go through each slide. Let us begin.

### Key Terms

*(No technical terms on this slide.)*

### Likely Q&A

**Q: Can you describe the project in one sentence?**
**A:** We are building a system that automatically adjusts a learner's study schedule based on how they are actually studying — and verifies that the time they logged produced real learning, not just hours sitting at a desk.

---

## Slide 2 — The Vision
**Target duration:** ~1.5 min

### Script

The problem we are solving is one most of us have lived through. You sit down and build a study plan — "I will finish this course in eight weeks" — and within days, life happens. You fall behind one week, then surge ahead another. The plan stays fixed. It never adapts. Existing tools either just track time, or give you a one-time schedule that becomes stale the moment reality diverges from it.

There is a deeper problem underneath this. When a learner logs "I studied for two hours today," there is no way to verify whether that time produced real learning or was spent distracted at a screen. Self-reported study time has no ground truth. It is taken on faith.

Our vision is to close both gaps with one system. It learns each learner's true pace from sessions that are verified through assessment. It detects when study habits shift. It projects completion not as a single date but as a confidence range — "you will finish between Week 8 and Week 11." And it automatically regenerates a new, realistic schedule when the projection changes.

This is what we mean by a verified, closed-loop adaptive planner.

### Key Terms

- **Closed-loop:** A system where the output — how well you actually studied — feeds back in to change the next input — your schedule. Like a thermostat: the room temperature is measured and used to adjust the heating. Without the feedback, it is open-loop.
- **Ground truth:** The actual correct answer you can measure against. Here, it means a real, verifiable signal that learning happened — not just a self-reported log.
- **Calibrated uncertainty:** A confidence interval that is honest about what it does not know. "95% confidence interval" means the true answer falls inside the range 95% of the time — neither overconfident nor underconfident.

### Likely Q&A

**Q: What do you mean by "verified"?**
**A:** Verified means the system does not just take the learner's word for it. After a study session, it generates a short assessment — questions grounded in the specific material the learner just covered. If the learner passes, the session is counted as genuine learning. If not, the system knows something did not land and adjusts the pace estimate accordingly.

**Q: Does every learner get the same plan?**
**A:** No — the plan is personalised to each learner's pace, study days, available hours, and material. The system learns from that individual learner's session history, not from a population average.

---

## Slide 3 — Since the Guidance Call
**Target duration:** ~2 min

### Script

Professor, I want to begin this slide by acknowledging exactly where this design came from.

During our first guidance call, you asked a question that stopped me: "How do you stop users from passing false session data?" That one question changed the entire shape of this project.

My original design had a single system — an adaptive planner that adjusts schedules based on logged study time. Your question made me realise something fundamental: if users can log fake sessions, the whole calibration engine is building on sand. Garbage in, garbage out. The schedule adapts — but it adapts to lies.

So I went back and redesigned the project around two interlocking pillars.

Pillar A handles adaptation — learning pace, detecting when habits shift, projecting completion, regenerating schedules. That is the engine.

Pillar B handles verification — it generates assessments from the learner's own material and checks whether genuine learning happened. That is the honest signal that makes the engine trustworthy.

These two pillars are co-equal. Neither works well without the other. The evaluation for Phase II is specifically designed to show what happens when you have verification versus when you do not.

The project became stronger because of your challenge, and I am glad you asked it.

### Key Terms

- **Pillar A — Adaptation:** The part of the system that learns each learner's true study pace, detects when it shifts, projects completion with a confidence band, and regenerates a new schedule. The scheduling engine.
- **Pillar B — Verification:** The part of the system that generates assessments from the learner's material, grades them, and estimates whether the learner has genuinely mastered the concepts studied. The honest-signal layer.
- **Interlocking pillars:** The two systems depend on each other. Pillar A provides the schedule that tells the learner what to study and when. Pillar B checks whether studying actually worked. Pillar B's signal feeds back into Pillar A's calibration.

### Likely Q&A

**Q: Why two pillars instead of one unified system?**
**A:** Because the two problems require fundamentally different techniques. Adapting a schedule is a statistical and optimisation problem — Bayesian inference, change detection, Gaussian processes. Verifying learning is a natural language processing and knowledge-tracing problem — LLM item generation, answer evaluation, mastery estimation. Combining them into one system without a clean boundary would make both harder to research, evaluate, and improve independently.

**Q: Could you not just use an existing quiz platform instead of building Pillar B?**
**A:** Existing quiz platforms are generic — they are not grounded in the specific material a learner is studying right now. Our assessments are generated from the learner's own material, so they are directly relevant and harder to game. More importantly, an external platform does not feed its results back into the schedule. The integration — the fact that Pillar B's mastery signal drives Pillar A's recalibration — is the novelty.

**Q: This seems like a much bigger project now — is it still achievable in the M.Tech timeline?**
**A:** Yes, because the two pillars are delivered in two phases. Phase I researches and builds Pillar A in open-loop mode — the adaptation engine without the feedback. Phase II closes the loop and builds Pillar B. Each phase has a focused, bounded scope. The scope docs are explicit about what is in each review.

---

## Slide 4 — Two-Pillar System Architecture
**Target duration:** ~1.5 min

### Script

This diagram shows the full system. Before I walk through it, notice two things: the colour coding and the line style.

Solid lines and solid boxes are Phase I — what is already built or being researched now. Dashed boxes are Phase II — the novel contributions we will build next. The gold arrows are the closed feedback loop — that is what makes the system adaptive rather than static, and it is deliberately Phase II.

The system has three tiers. At the bottom is the client — a mobile-first web app where the learner logs study sessions, views their roadmap, and eventually takes assessments. This is the part the learner sees and touches.

Above that is the intelligence service — a Python backend that runs all the heavy computation: pace calibration, schedule generation, assessment grading. It serves results to the app on demand.

At the top is the offline research layer — where we train models, compare algorithms, and generate synthetic data. This is where the thesis experiments run.

Supabase — a cloud database — sits in the middle, connecting the app to the intelligence service. OpenAI's language model is called by Pillar B to generate and grade assessment questions.

Phase I builds and evaluates the left column. Phase II closes the gold loop.

### Key Terms

- **Open-loop:** The system computes results but does not yet feed them back to change future behaviour. Like a calculator — it gives you a number, but does not act on it. Phase I is open-loop.
- **Intelligence Service (FastAPI):** A lightweight Python web server that runs the statistical models and returns results — calibrated pace, schedule, mastery estimates — to the app. It is the "brain" that the app calls.
- **Supabase:** A cloud database and authentication service. Think of it as the central filing cabinet that both the app and the intelligence service can read from and write to.
- **Three-tier architecture:** Separating the system into three layers with distinct responsibilities — data capture (client), computation (service), and research (offline) — so each can be developed, tested, and replaced independently.

### Likely Q&A

**Q: Why a separate Python service — why not run the algorithms in the app directly?**
**A:** The research algorithms — Bayesian inference, Gaussian processes, knowledge tracing — are most mature and well-supported in Python libraries. The app is in TypeScript. If we implemented the same algorithms in two languages, they would inevitably drift. The design principle is "evaluated code equals shipped code": the same Python code that produces the thesis results is what the app calls in production.

**Q: What happens if the intelligence service is offline — does the app break?**
**A:** The app is local-first. It stores all raw session data locally in the browser's IndexedDB. Results from the intelligence service — calibrated pace, updated schedule — are cached locally, so the dashboard still works offline. The core session-logging loop never depends on a network connection.

---

## Slide 5 — Pillar A: Algorithms
**Target duration:** ~2 min

### Script

Pillar A has four components that work as a pipeline — the output of each step feeds into the next. Let me walk them left to right.

Step one: Pace Calibration. Every learner studies at a different speed, and that speed changes over time — a stressful week, a holiday, a new topic. We use Hierarchical Bayesian estimation to learn each learner's true pace from their session history. The key advantage over a simple average is that it works even with sparse data. If you have logged only three sessions, the model borrows strength from what we know about learners in general, then narrows to your specific pattern as more data arrives.

Step two: Change Detection. Learner habits shift. A new job, exam pressure, loss of motivation. We use a method called CUSUM to catch these shifts as they happen — not two weeks later when a rolling average finally notices. It is a statistical alarm that fires as soon as a pattern breaks beyond a threshold.

Step three: Progress Projection. Once we know pace and detect shifts, we project when the learner will finish. We use Gaussian Process regression, which gives us not just a single date but a confidence band — "you will finish between Week 8 and Week 11 with 95% probability." That honesty about uncertainty is what makes the projection useful for decisions.

Step four: Schedule Generation. With the updated projection, the system regenerates a new, feasible schedule using constraint-based planning — respecting study days, available hours, and material ordering rules.

Phase I computes calibration but does not yet feed it back into rescheduling. That loop closes in Phase II.

### Key Terms

- **Hierarchical Bayesian:** A statistical method that learns individual parameters — like your pace — by combining your personal data with a population-level prior. Good for sparse, noisy data. "Hierarchical" means it has a group level and an individual level.
- **CUSUM (Cumulative Sum):** A control-chart method from quality engineering. It accumulates deviations from a baseline and raises an alarm when the cumulative sum crosses a threshold. Sensitive to sustained shifts, not single outliers.
- **Gaussian Process (GP):** A flexible statistical model that predicts a full distribution over possible outcomes — not just one number. For our projection, it gives a mean completion date plus a 95% confidence band.
- **Constraint-based scheduling:** Building a schedule by satisfying a set of hard rules: "no more than 2 hours on weekdays," "foundation material before practice material," "meet the deadline." It finds a feasible plan within those constraints.

### Likely Q&A

**Q: Why Gaussian Process for projection — isn't it overkill compared to a simple trend line?**
**A:** The key advantage is the calibrated confidence band. A linear trend gives you one date. A GP gives you a date plus a 95% interval. For a learner deciding whether to register for an exam or request an extension, knowing "I might finish anywhere between Week 8 and Week 12" is far more useful than a single overconfident number. We compare GP against linear extrapolation in Phase I to quantify exactly how much the uncertainty estimation improves.

**Q: Why CUSUM — why not just track a moving average?**
**A:** A moving average is slow. It requires many data points to shift before it reflects a change. CUSUM detects sustained deviations in 2–3 sessions rather than 8–10. It also gives a clean alarm — either a shift has happened or it has not — rather than a gradient you have to interpret. We compare it against EWMA and critical-slowing-down indicators in Phase I to confirm it has the best latency-versus-false-alarm trade-off for this data pattern.

**Q: What does "open-loop" mean in practice for Phase I?**
**A:** It means the calibration number is computed and shown on the dashboard, but it does not yet automatically trigger a schedule regeneration. The learner can see "your pace is 0.7× your plan" but the schedule does not update until Phase II wires the feedback. This is intentional — it lets us validate the calibration in isolation before we trust it to drive decisions.

---

## Slide 6 — Pillar B: Algorithms
**Target duration:** ~1.5 min

### Script

Pillar B is the verification system. The design is fully decided. The build is Phase II.

Here is how it works. When a learner finishes studying a piece of material, the system feeds that material to a language model and asks it to generate a short, targeted assessment — questions that come directly from what the learner just read, not from a generic question bank. The learner takes the test. The system grades it — automatically for coding questions using test cases, and using the language model for theory questions. Then it runs knowledge tracing to estimate how well the learner has actually mastered the underlying concepts.

The learner gets to choose their assessment style. A simple generic quiz, or an exam-realistic format — timed, with sections, marks, and negative marking — that mirrors a real target exam like GATE, GRE, or a university exam paper.

One set of parameters we are still finalising is the specific exam templates: which target exams to model, how many questions per section, what difficulty mix. These are being decided through user research — a Phase I activity — so that the Phase II build is grounded in what learners actually need.

The key insight is this: a timed, material-grounded, exam-patterned test is much harder to game than a self-reported log. That is what makes it a valid verification signal.

### Key Terms

- **Knowledge Tracing (KT):** A technique that estimates how much of a concept a learner has mastered, based on their pattern of correct and incorrect answers over multiple assessments. It tracks mastery over time, not just a single score.
- **Cold-start problem:** The challenge of estimating a learner's mastery when they have answered very few questions. Like predicting a driver's skill after one lesson. Our approach uses concept-level tracing to handle this.
- **Item Generation:** Automatically creating assessment questions (items) from study material using a language model. The items are concept-tagged — each question is labelled with the concept it tests.
- **Spaced Repetition:** A scheduling principle where you review material at increasing intervals — right before you are likely to forget it — to build durable long-term memory. This informs when assessments are placed in the roadmap.

### Likely Q&A

**Q: Why is Pillar B not being built in Phase I?**
**A:** Because we need to finalise the assessment design through user research before building anything. Specifically, which exam patterns learners want, what difficulty mix is realistic, and what pass thresholds are meaningful. Building without that data means building the wrong thing. Phase I gives us a validated design and a prototype; Phase II executes the full build on solid ground.

**Q: What stops the language model from generating wrong or hallucinated questions?**
**A:** Two safeguards. First, every generated item must be concept-tagged and anchored to a specific passage in the learner's material — the model cannot invent facts that are not in the source. Second, we run a grounding check that rejects any item whose answer cannot be verified against the material. LLM cost is managed through batching and caching.

**Q: Why concept-level knowledge tracing instead of item-level?**
**A:** Standard knowledge tracing works with a fixed item bank — the same questions are answered by thousands of learners. We have LLM-generated, often unique items, and only one learner per session. Tracking mastery at the concept level — "does this learner understand gradient descent?" — rather than the item level avoids the cold-start problem and makes the tracing portable across different question wordings.

---

## Slide 7 — Literature Survey
**Target duration:** ~2 min

### Script

We surveyed 48 papers published between 2024 and 2026. From those, 12 are anchor papers — the ones our work most directly builds on or compares against, one from each major technique area across both pillars.

I want to explain the gap, because that is the heart of this project's novelty.

Each technique in our system — Bayesian calibration, Gaussian process projection, CUSUM change detection, LLM item generation, knowledge tracing — already exists in the research literature. We are not inventing new mathematics. What does not exist is any system that combines all of them into a verified closed loop — where the verification signal from Pillar B drives the replanning in Pillar A.

We have one base paper per pillar. For Pillar A: Islam et al. 2024, published at IEEE ICCIT. They built a predict-then-optimize scheduler — they predict how well a student will do using a neural network, then use dynamic programming to build a schedule. Our extension makes that scheduler adaptive rather than one-shot, replaces point predictions with calibrated uncertainty, and operates at session level rather than course level.

For Pillar B: CLST 2024, published on arXiv. They used a language model as a student simulator to handle cold-start in knowledge tracing. Our extension applies this to single-learner, concept-level tracing over LLM-generated items — a scenario their paper never addresses.

The gap, in one sentence: nobody has put these pieces together into a closed loop where the learning signal verifies the planning signal.

### Key Terms

- **Anchor paper:** A paper that is central to our work — either a method we directly use, a baseline we compare against, or a gap we explicitly fill. 12 anchor papers from 48 surveyed.
- **Base paper:** The single most relevant prior work per pillar — the paper our thesis directly extends. Islam 2024 for Pillar A; CLST 2024 for Pillar B.
- **Predict-then-optimize:** A two-step design: first predict an outcome (exam score, completion time), then use that prediction to build an optimal plan. Islam 2024 does this statically; we make it adaptive and continuous.
- **Cold-start in KT:** When a knowledge-tracing model must estimate a new learner's mastery with almost no answer history. CLST 2024 uses an LLM to simulate prior knowledge and warm-start the model.

### Likely Q&A

**Q: What makes your work novel if all the techniques already exist in the literature?**
**A:** The novelty is in the integration and the closed-loop design. Wheels, engines, and steering existed before the car. Our contribution is (1) combining Bayesian calibration, shift detection, uncertainty-aware projection, and adaptive scheduling into a single loop — none of the 48 papers does all four — and (2) using an assessment-verified learning signal to drive that loop. The two base papers each do one half; neither does the other, and neither connects them.

**Q: Why limit the survey to 2024–2026? Are you missing foundational work?**
**A:** The foundational methods — Bayesian inference, CUSUM, Gaussian processes, knowledge tracing — are well-established and cited appropriately. The 48-paper survey focuses on how these techniques have been applied to educational and scheduling problems in the last two years, which is where the current state of the art sits. Older seminal papers are cited where needed but are not the main survey corpus.

**Q: Why Islam 2024 as the Pillar A base paper — there must be other scheduling papers?**
**A:** Islam 2024 is the closest structural match to our architecture — it also does predict-then-optimize for a study schedule, targeting self-directed learners. It gives us a concrete, published, reproducible baseline to beat. Our claim is that adding Bayesian calibration, shift detection, and uncertainty-aware projection measurably improves over their one-shot, static approach. That "extends and improves" relationship is exactly what a base paper should provide.

**Q: What is THE GAP you mention on the slide?**
**A:** No published paper combines: (1) statistical calibration of individual learner pace, (2) behavioural-shift detection, (3) uncertainty-aware progress projection, and (4) adaptive schedule regeneration — into a closed loop where (5) the learning signal that drives the loop is verified by assessment. Each of those five elements exists somewhere in the literature. The combination does not.

---

## Slide 8 — Datasets & Evaluation
**Target duration:** ~1.5 min

### Script

Our evaluation uses four data sources. Let me walk through each.

First: a synthetic data generator — which is itself a research contribution. We generate thousands of labelled sessions across six learner archetypes — the Steady learner, the Morning Lark who is productive early but fades, the Fading Flame who loses motivation mid-course, the Weekend Warrior, the Deadline Sprinter, and the Marathon Runner with a very long horizon. Crucially, we embed known ground truth: we know exactly when a learner's pace shifted, and exactly which sessions were honest versus faked. This precision is impossible with real data.

Second: public knowledge-tracing benchmarks via pyKT, an open-source library. Specifically, Eedi — multiple-choice maths questions from real students — and POJ — a competitive programming dataset. These are standard benchmarks that let us compare against published baselines.

Third: an honest-versus-faker overlay in the synthetic data — sessions deliberately marked as gamed, to test whether Pillar B's verification can detect them.

Fourth: N equals 1 real sessions — my own logged study data, starting now. This is longitudinal validation, not the main evidence. It keeps the evaluation grounded in real, messy behaviour.

The evaluation has three legs: synthetic ground truth for algorithm comparison, public benchmarks for real-data credibility, and closed-loop versus open-loop comparison in Phase II.

### Key Terms

- **Synthetic data generator:** A program that creates realistic fake data with deliberately planted properties — known pace, known shift points, known honest/faker labels. Used when you need ground truth to measure algorithm accuracy.
- **pyKT:** An open-source Python library for knowledge tracing research. It packages multiple public benchmark datasets and pre-implemented baseline models in one place.
- **Eedi / POJ:** Two standard KT benchmarks. Eedi contains real student answers to multiple-choice maths questions. POJ contains code submissions to programming problems, with correctness labels.
- **KT-AUC:** The Area Under the ROC Curve for a knowledge-tracing model — how well it predicts whether a learner will answer the next question correctly. 0.5 = random guessing. The literature on Eedi/POJ reports 0.70–0.82 for competitive models.

### Likely Q&A

**Q: Why use synthetic data instead of real learner data?**
**A:** Real data does not give us ground truth. If a learner's pace shifts in week 3, we do not know that — we can only estimate it from observations. The synthetic generator plants shifts at known locations and known times, so we can measure exactly whether an algorithm detected the shift, how many sessions it took, and how many false alarms it produced. That precision is the core of the comparison methodology.

**Q: Is N=1 real sessions scientifically valid?**
**A:** N=1 is used for longitudinal validation only — not as the basis for our statistical claims. The algorithm comparisons run on thousands of synthetic sessions and standard benchmarks. My own sessions serve as a sanity check: do the algorithms behave sensibly on real, noisy, human data? That is a different question from "do they beat the baselines," and it has a different standard of evidence.

**Q: What are the six archetypes based on — did you make them up?**
**A:** They are grounded in the educational psychology and behavioural science literature on self-directed learner patterns. Each archetype has a parameterised behavioural model — time-of-day preferences, fatigue curves, deadline responsiveness — derived from published research on student learning behaviours. The generator is not arbitrary; it is literature-parameterised.

---

## Slide 9 — Expected Outcomes
**Target duration:** ~2 min

### Script

This slide states what we expect to demonstrate by the end of Phase I. I want to be precise about what these outcomes are and are not.

These are directional hypotheses, not point commitments. We are not claiming "the Bayesian model will achieve 84.3% accuracy." We are claiming "we expect Bayesian to outperform a simple moving average, especially with sparse data, and here is the metric we will use to measure that." The only specific number we commit to in advance is a KT-AUC range of 0.70 to 0.82 — because that is what the published literature already achieves on these exact datasets. We are anchoring to a known benchmark, not guessing.

Let me walk the key components. For pace calibration, the metric is prediction error — MAE and RMSE. We expect the Hierarchical Bayesian approach to have lower error than a simple moving average, particularly when a learner has logged only a few sessions. Bayesian priors compensate for sparse data; a moving average cannot.

For change detection, the metrics are detection latency — how quickly after a real shift does the algorithm fire? — and false-alarm rate. We expect CUSUM to find a clear winner profile across the six learner archetypes.

For progress projection, the metric is CI coverage — does the 95% confidence band actually contain the true finish date 95% of the time? We expect the Gaussian Process to be well-calibrated; we expect linear extrapolation to be overconfident or underconfident.

For knowledge tracing, the KT-AUC range of 0.70 to 0.82 is the benchmark from the literature. We aim to match or beat it.

For verification — Pillar B — the metric is precision and recall on detecting fake sessions. High precision means we do not flag honest learners. High recall means we catch real fakers. The tension between the two is the key design challenge we are solving.

### Key Terms

- **MAE / RMSE:** Mean Absolute Error and Root Mean Squared Error. Both measure how far a prediction is from the actual value. MAE is the average absolute gap; RMSE penalises large errors more. Lower is better.
- **KT-AUC (0.70–0.82):** The Area Under Curve for a knowledge-tracing model on Eedi/POJ benchmarks. 0.70 = significantly above random. 0.82 = state-of-the-art. This is the only pre-committed numeric range in the outcomes table.
- **CI Coverage:** Whether the model's confidence interval is honest. A 95% CI has good coverage if the true value falls inside it ~95% of the time across many runs. Bad coverage means the model is overconfident or underconfident.
- **Directional hypothesis:** A prediction that says "A will outperform B on metric M" without committing to an exact number. Appropriate before experiments are run. The exact magnitude is the experimental result.
- **Precision vs Recall (for fake detection):** Precision = of the sessions flagged as fake, what fraction actually were fake? Recall = of all fake sessions in the data, what fraction did we catch? High precision avoids false accusations; high recall avoids missing real cheating.

### Likely Q&A

**Q: Why only directional hypotheses — why not commit to specific numbers?**
**A:** Because we have not run the experiments yet. Committing to "MAE of 0.23" before seeing the data is not a scientific hypothesis — it is a guess dressed as a prediction. The directional hypothesis is honest: we have theoretical and empirical reasons from the literature to expect Bayesian to outperform a moving average on sparse data. The exact margin is what the experiment produces. We report specific numbers at Review 2.

**Q: What if the Gaussian Process does not outperform linear extrapolation?**
**A:** That is a valid experimental outcome and we will report it faithfully. The comparison methodology is the contribution — we are not committed to a specific winner. If linear extrapolation turns out competitive for this problem shape, we would choose the simpler model. Science is about finding out, not confirming what we already believe.

**Q: What does KT-AUC of 0.70–0.82 mean in practical terms?**
**A:** An AUC of 0.70 means the knowledge-tracing model correctly predicts whether a learner gets the next question right 70% of the time — significantly better than random guessing at 0.50. An AUC of 0.82 is the current state-of-the-art on these benchmarks. We are aiming to sit in this published competitive range, which validates that our concept-level, cold-start-tolerant approach is not sacrificing accuracy for tractability.

**Q: How do you balance precision and recall for fake-session detection?**
**A:** The trade-off depends on the cost of each error. A false positive — flagging an honest learner as a faker — is harmful to the user experience and trust. A false negative — missing a real faker — makes the system gameable. Our design priority is high precision: we accept that we may miss some fakers rather than incorrectly penalise genuine learners. The threshold is a tunable parameter we will calibrate in Phase II user testing.

---

## Slide 10 — Phase I Roadmap
**Target duration:** ~1.5 min

### Script

Phase I runs from May through approximately July 5th, structured around three reviews.

We are at Review 1 today — the 30% milestone. This review covers the two-pillar architecture, the algorithms for both pillars, the expected outcomes with per-component metrics, 48 references with 12 anchors, and the data-capture foundation built and working in the app.

Review 2 is approximately June 21st — the 80% milestone. By then, the synthetic data generator will be built and producing labelled datasets. The algorithm comparison will be running with intermediate results for at least two components. The static schedule generator and progress dashboards will be complete in the app.

Review 3 is approximately July 5th — the 100% milestone. That means the full four-component algorithm comparison is complete against baselines, performance evaluation is done on synthetic data and public KT benchmarks, we have a working open-loop planner demo, and a draft journal paper.

Phase II begins after July with its own three reviews. That is where the loop closes and Pillar B gets built.

### Key Terms

- **Static scheduler:** A schedule generator that creates a plan once, without adapting to new data. The Phase I product deliverable — the concrete baseline that Phase II makes adaptive.
- **Intermediate results (Review 2):** Partial comparison results reported before the full analysis is complete. Enough to show the comparison is running and initial trends are visible. Final numbers come at Review 3.
- **Open-loop demo (Review 3):** A working end-to-end demonstration of the Pillar A system — a learner can log sessions, see their calibrated pace, and receive a regenerated schedule — but without the Pillar B feedback loop yet.

### Likely Q&A

**Q: Is July 5th for Review 3 realistic?**
**A:** It is tight but achievable. Review 2 by June 21st means the synthetic generator and comparison framework are built — the heaviest engineering work is done. The two weeks to July 5th are for running the full comparison, writing up the results, and preparing the demo. The scope is well-bounded — Pillar B is explicitly Phase II, so there is no scope creep risk.

**Q: What exactly counts as the 80% at Review 2?**
**A:** The 80% milestone requires the algorithmic core producing results — intermediate comparison numbers for at least two of the four Pillar A components, the static scheduler working in the app, and the synthetic generator producing the labelled datasets the full comparison needs. It also requires the intermediate results chapter of the report to be drafted.

**Q: How far apart are the guidance calls from the reviews?**
**A:** Each review is preceded by a guidance call one week earlier — Guidance 2 on June 14th before Review 2 on June 21st, and Guidance 3 on June 28th before Review 3 on July 5th. The guidance calls are checkpoints to align on progress and surface any blockers before the formal review.

---

## Slide 11 — Review 1: The 30%
**Target duration:** ~1.5 min

### Script

Let me be precise about what the 30% means and what it does not mean.

The 30% is the data-capture foundation. It is not the full system — it is the layer that every future algorithm depends on. Without reliable, per-user session capture, pace calibration has no data to work with. Without cloud sync, the research cannot access session data from multiple scenarios. This foundation is the prerequisite for everything that follows.

In the app, we have built three things. First: session logging — a timer-based flow where the learner starts a session, can pause and resume, and submits it at the end. Full lifecycle.

Second: a per-user event store. Each learner's data lives in its own isolated local database, named with their unique user ID. There is no shared database that different users could accidentally contaminate. Every action in the app — session started, session paused, session completed — is recorded as an event in this store.

Third: authentication and cloud sync. Learners sign in via Supabase. Their session events are automatically uploaded to the cloud database, queued if the connection drops, and retried when it returns.

Alongside the built code, the offline research design is complete. The 4-stage algorithm comparison methodology is defined. The synthetic data generator is fully designed — six archetypes, known ground truth, nonlinear model. The Pillar B assessment approach has been surveyed and architected.

### Key Terms

- **Event store:** A database that records everything that happens in the app as a chronological sequence of events — "session started at 9am," "session paused at 9:45," "session completed with 45 minutes logged." Any metric can be derived from replaying the event log. Used because it is auditable and append-only.
- **Per-user isolation:** Each learner's event store is a separate database, named `StudyTracker_<userId>`. No shared storage between users — this prevents cross-account data contamination and supports multi-user experiments.
- **Cloud sync (write-ahead queue):** When the app is online, it uploads session events to a Supabase cloud database. If offline, events are held in a local queue and synced when connectivity returns. Retried automatically on failure.

### Likely Q&A

**Q: What exactly is the 30% — is it measured in lines of code or features?**
**A:** It is a milestone on the PES rubric, not a code metric. At Review 1, the rubric requires: architectural design, algorithms for both pillars, expected outcomes, references, and the data-capture foundation in working code. We have all of those. The percentage reflects completeness against the full Phase I scope and deliverables list.

**Q: Why is the static scheduler not built yet — that seems like a core piece?**
**A:** Deliberately deferred to Review 2. Building the scheduler before running the algorithm comparison would mean building the wrong scheduler. The Phase I comparison is partly to validate which scheduling approach to implement — constraint-based versus dynamic programming versus rule-based. We want the research to inform the build, not the other way around.

**Q: Is the event store being used for the research data, or just the app?**
**A:** Both. The event store captures real learner sessions in the app — session duration, material studied, time of day, pause events. Those are the real N=1 sessions used for longitudinal validation in the research. The synthetic data generator produces the bulk of the research data, but having a real event store running from now means we accumulate genuine data throughout Phase I and II.

---

## Slide 12 — Phase II Plan
**Target duration:** ~1.5 min

### Script

Phase II is where the real novelty lives. Phase I gives us a validated open-loop baseline — the adaptation engine, proven on benchmarks. Phase II closes the loop and adds the verification pillar.

At the Phase II Review 1 — the 40% milestone — we stand up the Python Intelligence Service, migrate the Pillar A engines from the app into Python so the evaluated code and the shipped code are the same thing, and close the feedback loop for the first time. Calibrated pace will directly trigger schedule regeneration — the system becomes adaptive, not just analytical. We also lock the Pillar B assessment design from user research and build the first item-generation prototype.

At Review 2 — the 80% milestone — the full loop is running. CUSUM shift detection fires replan events. The Gaussian process uses calibrated pace multipliers. Pillar B has working auto-grading for coding questions using test cases and for theory questions using the language model. Knowledge tracing is estimating concept-level mastery. We report intermediate results comparing closed-loop-plus-verified against open-loop-plus-unverified.

At Review 3 — the 100% — we have the end-to-end evaluated system, a working demo, and the journal paper submitted for publication.

The Phase II thesis is simple: does verifying the learning signal, and closing the feedback loop, produce measurably better outcomes than an open-loop planner that takes self-reported time at face value? That is the question Phase II answers. And that is the gap in the literature we are here to close.

### Key Terms

- **FastAPI Intelligence Service:** The Python web service that hosts all the ML models — Bayesian calibration, GP projection, KT mastery estimation, LLM grading. The app sends session data to it; it returns calibrated results. Replaces ad-hoc TypeScript implementations with a single Python source of truth.
- **Closed-loop (Phase II):** The verified mastery score from Pillar B — "this session produced genuine learning at this pace" — flows back into Pillar A's calibration, updating the learner's pace estimate and triggering a schedule regeneration. The feedback makes the loop.
- **Journal paper:** A peer-reviewed academic paper submitted to a journal — the output that makes Phase II's findings citable, permanent, and publicly available. Required by the Phase II Review 3 rubric.

### Likely Q&A

**Q: How will you evaluate whether the closed loop actually helps — what is the comparison?**
**A:** Closed-loop-plus-verified versus open-loop-plus-unverified on the same synthetic learner profiles. We measure two outcomes: schedule adherence — does the adaptive planner keep the learner on track better than a static one? — and learning gain — do knowledge-tracing mastery scores improve more with verified sessions than with unverified? The synthetic generator's known ground truth makes this comparison precise.

**Q: What is the Phase II novelty — what makes it publishable?**
**A:** Three things combined that no prior paper does. First, a calibrated, uncertainty-aware scheduling loop that uses Bayesian pace and GP projection to adapt continuously. Second, an assessment-verified learning signal — generated from the learner's own material — that feeds the loop. Third, concept-level knowledge tracing over LLM-generated, per-learner items, tolerating cold-start in a single-user scenario. The Islam 2024 base paper does scheduling but no loop and no verification. The CLST 2024 base paper does knowledge tracing but no scheduling and no adaptation. We are the first to combine them.

**Q: When does Phase II start?**
**A:** Immediately after Phase I Review 3, which is approximately July 5th. The Phase II first review is a few weeks after that. The timeline runs through to October 2026 for the final evaluation and journal submission.

---

## Quick Reference: All Key Terms

| Term | Plain-English Definition |
|---|---|
| Closed-loop | A system where the output feeds back in to change the input — like a thermostat |
| Open-loop | Computes results but does not feed them back to change behaviour |
| Ground truth | The known correct answer used to measure algorithm accuracy |
| Hierarchical Bayesian | Estimates individual parameters by combining personal data with group-level priors — works well with sparse data |
| CUSUM | A statistical alarm that detects when a process shifts away from its baseline — sensitive to sustained changes |
| Gaussian Process | A statistical model that gives a full distribution of possible outcomes, not just one number — produces an honest confidence band |
| Constraint-based scheduling | Builds a plan by satisfying a set of hard rules (hours, days, material ordering) |
| Knowledge Tracing (KT) | Estimates how much of a concept a learner has mastered, based on their assessment answer history |
| Cold-start | The challenge of estimating mastery when a learner has answered very few questions |
| Item Generation | Automatically creating assessment questions from study material using a language model |
| Spaced Repetition | Reviewing material at increasing intervals — right before forgetting — to build durable memory |
| Synthetic data generator | A program that creates realistic fake data with known properties (planted shifts, honest/faker labels) |
| pyKT | Open-source Python library for knowledge tracing research with public benchmarks |
| KT-AUC (0.70–0.82) | Knowledge-tracing accuracy score on standard benchmarks — 0.5 is random, 0.82 is state-of-the-art |
| MAE / RMSE | Error metrics for predictions — how far the predicted value is from the actual value |
| CI Coverage | Whether a confidence interval is honest — a 95% CI should contain the true value ~95% of the time |
| Directional hypothesis | "A will outperform B on metric M" — stated before experiments, without committing to an exact number |
| Precision / Recall | Precision = fraction of flagged sessions that were truly fake. Recall = fraction of fake sessions caught |
| FastAPI | Lightweight Python web framework used for the Intelligence Service |
| Supabase | Cloud database and authentication service — the central data hub |
| Event store | A database that records every app action as a chronological event log — auditable and append-only |
| Per-user isolation | Each learner's data in its own separate database, named with their user ID |
| Cloud sync | Automatic upload of local events to the cloud, with retry on failure |
