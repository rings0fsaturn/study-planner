import {
  regenerateRoadmap,
  type RoadmapOutput,
} from '@study-tracker/roadmap-engine'
import type { Event } from '../../events/EventStore'
import { postRoadmapRegenerate, RoadmapServiceError } from '../../lib/intelligenceClient'
import {
  mapToRegenerateRequest,
  type RoadmapRegenerateRequest,
} from './mapToRegenerateRequest'

interface ReplanRoadmapOptions {
  today?: string
  transport?: (body: RoadmapRegenerateRequest) => Promise<unknown>
  offlineFallback?: boolean
  extendWeeks?: number
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function failMalformed(reason: string): never {
  throw new RoadmapServiceError(`malformed roadmap regenerate response: ${reason}`)
}

function parseRoadmapOutput(response: unknown): RoadmapOutput {
  if (!isRecord(response)) failMalformed('response is not an object')
  if (!Array.isArray(response.weeks)) failMalformed('weeks is not an array')
  if (!Array.isArray(response.warnings)) failMalformed('warnings is not an array')

  for (const [weekIndex, week] of response.weeks.entries()) {
    if (!isRecord(week)) failMalformed(`weeks[${weekIndex}] is not an object`)
    if (typeof week.weekIndex !== 'number') failMalformed(`weeks[${weekIndex}].weekIndex is missing`)
    if (typeof week.startDate !== 'string') failMalformed(`weeks[${weekIndex}].startDate is missing`)
    if (!Array.isArray(week.slots)) failMalformed(`weeks[${weekIndex}].slots is not an array`)
  }

  return response as unknown as RoadmapOutput
}

function offlineReplan(request: RoadmapRegenerateRequest): RoadmapOutput {
  return regenerateRoadmap(request.input, request.pins)
}

function requestFor(events: Event[], opts: ReplanRoadmapOptions): RoadmapRegenerateRequest {
  const request = mapToRegenerateRequest(events, opts.today ?? todayISO())
  const extendWeeks = Math.max(0, opts.extendWeeks ?? 0)
  if (extendWeeks === 0) return request

  return {
    ...request,
    input: {
      ...request.input,
      weeks: request.input.weeks + extendWeeks,
    },
  }
}

export async function replanRoadmap(
  events: Event[],
  opts: ReplanRoadmapOptions = {},
): Promise<RoadmapOutput> {
  const request = requestFor(events, opts)
  const transport = opts.transport ?? postRoadmapRegenerate

  try {
    return parseRoadmapOutput(await transport(request))
  } catch (err) {
    if (opts.offlineFallback) {
      return offlineReplan(request)
    }
    throw err
  }
}
