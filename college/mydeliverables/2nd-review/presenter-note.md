# Supporting Note — Second Review (what to say on each slide)

*Read one point at a time. Simple words. Aim for ~6–7 minutes. You don't need to memorise — these are reminders.*

---

## The one-line story (say this if you forget everything else)

> "I made the app's pace guess much sharper, I proved it works, and it is already running live in the app. One feature didn't pan out, and I'm being honest about that."

---

## Slide 1 — Second Review: Progress So Far

1. "I'm Rohit. My project is an app that builds a study plan and keeps fixing it as you learn."
2. "Today is a status update — what I finished, what's live, and what's left."
3. Keep it short. Move to slide 2.

---

## Slide 2 — Teaching the Plan to Read Pace Better

1. "The app has to guess how fast you learn, so it can plan the right amount of work."
2. "The **old way** just averaged your last few sessions. Easy, but one odd day threw it off."
3. "The **new way** learns your usual pace and leans on it when a day looks strange — so one bad session doesn't wreck the plan."
4. "It's about **three times** better at reading pace."
5. "And this isn't luck — I tested it across many learner types and plan lengths, and it held up every time."

*If asked "how did you test it?":* "Hundreds of made-up learners whose real pace I already knew, so I could check who got closest. Same test settings locked before I ran it."

### Old way vs New way — explained (in case they dig in)

**What both do:** guess your "pace" — how much of a planned session you actually finish. The app uses that to size your plan and predict your finish date.

