# System Architecture — Adaptive Study Planning (Verified Closed-Loop)

> Target architecture agreed during Review-1 prep (2026-06-04).
> Three tiers: offline research → Python Intelligence Service → local-first client.
> Two pillars: **A) closed-loop adaptation**, **B) assessment-based verification**.
> Solid = Phase I (open-loop). Dashed/orange = Phase II (assessment + closed loop).

```mermaid
flowchart TB
    User([Self-directed learner])
    OAI[["OpenAI API<br/>(LLM)"]]

    %% ===================== CLIENT =====================
    subgraph CLIENT["🖥️ Client — Local-first TS App · React/Vite · Vercel /study/*"]
        direction TB
        UI["UI / Pages<br/>Home · Session · Onboarding<br/>Week · Roadmap · Settings"]
        ES[("EventStore<br/>Dexie / IndexedDB<br/>raw events")]
        DISP["Trivial derivations (TS)<br/>streak · minutes · up-next"]
        CACHE[("Local intelligence cache<br/>last-computed results")]
        SYNC["SyncEngine<br/>write-ahead queue"]
    end

    %% ===================== SUPABASE =====================
    subgraph SB["☁️ Supabase (BaaS)"]
        direction TB
        AUTH["Auth"]
        PG[("Postgres<br/>events table (per-event sync)")]
        STG[("Storage<br/>snapshots")]
        EF["Edge Function<br/>MaterialsMetadataProxy"]
    end

    %% ===================== INTELLIGENCE SERVICE =====================
    subgraph SVC["🧠 Intelligence Service — Python · FastAPI · Docker/Colima  (single source of truth for heavy ML)"]
        direction TB
        API["FastAPI router"]
        PA["Pillar A engines<br/>Bayesian calibration · CUSUM<br/>Kalman · GP projection · scheduler"]
        PB1["Pillar B · LLM item-gen<br/>concept-tagged Q/options/answer"]
        PB2["Pillar B · answer evaluation"]
        PB3["Pillar B · KT mastery<br/>concept-level (BKT / Deep-IRT)"]
        ART[("Trained artifacts<br/>params / checkpoints")]
    end

    %% ===================== RESEARCH =====================
    subgraph RES["🔬 /research — Offline Python · pyKT · pyBKT · scipy · sklearn · GPy"]
        direction TB
        GEN["Synthetic data generator<br/>6 archetypes · known ground truth"]
        CMPA["Pillar A comparison<br/>Bayesian vs SMA · CUSUM vs EWMA<br/>GP vs linear"]
        CMPB["Pillar B comparison<br/>DKT/AKT/Deep-IRT/UKT vs BKT"]
        DSETS[("Public datasets<br/>Eedi (MCQ) · POJ (coding) via pyKT")]
    end

    %% ---------- core local loop (Phase I, offline-capable) ----------
    User --> UI
    AUTH -.->|"gate /study/*"| UI
    UI -->|"log session / quiz response"| ES
    ES --> DISP --> UI
    ES --> SYNC --> PG
    SYNC --> STG
    UI -->|"paste material URL"| EF --> UI

    %% ---------- Pillar A: analytics (server-computed, cached) ----------
    UI -->|"request analytics"| API
    API --> PA
    PA -->|"read events"| PG
    PA -->|"calibration · projection · verdict"| CACHE
    CACHE --> DISP
    ART --> PA

    %% ---------- Pillar B: assessment subsystem (Phase II) ----------
    UI -.->|"ingest material / start assessment"| API
    API -.-> PB1
    PB1 -.->|"generate items"| OAI
    PB1 -.->|"deliver quiz via Session component"| UI
    API -.-> PB2
    PB2 -.->|"grade (optional LLM)"| OAI
    PB3 -.->|"read responses"| PG
    ART -.-> PB3

    %% ---------- closed loop (Phase II novelty) ----------
    PB3 -.->|"per-concept mastery = honest signal"| PA
    PA -.->|"verified recalibration → regenerated roadmap"| CACHE

    %% ---------- research feeds the service ----------
    DSETS --> CMPB
    GEN --> CMPA
    CMPA -->|"winning params"| ART
    CMPB -.->|"winning model"| ART

    %% ===================== STYLING =====================
    classDef phase2 stroke-dasharray:5 5,stroke:#c2410c,color:#7c2d12,fill:#fff7ed;
    classDef client fill:#eff6ff,stroke:#1d4ed8;
    classDef svc fill:#f5f3ff,stroke:#6d28d9;
    classDef res fill:#ecfdf5,stroke:#047857;
    classDef sb fill:#f8fafc,stroke:#475569;

    class UI,ES,DISP,CACHE,SYNC client;
    class API,PA svc;
    class GEN,CMPA,CMPB,DSETS res;
    class AUTH,PG,STG,EF sb;
    class PB1,PB2,PB3 phase2;
```

## How to read it

- **Solid edges = Phase I (open-loop):** log → store → sync → server-computed
  analytics (Pillar A) → cached → displayed. Core logging works offline; analytics
  refresh when online.
- **Dashed / orange = Phase II (novelty):** the assessment subsystem (Pillar B) plus
  the **closed loop** — KT mastery becomes the *honest signal* feeding verified
  recalibration back into scheduling.
- **`/research` (green)** is offline-only: produces the model-comparison results
  (the "Model Comparison" deliverable) and exports winning params/checkpoints into the
  Intelligence Service. Nothing in `/research` runs at request time.
- **Single Intelligence Service** hosts both pillars' heavy ML — the
  "evaluated code = shipped code" decision (no TS/Python drift).

## Notes for Review 1

- Show the **solid (Phase I) portion in full color** and **grey/dash the Phase II
  portion** — matches the "proposed Phase II" framing from the guidance-call deck.
- Call out explicitly: the **concept-tag from `PB1`** is what lets `PB3` trace mastery
  over LLM-generated, never-before-seen items — the single-learner adaptation of KT.

## Key architectural decisions (provenance: 2026-06-04 grill)

- Three tiers: `/research` (offline Python) → Intelligence Service (FastAPI/Docker)
  → local-first TS client.
- Pillar A statistical engines move TS → Python as single source of truth
  (Phase-II migration; see `plans/deferrals/2026-06-04-review1-prep-deferrals.md`).
- Trivial display derivations stay client-side TS for offline.
- Assessment subsystem (LLM item-gen + answer eval + KT) consolidated in FastAPI.
- KT done at **concept level** (BKT/Deep-IRT) to handle generated/unique items and
  single-learner cold-start; deep pyKT models used as offline AUC baselines.
