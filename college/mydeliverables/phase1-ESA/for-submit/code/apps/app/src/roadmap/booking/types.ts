import type { MaterialKind, MaterialPosition } from '../../session/types'

/**
 * Material option surfaced in the booking sheets' material picker (D21).
 * Enriched from the roadmap material ledger so the picker can render per-material
 * status sublines and pre-select the suggested material.
 */
export interface BookingMaterialOption {
  materialId: string
  title: string
  kind: MaterialKind
  /** True once any session/mark has logged progress against the material. */
  started: boolean
  /** True once the material is complete. */
  done: boolean
  /** Estimated minutes still remaining (for the "N/M" subline). */
  remainingEstimatedMinutes: number
  /** Total estimated minutes for the material. */
  estimatedMinutes: number
  /** Latest captured position, if any (drives the "N/M videos" subline). */
  lastPosition?: MaterialPosition
}

export interface BookingEditDraft {
  date: string
  estimatedDuration: number
  materialId: string | null
}

/** Material-icon class + short label for a material kind (matches components.css). */
export function materialIcon(option: Pick<BookingMaterialOption, 'kind' | 'lastPosition'>): {
  cls: string
  label: string
} {
  if (option.kind === 'youtube') {
    // Playlist-style materials carry a videos position; render the purple PL chip.
    if (option.lastPosition?.kind === 'videos') return { cls: 'pl', label: 'PL' }
    return { cls: 'yt', label: 'YT' }
  }
  if (option.kind === 'article') return { cls: 'art', label: 'AR' }
  return { cls: 'bk', label: 'BK' }
}

/** Status subline for a material row in the picker ("in progress · 4/12", "done", "not started"). */
export function materialStatusLine(option: BookingMaterialOption): string {
  if (option.done) return 'done'
  if (!option.started) return 'not started'
  const position = option.lastPosition
  if (position?.kind === 'videos' && position.ofTotal) {
    return `in progress · ${position.value}/${position.ofTotal} videos`
  }
  if (option.estimatedMinutes > 0) {
    const consumed = Math.max(0, option.estimatedMinutes - option.remainingEstimatedMinutes)
    const percent = Math.round((consumed / option.estimatedMinutes) * 100)
    return `in progress · ${percent}%`
  }
  return 'in progress'
}
