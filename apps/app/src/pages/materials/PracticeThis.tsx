import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import {
  AssessmentServiceError,
  type AssessmentFormat,
  type GenerationRequest,
  type MasteryProjection,
  type MasterySnapshot,
} from '../../assessments/types'
import { saveMasteryProjections } from '../../assessments/masteryCache'
import { DEFAULT_BAND, bandGuidanceByMaterial } from '../../assessments/masteryBands'
import { PRACTICE_RUN_STARTED } from '../../events/EventStore'
import { useEventStore } from '../../events/useEventStore'
import { useMaterialsClient } from '../../materials/MaterialsProvider'
import { MaterialPicker } from '../../materials/MaterialPicker'
import { MaterialStatusBadge } from '../../materials/StatusBadge'
import { logger } from '../../lib/logger'
import '../../materials/materials.css'
import { SOURCE_LABELS, isReady, type MaterialRecord } from '../../materials/types'
import type { PracticeRunMode } from '../../sync/types'

const FOCUS_OPTIONS: Array<{ label: string; mode: PracticeRunMode }> = [
  { label: 'Written', mode: 'written' },
  { label: 'Coding', mode: 'coding' },
  { label: 'Mixed', mode: 'mixed' },
]
const DIFFICULTY_OPTIONS = ['Adaptive', '1', '2', '3', '4', '5'] as const

const FOCUS_COPY: Record<PracticeRunMode, string> = {
  written: 'Start a guided practice run grounded in',
  coding: 'Start a coding practice run grounded in',
  mixed: 'Start a mixed practice run grounded in',
}

/** D-06: one single-material call per problem, two in flight at a time. */
const GENERATION_CONCURRENCY = 2
const MAX_QUESTIONS = 20
/** D-10: the primary material plus up to four more, distributed round-robin. */
const MAX_MATERIALS = 5

/**
 * #45 D-01: the family one problem's generation call carries. The server
 * admits exactly one family per call, so `mixed` alternates per problem
 * instead of asking a single call for two families.
 */
function familyForProblem(mode: PracticeRunMode, index: number): AssessmentFormat {
  if (mode === 'mixed') return index % 2 === 0 ? 'written' : 'coding'
  return mode
}

/**
 * #43 Q11: the snapshot behind the Adaptive band, in GenerationRequest shape.
 * Scoped to the run's materials and capped so one envelope stays bounded;
 * null when there is nothing to steer (cold start), so the server proceeds
 * legacy. Mastery is clamped to 0..1 and finite; malformed rows are dropped.
 */
