# Progress Engine

Pure function package (`@study-tracker/progress-engine`) — generates week-by-week study roadmaps. No side effects, no framework dependencies. Tested with Vitest + fast-check (property tests).

## Public API

```ts
import {
  generateRoadmap,            // (input: RoadmapInput) => RoadmapOutput
  inferRole,                  // (title: string) => MaterialRole
  addMaterialToRoadmap,       // add material to existing roadmap
  removeMaterialFromRoadmap,  // remove material from existing roadmap
  regenerateRoadmap,          // regenerate with modified inputs
} from '@study-tracker/progress-engine'
```

## Key Types

| Type | Purpose |
|---|---|
| `Material` | title, estimatedDuration, role (anchor/foundation/practice) |
| `RoadmapInput` | materials, deadline, capacity (weekdayHours, weekendHours, selectedStudyDays) |
| `RoadmapOutput` | weeks: RoadmapWeek[], warnings: Warning[], pins: PinSet |
| `Slot` | materialId, dayOfWeek, weekIndex, plannedMinutes |
| `Warning` | kind (capacity, deadline, etc.) + message |
| `Pin` | User-pinned slot overrides preserved across regeneration |

## Algorithm Guide

See [`design/algo/ROADMAP_ENGINE_GUIDE.md`](../../design/algo/ROADMAP_ENGINE_GUIDE.md) for detailed algorithm documentation.
