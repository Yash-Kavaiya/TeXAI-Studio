import { useEffect, useMemo, useState } from 'react'
import { parseRepoRef, type GitHubRepo } from '../../github/githubApi'
import { cachedRepos, loadRepos, type PickedRepo } from './repoData'

interface RepoPickerProps {
  selected: PickedRepo | null
  onSelect: (repo: PickedRepo | null) => void
}

/** Searchable list of the user's repositories, plus "paste owner/repo or a URL". */
export function RepoPicker({ selected, onSelect }: RepoPickerProps) {
  const [repos, setRepos] = useState<GitHubRepo[] | null>(cachedRepos())
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (cachedRepos()) return
    loadRepos()
      .then(setRepos)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const typedRef = parseRepoRef(query)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (repos ?? []).filter((r) => !q || r.full_name.toLowerCase().includes(q)).slice(0, 100)
  }, [repos, query])
  const typedIsListed = typedRef && filtered.some((r) => r.full_name.toLowerCase() === `${typedRef.owner}/${typedRef.repo}`.toLowerCase())

  const isSelected = (owner: string, repo: string) =>
    selected?.owner.toLowerCase() === owner.toLowerCase() && selected?.repo.toLowerCase() === repo.toLowerCase()

  return (
    <>
      <label className="modal-field">
        Repository
        <input
          type="text"
          value={query}
          placeholder="Search your repositories, or paste owner/repo or a GitHub URL"
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      <div className="gh-repo-list" role="listbox" aria-label="Repositories">
        {typedRef && !typedIsListed && (
          <button
            type="button"
            className={`gh-repo-item${isSelected(typedRef.owner, typedRef.repo) ? ' selected' : ''}`}
            onClick={() => onSelect(typedRef)}
          >
            {typedRef.owner}/{typedRef.repo}
            <small>use this repository</small>
          </button>
        )}
        {error && <div className="gh-repo-empty">{error}</div>}
        {!error && repos === null && <div className="gh-repo-empty">Loading your repositories…</div>}
        {repos !== null && filtered.length === 0 && !typedRef && (
          <div className="gh-repo-empty">No matching repositories.</div>
        )}
        {filtered.map((r) => (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={isSelected(r.owner.login, r.name)}
            className={`gh-repo-item${isSelected(r.owner.login, r.name) ? ' selected' : ''}`}
            onClick={() => onSelect({ owner: r.owner.login, repo: r.name, defaultBranch: r.default_branch })}
          >
            {r.full_name}
            <small>{r.private ? 'private' : 'public'}</small>
          </button>
        ))}
      </div>
    </>
  )
}
