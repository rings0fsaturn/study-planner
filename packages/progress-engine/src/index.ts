// Public API exports
export {
  generateRoadmap,
  inferRole,
  addMaterialToRoadmap,
  removeMaterialFromRoadmap,
  regenerateRoadmap,
} from './roadmap-engine'

// Config exports
export {
  DEFAULT_ROADMAP_CONFIG,
  type RoadmapConfig,
} from './constants'

// Type exports
export type {
  DayOfWeek,
  MaterialRole,
  Material,
  RoadmapInput,
  Slot,
  RoadmapWeek,
  RoadmapOutput,
  Pin,
  PinSet,
  Warning,
  WarningKind,
  CapacityCheck,
} from './roadmap-engine'
