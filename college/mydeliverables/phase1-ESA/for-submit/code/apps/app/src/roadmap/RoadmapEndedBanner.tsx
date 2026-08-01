import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import type { RoadmapLifecycleEntry } from './roadmapLifecycle'
import './roadmap.css'

interface RoadmapEndedBannerProps {
  entry: RoadmapLifecycleEntry
  onMarkComplete: () => void
  onAbandon: () => void
  onExtendDeadline?: () => void
}

export function RoadmapEndedBanner({
  entry,
  onMarkComplete,
  onAbandon,
  onExtendDeadline,
}: RoadmapEndedBannerProps) {
  const endDate = format(parseISO(entry.deadline), 'MMM d, yyyy')

  return (
    <section className="roadmap-ended-banner" role="status" aria-label="Roadmap ended">
      <div className="roadmap-ended-copy">
        <div className="mono-caps">Plan ended</div>
        <p>Your plan &apos;{entry.title}&apos; reached its end date on {endDate}.</p>
      </div>
      <div className="roadmap-ended-actions">
        <button className="btn btn-secondary" type="button" onClick={onMarkComplete}>
          Mark complete
        </button>
        <Link className="btn btn-accent" to="/replan?intent=extend" onClick={onExtendDeadline}>
          Extend deadline
        </Link>
        <button className="btn btn-secondary" type="button" onClick={onAbandon}>
          Abandon
        </button>
      </div>
    </section>
  )
}
