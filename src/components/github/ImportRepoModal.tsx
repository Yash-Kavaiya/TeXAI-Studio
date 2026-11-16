import { useState } from 'react'
import { githubClient } from '../../github/authStore'
import { importFromRepo } from '../../github/repoSync'
import { createProjectWithFiles } from '../../storage/projectFactory'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { RepoPicker } from './RepoPicker'
import { useBranches, type PickedRepo } from './repoData'
import '../ProjectSwitcher/NewProjectModal.css'
import './GitHub.css'

interface ImportRepoModalProps {
  onImported: (projectId: string) => void
  onClose: () => void
}

/** Imports a GitHub repository (or one folder of it) as a new, linked project. */
export function ImportRepoModal({ onImported, onClose }: ImportRepoModalProps) {
  const [picked, setPicked] = useState<PickedRepo | null>(null)
  const [branch, setBranch] = useState('')
  const [dir, setDir] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<{ projectId: string; paths: string[] } | null>(null)
  const branches = useBranches(picked)
  useEscapeKey(onClose)

  const effectiveBranch = branch || branches?.defaultBranch || ''
  const busy = progress !== null

  async function handleImport() {
    if (!picked || !effectiveBranch) return
    setError(null)
    setProgress('Reading repository…')
    try {
      const { skipped: skippedPaths, link, ...project } = await importFromRepo(
        githubClient(),
        { owner: picked.owner, repo: picked.repo, branch: effectiveBranch, dir },
        (done, total) => setProgress(`Downloading files… ${done}/${total}`),
      )
      const projectId = await createProjectWithFiles({ ...project, github: link })
      if (skippedPaths.length > 0) setSkipped({ projectId, paths: skippedPaths })
      else onImported(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProgress(null)
    }
  }

  if (skipped) {
    return (
      <div className="modal-backdrop">
        <div className="modal gh-modal" role="dialog">
          <h2>Imported</h2>
          <p>
            These files aren’t LaTeX sources or images, so they stayed on GitHub (pushing won’t touch them):
          </p>
          <ul className="gh-changes">
            {skipped.paths.slice(0, 200).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {skipped.paths.length > 200 && <li>… and {skipped.paths.length - 200} more</li>}
          </ul>
          <div className="modal-actions">
            <button type="button" className="modal-primary" onClick={() => onImported(skipped.projectId)}>
              Open project
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal gh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="gh-import-title">
        <h2 id="gh-import-title">Import from GitHub</h2>
        <RepoPicker
          selected={picked}
          onSelect={(repo) => {
            setPicked(repo)
            setBranch('')
          }}
        />
        {picked && (
          <div className="gh-row">
            <label className="modal-field">
              Branch
              <select value={effectiveBranch} onChange={(e) => setBranch(e.target.value)} disabled={!branches}>
                {!branches && <option value="">Loading…</option>}
                {branches?.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="modal-field">
              Folder (optional)
              <input type="text" value={dir} placeholder="e.g. paper" onChange={(e) => setDir(e.target.value)} />
            </label>
          </div>
        )}
        {branches?.error && <div className="gh-error">{branches.error}</div>}
        {error && <div className="gh-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-primary"
            onClick={() => void handleImport()}
            disabled={!picked || !effectiveBranch || busy}
          >
            {progress ?? 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
