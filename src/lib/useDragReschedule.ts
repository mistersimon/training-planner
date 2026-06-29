import { useCallback, useEffect, useRef, useState } from 'react'

export interface DragState {
  index: number // original session index being dragged
  label: string // title shown in the floating ghost
  color: string // activity color for the ghost's accent bar
  x: number
  y: number
}

// Where a dropped card would land: a day, optionally before/after a specific
// sibling session within that day (for reordering inside a day).
export interface DropTarget {
  dayKey: string
  refIndex: number | null // session index to anchor against (null = end of day)
  side: 'before' | 'after'
}

// Pointer-based drag for rescheduling session cards between (and within) day
// cards. Uses Pointer Events (not HTML5 drag-and-drop) so it works on touch as
// well as mouse, with continuous edge auto-scroll for moving across distant
// weeks.
//
// Targets are found by hit-testing `document.elementFromPoint`: the nearest
// `[data-session-index]` gives the sibling to insert next to (above/below by the
// pointer's position relative to the card's midline), and the nearest
// `[data-day-key]` gives the day. The floating ghost sets pointer-events: none
// so it doesn't block the test. Listeners are attached once per drag (in
// `begin`) rather than via an effect keyed on position, so a fast drag doesn't
// churn listeners on every move.
export function useDragReschedule(
  enabled: boolean,
  scrollRef: React.RefObject<HTMLElement | null>,
  onDrop: (index: number, target: DropTarget) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [over, setOver] = useState<DropTarget | null>(null)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop
  const cleanupRef = useRef<(() => void) | null>(null)

  const begin = useCallback(
    (e: React.PointerEvent, index: number, label: string, color: string) => {
      if (!enabled) return
      e.preventDefault()
      let ptrY = e.clientY
      setDrag({ index, label, color, x: e.clientX, y: e.clientY })

      const targetAt = (x: number, y: number): DropTarget | null => {
        const el = document.elementFromPoint(x, y)
        const dayKey = el?.closest?.('[data-day-key]')?.getAttribute('data-day-key') ?? null
        if (dayKey == null) return null
        const sessEl = el?.closest?.('[data-session-index]')
        if (sessEl) {
          const refIndex = Number(sessEl.getAttribute('data-session-index'))
          // Hovering the dragged card itself isn't a meaningful anchor.
          if (refIndex !== index) {
            const r = sessEl.getBoundingClientRect()
            return { dayKey, refIndex, side: y < r.top + r.height / 2 ? 'before' : 'after' }
          }
        }
        return { dayKey, refIndex: null, side: 'after' }
      }

      const move = (ev: PointerEvent) => {
        ev.preventDefault()
        ptrY = ev.clientY
        setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
        setOver(targetAt(ev.clientX, ev.clientY))
      }
      const up = (ev: PointerEvent) => {
        const target = targetAt(ev.clientX, ev.clientY)
        cleanup()
        setDrag(null)
        setOver(null)
        if (target) onDropRef.current(index, target)
      }

      // Continuous auto-scroll while the pointer is held near the top/bottom
      // edge, so you can drag from one week to another without lifting.
      let raf = 0
      const tick = () => {
        const root = scrollRef.current
        if (root) {
          const r = root.getBoundingClientRect()
          const edge = 72
          if (ptrY < r.top + edge) root.scrollTop -= Math.ceil((r.top + edge - ptrY) / 5)
          else if (ptrY > r.bottom - edge) root.scrollTop += Math.ceil((ptrY - (r.bottom - edge)) / 5)
        }
        raf = requestAnimationFrame(tick)
      }

      const cleanup = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        cancelAnimationFrame(raf)
        cleanupRef.current = null
      }

      window.addEventListener('pointermove', move, { passive: false })
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      raf = requestAnimationFrame(tick)
      cleanupRef.current = cleanup
    },
    [enabled, scrollRef],
  )

  // Tear down a drag in progress if the component unmounts.
  useEffect(() => () => cleanupRef.current?.(), [])

  return { drag, over, begin }
}
