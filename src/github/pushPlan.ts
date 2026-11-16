import { gitBlobSha, utf8 } from './encoding'
import type { TreeEntry } from './githubApi'
import { joinPath } from './workflowTemplate'

// Remote files a push may delete when they're gone from the project: LaTeX
// sources and figures. Docs (.md/.txt), code and config are never touched.
const DELETABLE_RE = /\.(tex|bib|sty|cls|bst|bbx|cbx|cfg|def|clo|png|jpe?g|pdf)$/i

export interface LocalFile {
  path: string
  content: string
  data?: Uint8Array
}

export interface PushPlan {
  /** Repo-relative paths whose bytes are new (`existed: false`) or changed. */
  upserts: { path: string; bytes: Uint8Array; existed: boolean }[]
  /** Repo-relative paths to delete (project files removed locally). */
  deletes: string[]
}

/**
 * Works out the minimal commit that makes the repo's project folder match the
 * local project.
 *
 * - `files` are project files (paths relative to the project root);
 *   folder markers ("dir/") are skipped — git has no empty folders.
 * - `extras` are generated files (CI workflow, .gitignore, compiled PDF) with
 *   repo-relative paths.
 * - `remote` is the current tree of the target branch (empty for a new branch).
 * - `dir` is the folder in the repo that holds the project ('' = repo root).
 * - `keep` are repo-relative paths never to delete (e.g. the compiled PDF).
 *
 * Files whose git blob SHA already matches the remote are left out. Remote
 * LaTeX sources and figures under `dir` that no longer exist locally are
 * deleted; anything else in the repo (README, workflows, code) is left alone.
 */
export async function planPush({
  files,
  extras = [],
  remote,
  dir,
  keep = [],
}: {
  files: LocalFile[]
  extras?: { path: string; bytes: Uint8Array }[]
  remote: TreeEntry[]
  dir: string
  keep?: string[]
}): Promise<PushPlan> {
  const remoteBlobs = new Map(remote.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]))
  const wanted = new Map<string, Uint8Array>()
  for (const file of files) {
    if (file.path.endsWith('/')) continue
    wanted.set(joinPath(dir, file.path), file.data ?? utf8(file.content))
  }
  for (const extra of extras) wanted.set(extra.path, extra.bytes)

  const upserts: PushPlan['upserts'] = []
  for (const [path, bytes] of wanted) {
    const remoteSha = remoteBlobs.get(path)
    if (remoteSha !== (await gitBlobSha(bytes))) upserts.push({ path, bytes, existed: remoteSha !== undefined })
  }

  const prefix = dir ? `${dir}/` : ''
  const protectedPaths = new Set(keep)
  const deletes = [...remoteBlobs.keys()].filter(
    (path) =>
      path.startsWith(prefix) &&
      !wanted.has(path) &&
      !protectedPaths.has(path) &&
      DELETABLE_RE.test(path),
  )

  return { upserts, deletes }
}
