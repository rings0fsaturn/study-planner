# MTech Project Grill Session — 8 May 2026

## Context

Rohit is building Study Tracker Web as his MTech final year project for PES University's M.Tech in Data Science & AI programme (with Great Learning). The project is a mobile-first responsive web app for self-directed learners featuring sophisticated statistical/ML engines. The grill session stress-tested how to position this project for academic evaluation.

**Current state:** Phase I — not started. Maximum runway to frame correctly.

---

## Part 1: Engine Deep-Dive (Pre-Grill Research)

Before the grill, we explored all four engines in depth:

### Engine 1: Roadmap Engine (`packages/roadmap-engine/`)

**Role:** Pure algorithm that turns study goals into a concrete week-by-week schedule.

**Input:** `RoadmapInput` — materials (title, duration, role), weeks, start date, study days, weekday/weekend hours.

**Output:** `RoadmapOutput` — array of `RoadmapWeek[]`, each containing `Slot[]` (day, material, planned minutes, session title), plus `Warning[]` and `CapacityCheck`.

**Algorithm (5-stage pipeline):**
1. Validate inputs
2. Build slot grid (N weeks × selected study days, compute per-slot capacity)
3. Capacity check (total capacity vs total material minutes → fits / over-capacity / under-capacity-buffer)
4. Tag role candidates by phase:
   - Early (weeks 0 to ⌊N/3⌋): foundation territory
   - Middle (⌊N/3⌋ to ⌊2N/3⌋): practice starts
   - Late (⌊2N/3⌋ to N): practice dominates
   - Anchor gets largest-capacity slots
   - Phase priority: Early (anchor > foundation > practice), Middle (anchor > practice > foundation), Late (practice > anchor > foundation)
5. Round-robin material assignment with partial-slot filling

**Supporting functions:** `inferRole` (keyword-based role suggestion), `addMaterialToRoadmap` (fills rest-day slots only), `removeMaterialFromRoadmap`, `regenerateRoadmap` (honors pinned slots).

**Key types:** `Material` (id, title, totalMinutes, role, additionOrder), `Slot` (weekIndex, dayOfWeek, date, capacityMinutes, role, candidateMaterialIds, plannedMinutes, sessionTitle), `Pin` (weekIndex, dayOfWeek, materialId, reason: completed/today/user-edited), `WarningKind` (over-capacity, under-capacity-buffer, anchor-stride-too-wide, pin-overflow, unresolved-tie-count, material-overfilled, material-underfilled).

**Tests:** Unit tests (stage-by-stage), property-based tests (fast-check: determinism, foundation-never-in-last-third, practice-never-in-first-third), 10 canonical snapshot tests.

**Impact:** Powers onboarding Step 3 (preview + commit), provides slot schedule for progress measurement. Consumed by `Step3Preview.tsx`, `MaterialRow.tsx`, `Home.tsx`.

---

### Engine 2: Progress Engine — the package (`packages/progress/`)

**Role:** Statistically rigorous progress tracking — Bayesian pace calibration, regime shift detection, trend analysis, probabilistic finish projections.

**Algorithms (4 layers):**

**A. Bayesian Hierarchical Calibration (`bayesian.ts`):**
- 3-level hierarchy: Global → Role → Context (role × time-of-day)
- Each level: conjugate posterior update with ratio = activeMinutes / plannedMinutes
- Prior: mean=1.0, variance=0.1
- Minimum 3 sessions per level to activate
- Output: `globalMultiplier`, `roleMultipliers`, `insights` (context-specific pace)
- Helper: `inferTimeOfDay(startedAt)` → morning (<12), afternoon (<17), evening

**B. CUSUM Regime Shift Detection (`cusum.ts`):**
- CUSUM control chart algorithm
- Parameters: slack k = 0.5σ, threshold h = 4.5σ
- Tracks upper (speedup) and lower (slowdown) accumulators
- Output: `breakpoints[]` (session indices), `promptNeeded` (trigger recalibration modal), `cusumState`
- Resets reference mean to recent 5-session average after breakpoint
- `promptNeeded = true` if last breakpoint is more recent than last user resolution

