import type { IndexedSession } from '../lib/plan'
import { colorForActivity } from '../lib/types'

export function Session({ item, onOpen }: { item: IndexedSession; onOpen: (index: number) => void }) {
  const s = item.session
  const color = colorForActivity(s.activity)
  const subtitle = s.summary?.trim() ?? ''
  const hasMore = !!s.notes?.trim()

  const body = (
    <>
      <span className="w-1 flex-none rounded-[3px] min-h-[30px] self-stretch" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="mb-px flex items-center gap-[7px]">
          {s.activity && (
            <span className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color }}>
              {s.activity}
            </span>
          )}
          {s.important && (
            <span className="ml-auto rounded-[5px] bg-[var(--key)] px-1.5 py-px text-[10px] font-bold tracking-[0.05em] text-white">
              Key
            </span>
          )}
        </div>
        <div className="break-words text-[14px] font-medium">{s.title}</div>
        {subtitle && <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">{subtitle}</div>}
      </div>
      {hasMore && (
        <span className="flex-none self-center text-[var(--faint)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4 block"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      )}
    </>
  )

  const cls = '-m-[3px] flex items-stretch gap-2.5 rounded-[9px] p-[3px]'
  if (!hasMore) return <div className={cls}>{body}</div>
  return (
    <button
      type="button"
      onClick={() => onOpen(item.index)}
      className={`${cls} cursor-pointer text-left hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]`}
    >
      {body}
    </button>
  )
}
