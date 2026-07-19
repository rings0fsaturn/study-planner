# Phase-1 ESA — Presenter Script

**Adaptive Study Planning for Self-Directed Learners**
Rohit Saji · PES2PGE24DS201 · M.Tech DSAI · guide Prof. Ramesh Prakash Guledgudd · PES University

**Format:** online, screen-share · 20-minute slot = slides + live demo · **Q&A after** the slot.
**Deck:** `design/phase1-esa-deck.html` (open in a browser, press **F** for fullscreen, **→ / ←** to navigate).

> How to use this: the **bold spoken lines** are what you actually say — natural, not slide-reading.
> Italics are *delivery cues*. Timings are targets, not scripts to race. Total lands at **~19:20**, leaving ~40 s of air.

---

## Timing plan

| # | Slide | Length | Ends at |
|---|---|---|---|
| 1 | Title | 0:25 | 0:25 |
| 2 | Agenda | 0:15 | 0:40 |
| 3 | Problem Statement | 1:15 | 1:55 |
| 4 | Abstract & Scope | 0:50 | 2:45 |
| 5 | Literature Survey | 1:20 | 4:05 |
| 6 | Suggestions from Review-3 | 0:55 | 5:00 |
| 7 | Methodology + findings | 2:00 | 7:00 |
| 8 | Design Approach & Constraints | 1:00 | 8:00 |
| 9 | Architecture | 1:10 | 9:10 |
| 10 | Design Description & Details | 1:05 | 10:15 |
| 11 | Technologies | 0:40 | 10:55 |
| 12 | Project Progress | 0:45 | 11:40 |
| 13 | Demo intro | 0:25 | 12:05 |
| — | **LIVE DEMO** | 5:30 | 17:35 |
| 14 | References | 0:10 | 17:45 |
| 15 | What's Next · Phase-2 | 1:20 | 19:05 |
| 16 | Thank you | 0:15 | 19:20 |

**Watch the clock at slide 7 (must leave by 7:00) and at the demo (must be back on slides by 17:35).** If you're behind entering the demo, use the *manual-log shortcut* (see demo, Beat 3).

**Online delivery cues:** camera on, look at the lens on the title and the close; share the *deck window only* until the demo, then switch share to the *app*; keep energy up (online flattens it); pause 1 s after each slide title so the panel's eyes land before you talk.

---

## Slide 1 — Title · 0:25

**"Good morning. I'm Rohit Saji, and this is my Phase-1 project — *Adaptive Study Planning for Self-Directed Learners*."**

**"In one line: it learns your real study pace from your own logged sessions, and keeps re-projecting your finish date as the evidence comes in — instead of trusting the plan you guessed on day one."**

*Then go straight to agenda — don't linger.*

## Slide 2 — Agenda · 0:15

**"I'll set up the problem and the prior work, walk the methodology and what I found, show the architecture, then go live in the app, and close on Phase-2."**

*One breath. Move on.*

## Slide 3 — Problem Statement · 1:15

**"Self-directed learners — people doing online courses or exam prep with no instructor setting the pace — start with a fixed plan: 'two hours a day, finish by the 30th.' Within days, reality drifts. Some days you fall behind, some you race ahead, and the plan just… doesn't move."**

**"Existing tools each fix half of it. Time-trackers record what you did but don't plan. Static planners make a schedule once and never revise it. Neither one learns the pace you actually achieve — so the finish date silently goes stale while the app keeps showing it as if it were still true."**

**"Two things make this genuinely hard. The evidence is *sparse* — you only have a handful of sessions before the plan first needs to adapt. And your pace isn't stationary — it shifts. So the method has to work from very little data, and it has to tell a real shift apart from ordinary noise."**

**"The gap I close: a planner that treats your own logged behaviour as evidence, updates its pace estimate as that evidence arrives, and regenerates the plan."**

*Transition:* **"So what am I actually building, and where do I stop?"**

## Slide 4 — Abstract & Scope · 0:50

**"Phase-1 is the open-loop adaptive planner — four components: pace calibration, change detection, completion projection, and capacity-based replanning — and it's a *working*, local-first web app, not a prototype in a notebook."**

**"Crucially, I didn't just build it — I evaluated every component offline against established baselines, on synthetic data with known ground truth, with held-out cases, bootstrap confidence intervals, and multiple-comparison correction."**

**"Out of scope, deliberately, for now: closing the loop with verified learning, long-term validation on real data, and anything multi-user. Those are Phase-2 and beyond."**

## Slide 5 — Literature Survey · 1:20

**"I grouped the literature into five families, and the point of this table is the last column — the gap."**

