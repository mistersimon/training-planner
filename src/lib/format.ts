export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Normalize a YAML date value (string or Date) to a YYYY-MM-DD key.
export const dstr = (v: unknown): string =>
  v instanceof Date && !isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10)

export const dnum = (k: string): Date | null => {
  const d = new Date(k + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

// Format a Date to a YYYY-MM-DD key using LOCAL components. Use this for keys
// derived from local-time Dates (mondayOf, week ends); do NOT use toISOString,
// which converts to UTC and shifts the day in non-UTC timezones.
export const localKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayKey = localKey(new Date())

export function mondayOf(k: string): Date {
  const d = new Date(k + 'T00:00:00')
  const off = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - off)
  return d
}

export function rangeLabel(mon: Date): string {
  const end = new Date(mon)
  end.setDate(end.getDate() + 6)
  if (mon.getMonth() === end.getMonth()) return `${mon.getDate()}–${end.getDate()} ${MO[end.getMonth()]}`
  return `${mon.getDate()} ${MO[mon.getMonth()]} – ${end.getDate()} ${MO[end.getMonth()]}`
}
