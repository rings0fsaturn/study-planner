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

Good morning, Professor — and welcome to the rest of the panel if others are joining us. My name is Rohit Saji, registration number PES2PGE24DS201. I'm doing my M.Tech in Data Science and Artificial Intelligence here at PES University.

This is my Phase I First Review. The project is called Adaptive Study Planning for Self-Directed Learners.

Over the next twenty minutes, I'll walk you through five things: how the system is built around two parts, the methods behind each part, the research papers it's based on, how we plan to test it, and where the work stands today — at the 30% mark.

Please feel free to stop me with questions on any slide. Let's begin.

### Key Terms

*(No technical terms on this slide.)*

### Likely Q&A

**Q: Can you describe the project in one sentence?**
**A:** We are building a system that automatically adjusts a learner's study schedule based on how they are actually studying — and verifies that the time they logged produced real learning, not just hours sitting at a desk.

---

## Slide 2 — The Vision
**Target duration:** ~1.5 min

### Script

The problem we're solving is one most of us have lived through. You sit down and make a study plan — "I'll finish this course in eight weeks." Then, within days, life gets in the way. One week you fall behind, the next you race ahead. But the plan never changes. It just sits there. The tools we have today either only count your hours, or they hand you one fixed schedule that's out of date the moment your real life looks different from it.

And there's a deeper problem hiding underneath. When someone writes down "I studied for two hours today," nobody can actually check whether those two hours led to real learning, or whether they were spent staring at a screen, distracted. We just take the number on trust.

Our goal is to fix both problems with a single system. It learns how fast each person really studies — but only from sessions we can confirm with a short test. It notices when someone's study habits change. And instead of promising one exact finish date, it gives a range you can trust — "you'll most likely finish somewhere between Week 8 and Week 11." When that prediction shifts, it quietly builds you a new, realistic schedule.

That's what we mean by a "verified, closed-loop adaptive planner" — a planner that checks the learning is real, and then feeds that result back to update itself.

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

Professor, I want to start this slide by being honest about where this design came from.

In our first guidance call, you asked me a question that stopped me in my tracks: "How do you stop people from entering fake study sessions?" That single question reshaped the whole project.

My first design was just one system — a planner that adjusts your schedule based on the study time you log. Your question made me see a basic flaw. If someone can log fake sessions, then everything the system learns is built on bad data. Bad data in means bad results out. The schedule would still adjust itself — but it would be adjusting to lies.

So I went back and rebuilt the project around two parts that work together. I call them Pillar A and Pillar B.

Pillar A is the part that adapts. It learns your pace, spots when your habits change, predicts when you'll finish, and rebuilds your schedule. Think of it as the engine.

Pillar B is the part that checks. It creates short tests from your own study material and confirms whether you actually learned something. This is the honest signal that makes the engine worth trusting.

Both parts matter equally. Neither one works well on its own. And our Phase II testing is built specifically to show the difference between having that checking step and not having it.

The project is stronger because you pushed on it, and I'm glad you did.

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

This diagram shows the whole system. Before I walk through it, look at two things: the colours and the line styles.

Solid boxes and solid lines are Phase I — the parts we've already built or are researching right now. Dashed boxes are Phase II — the new parts we'll build later. The gold arrows are the feedback loop. That loop is what lets the system update itself instead of staying frozen, and we've deliberately saved it for Phase II.

The system has three layers. At the bottom is the app — a web app that works well on a phone, where you log your study sessions, look at your roadmap, and later on, take the short tests. This is the part you actually see and tap on.

Above that sits the intelligence service. This is a program written in Python that does all the heavy thinking — working out your pace, building your schedule, and grading your tests. The app asks it for answers whenever it needs them.

At the top is the research layer, which runs offline, away from users. This is where we train our models, compare different methods, and create practice data to test them on. This is where the actual thesis experiments happen.

In the middle is Supabase — a cloud database, which is basically an online storage box that both the app and the intelligence service can read from and write to. And OpenAI's language model — the same kind of AI behind tools like ChatGPT — is what Pillar B uses to write and grade the test questions.