export function buildMasterySnapshot(
  projections: MasteryProjection[],
  materialIds: string[],
): MasterySnapshot | null {
  const wanted = new Set(materialIds)
  const entries = projections
    .filter(
      (projection) =>
        wanted.has(projection.materialId) &&
        typeof projection.skillTag === 'string' &&
        projection.skillTag.trim() !== '' &&
        projection.skillTag.trim().length <= 120 &&
        projection.materialId.length <= 200 &&
        Number.isFinite(projection.mastery),
    )
    .map((projection) => ({
      materialId: projection.materialId,
      skillTag: projection.skillTag.trim(),
      mastery: Math.min(1, Math.max(0, projection.mastery)),
    }))
    .slice(0, 50)
  if (entries.length === 0) return null
  const version = projections
    .find((projection) => wanted.has(projection.materialId) && projection.modelVersion?.trim())
    ?.modelVersion.trim()
    .slice(0, 32)
  return { version: version ? version : 'bkt-v1', entries }
}

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
  const assessments = useAssessmentClient()
  const eventStore = useEventStore()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [questionCount, setQuestionCount] = useState(5)
  const [focus, setFocus] = useState<PracticeRunMode>('written')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>('3')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<AssessmentServiceError | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [extraMaterials, setExtraMaterials] = useState<MaterialRecord[]>([])

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

  const materialIdForRequest = material.id
  // The route's own material always leads, so problem `i` draws from
  // `runMaterials[i % length]` and the primary is used first (D-10).
  const runMaterials = [material, ...extraMaterials.filter((extra) => extra.id !== material.id)]

  /**
   * D-06: one single-material generation per problem, composed by assessment
   * id. D-10: problem `i` draws its material round-robin, so every call still
   * carries exactly one materialId (the server's per-call gate). A problem
   * keeps its own clientId/correlationId so a retried request is a fresh
   * idempotency key rather than a replay.
   *
   * Adaptive (#43, #49 Slice 5): when the learner picks Adaptive, each
   * problem's band is the server's one-band recommendation when reachable
   * (target ~0.7 expected correctness), else the local `recommendBand` over
   * the fetched projections; the cold start keeps the mid band.
   * The projections are fetched once per run and cached in masteryCache.
   */
  async function startRun() {
    if (generating) return
    const total = questionCount
    const adaptive = difficulty === 'Adaptive'
    setGenerating(true)
    setError(null)

    let bandByMaterial = new Map<string, number>()
    let masterySnapshot: MasterySnapshot | null = null
    if (adaptive) {
      // #49 Slice 5: server recommendations are authoritative online; the
      // local one-band rule covers what the server misses, per material.
      // Any failure falls back, never blocking. One unfiltered call covers
      // the whole run (the route takes one materialId, a run holds up to 5).
      const wanted = new Set(runMaterials.map((entry) => entry.id))
      const serverBands = new Map<string, number>()
      try {
        const recommendations = await assessments.getRecommendations()
        for (const recommendation of recommendations) {
          if (serverBands.size >= wanted.size) break
          if (typeof recommendation !== 'object' || recommendation === null) continue
          const { materialId, recommendedBand } = recommendation
          if (
            typeof materialId !== 'string' ||
            materialId.trim() === '' ||
            materialId.length > 200 ||
            !wanted.has(materialId) ||
            !Number.isFinite(recommendedBand)
          ) {
            continue
          }
          // Per-skill rows collapse to the hardest band; the local reader
          // takes the strongest skill's band instead. Same direction while
          // the server base band stays DEFAULT_BAND and recommend_band stays
          // monotonic in mastery (parity goldens pin the per-skill values).
          const band = Math.min(5, Math.max(1, Math.trunc(recommendedBand)))
          const prev = serverBands.get(materialId)
          if (prev === undefined || band > prev) serverBands.set(materialId, band)
        }
      } catch (recommendationsError) {
        logger.warn('[practice] recommendations fetch failed, falling back to local bands', recommendationsError)
        serverBands.clear()
      }
      try {
        const projections = await assessments.getMastery()
        await saveMasteryProjections(eventStore, projections)
        const guidance = bandGuidanceByMaterial(projections)
        bandByMaterial = new Map(
          runMaterials.map((entry) => [
            entry.id,
            serverBands.get(entry.id) ?? guidance.get(entry.id)?.recommendedBand ?? DEFAULT_BAND,
          ]),
        )
        masterySnapshot = buildMasterySnapshot(projections, runMaterials.map((entry) => entry.id))
      } catch (masteryError) {
        if (serverBands.size > 0) {
          logger.warn('[practice] mastery fetch failed, using server recommendations', masteryError)
          bandByMaterial = new Map(
            runMaterials.map((entry) => [entry.id, serverBands.get(entry.id) ?? DEFAULT_BAND]),
          )
        } else {
          // Adaptive is advisory: a failed mastery fetch falls back to the mid
          // band instead of blocking the run (#43).
          logger.warn('[practice] mastery fetch failed, using mid band', masteryError)
          bandByMaterial = new Map(runMaterials.map((entry) => [entry.id, DEFAULT_BAND]))
        }
        masterySnapshot = null
      }
    }

    const generated: Array<{ id: string; family: AssessmentFormat } | undefined> = new Array(
      total,
    ).fill(undefined)
    let firstError: AssessmentServiceError | null = null

    const generateOne = async (index: number) => {
      const source = runMaterials[index % runMaterials.length]
      // #45 D-01: one family per call, `mixed` alternating written/coding.
      const family = familyForProblem(focus, index)
      const request: GenerationRequest = {
        clientId: crypto.randomUUID(),
        materialIds: [source.id],
        recipe: {
          formats: [family],
          // The slice gate accepts exactly one question per call, so an
          // N-problem run is N calls (D-06).
          questionCount: 1,
          difficulty: adaptive ? (bandByMaterial.get(source.id) ?? DEFAULT_BAND) : Number(difficulty),
        },
        correlationId: crypto.randomUUID(),
        // #43 Q11: the same projections behind the Adaptive band ride the
        // request so the server steers within the one-family gate. Absent on
        // fixed bands, cold start, and fetch failure (legacy path).
        ...(masterySnapshot ? { masterySnapshot } : {}),
      }
      try {
        const job = await assessments.generateAssessment(request)
        generated[index] = { id: job.resultId ?? request.correlationId, family }
      } catch (err) {
        firstError ??=
          err instanceof AssessmentServiceError
            ? err
            : new AssessmentServiceError('unknown', 'assessment request failed', false)
      }
    }

    // Bounded fan-out: GENERATION_CONCURRENCY problems in flight at a time.
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < total) await generateOne(next++)
    }
    await Promise.all(
      Array.from({ length: Math.min(GENERATION_CONCURRENCY, total) }, () => worker()),
    )

    const accepted = generated.filter(
      (entry): entry is { id: string; family: AssessmentFormat } => entry != null,
    )
    const assessmentIds = accepted.map((entry) => entry.id)
    if (assessmentIds.length === 0) {
      // Nothing generated, so there is no run to open: stay put and say why.
      setError(
        firstError ?? new AssessmentServiceError('unknown', 'assessment request failed', false),
      )
      setGenerating(false)
      return
    }

    // A run that produced only some of its problems still opens; the run
    // screen compares `count` against the ids it finds and says how many are
    // missing (D-11: no AssessmentCreated for these generations).
    const runId = crypto.randomUUID()
    try {
      await eventStore.append(PRACTICE_RUN_STARTED, {
        runId,
        materialIds: runMaterials.map((entry) => entry.id),
        mode: focus,
        assessmentIds,
        count: total,
        // The run's own record of each problem's family (#45), so a pending
        // problem is labelled from the pointer rather than a guess.
        families: accepted.map((entry) => entry.family),
      })
    } catch (appendError) {
      // The pointer is what a resumed run reads, so a failed append is loud;
      // the server rows still stand and the run screen reports what it finds.
      logger.warn('[practice] PracticeRunStarted append failed', appendError)
    }
    navigate(`/materials/${materialIdForRequest}/practice/${runId}`)
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
        {FOCUS_COPY[focus]} <strong>{material.title}</strong>.
      </p>

      <div className="card card-large" aria-busy={generating} style={{ maxWidth: '640px' }}>
        <div className="card-title">
          {material.title}
          <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
            {SOURCE_LABELS[material.kind]} · {formatMinutes(material.estimatedMinutes)}
          </span>
        </div>
        <div className="card-meta">
          <MaterialStatusBadge status={material.ingestionState} />
          {extraMaterials.length > 0 &&
            ` · +${extraMaterials.length} more material${extraMaterials.length !== 1 ? 's' : ''}`}
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
              max={MAX_QUESTIONS}
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
            />
          </div>
          <div className="field-group" style={{ maxWidth: '100%' }}>
            <label className="field-label">Focus</label>
            <div className="chip-row" role="group" aria-label="Practice focus">
              {FOCUS_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className={`chip${focus === option.mode ? ' selected' : ''}`}
                  aria-pressed={focus === option.mode}
                  onClick={() => setFocus(option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="field-hint">
              {focus === 'written' &&
                'Written answers grade against a rubric with per-criterion feedback.'}
              {focus === 'coding' &&
                'Coding problems grade in a server sandbox against hidden tests.'}
              {focus === 'mixed' && 'Problems alternate written and coding, in turn.'}
              {(focus === 'coding' || focus === 'mixed') && material.hasCode === false && (
                <>
                  {' '}
                  No code blocks detected - the generator judges from concepts and may not be able
                  to write a coding problem from this material.
                </>
              )}
            </p>
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
            <p className="field-hint">
              Adaptive picks each problem's band from your mastery projection, one band at a time.
            </p>
          </div>
        </div>
        <div className="material-practice-actions">
          <button
            type="button"
            className="btn btn-accent"
            disabled={generating}
            onClick={() => void startRun()}
          >
            {generating ? 'Generating…' : 'Start practice run'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={generating}
            onClick={() => setPickerOpen(true)}
          >
            Add another material
          </button>
        </div>
        {generating && (
          <p className="field-hint" style={{ marginTop: '0.75rem' }}>
            Generating {questionCount} questions…
          </p>
        )}
        {!generating && extraMaterials.length > 0 && (
          <p className="field-hint" style={{ marginTop: '0.75rem' }}>
            {questionCount < runMaterials.length
              ? `Questions are spread across your materials in turn — with ${questionCount} question${questionCount !== 1 ? 's' : ''}, only the first ${questionCount} material${questionCount !== 1 ? 's' : ''} will be used.`
              : 'Questions are spread across your materials in turn.'}
          </p>
        )}
      </div>

      {error?.code === 'quota_exhausted' && (
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Generation quota exhausted</div>
            <div className="banner-desc">
              {error.retryAfterSeconds
                ? `Try again in about ${error.retryAfterSeconds} seconds.`
                : 'Try again later.'}
            </div>
          </div>
        </div>
      )}
      {error && error.code !== 'quota_exhausted' && (
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '640px' }}>
          <div className="banner-body">
            <div className="banner-title">Could not start the practice run</div>
            <div className="banner-desc">
              {error.code === 'conflict'
                ? 'This request was already submitted. Try again.'
                : error.message}
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <MaterialPicker
          open
          purpose="generation"
          max={MAX_MATERIALS}
          initialSelected={runMaterials.map((entry) => entry.id)}
          onClose={() => setPickerOpen(false)}
          onContinue={async (selection) => {
            setPickerOpen(false)
            // The route's material is always in the run; the picker's
            // selection contributes only the extras (D-10).
            const records: MaterialRecord[] = []
            for (const picked of selection) {
              if (picked.materialId === materialIdForRequest) continue
              try {
                records.push(await client.getMaterial(picked.materialId))
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
