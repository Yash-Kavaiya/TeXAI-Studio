import type { LogEntry } from '../../engine/types'
import './LogPanel.css'

interface LogPanelProps {
  entries: LogEntry[]
  onJumpToEntry: (entry: LogEntry) => void
}

export function LogPanel({ entries, onJumpToEntry }: LogPanelProps) {
  if (entries.length === 0) {
    return <div className="pane-placeholder">No errors or warnings</div>
  }

  return (
    <div className="log-panel">
      {entries.map((entry, index) => (
        <div
          key={index}
          className={`log-entry log-entry-${entry.level}`}
          onClick={() => onJumpToEntry(entry)}
        >
          <span className="log-entry-level">{entry.level === 'error' ? 'Error' : 'Warning'}</span>
          {entry.file && (
            <span className="log-entry-location">
              {entry.file}
              {entry.line !== undefined ? `:${entry.line}` : ''}
            </span>
          )}
          <span className="log-entry-message">{entry.message}</span>
        </div>
      ))}
    </div>
  )
}
