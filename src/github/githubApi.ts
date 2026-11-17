// A small fetch-based client for the GitHub REST API, called straight from the
// browser with the signed-in user's token (api.github.com allows CORS).

const API = 'https://api.github.com'

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
  default_branch: string
  html_url: string
  description: string | null
  updated_at: string
}

export interface TreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

/** An entry for POST /git/trees: `sha: null` deletes the path from base_tree. */
export type NewTreeEntry =
  | { path: string; mode: '100644'; type: 'blob'; sha: string | null }
  | { path: string; mode: '100644'; type: 'blob'; content: string }

export class GitHubError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

/** Parses "owner/repo", "https://github.com/owner/repo(.git)" or a repo page URL. */
export function parseRepoRef(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const match =
    trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) ??
    trimmed.match(/^([\w.-]+)\/([\w.-]+)$/)
  return match ? { owner: match[1], repo: match[2] } : null
}

const enc = encodeURIComponent

export class GitHubClient {
  private readonly token: string
  constructor(token: string) {
    this.token = token
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'x-github-api-version': '2022-11-28',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    if (res.status === 204) return undefined as T
    const data = (await res.json().catch(() => null)) as { message?: string } | null
    if (!res.ok) throw new GitHubError(res.status, describeError(res, data?.message))
    return data as T
  }

  getUser() {
    return this.request<GitHubUser>('GET', '/user')
  }

  /** The user's repos (owned, collaborator and org member), most recently pushed first. */
  async listRepos(maxPages = 5): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = []
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.request<GitHubRepo[]>('GET', `/user/repos?per_page=100&sort=pushed&page=${page}`)
      repos.push(...batch)
      if (batch.length < 100) break
    }
    return repos
  }

  getRepo(owner: string, repo: string) {
    return this.request<GitHubRepo>('GET', `/repos/${enc(owner)}/${enc(repo)}`)
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    const branches = await this.request<{ name: string }[]>(
      'GET',
      `/repos/${enc(owner)}/${enc(repo)}/branches?per_page=100`,
    )
    return branches.map((b) => b.name)
  }

  createRepo(input: { name: string; description?: string; private: boolean }) {
    // auto_init gives the repo a first commit, which the Git Data API needs.
    return this.request<GitHubRepo>('POST', '/user/repos', { ...input, auto_init: true })
  }

  /** The commit SHA a branch points at, or null if the branch doesn't exist. */
  async getBranchHead(owner: string, repo: string, branch: string): Promise<string | null> {
    try {
      const ref = await this.request<{ object: { sha: string } }>(
        'GET',
        `/repos/${enc(owner)}/${enc(repo)}/git/ref/heads/${branch.split('/').map(enc).join('/')}`,
      )
      return ref.object.sha
    } catch (err) {
      if (err instanceof GitHubError && (err.status === 404 || err.status === 409)) return null
      throw err
    }
  }

  async getCommitTree(owner: string, repo: string, commitSha: string): Promise<string> {
    const commit = await this.request<{ tree: { sha: string } }>(
      'GET',
      `/repos/${enc(owner)}/${enc(repo)}/git/commits/${commitSha}`,
    )
    return commit.tree.sha
  }

  /** Every file in a tree (recursively). `truncated` means GitHub cut the list short. */
  getTree(owner: string, repo: string, treeOrRef: string) {
    return this.request<{ sha: string; tree: TreeEntry[]; truncated: boolean }>(
      'GET',
      `/repos/${enc(owner)}/${enc(repo)}/git/trees/${enc(treeOrRef)}?recursive=1`,
    )
  }

  async getBlob(owner: string, repo: string, sha: string): Promise<string> {
    const blob = await this.request<{ content: string; encoding: string }>(
      'GET',
      `/repos/${enc(owner)}/${enc(repo)}/git/blobs/${sha}`,
    )
    return blob.content
  }

  async createBlob(owner: string, repo: string, base64: string): Promise<string> {
    const blob = await this.request<{ sha: string }>('POST', `/repos/${enc(owner)}/${enc(repo)}/git/blobs`, {
      content: base64,
      encoding: 'base64',
    })
    return blob.sha
  }

  async createTree(owner: string, repo: string, baseTree: string | null, tree: NewTreeEntry[]): Promise<string> {
    const created = await this.request<{ sha: string }>('POST', `/repos/${enc(owner)}/${enc(repo)}/git/trees`, {
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree,
    })
    return created.sha
  }

  async createCommit(owner: string, repo: string, message: string, tree: string, parents: string[]) {
    return this.request<{ sha: string; html_url: string }>('POST', `/repos/${enc(owner)}/${enc(repo)}/git/commits`, {
      message,
      tree,
      parents,
    })
  }

  updateBranch(owner: string, repo: string, branch: string, sha: string) {
    return this.request('PATCH', `/repos/${enc(owner)}/${enc(repo)}/git/refs/heads/${branch.split('/').map(enc).join('/')}`, {
      sha,
    })
  }

  createRef(owner: string, repo: string, ref: string, sha: string) {
    return this.request('POST', `/repos/${enc(owner)}/${enc(repo)}/git/refs`, { ref, sha })
  }
}

function describeError(res: Response, message: string | undefined): string {
  // e.g. "refusing to allow an OAuth App to create or update workflow … without `workflow` scope"
  if (message && /workflow/i.test(message) && /scope/i.test(message)) {
    return 'GitHub refused to update .github/workflows: your token needs the "workflow" scope.'
  }
  if (res.status === 401) return 'Your GitHub session has expired or the token was revoked. Sign in again.'
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000
    return `GitHub API rate limit reached. Try again ${reset ? `after ${new Date(reset).toLocaleTimeString()}` : 'later'}.`
  }
  if (res.status === 404) return 'Not found — the repository may not exist or your token lacks access to it.'
  return message ? `GitHub: ${message}` : `GitHub request failed (${res.status}).`
}
