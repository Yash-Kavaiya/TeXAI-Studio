import { useEffect, useState } from 'react'
import { githubClient } from '../../github/authStore'
import type { GitHubRepo } from '../../github/githubApi'

export interface PickedRepo {
  owner: string
  repo: string
  defaultBranch?: string
}

// Cached for the session so reopening a dialog doesn't refetch every repo.
let repoCache: GitHubRepo[] | null = null

export function cachedRepos(): GitHubRepo[] | null {
  return repoCache
}

export async function loadRepos(): Promise<GitHubRepo[]> {
  repoCache = await githubClient().listRepos()
  return repoCache
}

/** Forget cached repos (e.g. after creating one). */
export function invalidateRepoCache(): void {
  repoCache = null
}

/** Loads branch names for a repo, defaulting the selection to its default branch. */
export function useBranches(picked: PickedRepo | null) {
  const [state, setState] = useState<{ key: string; branches: string[]; defaultBranch: string; error?: string } | null>(
    null,
  )
  const key = picked ? `${picked.owner}/${picked.repo}` : ''

  useEffect(() => {
    if (!picked) return
    let cancelled = false
    const client = githubClient()
    Promise.all([
      picked.defaultBranch ? Promise.resolve(picked.defaultBranch) : client.getRepo(picked.owner, picked.repo).then((r) => r.default_branch),
      client.listBranches(picked.owner, picked.repo),
    ])
      .then(([defaultBranch, branches]) => {
        if (!cancelled) setState({ key, branches, defaultBranch })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key, branches: [], defaultBranch: '', error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
    // `key` identifies the repo; the object identity of `picked` doesn't matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state && state.key === key ? state : null
}
