// PROTOTYPE — throwaway fixtures for wayfinder #80.
// Stub rows for every family (objective / written / coding) and every honest
// state. No events, no storage, no service calls. Redaction-clean by design.

export type Family = 'objective' | 'written' | 'coding'
export type AssessmentStatus = 'ready' | 'generating' | 'failed' | 'queued'
export type RunMode = 'objective' | 'written' | 'coding' | 'mixed'
export type RunStatus = 'in-progress' | 'generating' | 'completed' | 'abandoned' | 'failed'

export interface AssessmentStub {
  id: string
  materialTitle: string
  family: Family
  status: AssessmentStatus
  score: number | null
  gradedCount: number
  totalCount: number
  date: string
  scope: string
  cached: boolean
  note?: string
}

export interface RunStub {
  runId: string
  materialTitles: string
  mode: RunMode
  status: RunStatus
  completedCount: number
  totalCount: number
  missingCount: number
  date: string
  families: Family[]
  cached: boolean
  resumeLabel?: string
  outcome?: 'completed' | 'abandoned'
  note?: string
}

export const ASSESSMENTS: AssessmentStub[] = [
  {
    id: 'a-acc-fr',
    materialTitle: 'ACCA Financial Reporting, Ch 4-6',
    family: 'objective',
    status: 'ready',
    score: 0.83,
    gradedCount: 5,
    totalCount: 5,
    date: 'Sep 26',
    scope: 'Ch 4-6 · 5 Q',
    cached: true,
  },
  {
    id: 'a-ddia-rep',
    materialTitle: 'DDIA Replication, Ch 5',
    family: 'written',
    status: 'ready',
    score: 0.67,
    gradedCount: 3,
    totalCount: 3,
    date: 'Sep 25',
    scope: 'Pages 151-184 · 3 Q',
    cached: true,
  },
  {
    id: 'a-grok-ch3',
    materialTitle: 'Grokking Algorithms, Ch 3',
    family: 'coding',
    status: 'ready',
    score: 0.67,
    gradedCount: 2,
    totalCount: 3,
    date: 'Sep 24',
    scope: 'Quicksort · 3 Q',
    cached: true,
  },
  {
    id: 'a-acc-leases',
    materialTitle: 'ACCA Leases, IFRS 16',
    family: 'objective',
    status: 'generating',
    score: null,
    gradedCount: 2,
    totalCount: 5,
    date: 'Sep 28',
    scope: 'IFRS 16 · 5 Q',
    cached: true,
    note: '2 of 5 ready · worker still generating',
  },
  {
    id: 'a-csapp-bomb',
    materialTitle: 'CSAPP Bomb Lab notes',
    family: 'coding',
    status: 'failed',
    score: null,
    gradedCount: 0,
    totalCount: 1,
    date: 'Sep 23',
    scope: 'Phase 2 · 1 Q',
    cached: true,
    note: 'code_not_derivable — study notes state the contract but ship the solution',
  },
  {
    id: 'a-acc-consol',
    materialTitle: 'ACCA Consolidation worksheet',
    family: 'written',
    status: 'queued',
    score: null,
    gradedCount: 0,
    totalCount: 4,
    date: 'Sep 28',
    scope: 'Worksheet · 4 Q',
    cached: true,
    note: 'Queued · not started',
  },
  {
    id: 'a-ddia-part',
    materialTitle: 'DDIA Partitioning, Ch 6',
    family: 'objective',
    status: 'generating',
    score: null,
    gradedCount: 3,
    totalCount: 5,
    date: 'Sep 22',
    scope: 'Ch 6 · 5 Q',
    cached: false,
    note: 'Partial · 3 ready, 2 generating',
  },
  {
    id: 'a-acc-offline',
    materialTitle: 'ACCA Ethics, Ch 1 (uncached)',
    family: 'written',
    status: 'ready',
    score: 1.0,
    gradedCount: 2,
    totalCount: 2,
    date: 'Sep 20',
    scope: 'Ch 1 · 2 Q',
    cached: false,
  },
]

export const RUNS: RunStub[] = [
  {
    runId: 'R-104',
    materialTitles: 'DDIA Replication + Partitioning',
    mode: 'mixed',
    status: 'in-progress',
    completedCount: 2,
    totalCount: 5,
    missingCount: 0,
    date: 'Sep 28',
    families: ['objective', 'written', 'coding', 'objective', 'written'],
    cached: true,
    resumeLabel: 'Resume · Problem 3 of 5',
  },
  {
    runId: 'R-103',
    materialTitles: 'Grokking Algorithms, Ch 3',
    mode: 'coding',
    status: 'generating',
    completedCount: 0,
    totalCount: 4,
    missingCount: 0,
    date: 'Sep 28',
    families: ['coding', 'coding', 'coding', 'coding'],
    cached: true,
    resumeLabel: 'Watch generating · 1 of 4 ready',
    note: 'Problems still generating — list stays honest, nothing to grade yet',
  },
  {
    runId: 'R-102',
    materialTitles: 'ACCA Financial Reporting',
    mode: 'objective',
    status: 'completed',
    completedCount: 4,
    totalCount: 5,
    missingCount: 0,
    date: 'Sep 26',
    families: ['objective', 'objective', 'objective', 'objective', 'objective'],
    cached: true,
    outcome: 'completed',
  },
  {
    runId: 'R-101',
    materialTitles: 'DDIA Replication',
    mode: 'written',
    status: 'abandoned',
    completedCount: 1,
    totalCount: 4,
    missingCount: 0,
    date: 'Sep 24',
    families: ['written', 'written', 'written', 'written'],
    cached: true,
    outcome: 'abandoned',
    note: 'Left Sep 24 · kept as history',
  },
  {
    runId: 'R-100',
    materialTitles: 'ACCA Consolidation (partial start)',
    mode: 'mixed',
    status: 'failed',
    completedCount: 1,
    totalCount: 5,
    missingCount: 2,
    date: 'Sep 22',
    families: ['objective', 'written', 'coding'],
    cached: false,
    note: 'Partial start · 2 problems never generated',
  },
]

export const BACKLINK_MATERIAL = {
  title: 'DDIA Ch 5 Replication',
  meta: 'PDF document · 42 min · added Sep 12',
  assessments: [
    { id: 'a-ddia-rep', title: 'Replication check', family: 'written' as Family, state: '2 of 3 met · 0.67' },
    { id: 'a-ddia-part', title: 'Partitioning follow-up', family: 'objective' as Family, state: '3 of 5 graded' },
    { id: 'a-csapp-bomb', title: 'Bomb Lab attempt', family: 'coding' as Family, state: 'Failed' },
  ],
  runs: [
    { id: 'R-104', title: 'Mixed run · Sep 28', state: '2 of 5 graded · resume' },
    { id: 'R-102', title: 'Objective run · Sep 26', state: '4 of 5 · completed' },
  ],
}
