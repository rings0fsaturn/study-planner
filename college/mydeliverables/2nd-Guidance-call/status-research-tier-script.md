# Speaker Script — Research-tier Status (2nd Guidance Call)

*Read one numbered point at a time. Simple words. ~5–6 minutes total.*

---

## Slide 1 — Where the research tier stands today

1. I am Rohit. My project is an app that builds a study plan and keeps fixing it as you go.
2. Today is just a status update — what is done, what data I now have, and what is left.
3. Look at the three boxes: 7 of 8 parts are done, both datasets I needed are now in hand, and 2 parts are still left.
4. The data problem from last time is now sorted. I will walk you through it and confirm one thing at the end.

---

## Slide 2 — The system we are building

1. This one picture shows the whole system.
2. On the left, the learner uses the app. It saves the data on the device and syncs it to the cloud.
3. In the middle is a service that runs all the smart parts.
4. The top row is Pillar A — four steps: learn the pace, spot a change, guess the finish date, and make the plan. These are built.
5. The bottom row is Pillar B — make questions, grade them, and track what the learner knows. That is the next phase.
6. The gold dashed line is the big new idea: check real learning, then fix the plan. I am saving that for Phase II.
7. The green box at the bottom is the offline research. That is the part this status is about.

---

## Slide 3 — Built vs pending

1. This table puts a clear label on every part of that picture.
2. Green means built. Pillar A and the data generator are fully done.
3. Amber means the machine works, but the numbers are still fake for now. The good news: I now have the real data, so I just need to re-run it.
4. Teal means Phase II — designed, but not built yet. That is the question-making and the closed loop.
5. Grey means not started — checking it on my own data, and writing it all into the report.

---

## Slide 4 — Pillar A results

1. This is the strong part I can show today, and it has real numbers.
2. The data: I made 720 fake learners whose true pace I already know, so I can check who is right. Six learner types, three journey lengths, and all settings locked before testing.
3. I ran four contests — one per skill — and let several methods compete in each, including the one already in the app.
4. Pace learning: the Bayesian method clearly won — about three times less error than the simple averages, and the gap is statistically solid.
5. Spotting change: a trade-off — one method spots changes fastest, the other raises fewer false alarms. No single winner; it depends what you want.
6. Finish-date guess: the Gaussian-process method had the smallest date error, but every method's confidence range came out too narrow — that is the one weak spot to fix.
7. Scheduling: the DP method held up best as the plan got complex; the current greedy one drifted badly — about a month off — on the hardest mixes.
8. To test it harder next: run it on real data (my own sessions plus a public benchmark), widen the stress-test grid, fix the confidence-range issue, and try held-out learner types.

---

## Slide 5 — Pillar B: data secured, numbers next

1. Last time, the Pillar B machine was built but had no real data to run on. That is now fixed — I have both datasets.
2. First dataset is Eedi (the NeurIPS-2020 set). These are real multiple-choice answers — about 1.4 million of them — in the exact format my tool needs. It also has topic tags, so I can track learning per concept.
3. Second dataset is ACcoding. The old coding dataset (POJ) was dead, so I am using this one instead. It is bigger: about 4 million coding submissions from 27,000 students on 4,500 tasks, with 100 topic tags.
4. ACcoding plugs straight into my format: who submitted, which problem, and whether the judge accepted it.
5. One small catch: ACcoding does not store the submit time. I use the row id instead, since it already counts up in submission order. And "Accepted" means correct; everything else means wrong.
6. So the ask is simple: are you okay with Eedi for the multiple-choice side and ACcoding for the coding side, in place of the dead POJ?
7. Next step is to plug both in and re-run, so the fake numbers become real ones.

---

## Slide 6 — What's pending: path to the final review

1. The data is now in hand, so the first job is quick: plug Eedi and ACcoding in and re-run, and the fake numbers turn into real ones.
2. After that, two parts are left.
3. Phase 5: run my own study sessions through the system as a real-life check. I should start logging now, so I have enough by the final review.
4. Phase 6: put all the charts and tables into the report and make sure it rebuilds cleanly with no errors.
5. Bottom line: the method, the pipeline, and now the data are all ready. Only the re-run and the final write-up stand between here and the last review.
