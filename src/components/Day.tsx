import type { DayGroup } from '../lib/plan'
import { WD, MO } from '../lib/format'
import { Session } from './Session'

export function Day({ day, onOpen }: { day: DayGroup; onOpen: (index: number) => void }) {
  const ringColor = day.isImportant ? 'var(--key)' : day.isToday ? 'var(--ring)' : null
  const style = ringColor
    ? {
        borderColor: ringColor,
        boxShadow: `0 0 0 2px color-mix(in srgb, ${ringColor} 27%, transparent)`,
      }
    : { boxShadow: 'var(--shadow)' }

  return (
    <article
      className="day-card mb-[9px] flex gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3"
      style={style}
    >
      <div className="w-[42px] flex-none pt-0.5 text-center">
        <div
          className={`text-[11px] font-semibold uppercase tracking-[0.05em] ${
            day.isToday ? 'text-[var(--ring)]' : 'text-[var(--muted)]'
          }`}
        >
          {day.isToday ? 'Today' : day.dt ? WD[day.dt.getDay()] : ''}
        </div>
        <div
          className={`tnum mt-px text-[22px] font-[650] leading-[1.1] ${day.isToday ? 'text-[var(--ring)]' : ''}`}
        >
          {day.dt ? day.dt.getDate() : ''}
        </div>
        <div className="text-[10px] uppercase tracking-[0.05em] text-[var(--faint)]">
          {day.dt ? MO[day.dt.getMonth()] : ''}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        {day.sessions.map((item) => (
          <Session key={item.index} item={item} onOpen={onOpen} />
        ))}
      </div>
    </article>
  )
}
