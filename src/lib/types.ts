// Activities are whatever the YAML uses — nothing is hardcoded. Each activity
// string gets a stable color derived from a hash of the string, so the same
// activity always looks the same and different ones stay visually distinct.

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function colorForActivity(activity: string | undefined): string {
  const a = (activity ?? '').trim().toLowerCase()
  if (!a) return 'hsl(215 16% 60%)' // no activity → neutral gray
  const hue = hash(a) % 360
  // Fixed saturation/lightness keeps contrast reasonable in both light and dark.
  // Case-insensitive (lowercased above) so "Run" and "run" share a color.
  return `hsl(${hue} 64% 52%)`
}
