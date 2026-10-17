import { describe, expect, it, vi } from 'vitest'
import type { EventStore } from '../events/EventStore'
import { FakeAssessmentClient, attemptRecord, codingQuestion, predictionGrade, queuedJob, readyAssessment, writtenQuestion } from '../assessments/testing/fakeAssessmentClient'
import { AssessmentServiceError, type AttemptRecord } from '../assessments/types'
import { FakeMaterialClient } from '../materials/testing/fakeMaterialClient'
import type { GradeScript, MaterialDef, SynthDriverDeps } from './synthDriver'
import { ingestSharedSet, runGradedWeek } from './synthDriver'

function makeDeps(overrides: Partial<SynthDriverDeps> = {}): SynthDriverDeps {
  return {
    // Unused by the driver (attemptFlow owns the event writes); kept so the
    // live runbook passes one deps object to driver + attemptFlow (D-07).
    eventStore: { bulkAppend: vi.fn(async () => []) } as unknown as EventStore,
    assessments: new FakeAssessmentClient(),
    materials: new FakeMaterialClient(),
    requestId: () => 'req-1',
    ...overrides,
  }
}

describe('runGradedWeek', () => {
  it('generates one family per call and submits the scripted objective answer', async () => {
    const assessments = new FakeAssessmentClient()
    const assessment = readyAssessment({ id: 'a-1' })
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(assessment)
    assessments.submitAssessmentAttempt.mockResolvedValue({
      attemptId: 'att-1',
      questionId: 'q1',
      status: 'queued',
      jobId: 'job-grade-1',
    })
    assessments.listAssessmentAttempts.mockImplementation(async () => {
      const submitted = assessments.submitAssessmentAttempt.mock.calls[0]?.[2]
      return [
        attemptRecord({
          attemptId: 'att-1',
          clientAttemptId: submitted?.clientAttemptId ?? 'ca-missing',
          questionId: 'q1',
          assessmentId: 'a-1',
          status: 'graded',
          grade: predictionGrade({ attemptId: 'att-1', questionId: 'q1' }),
        }),
      ]
    })
    const deps = makeDeps({ assessments })

    const report = await runGradedWeek(deps, ['mat-1'], [{ format: 'objective', correct: true }], {
      readyPollIntervalMs: 0,
      gradePollIntervalMs: 0,
    })

    expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    expect(assessments.generateAssessment.mock.calls[0]?.[0].recipe).toMatchObject({
      formats: ['objective'],
      questionCount: 1,
    })
    expect(assessments.submitAssessmentAttempt).toHaveBeenCalledTimes(1)
    expect(report).toEqual({ attempted: 1, graded: 1 })
  })

  /** Runs one script entry and returns the submitted answer input. */
  async function submittedAnswer(
    assessments: FakeAssessmentClient,
    script: GradeScript,
  ): Promise<unknown> {
    const question = script.format === 'written' ? writtenQuestion() : codingQuestion()
    const assessment = readyAssessment({ id: 'a-1', questions: [question] })
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(assessment)
    assessments.submitAssessmentAttempt.mockResolvedValue({
      attemptId: 'att-1',
      questionId: question.id,
      status: 'queued',
      jobId: 'job-grade-1',
    })
    assessments.listAssessmentAttempts.mockImplementation(async (): Promise<AttemptRecord[]> => [])
    await runGradedWeek(makeDeps({ assessments }), ['mat-1'], [script], {
      readyPollIntervalMs: 0,
      gradePollIntervalMs: 0,
    })
    return assessments.submitAssessmentAttempt.mock.calls[0]?.[2].answer
  }

  it('routes written scripts to free-text answers (effort differs by intent)', async () => {
    const assessments = new FakeAssessmentClient()
    const correct = (await submittedAnswer(assessments, { format: 'written', correct: true })) as {
      text: string
    }
    expect(typeof correct.text).toBe('string')
    expect(correct.text.trim().length).toBeGreaterThan(0)

    const incorrectAssessments = new FakeAssessmentClient()
    const incorrect = (await submittedAnswer(incorrectAssessments, {
      format: 'written',
      correct: false,
    })) as { text: string }
    expect(incorrect.text.trim().length).toBeGreaterThan(0)
    expect(incorrect.text).not.toBe(correct.text)
  })

  it('routes coding scripts to python sources within the contract config', async () => {
    const assessments = new FakeAssessmentClient()
    const correct = (await submittedAnswer(assessments, { format: 'coding', correct: true })) as {
      language: string
      source: string
      config: { stdin: string; timeLimitMs: number; memoryLimitMb: number }
    }
    expect(correct.language).toBe('python')
    expect(correct.source.trim().length).toBeGreaterThan(0)
    expect(correct.config.timeLimitMs).toBeGreaterThanOrEqual(100)
    expect(correct.config.timeLimitMs).toBeLessThanOrEqual(30000)
    expect(correct.config.memoryLimitMb).toBeGreaterThanOrEqual(16)
    expect(correct.config.memoryLimitMb).toBeLessThanOrEqual(1024)

    const incorrectAssessments = new FakeAssessmentClient()
    const incorrect = (await submittedAnswer(incorrectAssessments, {
      format: 'coding',
      correct: false,
    })) as { language: string; source: string }
    expect(incorrect.language).toBe('python')
    expect(incorrect.source).not.toBe(correct.source)
  })

  it('runs a mixed week as sequential one-family calls with distinct correlation ids', async () => {
    const assessments = new FakeAssessmentClient()
    const formats: string[] = []
    assessments.generateAssessment.mockImplementation(async (input) => {
      formats.push(input.recipe.formats[0] ?? 'unknown')
      return queuedJob({ jobId: `job-${formats.length}`, resultId: `a-${formats.length}` })
    })
    const questionFor = (format: string) =>
      format === 'written' ? writtenQuestion() : format === 'coding' ? codingQuestion() : readyAssessment().questions[0]!
    const readyAfterFirstPoll = new Set<string>()
    assessments.getAssessment.mockImplementation(async (id) => {
      const index = Number(id.split('-')[1]) - 1
      const format = formats[index] ?? 'objective'
      if (!readyAfterFirstPoll.has(id)) {
        readyAfterFirstPoll.add(id)
        return readyAssessment({ id, status: 'generating', questions: [questionFor(format)] })
      }
      return readyAssessment({ id, questions: [questionFor(format)] })
    })
    assessments.submitAssessmentAttempt.mockImplementation(async (assessmentId, questionId) => ({
      attemptId: `att-${assessmentId}`,
      questionId,
      status: 'queued',
      jobId: `job-grade-${assessmentId}`,
    }))
    // Only the first entry grades; the rest stay ungraded (honest partial week).
    assessments.listAssessmentAttempts.mockImplementation(async (assessmentId) => {
      if (assessmentId !== 'a-1') return []
      const submitted = assessments.submitAssessmentAttempt.mock.calls[0]?.[2]
      return [
        attemptRecord({
          attemptId: 'att-a-1',
          clientAttemptId: submitted?.clientAttemptId ?? 'ca-missing',
          questionId: 'q1',
          assessmentId: 'a-1',
          status: 'graded',
          grade: predictionGrade({ attemptId: 'att-a-1', questionId: 'q1' }),
        }),
      ]
    })
    let nextId = 0
    const deps = makeDeps({ assessments, requestId: () => `req-${(nextId += 1)}` })

    const report = await runGradedWeek(
      deps,
      ['mat-1'],
      [
        { format: 'objective', correct: true },
        { format: 'written', correct: false },
        { format: 'coding', correct: false },
      ],
      { readyPollIntervalMs: 0, gradePollIntervalMs: 0, gradePollAttempts: 2 },
    )

    expect(assessments.generateAssessment).toHaveBeenCalledTimes(3)
    const calls = assessments.generateAssessment.mock.calls.map((call) => call[0])
    expect(calls.map((input) => input.recipe)).toEqual([
      { formats: ['objective'], questionCount: 1, difficulty: 3 },
      { formats: ['written'], questionCount: 1, difficulty: 3 },
      { formats: ['coding'], questionCount: 1, difficulty: 3 },
    ])
    for (const input of calls) expect(input.materialIds).toEqual(['mat-1'])
    expect(new Set(calls.map((input) => input.correlationId)).size).toBe(3)
    expect(assessments.submitAssessmentAttempt).toHaveBeenCalledTimes(3)
    expect(report).toEqual({ attempted: 3, graded: 1 })
  })
})

