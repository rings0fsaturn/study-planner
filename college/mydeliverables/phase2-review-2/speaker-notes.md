# Speaker Notes: Phase 2 Review-2

Companion to `phase2-review2-deck.html`. Read these before the review.
Slides 1 through 8 are spoken, about 8 minutes total. Slide 9 stays
hidden until a question needs detail.

## How to use these notes

- Speak the lines in the "Say" blocks. Add your own words around them.
- Golden rule: analogy first, number second, meaning third.
- Never say a bare score without its everyday translation.
- If you do not know the answer to a question, say so and offer to
  follow up. Do not guess.

## One-breath summary of the project

> A study planner that reads your own textbooks, turns them into
> practice questions, and tracks whether you are on schedule.

Use this line if the guide asks "remind me what this is".

---

## Slide 1: Title (about 30 seconds)

Say:

- "At Review 1 I showed the plan on paper: contracts and designs."
- "In these two weeks, the first half of the system now actually runs."
- "Today I will show what got built, what went wrong, what we
  measured, and what comes next."

If they ask why the title:

- "A contract pack is an agreement on paper. A pipeline is the moving
  belt that turns a raw book into searchable study material."

---

## Slide 2: Two weeks in review (about 60 seconds)

Say:

- "Left side, week one: we closed the last design choices and shipped
  two features: the study-material library and the system that reads
  books."
- "Midweek, a full-book run failed. The outside AI service limits how
  fast you may send data. We added a speed limiter and a way to
  continue from where it stopped."
- "Right side, week two: we moved the heavy work onto the graphics
  chip inside my own machine, about 56 times faster. The whole product
  starts with one command. We also auditioned the AI question-writer
  and chose DeepSeek for that job."

If they ask what "shipped" means:

- "It works in the real app, tested end to end. Not just a demo on my
  screen."

---

## Slide 3: Content pipeline (about 60 seconds)

Say:

- "Think of a library receiving a brand-new textbook."
- "Upload: we hand the book over."
- "Extract: the computer reads every page."
- "Chunk: it splits the text into small paragraphs."
- "Embed: for each paragraph it writes an index card that captures the
  meaning in numbers."
- "Validate: it counts everything and checks ownership."
- "Ready: the book is now searchable."
- "We did this with a real 572-page accounting textbook. It became 754
  cards. All 754 were made. None missing. Status shows ready."
- "Every step writes a diary entry: 67 entries for this one job. Those
  diaries are how we caught problems."

If they ask what "embed" means:

- "It is a recipe card: it turns the meaning of a paragraph into a
  long list of numbers, so the computer can compare meanings."

---

## Slide 4: Retrieval today (about 90 seconds)

Say:

- "Once the book is indexed, the student asks a question. The system
  must find the right paragraph. We tested it like an exam: 30 real
  questions, and we know the correct paragraph for each one."
- "Three simple scores. First result correct: 18 of 30 questions.
  Answer inside the top three results: 24 of 30, after we combined two
  search methods. On average, the right answer lands near second
  place."
- "Combining ordinary keyword search with meaning search gave a small
  honest improvement."
- "One caution: we have an extra re-ranking tool that did well in
  older tests. It needs re-testing on today's data. It is queued, not
  claimed."

If they ask "is 24 of 30 good":

- "For a student, seeing the right passage among the first three
  results is enough to study from. The misses are mostly list-type
  passages, and we logged exactly which questions fail and why."

---

## Slide 5: Local GPU (about 60 seconds)

Say:

- "Preparing the cards used to run on the computer's main processor:
  about 10 minutes per book. Now it runs on the graphics card, the
  chip normally used for games: about 10 seconds. Roughly 56 times
  faster."
- "Quality did not drop. Same book, same rankings, checked question by
  question: 29 of 30 matched."
- "No internet limits. Everything runs locally, free."
- "Three housekeeping points. We switch the graphics engine on only
  when needed, because it wastes power while idle. We tuned the batch
  size. Every material records which engine made its cards, so results
  never get mixed up."

If they ask why we do not leave it running:

- "The chip burns electricity even when idle. So we start it for work
  and stop it after. The work itself is still seconds."

---

## Slide 6: Generation probe (about 90 seconds)

Say:

- "Before letting AI write practice questions inside the app, we
  auditioned it: 395 trial questions, total cost about 17 cents."
- "We graded the AI itself. Format: nearly all questions came out in
  exactly the shape our storage needs. Honesty: the references on each
  question point to passages that truly exist in the book.
  Originality: ideas are reworded, almost nothing copied word for
  word. No duplicate questions."
- "One clear finding: when we asked the model to think harder, answers
  got much slower, sometimes past two minutes, with no improvement. So
  we keep that switched off."
- "Decisions: DeepSeek writes the questions. Gemini stays only as a
  backup for the index cards. And we never trust the provider's
  promises alone: we re-check every answer's format ourselves."

If they ask what "format" means:

- "Our storage needs each question in a fixed shape: stem, options,
  correct answer, difficulty, and which passages it came from. Like a
  form with named fields."

---

## Slide 7: Honest status (about 90 seconds)

Say:

- "At Review 1 I promised a full practice loop in two weeks. Here is
  the honest picture."
- "Delivered: the whole content half. Library, ingestion, measured
  search, local acceleration, search behind login."
- "Not yet: the assessment half. The app cannot yet generate questions
  by itself, run practice sessions, grade answers, or adapt
  difficulty. That is exactly the next slice."
- "Three things went wrong, and we fixed all three."
- "One: the outside AI service said too fast and refused our book. We
  added a speed limiter and save-points, like autosave in a game. A
  failed run now continues instead of restarting."
- "Two: search quality suddenly dropped to half. Two parts of the
  search converted meaning in two different ways, so they could not
  recognize each other's results. Both now use the same method."
- "Three: we asked the AI to answer in a strict fill-in-the-blanks
  form. Twice it returned a different shape. So we now re-check every
  answer ourselves before storing it. Trust, but verify."
- "Close: the content half is built, measured, and hardened. The
  assessment half starts today."

If they ask why we show failures:

- "A review is the right place for honest status. Showing only wins
  would hide the work that made the wins possible."

---

## Slide 8: Next two weeks (about 60 seconds)

Say:

- "Three steps, in order."
- "First, choose the settings for the question writer on paper."
- "Second, update our written agreement so it works with any AI
  provider, not just one company."
- "Third, build the question generator inside the app."
- "Success at Review 3 looks like this: questions created from your
  own textbook, served by our own system, checked by the same grading
  tool we used in the audition."

If they ask why we decide before coding:

- "Changing a decision on paper costs an hour. Changing it after
  building costs weeks."

---

## Slide 9: Appendix (do not present. Use for questions.)

Use only if a question needs detail:

- "This page holds the full scorecards."
- Left table: every search score, including the fifth-passage column
  and the live-system test.
- Right tables: the audition results for each thinking level. Point at
  the highlighted rows: "Thinking off: fast and clean. Thinking high:
  slow, over time limit."

Tip:

- Do not read this slide aloud. Open it, point at one row, answer,
  move on.

---

## If the guide asks for one sentence of overall status

> "The system can now take a real textbook, prepare it for search on
> my own machine, find the right passages for practice questions, and
> the AI question-writer has passed its audition. The next slice
> connects the question-writer to the app."