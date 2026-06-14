import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { registerSW } from 'virtual:pwa-register'
import { router } from './router'
import './index.css'

// Keep the installed PWA current. In autoUpdate mode the page reloads itself as
// soon as a new service worker activates, so a freshly deployed build shows up
// without the usual close-twice dance. We also poll for updates proactively —
// when the tab/app regains focus and hourly — so a long-lived PWA still picks
// up pushes instead of waiting for the next cold launch.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => registration.update()
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
