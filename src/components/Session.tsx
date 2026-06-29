import type { IndexedSession } from '../lib/plan'
import type { DropTarget } from '../lib/useDragReschedule'
import { colorForActivity } from '../lib/types'

// Edit-mode callbacks + drag state, threaded down from the app. Bundled so the
// Week → Day → Session chain passes one prop instead of six.
export interface EditApi {
  draggingIndex: number | null
  over: DropTarget | null
  onDragStart: (e: React.PointerEvent, index: number, label: string, color: string) => void
  onDelete: (index: number) => void
  onAdd: (dayKey: string) => void
}

// Map-pin glyph — shown next to a session's location.
function PinIcon({ className = 'h-3 w-3 flex-none' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function Session({
  item,
  onOpen,
  editing = false,
  edit,
}: {
  item: IndexedSession
  onOpen: (index: number) => void
  editing?: boolean
  edit?: EditApi
}) {
  const s = item.session
  const color = colorForActivity(s.activity)
  // Card subtitle: what happened once done, otherwise the plan.
  const subtitle = (s.actual?.trim() || s.target?.trim()) ?? ''
  // Openable when there's anything more to show in the sheet — notes, the plan,
  // the result, or a location (so tapping a done session also reveals its target).
  const hasMore = !!(s.notes?.trim() || s.target?.trim() || s.actual?.trim() || s.location?.trim())

  const tagBase = 'rounded-[5px] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.05em]'
  const tags = (
    <span className="ml-auto flex items-center gap-[7px]">
      {s.priority === 'critical' && (
        <span className={`${tagBase} bg-[var(--key)] text-white`} title="Critical — race / key event">
          Critical
        </span>
      )}
      {s.priority === 'high' && (
        <span className={`${tagBase} bg-[var(--ring)] text-white`} title="High priority">
          High
        </span>
      )}
      {s.priority === 'low' && (
        <span className={`${tagBase} bg-[var(--surface-2)] text-[var(--muted)]`}>Low</span>
      )}
    </span>
  )

  const content = (
    <div className="min-w-0 flex-1">
      <div className="mb-px flex items-center gap-[7px]">
        {s.activity && (
          <span className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color }}>
            {s.activity}
          </span>
        )}
        {tags}
      </div>
      <div className="break-words text-[14px] font-medium">{s.title}</div>
      {subtitle && <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">{subtitle}</div>}
      {s.location?.trim() && (
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--faint)]">
          <PinIcon />
          <span className="truncate">{s.location}</span>
        </div>
      )}
    </div>
  )

  const colorBar = (
    <span className="w-1 flex-none rounded-[3px] min-h-[30px] self-stretch" style={{ background: color }} />
  )

  const cls = '-m-[3px] flex w-full items-stretch gap-2.5 rounded-[9px] p-[3px]'

  // Edit mode: every session drags (fixed is just a hint, not a lock), plus
  // edit + delete controls.
  if (editing && edit) {
    const isDragging = edit.draggingIndex === item.index
    // Stop pointerdown on a control from also starting a card drag.
    const stop = (e: React.PointerEvent) => e.stopPropagation()
    const ctrlBtn =
      'flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)]'

    return (
      <div
        className={`${cls} items-center cursor-grab touch-none select-none active:cursor-grabbing ${
          isDragging ? 'opacity-30' : ''
        }`}
        onPointerDown={(e) => edit.onDragStart(e, item.index, s.title, color)}
      >
        <span className="flex-none self-center text-[var(--faint)]" aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 block">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
        {colorBar}
        {content}
        <span className="flex flex-none items-center gap-1.5 self-center">
          <button
            type="button"
            aria-label="Edit details & notes"
            onPointerDown={stop}
            onClick={() => onOpen(item.index)}
            className={ctrlBtn}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Delete session"
            onPointerDown={stop}
            onClick={() => edit.onDelete(item.index)}
            className={`${ctrlBtn} hover:border-[var(--key)] hover:text-[var(--key)]`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </span>
      </div>
    )
  }

  const body = (
    <>
      {colorBar}
      {content}
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
