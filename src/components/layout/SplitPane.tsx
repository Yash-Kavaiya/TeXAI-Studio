import type { ReactNode } from 'react'
import './SplitPane.css'

interface SplitPaneProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

export function SplitPane({ left, center, right }: SplitPaneProps) {
  return (
    <div className="split-pane">
      <div className="split-pane-left">{left}</div>
      <div className="split-pane-center">{center}</div>
      <div className="split-pane-right">{right}</div>
    </div>
  )
}
