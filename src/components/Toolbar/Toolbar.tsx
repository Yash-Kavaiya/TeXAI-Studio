import type { ReactNode } from 'react'
import './Toolbar.css'

interface ToolbarProps {
  projectSlot: ReactNode
  onCompile: () => void
  compiling: boolean
  autoCompile: boolean
  onToggleAutoCompile: (on: boolean) => void
  onOpenSettings: () => void
}

export function Toolbar({
  projectSlot,
  onCompile,
  compiling,
  autoCompile,
  onToggleAutoCompile,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <span className="toolbar-title">TeXAI-Studio</span>
      {projectSlot}
      <div className="toolbar-spacer" />
      <button className="toolbar-settings-btn" onClick={onOpenSettings} title="Settings">
        ⚙
      </button>
      <label className="toolbar-auto-compile" title="Recompile automatically when you stop typing">
        <input type="checkbox" checked={autoCompile} onChange={(e) => onToggleAutoCompile(e.target.checked)} />
        Auto-compile
      </label>
      <button
        className="toolbar-compile-btn"
        onClick={onCompile}
        disabled={compiling}
        title="Compile (Ctrl+S or Ctrl+Enter)"
      >
        {compiling ? 'Compiling…' : 'Compile'}
      </button>
    </div>
  )
}
