// PROTOTYPE — throwaway. Assessment library + Practice hub UX for wayfinder #80.
// Answers: "what do the Assessments and Practice hubs look like and how do they
// behave across objective/written/coding, so a learner can find, resume, and
// review any generated assessment or practice run?"
// Fixture-driven, in memory. No events, no storage (except the AC7 pick in
// URL + localStorage), no service calls. Dev-only route, tree-shaken from prod.
//
// Switch via URL: ?hub=assessments|practice|material · ?variant=A|B ·
// ?state=full|empty|loading|error|offline · ?pick=A|B (AC7 recorder).
// Bottom bar flips A (dense list) / B (card grid); arrow keys work.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PrototypeSwitcher } from '../practice-guide/PrototypeSwitcher'
import {
  ASSESSMENTS,
  BACKLINK_MATERIAL,
  RUNS,
  type AssessmentStub,
  type Family,
  type RunStub,
} from './assessment-library-fixtures'
import './assessment-library.css'

const VARIANT_NAMES = { A: 'Dense list', B: 'Card grid' } as const
type Variant = keyof typeof VARIANT_NAMES
type Hub = 'assessments' | 'practice' | 'material'
type ProtoState = 'full' | 'empty' | 'loading' | 'error' | 'offline'

const STATES: ProtoState[] = ['full', 'empty', 'loading', 'error', 'offline']
const PICK_KEY = 'assessment-library-proto-pick'

const FAMILY_LABEL: Record<Family, string> = {
  objective: 'Objective',
  written: 'Written',
  coding: 'Coding',
}

function assessmentStateTag(a: AssessmentStub): { label: string; cls: string } {
  switch (a.status) {
    case 'ready':
      return { label: 'Ready', cls: 'tag-moss' }
    case 'generating':
      return { label: 'Generating', cls: 'tag-terracotta' }
    case 'failed':
      return { label: 'Failed', cls: 'tag-rust' }
    default:
      return { label: 'Not started', cls: 'tag-dim' }
  }
}

function runStateTag(r: RunStub): { label: string; cls: string } {
  switch (r.status) {
    case 'completed':
      return { label: 'Completed', cls: 'tag-moss' }
    case 'in-progress':
      return { label: 'In progress', cls: 'tag-terracotta' }
    case 'generating':
      return { label: 'Generating', cls: 'tag-terracotta' }
    case 'abandoned':
      return { label: 'Abandoned', cls: 'tag-dim' }
    default:
      return { label: 'Failed', cls: 'tag-rust' }
  }
}