So in short: Phase I builds and tests the left-hand side. Phase II adds the gold loop.

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

Pillar A has four parts, and they work like an assembly line — the result of one part becomes the starting point for the next. Let me go through them from left to right.

Part one is Pace Calibration. Everyone studies at a different speed, and that speed changes — a stressful week, a holiday, a hard new topic. To learn each person's real pace, we use a method called Hierarchical Bayesian estimation. The name sounds heavy, so here's the simple idea: it works out your personal pace by mixing your own data with what we already know about learners in general. The big advantage is that it still works when we have very little data about you. If you've only logged three sessions, it leans on the general pattern at first, then zooms in on your own pattern as more sessions arrive.

Part two is Change Detection. People's habits shift — a new job, exam stress, a dip in motivation. We use a method called CUSUM to catch these shifts the moment they happen, instead of noticing two weeks later. The easiest way to picture CUSUM is as a smoke alarm: it quietly adds up how far your behaviour is drifting from normal, and the moment that drift gets too big, it goes off.

Part three is Progress Projection. Once we know your pace and have spotted any shifts, we predict when you'll finish. For this we use a method called a Gaussian Process. Instead of giving one single date, it gives a range — "you'll finish between Week 8 and Week 11, with 95% confidence." Being honest about that uncertainty is exactly what makes the prediction useful when you have a real decision to make.

Part four is Schedule Generation. Using the updated prediction, the system builds you a fresh, do-able schedule. It does this with constraint-based planning, which simply means it builds the plan around your fixed rules — your study days, how many hours you have, and which material has to come before which.

In Phase I, we work out the pace, but we don't yet feed it back to rebuild the schedule on its own. That feedback loop is what we close in Phase II.

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

Pillar B is the part that checks the learning is real. The design is fully worked out. The actual building happens in Phase II.

Here's how it works. When you finish studying a piece of material, the system hands that material to a language model — an AI that can read and write text — and asks it to create a short, focused test. The questions come straight from what you just read, not from some generic question bank. You take the test, and the system grades it for you. For coding questions, it runs your code against test cases to check it works. For written questions, it uses the language model to mark your answer. Then it does something called knowledge tracing, which simply means it keeps track, over time, of how well you've truly understood each idea — not just your score on one test.

You get to choose what kind of test you take. It can be a simple quiz, or it can feel like a real exam — timed, split into sections, with marks and even negative marking — modelled on a real exam such as GATE, GRE, or a university paper.

One thing we're still settling is the exact exam templates: which exams to copy, how many questions per section, and the right mix of easy and hard. We're deciding this through user research in Phase I — actually asking learners what they need — so that what we build in Phase II fits real needs.

The key idea is this: a timed test, built from your own material, in the shape of a real exam, is much harder to fake than simply typing in how many hours you studied. That's what makes it a signal we can trust.

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

We read through 48 research papers published between 2024 and 2026. Out of those, 12 are what we call anchor papers — the ones our work leans on most, or compares itself against, one for each main method across both pillars.

I want to spend a moment on the gap we found, because that's really the heart of what's new here.

Every single method in our system — the Bayesian pace estimate, the Gaussian Process prediction, the CUSUM shift detector, the AI-written test questions, the knowledge tracing — already exists in the research. We're not inventing new mathematics. What doesn't exist yet is a system that joins all of these into one verified, closed loop — where the checking signal from Pillar B is what drives the rescheduling in Pillar A.

We have one main paper, what we call a base paper, for each pillar. For Pillar A, it's Islam and colleagues, 2024, published at IEEE ICCIT. They built what's called a "predict-then-optimise" scheduler — meaning they first predict how well a student will do, using a neural network, and then use a step-by-step optimisation method called dynamic programming to build the best schedule from that prediction. Our version takes their idea further: ours keeps adapting instead of running just once, it gives an honest range instead of a single guess, and it works at the level of each study session rather than the whole course.

For Pillar B, the base paper is CLST, 2024, published on arXiv. They used a language model to stand in for a student, as a way to handle the "cold-start" problem — that is, judging a learner when you barely have any data on them yet. We take that idea and apply it to a single learner, tracking understanding concept by concept, on questions the AI has written. That's a setting their paper never looks at.

