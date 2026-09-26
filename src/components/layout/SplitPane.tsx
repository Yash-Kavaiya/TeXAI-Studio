import { useRef, type ReactNode } from 'react'
import { ResizeHandle } from './ResizeHandle'
import { useStoredNumber } from '../../hooks/useStoredNumber'
import './SplitPane.css'

interface SplitPaneProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

const DEFAULT_LEFT_PX = 220
const DEFAULT_CENTER_SHARE = 0.5
const MIN_LEFT_PX = 140
const MAX_LEFT_PX = 480
// Editor and preview each keep at least this share of the space they split.
const MIN_SHARE = 0.2

export function SplitPane({ left, center, right }: SplitPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useStoredNumber('texai.layout.leftWidth', DEFAULT_LEFT_PX)
  // Editor's share of the width left over after the file tree.
  const [centerShare, setCenterShare] = useStoredNumber('texai.layout.centerShare', DEFAULT_CENTER_SHARE)

  function dragLeft(clientX: number) {
    const rect = rootRef.current!.getBoundingClientRect()
    setLeftWidth(Math.round(clamp(clientX - rect.left, MIN_LEFT_PX, MAX_LEFT_PX)))
  }

  function dragCenter(clientX: number) {
    const rect = rootRef.current!.getBoundingClientRect()
    const remaining = rect.width - leftWidth
    if (remaining <= 0) return
    setCenterShare(clamp((clientX - rect.left - leftWidth) / remaining, MIN_SHARE, 1 - MIN_SHARE))
  }

  return (
    <div
      ref={rootRef}
      className="split-pane"
      style={{
        gridTemplateColumns: `${leftWidth}px auto minmax(0, ${centerShare}fr) auto minmax(0, ${1 - centerShare}fr)`,
      }}
    >
      <div className="split-pane-left">{left}</div>
      <ResizeHandle
        orientation="vertical"
        label="Resize file tree"
        onDrag={dragLeft}
        onReset={() => setLeftWidth(DEFAULT_LEFT_PX)}
      />
      <div className="split-pane-center">{center}</div>
      <ResizeHandle
        orientation="vertical"
        label="Resize editor and preview"
        onDrag={dragCenter}
        onReset={() => setCenterShare(DEFAULT_CENTER_SHARE)}
      />
      <div className="split-pane-right">{right}</div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
