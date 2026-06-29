import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml'
import { EditorView } from '@codemirror/view'
import { cmTheme } from '../lib/cmTheme'

// Full-screen raw YAML editor. Edit the plan as text and save it straight to the
// Gist. `onSave` validates + applies + pushes, returning a message to show:
// `error` keeps the editor open (parse/push failed); `note` means it was applied
// locally but not synced; an empty object means a clean save (editor closes).
export function RawEditSheet({
  initial,
  saving,
  onSave,
  onClose,
}: {
  initial: string
  saving: boolean
  onSave: (text: string) => Promise<{ error?: string; note?: string }>
  onClose: () => void
}) {
  const [text, setText] = useState(initial)
  const [msg, setMsg] = useState<{ error?: string; note?: string }>({})
  const [copied, setCopied] = useState(false)
  const dirty = text !== initial

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const save = async () => {
    setMsg({})
    const r = await onSave(text)
    if (r.error || r.note) setMsg(r)
    else onClose()
  }

  const iconBtn =
    'flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)]'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <header
        className="flex-none border-b border-[var(--border)] px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <div className="mx-auto flex max-w-[820px] items-center gap-3">
          <h2 className="m-0 flex-1 text-[15px] font-semibold">Raw plan (YAML)</h2>
          <button type="button" aria-label="Copy YAML" onClick={copy} className={iconBtn}>
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
          <button type="button" aria-label="Close" onClick={onClose} className={iconBtn}>
            ✕
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col overflow-hidden px-4">
        <div className="my-3 min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[var(--border)]">
          <CodeMirror
            value={text}
            onChange={(v) => {
              setText(v)
              if (msg.error || msg.note) setMsg({})
            }}
            height="100%"
            theme={cmTheme}
            extensions={[yaml(), EditorView.lineWrapping]}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              autocompletion: false,
              closeBrackets: false,
              indentOnInput: true,
            }}
            className="h-full text-[12.5px]"
            style={{ height: '100%' }}
          />
        </div>
      </div>

      <footer
        className="flex-none border-t border-[var(--border)] px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
      >
        <div className="mx-auto flex max-w-[820px] items-center gap-3">
          <div className="min-w-0 flex-1 text-[12.5px]">
            {msg.error ? (
              <span className="text-[var(--key)]">{msg.error}</span>
            ) : msg.note ? (
              <span className="text-[var(--muted)]">{msg.note}</span>
            ) : saving ? (
              <span className="text-[var(--muted)]">Saving…</span>
            ) : dirty ? (
              <span className="text-[var(--muted)]">Unsaved changes</span>
            ) : (
              <span className="text-[var(--faint)]">No changes</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="flex-none rounded-[8px] bg-[var(--ring)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </footer>
    </div>
  )
}