**C. Kalman Filter Trend Analysis (`kalman.ts`, `trend.ts`):**
- State vector: [level, slope] — models pace as time-varying level + trend
- Segments sessions by CUSUM breakpoints into phases
- For each phase ≥3 sessions: run Kalman filter
- Process noise: level=0.01, slope=0.0001
- Output: `Phase[]` (startIndex, endIndex, level, slope, uncertainty), `projectionSlope`

**D. Gaussian Process Regression (`gp.ts`):**
- RBF kernel with length_scale=7 days
- Detrends data first (linear), fits GP on residuals, adds trend back
- Cholesky decomposition for numerical stability
- Extrapolation: inflate CI by 1.5x for days > today
- Output: `GPPoint[]` (date, mean, lower, upper — 95% CI)

**Orchestration:**
- `computeCalibration(sessions, tags, resolutions)` → `CalibrationState` (runs Bayesian → CUSUM → Kalman)
- `computeProgress(sessions, roadmap, calibration, today)` → `ProgressSnapshot`

**ProgressSnapshot output:**
```typescript
{
  streak: { current, longest, grid: DayCell[] },
  burnUp: BurnUpData,
  projection: { finishDate, confidenceInterval },
  totalMinutes, totalPlannedMinutes, completionPercentage,
  verdict: 'ahead' | 'on-track' | 'slipping',
  driftPastDeadline: boolean,
  upNext: RoadmapSlot | null,
  weeklyStats: WeeklyStats,
  weekSummaryForNarrative: WeekSummaryForNarrative,
  replanContext: ReplanContext
}
```

**React integration (`apps/app/src/progress/`):**
- `useCalibrationState()` — live Dexie query → computeCalibration → CalibrationState
- `useProgressSnapshot(calibration, referenceDate?)` — computeProgress → ProgressSnapshot
- `usePromptDetail(calibration)` — cold path for recalibration modal
- `mapEvents.ts` — event → type mappers (mapSessions, mapExceptionalTags, mapResolutions, findRoadmap)

**Impact:** Drives Week page (burn-up chart, daily minutes, streak card, verdict), Home page stats, RecalibrationModal.

---

### Engine 3: Sync Engine (`apps/app/src/sync/SyncEngine.ts`)

**Role:** Local-first cloud sync — write-ahead queue pattern, multi-device sync, fast restore via snapshots.

**Constructor (DI):** `(supabase, eventStore, userId, clientId, onStateChange?, sendBeaconUrl, options)`

**Public methods:**
- `logEvent(kind, payload)` → append to events + sync_queue, schedule flush (200ms debounce)
- `flushQueue()` → push to Supabase with exponential backoff (1s × 2^retries, max 5)
- `pullAndMerge()` → fetch remote delta, deduplicate by client_id, merge into local
- `saveSnapshot()` → flush first, upload JSON blob + checkpoint tombstone to Storage
- `restoreFromCloud()` → download checkpoint + snapshot, validate, wipe + replay + pull delta
- `flushOnPageHide()` → sendBeacon on page unload
- `handleVisibilityChange(wasHidden, hiddenDurationMs)` → pull if hidden > 5 min
- `forceSyncNow()` → immediate flush (SyncIndicator button)
- `destroy()` → clear timers

**SyncState:** `{ status: idle|syncing|error|offline, lastSyncedAt, pendingCount, lastError }`

**Key types:** `SnapshotPayload` (schemaVersion, asOfRemoteId, events[]), `QueuedEvent` (kind, payload, createdAt, localId, retries), `SyncOptions` (snapshotInterval:50, snapshotTimeThreshold:24h, backoffBaseMs:1s, maxRetries:5, visibilityIdleThresholdMs:5min)

**Key invariants:**
- Snapshot always flushes queue first (consistency)
- Checkpoint tombstone written before blob upload
- Client deduplication in pullAndMerge
- Retry counter persists in sync_queue table (survives page reload)
- Schema version guard rejects future schemas

**Impact:** Wraps every event write. Sits in provider hierarchy: AuthProvider → EventStoreRouter → SyncRouter → AppRoutes. SyncIndicator renders status.