So the gap, in one sentence: nobody has joined these pieces into a closed loop where the learning signal is what verifies the planning signal.

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

### Anchor Paper Summaries (if the guide asks about a specific paper)

> Twelve anchors, six per pillar. Each entry gives you: what the paper does, what it found, and why it is in our survey. Enough to answer "tell me about that paper" in 30 seconds.

---

#### Pillar A — Adaptation (6 papers)

**1. ★ Islam et al. 2024 — Predict-then-Optimise Study Scheduling** *(BASE PAPER)*
`IEEE ICCIT 2024`
What it does: First predicts a student's exam grade using a neural network, then uses dynamic programming to build the optimal study preparation schedule from that prediction.
Key finding: The two-step predict-then-optimise approach produced more efficient schedules than static, rule-based plans.
Connection to us: Our Pillar A base paper. We extend it in three ways — the scheduler keeps adapting (not one-shot), we give a calibrated uncertainty range (not a single date), and we operate at session level (not course level).

---

**2. Chen et al. 2024 — A Hierarchical Bayesian Model of Adaptive Teaching**
`Cognitive Science, 2024`
What it does: Proposed a hierarchical Bayesian model that infers individual learner characteristics — like learning rate and prior knowledge — from sparse observation data, validated on N = 312 participants.
Key finding: The hierarchical model reliably estimated per-learner parameters with as few as five to ten observations by pooling information across learners as a group-level prior.
Connection to us: Empirical justification for our Hierarchical Bayesian pace calibration — it demonstrates the approach works with the sparse, early-session data we will have for each learner.

---

**3. Saqr et al. 2026 — Early Warning Signals Before Dropping Out: CSD Indicators**
`Proc. Learning Analytics and Knowledge (LAK), ACM, 2026`
What it does: Applied critical-slowing-down (CSD) indicators — a concept from physics and ecology — to educational engagement data, to detect when a student's resilience is weakening before they disengage or drop out.
Key finding: CSD indicators appear weeks before dropout events, giving a practically useful early-warning window that conventional methods miss.
Connection to us: Informs our CUSUM change-detection component — establishes that statistical monitoring methods can detect behavioral regime shifts in educational data long before they become obvious.

---

**4. Pérez-Suay et al. 2024 — Predicting Student Performance from Moodle Logs with Gaussian Processes**
`IEEE-RITA, 2024`
What it does: Applied Gaussian process regression to activity log data from the Moodle learning management system to predict student performance and model individual learning curves.
Key finding: GP regression provided more accurate and better-calibrated predictions than baseline models, and the uncertainty bands were honest — the 95% interval contained the true value roughly 95% of the time.
Connection to us: Direct empirical justification for using GP in our progress projection — demonstrates GP works on educational time-series data and produces trustworthy uncertainty estimates.

---

**5. Pagano et al. 2026 — Efficiency and Effectiveness of Adaptive Learning Paths**
`Interactive Technology and Smart Education, 2026`
What it does: Large-scale controlled study across 2,064 students and seven ECDL/ICDL digital-skills modules, comparing adaptive learning paths (which skip already-mastered content) against regular linear paths.
Key finding: Adaptive paths reduced time-on-task by roughly 17% while maintaining equivalent learning outcomes — efficiency gains with no learning loss.
Connection to us: Validates the core claim of our evaluation design — that adaptive scheduling outperforms static plans on adherence and efficiency — and gives us a concrete benchmark effect size to aim for.

---

**6. Lin et al. 2024 — Scaling Gaussian Processes for Learning-Curve Prediction with Kronecker Structure**
`arXiv preprint, 2024`
What it does: Proposed a scalable GP model that uses Kronecker matrix structure to model learning curves jointly as a function of model hyperparameters and training progression, cutting computational cost from cubic to near-linear.
Key finding: The Kronecker GP scaled to large learning-curve datasets without sacrificing the calibration benefits that make GPs useful.
Connection to us: Technical justification for our GP projection approach — addresses the scalability concern and shows GP learning curves can be computed efficiently as session counts grow.

