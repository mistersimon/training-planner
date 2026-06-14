import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages project sites the app is served from /<repo>/, so assets must
// be referenced relatively. CI sets VITE_BASE to "/<repo>/"; locally it's "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
