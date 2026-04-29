import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoadmap, type RoadmapInput, type RoadmapOutput } from '@study-tracker/progress-engine'
import { differenceInCalendarDays } from 'date-fns'
import { useOnboarding, type OnboardingSlotEdit } from '../OnboardingProvider'
import { useSync } from '../../sync/useSync'
import { useEventStore } from '../../events/useEventStore'
import { CheckpointGate } from '../CheckpointGate'
import { SchedulePreview } from '../components/SchedulePreview'
import { OverCapacityModal, UnderCapacityBanner } from '../components/CapacityPrompt'
import type { MaterialAddedPayload, RoadmapCreatedPayload } from '../../sync/types'
import '../onboarding.css'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function Step3Preview() {
  const { state, dispatch } = useOnboarding()
  const { logEvent } = useSync()
  const eventStore = useEventStore()
  const navigate = useNavigate()
  const [committing, setCommitting] = useState(false)
  const [compressedWeeks, setCompressedWeeks] = useState<number | null>(null)

  const previewEdits = useMemo(() => {
    const edits = new Map<string, { materialId: string | null; sessionTitle: string | null }>()
    for (const e of state.previewEdits) {
      edits.set(`${e.weekIndex}:${e.dayOfWeek}`, { materialId: e.materialId, sessionTitle: e.sessionTitle })
    }
    return edits
  }, [state.previewEdits])

  const roadmapInput = useMemo((): RoadmapInput | null => {
    if (!state.deadline || state.selectedStudyDays.length === 0 || state.materials.length === 0) return null
    const today = new Date().toISOString().split('T')[0]
    const days = differenceInCalendarDays(state.deadline, today)
    const computedWeeks = Math.max(1, Math.ceil(days / 7))
    const weeks = compressedWeeks ?? computedWeeks
    return {
      materials: state.materials
        .filter(m => m.title && m.estimatedDuration > 0)
        .map((m, i) => ({ id: m.id, title: m.title, totalMinutes: m.estimatedDuration, role: m.role, additionOrder: i })),
      weeks,
      startDate: today,
      selectedStudyDays: state.selectedStudyDays,
      weekdayHours: state.weekdayHours,
      weekendHours: state.weekendHours,
    }
  }, [state.deadline, state.selectedStudyDays, state.weekdayHours, state.weekendHours, state.materials, compressedWeeks])

  const debouncedInput = useDebouncedValue(roadmapInput, 150)
  const roadmap = useMemo((): RoadmapOutput | null => {
    if (!debouncedInput || debouncedInput.materials.length === 0) return null
    return generateRoadmap(debouncedInput)
  }, [debouncedInput])

  const displayRoadmap = useMemo((): RoadmapOutput | null => {
    if (!roadmap) return null
    const resolved = { ...roadmap, weeks: roadmap.weeks.map(w => ({ ...w, slots: w.slots.map(s => ({ ...s })) })) }
    for (const week of resolved.weeks) {
      for (const slot of week.slots) {
        const key = `${slot.weekIndex}:${slot.dayOfWeek}`
        const edit = previewEdits.get(key)
        if (edit) {
          if (edit.materialId && slot.candidateMaterialIds.includes(edit.materialId)) {
            slot.candidateMaterialIds = [edit.materialId]
          } else if (edit.materialId === null) {
            slot.candidateMaterialIds = []
          }
          if (edit.sessionTitle !== null) {
            slot.sessionTitle = edit.sessionTitle
          }
        }
      }
    }
    return resolved
  }, [roadmap, previewEdits])

  const capacityCheck = displayRoadmap?.capacityCheck

  const unresolvedTieCount = displayRoadmap?.warnings.find(w => w.kind === 'unresolved-tie-count')?.detail?.count as number ?? 0

  const handleResolveTie = useCallback((weekIndex: number, dayOfWeek: string, materialId: string | null) => {
    const edits: OnboardingSlotEdit[] = [...state.previewEdits]
    const existingIdx = edits.findIndex(e => e.weekIndex === weekIndex && e.dayOfWeek === dayOfWeek)
    if (existingIdx >= 0) {
      edits[existingIdx] = { ...edits[existingIdx], materialId }
    } else {
      edits.push({ weekIndex, dayOfWeek, materialId, sessionTitle: null, plannedMinutes: 0 })
    }
    dispatch({ type: 'SET_PREVIEW_EDITS', edits })
  }, [state.previewEdits, dispatch])

  const handleRename = useCallback((weekIndex: number, dayOfWeek: string, sessionTitle: string) => {
    const edits: OnboardingSlotEdit[] = [...state.previewEdits]
    const existingIdx = edits.findIndex(e => e.weekIndex === weekIndex && e.dayOfWeek === dayOfWeek)
    if (existingIdx >= 0) {
      edits[existingIdx] = { ...edits[existingIdx], sessionTitle }
    } else {
      edits.push({ weekIndex, dayOfWeek, materialId: null, sessionTitle, plannedMinutes: 0 })
    }
    dispatch({ type: 'SET_PREVIEW_EDITS', edits })
  }, [state.previewEdits, dispatch])

  const handleCompress = useCallback(() => {
    if (!capacityCheck?.suggestedWeeks) return
    setCompressedWeeks(capacityCheck.suggestedWeeks)
  }, [capacityCheck?.suggestedWeeks])

  const handleCommit = useCallback(async () => {
    if (!displayRoadmap || committing || unresolvedTieCount > 0) return
    setCommitting(true)
    try {
      const allSlots = displayRoadmap.weeks.flatMap(w => w.slots)

      for (const mat of state.materials) {
        if (!mat.title || mat.estimatedDuration <= 0) continue
        const payload: MaterialAddedPayload = {
          materialId: mat.id,
          title: mat.title,
          estimatedDuration: mat.estimatedDuration,
          url: mat.url,
          kind: 'manual',
          role: mat.role,
        }
        await logEvent('MaterialAdded', payload as unknown as Record<string, unknown>)
      }

      const roadmapPayload: RoadmapCreatedPayload = {
        startDate: roadmapInput!.startDate,
        deadline: state.deadline!,
        weeks: roadmapInput!.weeks,
        purpose: state.purpose || undefined,
        selectedStudyDays: state.selectedStudyDays,
        weekdayHours: state.weekdayHours,
        weekendHours: state.weekendHours,
        weeklyHours: state.weeklyHours,
        slots: allSlots,
      }
      await logEvent('RoadmapCreated', roadmapPayload as unknown as Record<string, unknown>)

      await logEvent('OnboardingCompleted', {})

      await eventStore.table('onboardingDraft').clear()

      navigate('/onboarding/4')
    } catch (err) {
      console.error('Onboarding commit failed', err)
    } finally {
      setCommitting(false)
    }
  }, [displayRoadmap, state, committing, unresolvedTieCount, logEvent, eventStore, navigate, roadmapInput])

  if (!roadmapInput) {
    return (
      <CheckpointGate step={3}>
        <p className="t-body" style={{ color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>
          Add at least one material to see your plan preview.
        </p>
      </CheckpointGate>
    )
  }

  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

  return (
    <CheckpointGate step={3}>
      <div>
        {!isDesktop && (
          <>
            <h1 className="screen-h1" style={{ marginBottom: '8px' }}>
              Here's a <em style={{ fontStyle: 'italic', color: 'var(--terracotta)', fontWeight: 400 }}>plan</em>.
            </h1>
            <p className="screen-lead" style={{ marginBottom: '12px' }}>
              Done by {state.deadline} · {roadmapInput.weeks} week{roadmapInput.weeks !== 1 ? 's' : ''} · {state.weeklyHours}h/week. Tap a row to edit.
            </p>

            <div style={{ display: 'flex', gap: '16px', padding: '12px 14px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div className="stat" style={{ flex: 1 }}>
                <div className="stat-value sm">{roadmapInput.weeks}</div>
                <div className="stat-label">weeks</div>
              </div>
              <div className="stat" style={{ flex: 1 }}>
                <div className="stat-value sm">{(roadmapInput.materials || []).length * (roadmapInput.weeks || 1)}</div>
                <div className="stat-label">sessions</div>
              </div>
              <div className="stat" style={{ flex: 1 }}>
                <div className="stat-value sm">{Math.round((capacityCheck?.totalMaterialMinutes ?? 0) / 60)}h</div>
                <div className="stat-label">total</div>
              </div>
            </div>
          </>
        )}

        {isDesktop && capacityCheck && (
          <div style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
            <div className="stat" style={{ flex: 1 }}><div className="stat-value md">{state.deadline}</div><div className="stat-label">target finish</div></div>
            <div className="stat" style={{ flex: 1 }}><div className="stat-value md">{roadmapInput.weeks}</div><div className="stat-label">weeks</div></div>
            <div className="stat" style={{ flex: 1 }}><div className="stat-value md">{state.weeklyHours}h</div><div className="stat-label">per week</div></div>
          </div>
        )}

        {capacityCheck && (
          <>
            <UnderCapacityBanner capacityCheck={capacityCheck} warnings={displayRoadmap?.warnings ?? []}
              onCompress={handleCompress} onKeepBuffer={() => {}} />
            <OverCapacityModal capacityCheck={capacityCheck} warnings={displayRoadmap?.warnings ?? []}
              onCompress={handleCompress} onKeepBuffer={() => {}} />
          </>
        )}

        {displayRoadmap && (
          <SchedulePreview
            roadmap={displayRoadmap}
            materials={state.materials.map(m => ({ id: m.id, title: m.title }))}
            onResolveTie={handleResolveTie}
            onRename={handleRename}
          />
        )}

        {!isDesktop && <button className="btn btn-ghost btn-sm btn-block" style={{ margin: '16px 0' }}>Show all {roadmapInput.weeks} weeks</button>}

        <div className="row" style={{ gap: '8px', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/onboarding/3')}>
            <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
          </button>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
            disabled={unresolvedTieCount > 0 || committing || capacityCheck?.status === 'over-capacity'}
            title={unresolvedTieCount > 0 ? `Resolve ${unresolvedTieCount} undecided slot${unresolvedTieCount !== 1 ? 's' : ''} to continue.` : undefined}
            onClick={handleCommit}>
            {committing ? 'Saving…' : 'Looks good'}
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}