---

### Engine 4: ProgressEngine — deprecated (`apps/app/src/events/ProgressEngine.ts`)

**Role:** Original simplistic progress calculations: `totalMinutesLogged`, `getProjectedFinish`, `getUpNextSlot`. Pure functions over event arrays.

**Why deprecated:** Replaced by packages/progress. Doesn't account for pace calibration, regime shifts, trends, or probabilistic projections.

---

### How they connect

```
User action (log session, complete onboarding)
  → SyncEngine.logEvent() → EventStore + sync_queue → Supabase
  → Dexie live query triggers
  → useCalibrationState() → Bayesian + CUSUM + Kalman → CalibrationState
  → useProgressSnapshot() → GP + streak + burn-up → ProgressSnapshot
  → UI renders (Week, Home, charts, modals)
```

The roadmap engine produces the PLAN. The progress engine measures REALITY against the plan. The sync engine ensures BOTH persist across devices.

---

## Part 2: Honest Assessment Against MTech Guidelines

### What the PES guidelines demand

The programme expects "sound research, technology and application" with evaluation across:
- **Research:** Literature survey, novel algorithms, comparison with existing systems
- **Algorithms/Techniques:** DS/AI techniques with detailed algo design
- **Performance Evaluation:** Experimental results, model comparison, metrics
- **Novelty (Phase II):** Improve the model, real-world implementation
- **Publication:** Peer-reviewed journal or conference paper

### Phase I review milestones

| Zeroth Review | First Review | Second Review | Third Review |
|---|---|---|---|
| Title, Abstract, Introduction, Literature Survey, Proposed System, Timeline, References | Architectural Design, Algorithms/Techniques, Expected outcomes, 30% code | Detailed Algo Design, Candidate's contribution, Intermediate results, 80% code | Overall Design, Experimental Results, Performance Evaluation, Model Comparison, 100% code + Demo, Journal paper draft |

### Phase II review milestones

| First Review | Second Review | Third Review |
|---|---|---|
| Phase 1 Review, Novelty proposal, Proposed System (Phase II), Algorithms/Techniques, Expected outcomes, 40% code | Modified Algorithm Design, Candidate's contribution, Intermediate results, 80% code | Overall Design (I+II), Experimental Results, Performance Evaluation, Comparison with Existing system, 100% code + Demo, Journal publication proof |

### Peer project benchmarks

**Report 1:** "Digital Borders: Animal Tracking through Re-identification" (55 pages, Phase I)
- CNN-based animal re-identification (tigers, elephants, jaguars)
- 10-page literature survey citing ~55 references
- Compared SSD vs YOLO, multiple feature extractors (ResNet, VGG, AlexNet)
- Accuracy metrics per species, confusion matrices
- System requirements specification with functional/non-functional requirements, test cases, traceability matrix

**Report 2:** "Hybrid System for Ransomware Detection using ML and NLP" (58 pages, Phase II)
- ML+NLP for ransomware detection
- Compared 5 models: Random Forest, RF+boosting, MLP, RNN, RNN+attention
- Confusion matrices for each model
- Clear subsystem architecture

**Pattern:** Both projects have a clear ML pipeline at the center, compare multiple models head-to-head with quantitative metrics, and reference 20-50 papers. The application is secondary to the modeling contribution.

### Where the Study Tracker project is strong

1. **Real-world application** — deployed, production-grade system with genuine use case
2. **Real algorithms** — Bayesian hierarchical model, CUSUM control charts, Kalman filtering, GP regression are graduate-level work
3. **Defensible scheduling algorithm** — phase-based role assignment, tested with property-based tests

### Where the project has problems

1. **DS/AI content is buried inside a web app** — evaluator sees React/Dexie/Supabase, not the ML work
2. **No model comparison** — haven't benchmarked Bayesian calibration against simpler alternatives
3. **No experimental results or performance evaluation** — unit tests prove correctness, not model quality
4. **No literature survey or research framing** — no references to Knowledge Tracing, ITS, spaced repetition research
5. **No publication path** — journal paper draft required (Phase I), publication proof required (Phase II)
6. **No dataset or evaluation methodology** — no evaluation pipeline

