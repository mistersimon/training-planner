import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadPlan, groupByWeek, type Plan } from '../lib/plan'
import { todayKey, dnum, mondayOf, localKey, rangeLabel, MO } from '../lib/format'
import { colorForActivity } from '../lib/types'
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
const CACHE_PREFIX = 'planCache:'
const monKeyOf = (dateKey: string) => localKey(mondayOf(dateKey))

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
  const [copied, setCopied] = useState(false)
  // Bumped when clearing the saved URL so the source re-resolves even if the
  // ?plan param is already absent.
  const [nonce, setNonce] = useState(0)
  // Bumped by the refresh button to force a re-fetch even when the URL is unchanged.
  const [refreshKey, setRefreshKey] = useState(0)
  const { url, isFallback } = useMemo(() => resolveSource(search.plan), [search.plan, nonce])

  const [state, setState] = useState<{ plan?: Plan; raw?: string; error?: string; loading: boolean }>({
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

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
        try {
          const plan = loadPlan(text)
          writeCachedPlan(url, text)
          setState({ loading: false, plan, raw: text })
        } catch (e) {
          // Network gave us unparseable YAML: keep the cached plan if we have
          // one, otherwise surface the parse error.
          if (cached) setState((s) => ({ ...s, loading: false }))
          else
            setState({ loading: false, error: (e as Error).message || 'YAML could not be parsed.' })
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
  const scrollToWeek = (i: number, behavior: ScrollBehavior = 'smooth') => {
    weekRefs.current[i]?.scrollIntoView({ behavior, block: 'start' })
  }
  // Bring today's card to the top; fall back to the current week's start when
  // today isn't in the plan (e.g. the plan begins in the future).
  const goToday = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current?.querySelector('#today')
    if (el) el.scrollIntoView({ behavior, block: 'start' })
    else if (currentIndex >= 0) scrollToWeek(currentIndex, behavior)
  }

  // Jump to today whenever a new plan loads (e.g. opening the PWA), unless a
  // session is being deep-linked open.
  const scrolledFor = useRef<Plan | undefined>(undefined)
  useEffect(() => {
    if (!plan || plan === scrolledFor.current) return
    scrolledFor.current = plan
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
  const closeSheet = () => navigate({ search: (p) => ({ ...p, s: undefined }) })

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

  const copyYaml = async () => {
    if (!state.raw) return
    try {
      await navigator.clipboard.writeText(state.raw)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
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
        <div className="mx-auto flex max-w-[620px] items-center gap-3">
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
            {currentIndex >= 0 && (
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
              aria-label="Copy plan YAML"
              onClick={copyYaml}
              disabled={!state.raw}
              className={iconBtn}
            >
              {copied ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-[var(--ring)]"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
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
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <button
              type="button"
              aria-label="Refresh plan"
              onClick={() => setRefreshKey((k) => k + 1)}
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

        <div className="mx-auto max-w-[620px] px-4 pt-1.5">
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
                  navigate({ search: (p) => ({ ...p, plan: planUrl, s: undefined }) })
                }
              />
            )}
            {weeks.length ? (
              weeks.map((week, i) => (
                <Week
                  key={week.monKey}
                  week={week}
                  onOpen={openSession}
                  innerRef={(el) => {
                    weekRefs.current[i] = el
                  }}
                />
              ))
            ) : (
              plan && (
                <div className="mt-8 text-center text-[14px] text-[var(--muted)]">
                  No sessions in this plan yet.
                </div>
              )
            )}
          </>
        )}
        <footer className="mt-[22px] px-[2px] pb-[calc(env(safe-area-inset-bottom)+16px)] text-[12px] text-[var(--faint)]">
          Tap a session for details · scroll through the weeks.
          {updatedLabel && ` · ${updatedLabel}`}
        </footer>
        </div>
      </main>

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
