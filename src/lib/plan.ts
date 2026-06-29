import yaml from 'js-yaml'
import { dstr, mondayOf, todayKey, localKey } from './format'

// Single source of truth for a session's state — mutually exclusive:
//   planned (default) · done · optional (skippable) · key (standout, highlighted)
//   · fixed (locked to its date — can't be dragged/rescheduled)
export type SessionStatus = 'planned' | 'done' | 'optional' | 'key' | 'fixed'

export interface Session {
  date: string
  title: string
  activity?: string
  location?: string // where it happens (gym, track, pool…) — shown on the card
  summary?: string // one-liner shown on the card
  notes?: string // longer markdown shown in the detail sheet
  status?: SessionStatus
}

export interface Plan {
  title?: string
  updated?: string
  goals?: string[]
  notes?: string
  sessions: Session[]
}

// Normalize one raw session: coerce the date, and fold the legacy boolean flags
// (`important`/`fixed`) into the single `status`. An explicit done/optional/key/
// fixed status wins; otherwise important → key, fixed → fixed.
function normalizeSession(raw: Record<string, unknown>): Session {
  const { important, fixed, status, ...rest } = raw as Record<string, unknown> & {
    important?: boolean
    fixed?: boolean
    status?: SessionStatus
  }
  let next: SessionStatus | undefined = status
  if (!next || next === 'planned') {
    if (important) next = 'key'
    else if (fixed) next = 'fixed'
  }
  return { ...(rest as Omit<Session, 'date' | 'status'>), date: dstr(raw.date), status: next }
}

// Parse the flat YAML plan: a `sessions` list plus optional title/updated/goals/notes.
export function loadPlan(text: string): Plan {
  const raw = (yaml.load(text) ?? {}) as Record<string, unknown>
  const sessions: Session[] = Array.isArray(raw.sessions)
    ? (raw.sessions as Record<string, unknown>[]).map(normalizeSession)
    : []

  return {
    title: raw.title as string | undefined,
    updated: raw.updated != null ? dstr(raw.updated) : undefined,
    goals: Array.isArray(raw.goals) ? (raw.goals as unknown[]).map(String) : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    sessions,
  }
}

export interface IndexedSession {
  session: Session
  index: number
}

export interface DayGroup {
  key: string
  dt: Date | null
  isPast: boolean
  isToday: boolean
  isImportant: boolean
  sessions: IndexedSession[]
}

export interface WeekGroup {
  monKey: string
  mon: Date
  isNow: boolean
  counts: Record<string, number>
  days: DayGroup[]
}

// Group the flat session list into weeks → days, preserving each session's
// original index (used to deep-link the detail sheet via the `s` search param).
export function groupByWeek(sessions: Session[]): WeekGroup[] {
  const indexed: IndexedSession[] = sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => (dstr(a.session.date) < dstr(b.session.date) ? -1 : 1)) // stable: same-date keeps input order

  const weeks = new Map<string, WeekGroup>()
  for (const item of indexed) {
    const dateKey = dstr(item.session.date)
    const monKey = localKey(mondayOf(dateKey))

    let week = weeks.get(monKey)
    if (!week) {
      const mon = new Date(monKey + 'T00:00:00')
      // Pre-create all 7 days (Mon→Sun) so every day renders, even empty ones.
      const days: DayGroup[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon)
        d.setDate(d.getDate() + i)
        const k = localKey(d)
        days.push({
          key: k,
          dt: d,
          isPast: k < todayKey,
          isToday: k === todayKey,
          isImportant: false,
          sessions: [],
        })
      }
      week = {
        monKey,
        mon,
        isNow: todayKey >= monKey && todayKey <= days[6].key,
        counts: {},
        days,
      }
      weeks.set(monKey, week)
    }

    const a = item.session.activity
    if (a) week.counts[a] = (week.counts[a] ?? 0) + 1

    const day = week.days.find((d) => d.key === dateKey)
    if (day) {
      day.sessions.push(item)
      if (item.session.status === 'key') day.isImportant = true
    }
  }

  return [...weeks.values()]
}