describe('ingestSharedSet', () => {
  const defs: MaterialDef[] = [
    { title: 'React talk', kind: 'youtube', source: 'https://youtube.com/watch?v=x' },
    { title: 'React article', kind: 'url', source: 'https://example.test/react' },
  ]

  it('creates materials in order and returns ids once ready', async () => {
    const materials = new FakeMaterialClient()
    const deps = makeDeps({ materials })
    // New rows start pending; report them ready so the poll exits honestly.
    const inner = materials.getMaterial.bind(materials)
    materials.getMaterial = async (id: string) => ({
      ...(await inner(id)),
      ingestionState: 'ready' as const,
    })
    const created = await ingestSharedSet(deps, defs, { readyPollIntervalMs: 0 })
    expect(created).toHaveLength(2)
    expect(materials.materials.map((m) => m.title)).toEqual(['React talk', 'React article'])
    expect(materials.uploadCalls).toEqual([])
  })

  it('polls pending materials until ready', async () => {
    const materials = new FakeMaterialClient()
    const deps = makeDeps({ materials })
    let polls = 0
    const inner = materials.getMaterial.bind(materials)
    materials.getMaterial = async (id: string) => {
      polls += 1
      if (polls >= 3) {
        const record = await inner(id)
        return { ...record, ingestionState: 'ready' as const }
      }
      return inner(id)
    }
    const created = await ingestSharedSet(deps, defs.slice(0, 1), { readyPollIntervalMs: 0 })
    expect(created).toHaveLength(1)
    expect(polls).toBeGreaterThanOrEqual(3)
  })

  it('uploads and completes file materials, and refuses a file def without bytes', async () => {
    const materials = new FakeMaterialClient()
    const inner = materials.getMaterial.bind(materials)
    materials.getMaterial = async (id: string) => ({
      ...(await inner(id)),
      ingestionState: 'ready' as const,
    })
    const file = new File(['%PDF-fake'], 'learningreact.pdf', { type: 'application/pdf' })
    const withFile = makeDeps({ materials })
    const created = await ingestSharedSet(
      withFile,
      [{ title: 'React book', kind: 'file', source: 'learningreact.pdf', file }],
      { readyPollIntervalMs: 0 },
    )
    expect(created).toHaveLength(1)
    expect(materials.uploadCalls).toHaveLength(1)
    expect(materials.completeCalls).toEqual(created)

    const withoutFile = makeDeps({ materials: new FakeMaterialClient() })
    await expect(
      ingestSharedSet(withoutFile, [{ title: 'React book', kind: 'file', source: 'learningreact.pdf' }], {
        readyPollIntervalMs: 0,
      }),
    ).rejects.toThrow(/needs a File/)
    // Validated before creating: no orphan pending row strands the account.
    expect((withoutFile.materials as FakeMaterialClient).materials).toHaveLength(0)
  })

  it('surfaces failed ingestion instead of returning the id', async () => {
    const materials = new FakeMaterialClient()
    const deps = makeDeps({ materials })
    materials.getMaterial = async (id: string) => {
      const record = materials.materials.find((m) => m.id === id)
      if (!record) throw new Error('missing in fake')
      return { ...record, ingestionState: 'failed' as const, ingestionError: 'extract bombed' }
    }
    await expect(ingestSharedSet(deps, defs.slice(0, 1), { readyPollIntervalMs: 0 })).rejects.toThrow(
      /ingestion failed/,
    )
  })

  it('reuses one request id per material (rule 17 join)', async () => {
    const materials = new FakeMaterialClient()
    const seen: string[] = []
    const inner = materials.createMaterial.bind(materials)
    materials.createMaterial = async (input) => {
      seen.push(input.clientId)
      return inner(input)
    }
    const innerGet = materials.getMaterial.bind(materials)
    materials.getMaterial = async (id: string) => ({
      ...(await innerGet(id)),
      ingestionState: 'ready' as const,
    })
    let calls = 0
    const deps = makeDeps({ materials, requestId: () => `req-${(calls += 1)}` })
    await ingestSharedSet(deps, defs.slice(0, 1), { readyPollIntervalMs: 0 })
    expect(seen).toEqual(['req-1'])
    expect(calls).toBe(1)
  })

  it('throws a timeout when ingestion never leaves pending', async () => {
    const materials = new FakeMaterialClient()
    const deps = makeDeps({ materials })
    await expect(
      ingestSharedSet(deps, defs.slice(0, 1), {
        readyPollIntervalMs: 0,
        readyPollAttempts: 2,
      }),
    ).rejects.toThrow(/not ready/)
  })

  it('marks the row failed when the file upload throws (no stranded pending)', async () => {
    const materials = new FakeMaterialClient()
    const inner = materials.getMaterial.bind(materials)
    materials.getMaterial = async (id: string) => ({
      ...(await inner(id)),
      ingestionState: 'ready' as const,
    })
    materials.uploadError = new Error('boom')
    const file = new File(['%PDF-fake'], 'learningreact.pdf', { type: 'application/pdf' })
    const deps = makeDeps({ materials })
    await expect(
      ingestSharedSet(
        deps,
        [{ title: 'React book', kind: 'file', source: 'learningreact.pdf', file }],
        { readyPollIntervalMs: 0 },
      ),
    ).rejects.toThrow(/boom/)
    expect(materials.markFailedCalls).toHaveLength(1)
  })

  it('returns empty for empty defs (contract pin)', async () => {
    const deps = makeDeps()
    await expect(ingestSharedSet(deps, [], { readyPollIntervalMs: 0 })).resolves.toEqual([])
  })
})

