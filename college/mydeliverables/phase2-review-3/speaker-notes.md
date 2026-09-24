# Speaker Notes: Phase 2 Review-3

Companion to `phase2-review3-deck.html`. Read these before the review.
Slides 1 to 10 are spoken, about 9 minutes total. Slide 11 stays hidden
until a question needs detail.

## How to use these notes

- Speak the lines in the "Say" blocks. Add your own words around them.
- Golden rule: analogy first, number second, meaning third.
- Never say a bare score without its everyday translation.
- If you do not know the answer to a question, say so and offer to
  follow up. Do not guess.

## One-breath summary of the project

> A study planner that reads your own textbooks, writes practice
> questions from them, grades your answers, and tracks whether you are
> on schedule.

Use this line if the guide asks "remind me what this is".

---

## Slide 1: Title (about 30 seconds)

Say:

- "At Review 2 the whole content half ran: a book became searchable
  material."
- "In these three weeks the assessment half arrived. The app now writes
  a question from your own book, you answer it, the server grades it,
  and the review screen shows the result."
- "Today I will show the loop, the numbers, the defects we found, and
  the plan for the next three weeks."

If they ask what "the loop" means:

- "Five steps: choose a chapter, generate a question, answer it, get a
  grade, and read the feedback."

---

## Slide 2: Three weeks in review (about 60 seconds)

Say:

- "Left side: work on the assessment half. Objective generation went
  live on 23 August. The guide chose the review layout in the prototype
  session on 3 September. The written contract was frozen the same day."
- "Right side: the loop closed. On 9 September you could take an
  assessment and get an objective grade, and the review screen shipped.
  On 11 September written answers graded against a rubric. The same day
  the questions became scoped to a chapter, and the PDF viewer
  arrived."
- "Yesterday and today we added roadmap attachment. Five tickets closed
  since Review 2, about forty commits."

---

## Slide 3: The loop end to end (about 70 seconds)

Say:

- "This is the shape of the product now."
- "Choose. You pick a material and a chapter, or a page range."
- "Generate. The system finds the right passages and writes one
  question from them."
- "Take. You answer in the app."
- "Grade. The server grades the answer. Objective answers grade in
  code. Written answers grade against a rubric."
- "Review. You see the score, the explanation, the citations, and you
  can retry."
- "The last step, mastery, is reserved. That arrives with ticket 43."
- "Three rules hold the loop together. One question is the unit. The
  server grades, so the answer key never reaches the browser. Every
  question cites real passages of your own book."

---

## Slide 4: The Review-2 promise, kept (about 70 seconds)

Say:

- "At Review 2 I set the success test for today: generated objective
  questions, grounded in retrieved passages, served by our own
  endpoint, and checked by the same harness we used in the probe."
- "That test is met, and the loop around it is met too."
- "Generate arrived on 23 August. Take and grade arrived on 9
  September. Review arrived on 9 September."
- "The live checks: taking 2 of 2 scenarios, review 4 of 4, at desktop
  and mobile. The redaction check found no answer key in the browser."
- "The test suites grew with the work: the app from 699 to 787 tests,
  the service from 391 to 503."

If they ask what "redaction" means:

- "The check that the answer key and the rubric never travel to the
  browser. We grep the rendered page, not the code."
---

## Slide 5: Written answers and the rubric (about 70 seconds)

Say:

- "An objective answer is right or wrong. A written answer is not, so
  we needed a fair way to grade it."
- "Think of a marker with a marking scheme. The model writes the
  marking scheme with the question: two to six criteria, each with a
  weight."
- "The model scores each criterion. The server multiplies each score by
  its weight and composes one score from 0 to 1."
- "A score of 0.6 or more marks the skill correct. That is the same
  line the objective arm uses, so the two kinds of result stay
  comparable."
- "The learner sees the criterion, its weight, its score and its
  feedback. The reference answer stays on the server."
- "The live pass ran 4 of 4 scenarios in 4.3 minutes with real grades."

If they ask about a wrong grade:

- "The server does not trust the model's own pass or fail flag. It
  derives the verdict from the score, so the summary can never disagree
  with the detail."
---

## Slide 6: The defect that mattered most (about 90 seconds)

Say:

- "This is the most useful thing we found in three weeks."
- "The learner reported that every question was about the examination,
  not the book."
- "We measured it: 25 of 25 generated questions asked about the exam or
  the document. Five of five retrieved passages were the cover, the
  contents page or the index. Only 8.5 percent of the book is exam
  material."