**Core risk:** An evaluator opens the project and thinks "This is a well-built web app with some math in it" rather than "This is a data science project with a web interface." The framing matters enormously.

---

## Part 3: Grill Q&A — Decision Tree

### Q1: What is the research question?

**Question asked:** What is the research question your project answers? Right now the project is a product ("study planner"). An MTech project needs a research question that your algorithms answer, with the app as the vehicle for evaluation.

**Recommendation:** Frame it around adaptive study pace calibration and schedule projection under uncertainty — "Can a hierarchical Bayesian calibration model combined with Gaussian Process regression outperform naive baselines at predicting study completion timelines for self-directed learners?"

**Why:** Puts the strongest DS/AI work (Bayesian, CUSUM, Kalman, GP) at the center. Directly testable. Connects to established research fields (ITS, Knowledge Tracing, adaptive learning).

**Rohit's answer:** Agreed with the framing (moved to next question).

---

### Q2: What is the primary research contribution?

**Question asked:** Your progress package contains four techniques — Bayesian hierarchical calibration, CUSUM change-point detection, Kalman filtering, and GP regression. Which do you consider the primary research contribution?

**Recommendation:** Adaptive pace calibration using hierarchical Bayesian inference as primary, GP-based finish-date projection as secondary. Together: "I estimate how fast you really study (Bayesian), detect when your pace changes (CUSUM), and project when you'll finish (GP)."

**Why:** The hierarchical Bayesian model is the strongest differentiator (3 levels, personalized, adaptive). GP is the most visually demonstrable (burn-up chart with CI). CUSUM and Kalman are supporting mechanisms.

**Rohit's answer:** Moved discussion toward what additional features could strengthen the thesis.

---

### Q3: What features from the PRD are still unimplemented? What are market gaps? What ML/AI STAR features could we add?

**Question asked:** Looking at the PRD scope, what features are still unimplemented? What gaps exist in current study trackers? What ML/AI features give us a STAR feature?

#### Unimplemented PRD features

| Feature | Status | Impact |
|---|---|---|
| **Re-plan flow** (extend deadline / increase hours / cut scope) | Not built (Roadmap.tsx is placeholder) | HIGH |
| **Weekly LLM narrative** (streaming prose reflection) | Not built (data types ready, no LLM integration) | MEDIUM |
| **Google OAuth** | UI exists, disabled ("Coming soon") | MEDIUM |
| **PWA** (manifest, service worker, install prompt) | Not built | MEDIUM |
| **Account deletion** | Settings page is placeholder | LOW |
| **Roadmap detail views** | Placeholder pages | LOW |
| **LLMProxy Edge Function** | Not built | Blocks weekly narrative |

**What IS built (beyond expectations):** Active session with full SessionLifecycle (timer, YouTube embed, walk-away dialog, tab recovery, stale abandonment), NotificationStrategy (v1 tab flash + favicon dot), MaterialsMetadataProxy Edge Function, manual session logging, pomodoro phases.

#### Market gaps

| Category | Tools | What they DON'T do |
|---|---|---|
| **Pure timers** | Forest, Focus To-Do, Pomodoro apps | No scheduling, no analytics, no adaptive intelligence |
| **Schedule managers** | MyStudyLife, Google Calendar, Notion | No pace tracking, no adaptation, no "you're behind" signal |
| **Retention/flashcards** | Anki, Quizlet, SuperMemo | Only flashcard intervals, not study session scheduling |
| **Generic trackers** | Toggl, Clockify, RescueTime | No study-specific context, no projections, no scheduling |

**Gaps nobody fills:**
1. No statistical pace calibration (nobody learns "you're a 0.85x reader")
2. No regime shift detection
3. No probabilistic projections (no "finish between May 15-22 with 95% CI")
4. No material-type-aware scheduling (foundation → anchor → practice phasing)
5. No retention-aware review scheduling for general study sessions (Anki does flashcards only)
6. No "what should I study RIGHT NOW?" recommendation based on predicted success

Study Tracker already fills gaps 1-4. Gaps 5 and 6 are open territory.

