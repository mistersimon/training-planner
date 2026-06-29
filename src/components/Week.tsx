import type { WeekGroup } from '../lib/plan'
import { rangeLabel } from '../lib/format'
import { colorForActivity } from '../lib/types'
import { Day } from './Day'
import type { EditApi } from './Session'

export function Week({
  week,
  onOpen,
  innerRef,
  editing = false,
  edit,
}: {
  week: WeekGroup
  onOpen: (index: number) => void
  innerRef?: (el: HTMLElement | null) => void
  editing?: boolean
  edit?: EditApi
}) {
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
    <section
      ref={innerRef}
      className="scroll-mt-24 border-t border-[var(--border)] py-7 first:border-t-0 first:pt-3 [&>*:last-child]:mb-0"
    >
      <div className="mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{rangeLabel(week.mon)}</span>
          {week.isNow && (
            <span className="rounded-full bg-[var(--ring)] px-[8px] py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-white">
              Now
            </span>
          )}
        </div>
        {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-[5px]">{chips}</div>}
      </div>
      {week.days.map((day) => (
        <Day key={day.key} day={day} onOpen={onOpen} editing={editing} edit={edit} />
      ))}
    </section>
  )
}
