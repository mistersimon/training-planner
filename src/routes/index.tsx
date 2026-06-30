import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadPlan, groupByWeek, type Plan, type Session } from '../lib/plan'
import { dumpPlan, parseGistUrl, pushToGist } from '../lib/gist'
import { useDragReschedule, type DropTarget } from '../lib/useDragReschedule'
import { todayKey, dnum, mondayOf, localKey, rangeLabel, MO } from '../lib/format'
import { colorForActivity } from '../lib/types'
import { Week } from '../components/Week'
import { type EditApi } from '../components/Session'
import {
  DetailSheet,
  type SheetContent,
  type SheetEdit,
  type SheetEditFields,
} from '../components/DetailSheet'
import { LoadPlanPrompt } from '../components/LoadPlanPrompt'
import { SettingsSheet } from '../components/SettingsSheet'
import { RawEditSheet } from '../components/RawEditSheet'

const readConfiguredUrl = () => {
  try {
    return localStorage.getItem(STORE_KEY) || ''
  } catch {
    return ''
  }
}

const route = getRouteApi('/')
const STORE_KEY = 'planUrl'
const TOKEN_KEY = 'gistToken'
const CACHE_PREFIX = 'planCache:'
const DIRTY_PREFIX = 'planDirty:'
const monKeyOf = (dateKey: string) => localKey(mondayOf(dateKey))

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}
const writeToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

// "Dirty" = the device holds local edits not yet pushed to the Gist. Persisted
// so a reload keeps the edits instead of the background fetch silently clobbering
// them with the older remote copy.
const readDirty = (url: string) => {
  try {
    return localStorage.getItem(DIRTY_PREFIX + url) === '1'
  } catch {
    return false
  }
}
const writeDirty = (url: string, dirty: boolean) => {
  try {
    if (dirty) localStorage.setItem(DIRTY_PREFIX + url, '1')
    else localStorage.removeItem(DIRTY_PREFIX + url)
  } catch {
    /* ignore */
  }
}

// Last good raw YAML per source URL, so the PWA can render instantly (and
// offline) while a fresh copy is fetched in the background.
const readCachedPlan = (url: string): string | null => {
  try {
    return localStorage.getItem(CACHE_PREFIX + url)
  } catch {
    return null
  }
}
const writeCachedPlan = (url: string, raw: string) => {
  try {
    localStorage.setItem(CACHE_PREFIX + url, raw)
  } catch {
    /* ignore */
  }
}

// Resolve which plan to load: ?plan= (remembered) → saved URL → bundled sample.
function resolveSource(planParam?: string): { url: string; isFallback: boolean } {
  if (planParam) {
    try {
      localStorage.setItem(STORE_KEY, planParam)
    } catch {
      /* ignore */
    }
    return { url: planParam, isFallback: false }
  }
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved) return { url: saved, isFallback: false }
  } catch {
    /* ignore */
  }
  return { url: import.meta.env.BASE_URL + 'sample-plan.yaml', isFallback: true }
}

