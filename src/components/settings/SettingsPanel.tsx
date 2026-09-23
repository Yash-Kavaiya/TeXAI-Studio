import { useState } from 'react'
import { ApiKeyField } from './ApiKeyField'
import {
  clearAnthropicApiKey,
  clearMem0ApiKey,
  getAnthropicApiKey,
  getMem0ApiKey,
  setAnthropicApiKey,
  setMem0ApiKey,
} from '../../settings/apiKeyStore'
import { debugPrompt, testAnthropicKey } from '../../ai/claudeClient'
import { testMem0Key } from '../../ai/mem0Client'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import '../ProjectSwitcher/NewProjectModal.css'
import './SettingsPanel.css'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [anthropicKey, setAnthropicKeyState] = useState(getAnthropicApiKey())
  const [mem0Key, setMem0KeyState] = useState(getMem0ApiKey())
  useEscapeKey(onClose)
  const [debugPromptText, setDebugPromptText] = useState('Name 3 LaTeX document classes.')
  const [debugResult, setDebugResult] = useState<string | null>(null)
  const [debugRunning, setDebugRunning] = useState(false)

  async function handleDebugSend() {
    if (!anthropicKey) return
    setDebugRunning(true)
    setDebugResult(null)
    try {
      const text = await debugPrompt(anthropicKey, debugPromptText)
      setDebugResult(text)
    } catch (err) {
      setDebugResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDebugRunning(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <section>
          <h3 className="settings-section-title">AI Features (optional)</h3>
          <ApiKeyField
            label="Anthropic API key"
            storedKey={anthropicKey}
            onSave={(key) => {
              setAnthropicApiKey(key)
              setAnthropicKeyState(key)
            }}
            onRemove={() => {
              clearAnthropicApiKey()
              setAnthropicKeyState(null)
            }}
            onTest={testAnthropicKey}
            helpUrl="https://console.anthropic.com/settings/keys"
            helpLabel="Get a key"
            notice="Stored only in this browser's localStorage and sent directly from your browser to Anthropic. Visible via devtools; don't use a high-limit key on a shared machine."
          />
          <ApiKeyField
            label="mem0 API key (optional)"
            storedKey={mem0Key}
            onSave={(key) => {
              setMem0ApiKey(key)
              setMem0KeyState(key)
            }}
            onRemove={() => {
              clearMem0ApiKey()
              setMem0KeyState(null)
            }}
            onTest={testMem0Key}
            helpUrl="https://app.mem0.ai/dashboard/api-keys"
            helpLabel="Get a key"
            notice="Lets the AI generator remember preferences (like your usual paper format) across sessions. Without a key, preferences are still remembered, just locally in this browser only. Same bring-your-own-key tradeoff as the Anthropic key above."
          />
        </section>

        {anthropicKey && (
          <section className="settings-debug">
            <h3 className="settings-section-title">Debug: test a prompt</h3>
            <textarea
              value={debugPromptText}
              onChange={(e) => setDebugPromptText(e.target.value)}
              rows={2}
            />
            <button type="button" onClick={handleDebugSend} disabled={debugRunning}>
              {debugRunning ? 'Sending…' : 'Send'}
            </button>
            {debugResult && <pre className="settings-debug-result">{debugResult}</pre>}
          </section>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
