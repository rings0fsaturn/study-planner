import { useSearchParams } from 'react-router-dom'
import { RoadmapCalendar } from '../roadmap/RoadmapCalendar'

export function Roadmap() {
  const [params] = useSearchParams()
  const roadmapCreatedAt = params.get('roadmap')

  return roadmapCreatedAt
    ? <RoadmapCalendar roadmapCreatedAt={roadmapCreatedAt} readOnly />
    : <RoadmapCalendar />
}