---

#### Pillar B — Verification (6 papers)

**7. ★ CLST 2024 — Cold-Start Mitigation in Knowledge Tracing via LLM** *(BASE PAPER)*
`arXiv:2406.10296, 2024`
What it does: Aligned a generative language model to behave like a student knowledge tracer — using the LLM to generate synthetic prior observations for new learners who have little or no interaction history.
Key finding: Warming up the KT model with LLM-simulated observations substantially improved cold-start accuracy on standard benchmarks (Eedi, POJ), without needing real historical data.
Connection to us: Our Pillar B base paper. We extend it from many-learner, fixed-item-bank KT to single-learner, concept-level tracing over LLM-generated, per-learner items — a setting their paper never addresses.

---

**8. Chan et al. 2024 — Automatic Item Generation in STEM Using LLM Prompting**
`Computers and Education: Artificial Intelligence, doi:10.1016/j.caeai.2024.100344`
What it does: Systematic study of LLM prompting strategies for automatic item generation across STEM subjects — computer science, physics, biology, and mathematics.
Key finding: LLMs can generate relevant and valid assessment items at scale, but hallucination is a genuine risk; concept-anchoring and structured prompts significantly reduce it.
Connection to us: Grounds our item-generation design in Pillar B — the hallucination finding directly informs our safeguard that every generated item must be concept-tagged and traceable to a specific passage in the learner's source material.

---

**9. Self-hosted Lecture-to-Quiz 2026 — Local LLM MCQ Generation with Quality Control**
`arXiv:2603.08729, 2026`
What it does: Built a self-hosted, on-device pipeline that ingests lecture material and generates multiple-choice questions using a locally-run language model — no cloud API — with deterministic quality control checks built in.
Key finding: Local LLMs produced MCQs of comparable quality to cloud APIs at a fraction of the cost, and the answer-verification step caught the majority of hallucinated or unanswerable items.
Connection to us: Architecture template for our Pillar B item-generation pipeline — we adopt the same "ingest material → generate items → verify → tag concepts → use" flow, and the local-LLM approach informs our LLM cost-control strategy via the FastAPI Intelligence Service.

---

**10. KC Tagging 2024 — Automated Generation and Tagging of Knowledge Components from MCQs**
`doi:10.1145/3657604.3662030, 2024`
What it does: Used GPT-4 to automatically generate and tag knowledge components (KCs) from multiple-choice questions — then validated the automated tags against expert-generated tags.
Key finding: LLM-generated KC tags reached high agreement with expert labels, making automated concept extraction from assessment items a viable and scalable alternative to manual tagging.
Connection to us: Essential bridge paper — concept tagging is the step that connects LLM-generated items to knowledge tracing. Without a KC tag on each item, there is nothing for the KT model to trace mastery of.

---

**11. Gaming the System 2026 — Understanding Gaming via Self-Regulated Learning Think-Alouds**
`doi:10.1145/3785022.3785025, 2026`
What it does: Used think-aloud protocols and self-regulated learning (SRL) analysis to understand why and how students game automated learning systems — deliberately giving wrong answers to skip content or complete tasks faster.
Key finding: Gaming is primarily driven by perceived irrelevance of the content and time pressure — students game when they believe the system's tasks do not serve their actual learning goals.
Connection to us: Directly motivates Pillar B — gaming is the exact behavior the guide identified as the core threat to our system's integrity. This paper explains the psychology behind it and validates that material-relevant, timed, exam-patterned assessments are inherently harder to game than generic quizzes.

---

**12. Spaced Repetition 2025 — Personalised Language Learning Using Spaced Repetition Scheduling**
`doi:10.1007/978-3-031-98459-4_19, 2025`
What it does: Designed and evaluated a personalised spaced-repetition algorithm that schedules review sessions at algorithmically optimised intervals, calibrated to each individual's estimated forgetting curve.
Key finding: Personalised intervals significantly outperformed fixed-interval spaced repetition in long-term retention, particularly for learners with heterogeneous prior knowledge.
Connection to us: Informs the assessment placement cadence in Pillar B — the question of when to schedule an assessment after a study session, not just what to ask. Our review-placement design draws directly from spaced-repetition principles to maximise retention and minimise disruption to the study flow.

