import { PracticeRunCard } from '../../library/LibraryCards'
import {
  LibraryHubError,
  LibraryHubLoading,
  LibraryHubShell,
} from '../../library/LibraryHubShell'
import { MATERIAL_TITLE_PENDING, useLibraryRows } from '../../library/useLibraryRows'

/**
 * `/practice` hub (Phase 3, variant B card grid). Resume first, history
 * second; derivation lives in the library model, I/O in the hook.
 */
export function PracticeHub() {
  const { resumeRows, historyRows, runRows, materialTitles, loading, refreshing, errorCount, reload } =
    useLibraryRows()

  return (
    <LibraryHubShell
      title="Practice"
      emptyTitle="No practice runs yet"
      emptyBody="Start a run from a ready material to see it here with its resume point."
      empty={!loading && runRows.length === 0}
      refreshing={!loading && refreshing && runRows.length > 0}
    >
      {loading && <LibraryHubLoading text="Loading practice runs…" />}
      {!loading && errorCount > 0 && (
        <LibraryHubError
          title="Some practice runs could not be read"
          errorCount={errorCount}
          onReload={() => reload()}
        />
      )}
      {!loading && resumeRows.length > 0 && (
        <section aria-label="Resume">
          <h2 className="library-section-head">Resume</h2>
          <div className="materials-grid">
            {resumeRows.map((row, index) => (
              <PracticeRunCard
                key={row.runId}
                row={row}
                title={materialTitles[row.primaryMaterialId] ?? MATERIAL_TITLE_PENDING}
                accent={index === 0}
              />
            ))}
          </div>
        </section>
      )}
      {!loading && historyRows.length > 0 && (
        <section aria-label="History">
          <h2 className="library-section-head">History</h2>
          <div className="materials-grid">
            {historyRows.map((row) => (
              <PracticeRunCard
                key={row.runId}
                row={row}
                title={materialTitles[row.primaryMaterialId] ?? MATERIAL_TITLE_PENDING}
                accent={false}
              />
            ))}
          </div>
        </section>
      )}
    </LibraryHubShell>
  )
}