- "The cause was simple. The search query was the book title. The title
  matches the cover and the contents page, so those passages won the
  search, and the model had nothing else to write about."
- "Three changes fixed it. The title left the query. The prompt now
  forbids questions about the document. The learner chooses a chapter
  or a page range, and pages travel with the text from the first read
  to the final search."
- "The result is live: a Chapter 5 scope keeps every citation inside
  PDF pages 156 to 213."
- "The same work brought the viewer: 572 pages in one scroll, with fit
  and zoom, so the learner can read the page numbers they choose."

If they ask how the chapter list is built:

- "The system reads the printed contents page at upload time. It found
  all 16 chapters of the accounting book. Bookmarks come first when a
  book has them."
---

## Slide 7: Four defects the live passes found (about 70 seconds)

Say:

- "Two of these came from real provider runs, one came from the
  learner's own material, and one was a fault in our own test."
- "One: a failed written generation retried as an objective question.
  The retry read the question family from the first question, and a
  failed generation has no questions. The server now returns the stored
  recipe."
- "Two: the model cited a chunk that does not exist. Five of fourteen
  written generations failed on that, four in a row with the same
  invented identity. The schema now binds the citation to the passages
  we supplied, so the model cannot invent one."
- "Three: every diagram disappeared from the viewer, and no test
  noticed. The image decoder is a separate module, and we never pointed
  pdf.js at it. The images dropped with a quiet console warning while
  the text stayed. The app now serves the decoder."
- "Four: our desk test was not a desk test. One setting applied to
  every test in the file, so a desktop scenario ran at phone width for
  a whole phase. We corrected the test and the claim."
- "Each defect now has a check that fails if it comes back."

If they ask why we did not catch these sooner:

- "Unit tests use our own stand-in for the model. Real providers
  misbehave in ways a stand-in does not."
---

## Slide 8: Where we stand (about 70 seconds)

Say:

- "The honest picture."
- "Delivered and verified: objective generation, taking, objective
  grading, the review screen, the written path with rubric grading, the
  review prototype, and the scoped generation with the viewer."
- "Still ahead: coding assessments with a sandbox, the mastery signal
  and adaptive difficulty, the practice runs with the guided hints,
  roadmap feedback, the quality harness, and the Assessments and
  Practice hubs."
- "Assessments open from the material page today. The two hub screens
  come with the next slice."
- "Two open items I want to name. The practice screen configures a run
  and stops there. The viewer still downloads the whole file on open,
  about 23 megabytes, and the streaming fix is planned."
If they ask whether the writing is done:

- "The written slice is code-complete and live-tested. Closing the
  ticket and the records is a short piece of work, not new building."

---

## Slide 9: Live demo (about 120 seconds)

Say:

- "Let me show the loop on the accounting book."
- "I open the material. The chapter list comes from its contents page."
- "I pick Chapter 5 and generate a question."
- "The citations under the question point inside Chapter 5. That is
  the fix from the last slide."
- "I answer it. The server grades it."
- "The review shows the score, the explanation and the citations. I
  retry one question, and both attempts stay in the history."
- "Now a written question. I answer in the text box, and the rubric
  breakdown shows each criterion."
- "Finally the viewer: 572 pages, fit and zoom, and a jump to any
  chapter."

If the demo fails:

- "Say so, show the recorded evidence, and move on. Do not debug live."
---

## Slide 10: Next three weeks (about 60 seconds)

Say:

- "Three steps, in order."
- "First, close the open work: the written ticket, the viewer rounds,
  and roadmap attachment."
- "Second, coding assessments: a self-hosted sandbox, four coding
  question formats, and per-test feedback."
- "Third, mastery and adaptive difficulty: every grade becomes a
  mastery signal, and the next question aims just above the learner."
- "Success at Review 4 looks like this: one full practice run, from a
  generated question to a mastery update, with hints that never hand
  over the answer."
---

## Slide 11: Appendix (do not present. Use for questions.)

Use only if a question needs detail:

- "The left table holds every live run with its viewport."
- "The right table holds the measurements behind the scoping fix, plus
  the retrieval score we held from Review 2."

Tip:

- Do not read this slide aloud. Open it, point at one row, answer, and
  move on.

---

## If the guide asks for one sentence of overall status

> "The content half turned books into searchable material. In these
> three weeks the assessment half arrived: the app writes questions
> from the learner's own book, the server grades the answers, and the
> review screen shows the result with a retry path. Coding assessments
> and the mastery loop come next."
