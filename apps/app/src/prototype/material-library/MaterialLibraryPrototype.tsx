// PROTOTYPE — throwaway. Material Library and attachment UX for wayfinder #33.
// Answers: "How should the material library, picker, and 'Practice this' flow look and feel?"
// Covers library, detail, create, ingestion progress, failed/retry, archive/restore, stale,
// referenced-delete, multi-material picker, and Practice-this entry. Nothing persists.
//
// Locked decisions this obeys (map #4 / spec #32 + 2026-08-13 grilling Q1–Q22):
//   · material is server-first, one material = one ingested body
//   · ingestion lifecycle: pending → extracting → chunking → embedding → ready (+ failed)
//   · RAG generation enabled only when material status = ready
//   · contentless materials are valid for roadmap planning, NOT for assessment/practice pickers
//   · library = responsive card grid (compact desktop, spacious mobile)
//   · card = primary action (View; Practice this when ready) + overflow (archive/replace/delete)
//   · status inline only when not ready; ready stays quiet
//   · non-ready materials open detail (readiness-led actions), never a dead end
//   · archived hidden by default; Show archived filter + restore from detail
//   · assessment/practice picker = ready-only; bottom sheet on mobile, side panel on desktop
//   · picker footer persistent with selected count + Continue
//   · replace keep-ID = inline replacement mode on detail
//   · referenced delete = allowed, permanent-source-removal warning
//   · Practice this = dedicated configuration page
//   · empty states are context-aware (first material vs filtered-out)

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './material-library.css';

type IngestStatus = 'pending' | 'extracting' | 'chunking' | 'embedding' | 'ready' | 'failed';
type SourceType = 'pdf' | 'url' | 'text' | 'youtube';
type ViewState =
  | 'library'
  | 'detail'
  | 'create'
  | 'progress'
  | 'failed'
  | 'archive'
  | 'stale'
  | 'referenced-delete'
  | 'picker'
  | 'practice-this';

interface Material {
  id: string;
  title: string;
  sourceType: SourceType;
  status: IngestStatus;
  statusDetail?: string;
  estimatedMinutes: number;
  archived: boolean;
  stale: boolean;
  referencedBy: string[];
  createdAt: string;
}

const STATUS_LABELS: Record<IngestStatus, string> = {
  pending: 'Pending',
  extracting: 'Extracting',
  chunking: 'Chunking',
  embedding: 'Embedding',
  ready: 'Ready',
  failed: 'Failed',
};

const STATUS_INDEX: Record<IngestStatus, number> = {
  pending: 0,
  extracting: 1,
  chunking: 2,
  embedding: 3,
  ready: 4,
  failed: -1,
};

const SOURCE_ICONS: Record<SourceType, string> = {
  pdf: 'PDF',
  url: 'URL',
  text: 'TXT',
  youtube: 'YT',
};

const SOURCE_LABELS: Record<SourceType, string> = {
  pdf: 'PDF document',
  url: 'Web article',
  text: 'Plain text',
  youtube: 'YouTube video',
};

const MOCK_MATERIALS: Material[] = [
  {
    id: 'm1',
    title: 'Operating Systems — Three Easy Pieces',
    sourceType: 'pdf',
    status: 'ready',
    estimatedMinutes: 420,
    archived: false,
    stale: false,
    referencedBy: ['Active roadmap', 'Midterm assessment'],
    createdAt: '2026-07-15T10:00:00Z',
  },
  {
    id: 'm2',
    title: 'Database Internals: A Deep Dive',
    sourceType: 'pdf',
    status: 'extracting',
    statusDetail: 'Parsing pages 34 of 412',
    estimatedMinutes: 360,
    archived: false,
    stale: false,
    referencedBy: ['Active roadmap'],
    createdAt: '2026-08-01T09:30:00Z',
  },
  {
    id: 'm3',
    title: 'YouTube: Raft Consensus Explained',
    sourceType: 'youtube',
    status: 'embedding',
    statusDetail: 'Embedding 18 chunks',
    estimatedMinutes: 45,
    archived: false,
    stale: false,
    referencedBy: [],
    createdAt: '2026-08-05T14:20:00Z',
  },
  {
    id: 'm4',
    title: 'Designing Data-Intensive Applications (chapter 5)',
    sourceType: 'url',
    status: 'failed',
    statusDetail: 'Fetch timeout after 30 s',
    estimatedMinutes: 90,
    archived: false,
    stale: false,
    referencedBy: [],
    createdAt: '2026-08-02T11:00:00Z',
  },
  {
    id: 'm5',
    title: 'Old ML course notes',
    sourceType: 'text',
    status: 'ready',
    estimatedMinutes: 60,
    archived: true,
    stale: false,
    referencedBy: [],
    createdAt: '2026-06-10T08:00:00Z',
  },
  {
    id: 'm6',
    title: 'Networking — TCP/IP illustrated',
    sourceType: 'pdf',
    status: 'ready',
    estimatedMinutes: 240,
    archived: false,
    stale: true,
    referencedBy: ['Active roadmap', 'Quiz #3'],
    createdAt: '2026-07-20T16:00:00Z',
  },
];

