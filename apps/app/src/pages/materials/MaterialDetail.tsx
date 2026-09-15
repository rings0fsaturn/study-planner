import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { MaterialPicker } from '../../materials/MaterialPicker'
import { IngestionProgress, MaterialStatusBadge } from '../../materials/StatusBadge'
import '../../materials/materials.css'
import {
  SOURCE_FIELDS,
  SOURCE_LABELS,
  isContentless,
  isProcessing,
  isReady,
  type MaterialRecord,
  type MaterialSourceKind,
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

const REPLACE_SOURCES: MaterialSourceKind[] = ['url', 'manual', 'youtube']

/** While a material is still processing, refresh the detail row so a user who
 *  lands here straight from creation sees it reach ready without navigating. */
const PROCESSING_POLL_MS = 5000

function DeleteConfirm({
  material,
  usage,
  onConfirm,
  onCancel,
}: {
  material: MaterialRecord
  usage: string[]
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="material-confirm-layer">
      <div className="material-confirm-backdrop" onClick={onCancel} aria-hidden="true" />
      <div className="material-confirm" role="dialog" aria-modal="true" aria-label="Delete material">
        <div className="mono-caps">Permanent removal</div>
        <h3>Delete material?</h3>
        <p className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
          Deleting permanently removes <strong>{material.title}</strong> and its grounded source
          chunks. This cannot be undone. Existing attempts and history are kept.
        </p>
        {usage.length > 0 && (
          <div className="material-detail-block">
            <div className="mono-caps" style={{ marginBottom: '0.5rem' }}>
              Used by
            </div>
            <ul className="material-ref-list">
              {usage.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
            <p className="t-body-sm" style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
              These references keep their records but can no longer generate new grounded questions
              from this material.
            </p>
          </div>
        )}
        <div className="material-delete-actions">
          <button type="button" className="btn btn-destructive" onClick={onConfirm}>
            {usage.length > 0 ? 'Delete anyway' : 'Delete material'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function MaterialDetail() {
  const { materialId } = useParams<{ materialId: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const client = useMaterialsClient()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [replaceMode, setReplaceMode] = useState(params.get('replace') === '1')
  const [confirmDelete, setConfirmDelete] = useState(params.get('confirm') === 'delete')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerResult, setPickerResult] = useState<string[] | null>(null)
  const [replaceSource, setReplaceSource] = useState<MaterialSourceKind | null>(null)
  const [replaceValue, setReplaceValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load material')
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [client, materialId])

  // The detail row is fetched once; a direct landing (e.g. right after
  // creation) must still observe worker progress, so poll while processing.
  // The interval stops itself as soon as a ready row is observed, so it can
  // never keep fetching after the material is ready.
  useEffect(() => {
    if (!material || isReady(material)) return
    let cancelled = false
    const timer = setInterval(() => {
      void client
        .getMaterial(material.id)
        .then((record) => {
          if (cancelled) return
          setMaterial((current) => {
            if (!current || current.updatedAt === record.updatedAt) return current
            return record
          })
          if (isReady(record)) clearInterval(timer)
        })
        .catch(() => {
          // Keep the last known row; the next tick retries.
        })
    }, PROCESSING_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [client, material?.id])

  // Library materials are not yet linked to roadmaps or assessments; the
  // attachment pointers arrive with the assessment slice (#38).
  const usage: string[] = []

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
            <div className="banner-desc">{error ?? 'Material not found.'}</div>
          </div>
        </div>
      </div>
    )
  }

  const ready = isReady(material)
  const processing = isProcessing(material)
  const contentless = isContentless(material)
  const record = material

  async function toggleArchive() {
    setBusy(true)
    setActionError(null)
    try {
      if (record.archived) await client.restoreMaterial(record.id)
      else await client.archiveMaterial(record.id)
      setMaterial({ ...record, archived: !record.archived })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function retry() {
    setBusy(true)
    setActionError(null)
    try {
      await client.retryIngestion(record.id)
      setMaterial({
        ...record,
        ingestionState: 'pending',
        ingestionProgress: 0,
        ingestionError: null,
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitReplace() {
    if (!replaceSource) return
    setBusy(true)
    setActionError(null)
    try {
      await client.replaceMaterial(record.id, {
        title: record.title,
        kind: replaceSource,
        source: replaceValue.trim(),
        estimatedMinutes: record.estimatedMinutes,
      })
      setMaterial({
        ...record,
        kind: replaceSource,
        source: replaceValue.trim(),
        ingestionState: 'pending',
        ingestionProgress: 0,
        ingestionError: null,
        replacedAt: new Date().toISOString(),
        contentVersion: crypto.randomUUID(),
      })
      setReplaceMode(false)
      setReplaceSource(null)
      setReplaceValue('')
      const next = new URLSearchParams(params)
      next.delete('replace')
      setParams(next, { replace: true })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Replace failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setActionError(null)
    try {
      await client.deleteMaterial(record.id)
      navigate('/materials', { replace: true })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <div className="materials-page">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/materials')}>
        ← Back to library
      </button>

      <div className="material-detail" style={{ marginTop: '1rem' }}>
        <div className="material-detail-head">
          <div>
            <div className="mono-caps">{SOURCE_LABELS[material.kind]}</div>
            <h2>{material.title}</h2>
            <div className="material-detail-meta">
              {formatMinutes(material.estimatedMinutes)} · added {formatDate(material.createdAt)}
              {material.archived && ' · archived'}
              {contentless && ' · contentless (planning only)'}
            </div>
          </div>
          <div className="material-detail-status">
            <MaterialStatusBadge
              status={material.ingestionState}
              detail={material.ingestionError ?? undefined}
            />
          </div>
        </div>

        {actionError && (
          <div className="banner attention" style={{ marginBottom: '1rem' }}>
            <div className="banner-body">
              <div className="banner-title">Action failed</div>
              <div className="banner-desc">{actionError}</div>
            </div>
          </div>
        )}

        {processing && !replaceMode && (
          <div className="material-detail-block">
            <IngestionProgress status={material.ingestionState} />
            <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
              Grounded generation is disabled until this material is ready.
            </p>
          </div>
        )}

        {material.ingestionState === 'failed' && !replaceMode && (
          <div className="banner attention" style={{ marginBottom: '1rem' }}>
            <div className="banner-body">
              <div className="banner-title">Ingestion failed</div>
              <div className="banner-desc">
                {material.ingestionError ?? 'The source could not be processed.'}
              </div>
            </div>
            <button type="button" className="banner-action-btn" onClick={() => void retry()} disabled={busy}>
              Retry
            </button>
          </div>
        )}

        {material.replacedAt && !replaceMode && (
          <div className="banner warning" style={{ marginBottom: '1rem' }}>
            <div className="banner-body">
              <div className="banner-title">Grounding may be stale</div>
              <div className="banner-desc">
                This material was replaced. Existing assessments keep their content; regenerate
                before creating new questions (arrives with the assessment slice).
              </div>
            </div>
          </div>
        )}

        {!replaceMode && (
          <>
            {ready && (
              <div className="material-detail-actions">
                <Link className="btn btn-accent" to={`/materials/${material.id}/practice`}>
                  Practice this
                </Link>
                <Link className="btn btn-secondary" to={`/materials/${material.id}/assessments/new`}>
                  Generate assessment
                </Link>
                {material.kind === 'file' && (
                  <Link className="btn btn-secondary" to={`/materials/${material.id}/view`}>
                    Open in viewer
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPickerOpen(true)}
                >
                  Attach to assessment
                </button>
              </div>
            )}
            {material.ingestionState === 'failed' && (
              <div className="material-detail-actions">
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={() => void retry()}
                  disabled={busy}
                >
                  Retry ingestion
                </button>
              </div>
            )}

            <div className="material-detail-block">
              <h3 className="t-display-3" style={{ fontSize: '18px', marginBottom: '0.75rem' }}>
                Used by
              </h3>
              {usage.length === 0 ? (
                <p className="t-body-sm">
                  Not attached to any roadmap yet. Assessments will appear here once created.
                </p>
              ) : (
                <ul className="material-ref-list">
                  {usage.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="material-detail-actions material-detail-actions-lower">
              <button type="button" className="btn btn-secondary" onClick={() => setReplaceMode(true)}>
                Replace keep-ID
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void toggleArchive()}
                disabled={busy}
              >
                {material.archived ? 'Restore' : 'Archive'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            </div>
          </>
        )}

        {replaceMode && (
          <div className="material-replace-form">
            <div className="banner warning" style={{ marginBottom: '1rem' }}>
              <div className="banner-body">
                <div className="banner-title">Replacing keeps this material's identity</div>
                <div className="banner-desc">
                  Roadmap references and existing assessments keep pointing at it. Dependent
                  content is marked stale until you regenerate questions.
                </div>
              </div>
            </div>
            <p className="t-body-sm" style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              New source for <strong>{material.title}</strong>
            </p>
            <div className="material-source-grid material-source-grid-sm">
              {REPLACE_SOURCES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`choice${replaceSource === type ? ' selected' : ''}`}
                  onClick={() => setReplaceSource(type)}
                >
                  <div className="choice-title">{SOURCE_LABELS[type]}</div>
                </button>
              ))}
            </div>
            {replaceSource && (
              <div className="material-create-form">
                <div className="field-group" style={{ maxWidth: '100%' }}>
                  <label className="field-label">{SOURCE_FIELDS[replaceSource].label}</label>
                  {SOURCE_FIELDS[replaceSource].textarea ? (
                    <textarea
                      className="field field-textarea"
                      rows={6}
                      placeholder={SOURCE_FIELDS[replaceSource].placeholder}
                      value={replaceValue}
                      onChange={(event) => setReplaceValue(event.target.value)}
                    />
                  ) : (
                    <input
                      className="field"
                      placeholder={SOURCE_FIELDS[replaceSource].placeholder}
                      value={replaceValue}
                      onChange={(event) => setReplaceValue(event.target.value)}
                    />
                  )}
                </div>
                <div className="material-create-actions">
                  <button
                    type="button"
                    className="btn btn-accent"
                    disabled={busy || replaceValue.trim() === ''}
                    onClick={() => void submitReplace()}
                  >
                    Replace and re-process
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setReplaceMode(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {pickerOpen && (
        <MaterialPicker
          open
          purpose="generation"
          onClose={() => setPickerOpen(false)}
          onContinue={(selection) => {
            setPickerOpen(false)
            setPickerResult(selection.map((picked) => picked.materialId))
          }}
        />
      )}

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

      {confirmDelete && (
        <DeleteConfirm
          material={material}
          usage={usage}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setConfirmDelete(false)
            const next = new URLSearchParams(params)
            next.delete('confirm')
            setParams(next, { replace: true })
          }}
        />
      )}
    </div>
  )
}
