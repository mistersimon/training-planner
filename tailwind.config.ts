import type { Config } from 'tailwindcss'

// Theme palette lives as CSS variables in src/index.css (flipped via
// prefers-color-scheme) and is consumed through Tailwind arbitrary values
// like bg-[var(--surface)]. Session-type accent colors are applied via inline
// style from lib/types.ts to avoid dynamic-class purging.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: { extend: {} },
  plugins: [],
} satisfies Config
