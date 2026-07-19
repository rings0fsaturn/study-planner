// Public API exports
export {
  generateRoadmap,
  generateBookings,
  suggestMaterialForBooking,
  inferRole,
  addMaterialToRoadmap,
  removeMaterialFromRoadmap,
  regenerateRoadmap,
} from './roadmap-engine'

// Config exports
export {
  DEFAULT_ROADMAP_CONFIG,
  ROLE_TO_LABEL,
  LABEL_TO_ROLE,
  type RoadmapConfig,
} from './constants'

// Type exports
export type {
  DayOfWeek,
  MaterialRole,
  Material,
  Booking,
  BookingStatus,
  BookingLayoutInput,
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
