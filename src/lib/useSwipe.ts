import { useRef } from 'react'
import type { TouchEvent } from 'react'

interface SwipeOpts {
  onLeft?: () => void
  onRight?: () => void
  // Minimum horizontal travel (px) to count as a swipe.
  threshold?: number
}

// Lightweight horizontal-swipe detector for touch devices. Returns touch
// handlers to spread onto an element. It never calls preventDefault, so
// vertical scrolling stays native — a gesture only fires when it's clearly
// horizontal, decisive, and quick (not a slow drag or a diagonal scroll).
export function useSwipe({ onLeft, onRight, threshold = 60 }: SwipeOpts) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)

  return {
    onTouchStart: (e: TouchEvent) => {
      if (e.touches.length !== 1) return // ignore pinch/multi-touch
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      const dt = Date.now() - s.t
      if (Math.abs(dx) < threshold) return // too short
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return // mostly vertical → a scroll
      if (dt > 600) return // too slow → a drag, not a flick
      if (dx < 0) onLeft?.()
      else onRight?.()
    },
  }
}