**"Bayesian calibration works from sparse per-learner data, but it targets whether you got an answer *right*, not planned-versus-actual pace. Change-point detection catches behavioural shifts early, but it only *detects* — it prescribes no replanning. Gaussian-process methods give calibrated uncertainty, but they're applied cross-sectionally to a final grade, not to a running finish-date projection."**

**"Adaptive scheduling — this is my base paper, Islam 2024 — pairs prediction with dynamic-programming optimisation, but the plan is solved once and never adapts to realised pace. And self-regulated-learning analytics gives validated behavioural indicators, but stops at showing them to the learner."**

**"Each is strong alone. Not one closes the loop from realised pace back to the plan. That loop is my contribution."**

*Transition:* **"Before the methodology — what came out of Review-3."**

## Slide 6 — Suggestions from Review-3 · 0:55

**"One suggestion from my guide at Review-3: explore *LLM-guided practice sessions* — a live model that watches what the learner is doing in a practice session, say the code they're writing, and guides them: nudges when they're stuck, suggests improvements — but never completes the work for them. I've scoped that into Phase-2; I'll come back to it."**

**"Beyond that, three things I drove myself since Review-3. I redesigned the scheduler — retired a brittle day-by-day packer for a capacity-based booking model, and re-validated the models on the new regime. I made the evaluation genuinely defensible — held-out archetypes, bootstrap intervals, Holm correction, and I report the nulls honestly. And I grounded the synthetic data against a real public dataset, OULAD, so the regime resembles real behaviour."**

*Delivery: say the self-initiated column with a little pride — it's your initiative.*

## Slide 7 — Methodology + Findings · 2:00  ⏱ *centrepiece — do not overrun*

**"The system is an open loop. A session is logged; pace is recalibrated from the whole history; the pace series is checked for a shift; the finish date is re-projected; and the schedule regenerates when the projection drifts from the deadline. Open, not automatic — a detected shift raises a prompt, and the learner decides."**

**"Under each step is the model I actually shipped — and every one of those was chosen by offline comparison, not by assumption."** *(gesture across the chips)*

**"Three findings worth your attention."**

**"First — a real win. My context-shrinkage calibrator beats the Bayesian incumbent on *prospective, short-history* pace prediction — exactly the low-data regime where a new learner's plan first needs to adapt. That win survives Holm correction across bands and both data regimes."**

**"Second — an honest null. No exotic detector beat the classic CUSUM frontier. So I ship CUSUM — it's the *fastest* detector — because detection only raises a human-confirmed prompt. A false alarm costs the learner a dismissal; a late detection costs adaptation time. Fast-with-confirmation is the right trade."**

**"Third — a result I'm honest about. The raw Gaussian-process interval *under-covers* badly. I found the fix — a split-conformal correction restores near-nominal coverage — it's validated, but I've deferred shipping it to Phase-2, so I'm flagging it as a known limitation, not hiding it."**

*If asked-ahead or you have 5 s spare:* **"And a dynamic-programming scheduler actually won on deadline drift — but I deliberately didn't ship it, because the day-by-day packing problem it solved was removed by the booking redesign."**

*Transition:* **"So how is the system put together to make that loop work?"**

## Slide 8 — Design Approach & Constraints · 1:00

**"Three decisions shaped it. One — local-first and event-sourced: every action is an immutable event in the browser, and every view is *derived by replaying* that log. So the core loop works offline, and each learner's data is isolated in its own database."**

**"Two — I split the compute by what it needs. Anything that fits a statistical model to your accumulated history runs in a small Python service. Anything that just derives a view from your local log runs in the browser. That keeps it responsive and offline-capable."**

**"Three — one behaviour, two implementations: the TypeScript client engine is mirrored by a Python engine, kept numerically identical by a golden-fixture test harness — so the code I *evaluated* is the code that *ships*."**

**"Constraints are honest: a single learner, commodity CPU-only hardware, sparse data — and every service call is token-verified before any model runs."**

## Slide 9 — Architecture · 1:10

**"This is the real architecture, straight from the codebase — not a cartoon."**

**"Terracotta is the local-first React client — it owns session logging, the booking engine, the dashboards, and the Gaussian-process projection. Moss is the Python intelligence service — it does the Bayesian and shrinkage calibration and the CUSUM detection. Clay is Supabase — auth, the event database, and storage — the data hub between them."**

**"Two things to notice. Only the model-fitting actually crosses the wire — everything derived from your local log stays in the browser. And the offline research tier, dashed here, *imports the very same engines* to run the evaluation — it's not in the live request path."**

*Transition:* **"Let me go one level deeper into the data model before we go live."**

## Slide 10 — Design Description & Details · 1:05

