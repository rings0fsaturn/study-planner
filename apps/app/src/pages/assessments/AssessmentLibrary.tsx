import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import { logger } from '../../lib/logger'
import { AssessmentCard } from '../../library/LibraryCards'
import {
  LibraryHubError,
  LibraryHubLoading,
  LibraryHubShell,
} from '../../library/LibraryHubShell'
import { MATERIAL_TITLE_PENDING, useLibraryRows } from '../../library/useLibraryRows'

/**
 * `/assessments` hub (Phase 2, variant B card grid). Renders hydrated rows
 * only; derivation lives in the library model, I/O in the hook.
 */
export function AssessmentLibrary() {
  const assessments = useAssessmentClient()
  const { assessmentRows, materialTitles, loading, refreshing, errorCount, reload } =
    useLibraryRows()

  async function handleRetry(assessmentId: string) {
    try {
      await assessments.regenerateAssessment(assessmentId)
    } catch (error) {
      logger.warn('[library] regenerate failed', error)
    }
  }

  return (
    <LibraryHubShell
      title="Assessments"
      emptyTitle="No assessments yet"
      emptyBody="Generate your first assessment from a material to see it here."
      empty={!loading && assessmentRows.length === 0}
      refreshing={!loading && refreshing && assessmentRows.length > 0}
    >
      {loading && <LibraryHubLoading text="Loading assessments…" />}
      {!loading && errorCount > 0 && (
        <LibraryHubError
          title="Some assessments could not be read"
          errorCount={errorCount}
          onReload={() => reload()}
        />
      )}
      {!loading && assessmentRows.length > 0 && (
        <div className="materials-grid">
          {assessmentRows.map((row) => (
            <AssessmentCard
              key={row.assessmentId}
              row={row}
              title={materialTitles[row.primaryMaterialId] ?? MATERIAL_TITLE_PENDING}
              onRetry={(id) => void handleRetry(id)}
            />
          ))}
        </div>
      )}
    </LibraryHubShell>
  )
}
