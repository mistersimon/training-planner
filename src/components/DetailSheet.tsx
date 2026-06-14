import { useEffect, useRef } from 'react'
import { Markdown } from './Markdown'

export interface SheetContent {
  title: string
  kindLabel?: string
  kindColor?: string
  lead?: string // one-line summary shown above the notes
  body?: string // markdown
}

// Generic bottom sheet, reused for session detail and the goals view.
export function DetailSheet({ content, onClose }: { content: SheetContent | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = !!content

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
            <h2 className="m-0 text-[17px] font-semibold leading-[1.3]">{content.title}</h2>
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
        <div className="overflow-y-auto p-[4px_18px_22px] text-[14.5px] leading-[1.6]">
          {content.lead && (
            <p className="mb-3 border-b border-[var(--border)] pb-3 text-[13px] text-[var(--muted)]">
              {content.lead}
            </p>
          )}
          {content.body && <Markdown>{content.body}</Markdown>}
        </div>
      </div>
    </div>
  )
}