**"Here's the key sequence: you log a session; it's appended to the event log; the browser calls the token-verified calibration endpoint; the service returns the Bayesian-plus-shrinkage pace and any CUSUM shift; the browser re-projects the burn-up; and if the projection has drifted, you get a recalibration prompt and can replan — which re-books the plan."**

**"The important idea underneath: it's event-sourced. Nothing mutable is stored. Home, the week view, the roadmap, the projection — all of them are derived by replaying about eighteen kinds of event. That's why the views can never disagree with what actually happened."**

**"And those four screens at the bottom are exactly what I'm about to show you live."**

*Transition:* **"Quick word on the stack, then we go into the app."**

## Slide 11 — Technologies · 0:40

**"React 19 and TypeScript on the front, with Dexie over IndexedDB for local-first storage. FastAPI and Python 3.12 for the intelligence service. Supabase for auth, database, and storage; deployed on Vercel."**

**"The one-line justification: local-first for an offline core loop, a thin Python service *only* where a model must fit history, and a single monorepo so the evaluated code is the shipped code."**

## Slide 12 — Project Progress · 0:45

**"Phase-1 is essentially done — about 92%. The report is submitted, the app is live, and the evaluation is complete across all four components. The remaining slivers are the deferred refinements."**

**"On the timeline: literature, the engines and service, and the evaluation are behind me — you are here, at the Phase-1 ESA. Phase-2 starts August 1st, with its own ESA in the September–October window."**

*Transition — build energy:* **"Rather than describe it further, let me show you the loop working."**

## Slide 13 — Demo intro · 0:25

**"I'll walk the full loop: onboarding to a generated plan, the roadmap, a study session, and then the payoff — the finish date re-projecting right after that session. Watch the fourth step."**

*Now switch screen-share to the app. Have it already open and signed in to the seeded demo account (creds: `.work/specs/test-login-cred.txt`).*

---

## LIVE DEMO · 5:30  ⏱ *be back on slides by 17:35*

*Setup before the talk: app running, signed in, seeded demo roadmap present, browser zoom ~110% for a shared screen, notifications off, one clean tab.*

**Beat 1 — Onboarding → a generated plan (~1:15)**
- *Start a new plan (or show the pre-seeded one and describe onboarding briefly if time is tight).*
- **"Onboarding takes three inputs — a deadline, a weekly capacity, and your materials. I paste a link and it's classified — video, playlist, or article — and given a role."**
- **"And from just that, the engine lays out a full plan. Notice it doesn't pin a specific material to each day — it books capacity-sized study slots, and you pick the material when you sit down. That's the booking model from the redesign."**

**Beat 2 — Roadmap calendar (~1:00)**
- *Open `/roadmap`.*
- **"Here's the whole plan as a month of bookings, coloured by role. A booking's status — done, in progress, skipped — is derived from your logged sessions, not stored, so it always matches reality. And replanning is three levers: deadline, weekly hours, or drop materials — each shows its effect on the finish date before you commit."**

**Beat 3 — Study session (~1:15)**
- *Start a session; show the timer / Pomodoro / player briefly.*
- **"A session runs on a timer with optional Pomodoro intervals; a video plays inline and its position is tracked. When it ends, it records the minutes actually worked — and that's what feeds the pace estimate."**
- **⏩ Shortcut if behind:** *instead of running a full timer, use the manual Log form to record a session in ~10 seconds* — **"I'll log a session quickly here to show the effect."**

**Beat 4 — THE MOMENT · progress re-adapts (~1:30)**
- *Go to Home, then Week.*
- **"And here's the whole point. That one session I just logged — the calibrated pace updates, the burn-up redraws, and the projected finish date moves. The plan responded to what I actually did, not to what I planned on day one."**
- *Point at the finish-date / burn-up band explicitly. Let it land — this is the payoff.*

**Fallback if the demo won't load:** switch back to the deck — **slide 10's four stills** are the same screens; narrate Beat 4 from the Progress still. Don't troubleshoot live for more than ~15 s.

*Switch share back to the deck.*

---

## Slide 14 — References · 0:10

**"These are the core references — the base paper and one per family; the full twenty-one are in the dissertation."**

*Don't read them. One beat, move on.*

## Slide 15 — What's Next · Phase-2 · 1:20

**"Phase-2 closes the loop, and that's the real novelty. Right now the pace signal is self-reported study *time* — which is gameable. In Phase-2 I generate concept-tagged assessments from the learner's own material with an LLM, estimate genuine mastery with cold-start knowledge tracing, and feed *verified mastery* back into calibration. The plan starts responding to evidence of *learning*, not just time spent."**

**"Second — my guide's suggestion — live, LLM-guided practice sessions: coaching that watches your work and nudges, but never completes it. These two fit together neatly: assessments verify learning *after* a session; guided practice supports it *during* one."**

