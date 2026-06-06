# Architecture Diagram — First Review (two-tier, Phase II greyed)

Layout rules applied: single top-down flow; Supabase as the data hub (no crisscross
client↔service edges); each pillar is a left→right pipeline (short parallel arrows);
the closed loop is the only deliberate feedback edge; Phase II = dashed + greyed.

```mermaid
flowchart TB
    LEARNER([Learner])

    subgraph CLIENT["Client — Local-first App (React / Vite)"]
        APP["Study App<br/>log sessions · take quizzes · view plan<br/>Dexie local store + cache"]
    end

    SB[("Supabase<br/>Auth · Events DB · Storage")]

    subgraph SVC["Intelligence Service — Python · FastAPI · Docker"]
        direction TB
        ROUTER["API router"]
        subgraph PA["Pillar A — Adaptation · Phase I"]
            direction LR
            CAL["Pace Calibration<br/>Bayesian"] --> DET["Change Detection<br/>CUSUM"] --> PROJ["Progress Projection<br/>Gaussian Process"] --> SCH["Schedule Generator<br/>constraint-based"]
        end
        subgraph PB["Pillar B — Verification · Phase II"]
            direction LR
            GEN["Item Generation<br/>LLM · concept-tagged"] -.-> EVAL["Answer<br/>Evaluation"] -.-> KT["Mastery · Knowledge Tracing<br/>cold-start"]
        end
        ROUTER --> CAL
        ROUTER -.-> GEN
        KT -.->|"verified mastery · closed loop"| CAL
    end

    subgraph RES["Offline Research — Python · pyKT · scipy · sklearn"]
        direction LR
        PIPE["Synthetic data +<br/>model comparison"] --> ART[("Trained models<br/>& parameters")]
    end

    OAI[["OpenAI<br/>LLM"]]

    LEARNER --> APP
    APP <-->|"sync events · read plan"| SB
    SB -->|"events"| ROUTER
    SCH -->|"plan + projections"| SB
    APP <-.->|"material · quizzes · answers"| ROUTER
    OAI -.-> GEN
    OAI -.-> EVAL
    ART -->|"trained params"| CAL
    ART -.->|"trained KT model"| KT

    classDef phase2 fill:#f1f1f1,stroke:#9ca3af,color:#6b7280,stroke-dasharray:4 3;
    class GEN,EVAL,KT phase2;
    classDef ext fill:#ffffff,stroke:#9ca3af,color:#6b7280;
    class OAI ext;
    style PA fill:#eef6ff,stroke:#1d4ed8;
    style PB fill:#f5f5f5,stroke:#9ca3af,color:#6b7280,stroke-dasharray:5 4;
    style SVC fill:#faf5ff,stroke:#6d28d9;
    style CLIENT fill:#eff6ff,stroke:#1d4ed8;
    style RES fill:#ecfdf5,stroke:#047857;
    style SB fill:#f8fafc,stroke:#475569;
```

## Reading guide (for the slide / talk)
- **Solid = Phase I (open loop):** Learner → App → Supabase → Pillar A
  (Calibrate → Detect → Project → Schedule) → plan back to Supabase → App.
- **Dashed + grey = Phase II:** Pillar B (Item-gen → Evaluate → Mastery), the OpenAI
  dependency, and the **one feedback edge** — verified mastery feeding calibration
  (closing the loop).
- **Supabase is the hub:** client and service exchange data through it, so there are no
  tangled direct connections.
- **Research feeds the service:** the offline pipeline produces the trained models the
  engines run (solid into Pillar A, dashed into Pillar B).

## One-line narration
"In Phase I the system logs honest study data and runs the adaptation pillar to keep the
schedule current. In Phase II the verification pillar generates assessments from the
learner's own material, measures real mastery, and feeds that trusted signal back into
calibration — closing the loop."