**Old way (what's been live):** looks at all your past sessions, takes your average finish ratio, and gives **one number**. It ignores the details of the next session — so a tough practice set on a tired Sunday night and an easy review on a fresh Monday morning get the **same** guess. Steady and safe, but blind to the situation.

**New way:** guesses a pace **for that exact next session**, using what it knows about it:

| It now looks at… | Plain meaning |
|---|---|
| anchor / practice | what *kind* of material it is |
| morning / evening / weekend | *when* you're studying |
| same-day extra | is this a second session today |
| planned progress | how far through the plan you are |
| deadline urgency | how close the deadline is |
| recency | how you've been doing lately |

Plus one safety trick called **"shrinkage"**: when you've logged only a few sessions, it leans on how learners *generally* behave; as you log more, it trusts *your own* pattern more. That stops it jumping to silly conclusions from one or two sessions.

**Say it as an analogy:**
- *Old:* "You usually finish about 80% of what you plan, so I'll assume 80% every time."
- *New:* "On a weekday morning doing practice near your deadline you push to ~95%; on a tired weekend evening it's more like 60% — so I'll plan for the real situation. And since I've only seen you a few times, I'll blend your pattern with what similar learners do."

**Why this is the headline:** the simple old way was surprisingly hard to beat — fancier methods kept *overfitting* (memorising noise) and failing the strict test. The new method is the **one** that genuinely beat it and held up, *because* the shrinkage trick stops it overfitting.

---

## Slide 3 — Spotting Pace Shifts: What I Found

1. "I also tried to **auto-detect** the moment your pace suddenly changes."
2. "I tested several ways. Walk through the table simply:"
   - **Running tally** — barely any false alarms, but slow to react.
   - **Quick spotter** — reacts fast, but cries wolf too often.
   - **Recent-vs-earlier** — compares now to before, but needs a lot of data and lags.
   - **Watch-the-misses** — flags when guesses go wrong, but only as good as the guess.
   - **Combine them all** — I hoped for the best of each; it was more complex but no better.
3. "**Bottom line:** none was reliably better than the simple tally. And on real, messy data, the change was almost impossible to catch."
4. "So I'm reporting that honestly and **not shipping** auto-detection yet."

*Why say it this way:* honest negative results show good research judgement. Don't sound apologetic — you did the work and made the right call.

---

## Slide 4 — Putting the Research to Work

1. "This isn't research sitting in a notebook. The new pace method is **live in the app**, end to end."
2. Trace the three boxes: "You log a session → it goes to a service that runs the new method → it sends back a **sharper read of your pace**."
3. "And it's built for the real world: only **your account** can ask (login security), it **retries** if the internet is flaky, and it **works offline** by showing your last known plan."
4. **Be honest about the finish date.** "Right now this sharper pace powers the *‘review your plan’ nudge*. The on-screen *finish date* is still worked out from my logged-hours trend, not yet from this new method — wiring those together is the next step."

*If asked "where's the finish date?":* "There's a 'Projected finish' card on Home, but it only shows once there's enough data to project — and it's currently driven by the hours trend, not the new pace method. Connecting the two is on my next-steps list."

*If asked "is this deployed for real users?":* "Not on public hosting yet — that's a later step. But the whole pipeline runs and is tested."

### If they point at the architecture: the four Pillar-A methods

The architecture shows four boxes — Pace Calibration, Change Detection, Progress Projection, Schedule Generator. **All four are built and running in the app, and the research tested all four.** The difference is *which one I rebuilt this phase*:

| Method | What the research did | Where it runs now |
|---|---|---|
| **Pace Calibration** | **Improved it** — new method clearly won | New method, **through the smart service** |
| **Change Detection** | Tested many ways → no clear winner (the honest null) | Original simple version, in the app |
| **Progress Projection** | Hardened it (fixed the confidence-range issue) | Original version, in the app |
| **Schedule Generator** | Hardened it (the DP method held up best) | Original version, in the app |

**Say it simply:** "All four work. This phase I focused on the pace one — I improved it and moved it into the service. The other three I tested and tightened, but didn't need to rebuild — detection had no clear winner, and the other two were already good, just confirmed under stricter testing."

*Why only one went through the service:* it was the only one with a genuinely better method worth shipping. The rest stay where they are by design (decision D-03 in the integration plan).

---

## Slide 5 — The App Today

1. "Most of Phase 1 already works." Point at the green list — sign-in, logging sessions, cloud sync, the setup wizard (which builds your plan), live sessions, pace tracking with a "you're drifting" prompt, and settings.
2. "A few pieces are left." Point at the amber list:
   - **Roadmap page (view your plan)** — not started ("coming soon").
   - **Re-plan flow (adjust the plan)** — not started.
   - **Weekly progress view** — partly built, needs finishing.
   - **Install to home screen** — not started.
   - **Basic analytics** — to confirm.
   - **Go live on real hosting** — later.

*Be honest if asked about re-planning:* "Today the app **spots** when your pace changes and prompts you — you can acknowledge it or mark a session as unusual. The full re-plan (move the deadline, add hours, or trim scope) and the Roadmap page to view your plan are **next to build**."

---

## Slide 6 — What's Next, and When

1. "Three steps to the finish line."
2. **By next guidance call:** test the method on **my own** real study sessions, and finish the weekly view.
3. **By final Phase-1 review:** build the Roadmap page + re-plan flow, put the real numbers and figures into the report, write the full comparison, add home-screen install and analytics.
4. **Later:** go live on real hosting with proper login security.

---

## Slide 7 — Closing Thoughts

1. "To sum up: a real research win, it's already in the app, and I'm honest about what didn't work."
2. "What I'd like from you: a quick okay on this timeline, and any steer on what you'd most want to see in the final demo."

---

## Likely questions — short answers

- **"Why three times better — what does that number mean?"** "It's the error in the pace guess. The new method's error is about a third of the old one's, on average."
- **"Why didn't change-detection work?"** "The real signal is weak and noisy. Every method either missed real changes or raised too many false alarms. None won clearly, so shipping it would add risk for no gain."
- **"Is the app finished?"** "Core is done and working — sign-in, logging, sync, setup, live sessions, pace tracking. Left for Phase 1: the Roadmap page, the re-plan flow, finishing the weekly view, home-screen install, and analytics. Live hosting is after that."
- **"What's the difference between research and the app here?"** "Research = testing which method is best, offline. The app = the winning method actually running for a user."
- **"What will the final review show?"** "The full written comparison with real numbers, the report figures, and a working demo."

---

## Quick word-swaps (keep it plain if you blank out)

| If you start to say… | Say instead |
|---|---|
| "calibration" | "the pace guess" |
| "Bayesian / partial-pooling" | "leans on your usual pace" |
| "change detection" | "spotting a sudden pace change" |
| "null result" | "it didn't pan out" |
| "deployed / production" | "live in the app" |
