import { useState } from 'react'

// Shown when no plan URL is configured (we're rendering the bundled sample).
// Lets a first-time visitor attach their own plan/Gist URL.
export function LoadPlanPrompt({ onLoad }: { onLoad: (url: string) => void }) {
  const [url, setUrl] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = url.trim()
        if (v) onLoad(v)
      }}
      className="mt-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-[13px] text-[var(--muted)]"
    >
      <div className="mb-2 font-medium text-[var(--text)]">Showing the demo plan</div>
      Paste your plan link (a raw Gist URL) to load and remember it on this device.
      <div className="mt-2.5 flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://gist.githubusercontent.com/…/raw/plan.yaml"
          className="min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--ring)]"
        />
        <button
          type="submit"
          className="flex-none rounded-[8px] bg-[var(--ring)] px-3.5 py-2 text-[13px] font-semibold text-white"
        >
          Load
        </button>
      </div>
    </form>
  )
}