function statusPercent(status: IngestStatus): number {
  if (status === 'failed') return 0;
  const idx = STATUS_INDEX[status];
  return Math.round((idx / 4) * 100);
}

function statusTagClass(status: IngestStatus): string {
  switch (status) {
    case 'ready':
      return 'tag-moss';
    case 'failed':
      return 'tag-rust';
    case 'pending':
      return '';
    default:
      return 'tag-terracotta';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}

function StatusBadge({ status, detail }: { status: IngestStatus; detail?: string }) {
  return (
    <span className="ml-status" title={detail}>
      <span className={`tag tag-sm ${statusTagClass(status)}`}>{STATUS_LABELS[status]}</span>
      {detail && <span className="ml-status-detail">{detail}</span>}
    </span>
  );
}

function ProgressBar({ status }: { status: IngestStatus }) {
  const pct = statusPercent(status);
  return (
    <div className="ml-progress" aria-label={`Ingestion progress ${pct}%`}>
      <div className="progress">
        <div
          className={`progress-fill ${status === 'failed' ? 'behind' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="ml-progress-label">
        {['pending', 'extracting', 'chunking', 'embedding', 'ready'].map((s, i) => (
          <span key={s} className={STATUS_INDEX[status] >= i ? 'is-done' : ''}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MaterialLibraryPrototype() {
  const [params, setParams] = useSearchParams();
  const view: ViewState = (params.get('view') as ViewState) ?? 'library';

  const [materials, setMaterials] = useState<Material[]>(MOCK_MATERIALS);
  const [selectedId, setSelectedId] = useState<string | null>('m1');
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set(['m1']));
  const [createSource, setCreateSource] = useState<SourceType | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [replaceModeId, setReplaceModeId] = useState<string | null>(null);

  const selected = useMemo(
    () => materials.find((m) => m.id === selectedId) ?? materials[0],
    [materials, selectedId],
  );

  const visibleMaterials = useMemo(
    () => materials.filter((m) => showArchived || !m.archived),
    [materials, showArchived],
  );

  function setStatus(id: string, status: IngestStatus, detail?: string) {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status, statusDetail: detail } : m)),
    );
  }

  function toggleArchive(id: string) {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, archived: !m.archived } : m)));
  }

  function deleteMaterial(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  function togglePicker(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function retryMaterial(id: string) {
    setStatus(id, 'extracting', 'Retrying extraction…');
    window.setTimeout(() => setStatus(id, 'ready'), 1800);
  }

  function go(state: ViewState, id?: string) {
    if (id) setSelectedId(id);
    if (state !== 'detail') setReplaceModeId(null);
    const next = new URLSearchParams(params);
    next.set('view', state);
    setParams(next, { replace: true });
  }

  function openReplace(id: string) {
    setMenuOpenId(null);
    setReplaceModeId(id);
    go('detail', id);
  }

  function submitReplace(material: Material) {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === material.id ? { ...m, status: 'pending', statusDetail: 'Replacement queued', stale: true } : m,
      ),
    );
    setReplaceModeId(null);
    go('library');
  }

  function LibraryToolbar() {
    return (
      <div className="ml-toolbar">
        <div className="ml-toolbar-filters">
          <label className="ml-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Show archived</span>
          </label>
          <span className="ml-count">{visibleMaterials.length} material{visibleMaterials.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="ml-toolbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => go('picker')}>
            Select for assessment
          </button>
          <button className="btn btn-accent" onClick={() => go('create')}>
            Add material
          </button>
        </div>
      </div>
    );
  }

  function MaterialCard({ material }: { material: Material }) {
    const ready = material.status === 'ready';
    const menuOpen = menuOpenId === material.id;
    return (
      <div
        className={`material-row ml-card${material.stale ? ' is-stale' : ''}`}
        onClick={() => go('detail', material.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go('detail', material.id);
          }
        }}
      >
        <div className={`material-icon ${material.sourceType === 'youtube' ? 'yt' : material.sourceType === 'text' ? 'notes' : 'art'}`}>
          {SOURCE_ICONS[material.sourceType]}
        </div>
        <div className="material-body">
          <div className="material-title">
            {material.title}
            {material.stale && <span className="ml-stale-dot" title="Dependent content may be stale" />}
          </div>
          <div className="material-meta">
            {SOURCE_LABELS[material.sourceType]} · {formatMinutes(material.estimatedMinutes)} · added {formatDate(material.createdAt)}
            {material.archived && ' · archived'}
          </div>
          {!ready && (
            <div className="ml-row-status">
              <StatusBadge status={material.status} detail={material.statusDetail} />
              <span className="ml-wait-note">Generation disabled until ready</span>
            </div>
          )}
        </div>
        <div className="ml-card-actions-wrap">
          <div className="ml-card-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                go('detail', material.id);
              }}
            >
              View
            </button>
            {ready && (
              <button
                className="btn btn-accent btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  go('practice-this', material.id);
                }}
              >
                Practice this
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm ml-card-more"
              aria-label={`More actions for ${material.title}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(menuOpen ? null : material.id);
              }}
            >
              ⋯
            </button>
          </div>
          {menuOpen && (
            <div className="ml-overflow-menu" role="menu" aria-label={`Actions for ${material.title}`}>
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleArchive(material.id);
                  setMenuOpenId(null);
                }}
              >
                {material.archived ? 'Restore' : 'Archive'}
              </button>
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  openReplace(material.id);
                }}
              >
                Replace keep-ID
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(null);
                  go('referenced-delete', material.id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function LibraryGrid() {
    if (visibleMaterials.length === 0) {
      if (materials.length === 0) {
        return (
          <div className="ml-empty">
            <h3 className="t-display-3">Your library is empty</h3>
            <p>
              Add a PDF, web article, plain text, or YouTube video. Materials become reusable
              across roadmaps, assessments, and practice.
            </p>
            <button className="btn btn-accent" onClick={() => go('create')}>
              Add your first material
            </button>
          </div>
        );
      }
      return (
        <div className="ml-empty">
          <h3 className="t-display-3">No materials in view</h3>
          <p>Every material is archived. Turn on “Show archived” to see them, or add a new one.</p>
          <button className="btn btn-secondary" onClick={() => setShowArchived(true)}>
            Show archived
          </button>
        </div>
      );
    }
    return (
      <div className="ml-grid">
        {visibleMaterials.map((m) => (
          <MaterialCard key={m.id} material={m} />
        ))}
      </div>
    );
  }

  function LibraryView() {
    return (
      <div className="ml-view">
        <LibraryToolbar />
        <LibraryGrid />
      </div>
    );
  }

  function ReplaceForm({ material }: { material: Material }) {
    const [source, setSource] = useState<SourceType | null>(null);
    return (
      <div className="ml-replace-form">
        <div className="banner warning" style={{ marginBottom: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Replacing keeps this material's identity</div>
            <div className="banner-desc">
              Roadmap references and existing assessments keep pointing at it. Dependent content
              is marked stale until you regenerate questions.
            </div>
          </div>
        </div>
        <p className="t-body-sm" style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          New source for <strong>{material.title}</strong>
        </p>
        <div className="ml-source-grid ml-source-grid-sm">
          {(['pdf', 'url', 'text', 'youtube'] as SourceType[]).map((type) => (
            <button
              key={type}
              className={`choice${source === type ? ' selected' : ''}`}
              onClick={() => setSource(type)}
            >
              <div className="choice-title">{SOURCE_LABELS[type]}</div>
            </button>
          ))}
        </div>
        {source && (
          <div className="ml-create-form">
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label">
                {source === 'pdf' ? 'File' : source === 'youtube' ? 'YouTube URL' : 'URL or text'}
              </label>
              {source === 'text' ? (
                <textarea className="field field-textarea" rows={6} placeholder="Paste new text here…" />
              ) : (
                <input className="field" placeholder={source === 'pdf' ? 'Choose file…' : 'https://…'} />
              )}
            </div>
            <div className="ml-create-actions">
              <button className="btn btn-accent" onClick={() => submitReplace(material)}>
                Replace and re-process
              </button>
              <button className="btn btn-ghost" onClick={() => setReplaceModeId(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function DetailCard({ material }: { material: Material }) {
    const ready = material.status === 'ready';
    const processing = material.status !== 'ready' && material.status !== 'failed';
    const replacing = replaceModeId === material.id;
    return (
      <div className="ml-detail">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Back to library
        </button>
        <div className="ml-detail-head">
          <div>
            <div className="mono-caps">{SOURCE_LABELS[material.sourceType]}</div>
            <h2 className="t-display-3" style={{ margin: '0.25rem 0 0.5rem' }}>
              {material.title}
            </h2>
            <div className="ml-detail-meta">
              {formatMinutes(material.estimatedMinutes)} · added {formatDate(material.createdAt)}
              {material.archived && ' · archived'}
            </div>
          </div>
          <div className="ml-detail-status">
            <StatusBadge status={material.status} detail={material.statusDetail} />
          </div>
        </div>

        {processing && !replacing && (
          <div className="ml-detail-block">
            <ProgressBar status={material.status} />
          </div>
        )}

        {material.status === 'failed' && !replacing && (
          <div className="banner attention" style={{ marginBottom: '1rem' }}>
            <div className="banner-body">
              <div className="banner-title">Ingestion failed</div>
              <div className="banner-desc">{material.statusDetail}</div>
            </div>
            <button className="banner-action-btn" onClick={() => retryMaterial(material.id)}>
              Retry
            </button>
          </div>
        )}

        {material.stale && !replacing && (
          <div className="banner warning" style={{ marginBottom: '1rem' }}>
            <div className="banner-body">
              <div className="banner-title">Grounding may be stale</div>
              <div className="banner-desc">
                This material was replaced. Existing assessments keep their content; regenerate
                before creating new questions.
              </div>
            </div>
            <button
              className="banner-action-btn"
              onClick={() => setStatus(material.id, 'pending', 'Regeneration queued')}
            >
              Regenerate
            </button>
          </div>
        )}

        {ready && !replacing && (
          <div className="ml-detail-actions">
            <button className="btn btn-accent" onClick={() => go('practice-this', material.id)}>
              Practice this
            </button>
            <button className="btn btn-secondary" onClick={() => go('picker', material.id)}>
              Attach to assessment
            </button>
          </div>
        )}
        {material.status === 'failed' && !replacing && (
          <div className="ml-detail-actions">
            <button className="btn btn-accent" onClick={() => retryMaterial(material.id)}>
              Retry ingestion
            </button>
          </div>
        )}

        {replacing ? (
          <ReplaceForm material={material} />
        ) : (
          <>
            <div className="ml-detail-block">
              <h3 className="t-display-3" style={{ fontSize: '18px', marginBottom: '0.75rem' }}>
                Used by
              </h3>
              {material.referencedBy.length === 0 ? (
                <p className="t-body-sm">Not attached to any roadmap or assessment yet.</p>
              ) : (
                <ul className="ml-ref-list">
                  {material.referencedBy.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ml-detail-actions ml-detail-actions-lower">
              <button className="btn btn-secondary" onClick={() => setReplaceModeId(material.id)}>
                Replace keep-ID
              </button>
              <button className="btn btn-secondary" onClick={() => toggleArchive(material.id)}>
                {material.archived ? 'Restore' : 'Archive'}
              </button>
              <button className="btn btn-ghost" onClick={() => go('referenced-delete', material.id)}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  function DetailView() {
    return selected ? <DetailCard material={selected} /> : null;
  }

  function CreateView() {
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Cancel
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '1rem' }}>
          Add material
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Choose a source type. The file or text is uploaded to your private library and
          processed server-side.
        </p>

        <div className="ml-source-grid">
          {(['pdf', 'url', 'text', 'youtube'] as SourceType[]).map((type) => (
            <button
              key={type}
              className={`choice${createSource === type ? ' selected' : ''}`}
              onClick={() => setCreateSource(type)}
            >
              <div className="choice-title">{SOURCE_LABELS[type]}</div>
              <div className="choice-desc">
                {type === 'pdf' && 'Upload a document up to 25 MB.'}
                {type === 'url' && 'Paste a web article or documentation link.'}
                {type === 'text' && 'Type or paste raw text directly.'}
                {type === 'youtube' && 'Use a public YouTube transcript.'}
              </div>
            </button>
          ))}
        </div>

        {createSource && (
          <div className="ml-create-form">
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label">Title</label>
              <input className="field" placeholder="e.g. Raft consensus paper" />
            </div>
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label">
                {createSource === 'pdf' ? 'File' : createSource === 'youtube' ? 'YouTube URL' : 'URL or text'}
              </label>
              {createSource === 'text' ? (
                <textarea className="field field-textarea" rows={6} placeholder="Paste text here…" />
              ) : (
                <input className="field" placeholder={createSource === 'pdf' ? 'Choose file…' : 'https://…'} />
              )}
            </div>
            <div className="field-group" style={{ maxWidth: '240px' }}>
              <label className="field-label">Estimated study time (minutes)</label>
              <input className="field" type="number" defaultValue={60} />
            </div>
            <div className="ml-create-actions">
              <button className="btn btn-accent" onClick={() => go('progress')}>
                Add and process
              </button>
              <button className="btn btn-ghost" onClick={() => go('library')}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function ProgressView() {
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Back to library
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Processing material
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          You can leave this screen. We will update the library when ingestion finishes.
        </p>
        <div className="card card-large" style={{ maxWidth: '640px' }}>
          <div className="card-title">New PDF upload</div>
          <div className="card-meta">Operating Systems — Three Easy Pieces.pdf</div>
          <ProgressBar status="chunking" />
          <div className="ml-progress-note">
            <span className="tag tag-sm tag-terracotta">In progress</span>
            <span className="t-body-sm">Chunking · 128 of 412 pages parsed</span>
          </div>
        </div>
      </div>
    );
  }

  function FailedView() {
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Back to library
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Ingestion failed
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          The material could not be processed. You can retry, replace, or delete it.
        </p>
        <div className="card card-large" style={{ maxWidth: '640px' }}>
          <div className="card-title">Designing Data-Intensive Applications (chapter 5)</div>
          <div className="card-meta">Web article · added Aug 2</div>
          <div className="banner attention" style={{ marginTop: '1rem' }}>
            <div className="banner-body">
              <div className="banner-title">Fetch timeout after 30 s</div>
              <div className="banner-desc">
                The source server did not respond. Retry will resume from the last successful
                step.
              </div>
            </div>
          </div>
          <div className="ml-failed-actions">
            <button className="btn btn-accent" onClick={() => retryMaterial('m4')}>
              Retry ingestion
            </button>
            <button className="btn btn-secondary" onClick={() => openReplace('m4')}>
              Replace keep-ID
            </button>
            <button className="btn btn-destructive" onClick={() => go('referenced-delete', 'm4')}>
              Delete material
            </button>
          </div>
        </div>
      </div>
    );
  }

  function ArchiveView() {
    const archived = materials.filter((m) => m.archived);
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Back to library
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Archived materials
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Archived materials stay in your library but are hidden from pickers and generation.
        </p>
        {archived.length === 0 ? (
          <div className="ml-empty">
            <h3 className="t-display-3">Nothing archived</h3>
            <p>Materials you archive will appear here and in the “Show archived” filter.</p>
          </div>
        ) : (
          <div className="material-list">
            {archived.map((m) => (
              <div key={m.id} className="material-row is-archived">
                <div className="material-icon notes">{SOURCE_ICONS[m.sourceType]}</div>
                <div className="material-body">
                  <div className="material-title dimmed">{m.title}</div>
                  <div className="material-meta">Archived on Aug 12</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleArchive(m.id)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function StaleView() {
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Back to library
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Stale dependent content
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          This material was replaced while keeping its ID. Existing assessments and roadmap
          references remain, but new generation should refresh first.
        </p>
        <div className="card card-large" style={{ maxWidth: '640px' }}>
          <div className="card-title">Networking — TCP/IP illustrated</div>
          <div className="card-meta">Replaced yesterday</div>
          <div className="banner warning">
            <div className="banner-body">
              <div className="banner-title">Grounding may be stale</div>
              <div className="banner-desc">
                2 assessments and 1 roadmap use this material. Existing attempts are kept;
                regenerate only when you want new questions.
              </div>
            </div>
          </div>
          <div className="ml-stale-actions">
            <button className="btn btn-accent">Regenerate dependent questions</button>
            <button className="btn btn-secondary">Mark fresh</button>
            <button className="btn btn-ghost" onClick={() => go('library')}>
              Decide later
            </button>
          </div>
        </div>
      </div>
    );
  }

  function DeleteView() {
    const refs = selected?.referencedBy ?? [];
    const hasRefs = refs.length > 0;
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('detail', selected?.id)}>
          ← Back to material
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Delete material?
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {hasRefs
            ? `Deleting permanently removes ${selected?.title} and its grounded source chunks. This cannot be undone. Existing attempts and history are kept.`
            : `This permanently removes ${selected?.title} and its grounded source chunks. This cannot be undone.`}
        </p>
        <div className="card card-large" style={{ maxWidth: '640px' }}>
          <div className="card-title">{selected?.title}</div>
          {hasRefs && (
            <>
              <div className="card-meta">Used by</div>
              <ul className="ml-ref-list">
                {refs.map((ref) => (
                  <li key={ref}>{ref}</li>
                ))}
              </ul>
              <p className="t-body-sm" style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                These references keep their records but can no longer generate new grounded
                questions from this material.
              </p>
            </>
          )}
          <div className="ml-delete-actions">
            <button
              className="btn btn-destructive"
              onClick={() => {
                if (selected) deleteMaterial(selected.id);
                go('library');
              }}
            >
              {hasRefs ? 'Delete anyway' : 'Delete material'}
            </button>
            {hasRefs && selected && (
              <button className="btn btn-secondary" onClick={() => openReplace(selected.id)}>
                Replace keep-ID instead
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => go('detail', selected?.id)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  function PickerView() {
    const readyCount = Array.from(pickerSelected).filter(
      (id) => materials.find((m) => m.id === id)?.status === 'ready',
    ).length;
    return (
      <div className="ml-picker">
        <div className="ml-picker-header">
          <div>
            <div className="mono-caps">New assessment</div>
            <h2 className="t-display-2" style={{ margin: '0.25rem 0 0.5rem' }}>
              Choose materials
            </h2>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
              Only <strong>Ready</strong> materials can ground generation. Contentless materials
              stay attachable for roadmap planning.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => go('library')}>
            Cancel
          </button>
        </div>

        <div className="ml-picker-list">
          {materials
            .filter((m) => !m.archived)
            .map((m) => {
              const ready = m.status === 'ready';
              return (
                <label
                  key={m.id}
                  className={`checkbox-row${pickerSelected.has(m.id) ? ' checked' : ''}${!ready ? ' is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={pickerSelected.has(m.id)}
                    disabled={!ready}
                    onChange={() => ready && togglePicker(m.id)}
                  />
                  <span className="checkbox-box" aria-hidden="true" />
                  <div className="checkbox-body">
                    <div className="checkbox-title">{m.title}</div>
                    <div className="checkbox-desc">
                      {SOURCE_LABELS[m.sourceType]} ·{' '}
                      {ready ? 'Ready for generation' : `Generation disabled · ${STATUS_LABELS[m.status]}`}
                    </div>
                  </div>
                  {pickerSelected.has(m.id) && <span className="tag tag-sm tag-moss">Selected</span>}
                </label>
              );
            })}
        </div>

        <div className="ml-picker-footer">
          <span className="ml-picker-count">
            {pickerSelected.size} selected · {readyCount} ready
          </span>
          <div className="ml-picker-actions">
            <button className="btn btn-ghost" onClick={() => go('library')}>
              Cancel
            </button>
            <button
              className="btn btn-accent"
              disabled={pickerSelected.size === 0}
              onClick={() => {
                alert(`Attached ${pickerSelected.size} material(s). In a real flow this would continue to assessment config.`);
                go('library');
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  function PracticeThisView() {
    return (
      <div className="ml-view">
        <button className="btn btn-ghost btn-sm ml-back" onClick={() => go('library')}>
          ← Back to library
        </button>
        <h2 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Practice this
        </h2>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Start a guided practice run grounded in <strong>{selected?.title}</strong>.
        </p>
        <div className="card card-large" style={{ maxWidth: '640px' }}>
          <div className="card-title">Configure run</div>
          <div className="card-meta">Questions are drawn from this material only.</div>
          <div className="ml-practice-options">
            <div className="field-group" style={{ maxWidth: '200px' }}>
              <label className="field-label">Number of questions</label>
              <input className="field" type="number" defaultValue={5} min={1} max={20} />
            </div>
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label">Focus</label>
              <div className="chip-row">
                {['Written', 'Coding', 'Mixed'].map((label) => (
                  <button key={label} className={`chip${label === 'Mixed' ? ' selected' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-group" style={{ maxWidth: '100%' }}>
              <label className="field-label">Difficulty</label>
              <div className="chip-row">
                {['Adaptive', '1', '2', '3', '4', '5'].map((label) => (
                  <button key={label} className={`chip${label === 'Adaptive' ? ' selected' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="ml-practice-actions">
            <button className="btn btn-accent">Start practice run</button>
            <button className="btn btn-secondary" onClick={() => go('picker', selected?.id ?? '')}>
              Add another material
            </button>
          </div>
        </div>
      </div>
    );
  }

  const VIEW_TITLES: Record<ViewState, string> = {
    library: 'Library',
    detail: 'Detail',
    create: 'Create',
    progress: 'Progress',
    failed: 'Failed / retry',
    archive: 'Archive / restore',
    stale: 'Stale',
    'referenced-delete': 'Delete',
    picker: 'Material picker',
    'practice-this': 'Practice this',
  };

  return (
    <div className="ml-page">
      <header className="ml-header">
        <div className="ml-eyebrow">Prototype · wayfinder #33 · throwaway</div>
        <h1 className="ml-title">Material Library and Attachment UX</h1>
        <p className="ml-sub">
          A clickable throwaway for the server-first material library, ingestion states,
          multi-material picker, and Practice-this entry point. Use the state toolbar to walk
          through every screen.
        </p>

        <div className="ml-statebar" role="toolbar" aria-label="Prototype state">
          {(Object.keys(VIEW_TITLES) as ViewState[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`ml-statebtn${view === s ? ' is-active' : ''}`}
              onClick={() => go(s)}
            >
              {VIEW_TITLES[s]}
            </button>
          ))}
        </div>
      </header>

      {menuOpenId && <div className="ml-menu-catcher" onClick={() => setMenuOpenId(null)} />}

      <main className="ml-main">
        {view === 'picker' ? (
          <div className="ml-sheet-layer">
            <LibraryView />
            <div className="ml-sheet-backdrop" onClick={() => go('library')} aria-hidden="true" />
            <section className="ml-sheet" role="dialog" aria-modal="true" aria-label="Choose materials">
              <PickerView />
            </section>
          </div>
        ) : (
          <>
            {view === 'library' && <LibraryView />}
            {view === 'detail' && <DetailView />}
            {view === 'create' && <CreateView />}
            {view === 'progress' && <ProgressView />}
            {view === 'failed' && <FailedView />}
            {view === 'archive' && <ArchiveView />}
            {view === 'stale' && <StaleView />}
            {view === 'referenced-delete' && <DeleteView />}
            {view === 'practice-this' && <PracticeThisView />}
          </>
        )}
      </main>
    </div>
  );
}