#### Three STAR ML/AI feature candidates

**Candidate A: Knowledge Retention Modeling + Adaptive Review Scheduling**
- Model per-material forgetting curves from session data
- Predict retention of Material X after N days without studying
- Schedule review sessions when predicted retention drops below threshold
- ML: Bayesian estimation of per-material retention half-life (extends existing hierarchy to 4th level)
- Compare: exponential decay vs power law vs SM-2 vs Bayesian
- Literature: Ebbinghaus (1885), Pimsleur (1967), Leitner (1972), Wozniak SM-2 (1987), Settles & Meeder HLR (Duolingo, 2016)
- Publishable as: "Bayesian Forgetting Curve Estimation for Adaptive Study Session Scheduling in Self-Directed Learning"

**Candidate B: Study Session Outcome Prediction**
- Before a session starts, predict: on-time, overran, or abandoned
- Features: time of day, day of week, material role, duration, streak, progress %, etc.
- Compare: Logistic Regression, Random Forest, XGBoost, MLP Neural Network
- Clean model comparison tables (accuracy, AUC-ROC, F1)
- Feature importance analysis
- Publishable as: "Predicting Study Session Adherence Using Contextual Features and Machine Learning"

**Candidate C: Contextual Multi-Armed Bandit for Study Material Selection**
- Frame "what to study next" as exploration-exploitation
- Algorithms: epsilon-greedy, UCB1, Thompson Sampling, LinUCB
- Requires live users for proper evaluation (drawback)
- Publishable as: "Context-Aware Study Material Recommendation Using Thompson Sampling"

**Recommendation:** Candidate A as the primary STAR, because:
1. Deepest literature base (decades of memory research)
2. Most novel in this application (forgetting curves applied to general study, not just flashcards)
3. Extends existing Bayesian framework naturally
4. Best demo story ("system predicted you'd forget Chapter 3, scheduled a review")
5. Clear Phase I / Phase II split
6. Clean model comparison (well-known baselines)

**Rohit's answer:** "I like A, But I feel B is also a good natural addition to our app."

---

### Q4: Can we do both A and B? How do they split across Phase I / Phase II?

**Question asked:** How should A and B split across Phase I and Phase II?

**Recommendation:** Phase I = existing engines + B (Session Outcome Prediction). Phase II = A (Knowledge Retention Modeling).

**Why this ordering:**
1. **Phase I needs clean model comparison tables.** B gives exactly that — LR vs RF vs XGBoost vs MLP with accuracy/AUC/F1 columns. The existing Bayesian/GP work also gets evaluated against baselines.
2. **Phase II explicitly demands NOVELTY.** The guidelines say "Focus more on NOVELTY to improve the model." Retention modeling is genuinely novel — save it for where the rubric rewards novelty most.
3. **A depends on B's infrastructure.** Retention modeling needs session history analysis, feature engineering, and the prediction pipeline that B builds.
4. **Existing code covers Phase I implementation milestones.** Engines are built. Add evaluation pipeline, model comparison, and B's classification models as new Phase I work. Phase II is entirely fresh code.

**How A and B complement each other:**
- A (Retention) tells you WHAT to study ("you're forgetting Chapter 3")
- B (Prediction) tells you WHEN you'll succeed ("schedule it Tuesday morning — 87% likely to complete")
- Together they form a complete intelligence loop

**Rohit's answer:** Agreed.

---

### Q5: Where does the ML training happen — Python or TypeScript?

**Question asked:** The existing codebase is 100% TypeScript. But model comparison (RF, XGBoost, neural net) needs scikit-learn / XGBoost / PyTorch. Where does training happen?

**Recommendation:** Split architecture — Python for research, TypeScript for product.

- **Python (Jupyter notebooks):** Model training, evaluation, comparison tables, ablation studies, charts for the thesis report. This is what evaluators grade.
- **TypeScript (packages/progress):** Only the winning model's inference logic, implemented as a pure function. The app doesn't train — it runs learned parameters.

