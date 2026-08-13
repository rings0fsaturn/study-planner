import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { MaterialPicker, type MaterialPickerPurpose } from '../../materials/MaterialPicker'
import { MaterialStatusBadge } from '../../materials/StatusBadge'
import { useMaterialLibrary } from '../../materials/useMaterialLibrary'
import '../../materials/materials.css'
import {
  SOURCE_LABELS,
  isContentless,
  isReady,
  type IngestionState,
  type MaterialRecord,
} from '../../materials/types'

function formatMinutes(mins: number | null): string {
  if (!mins) return 'Unknown duration'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sourceIconClass(material: MaterialRecord): string {
  if (material.kind === 'youtube') return 'yt'
  if (material.kind === 'manual' || isContentless(material)) return 'notes'
  return 'art'
}

function sourceIconLabel(material: MaterialRecord): string {
  if (material.kind === 'youtube') return 'YT'
  if (material.kind === 'manual') return 'TXT'
  return material.kind === 'file' ? 'PDF' : 'URL'
}

type StatusFilter = IngestionState | 'all' | 'processing'

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
]

export function MaterialLibrary() {
  const navigate = useNavigate()
  const client = useMaterialsClient()
  const [showArchived, setShowArchived] = useState(false)
  const { materials, status, error, reload, setMaterials } = useMaterialLibrary({
    includeArchived: showArchived,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [picker, setPicker] = useState<MaterialPickerPurpose | null>(null)
  const [pickerResult, setPickerResult] = useState<string[] | null>(null)

  const visible = useMemo(() => {
    if (!materials) return []
    const query = search.trim().toLowerCase()
    return materials.filter((m) => {
      if (!showArchived && m.archived) return false
      if (statusFilter === 'processing' && (isReady(m) || m.ingestionState === 'failed')) return false
      if (statusFilter !== 'all' && statusFilter !== 'processing' && m.ingestionState !== statusFilter) {
        return false
      }
      if (query && !m.title.toLowerCase().includes(query)) return false
      return true
    })
  }, [materials, search, statusFilter, showArchived])

  async function toggleArchive(material: MaterialRecord) {
    setMenuOpenId(null)
    try {
      if (material.archived) await client.restoreMaterial(material.id)
      else await client.archiveMaterial(material.id)
      setMaterials((current) =>
        current.map((m) => (m.id === material.id ? { ...m, archived: !m.archived } : m)),
      )
    } catch {
      // Surface transient failures by reloading so the row reflects server truth.
      void reload()
    }
  }

  function openCard(id: string) {
    navigate(`/materials/${id}`)
  }

  function MaterialCard({ material }: { material: MaterialRecord }) {
    const ready = isReady(material)
    const menuOpen = menuOpenId === material.id
    return (
      <div
        className={`material-card${material.replacedAt ? ' is-stale' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => openCard(material.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openCard(material.id)
          }
        }}
      >
        <div className={`material-icon ${sourceIconClass(material)}`}>{sourceIconLabel(material)}</div>
        <div className="material-body">
          <div className="material-title">
            {material.title}
            {material.replacedAt && (
              <span className="material-stale-dot" title="Dependent content may be stale" />
            )}
          </div>
          <div className="material-meta">
            {SOURCE_LABELS[material.kind]} · {formatMinutes(material.estimatedMinutes)} · added{' '}
            {formatDate(material.createdAt)}
            {material.archived && ' · archived'}
          </div>
          {!ready && (
            <div className="material-row-status">
              <MaterialStatusBadge
                status={material.ingestionState}
                detail={material.ingestionError ?? undefined}
              />
              <span className="material-wait-note">Generation disabled until ready</span>
            </div>
          )}
        </div>
        <div className="material-card-actions-wrap">
          <div className="material-card-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(event) => {
                event.stopPropagation()
                openCard(material.id)
              }}
            >
              View
            </button>
            {ready && (
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(`/materials/${material.id}/practice`)
                }}
              >
                Practice this
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm material-card-more"
              aria-label={`More actions for ${material.title}`}
              onClick={(event) => {
                event.stopPropagation()
                setMenuOpenId(menuOpen ? null : material.id)
              }}
            >
              ⋯
            </button>
          </div>
          {menuOpen && (
            <div className="material-overflow-menu" role="menu" aria-label={`Actions for ${material.title}`}>
              <button
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation()
                  void toggleArchive(material)
                }}
              >
                {material.archived ? 'Restore' : 'Archive'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpenId(null)
                  navigate(`/materials/${material.id}?replace=1`)
                }}
              >
                Replace keep-ID
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpenId(null)
                  navigate(`/materials/${material.id}?confirm=delete`)
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function LibraryGrid() {
    if (!materials) {
      return (
        <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          Loading materials…
        </p>
      )
    }
    if (materials.length === 0) {
      return (
        <div className="materials-empty">
          <h3 className="t-display-3">Your library is empty</h3>
          <p>
            Add a PDF, web article, plain text, or YouTube video. Materials become reusable
            across roadmaps, assessments, and practice.
          </p>
          <button type="button" className="btn btn-accent" onClick={() => navigate('/materials/new')}>
            Add your first material
          </button>
        </div>
      )
    }
    if (visible.length === 0) {
      return (
        <div className="materials-empty">
          <h3 className="t-display-3">No materials in view</h3>
          <p>
            Nothing matches the current filters{showArchived ? '' : ', or every material is archived'}.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setShowArchived(true)
              setSearch('')
              setStatusFilter('all')
            }}
          >
            Reset filters
          </button>
        </div>
      )
    }
    return (
      <div className="materials-grid">
        {visible.map((material) => (
          <MaterialCard key={material.id} material={material} />
        ))}
      </div>
    )
  }

  return (
    <div className="materials-page">
      <div className="materials-head">
        <div>
          <div className="mono-caps">Materials</div>
          <h1>Material library</h1>
        </div>
        <div className="materials-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPicker('generation')}
          >
            Select for assessment
          </button>
          <button type="button" className="btn btn-accent" onClick={() => navigate('/materials/new')}>
            Add material
          </button>
        </div>
      </div>

      <div className="materials-toolbar">
        <div className="materials-filters">
          <input
            className="field materials-search"
            type="search"
            placeholder="Search materials…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search materials"
          />
          <select
            className="field"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="materials-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span>Show archived</span>
          </label>
          <span className="materials-count">
            {visible.length} material{visible.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {pickerResult && (
        <div className="banner success materials-notice">
          <div className="banner-body">
            <div className="banner-title">
              {pickerResult.length} material{pickerResult.length !== 1 ? 's' : ''} selected
            </div>
            <div className="banner-desc">
              Assessment creation arrives with the next Phase 2 slice. The selection is ready to
              attach.
            </div>
          </div>
          <button type="button" className="banner-action-btn" onClick={() => setPickerResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="banner attention" style={{ marginBottom: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Could not load materials</div>
            <div className="banner-desc">{error}</div>
          </div>
          <button type="button" className="banner-action-btn" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      )}

      <LibraryGrid />

      {menuOpenId && <div className="material-menu-catcher" onClick={() => setMenuOpenId(null)} />}

      {picker && (
        <MaterialPicker
          open
          purpose={picker}
          onClose={() => setPicker(null)}
          onContinue={(ids) => {
            setPicker(null)
            setPickerResult(ids)
          }}
        />
      )}
    </div>
  )
}
