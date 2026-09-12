import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROLE_TO_LABEL, type MaterialRole } from '@study-tracker/roadmap-engine'
import { useMaterialsClient } from './MaterialsProvider'
import {
  SOURCE_LABELS,
  isProcessing,
  isReady,
  type MaterialRecord,
  type MaterialSourceKind,
} from './types'

export type MaterialPickerPurpose = 'generation' | 'planning'

const PLAN_ROLES: MaterialRole[] = ['anchor', 'foundation', 'practice']

/** One picked library material, enough for the caller to write its own event. */
export interface MaterialPickerSelection {
  materialId: string
  title: string
  kind: MaterialSourceKind
}

export interface MaterialPickerProps {
  open: boolean
  purpose: MaterialPickerPurpose
  max?: number
  initialSelected?: string[]
  /** Materials already attached to the target surface; hidden from the list. */
  excludeIds?: string[]
  /** Show a minutes budget and a role per selected row (roadmap attach). */
  withPlan?: boolean
  onClose: () => void
  onContinue: (
    selection: MaterialPickerSelection[],
    plan?: Record<string, { minutes: number; role: MaterialRole }>,
  ) => void
}

export function MaterialPicker({
  open,
  purpose,
  max,
  initialSelected,
  excludeIds,
  withPlan,
  onClose,
  onContinue,
}: MaterialPickerProps) {
  const client = useMaterialsClient()
  const [materials, setMaterials] = useState<MaterialRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []))
  const [planEdits, setPlanEdits] = useState<
    Record<string, { minutes?: number; role?: MaterialRole }>
  >({})

  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialSelected ?? []))
    setPlanEdits({})
    setLoadError(null)
    let cancelled = false
    void client
      .listMaterials()
      .then((list) => {
        if (!cancelled) setMaterials(list)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load materials')
      })
    return () => {
      cancelled = true
    }
  }, [open, client, initialSelected])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selectableIds = useMemo(() => {
    if (!materials) return new Set<string>()
    const selectable = new Set<string>()
    for (const material of materials) {
      if (purpose === 'planning' || isReady(material)) selectable.add(material.id)
    }
    return selectable
  }, [materials, purpose])

  const readyCount = useMemo(
    () => materials?.filter((m) => isReady(m)).length ?? 0,
    [materials],
  )

  if (!open) return null

  const excluded = new Set(excludeIds ?? [])
  const visible = materials?.filter((material) => !excluded.has(material.id)) ?? []

  const toggle = (id: string) => {
    if (!selectableIds.has(id)) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (max === undefined || next.size < max) next.add(id)
      return next
    })
  }

  const canContinue = selected.size > 0

  const planFor = (material: MaterialRecord): { minutes: number; role: MaterialRole } => {
    const edit = planEdits[material.id]
    return {
      minutes: edit?.minutes ?? material.estimatedMinutes ?? 60,
      role: edit?.role ?? 'foundation',
    }
  }

  const editPlan = (
    materialId: string,
    patch: { minutes?: number; role?: MaterialRole },
  ) => {
    setPlanEdits((current) => ({ ...current, [materialId]: { ...current[materialId], ...patch } }))
  }

  const handleContinue = () => {
    const picked = visible.filter((material) => selected.has(material.id))
    const selection = picked.map((material) => ({
      materialId: material.id,
      title: material.title,
      kind: material.kind,
    }))
    if (!withPlan) {
      onContinue(selection)
      return
    }
    onContinue(
      selection,
      Object.fromEntries(picked.map((material) => [material.id, planFor(material)])),
    )
  }

  return (
    <div className="material-sheet-layer">
      <div className="material-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className="material-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={purpose === 'generation' ? 'Choose materials for assessment' : 'Choose materials for planning'}
      >
        <div className="material-picker">
          <div className="material-picker-header">
            <div>
              <div className="mono-caps">
                {purpose === 'generation' ? 'New assessment' : 'Attach to roadmap'}
              </div>
              <h2 className="t-display-3" style={{ margin: '0.25rem 0 0.5rem' }}>
                Choose materials
              </h2>
              <p className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
                {purpose === 'generation'
                  ? 'Only Ready materials can ground generation. Contentless materials stay attachable for roadmap planning.'
                  : 'Contentless and non-ready materials stay attachable for planning.'}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
          </div>

          {loadError ? (
            <div className="banner attention">
              <div className="banner-body">
                <div className="banner-title">Could not load materials</div>
                <div className="banner-desc">{loadError}</div>
              </div>
            </div>
          ) : !materials ? (
            <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', padding: '1rem 0' }}>
              Loading materials…
            </p>
          ) : materials.length === 0 ? (
            <div className="material-picker-empty">
              <p className="t-body-sm">No materials to choose from yet.</p>
              <Link className="btn btn-secondary btn-sm" to="/materials/new" onClick={onClose}>
                Add a material
              </Link>
            </div>
          ) : visible.length === 0 ? (
            <div className="material-picker-empty">
              <p className="t-body-sm">Every library material is already on this roadmap.</p>
              <Link className="btn btn-secondary btn-sm" to="/materials/new" onClick={onClose}>
                Add a material
              </Link>
            </div>
          ) : (
            <div className="material-picker-list">
              {visible.map((material) => {
                const selectable = selectableIds.has(material.id)
                const checked = selected.has(material.id)
                const plan = planFor(material)
                return (
                  <div className="checkbox-entry" key={material.id}>
                  <label
                    className={`checkbox-row${checked ? ' checked' : ''}${!selectable ? ' is-disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={!selectable}
                      onChange={() => toggle(material.id)}
                    />
                    <span className="checkbox-box" aria-hidden="true" />
                    <div className="checkbox-body">
                      <div className="checkbox-title">{material.title}</div>
                      <div className="checkbox-desc">
                        {SOURCE_LABELS[material.kind]} ·{' '}
                        {selectable
                          ? 'Ready for generation'
                          : `Generation disabled · ${isProcessing(material) ? 'Processing' : 'Not ready'}`}
                      </div>
                    </div>
                    {!selectable && (
                      <Link
                        className="btn btn-ghost btn-sm"
                        to={`/materials/${material.id}`}
                        onClick={onClose}
                      >
                        View
                      </Link>
                    )}
                    {checked && <span className="tag tag-sm tag-moss">Selected</span>}
                  </label>
                  {withPlan && checked && (
                    <div className="checkbox-plan">
                      <label className="checkbox-plan-field">
                        <span className="checkbox-plan-label">Minutes</span>
                        <input
                          className="field"
                          type="number"
                          min={15}
                          step={15}
                          inputMode="numeric"
                          aria-label={`Minutes for ${material.title}`}
                          value={plan.minutes}
                          onChange={(event) =>
                            editPlan(material.id, { minutes: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="checkbox-plan-field">
                        <span className="checkbox-plan-label">Role</span>
                        <select
                          className="field"
                          aria-label={`Role for ${material.title}`}
                          value={plan.role}
                          onChange={(event) =>
                            editPlan(material.id, { role: event.target.value as MaterialRole })
                          }
                        >
                          {PLAN_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_TO_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="material-picker-footer">
            <span className="material-picker-count">
              {selected.size} selected · {readyCount} ready
            </span>
            <div className="material-picker-actions">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-accent"
                disabled={!canContinue}
                onClick={handleContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