**Why:**
1. Evaluators expect Python (peer reports used Python + scikit-learn + TensorFlow)
2. Model comparison in TypeScript is painful (no good XGBoost in JS)
3. Don't need to train in the browser (train offline, export parameters)
4. Clean thesis separation (Chapter 5 references notebooks, Chapter 6 shows charts, demo shows TypeScript app)

**Proposed directory structure:**
```
/research/                    ← NEW: Python research pipeline
  notebooks/
    01-data-generation.ipynb
    02-feature-engineering.ipynb
    03-session-prediction.ipynb   ← B: train + compare 4 models
    04-retention-modeling.ipynb   ← A: forgetting curve fitting
  requirements.txt
  
/packages/progress/           ← EXISTING: add inference functions
  src/
    session-predictor.ts      ← NEW: runs winning model's inference
    retention-model.ts        ← NEW (Phase II): forgetting curve estimation
```

**Rohit's answer:** Agreed (moved to model selection).

---

### Q6: What ML models do we use for Session Outcome Prediction?

**Question asked:** What model do we use for outcome prediction?

**Recommendation:** Compare four models, ordered by complexity:

| Model | Role in thesis | Why include it |
|---|---|---|
| **Logistic Regression** | Baseline | Simple, interpretable. Evaluator will ask "did you try something simple first?" |
| **Random Forest** | Strong contender | Handles nonlinear interactions, feature importance for free |
| **XGBoost** | Expected winner | State of the art for tabular data. Gets exported to TypeScript. |
| **MLP (Neural Network)** | Shows range | Demonstrates deep learning capability. DL vs traditional ML discussion point. |

**Expected outcome:** XGBoost wins on AUC-ROC and F1. Logistic Regression surprisingly competitive (well-engineered features). RF close to XGBoost. MLP matches with tuning but harder to interpret.

**Rohit's answer:** Agreed (moved to prediction target).

---

### Q7: What is the prediction target — what does the model output?

**Question asked:** Three options for prediction target:
- Binary (completed / abandoned)
- Multi-class (on-time / overran / abandoned)
- Regression (predicted minutes)

**Recommendation:** Multi-class classification (on-time / overran / abandoned).

**Why:** Binary is too simple. Regression is noisy. Multi-class hits the sweet spot: three meaningful outcomes, clean confusion matrices, per-class precision/recall, and maps directly to product value ("you're likely to overrun" vs. just "you might not finish").

**Label definitions from existing SessionLifecycle:**
- **On-time:** session ended within planned duration + 10 min buffer
- **Overran:** session ended but exceeded planned + 10 min (walk-away dialog triggered)
- **Abandoned:** stale-abandoned (6h elapsed, midnight crossing) or user discarded via walk-away dialog

**Rohit's answer:** "Multi class seems right."

---

### Q8: Where does training data come from?

**Question asked:** You need hundreds to thousands of labeled sessions. Your app has maybe a few dozen from personal use. Three options:
- A. Synthetic (simulation engine, 10K+ sessions)
- B. Your own data (authentic but N<100, one user)
- C. Hybrid (synthetic for training, real data for validation)

**Recommendation:** Option C (Hybrid).

**Why:**
1. Need N=1000+ per archetype for meaningful model comparison
2. Synthetic data is standard practice in adaptive learning research
3. Real data becomes the validation set ("trained on synthetic, validated on N real sessions from live deployment")
4. Already have a dev seed utility (commit `982121e`) — extend into formal simulation engine

**Rohit's answer:** "Agreed on C."

---

### Q9: What does the synthetic data generation engine look like?

**Question asked:** How do we generate synthetic data? What would the engine look like?

**Recommendation:** Python module in `/research/` that generates thousands of labeled sessions across user archetypes.

**User archetypes (each with different behavioral parameters):**

| Archetype | Base completion | Key trait |
|---|---|---|
| **Steady Eddie** | 85% on-time | Consistent across contexts |
| **Morning Lark** | 70% base, +20% morning | Time-of-day dependent |
| **Fading Flame** | 90% → 50% over time | Motivation decay |
| **Weekend Warrior** | 60% weekday, 85% weekend | Day-of-week dependent |
| **Deadline Sprinter** | 50% early, 90% near deadline | Deadline pressure response |
| **Marathon Runner** | High for short, crashes on long | Duration sensitive |