---

## Slide 8 — Datasets & Evaluation
**Target duration:** ~1.5 min

### Script

We have four data sources — two for Pillar A, two for Pillar B — and the evaluation is structured across three legs. Let me walk through both.

For Pillar A, the main data is our synthetic session generator. We create thousands of labelled study sessions across six learner archetypes — the Steady learner, the Morning Lark, the Fading Flame, the Weekend Warrior, the Deadline Sprinter, and the Marathon Runner. The key point is that we plant the true answers into the data: we know exactly when each learner's pace shifted, and exactly which sessions were honest versus faked. That precision is impossible with real collected data. This generator is itself a research contribution. Alongside it, I log my own real sessions — one person, starting now. To be honest: no real session data exists yet at Review 1. The 30% milestone built the data-capture foundation precisely so collection can begin immediately.

For Pillar B, the main data is two public knowledge-tracing benchmark datasets, accessed through a research toolkit called pyKT. The first is Eedi — real students answering multiple-choice maths questions, which matches our theory assessment modality. The second is POJ — a programming exercise dataset, which matches our coding modality. These are standard benchmarks, so we can compare our knowledge-tracing results fairly against what others have published. The second Pillar B data source is the honest-versus-faker overlay — synthetic sessions where some learners genuinely studied and some faked it. In Phase II, we run these through Pillar B's assessment pipeline to measure whether the verification system can reliably catch the fakers.

Three evaluation legs: Pillar A algorithm comparison on synthetic data, Pillar B knowledge-tracing model comparison on public benchmarks, and closed-loop versus open-loop head-to-head in Phase II.

### Key Terms

- **Synthetic data generator:** A program that creates realistic fake data with deliberately planted properties — known pace, known shift points, known honest/faker labels. Used when you need ground truth to measure algorithm accuracy.
- **pyKT:** An open-source Python library for knowledge tracing research. It packages multiple public benchmark datasets and pre-implemented baseline models in one place.
- **Eedi / POJ:** Two standard KT benchmarks. Eedi contains real student answers to multiple-choice maths questions. POJ contains code submissions to programming problems, with correctness labels.
- **KT-AUC:** The Area Under the ROC Curve for a knowledge-tracing model — how well it predicts whether a learner will answer the next question correctly. 0.5 = random guessing. The literature on Eedi/POJ reports 0.70–0.82 for competitive models.
- **Mastery delta:** The change in a learner's estimated concept mastery between the start and end of a study session, as measured by the knowledge-tracing model after they take an assessment. Positive delta = genuine learning happened. Near-zero or negative delta = likely no learning, which is the signal used to flag a session as faked.
- **Honest-vs-faker overlay:** Synthetic sessions where ground-truth labels are planted — some sessions are "honest" (mastery increased) and some are "faked" (session logged but no learning occurred). Used in Phase II to evaluate whether Pillar B's assessment pipeline can reliably detect the difference.

### Likely Q&A

**Q: Why use synthetic data instead of real learner data?**
**A:** Real data does not give us ground truth. If a learner's pace shifts in week 3, we do not know that — we can only estimate it from observations. The synthetic generator plants shifts at known locations and known times, so we can measure exactly whether an algorithm detected the shift, how many sessions it took, and how many false alarms it produced. That precision is the core of the comparison methodology.

**Q: Is N=1 real sessions scientifically valid?**
**A:** N=1 is used for longitudinal validation only — not as the basis for our statistical claims. The algorithm comparisons run on thousands of synthetic sessions and standard benchmarks. My own sessions serve as a sanity check: do the algorithms behave sensibly on real, noisy, human data? That is a different question from "do they beat the baselines," and it has a different standard of evidence.

