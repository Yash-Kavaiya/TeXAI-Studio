import { useState } from 'react'
import { createProjectWithFiles } from '../../storage/projectFactory'
import blankMainTex from '../../storage/blankProject/main.tex?raw'
import './NewProjectModal.css'

interface NewProjectModalProps {
  onCreated: (projectId: string) => void
  onClose: () => void
}

export function NewProjectModal({ onCreated, onClose }: NewProjectModalProps) {
  const [name, setName] = useState('Untitled Project')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Project</h2>
        <label className="modal-field">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-primary" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
