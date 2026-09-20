/**
 * The No-Spinner Rule (DESIGN.md): three pulsing dots plus a calm title, never a
 * spinner. Used for route-level waits where there is nothing else to show.
 */
export function LoadingState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="processing-state" role="status">
      <div className="processing-dots" aria-hidden="true">
        <div className="processing-dot" />
        <div className="processing-dot" />
        <div className="processing-dot" />
      </div>
      <div className="processing-title">{title}</div>
      {sub && <div className="processing-sub">{sub}</div>}
    </div>
  )
}
