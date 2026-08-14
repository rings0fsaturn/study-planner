import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import '../../materials/materials.css'
import {
  SOURCE_FIELDS,
  SOURCE_LABELS,
  type MaterialSourceKind,
} from '../../materials/types'

const CREATE_SOURCES: Array<{ kind: MaterialSourceKind; description: string }> = [
  { kind: 'file', description: 'Upload a PDF to your private library and process it server-side.' },
  { kind: 'url', description: 'Paste a web article or documentation link.' },
  { kind: 'manual', description: 'Type or paste raw text directly.' },
  { kind: 'youtube', description: 'Use a public YouTube transcript.' },
]

export function MaterialCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const client = useMaterialsClient()

  const [kind, setKind] = useState<MaterialSourceKind | null>(null)
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [estimatedMinutes, setEstimatedMinutes] = useState('60')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function validate(): boolean {
    let valid = true
    setTitleError(null)
    setSourceError(null)
    if (title.trim() === '') {
      setTitleError('Give this material a title.')
      valid = false
    }
    if (kind === 'file' && !file) {
      setSourceError('Choose a PDF file to upload.')
      valid = false
    }
    if (kind && kind !== 'file' && kind !== 'manual' && source.trim() === '') {
      setSourceError('A source is required for this material type.')
      valid = false
    }
    return valid
  }

  async function submit() {
    if (!kind || !validate()) return
    setBusy(true)
    setSubmitError(null)
    try {
      const created = await client.createMaterial({
        clientId: crypto.randomUUID(),
        title: title.trim(),
        kind,
        source: kind === 'file' && file ? file.name : source.trim(),
        estimatedMinutes: estimatedMinutes === '' ? null : Number(estimatedMinutes),
      })
      if (kind === 'file' && file) {
        try {
          await client.uploadMaterialFile(created.id, file)
          await client.completeUpload(created.id)
        } catch {
          await client.markUploadFailed(
            created.id,
            'Upload failed. Check the connection and retry from the material page.',
          )
          navigate(`/materials/${created.id}`, {
            replace: Boolean(params.get('from')),
          })
          return
        }
      }
      navigate(`/materials/${created.id}`, {
        replace: Boolean(params.get('from')),
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create material')
      setBusy(false)
    }
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    setFile(next)
    if (next && title.trim() === '') {
      setTitle(next.name.replace(/\.[^.]+$/, ''))
    }
  }

  return (
    <div className="materials-page">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
        ← Cancel
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        Add material
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Choose a source type. The file or text is uploaded to your private library and processed
        server-side.
      </p>

      <div className="material-source-grid">
        {CREATE_SOURCES.map(({ kind: sourceKind, description }) => (
          <button
            key={sourceKind}
            type="button"
            className={`choice${kind === sourceKind ? ' selected' : ''}`}
            onClick={() => setKind(sourceKind)}
          >
            <div className="choice-title">{SOURCE_LABELS[sourceKind]}</div>
            <div className="choice-desc">{description}</div>
          </button>
        ))}
      </div>

      {kind && (
        <div className="material-create-form">
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label" htmlFor="material-title">
              Title
            </label>
            <input
              id="material-title"
              className={`field${titleError ? ' has-error' : ''}`}
              placeholder="e.g. Raft consensus paper"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {titleError && <div className="field-helper error">{titleError}</div>}
          </div>
          {kind === 'file' && (
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label" htmlFor="material-file">
                PDF file
              </label>
              <input
                id="material-file"
                ref={fileInputRef}
                className={`field${sourceError ? ' has-error' : ''}`}
                type="file"
                accept="application/pdf"
                onChange={pickFile}
              />
              {sourceError && <div className="field-helper error">{sourceError}</div>}
              {file && <div className="field-helper">Uploading {file.name} to your private library.</div>}
            </div>
          )}
          {kind !== 'file' && kind !== 'manual' && (
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label" htmlFor="material-source">
                {SOURCE_FIELDS[kind].label}
              </label>
              {SOURCE_FIELDS[kind].textarea ? (
                <textarea
                  id="material-source"
                  className={`field field-textarea${sourceError ? ' has-error' : ''}`}
                  rows={6}
                  placeholder={SOURCE_FIELDS[kind].placeholder}
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                />
              ) : (
                <input
                  id="material-source"
                  className={`field${sourceError ? ' has-error' : ''}`}
                  placeholder={SOURCE_FIELDS[kind].placeholder}
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                />
              )}
              {sourceError && <div className="field-helper error">{sourceError}</div>}
            </div>
          )}
          {kind === 'manual' && (
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label" htmlFor="material-source">
                Plain text{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  (optional — leave empty for a contentless planning material)
                </span>
              </label>
              <textarea
                id="material-source"
                className="field field-textarea"
                rows={6}
                placeholder="Paste text here, or leave empty to create a planning-only material…"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            </div>
          )}
          <div className="field-group" style={{ maxWidth: '240px' }}>
            <label className="field-label" htmlFor="material-minutes">
              Estimated study time (minutes)
            </label>
            <input
              id="material-minutes"
              className="field"
              type="number"
              min={0}
              value={estimatedMinutes}
              onChange={(event) => setEstimatedMinutes(event.target.value)}
            />
          </div>

          {submitError && (
            <div className="banner attention" style={{ marginTop: '1rem' }}>
              <div className="banner-body">
                <div className="banner-title">Could not add material</div>
                <div className="banner-desc">{submitError}</div>
              </div>
            </div>
          )}

          <div className="material-create-actions">
            <button
              type="button"
              className="btn btn-accent"
              disabled={busy || !kind}
              onClick={() => void submit()}
            >
              Add and process
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
