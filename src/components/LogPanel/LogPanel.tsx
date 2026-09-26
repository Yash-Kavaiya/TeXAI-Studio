import { useState } from 'react'
import type { LogEntry } from '../../engine/types'
import './LogPanel.css'

interface LogPanelProps {
  entries: LogEntry[]
  /** The full compiler output, for problems the parser doesn't recognise. */
  rawLog: string
  onJumpToEntry: (entry: LogEntry) => void
}

export function LogPanel({ entries, rawLog, onJumpToEntry }: LogPanelProps) {
  const [view, setView] = useState<'problems' | 'raw'>('problems')
  const errorCount = entries.filter((e) => e.level === 'error').length
  const warningCount = entries.length - errorCount

  return (
    <div className="log-panel">
      <div className="log-panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'problems'}
          className={view === 'problems' ? 'active' : undefined}
          onClick={() => setView('problems')}
        >
          Problems
          {errorCount > 0 && <span className="log-badge log-badge-error">{errorCount}</span>}
          {warningCount > 0 && <span className="log-badge log-badge-warning">{warningCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'raw'}
          className={view === 'raw' ? 'active' : undefined}
          onClick={() => setView('raw')}
          disabled={!rawLog}
        >
          Raw log
        </button>
      </div>
      <div className="log-panel-body">
        {view === 'raw' ? (
          <pre className="log-raw">{rawLog}</pre>
        ) : entries.length === 0 ? (
          <div className="pane-placeholder">{rawLog ? 'No errors or warnings' : 'Compile to see errors and warnings'}</div>
        ) : (
          entries.map((entry, index) => (
            <div key={index} className={`log-entry log-entry-${entry.level}`} onClick={() => onJumpToEntry(entry)}>
              <span className="log-entry-level">{entry.level === 'error' ? 'Error' : 'Warning'}</span>
              {entry.file && (
                <span className="log-entry-location">
                  {entry.file}
                  {entry.line !== undefined ? `:${entry.line}` : ''}
                </span>
              )}
              <span className="log-entry-message">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