describe('runGradedWeek failures', () => {
  const fastOpts = { readyPollIntervalMs: 0, gradePollIntervalMs: 0, gradePollAttempts: 1 }

  it('treats a failed assessment as terminal (fresh run, never a retry)', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', status: 'failed' }))
    await expect(
      runGradedWeek(makeDeps({ assessments }), ['mat-1'], [{ format: 'objective', correct: true }], fastOpts),
    ).rejects.toThrow(/terminal/)
    expect(assessments.submitAssessmentAttempt).not.toHaveBeenCalled()
  })

  it('refuses an assessment with no questions instead of submitting blind', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', questions: [] }))
    await expect(
      runGradedWeek(makeDeps({ assessments }), ['mat-1'], [{ format: 'objective', correct: true }], fastOpts),
    ).rejects.toThrow(/no question/)
  })

  it('passes typed service errors through untouched (rule 22)', async () => {
    const assessments = new FakeAssessmentClient()
    const quota = new AssessmentServiceError('quota_exhausted', 'generation quota exhausted', false)
    assessments.generateAssessment.mockRejectedValue(quota)
    await expect(
      runGradedWeek(makeDeps({ assessments }), ['mat-1'], [{ format: 'objective', correct: true }], fastOpts),
    ).rejects.toBe(quota)
  })

  it('passes submit errors through untouched (rule 22)', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1' }))
    const offline = new AssessmentServiceError('network', 'assessment request failed', true)
    assessments.submitAssessmentAttempt.mockRejectedValue(offline)
    await expect(
      runGradedWeek(makeDeps({ assessments }), ['mat-1'], [{ format: 'objective', correct: true }], fastOpts),
    ).rejects.toBe(offline)
  })

  it('throws a timeout when generation never leaves generating', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', status: 'generating' }))
    await expect(
      runGradedWeek(makeDeps({ assessments }), ['mat-1'], [{ format: 'objective', correct: true }], {
        ...fastOpts,
        readyPollAttempts: 2,
      }),
    ).rejects.toThrow(/not ready/)
    expect(assessments.submitAssessmentAttempt).not.toHaveBeenCalled()
  })

  it('sends band difficulty per entry, defaulting to the mid band the server gate requires', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockImplementation(async () => queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1' }))
    assessments.submitAssessmentAttempt.mockResolvedValue({
      attemptId: 'att-1',
      questionId: 'q1',
      status: 'queued',
      jobId: 'job-grade-1',
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const deps = makeDeps({ assessments })
    await runGradedWeek(deps, ['mat-1'], [{ format: 'objective', correct: true }], fastOpts)
    await runGradedWeek(deps, ['mat-1'], [{ format: 'objective', correct: true, difficulty: 5 }], fastOpts)
    expect(assessments.generateAssessment.mock.calls[0]?.[0].recipe).toMatchObject({
      formats: ['objective'],
      questionCount: 1,
      difficulty: 3,
    })
    expect(assessments.generateAssessment.mock.calls[1]?.[0].recipe).toMatchObject({ difficulty: 5 })
  })

  it('lets the pilot override scripted answers (steady mostly-correct weeks)', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1' }))
    assessments.submitAssessmentAttempt.mockResolvedValue({
      attemptId: 'att-1',
      questionId: 'q1',
      status: 'queued',
      jobId: 'job-grade-1',
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    await runGradedWeek(
      makeDeps({ assessments }),
      ['mat-1'],
      [{ format: 'objective', correct: true }],
      { ...fastOpts, answerFor: () => ({ index: 1 }) },
    )
    expect(assessments.submitAssessmentAttempt.mock.calls[0]?.[2].answer).toEqual({ index: 1 })
  })

  it('rejects more than one material id (server takes exactly one)', async () => {
    const assessments = new FakeAssessmentClient()
    await expect(
      runGradedWeek(makeDeps({ assessments }), ['m1', 'm2'], [{ format: 'objective', correct: true }], fastOpts),
    ).rejects.toThrow(/exactly one materialId/)
    expect(assessments.generateAssessment).not.toHaveBeenCalled()
  })

  it('accepts a partial assessment with a question (degraded-worker shape)', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', status: 'partial' }))
    assessments.submitAssessmentAttempt.mockResolvedValue({
      attemptId: 'att-1',
      questionId: 'q1',
      status: 'queued',
      jobId: 'job-grade-1',
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const report = await runGradedWeek(
      makeDeps({ assessments }),
      ['mat-1'],
      [{ format: 'objective', correct: true }],
      fastOpts,
    )
    expect(report).toEqual({ attempted: 1, graded: 0 })
    expect(assessments.submitAssessmentAttempt).toHaveBeenCalledTimes(1)
  })

  it('refuses an unknown format instead of submitting blind', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockResolvedValue(queuedJob({ resultId: 'a-1' }))
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1' }))
    await expect(
      runGradedWeek(
        makeDeps({ assessments }),
        ['mat-1'],
        [{ format: 'bogus', correct: true } as unknown as GradeScript],
        fastOpts,
      ),
    ).rejects.toThrow(/unsupported format/)
  })

  it('returns zero counts for an empty script (contract pin)', async () => {
    const assessments = new FakeAssessmentClient()
    await expect(runGradedWeek(makeDeps({ assessments }), ['mat-1'], [], fastOpts)).resolves.toEqual({
      attempted: 0,
      graded: 0,
    })
    expect(assessments.generateAssessment).not.toHaveBeenCalled()
  })
})
