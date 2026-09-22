import type { ReactNode } from 'react'
import './Toolbar.css'

interface ToolbarProps {
  projectSlot: ReactNode
  onCompile: () => void
  compiling: boolean
}

export function Toolbar({ projectSlot, onCompile, compiling }: ToolbarProps) {
  return (
    <div className="toolbar">
      <span className="toolbar-title">TeXAI-Studio</span>
      {projectSlot}
      <div className="toolbar-spacer" />
      <button className="toolbar-compile-btn" onClick={onCompile} disabled={compiling}>
        {compiling ? 'Compiling…' : 'Compile'}
      </button>
    </div>
  )
}
