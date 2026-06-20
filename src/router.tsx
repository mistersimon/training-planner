import { createRoute, createRouter } from '@tanstack/react-router'
import { rootRoute } from './routes/__root'
import { App } from './routes/index'

// Typed search params: ?plan=<url> selects the source, ?s=<index> deep-links a
// session.
interface IndexSearch {
  plan?: string
  s?: number
}

const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    plan: typeof search.plan === 'string' ? search.plan : undefined,
    s: toNum(search.s),
  }),
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  defaultPreload: false,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
