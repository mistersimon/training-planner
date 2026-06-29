import type { DayGroup } from '../lib/plan'
import { WD, MO } from '../lib/format'
import { Session, type EditApi } from './Session'

// Thin accent bar marking where a dragged card would drop.
function InsertLine() {
  return <div className="my-0.5 h-[3px] rounded-full bg-[var(--ring)]" />
}

export function Day({
  day,
  onOpen,
  editing = false,
  edit,
}: {
  day: DayGroup
  onOpen: (index: number) => void
  editing?: boolean
  edit?: EditApi
}) {
  const over = edit?.over
  const isOver = !!over && over.dayKey === day.key
  const ringColor = isOver
    ? 'var(--ring)'
    : day.isImportant
      ? 'var(--key)'
      : day.isToday
        ? 'var(--ring)'
        : null
  const style = ringColor
    ? {
        borderColor: ringColor,
        boxShadow: `0 0 0 ${isOver ? 3 : 2}px color-mix(in srgb, ${ringColor} ${isOver ? 45 : 27}%, transparent)`,
      }
    : { boxShadow: 'var(--shadow)' }

  // End-of-day insertion (dropping into open space below the last card).
  const insertAtEnd = isOver && over!.refIndex === null && day.sessions.length > 0

  return (
    <article
      id={day.isToday ? 'today' : undefined}
      data-day-key={day.key}
      className={`day-card mb-[9px] flex scroll-mt-20 gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3 ${
        isOver ? 'bg-[var(--surface-2)]' : ''
      }`}
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
        {day.sessions.map((item) => {
          const before = isOver && over!.refIndex === item.index && over!.side === 'before'
          const after = isOver && over!.refIndex === item.index && over!.side === 'after'
          return (
            <div key={item.index} data-session-index={item.index}>
              {before && <InsertLine />}
              <Session item={item} onOpen={onOpen} editing={editing} edit={edit} />
              {after && <InsertLine />}
            </div>
          )
        })}
        {insertAtEnd && <InsertLine />}
        {editing &&
          edit &&
          (day.sessions.length === 0 ? (
            <button
              type="button"
              onClick={() => edit.onAdd(day.key)}
              className={`w-full rounded-[8px] border border-dashed py-1.5 text-center text-[12px] ${
                isOver
                  ? 'border-[var(--ring)] text-[var(--ring)]'
                  : 'border-[var(--border)] text-[var(--faint)] hover:border-[var(--ring)] hover:text-[var(--ring)]'
              }`}
            >
              {isOver ? 'Drop here' : '+ Add session'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => edit.onAdd(day.key)}
              className="mt-0.5 self-start text-[12px] font-medium text-[var(--faint)] hover:text-[var(--ring)]"
            >
              + Add session
            </button>
          ))}
      </div>
    </article>
  )
}
