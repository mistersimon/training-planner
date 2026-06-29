import yaml from 'js-yaml'
import type { Plan, Session } from './plan'

// Header comment re-emitted on every write (js-yaml.dump drops comments), so the
// raw Gist stays readable/AI-editable by hand too.
const HEADER = `# Training plan — single source of truth (flat schema). Edited in the app and
# synced to this Gist; you can also hand-edit it (AI or otherwise).
# Each list item is one session. Only \`date\` and \`title\` are required.
#   date: YYYY-MM-DD · activity: any label (colors auto-assigned) · title: short name
#   status: planned (default) | done | optional | key (standout) | fixed (locked)
#   summary: one line on the card · notes: longer markdown shown in the detail sheet
`

// Serialize a session into an ordered plain object, dropping empty fields so the
// YAML stays tidy. Key order here is the order written to the file.
function cleanSession(s: Session): Record<string, unknown> {
  const o: Record<string, unknown> = { date: s.date }
  if (s.activity) o.activity = s.activity
  if (s.status && s.status !== 'planned') o.status = s.status
  o.title = s.title ?? ''
  if (s.location?.trim()) o.location = s.location
  if (s.summary?.trim()) o.summary = s.summary
  if (s.notes?.trim()) o.notes = s.notes
  return o
}

// Render a Plan back to YAML matching the file's shape (title/updated/goals/notes
// then sessions). Insertion order is preserved by js-yaml.
export function dumpPlan(plan: Plan): string {
  const doc: Record<string, unknown> = {}
  if (plan.title) doc.title = plan.title
  if (plan.updated) doc.updated = plan.updated
  if (plan.goals?.length) doc.goals = plan.goals
  if (plan.notes?.trim()) doc.notes = plan.notes
  doc.sessions = plan.sessions.map(cleanSession)
  const body = yaml.dump(doc, { lineWidth: -1, noRefs: true })
  return `${HEADER}\n${body}`
}

export interface GistTarget {
  id: string
  file: string
}

// Pull the gist id and filename out of a raw Gist URL, e.g.
// https://gist.githubusercontent.com/<user>/<id>/raw/[<rev>/]<file>
// Returns null for anything that isn't a writable raw-gist URL.
export function parseGistUrl(url: string): GistTarget | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('gist.githubusercontent.com')) return null
    const parts = u.pathname.split('/').filter(Boolean) // [user, id, 'raw', ...rev, file]
    const id = parts[1]
    const file = parts[parts.length - 1]
    if (!id || !file || !file.includes('.')) return null
    return { id, file }
  } catch {
    return null
  }
}

// PATCH the gist with new file content. GitHub's REST API sends CORS headers, so
// this runs straight from the browser with the user's fine-grained token (gist
// scope only). Throws with the API's error message on failure.
export async function pushToGist(target: GistTarget, token: string, content: string): Promise<void> {
  const r = await fetch(`https://api.github.com/gists/${target.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { [target.file]: { content } } }),
  })
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try {
      const j = (await r.json()) as { message?: string }
      if (j?.message) msg = j.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
}