**Q: What are the six archetypes based on — did you make them up?**
**A:** They are grounded in the educational psychology and behavioural science literature on self-directed learner patterns. Each archetype has a parameterised behavioural model — time-of-day preferences, fatigue curves, deadline responsiveness — derived from published research on student learning behaviours. The generator is not arbitrary; it is literature-parameterised.

**Q: How exactly does the honest-versus-faker overlay test Pillar B — what is the step-by-step mechanism?**
**A:** Here is how it works. The synthetic generator labels each session: "honest" means the simulated learner's mastery genuinely increased during that session; "faker" means the session was logged but no real learning happened — mastery stayed flat. In Phase II, when Pillar B is built, we run each synthetic session through the full assessment pipeline. The system generates a quiz from the study material. The simulated honest learner answers well — because their mastery did increase. The simulated faker answers poorly — because they didn't learn. The knowledge-tracing model then computes the mastery delta for each session. Sessions where the delta is near zero or negative are flagged as fake. We compare those flags against the planted ground-truth labels and measure precision — of sessions we flagged as fake, how many actually were? — and recall — of all fake sessions in the data, how many did we catch? The assessment is the detection mechanism. There is no separate fraud-detection algorithm; the learning signal itself is what exposes the faker.

**Q: Does this honest-versus-faker evaluation happen in Phase I or Phase II?**
**A:** Phase II. The evaluation requires Pillar B — the full assessment generation and knowledge-tracing pipeline — to actually be built. In Phase I, we design the overlay and ensure the synthetic generator produces sessions with planted honest/faker labels. But the detection test itself cannot run until Phase II, when the pipeline exists to generate the quiz, receive the answers, and compute the mastery delta.

**Q: Why four separate data sources — isn't that unnecessarily complex?**
**A:** Each source answers a different question, and no single source can answer all of them. The synthetic generator answers "which algorithm is more accurate" — it is precise because we planted the true answers. The public KT benchmarks answer "is our knowledge-tracing approach competitive on real student data" — they provide credibility because others have reported results on the same data. The honest-versus-faker overlay answers "does assessment-based verification actually detect fake sessions." The N=1 real data answers "does the system behave sensibly on real, messy human behaviour." Different questions need different evidence — that is what makes the evaluation robust.

### Dataset → Evaluation Leg Quick Reference

> Use this if the guide asks "which data is for what."

| Dataset | Pillar | Evaluation leg | Phase | What it tests |
|---|---|---|---|---|
| Synthetic session generator | A | Leg 1 — algorithm comparison | Phase I (R2/R3) | Pace calibration, change detection, GP projection, scheduling — measured against planted ground truth |
| N=1 real sessions (mine) | A | Leg 1 — longitudinal validation | Phase I (R3 onwards) | Sanity check: does behaviour on real data match synthetic findings? No data yet at R1. |
| Public KT benchmarks — Eedi + POJ (via pyKT) | B | Leg 2 — KT model comparison | Phase I (R2/R3) | Which KT model wins on real student data? AUC target: 0.70–0.82 |
| Honest-vs-faker overlay (synthetic) | B | Leg 3 — closed-loop vs open-loop | Phase II | Does Pillar B's assessment pipeline detect fake sessions? Measured by precision + recall against planted labels |

---

## Slide 9 — Expected Outcomes
**Target duration:** ~2 min

### Script

This slide lays out what we expect to show by the end of Phase I. I want to be careful about what these results are, and what they are not.

These are directional predictions, not exact promises. In other words, we're not claiming "the Bayesian model will hit 84.3% accuracy." We're saying "we expect the Bayesian method to beat a simple running average, especially when there's very little data — and here's the measurement we'll use to check that." The one specific number we're willing to commit to in advance is a score called KT-AUC, somewhere between 0.70 and 0.82. And we only commit to that because it's what the published research already reaches on these exact datasets. We're anchoring to a known result, not guessing.

Let me go through the main parts. For pace calibration, we measure prediction error — how far off the estimate is — using two standard measures called MAE and RMSE. We expect the Bayesian method to be more accurate than a simple running average, especially when a learner has only logged a few sessions, because the Bayesian method can lean on general knowledge to fill the gaps, and a running average can't.

