export type RoadmapResolutionKind = 'RoadmapMarkedComplete' | 'RoadmapMarkedAbandoned'

interface ResolveRoadmapOptions {
  kind: RoadmapResolutionKind
  roadmapCreatedAt: string
  logEvent: (kind: RoadmapResolutionKind, payload: Record<string, unknown>) => Promise<number>
  confirmAbandon?: (message: string) => boolean
  resolvedAt?: string
}

export async function resolveRoadmap({
  kind,
  roadmapCreatedAt,
  logEvent,
  confirmAbandon = (message) => window.confirm(message),
  resolvedAt = new Date().toISOString(),
}: ResolveRoadmapOptions): Promise<boolean> {
  if (
    kind === 'RoadmapMarkedAbandoned' &&
    !confirmAbandon('Abandon this roadmap? It will move to your roadmap history.')
  ) {
    return false
  }

  await logEvent(kind, {
    roadmapCreatedAt,
    resolvedAt,
  })

  return true
}
