import type { CalendarBubbleStatus } from './calendarModel'

export type StatusIconName = 'ti-check' | 'ti-clock' | 'ti-x' | 'ti-plus'

export interface CalendarStatusStyle {
  status: CalendarBubbleStatus
  label: string
  fillVar: string
  borderStyle: string
  textVar: string
  icon: StatusIconName
  chipClass: string
}

export const STATUS_STYLES: Record<CalendarBubbleStatus, CalendarStatusStyle> = {
  done: {
    status: 'done',
    label: 'Done',
    fillVar: 'var(--moss)',
    borderStyle: 'none',
    textVar: 'var(--text-on-inverted)',
    icon: 'ti-check',
    chipClass: 'roadmap-chip-done',
  },
  booked: {
    status: 'booked',
    label: 'Booked',
    fillVar: 'var(--surface-card)',
    borderStyle: '1.4px solid var(--border-default)',
    textVar: 'var(--text-tertiary)',
    icon: 'ti-clock',
    chipClass: 'roadmap-chip-booked',
  },
  missed: {
    status: 'missed',
    label: 'Missed',
    fillVar: 'var(--rust)',
    borderStyle: 'none',
    textVar: 'var(--text-on-inverted)',
    icon: 'ti-x',
    chipClass: 'roadmap-chip-missed',
  },
  unplanned: {
    status: 'unplanned',
    label: 'Unplanned',
    fillVar: 'var(--surface-card)',
    borderStyle: '1.4px dashed var(--border-default)',
    textVar: 'var(--text-tertiary)',
    icon: 'ti-plus',
    chipClass: 'roadmap-chip-unplanned',
  },
}

export const LEGEND_ITEMS = [
  STATUS_STYLES.done,
  STATUS_STYLES.booked,
  STATUS_STYLES.missed,
  STATUS_STYLES.unplanned,
]

export function statusStyleFor(status: CalendarBubbleStatus): CalendarStatusStyle {
  return STATUS_STYLES[status]
}
