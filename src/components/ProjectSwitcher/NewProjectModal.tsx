import { useState } from 'react'
import { createProjectWithFiles } from '../../storage/projectFactory'
import { getAnthropicApiKey } from '../../settings/apiKeyStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { AiChatPane } from '../ai/AiChatPane'
import blankMainTex from '../../storage/blankProject/main.tex?raw'
import './NewProjectModal.css'

interface NewProjectModalProps {
  onCreated: (projectId: string) => void
  onClose: () => void
}

type Tab = 'blank' | 'ai'

export function NewProjectModal({ onCreated, onClose }: NewProjectModalProps) {
  const [tab, setTab] = useState<Tab>('blank')
  const [name, setName] = useState('Untitled Project')
  const [creating, setCreating] = useState(false)
  const hasAnthropicKey = !!getAnthropicApiKey()
  useEscapeKey(onClose)

  async function handleCreateBlank() {
    setCreating(true)
    try {
      const projectId = await createProjectWithFiles({
        name: name.trim() || 'Untitled Project',
        rootFile: 'main.tex',
        files: [{ path: 'main.tex', content: blankMainTex }],
      })
      onCreated(projectId)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal new-project-modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Project</h2>

        <div className="new-project-tabs">
          <button
            type="button"
            className={tab === 'blank' ? 'new-project-tab active' : 'new-project-tab'}
            onClick={() => setTab('blank')}
          >
            Blank
          </button>
          <button
            type="button"
            className={tab === 'ai' ? 'new-project-tab active' : 'new-project-tab'}
            onClick={() => setTab('ai')}
          >
            Generate with AI ✨
          </button>
        </div>

        {tab === 'blank' ? (
          <>
            <label className="modal-field">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBlank()}
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="modal-primary" onClick={handleCreateBlank} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </>
        ) : hasAnthropicKey ? (
          <AiChatPane onCreated={onCreated} />
        ) : (
          <p className="new-project-ai-locked">
            Add your Anthropic API key in Settings (⚙, top right) to use AI generation.
          </p>
        )}
      </div>
    </div>
  )
}
