import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { MaterialPicker } from '../../materials/MaterialPicker'
import { MaterialStatusBadge } from '../../materials/StatusBadge'
import '../../materials/materials.css'
import { SOURCE_LABELS, isReady, type MaterialRecord } from '../../materials/types'

const FOCUS_OPTIONS = ['Written', 'Coding', 'Mixed'] as const
const DIFFICULTY_OPTIONS = ['Adaptive', '1', '2', '3', '4', '5'] as const

function formatMinutes(mins: number | null): string {
  if (!mins) return 'Unknown duration'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

export function PracticeThis() {
  const { materialId } = useParams<{ materialId: string }>()
  const navigate = useNavigate()
  const client = useMaterialsClient()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [questionCount, setQuestionCount] = useState(5)
  const [focus, setFocus] = useState<(typeof FOCUS_OPTIONS)[number]>('Mixed')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>('Adaptive')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [extraMaterials, setExtraMaterials] = useState<MaterialRecord[]>([])
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!materialId) return
    let cancelled = false
    setStatus('loading')
    void client
      .getMaterial(materialId)
      .then((record) => {
        if (!cancelled) {
          setMaterial(record)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [client, materialId])

  if (!materialId) return null

  if (status === 'loading') {
    return (
      <div className="materials-page">
        <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          Loading material…
        </p>
      </div>
    )
  }

  if (status === 'error' || !material) {
    return (
      <div className="materials-page">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/materials')}>
          ← Back to library
        </button>
        <div className="banner attention" style={{ marginTop: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Could not load material</div>
            <div className="banner-desc">The material may have been deleted.</div>
          </div>
        </div>
      </div>
    )
  }

  if (!isReady(material)) {
    // Practice is grounded in extracted content: a direct route to a
    // processing or failed material must not offer a run.
    return (
      <div className="materials-page">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(`/materials/${material.id}`)}
        >
          ← Back to material
        </button>
        <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
          Practice this
        </h1>
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Material is not ready yet</div>
            <div className="banner-desc">
              Practice runs are grounded in the extracted content. Wait for ingestion to finish or
              retry the material first.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="materials-page">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/materials/${material.id}`)}>
        ← Back to material
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        Practice this
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Start a guided practice run grounded in <strong>{material.title}</strong>.
      </p>

      <div className="card card-large" style={{ maxWidth: '640px' }}>
        <div className="card-title">
          {material.title}
          <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
            {SOURCE_LABELS[material.kind]} · {formatMinutes(material.estimatedMinutes)}
          </span>
        </div>
        <div className="card-meta">
          <MaterialStatusBadge status={material.ingestionState} />
          {extraMaterials.length > 0 && ` · +${extraMaterials.length} more material${extraMaterials.length !== 1 ? 's' : ''}`}
        </div>
        <div className="material-practice-options">
          <div className="field-group" style={{ maxWidth: '200px' }}>
            <label className="field-label" htmlFor="practice-count">
              Number of questions
            </label>
            <input
              id="practice-count"
              className="field"
              type="number"
              min={1}
              max={20}
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
            />
          </div>
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label">Focus</label>
            <div className="chip-row">
              {FOCUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip${focus === option ? ' selected' : ''}`}
                  onClick={() => setFocus(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label">Difficulty</label>
            <div className="chip-row">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip${difficulty === option ? ' selected' : ''}`}
                  onClick={() => setDifficulty(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="material-practice-actions">
          <button type="button" className="btn btn-accent" onClick={() => setStarted(true)}>
            Start practice run
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
            Add another material
          </button>
        </div>
      </div>

      {started && (
        <div className="banner success materials-notice" style={{ marginTop: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Practice run ready</div>
            <div className="banner-desc">
              {questionCount} question{questionCount !== 1 ? 's' : ''}, {focus.toLowerCase()} focus,{' '}
              {difficulty.toLowerCase()} difficulty. Practice runs arrive with the next Phase 2
              slice; the configuration is ready to attach.
            </div>
          </div>
          <button type="button" className="banner-action-btn" onClick={() => setStarted(false)}>
            Dismiss
          </button>
        </div>
      )}

      {pickerOpen && (
        <MaterialPicker
          open
          purpose="generation"
          max={5}
          initialSelected={[material.id]}
          onClose={() => setPickerOpen(false)}
          onContinue={async (ids) => {
            setPickerOpen(false)
            const records: MaterialRecord[] = []
            for (const id of ids) {
              if (id === material.id) continue
              try {
                records.push(await client.getMaterial(id))
              } catch {
                // Ignore individual failures; keep the confirmed set.
              }
            }
            setExtraMaterials(records)
          }}
        />
      )}
    </div>
  )
}
