/** Shared short-date formatter ("Sep 12"). One home for the four identical
 * copies (thermo-nuclear B1 follow-up); the NaN guard is the only addition. */
export function formatShortDate(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
