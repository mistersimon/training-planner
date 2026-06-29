import { useEffect, useState } from 'react'

// View / edit which plan the app loads. The URL is saved on the device
// (localStorage) and reflected in the address bar as ?plan=.
export function SettingsSheet({
  currentUrl,
  currentToken,
  isDemo,
  onSave,
  onSaveToken,
  onUseDemo,
  onClose,
}: {
  currentUrl: string
  currentToken: string
  isDemo: boolean
  onSave: (url: string) => void
  onSaveToken: (token: string) => void
  onUseDemo: () => void
  onClose: () => void
}) {
  const [url, setUrl] = useState(currentUrl)
  const [token, setToken] = useState(currentToken)

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

  const trimmed = url.trim()
  const trimmedToken = token.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[rgba(8,12,22,0.55)]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan settings"
        className="sheet-card relative w-full max-w-[620px] rounded-t-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_-8px_30px_rgba(8,12,22,0.25)] pb-[env(safe-area-inset-bottom)] sm:rounded-[18px]"
      >
        <div className="flex items-start gap-3 p-[18px_18px_8px]">
          <h2 className="m-0 flex-1 text-[17px] font-semibold leading-[1.3]">Plan source</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[15px] leading-none text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            ✕
          </button>
        </div>

        <form
          className="p-[4px_18px_22px]"
          onSubmit={(e) => {
            e.preventDefault()
            onSaveToken(trimmedToken)
            if (trimmed) onSave(trimmed)
          }}
        >
          <label htmlFor="plan-url" className="mb-1.5 block text-[13px] font-medium">
            Plan URL
          </label>
          <input
            id="plan-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://gist.githubusercontent.com/…/raw/plan.yaml"
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--ring)]"
          />
          <p className="mt-2 text-[12.5px] text-[var(--muted)]">
            Point this at a raw Gist URL holding your <code className="text-[11px]">plan.yaml</code>. Saved on
            this device.
          </p>

          <label htmlFor="gist-token" className="mb-1.5 mt-4 block text-[13px] font-medium">
            GitHub token <span className="font-normal text-[var(--muted)]">— for saving edits</span>
          </label>
          <input
            id="gist-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--ring)]"
          />
          <p className="mt-2 text-[12.5px] text-[var(--muted)]">
            A fine-grained token with <b>Gists</b> read/write is enough. Stored only on this device; needed to
            push reschedules back to the Gist.
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="submit"
              disabled={(!trimmed || trimmed === currentUrl) && trimmedToken === currentToken}
              className="rounded-[8px] bg-[var(--ring)] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Save &amp; load
            </button>
            {!isDemo && (
              <button
                type="button"
                onClick={onUseDemo}
                className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >
                Use demo plan
              </button>
            )}
          </div>

          <p className="mt-3 text-[12px] text-[var(--faint)]">
            {isDemo ? 'Currently showing the bundled demo plan.' : `Loaded from: ${currentUrl}`}
          </p>
        </form>
      </div>
    </div>
  )
}
