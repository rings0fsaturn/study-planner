# Prototype: Assessment Review and Feedback UX (#34)

**Task id:** `issue-34-assessment-review-prototype`
**Type:** wayfinder prototype ticket (HITL — destination is a clickable throwaway + a recorded recommendation)
**Tracker:** GitHub issue [#34](https://github.com/rings0fsaturn/study-planner/issues/34) on `rings0fsaturn/study-planner` (canonical) · local mirror `.work/specs/phase2-tickets/02-assessment-review-prototype.md`
**Parent:** implementation spec [#32](https://github.com/rings0fsaturn/study-planner/issues/32) · map [#4](https://github.com/rings0fsaturn/study-planner/issues/4)
**Downstream:** implementation ticket [#40](https://github.com/rings0fsaturn/study-planner/issues/40) (Assessment Review Implementation) — blocked by #39 + this prototype
**Plan status:** ✅ Complete — all phases done (P1–P3 2026-09-01, P4 2026-09-03); HITL recommendation recorded, #34 closed, map #4 appended

> This is an M.Tech **capstone**: build feature-rich and complete — no ship-fast / MVP / deferral tradeoffs.
> Prototype tickets carry execution into the map (destination override): the deliverable is a **clickable artifact** plus the **recorded recommended choice** for #40. The prototype is throwaway — nothing persists.

## TL;DR

Build a throwaway, clickable prototype of the **assessment review and feedback surface** at dev-only route `/study/assessment-review-prototype`. It shows, on contract-shaped mock data: a summary-led result view, compact responsive question navigation, per-family feedback treatments (objective / written / coding), citations, warnings, honest partial/processing/failed states, and per-question + whole-assessment retry with preserved attempt history. Two surface variants (A: progressive-disclosure drawer; B: persistent split-pane) are switchable via `?variant=`. The prototype never contains or renders hidden answers, rubrics, reference solutions, or hidden tests (acceptance criterion 4). It names the shared question-review primitives so #16/#40 can reuse them for Practice, without implementing Practice. It records the recommended variant and interaction choices for #40 in `research/decisions-34.md`.

## Acceptance criteria (from #34)

- [ ] The prototype covers summary, question navigation, objective feedback, written rubric feedback, coding test-case feedback, warnings, and partial states.
- [ ] The prototype covers per-question and whole-assessment retry while showing prior attempts remain preserved.
- [ ] The prototype is clickable at mobile and desktop widths and records the recommended choice for implementation.
- [ ] The prototype never displays hidden answers, rubrics, reference solutions, or hidden tests as client content.

## Context & background

### Decisions already locked — do not re-litigate

The surface was settled by map-4 ticket **#20 Assessment review / feedback surface** (resolved + closed 2026-08-11; gist on map #4):

1. **Summary-led, mistake-oriented** review — the outcome first, mistakes foregrounded.
2. **Compact responsive question navigation** — dots/numbers with status, efficient on mobile and desktop.
3. **Progressive disclosure** — detail (citations, explanations) expands on demand.
4. **Family-specific feedback treatments** — objective (correct/incorrect + per-skill), written (rubric + LLM explanation), coding (compile + per-test-case table).
5. **Expandable source evidence** — citations expand to chunk quotes.
6. **Per-question retry and full-assessment retry** — each retry is a fresh observation; prior attempts stay visible.
7. **Honest pending/partial/failed states** — the UI never implies grading finished when it did not.
8. **Equal question weighting with family breakdown** — the summary score is not skewed by family.
9. **Accessible state communication** — roles/labels, not color alone.
10. **Shared question-review primitives** — the same review components serve Practice (#16) later.

The map also fixes grading semantics the prototype must respect visually: every attempt reduces to `score ∈ [0,1]` + per-skill binary `correct` (≥ τ ≈ 0.6); retry = a fresh KT observation; hidden content stays server-only (map #10, #6).

### Live stack facts verified 2026-09-01 (trust these over older summaries)

- Prototype precedents to copy verbatim:
  - `apps/app/src/prototype/material-library/MaterialLibraryPrototype.tsx` — one tsx + one css, `?view=` state toolbar (`useSearchParams`), mock arrays in-file. (Its route was removed from `App.tsx` after #36 shipped — do not resurrect it.)
  - `apps/app/src/prototype/practice-guide/PracticeGuidePrototype.tsx` + `PrototypeSwitcher.tsx` — `?variant=A|B|C` switcher (arrow-key aware, `import.meta.env.DEV`-gated render), route registered under `import.meta.env.DEV &&` at `apps/app/src/App.tsx:103-107`.
  - `apps/app/src/prototype/roadmap-feedback/RoadmapFeedbackPrototype.tsx` — three variants + scenario state controls + driving note; route `App.tsx:109-111`.
- The production assessment slice from issue-38 (`apps/app/src/pages/assessments/AssessmentDetail.tsx`) renders only the single-objective **generation** result (polling, retry/resume, warnings). No graded-attempt review exists anywhere yet — this prototype invents that surface.
- Contract types are already mirrored client-side at `apps/app/src/assessments/types.ts` (Assessment, Question, Citation, Warning, format/status enums) — reuse those shapes for the mocks; do not invent new ones.
- Redaction precedent: issue-38 verified the live API carries no `answerBlock`/`correctIndex` anywhere (walk-the-JSON test); the prototype mocks must pass the same negative grep.
- Fixtures with liftable content: `services/intelligence/contracts/phase2/fixtures/generation-success.json` (MCQ stem/options/citations), `generation-partial.json` (truncated-length case), `written-grading.json` (score 0.75, rubric feedback, perSkill), `execution-pass.json` (compile not_run, runtime pass, score 1), `execution-compile-failure.json` (compile_error, score 0). Also `written-grading`/`guide-*` fixtures for explanation tone.
- Shared visual primitives (design-tokens `components.css`): `.field-group`, `.tag .tag-sm .tag-moss/.tag-rust/.tag-terracotta`, `.card .card-large`, `.banner .banner-body .banner-title/.banner-desc .banner-action-btn`, `.btn .btn-accent/.btn-secondary/.btn-ghost/.btn-destructive/.btn-sm`, `.chip`, `.choice`, `.progress` — all used by the material-library and production pages; reuse, do not redefine (rules 13/14).
- Route registration is inside `AppRoutes()` under `<BrowserRouter basename="/study">` — write the path **without** the prefix (rule 12).

## Decisions log

### D-01: Route + guard
**Status:** ✅ Agreed
**Decision:** One dev-only route `/assessment-review-prototype` registered in `App.tsx` behind `import.meta.env.DEV &&` (exact pattern of `App.tsx:103-107`). Path written without `/study`.
**Rationale:** Prototype must never reach production; mirrors both live prototype precedents.

### D-02: File layout — single component + single css + one fixture module
**Status:** ✅ Agreed
**Decision:** `apps/app/src/prototype/assessment-review/` with exactly three files: `AssessmentReviewPrototype.tsx`, `assessment-review.css`, `assessment-review-fixtures.ts` (mock data module). No provider, no client, no tests directory.
**Rationale:** Keeps the throwaway self-contained; fixture module isolates mock data from component logic so the HITL can see exactly what states exist.

### D-03: Two variants, not three
**Status:** ✅ Agreed
**Decision:** Variant **A** = progressive-disclosure drawer (summary band; question panel; expandable feedback/citations; retry inline). Variant **B** = persistent split-pane (summary + navigator rail left, question/feedback pane right on desktop; stacked with sticky navigator on mobile). Switchable via `?variant=A|B` using `PrototypeSwitcher` (reuse from `practice-guide/`; it supports any key list — pass `{A, B}` names).
**Rationale:** Ticket #20 already decided summary-led + progressive disclosure + compact navigator. The genuine open question is **surface arrangement** (drawer vs split-pane) and how retry/attempt history reads — two variants sharpen that choice without three-way noise.

### D-04: Mock data is contract-shaped, content-lifted
**Status:** ✅ Agreed
**Decision:** Five mock assessments typed as the live `Assessment` shape, covering every review state:
1. `ready` — 1 attempt, 3 questions (objective + written + coding mixed), score 0.67.
2. `partial` — 2 of 3 questions graded, one still processing; warnings `[citation_missing]` on a question; score so-far.
3. `processing` — all questions submitted, none graded yet (honest in-flight UI).
4. `failed` — safety_block warning, zero questions, Retry whole assessment enabled.
5. `retried` — 2 attempts preserved on one question (attempt #1 score 0.33, attempt #2 score 1.0) + a whole-assessment retry timeline.

Question content lifted from the phase-2 fixtures (generation-success/partial, written-grading, execution-pass/compile-failure) reshaped into `Question`/`QuestionGraded`/`PerSkillObservation` objects; citations carry real `chunkId` + quote strings.
**Rationale:** The mock renders the *future* surface; lifting real contract fixtures keeps the prototype honest to the approved vocabulary (AC: prototype consumes approved shapes, never redefines them — same rule #35 has for its vocabulary).

### D-05: Throwaway — no persistence, no events, no service calls
**Status:** ✅ Agreed
**Decision:** No Dexie writes, no new event kinds, no sync touches (rules 30/33), no API calls. Retry buttons mutate in-component state only (append an attempt to the local mock). Refresh resets to the seed state.
**Rationale:** Map destination override: prototypes are throwaway artifacts; issue-38's production slice owns the real retry path.

### D-06: Redaction is structural, not cosmetic
**Status:** ✅ Agreed (acceptance criterion 4)
**Decision:** The fixture module and component never contain the keys `answerBlock`, `correctIndex`, `referenceSolution`, `hiddenTest`, `rubricKey` — not even "hidden from the UI". Feedback copy shows only what the server would send in `QuestionGraded.publicFeedback`/`explanation`/`perSkill`.
**Rationale:** The prototype must not train the future #40 implementation to fake redaction by hiding fields it already shipped to the client.

### D-07: Retry semantics shown = contract semantics
**Status:** ✅ Agreed
**Decision:** Per-question Retry shows a **new attempt appended below the prior attempt** (attempt #N, timestamp, score, per-skill observations), never replacing history. Whole-assessment Retry opens a new attempt timeline header while the old timeline stays expandable. Copy uses the approved vocabulary (attempt, observation, fresh KT signal) without inventing new terms.
**Rationale:** Map #10: retry = fresh observation; preserved history is an AC. The prototype demonstrates the *shape* #40 must implement.

### D-08: Accessibility + locators
**Status:** ✅ Agreed
**Decision:** Question navigator = `role="tablist"`/buttons with `aria-current`; summary as headings + `<dl>`; per-skill observations as lists; warnings via `role="status"`/banner. No `.first()`-dependent or ambiguous locators (rule 11).
**Rationale:** #20 accessibility decision + rule 11; the prototype's DOM becomes the #40 test target.

### D-09: Evidence + recommendation record
**Status:** ✅ Agreed
**Decision:** Screenshots at 375×812 (mobile) and 1280×800 (desktop) for both variants into `plan/evidence/`. `research/decisions-34.md` gains a "Recommendation for #40" section filled only **after** the human picks (HITL rule — the agent never decides alone). The choice + rationale is then posted as the resolution comment on #34.
**Rationale:** AC3 (clickable at both widths + records the recommended choice); wayfinder resolution flow.

## Files-touched index (all under `apps/app/`)

| File | Change |
|---|---|
| `src/prototype/assessment-review/AssessmentReviewPrototype.tsx` | **new** — the prototype (variants A/B, state toolbar, retry interactions) |
| `src/prototype/assessment-review/assessment-review.css` | **new** — variant layout + review primitives styling |
| `src/prototype/assessment-review/assessment-review-fixtures.ts` | **new** — five contract-shaped mock assessments + attempts |
| `src/App.tsx` | add dev-only route `/assessment-review-prototype` behind `import.meta.env.DEV` |

Plus `.work/active/issue-34-assessment-review-prototype/plan/evidence/*.png` (screenshots) and `research/decisions-34.md` (recommendation record).

## Open questions

- None blocking. The HITL variant choice (A vs B) is the point of the prototype, not a blocker for building it.

## Out of scope

- Any production code change outside `src/prototype/` + the dev-only route.
- Practice (#16) reuse of the review primitives — the prototype only **names** the shared primitive (`QuestionReviewCard`) in comments/props.
- Real grading, real retry endpoints, answer-key reveal, assessment hub UI, attempts storage.
- Any API/GPU spend, any live E2E spec (throwaway).

## References

- Ticket: `gh issue view 34 --repo rings0fsaturn/study-planner` · mirror `.work/specs/phase2-tickets/02-assessment-review-prototype.md`
- Locked surface decisions: map #4 "Assessment feedback / review surface" gist (`.work/active/phase2-wayfinder/research/map-4.md`) + ticket #20 resolution
- Contract shapes: `services/intelligence/contracts/phase2/openapi.yaml` (Assessment, Question, QuestionGraded, PerSkillObservation) · `apps/app/src/assessments/types.ts`
- Fixtures: `services/intelligence/contracts/phase2/fixtures/{generation-success,generation-partial,written-grading,execution-pass,execution-compile-failure}.json`
- Precedents: `src/prototype/material-library/`, `src/prototype/practice-guide/`, `src/prototype/roadmap-feedback/`

---

# Prerequisite verification (run before Phase 1)

1. `git status --short` — leave unrelated worktree changes untouched (currently clean).
2. Dev-only route pattern compiles: `pnpm build` baseline already green in the tree.
3. Read the prototype precedents (material-library, practice-guide, roadmap-feedback) and the fixture files listed above before writing code.
4. If any check fails, STOP and surface — do not improvise around a broken build.

---

# Phase 1 — Skeleton + fixtures + dev-only route

**Goal:** The prototype mounts at `/study/assessment-review-prototype` and can show a state toolbar over five mock assessments.

## 1.1 `src/prototype/assessment-review/assessment-review-fixtures.ts`

- Export `interface MockAttempt { attemptId; questionId; attemptedAt; score; correct; grader; publicFeedback; perSkill: PerSkillObservation[] }` and `interface MockQuestion extends Question { attempts: MockAttempt[] }` (or a `review` view model — keep the public contract fields identical to `types.ts`).
- Export `MOCK_ASSESSMENTS: MockAssessment[]` covering the five states of D-04, content lifted from the fixtures. Include `warnings: Warning[]` with codes `citation_missing`, `grounding_stale`, `safety_block` where the state demands.
- Header comment: `// PROTOTYPE — throwaway. Assessment Review + Feedback UX for wayfinder #34. Answers: "how should graded results, rubric breakdowns, per-test-case tables, and per-question explanations render in the /assessments/:id review view?" Nothing persists.`

## 1.2 `src/prototype/assessment-review/AssessmentReviewPrototype.tsx`

- `useSearchParams` for `?state=` (the five states above) and `?variant=A|B`, exactly like `material-library` / `roadmap-feedback`.
- Header (eyebrow `Prototype · wayfinder #34 · throwaway`, title, one-line sub) + a **state toolbar** of the five states (mirror `ml-statebar`).
- A minimal placeholder body per state so the route is visibly alive; `PrototypeSwitcher` reused for A/B (`names={{ A: 'Drawer', B: 'Split-pane' }}`).
- No persistence, no events, no client calls (D-05).

## 1.3 `src/App.tsx`

- Import + register inside `AppRoutes()`: `{import.meta.env.DEV && (<Route path="/assessment-review-prototype" element={<AssessmentReviewPrototype />} />)}` next to the existing prototype routes (App.tsx:103-111).

## Verification

- `pnpm typecheck` — passes.
- `pnpm build` — `apps/app/dist/` produced; the route is **absent** from the production bundle (`grep -r "assessment-review-prototype" apps/app/dist/` must not match).
- `./full-app restart full` (rule 53: Vite does not watch `/mnt/d`), then load `http://localhost:5173/study/assessment-review-prototype?state=ready` — page renders, console clean.

---

# Phase 2 — Summary + question navigation

**Goal:** Summary-led, mistake-oriented review with compact responsive navigation (ticket #20 items 1–2, 8).

## 2.1 Summary band

- Verdict line (e.g. "3 of 5 questions correct · score 0.67"), **equal-weighting family breakdown** (objective / written / coding counts + scores), attempt label ("Attempt #2 of 2").
- Warnings rendered as a banner list (`role="status"`), each with `code` + `message` + optional `questionId` link into the navigator.

## 2.2 `QuestionNavigator`

- `role="tablist"` of numbered buttons: status icon per question (correct / incorrect / partial / processing / failed-retryable), `aria-current` for the active one, keyboard arrows.
- Desktop (variant B): a persistent rail. Mobile (both variants): a horizontally scrollable strip; sticky under the header.

## 2.3 Responsive behavior

- 375 px: stacked summary → navigator → question panel; no horizontal overflow.
- 1280 px: variant A keeps a single column max-width ~680 px with disclosure; variant B splits ~300 px rail + content.

## Verification

- Manual at 375×812 and 1280×800: summary reads first, navigator moves the question panel, `aria-current` tracks focus.
- `pnpm build` still green; no console errors.

---

# Phase 3 — Family feedback treatments + citations + honest states

**Goal:** The three family treatments, expandable evidence, and honest pending/partial/failed rendering (ticket #20 items 3–7; AC1).

## 3.1 Objective feedback

- Question prompt + options with the learner's pick marked; per-skill observations as a list (`skillTag`, `score`, `correct` badge); short explanation; **expandable citations** (chunkId + quote), mirroring the issue-38 detail page's citation treatment.

## 3.2 Written feedback

- Rubric criteria list (criteria label + met/partial/not-met + criteria score) + LLM explanation paragraph (tone from `written-grading.json` publicFeedback) + perSkill + citations.

## 3.3 Coding feedback

- Compile status row (passed / compile_error with stderr excerpt) + per-test-case table (case name, expected vs actual, pass/fail) from `execution-*.json` shapes; runtime duration shown.

## 3.4 Honest states

- `processing`: per-question skeleton rows ("Grading…") with `aria-busy`; summary shows "X of Y graded".
- `partial`: graded questions fully reviewable, the ungraded one shown as pending; the `citation_missing` warning links into it.
- `failed`: no questions; warnings explain; whole-assessment Retry enabled.
- A `grounding_stale` banner variant on the ready state ("Material was replaced — regenerate before trusting new questions").

## 3.5 Redaction guard

- After implementation: `grep -rniE "answerBlock|correctIndex|referenceSolution|hiddenTest" src/prototype/assessment-review/` must return nothing (D-06).

## Verification

- All five states clickable through the toolbar; every warning code renders; expandable citations open/close; no hidden-content keys anywhere (3.5).

---

# Phase 4 — Retry + attempt history + recommendation record

**Goal:** Per-question and whole-assessment retry with preserved attempts (AC2), then the HITL choice and the record (AC3).

## 4.1 Per-question retry

- On a graded question, "Retry question" appends a fresh `MockAttempt` (new `attemptId`, `attemptedAt` = now, blank/queued feedback) below the prior attempt; the prior attempt stays fully expanded-able with its score. State copy: "New attempt queued — previous attempt kept (Attempt #1 · score 0.33)". Mutates in-component state only.

## 4.2 Whole-assessment retry

- In the summary band, "Retry assessment" starts a new attempt timeline (header "Attempt #2 — started 14:32"), leaving the prior timeline collapsed but present. Fresh questions re-render from the seed mocks; nothing persists.

## 4.3 Evidence + record

- Screenshot both variants at 375×812 and 1280×800 into `plan/evidence/` (desktop + mobile, one image per variant per viewport, named e.g. `variant-a-desktop.png`).
- **Grill the human** (wayfinder HITL): walk the two variants, ask which arrangement + which retry/attempt-history presentation to recommend; record the answer in `research/decisions-34.md` → "Recommendation for #40" (variant, rationale, interaction notes, any copy corrections).
- Post the resolution comment on #34 (recommendation + link to evidence + the decisions doc), close the ticket, and append the map #4 "Decisions so far" line (per wayfinder resolution flow).

## Verification

- Both retry flows work at both widths; attempt history preserved visibly; screenshots exist; decision recorded; #34 closed with the map pointer appended.

---

# Final verification (whole plan)

Run in order, smallest first:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build` — dist produced; production bundle contains no `assessment-review-prototype` route.
4. `grep -rniE "answerBlock|correctIndex|referenceSolution|hiddenTest" apps/app/src/prototype/assessment-review/` — empty (redaction AC4).
5. Manual browser pass (rule 10 workflow): restart `./full-app restart full`, open the dev-only route, exercise all five states × both variants at 375×812 and 1280×800; zero console errors; screenshots saved to `plan/evidence/`.
6. `research/decisions-34.md` holds the HITL-recorded recommendation; #34 closed on GitHub; map #4 Decisions-so-far appended.
7. Update this plan's status line and `plan/VERIFICATION.md` in the same session as the work (AGENTS.md rule).

Do not skip phases; if reality contradicts a step, STOP and surface rather than improvising.