**Ground truth probability model (what the ML models try to recover):**
```python
logit(P(on-time)) = (
    base_logit
    + tod_effect[time_of_day]
    + dow_effect[day_of_week]
    + streak_bonus * min(streak, 14)
    + duration_penalty * max(planned_min - 60, 0)
    + fatigue_rate * session_number
    + deadline_pressure * (1 / max(days_to_deadline, 1))
    # NONLINEAR INTERACTIONS — why XGBoost beats Logistic Regression
    + tod_x_role[time_of_day, role]        # practice easier in morning
    + streak_x_duration * streak * planned_min / 100
    + threshold_jump * (planned_min > 90)  # step function
)
```

**Why nonlinear interactions matter:** If ground truth were purely linear, Logistic Regression would match XGBoost. Interactions (time-of-day × material-role), thresholds (>90 min), and accumulated effects give tree-based models an advantage — producing a genuine model comparison.

**Scale:** ~6 archetypes × ~20 users × ~100-200 sessions = 10,000-24,000 sessions.

**Output:**
```
/research/
  data/
    synthetic_sessions.csv      # ~10K sessions across all archetypes
    archetype_params.json       # reproducible parameters
  notebooks/
    01-data-generation.ipynb    # runs engine, visualizes distributions
```

**Rohit's answer:** Agreed (moved to feature set question).

---

### Q10: What features does the model see? (PENDING — session ended here)

**Question asked:** The synthetic engine generates sessions, but the model sees engineered features. Which features should we extract?

**Recommendation:** Three feature groups, 12-15 features total:

| Group | Features | Why |
|---|---|---|
| **Temporal** | time_of_day (morning/afternoon/evening), day_of_week, days_since_last_session | Captures rhythm and recency |
| **Session** | planned_minutes, material_role (anchor/foundation/practice), material_session_number | Captures what's being attempted |
| **Behavioral history** | streak_length, historical_pace_ratio (global), historical_pace_ratio (this material), completion_rate_last_5, cumulative_progress_pct, days_to_deadline | Captures who this user is and where they are |

**Why these:** All derivable from existing EventStore data. Span three dimensions evaluators will ask about: when (temporal), what (session), who (behavioral). Enable clean feature importance analysis.

**Rohit's answer:** Session ended before answering. **This is where to resume the grill.**

---

## Decisions Made (Summary)

| # | Decision | Choice |
|---|---|---|
| 1 | Research question framing | Adaptive pace calibration + probabilistic projection |
| 2 | Primary contribution | Bayesian hierarchical calibration (primary) + GP projection (secondary) |
| 3 | STAR features | A (Knowledge Retention) + B (Session Outcome Prediction) — both |
| 4 | Phase I / Phase II split | Phase I: existing engines + B (prediction). Phase II: A (retention) — the novelty |
| 5 | ML pipeline architecture | Python for research (notebooks), TypeScript for product (inference only) |
| 6 | Models for comparison | Logistic Regression, Random Forest, XGBoost, MLP Neural Network |
| 7 | Prediction target | Multi-class: on-time / overran / abandoned |
| 8 | Training data strategy | Hybrid: synthetic for training (10K+), real data for validation |
| 9 | Synthetic engine design | Python module with 6 user archetypes, nonlinear ground truth model |
| 10 | Feature set | PENDING — three groups (temporal, session, behavioral), 12-15 features |

## Open Questions (Resume Here)

1. **Feature set confirmation** — Q10 was asked but not answered
2. **Evaluation methodology** — train/test split strategy, cross-validation approach, metrics to report
3. **How the trained model integrates into the TypeScript app** — inference function design, parameter export format
4. **How predictions surface in the UI** — where does "likely to overrun" appear to the user?
5. **Phase II retention modeling specifics** — forgetting curve parameterization, how to measure retention without explicit recall tests, proxy signals
6. **Literature survey scope** — which research fields to cover, key papers to cite
7. **Journal publication target** — which venue to submit to
8. **Thesis report structure** — chapter outline mapped to evaluation milestones
