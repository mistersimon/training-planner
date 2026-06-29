import { useEffect, useRef, useState } from 'react'
import { Markdown } from './Markdown'
import type { SessionStatus } from '../lib/plan'

export interface SheetContent {
  title: string
  kindLabel?: string
  kindColor?: string
  location?: string // where it happens
  lead?: string // one-line summary shown above the notes
  body?: string // markdown
}

export interface SheetEditFields {
  title: string
  activity: string
  location: string
  summary: string
  notes: string
  status: SessionStatus
}

// When present, the sheet shows editable fields instead of the read-only view.
export interface SheetEdit extends SheetEditFields {
  index: number // session being edited (used to reset fields when it changes)
  onSave: (fields: SheetEditFields) => void
}

const STATUSES: { value: SessionStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Done' },
  { value: 'optional', label: 'Optional' },
  { value: 'key', label: 'Key' },
  { value: 'fixed', label: 'Fixed' },
]

// Generic bottom sheet, reused for session detail and the goals view. Pass
// `edit` to turn it into an editor for the session's text fields.
export function DetailSheet({
  content,
  edit,
  activities,
  onClose,
}: {
  content: SheetContent | null
  edit?: SheetEdit
  activities?: string[] // existing activity labels, for the edit datalist
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = !!content

  const [title, setTitle] = useState('')
  const [activity, setActivity] = useState('')
  const [location, setLocation] = useState('')
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<SessionStatus>('planned')

  // Reset the form whenever a different session opens for editing.
  useEffect(() => {
    if (!edit) return
    setTitle(edit.title)
    setActivity(edit.activity)
    setLocation(edit.location)
    setSummary(edit.summary)
    setNotes(edit.notes)
    setStatus(edit.status)
  }, [edit?.index, open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!content) return null

  const fieldCls =
    'w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--ring)]'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[rgba(8,12,22,0.55)]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        className="sheet-card relative flex max-h-[86vh] w-full max-w-[620px] flex-col rounded-t-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_-8px_30px_rgba(8,12,22,0.25)] pb-[env(safe-area-inset-bottom)] sm:max-h-[80vh] sm:rounded-[18px]"
      >
        <div className="flex items-start gap-3 p-[18px_18px_8px]">
          <div className="flex-1">
            {content.kindLabel && (
              <div
                className="mb-[3px] text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{ color: content.kindColor }}
              >
                {content.kindLabel}
              </div>
            )}
            {edit ? (
              <input
                aria-label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className={`${fieldCls} text-[17px] font-semibold`}
              />
            ) : (
              <h2 className="m-0 text-[17px] font-semibold leading-[1.3]">{content.title}</h2>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[15px] leading-none text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            ✕
          </button>
        </div>

        {edit ? (
          <div className="flex flex-col gap-3 overflow-y-auto p-[8px_18px_18px]">
            <div>
              <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    aria-pressed={status === st.value}
                    onClick={() => setStatus(st.value)}
                    className={
                      status === st.value
                        ? 'rounded-full bg-[var(--ring)] px-3 py-1 text-[12px] font-semibold text-white'
                        : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]'
                    }
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              {status === 'fixed' && (
                <p className="mt-1.5 text-[11.5px] text-[var(--faint)]">
                  Fixed sessions are locked to their date and can't be dragged.
                </p>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">Activity</span>
              <input
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                list="activity-options"
                placeholder="e.g. run, lift, swim, cycle"
                className={fieldCls}
              />
              {activities && activities.length > 0 && (
                <datalist id="activity-options">
                  {activities.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Track, Pool, Home gym"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">Summary</span>
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One line shown on the card"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">
                Notes <span className="font-normal">(markdown)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder="Longer detail — supports markdown."
                className={`${fieldCls} resize-y font-mono text-[13px] leading-[1.5]`}
              />
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  edit.onSave({ title, activity, location, summary, notes, status })
                  onClose()
                }}
                disabled={!title.trim()}
                className="rounded-[8px] bg-[var(--ring)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                Done
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto p-[4px_18px_22px] text-[14.5px] leading-[1.6]">
            {content.location?.trim() && (
              <p className="mb-2 flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-3.5 w-3.5 flex-none"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {content.location}
              </p>
            )}
            {content.lead && (
              <p className="mb-3 border-b border-[var(--border)] pb-3 text-[13px] text-[var(--muted)]">
                {content.lead}
              </p>
            )}
            {content.body && <Markdown>{content.body}</Markdown>}
          </div>
        )}
      </div>
    </div>
  )
}
