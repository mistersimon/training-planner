import type { WeekGroup } from '../lib/plan'
import { rangeLabel } from '../lib/format'
import { colorForActivity } from '../lib/types'
import { Day } from './Day'

const Arrow = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
    <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
)

export function Week({
  week,
  onOpen,
  onPrev,
  onNext,
  onToday,
  canPrev,
  canNext,
}: {
  week: WeekGroup
  onOpen: (index: number) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  canPrev: boolean
  canNext: boolean
}) {
  const navBtn =
    'flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] enabled:hover:bg-[var(--surface-2)] disabled:opacity-30'

  const chips = Object.entries(week.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([activity, n]) => (
      <span
        key={activity}
        className="inline-flex items-center gap-[5px] rounded-full border border-[var(--border)] bg-[var(--surface)] px-[9px] py-[3px] text-[12px] font-medium text-[var(--muted)]"
      >
        <span
          className="h-[7px] w-[7px] flex-none rounded-[2px]"
          style={{ background: colorForActivity(activity) }}
        />
        {n} <span className="uppercase">{activity}</span>
      </span>
    ))

  return (
    <section className="mt-4">
      <div className="mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={navBtn}
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Previous week"
          >
            <Arrow dir="left" />
          </button>
          <span className="text-[16px] font-semibold">{rangeLabel(week.mon)}</span>
          {week.isNow && (
            <span className="rounded-full bg-[var(--ring)] px-[9px] py-0.5 text-[11px] font-bold tracking-[0.04em] text-white">
              This week
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToday}
              disabled={week.isNow}
              className="flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-medium text-[var(--muted)] enabled:hover:bg-[var(--surface-2)] disabled:opacity-30"
            >
              Today
            </button>
            <button
              type="button"
              className={navBtn}
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next week"
            >
              <Arrow dir="right" />
            </button>
          </div>
        </div>
        {chips.length > 0 && <div className="mt-2.5 flex flex-wrap gap-[5px]">{chips}</div>}
      </div>
      {week.days.map((day) => (
        <Day key={day.key} day={day} onOpen={onOpen} />
      ))}
    </section>
  )
}