function Dots() {
  return (
    <span className="alb-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function FamilyDetail({ family, id }: { family: Family; id: string }) {
  if (family === 'objective') {
    return (
      <div className="alb-detail">
        <p>Review preview — stands in for the shipped taking/review treatment. Hidden keys stay veiled.</p>
        <div className="alb-rubric-row">
          <span aria-hidden="true">○</span>
          <span>Accrual basis applies on delivery</span>
          <span className="tag tag-sm tag-moss">your answer</span>
        </div>
        <div className="alb-rubric-row">
          <span aria-hidden="true">○</span>
          <span>Cash basis on payment receipt</span>
        </div>
        <div className="alb-rubric-row">
          <span aria-hidden="true">○</span>
          <span>Hybrid election for SMEs</span>
        </div>
        <p className="alb-row-note">Source evidence (1) · chunk {id.slice(2, 6)}… “Revenue is recognised when control transfers…”</p>
      </div>
    )
  }
  if (family === 'written') {
    return (
      <div className="alb-detail">
        <p>Rubric preview — the server grade is authoritative; this is the public copy.</p>
        <div className="alb-rubric-row">
          <span className="tag tag-sm tag-moss">met</span>
          <span>Names the quorum rule</span>
          <span className="alb-progress">1.00</span>
        </div>
        <div className="alb-rubric-row">
          <span className="tag tag-sm tag-moss">met</span>
          <span>Cites the follower lag bound</span>
          <span className="alb-progress">1.00</span>
        </div>
        <div className="alb-rubric-row">
          <span className="tag tag-sm tag-terracotta">partial</span>
          <span>States the split-brain guard</span>
          <span className="alb-progress">0.50</span>
        </div>
        <p className="alb-row-note">Source evidence (2) · chunk {id.slice(2, 6)}… “A majority quorum survives f failures…”</p>
      </div>
    )
  }
  return (
    <div className="alb-detail">
      <p>Coding preview — advisory only. Hidden tests never reach the browser.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Expected</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>sorted input</td>
            <td className="alb-progress">[1, 2, 3]</td>
            <td>
              <span className="tag tag-sm tag-moss">pass</span>
            </td>
          </tr>
          <tr>
            <td>reverse input</td>
            <td className="alb-progress">[1, 2, 3]</td>
            <td>
              <span className="tag tag-sm tag-moss">pass</span>
            </td>
          </tr>
          <tr>
            <td>duplicates</td>
            <td className="alb-progress">[2, 2, 5]</td>
            <td>
              <span className="tag tag-sm tag-rust">fail</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function RunDetail({ run }: { run: RunStub }) {
  return (
    <div className="alb-detail">
      <p>
        {run.families.map((f, i) => (
          <span key={`${run.runId}-${i}`} className="tag tag-sm" style={{ marginRight: 6 }}>
            {i + 1} · {FAMILY_LABEL[f]}
          </span>
        ))}
      </p>
      {run.status === 'completed' && (
        <p>Summary preview — {run.completedCount} of {run.totalCount} correct. Reopens the completed summary in the build.</p>
      )}
      {run.status === 'abandoned' && (
        <p>Left {run.date} · kept as history. Pause is leave-and-return; nothing was invented on exit.</p>
      )}
      {run.status === 'generating' && (
        <p>
          <Dots /> {run.note ?? 'Problems still generating — nothing to grade yet.'}
        </p>
      )}
      {run.missingCount > 0 && (
        <p>Partial start · {run.missingCount} problems never generated. The build offers “start a new run”.</p>
      )}
      <p className="alb-row-note">Opens the shipped run surface in the build: /materials/:materialId/practice/{run.runId}.</p>
    </div>
  )
}

function AssessmentRow({
  item,
  variant,
  offline,
  expanded,
  onToggle,
  action,
}: {
  item: AssessmentStub
  variant: Variant
  offline: boolean
  expanded: boolean
  onToggle: () => void
  action?: { label: string; kind: 'accent' | 'secondary' | 'ghost'; onClick: () => void }
}) {
  const tag = assessmentStateTag(item)
  const unavailable = offline && !item.cached
  const shell = variant === 'A' ? 'alb-row' : 'alb-card'
  return (
    <div
      className={shell}
      role="link"
      tabIndex={0}
      aria-label={`${item.materialTitle}, ${FAMILY_LABEL[item.family]}, ${tag.label}`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      style={{ cursor: 'pointer', opacity: unavailable ? 0.75 : 1 }}
    >
      <div className={variant === 'A' ? 'alb-row-main' : ''} style={variant === 'B' ? { width: '100%' } : undefined}>
        <div className="alb-row-title">{item.materialTitle}</div>
        <div className="alb-row-meta">
          {FAMILY_LABEL[item.family]} · {item.date} · {item.scope}
        </div>
        {item.note && <div className="alb-row-note">{item.note}</div>}
        {unavailable && (
          <div style={{ marginTop: 6 }}>
            <span className="tag tag-sm tag-dim">Unavailable offline</span>
          </div>
        )}
        {expanded && !unavailable && <FamilyDetail family={item.family} id={item.id} />}
        {expanded && unavailable && (
          <p className="alb-row-note">Held locally? No — this item needs a connection. Cached items stay readable offline.</p>
        )}
      </div>
      <div className={variant === 'A' ? 'alb-row-side' : 'alb-actions'}>
        <span className={`tag tag-sm ${tag.cls}`}>{unavailable ? 'Offline' : tag.label}</span>
        {item.status === 'ready' && item.score != null && !unavailable && (
          <span className="alb-score">{item.score.toFixed(2)}</span>
        )}
        {item.status === 'generating' && !unavailable && (
          <span className="alb-progress">
            <Dots /> {item.gradedCount} of {item.totalCount} ready
          </span>
        )}
        {item.status === 'queued' && <span className="alb-progress">0 of {item.totalCount}</span>}
        {action && !unavailable && (
          <button
            type="button"
            className={`btn btn-${action.kind} btn-sm`}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

function RunRow({
  run,
  variant,
  offline,
  expanded,
  onToggle,
  accent,
}: {
  run: RunStub
  variant: Variant
  offline: boolean
  expanded: boolean
  onToggle: () => void
  accent: boolean
}) {
  const tag = runStateTag(run)
  const unavailable = offline && !run.cached
  const shell = variant === 'A' ? 'alb-row' : 'alb-card'
  const needsAction = run.status === 'in-progress' || run.status === 'generating'
  return (
    <div
      className={shell}
      role="link"
      tabIndex={0}
      aria-label={`Run ${run.runId}, ${run.mode}, ${tag.label}`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      style={{ cursor: 'pointer', opacity: unavailable ? 0.75 : 1 }}
    >
      <div className={variant === 'A' ? 'alb-row-main' : ''} style={variant === 'B' ? { width: '100%' } : undefined}>
        <div className="alb-row-title">
          {run.runId} · {run.materialTitles}
        </div>
        <div className="alb-row-meta">
          {run.mode} · {run.date} · {run.totalCount} problems
        </div>
        {run.note && <div className="alb-row-note">{run.note}</div>}
        {unavailable && (
          <div style={{ marginTop: 6 }}>
            <span className="tag tag-sm tag-dim">Unavailable offline</span>
          </div>
        )}
        {expanded && !unavailable && <RunDetail run={run} />}
      </div>
      <div className={variant === 'A' ? 'alb-row-side' : 'alb-actions'}>
        <span className={`tag tag-sm ${tag.cls}`}>{unavailable ? 'Offline' : tag.label}</span>
        <span className="alb-progress">
          {run.completedCount} of {run.totalCount} graded
        </span>
        {needsAction && !unavailable && (
          <button
            type="button"
            className={`btn btn-${accent ? 'accent' : 'secondary'} btn-sm`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {run.resumeLabel ?? 'Resume'}
          </button>
        )}
        {!needsAction && !unavailable && run.status === 'completed' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            Open summary
          </button>
        )}
      </div>
    </div>
  )
}

export default function AssessmentLibraryPrototype() {
  const [params, setParams] = useSearchParams()
  const variant: Variant = (params.get('variant') ?? 'A').toUpperCase() === 'B' ? 'B' : 'A'
  const hubParam = params.get('hub')
  const hub: Hub = hubParam === 'practice' || hubParam === 'material' ? hubParam : 'assessments'
  const stateParam = params.get('state')
  const protoState: ProtoState = STATES.includes(stateParam as ProtoState) ? (stateParam as ProtoState) : 'full'
  const offline = protoState === 'offline'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pick, setPick] = useState<string>(() => {
    try {
      return params.get('pick') ?? localStorage.getItem(PICK_KEY) ?? ''
    } catch {
      return params.get('pick') ?? ''
    }
  })

  useEffect(() => {
    setExpandedId(null)
  }, [hub, variant, protoState])

  function go(next: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) p.set(k, v)
    setParams(p, { replace: true })
  }

  function choosePick(value: string) {
    setPick(value)
    try {
      localStorage.setItem(PICK_KEY, value)
    } catch {
      // Prototype only: storage may be unavailable, URL still carries the pick.
    }
    go({ pick: value })
  }

  const resumeRuns = RUNS.filter((r) => r.status === 'in-progress' || r.status === 'generating')
  const historyRuns = RUNS.filter((r) => r.status !== 'in-progress' && r.status !== 'generating')
  const wrapCls = variant === 'A' ? 'alb-col' : 'alb-wide'

  return (
    <div className="alb-page">
      <div className={wrapCls}>
        <header>
          <div className="alb-eyebrow">Prototype · wayfinder #80 · throwaway</div>
          <h1 className="alb-title">Assessment library and Practice hub</h1>
          <p className="alb-sub">
            Return paths to every generated assessment and practice run across objective, written, and
            coding. Click any row to open its family treatment. Nothing persists — the pick at the
            bottom is the only thing recorded, in URL + localStorage.
          </p>
        </header>

        <nav className="alb-subnav" aria-label="Materials sections (prototype)">
          <span className="alb-subnav-label">Materials · nested</span>
          <button type="button" className="alb-subnav-tab" disabled title="Library stays where it is">
            Library
          </button>
          <button
            type="button"
            className={`alb-subnav-tab${hub === 'assessments' ? ' is-active' : ''}`}
            aria-current={hub === 'assessments' ? 'page' : undefined}
            onClick={() => go({ hub: 'assessments' })}
          >
            Assessments · {ASSESSMENTS.length}
          </button>
          <button
            type="button"
            className={`alb-subnav-tab${hub === 'practice' ? ' is-active' : ''}`}
            aria-current={hub === 'practice' ? 'page' : undefined}
            onClick={() => go({ hub: 'practice' })}
          >
            Practice · {RUNS.length}
          </button>
          <button
            type="button"
            className={`alb-subnav-tab${hub === 'material' ? ' is-active' : ''}`}
            aria-current={hub === 'material' ? 'page' : undefined}
            onClick={() => go({ hub: 'material' })}
          >
            Material backlink
          </button>
        </nav>

        <div className="alb-toolbar" role="toolbar" aria-label="Prototype states">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={`alb-statebtn${protoState === s ? ' is-active' : ''}`}
              aria-pressed={protoState === s}
              onClick={() => go({ state: s })}
            >
              {s}
            </button>
          ))}
        </div>

        {offline && (
          <div className="banner attention alb-offline-banner">
            <div className="banner-body">
              <div className="banner-title">Offline — cached items stay readable</div>
              <div className="banner-desc">Uncached rows are marked unavailable, never broken. Retry returns with connection.</div>
            </div>
          </div>
        )}

        {protoState === 'loading' && (
          <section aria-label="Loading">
            <div className="alb-section-head">
              <h2>{hub === 'practice' ? 'Practice runs' : hub === 'material' ? 'Material backlink' : 'Generated assessments'}</h2>
            </div>
            <div className={variant === 'A' ? 'alb-list' : 'alb-grid'}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="alb-skeleton" aria-busy="true" aria-label="Loading item">
                  <span className="alb-skeleton-line" style={{ width: '60%' }} />
                  <span className="alb-skeleton-line" style={{ width: '40%' }} />
                  <span className="alb-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {protoState === 'error' && (
          <div className="banner attention">
            <div className="banner-body">
              <div className="banner-title">Could not load {hub}</div>
              <div className="banner-desc">Your generated work is safe locally. Check connection and retry.</div>
            </div>
            <button type="button" className="banner-action-btn" onClick={() => go({ state: 'full' })}>
              Retry
            </button>
          </div>
        )}

        {protoState === 'empty' && hub !== 'material' && (
          <div className="alb-empty" role="status">
            <h3>{hub === 'practice' ? 'No practice runs yet' : 'No assessments yet'}</h3>
            <p>
              {hub === 'practice'
                ? 'Runs you start from any ready material land here with their resume point. Finished summaries reopen from the same row.'
                : 'Assessments you generate from ready materials land here with family, scope, and score. Leaving the page never loses the way back.'}
            </p>
            <button type="button" className="btn btn-accent" onClick={() => go({ state: 'full' })}>
              {hub === 'practice' ? 'Start your first run (stub)' : 'Generate your first assessment (stub)'}
            </button>
          </div>
        )}

        {protoState === 'full' && hub === 'assessments' && (
          <>
            <div className="alb-section-head">
              <h2>Generated assessments</h2>
              <span className="alb-count">{ASSESSMENTS.length} items · newest first</span>
            </div>
            <div className={variant === 'A' ? 'alb-list' : 'alb-grid'}>
              {ASSESSMENTS.map((a) => (
                <AssessmentRow
                  key={a.id}
                  item={a}
                  variant={variant}
                  offline={offline}
                  expanded={expandedId === a.id}
                  onToggle={() => setExpandedId((cur) => (cur === a.id ? null : a.id))}
                  action={
                    a.status === 'generating'
                      ? { label: 'Retry', kind: 'secondary', onClick: () => setExpandedId(a.id) }
                      : a.status === 'failed'
                        ? { label: 'Start a new run', kind: 'secondary', onClick: () => setExpandedId(a.id) }
                        : undefined
                  }
                />
              ))}
            </div>
            <div className="alb-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => go({ hub: 'material' })}>
                See material backlink
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ hub: 'practice' })}>
                Go to Practice hub
              </button>
            </div>
          </>
        )}

        {protoState === 'full' && hub === 'practice' && (
          <>
            <div className="alb-section-head">
              <h2>Resume</h2>
              <span className="alb-count">{resumeRuns.length} unfinished</span>
            </div>
            <div className={variant === 'A' ? 'alb-list' : 'alb-grid'}>
              {resumeRuns.map((r, i) => (
                <RunRow
                  key={r.runId}
                  run={r}
                  variant={variant}
                  offline={offline}
                  expanded={expandedId === r.runId}
                  onToggle={() => setExpandedId((cur) => (cur === r.runId ? null : r.runId))}
                  accent={i === 0}
                />
              ))}
            </div>
            <div className="alb-section-head">
              <h2>History</h2>
              <span className="alb-count">{historyRuns.length} finished · newest first</span>
            </div>
            <div className={variant === 'A' ? 'alb-list' : 'alb-grid'}>
              {historyRuns.map((r) => (
                <RunRow
                  key={r.runId}
                  run={r}
                  variant={variant}
                  offline={offline}
                  expanded={expandedId === r.runId}
                  onToggle={() => setExpandedId((cur) => (cur === r.runId ? null : r.runId))}
                  accent={false}
                />
              ))}
            </div>
          </>
        )}

        {(hub === 'material' || protoState === 'full') && hub === 'material' && protoState !== 'loading' && protoState !== 'error' && (
          <section aria-label="Material backlink (prototype)">
            <div className="alb-section-head">
              <h2>Material backlink</h2>
              <span className="alb-count">replaces the placeholder copy</span>
            </div>
            <div className="alb-backlink">
              <div>
                <div className="alb-eyebrow">PDF document</div>
                <h3>{BACKLINK_MATERIAL.title}</h3>
                <div className="alb-row-meta">{BACKLINK_MATERIAL.meta}</div>
              </div>
              <div>
                <div className="alb-row-meta" style={{ marginBottom: 8 }}>
                  Assessments · {BACKLINK_MATERIAL.assessments.length}
                </div>
                <ul>
                  {BACKLINK_MATERIAL.assessments.map((a) => (
                    <li key={a.id}>
                      <a href={`#${a.id}`} onClick={(e) => e.preventDefault()}>
                        <span>
                          {a.title} · <span className="alb-progress">{FAMILY_LABEL[a.family]}</span>
                        </span>
                        <span className="alb-progress">{a.state}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="alb-row-meta" style={{ marginBottom: 8 }}>
                  Practice runs · {BACKLINK_MATERIAL.runs.length}
                </div>
                <ul>
                  {BACKLINK_MATERIAL.runs.map((r) => (
                    <li key={r.id}>
                      <a href={`#${r.id}`} onClick={(e) => e.preventDefault()}>
                        <span>{r.title}</span>
                        <span className="alb-progress">{r.state}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="alb-row-note" style={{ margin: 0 }}>
                Retires “Assessments will appear here once created.” Roadmap usage keeps its own “Used by” block above this section in the build.
              </p>
            </div>
          </section>
        )}

        <section className="alb-pick" aria-label="Recommended choice for implementation">
          <h3>Your pick (AC7)</h3>
          <p>
            This records the recommended choice for the build ticket. Stored in URL + localStorage only —
            no durable event. Pick the layout that reads better; nested Materials is already chosen per your call.
          </p>
          <div className="alb-pick-row" role="group" aria-label="Layout pick">
            {(['A', 'B'] as Variant[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`alb-statebtn${pick === v ? ' is-active' : ''}`}
                aria-pressed={pick === v}
                onClick={() => choosePick(v)}
              >
                {v} — {VARIANT_NAMES[v]}
              </button>
            ))}
            <button type="button" className="alb-statebtn" onClick={() => choosePick('')}>
              Clear
            </button>
          </div>
          <p className="alb-row-note" style={{ margin: 0 }}>
            {pick ? `Saved pick: ${pick} — ${VARIANT_NAMES[pick as Variant]} · nested in Materials.` : 'No pick saved yet. Flip A/B below, open rows, then save the winner here.'}
          </p>
        </section>

        <p className="alb-note">
          Drive it: hubs live in the Materials sub-nav (your pick) · A/B flips dense list vs card grid ·
          states cover full / empty / loading / error / offline · every row expands to its family treatment ·
          failed offers “start a new run”, generating offers retry, partial names its missing count. Refresh resets;
          only the pick above persists.
        </p>

        <PrototypeSwitcher names={VARIANT_NAMES} keys={['A', 'B']} />
      </div>
    </div>
  )
}
