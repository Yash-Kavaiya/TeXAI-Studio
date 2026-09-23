import { useState } from 'react'
import './ApiKeyField.css'

type TestStatus = 'untested' | 'testing' | 'valid' | 'invalid'

interface ApiKeyFieldProps {
  label: string
  storedKey: string | null
  onSave: (key: string) => void
  onRemove: () => void
  onTest: (key: string) => Promise<boolean>
  helpUrl?: string
  helpLabel?: string
  notice?: string
}

export function ApiKeyField({
  label,
  storedKey,
  onSave,
  onRemove,
  onTest,
  helpUrl,
  helpLabel,
  notice,
}: ApiKeyFieldProps) {
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<TestStatus>('untested')

  function handleSave() {
    if (!draft.trim()) return
    onSave(draft.trim())
    setDraft('')
    setStatus('untested')
  }

  async function handleTest() {
    const key = storedKey ?? draft.trim()
    if (!key) return
    setStatus('testing')
    try {
      const ok = await onTest(key)
      setStatus(ok ? 'valid' : 'invalid')
    } catch {
      setStatus('invalid')
    }
  }

  function handleRemove() {
    onRemove()
    setStatus('untested')
  }

  return (
    <div className="api-key-field">
      <div className="api-key-field-header">
        <span className="api-key-field-label">{label}</span>
        {helpUrl && (
          <a href={helpUrl} target="_blank" rel="noreferrer" className="api-key-field-link">
            {helpLabel ?? 'Get a key'}
          </a>
        )}
      </div>

      {storedKey ? (
        <div className="api-key-field-row">
          <span className="api-key-field-masked">•••• {storedKey.slice(-4)}</span>
          <button type="button" onClick={handleTest} disabled={status === 'testing'}>
            {status === 'testing' ? 'Testing…' : 'Test Connection'}
          </button>
          <button type="button" onClick={handleRemove}>
            Remove
          </button>
          <StatusBadge status={status} />
        </div>
      ) : (
        <div className="api-key-field-row">
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste API key"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button type="button" onClick={handleSave} disabled={!draft.trim()}>
            Save
          </button>
        </div>
      )}

      {notice && <p className="api-key-field-notice">{notice}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: TestStatus }) {
  if (status === 'untested') return null
  const label = { testing: 'Testing…', valid: 'Valid', invalid: 'Invalid' }[status]
  return <span className={`api-key-status api-key-status-${status}`}>{label}</span>
}
