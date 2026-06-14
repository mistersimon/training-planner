import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// On GitHub Pages project sites the app is served from /<repo>/, so assets must
// be referenced relatively. CI sets VITE_BASE to "/<repo>/"; locally it's "/".
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // Update silently in the background — no install/update prompt UI. The new
      // service worker takes control on the next launch.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Static assets in public/ that aren't fingerprinted but should be cached
      // for offline use.
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Training Plan',
        short_name: 'Training',
        description: 'Mobile-first training calendar backed by a single YAML file.',
        // start_url / scope are resolved against the deploy base by the plugin.
        theme_color: '#0b1120',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Same artwork is full-bleed, so it doubles as the maskable icon.
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell plus the bundled sample plan.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'sample-plan.yaml'],
        // SPA fallback so deep links work offline.
        navigateFallback: base + 'index.html',
        runtimeCaching: [
          {
            // Plan data (.yaml/.yml) — local or remote (Gist raw, etc.). Always
            // try the network first so edits show up, but fall back to the last
            // good copy when offline.
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.endsWith('.yaml') || url.pathname.endsWith('.yml'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'plan-data',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              plugins: [
                {
                  // The app appends a `_=<timestamp>` cache-buster to every fetch.
                  // Strip it so each plan maps to a single, reusable cache entry
                  // that can be served back when offline.
                  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
                    const u = new URL(request.url)
                    u.searchParams.delete('_')
                    return u.href
                  },
                },
              ],
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW off during `vite dev` to avoid stale-cache confusion.
        enabled: false,
      },
    }),
  ],
})
