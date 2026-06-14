import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { loadPlan, groupByWeek, type Plan } from '../lib/plan'
import { todayKey, dstr, dnum, mondayOf, localKey, MO } from '../lib/format'
import { colorForActivity } from '../lib/types'
import { useSwipe } from '../lib/useSwipe'
import { Week } from '../components/Week'
import { DetailSheet, type SheetContent } from '../components/DetailSheet'
import { LoadPlanPrompt } from '../components/LoadPlanPrompt'
import { SettingsSheet } from '../components/SettingsSheet'

const readConfiguredUrl = () => {
  try {
    return localStorage.getItem(STORE_KEY) || ''
  } catch {
    return ''
  }
}

const route = getRouteApi('/')
const STORE_KEY = 'planUrl'
const monKeyOf = (dateKey: string) => localKey(mondayOf(dateKey))

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
  // Bumped when clearing the saved URL so the source re-resolves even if the
  // ?plan param is already absent.
  const [nonce, setNonce] = useState(0)
  // Bumped by the refresh button to force a re-fetch even when the URL is unchanged.
  const [refreshKey, setRefreshKey] = useState(0)
  const { url, isFallback } = useMemo(() => resolveSource(search.plan), [search.plan, nonce])

  const [state, setState] = useState<{ plan?: Plan; error?: string; loading: boolean }>({ loading: true })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true })
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
        try {
          setState({ loading: false, plan: loadPlan(text) })
        } catch (e) {
          setState({ loading: false, error: (e as Error).message || 'YAML could not be parsed.' })
        }
      })
      .catch((e) => {
        if (!cancelled)
          setState({
            loading: false,
            error: `Couldn't load ${url} — ${(e as Error).message}. If this is a remote plan, check the URL allows cross-origin requests.`,
          })
      })
    return () => {
      cancelled = true
    }
  }, [url, refreshKey])

  const plan = state.plan
  const weeks = useMemo(() => (plan ? groupByWeek(plan.sessions) : []), [plan])

  // Which week is visible: ?week= → the open session's week → this week →
  // the first upcoming week → the last week.
  const curIndex = useMemo(() => {
    if (!weeks.length) return -1
    if (search.week) {
      const i = weeks.findIndex((w) => w.monKey === search.week)
      if (i >= 0) return i
    }
    if (search.s != null && plan?.sessions[search.s]) {
      const i = weeks.findIndex((w) => w.monKey === monKeyOf(dstr(plan.sessions[search.s as number].date)))
      if (i >= 0) return i
    }
    const now = weeks.findIndex((w) => w.isNow)
    if (now >= 0) return now
    const thisMon = monKeyOf(todayKey)
    const up = weeks.findIndex((w) => w.monKey >= thisMon)
    return up >= 0 ? up : weeks.length - 1
  }, [weeks, search.week, search.s, plan])

  const current = curIndex >= 0 ? weeks[curIndex] : null
  const gotoWeek = (i: number) => navigate({ search: (p) => ({ ...p, week: weeks[i].monKey, s: undefined }) })
  // Clearing ?week falls back to the current/first-upcoming week (see curIndex).
  const goToday = () => navigate({ search: (p) => ({ ...p, week: undefined, s: undefined }) })

  const openSession = (index: number) => navigate({ search: (p) => ({ ...p, s: index }) })
  const closeSheet = () => navigate({ search: (p) => ({ ...p, s: undefined }) })

  // Swipe left → next week, right → previous. Disabled while a session sheet is
  // open so its own gestures aren't hijacked.
  const swipe = useSwipe({
    onLeft: () => {
      if (search.s == null && curIndex < weeks.length - 1) gotoWeek(curIndex + 1)
    },
    onRight: () => {
      if (search.s == null && curIndex > 0) gotoWeek(curIndex - 1)
    },
  })

  // Desktop: ← / → arrow keys change week. Ignored while a sheet is open, when
  // typing in a field, or alongside a modifier (don't clobber browser shortcuts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (search.s != null || settingsOpen) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (e.key === 'ArrowRight' && curIndex < weeks.length - 1) {
        e.preventDefault()
        gotoWeek(curIndex + 1)
      } else if (e.key === 'ArrowLeft' && curIndex > 0) {
        e.preventDefault()
        gotoWeek(curIndex - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [curIndex, weeks.length, search.s, settingsOpen])

  const saveUrl = (planUrl: string) => {
    setSettingsOpen(false)
    navigate({ search: (p) => ({ ...p, plan: planUrl, week: undefined, s: undefined }) })
  }
  const useDemo = () => {
    try {
      localStorage.removeItem(STORE_KEY)
    } catch {
      /* ignore */
    }
    setSettingsOpen(false)
    setNonce((n) => n + 1)
    navigate({ search: (p) => ({ ...p, plan: undefined, week: undefined, s: undefined }) })
  }

  const sheet: SheetContent | null = useMemo(() => {
    const i = search.s
    if (i != null && plan && plan.sessions[i]) {
      const s = plan.sessions[i]
      return {
        title: s.title || '',
        kindLabel: s.activity,
        kindColor: colorForActivity(s.activity),
        lead: s.summary?.trim() || undefined,
        body: s.notes,
      }
    }
    return null
  }, [search.s, plan])

  const updatedLabel = useMemo(() => {
    if (!plan?.updated) return ''
    const d = dnum(plan.updated)
    return d ? `Updated ${d.getDate()} ${MO[d.getMonth()]}` : `Updated ${plan.updated}`
  }, [plan])

  return (
    <>
      <header
        className="border-b border-[var(--border)] bg-[var(--bg)] px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}
      >
        <div className="mx-auto flex max-w-[620px] items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-[19px] font-[650] tracking-[-0.01em]">
              {plan?.title || 'Training Plan'}
            </h1>
            {updatedLabel && <div className="mt-px text-[12px] text-[var(--faint)]">{updatedLabel}</div>}
          </div>
          <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-[18px] w-[18px]"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Refresh plan"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={state.loading}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-[18px] w-[18px] ${state.loading ? 'animate-spin' : ''}`}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[620px] px-4 pt-1.5" aria-live="polite" {...swipe}>
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
                onLoad={(planUrl) =>
                  navigate({ search: (p) => ({ ...p, plan: planUrl, week: undefined, s: undefined }) })
                }
              />
            )}
            {current ? (
              <Week
                week={current}
                onOpen={openSession}
                onPrev={() => gotoWeek(curIndex - 1)}
                onNext={() => gotoWeek(curIndex + 1)}
                onToday={goToday}
                canPrev={curIndex > 0}
                canNext={curIndex < weeks.length - 1}
              />
            ) : (
              plan && (
                <div className="mt-8 text-center text-[14px] text-[var(--muted)]">
                  No sessions in this plan yet.
                </div>
              )
            )}
          </>
        )}
      </main>

      <footer className="mx-auto mt-[22px] max-w-[620px] px-[18px] text-[12px] text-[var(--faint)]">
        Tap a session for details · swipe or use the arrows to change week.
      </footer>

      <DetailSheet content={sheet} onClose={closeSheet} />
      {settingsOpen && (
        <SettingsSheet
          currentUrl={readConfiguredUrl()}
          isDemo={isFallback}
          onSave={saveUrl}
          onUseDemo={useDemo}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