For change detection, we measure two things: how quickly the alarm goes off after a real change, and how often it goes off when nothing has actually changed — a false alarm. We expect CUSUM to come out as the clear winner across all six learner types.

For progress prediction, we check something called coverage — when we say "95% confident," does the real finish date actually land inside that range about 95% of the time? We expect the Gaussian Process to be honest about this, and we expect a simple straight-line prediction to be either over- or under-confident.

For knowledge tracing, that 0.70 to 0.82 score is the benchmark from the research, and we aim to match it or beat it.

And for Pillar B, the checking part, we measure precision and recall on catching fake sessions. In plain terms: high precision means we rarely accuse an honest learner wrongly, and high recall means we rarely let a real faker slip through. The tug-of-war between those two is the main design challenge we're solving.

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

Phase I runs from May until around the 5th of July, and it's split into three reviews.

We're at Review 1 today — the 30% mark. This review covers the two-pillar design, the methods behind both pillars, the results we expect with a measurement for each part, our 48 references including the 12 anchor papers, and the data-capture foundation, which is built and already working in the app.

Review 2 is around the 21st of June — the 80% mark. By then, the synthetic data generator will be built and producing its labelled data. The comparison of methods will be running, with early results for at least two of the parts. And the basic schedule builder and the progress screens will be finished in the app.

Review 3 is around the 5th of July — the 100% mark. By then, the full comparison across all four parts will be done against the baselines, the performance testing will be finished on both the synthetic data and the public datasets, we'll have a working demo of the open-loop planner, and a first draft of the journal paper.

Phase II then begins after July, with its own three reviews. That's where we close the loop and build Pillar B.

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

Let me be clear about what the 30% means, and what it doesn't.

The 30% is the data-capture foundation. It's not the whole system — it's the base layer that every method we build later depends on. Without a reliable way to record each person's sessions, the pace calibration has no data to learn from. And without cloud syncing, the research can't pull session data from different situations. This foundation has to come first; everything else is built on top of it.

In the app, we've built three things. First, session logging. It's a simple timer-based flow: you start a session, you can pause and resume it, and you submit it at the end. The whole start-to-finish cycle works.

Second, a per-user event store. An event store is just a running diary of everything that happens in the app — session started, session paused, session finished — written down in order. Each learner's diary lives in its own separate local database, labelled with their own ID. There's no shared database where one user's data could accidentally mix with another's.

Third, sign-in and cloud syncing. Learners log in through Supabase, and their sessions are automatically uploaded to the cloud. If the internet drops, the app holds onto them and uploads them later, when the connection comes back.

And alongside the code we've written, the research design is fully mapped out. The four-stage plan for comparing methods is defined. The synthetic data generator is fully designed — the six learner types, the known answers, and a realistic, non-linear model behind them. And the approach for Pillar B's tests has been researched and laid out.

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

Phase II is where the truly new work lives. Phase I gives us a tested open-loop baseline — the adaptation engine, proven on standard datasets. Phase II then closes the loop and adds the checking pillar.

At Phase II's first review — the 40% mark — we set up the Python intelligence service, move Pillar A's engines out of the app and into Python so that the code we test is the exact same code we ship, and we close the feedback loop for the first time. From that point on, your measured pace will directly trigger a rebuild of your schedule — so the system starts acting on what it learns, instead of just reporting it. We also lock down the Pillar B test design from the user research, and build a first rough version of the question generator.

At Review 2 — the 80% mark — the full loop is running. The CUSUM detector triggers replanning. The Gaussian Process uses the adjusted pace. Pillar B can grade tests on its own — coding questions through test cases, and written questions through the language model. Knowledge tracing is estimating how well each concept is understood. And we report our first results comparing the closed-loop, verified version against the open-loop, unverified one.

At Review 3 — the 100% mark — we have the complete, tested system end to end, a working demo, and the journal paper submitted for publication.

The question Phase II answers is simple: does checking that the learning is real, and closing the feedback loop, actually give better results than an open-loop planner that just takes self-reported study time at face value? That's the question. And that's the gap in the research we're here to close.

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