export function App() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rawOpen, setRawOpen] = useState(false)
  // Bumped when clearing the saved URL so the source re-resolves even if the
  // ?plan param is already absent.
  const [nonce, setNonce] = useState(0)
  // Bumped by the refresh button to force a re-fetch even when the URL is unchanged.
  const [refreshKey, setRefreshKey] = useState(0)
  const { url, isFallback } = useMemo(() => resolveSource(search.plan), [search.plan, nonce])

  const [state, setState] = useState<{ plan?: Plan; raw?: string; error?: string; loading: boolean }>({
    loading: true,
  })
  // Edit mode + unsaved-edit tracking. `dirtyRef` lets the background fetch see
  // the latest value without re-running on every change.
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(() => readDirty(url))
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const [save, setSave] = useState<{ saving: boolean; error?: string; ok?: boolean }>({ saving: false })

  useEffect(() => {
    let cancelled = false
    setDirty(readDirty(url))
    // A genuine (re)load — allow the next plan render to scroll to today once.
    didInitialScrollRef.current = false

    // 1. Render the last cached plan immediately so the app (especially the
    // installed PWA) never opens blank — even offline. Keep `loading` true so
    // the refresh spinner shows while the background fetch runs.
    const cached = readCachedPlan(url)
    if (cached) {
      try {
        setState({ loading: true, plan: loadPlan(cached), raw: cached })
      } catch {
        setState({ loading: true })
      }
    } else {
      setState({ loading: true })
    }

    // 2. Fetch the latest in the background and swap it in when it arrives.
    // Cache-bust so every load fetches the latest — defeats the browser cache
    // and, importantly, a remote Gist's raw-URL CDN cache (~minutes stale).
    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`
    fetch(fetchUrl, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`returned HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        if (cancelled) return
        // Don't overwrite local unsaved edits with the (older) remote copy.
        if (dirtyRef.current) {
          setState((s) => ({ ...s, loading: false }))
          return
        }
        try {
          const plan = loadPlan(text)
          writeCachedPlan(url, text)
          setState({ loading: false, plan, raw: text })
        } catch (e) {
          // Network gave us unparseable YAML: keep the cached plan if we have
          // one, otherwise surface the parse error.
          if (cached) setState((s) => ({ ...s, loading: false }))
          else setState({ loading: false, error: (e as Error).message || 'YAML could not be parsed.' })
        }
      })
      .catch((e) => {
        if (cancelled) return
        // Offline / network error: silently keep showing the cached plan; only
        // surface an error when there's nothing cached to fall back to.
        if (cached) {
          setState((s) => ({ ...s, loading: false }))
        } else {
          setState({
            loading: false,
            error: `Couldn't load ${url} — ${(e as Error).message}. If this is a remote plan, check the URL allows cross-origin requests.`,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [url, refreshKey])

  const plan = state.plan
  const weeks = useMemo(() => (plan ? groupByWeek(plan.sessions) : []), [plan])

  // The week to bring into view on load / when "Today" is tapped: this week →
  // the first upcoming week → the last week.
  const currentIndex = useMemo(() => {
    if (!weeks.length) return -1
    const now = weeks.findIndex((w) => w.isNow)
    if (now >= 0) return now
    const thisMon = monKeyOf(todayKey)
    const up = weeks.findIndex((w) => w.monKey >= thisMon)
    return up >= 0 ? up : weeks.length - 1
  }, [weeks])

  const scrollRef = useRef<HTMLElement | null>(null)
  const weekRefs = useRef<(HTMLElement | null)[]>([])
  // Whether the one-time "scroll to today" has run for the current plan load.
  const didInitialScrollRef = useRef(false)
  // Index of a freshly-added session whose editor is open but not yet saved.
  // Closing the editor without saving removes it (see closeSheet / sheetEdit).
  const draftIndexRef = useRef<number | null>(null)
  const scrollToWeek = (i: number, behavior: ScrollBehavior = 'smooth') => {
    weekRefs.current[i]?.scrollIntoView({ behavior, block: 'start' })
  }

  // Latest plan, read by the edit handlers without re-creating them each render.
  const planRef = useRef<Plan | undefined>(undefined)
  planRef.current = state.plan

  // Apply an edit: stamp `updated`, serialize, cache, mark dirty. One path for
  // every mutation (reschedule / delete / lock / notes) so they stay consistent.
  const commitPlan = useCallback(
    (next: Plan) => {
      const withUpdated: Plan = { ...next, updated: todayKey }
      const raw = dumpPlan(withUpdated)
      writeCachedPlan(url, raw)
      writeDirty(url, true)
      setState((s) => ({ ...s, plan: withUpdated, raw }))
      setDirty(true)
      setSave((v) => ({ ...v, ok: false, error: undefined }))
    },
    [url],
  )

  // Move a session to another day, or reorder it within a day. `target` carries
  // the day plus an optional sibling to insert next to. Every session can move —
  // `priority: fixed` is only a hint to the AI coach, not an app-level lock.
  const reschedule = useCallback(
    (index: number, target: DropTarget) => {
      const plan = planRef.current
      const cur = plan?.sessions[index]
      if (!plan || !cur) return
      // Can't move a past session, and can't reschedule anything into the past.
      if (cur.date < todayKey || target.dayKey < todayKey) return
      const moved: Session = { ...cur, date: target.dayKey }
      const rest = plan.sessions.filter((_, i) => i !== index)
      let pos = rest.length
      if (target.refIndex != null && target.refIndex !== index) {
        const at = rest.indexOf(plan.sessions[target.refIndex])
        if (at >= 0) pos = target.side === 'after' ? at + 1 : at
      } else {
        // No sibling anchor: drop after the last existing card of that day.
        for (let i = rest.length - 1; i >= 0; i--) {
          if (rest[i].date === target.dayKey) {
            pos = i + 1
            break
          }
        }
      }
      // No-op if it would land exactly where it already is.
      const sameSpot = cur.date === target.dayKey && plan.sessions.indexOf(cur) === pos
      if (sameSpot) return
      rest.splice(pos, 0, moved)
      commitPlan({ ...plan, sessions: rest })
    },
    [commitPlan],
  )

  const deleteSession = useCallback(
    (index: number) => {
      const plan = planRef.current
      if (!plan?.sessions[index]) return
      commitPlan({ ...plan, sessions: plan.sessions.filter((_, i) => i !== index) })
    },
    [commitPlan],
  )

  // Save edited fields (priority / title / activity / location / target / actual /
  // notes) for a session.
  const updateSession = useCallback(
    (index: number, fields: SheetEditFields) => {
      const plan = planRef.current
      if (!plan?.sessions[index]) return
      const sessions = plan.sessions.map((ss, i) =>
        i === index
          ? {
              ...ss,
              priority: fields.priority.trim() || undefined,
              title: fields.title.trim(),
              activity: fields.activity.trim() || undefined,
              location: fields.location.trim() || undefined,
              target: fields.target.trim() || undefined,
              actual: fields.actual.trim() || undefined,
              notes: fields.notes.trim() || undefined,
            }
          : ss,
      )
      commitPlan({ ...plan, sessions })
    },
    [commitPlan],
  )

  // Add a blank session on a day and open the editor for it. Abandoned (still
  // untitled) drafts are cleaned up on close — see closeSheet.
  const addSession = useCallback(
    (dayKey: string) => {
      const plan = planRef.current
      if (!plan) return
      const newIndex = plan.sessions.length
      draftIndexRef.current = newIndex
      commitPlan({ ...plan, sessions: [...plan.sessions, { date: dayKey, title: '' }] })
      navigate({ search: (p) => ({ ...p, s: newIndex }) })
    },
    [commitPlan, navigate],
  )

  const { drag, over, begin } = useDragReschedule(editing, scrollRef, reschedule)
  const editApi: EditApi = useMemo(
    () => ({
      draggingIndex: drag?.index ?? null,
      over,
      onDragStart: begin,
      onDelete: deleteSession,
      onAdd: addSession,
    }),
    [drag, over, begin, deleteSession, addSession],
  )

  // Push the current YAML to the Gist. Needs a raw-gist URL + a stored token.
  const saveToGist = async () => {
    const target = parseGistUrl(url)
    const token = readToken()
    if (!state.raw || !target) {
      setSave({ saving: false, error: 'Set a raw Gist URL in settings to save.' })
      return
    }
    if (!token) {
      setSave({ saving: false, error: 'Add a GitHub token in settings to save.' })
      return
    }
    setSave({ saving: true })
    try {
      await pushToGist(target, token, state.raw)
      writeDirty(url, false)
      setDirty(false)
      setSave({ saving: false, ok: true })
      setEditing(false)
    } catch (e) {
      setSave({ saving: false, error: (e as Error).message || 'Push failed.' })
    }
  }
  // Bring today's card to the top; fall back to the current week's start when
  // today isn't in the plan (e.g. the plan begins in the future).
  const goToday = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current?.querySelector('#today')
    if (el) el.scrollIntoView({ behavior, block: 'start' })
    else if (currentIndex >= 0) scrollToWeek(currentIndex, behavior)
  }

  // Jump to today once per plan load (e.g. opening the PWA), unless a session is
  // being deep-linked open. Reset only by the fetch effect on a real (re)load —
  // NOT on local edits, which produce a new `plan` object each time and would
  // otherwise yank the viewport back to today on every keystroke / drag.
  useEffect(() => {
    if (!plan || didInitialScrollRef.current) return
    didInitialScrollRef.current = true
    if (search.s == null && currentIndex >= 0) {
      // Wait for the week sections to render before scrolling.
      requestAnimationFrame(() => goToday('auto'))
    }
  }, [plan, currentIndex, search.s])

  // Track the week sitting at the top of the viewport so the sticky header can
  // show its range + workout summary as you scroll.
  const [viewWeek, setViewWeek] = useState(-1)
  const visibleRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !weeks.length) return
    visibleRef.current.clear()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = weekRefs.current.indexOf(e.target as HTMLElement)
          if (i < 0) continue
          if (e.isIntersecting) visibleRef.current.add(i)
          else visibleRef.current.delete(i)
        }
        const vis = [...visibleRef.current]
        setViewWeek(vis.length ? Math.min(...vis) : -1)
      },
      // Thin band near the top: the section intersecting it is the topmost one.
      { root, rootMargin: '0px 0px -85% 0px' },
    )
    weekRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [plan, weeks.length])

  const openSession = (index: number) => navigate({ search: (p) => ({ ...p, s: index }) })
  const closeSheet = () => {
    // Drop an abandoned new session (added, then closed without saving). Saving
    // clears the draft ref first (see sheetEdit.onSave), so this only fires on
    // a genuine cancel.
    const i = draftIndexRef.current
    draftIndexRef.current = null
    const plan = planRef.current
    if (i != null && plan?.sessions[i]) {
      commitPlan({ ...plan, sessions: plan.sessions.filter((_, idx) => idx !== i) })
    }
    navigate({ search: (p) => ({ ...p, s: undefined }) })
  }

  const saveUrl = (planUrl: string) => {
    setSettingsOpen(false)
    navigate({ search: (p) => ({ ...p, plan: planUrl, s: undefined }) })
  }
  const useDemo = () => {
    try {
      localStorage.removeItem(STORE_KEY)
    } catch {
      /* ignore */
    }
    setSettingsOpen(false)
    setNonce((n) => n + 1)
    navigate({ search: (p) => ({ ...p, plan: undefined, s: undefined }) })
  }

  // Save hand-edited raw YAML: validate by parsing, then apply the user's text
  // verbatim (keeping their formatting/comments — no re-serialize) and push to
  // the Gist when configured. Returns a message for the editor to surface.
  const saveRaw = async (text: string): Promise<{ error?: string; note?: string }> => {
    let parsed: Plan
    try {
      parsed = loadPlan(text)
    } catch (e) {
      return { error: (e as Error).message || 'YAML could not be parsed.' }
    }
    writeCachedPlan(url, text)
    writeDirty(url, true)
    setState((s) => ({ ...s, plan: parsed, raw: text }))
    setDirty(true)
    setSave((v) => ({ ...v, ok: false, error: undefined }))

    const target = parseGistUrl(url)
    const token = readToken()
    if (!target) return { note: 'Applied on this device. Set a Gist URL in settings to sync.' }
    if (!token) return { note: 'Applied on this device. Add a GitHub token in settings to sync.' }
    setSave({ saving: true })
    try {
      await pushToGist(target, token, text)
      writeDirty(url, false)
      setDirty(false)
      setSave({ saving: false, ok: true })
      return {}
    } catch (e) {
      setSave({ saving: false, error: (e as Error).message || 'Push failed.' })
      return { error: (e as Error).message || 'Push failed.' }
    }
  }

  const sheet: SheetContent | null = useMemo(() => {
    const i = search.s
    if (i != null && plan && plan.sessions[i]) {
      const s = plan.sessions[i]
      return {
        title: s.title || '',
        kindLabel: s.activity,
        kindColor: colorForActivity(s.activity),
        location: s.location,
        target: s.target,
        actual: s.actual,
        body: s.notes,
      }
    }
    return null
  }, [search.s, plan])

  // Edit capability for the open session. Always available so a session can be
  // edited straight from its detail sheet; global edit mode just opens it in the
  // form directly (see `startEditing` on the sheet).
  const sheetEdit: SheetEdit | undefined = useMemo(() => {
    const i = search.s
    if (i == null || !plan?.sessions[i]) return undefined
    const s = plan.sessions[i]
    return {
      index: i,
      title: s.title || '',
      activity: s.activity || '',
      location: s.location || '',
      target: s.target || '',
      actual: s.actual || '',
      notes: s.notes || '',
      priority: s.priority || '',
      onSave: (fields) => {
        draftIndexRef.current = null // saved — no longer an abandoned draft
        updateSession(i, fields)
      },
    }
  }, [search.s, plan, updateSession])

  // Distinct activity labels already in use — suggested in the editor's datalist.
  const activities = useMemo(() => {
    const set = new Set<string>()
    plan?.sessions.forEach((s) => s.activity && set.add(s.activity))
    return [...set].sort()
  }, [plan])

  const updatedLabel = useMemo(() => {
    if (!plan?.updated) return ''
    const d = dnum(plan.updated)
    return d ? `Updated ${d.getDate()} ${MO[d.getMonth()]}` : `Updated ${plan.updated}`
  }, [plan])

  // The week whose range the sticky header reflects: the one at the top of the
  // viewport, falling back to the current week before any scroll.
  const headWeek = weeks[viewWeek] ?? weeks[currentIndex]

  const iconBtn =
    'flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-60'

  return (
    <>
      <main ref={scrollRef} className="fixed inset-0 overflow-y-auto" aria-live="polite">
        <header
          className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)] px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
        >
          <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {headWeek && (
                <>
                  <span className="flex-none text-[14px] font-semibold">{rangeLabel(headWeek.mon)}</span>
                  {headWeek.isNow && (
                    <span className="flex-none rounded-full bg-[var(--ring)] px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-white">
                      Now
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-none items-center gap-2">
              {currentIndex >= 0 && !editing && (
                <button
                  type="button"
                  onClick={() => goToday()}
                  className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                aria-label={editing ? 'Done editing' : 'Edit schedule'}
                aria-pressed={editing}
                onClick={() => setEditing((v) => !v)}
                className={
                  editing
                    ? 'flex h-8 items-center rounded-full bg-[var(--ring)] px-3.5 text-[12px] font-semibold text-white'
                    : iconBtn
                }
              >
                {editing ? (
                  'Done'
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                aria-label="Edit raw YAML"
                onClick={() => setRawOpen(true)}
                disabled={!state.raw}
                className={iconBtn}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="m8 8-4 4 4 4" />
                  <path d="m16 8 4 4-4 4" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Refresh plan"
                onClick={() => {
                  // Explicit pull: discard any unsaved local edits and re-fetch.
                  if (dirty && !confirm('Discard unsaved edits and reload from the Gist?')) return
                  writeDirty(url, false)
                  setDirty(false)
                  setRefreshKey((k) => k + 1)
                }}
                disabled={state.loading}
                className={iconBtn}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`}
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
                className={iconBtn}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1100px] px-4 pt-1.5">
          {state.error ? (
            <div className="mx-auto my-6 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[14px_16px] text-[14px]">
              <b className="text-[var(--key)]">Couldn't load the plan.</b>
              <br />
              {state.error}
            </div>
          ) : (
            <>
              {isFallback && plan && (
                <LoadPlanPrompt
                  onLoad={(planUrl) => navigate({ search: (p) => ({ ...p, plan: planUrl, s: undefined }) })}
                />
              )}
              {weeks.length
                ? weeks.map((week, i) => (
                    <Week
                      key={week.monKey}
                      week={week}
                      onOpen={openSession}
                      innerRef={(el) => {
                        weekRefs.current[i] = el
                      }}
                      editing={editing}
                      edit={editApi}
                    />
                  ))
                : plan && (
                    <div className="mt-8 text-center text-[14px] text-[var(--muted)]">
                      No sessions in this plan yet.
                    </div>
                  )}
            </>
          )}
          <footer
            className="mt-[22px] px-[2px] text-[12px] text-[var(--faint)]"
            style={{
              paddingBottom: editing
                ? 'calc(env(safe-area-inset-bottom) + 84px)'
                : 'calc(env(safe-area-inset-bottom) + 16px)',
            }}
          >
            {editing
              ? 'Drag a session onto another day to reschedule it.'
              : 'Tap a session for details · scroll through the weeks.'}
            {updatedLabel && ` · ${updatedLabel}`}
          </footer>
        </div>
      </main>

      {/* Floating ghost that follows the pointer during a drag. */}
      {drag && (
        <div
          className="pointer-events-none fixed z-[60] flex max-w-[260px] items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-medium shadow-[0_8px_30px_rgba(8,12,22,0.35)]"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -130%)' }}
        >
          <span className="h-4 w-1 flex-none rounded-[3px]" style={{ background: drag.color }} />
          <span className="truncate">{drag.label}</span>
        </div>
      )}

      {/* Edit-mode action bar: save the reschedules back to the Gist. */}
      {editing && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg)] px-4 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
        >
          <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3">
            <div className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--muted)]">
              {save.error ? (
                <span className="text-[var(--key)]">{save.error}</span>
              ) : save.saving ? (
                'Saving…'
              ) : save.ok && !dirty ? (
                'Saved to Gist ✓'
              ) : dirty ? (
                'Unsaved changes'
              ) : (
                'No changes yet'
              )}
            </div>
            <button
              type="button"
              onClick={saveToGist}
              disabled={!dirty || save.saving}
              className="flex-none rounded-[8px] bg-[var(--ring)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Save to Gist
            </button>
          </div>
        </div>
      )}

      <DetailSheet
        content={sheet}
        edit={sheetEdit}
        startEditing={editing}
        activities={activities}
        onClose={closeSheet}
      />
      {rawOpen && state.raw != null && (
        <RawEditSheet
          initial={state.raw}
          saving={save.saving}
          onSave={saveRaw}
          onClose={() => setRawOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsSheet
          currentUrl={readConfiguredUrl()}
          currentToken={readToken()}
          isDemo={isFallback}
          onSave={saveUrl}
          onSaveToken={writeToken}
          onUseDemo={useDemo}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
