import { useState } from 'react'
import { generateLatexProject, type GenerateProjectResult } from '../../ai/generateProject'
import { ClaudeRefusalError } from '../../ai/errors'
import { createProjectWithFiles } from '../../storage/projectFactory'
import { FileTreePreview } from './FileTreePreview'
import './AiChatPane.css'

type TranscriptEntry =
  | { id: string; prompt: string; status: 'loading' }
  | { id: string; prompt: string; status: 'success'; result: GenerateProjectResult }
  | { id: string; prompt: string; status: 'refusal'; message: string }
  | { id: string; prompt: string; status: 'error'; message: string }

interface AiChatPaneProps {
  onCreated: (projectId: string) => void
}

export function AiChatPane({ onCreated }: AiChatPaneProps) {
  const [prompt, setPrompt] = useState('')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleGenerate(retryPrompt?: string) {
    const trimmed = (retryPrompt ?? prompt).trim()
    if (!trimmed || busy) return

    const id = crypto.randomUUID()
    setBusy(true)
    if (!retryPrompt) setPrompt('')
    setTranscript((t) => [...t, { id, prompt: trimmed, status: 'loading' }])

    try {
      const result = await generateLatexProject({ prompt: trimmed })
      setTranscript((t) => t.map((e) => (e.id === id ? { id, prompt: trimmed, status: 'success', result } : e)))
    } catch (err) {
      const entry: TranscriptEntry =
        err instanceof ClaudeRefusalError
          ? { id, prompt: trimmed, status: 'refusal', message: err.message }
          : { id, prompt: trimmed, status: 'error', message: err instanceof Error ? err.message : String(err) }
      setTranscript((t) => t.map((e) => (e.id === id ? entry : e)))
    } finally {
      setBusy(false)
    }
  }

  async function handleOpen(result: GenerateProjectResult, entryId: string) {
    setOpeningId(entryId)
    try {
      const projectId = await createProjectWithFiles({
        name: result.projectName,
        rootFile: 'main.tex',
        files: result.files,
      })
      onCreated(projectId)
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div className="ai-chat-pane">
      <div className="ai-chat-transcript">
        {transcript.length === 0 && (
          <p className="ai-chat-empty">
            Describe the LaTeX document you want, e.g. "Create an IEEE paper template for computer vision."
          </p>
        )}
        {transcript.map((entry) => (
          <div key={entry.id} className="ai-chat-entry">
            <div className="ai-chat-bubble ai-chat-bubble-user">{entry.prompt}</div>
            {entry.status === 'loading' && (
              <div className="ai-chat-bubble ai-chat-bubble-assistant ai-chat-loading">
                Generating your LaTeX project…
              </div>
            )}
            {entry.status === 'success' && (
              <div className="ai-chat-bubble ai-chat-bubble-assistant">
                <p className="ai-chat-summary">
                  <strong>Template generated</strong> — {entry.result.summary}
                </p>
                <FileTreePreview files={entry.result.files} />
                {entry.result.usedMemories.length > 0 && (
                  <p className="ai-chat-memory-note">
                    Used your preference for {entry.result.documentClass} formatting from{' '}
                    {entry.result.usedMemories.length} earlier project
                    {entry.result.usedMemories.length === 1 ? '' : 's'}.
                  </p>
                )}
                <button
                  type="button"
                  className="ai-chat-open-btn"
                  onClick={() => handleOpen(entry.result, entry.id)}
                  disabled={openingId === entry.id}
                >
                  {openingId === entry.id ? 'Opening…' : 'Open Project'}
                </button>
              </div>
            )}
            {entry.status === 'refusal' && (
              <div className="ai-chat-bubble ai-chat-bubble-assistant ai-chat-error">
                Claude declined this request. Try rephrasing.
              </div>
            )}
            {entry.status === 'error' && (
              <div className="ai-chat-bubble ai-chat-bubble-assistant ai-chat-error">
                <p className="ai-chat-error-message">Generation failed: {entry.message}</p>
                <button type="button" className="ai-chat-retry-btn" onClick={() => handleGenerate(entry.prompt)} disabled={busy}>
                  Retry
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ai-chat-input-row">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Create an IEEE paper template for computer vision"
          disabled={busy}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button type="button" onClick={() => handleGenerate()} disabled={busy || !prompt.trim()}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  )
}
