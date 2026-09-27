import type { PointerEvent as ReactPointerEvent } from 'react'
import './ResizeHandle.css'

interface ResizeHandleProps {
  /** 'vertical' is a column divider (drag left/right); 'horizontal' a row divider. */
  orientation: 'vertical' | 'horizontal'
  /** Receives the pointer's clientX (vertical) or clientY (horizontal) while dragging. */
  onDrag: (position: number) => void
  onReset: () => void
  label: string
}

export function ResizeHandle({ orientation, onDrag, onReset, label }: ResizeHandleProps) {
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    // Keep the resize cursor and stop text selection while dragging.
    document.body.classList.add(`resizing-${orientation}`)

    const move = (e: PointerEvent) => onDrag(orientation === 'vertical' ? e.clientX : e.clientY)
    const end = () => {
      document.body.classList.remove(`resizing-${orientation}`)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  return (
    <div
      className={`resize-handle resize-handle-${orientation}`}
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      title={`${label} (double-click to reset)`}
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
    />
  )
}