**"Then two follow-throughs: ship the split-conformal fix I already validated, and run a longitudinal, adaptive-versus-static study on real logged sessions."**

**"Timeline: Phase-2 starts August 1st, builds through September, ESA in the September-to-October window. Scope is prioritised — the verified-learning loop is the core deliverable; guided practice is exploratory."**

## Slide 16 — Thank you · 0:15

**"To sum up: Phase-1 is a working, adaptive, open-loop planner, with an honest, component-by-component evaluation of what improves on the baselines and what doesn't. Thank you — I'm happy to take questions."**

*Look at the camera. Stop talking. Let them ask.*

---

## Q&A prep — likely questions & crisp answers

**Q. Why synthetic data instead of real learners?**
A single learner can't give you *ground truth* — you can't measure detection latency or interval coverage without knowing the true pace and the true shift. The synthetic generator plants those, so the metrics are meaningful, and I calibrated it against OULAD so the regime is realistic. Validating on real logged sessions is exactly Phase-2.

**Q. Self-reported time is gameable — isn't your whole pace signal weak?**
Yes, and I say so. That's precisely why Phase-2 adds assessment-based *verified learning* and feeds mastery back into calibration. Phase-1 is the open-loop system; Phase-2 closes it.

**Q. CUSUM has the highest false-alarm rate in your table — why ship it?**
Because detection only raises a *human-confirmed* prompt, never an automatic replan. A false alarm costs the learner a dismissal; a late detection costs adaptation time. CUSUM is the fastest detector, and nothing beat the frontier, so fast-with-confirmation is the right trade for this design.

**Q. You admit the GP interval under-covers. Isn't that a real weakness?**
It is, and I report it rather than bury it. A cold-start composite already helps the low-data case, and I *validated* the fix for the data-rich case — split-conformal restores near-nominal coverage. I deferred shipping it to Phase-2, so past the cold-start threshold the interval is honest but under-covering. It's a known, scoped limitation.

**Q. Your DP scheduler won on drift but you didn't ship it — why?**
The day-by-day packing problem it solved was removed by the redesign. Rigid packing was brittle at day boundaries and fought continuous replanning, and the learner's real need isn't "which material on which exact day" — it's "am I on track, and what next." So I report it as an evaluated result that *informed a design decision*, not as the shipped scheduler.

**Q. The enriched calibrator lost on recovery error — why is it your pick?**
Recovery error is *retrospective*. The planner acts on the *prospective* next-session pace, especially when data is scarce. On that metric the shrinkage calibrator is a Holm-surviving win across every band and both regimes. I chose the metric the planner actually depends on.

**Q. How do you know the TS and Python engines agree?**
A golden-fixture harness: the TS engines emit reference inputs/outputs, and a Python test replays each and asserts numeric equality to 1e-6, with shared constants on both sides. The research harness imports the production Python engines, so the evaluated code is the shipped code.

**Q. Why local-first / event-sourcing?**
The core logging loop stays usable offline; each learner's data is isolated per-user; and deriving every view from an append-only log means the dashboards can't drift out of sync with what happened. Durability is a write-ahead queue plus periodic snapshots to cloud storage.

**Q. Cross-device — does everything sync?**
Plan events — creation, bookings, replans — sync through the queue. Extending the same cloud durability to the live *session* event stream is a Phase-2 hardening task; today those persist locally on the device that produced them. (Honest, and it's in the report.)

**Q. What's actually novel versus the Islam 2024 base paper?**
They do predict-then-optimise, solved once. I extend it into a *closed feedback loop* over a single learner's own logged behaviour, add capacity-based replanning, and — this is the part I'm proud of — evaluate each component honestly, reporting the nulls. Phase-2 adds the verified-learning loop.

**Q. LLM-guided practice — how is that different from Copilot, and won't it just give answers?**
It's guidance-only by design — Socratic nudges tied to the learner's own practice material, and it deliberately never completes the work. It's the *during-session* complement to the *after-session* verified-learning assessments.

**Q. Is Phase-2 realistic in ~3 months?**
Scope is prioritised. The verified-learning loop is the core deliverable; guided practice is explicitly exploratory; the conformal fix is small and already validated; and the longitudinal study runs in the background on my own logs. If something slips, it's the exploratory item, not the core.

**Q. Latency of the server calls / what if the service is down?**
Results return in a few seconds, and there's a stale-cache fallback — the last calibration is reused if the service is unreachable. The logging loop itself never depends on the network.

---

*Prep checklist: deck open + fullscreen · app signed in to the seeded demo · manual-log shortcut rehearsed · slide-10 stills ready as demo fallback · water · notifications off.*
