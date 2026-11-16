import { filesFromEntries, isImportablePath } from '../storage/projectZip'
import type { ProjectTemplateInput } from '../storage/projectFactory'
import type { GithubLink } from '../storage/db'
import { base64ToBytes, bytesToBase64, utf8 } from './encoding'
import { GitHubClient, GitHubError, type NewTreeEntry, type TreeEntry } from './githubApi'
import { planPush, type LocalFile, type PushPlan } from './pushPlan'
import { WORKFLOW_PATH, buildPdfWorkflow, latexGitignore, pdfOutputPath } from './workflowTemplate'

const MAX_IMPORT_FILES = 1000
const MAX_IMPORT_BYTES = 50 * 1024 * 1024
const CONCURRENCY = 6

/** Runs `fn` over `items`, at most `limit` at a time, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const normalizeDir = (dir: string) => dir.trim().replace(/^\/+|\/+$/g, '')

/**
 * Downloads a repo folder (`dir`, '' for the whole repo) at `branch` and turns
 * it into a new project's files. Only LaTeX sources and images are fetched.
 */
export async function importFromRepo(
  client: GitHubClient,
  { owner, repo, branch, dir }: GithubLink,
  onProgress?: (done: number, total: number) => void,
): Promise<ProjectTemplateInput & { skipped: string[]; link: GithubLink }> {
  const folder = normalizeDir(dir)
  const prefix = folder ? `${folder}/` : ''
  const { tree, truncated } = await client.getTree(owner, repo, branch)
  if (truncated) throw new Error('That repository is too large to import (GitHub truncated its file list).')

  const inFolder = tree.filter((e) => e.type === 'blob' && e.path.startsWith(prefix))
  const importable = inFolder.filter((e) => isImportablePath(e.path.slice(prefix.length)))
  // A PDF next to a .tex file of the same name is that file's compiled output,
  // not a figure; don't pull it back into the project.
  const texPaths = new Set(importable.filter((e) => e.path.endsWith('.tex')).map((e) => e.path))
  const wanted = importable.filter((e) => !(e.path.endsWith('.pdf') && texPaths.has(e.path.replace(/\.pdf$/, '.tex'))))
  if (wanted.length === 0) throw new Error(`No LaTeX files found in ${owner}/${repo}${folder ? `/${folder}` : ''}.`)
  if (wanted.length > MAX_IMPORT_FILES) throw new Error(`That folder has more than ${MAX_IMPORT_FILES} files.`)
  const totalBytes = wanted.reduce((sum, e) => sum + (e.size ?? 0), 0)
  if (totalBytes > MAX_IMPORT_BYTES) throw new Error('That folder is larger than 50 MB.')

  let done = 0
  onProgress?.(0, wanted.length)
  const blobs = await mapLimit(wanted, CONCURRENCY, async (entry: TreeEntry) => {
    const bytes = base64ToBytes(await client.getBlob(owner, repo, entry.sha))
    onProgress?.(++done, wanted.length)
    return [entry.path.slice(prefix.length), bytes] as const
  })

  const skippedOther = inFolder.filter((e) => !isImportablePath(e.path.slice(prefix.length))).map((e) => e.path)
  // If every file sits in one subfolder, the project is that subfolder; record
  // it in the link so pushes go back to the same place.
  const { rootFile, files, skipped, unwrapped } = filesFromEntries(Object.fromEntries(blobs), `${owner}/${repo}`)
  const projectDir = [folder, unwrapped].filter(Boolean).join('/')
  return {
    name: projectDir ? `${repo}/${projectDir}` : repo,
    rootFile,
    files,
    skipped: [...skipped, ...skippedOther.filter((p) => !p.startsWith('.github/'))],
    link: { owner, repo, branch, dir: projectDir },
  }
}

export interface PushOptions {
  link: GithubLink
  files: LocalFile[]
  rootFile: string
  message: string
  /** Add/refresh the GitHub Actions workflow that builds the PDF. */
  includeWorkflow: boolean
  /** The PDF from the last in-browser compile, to commit next to the root file. */
  compiledPdf?: Uint8Array
  /** Create this tag (e.g. "v1.0") on the new commit; CI then publishes a Release. */
  tag?: string
}

export interface PushResult {
  commitSha: string | null
  commitUrl: string | null
  changed: number
  deleted: number
  repoUrl: string
  actionsUrl: string | null
  releaseUrl: string | null
}

/** Everything a push will do, computed without writing anything — shown for review. */
export interface PreparedPush {
  opts: PushOptions
  plan: PushPlan
  parent: string
  baseTree: string
  branchExists: boolean
  repoHtmlUrl: string
  defaultBranch: string
  hasWorkflow: boolean
}

/**
 * Step 1 of a push: reads the target branch (or the default branch, for a new
 * branch) and works out which files would be uploaded and deleted.
 */
export async function preparePush(client: GitHubClient, opts: PushOptions): Promise<PreparedPush> {
  const { owner, repo, branch } = opts.link
  const dir = normalizeDir(opts.link.dir)
  const repoInfo = await client.getRepo(owner, repo)

  let parent = await client.getBranchHead(owner, repo, branch)
  const branchExists = parent !== null
  // New branch: start it from the default branch so existing files are kept.
  if (!parent) parent = await client.getBranchHead(owner, repo, repoInfo.default_branch)
  if (!parent) {
    throw new Error(
      `${owner}/${repo} is empty. Add a first commit on GitHub (e.g. a README), or create a new repository from here.`,
    )
  }
  const baseTree = await client.getCommitTree(owner, repo, parent)
  const remote = await client.getTree(owner, repo, baseTree)
  if (remote.truncated) throw new Error('That repository is too large to push to from the browser.')
  const remotePaths = new Set(remote.tree.map((e) => e.path))

  const pdfPath = pdfOutputPath(opts.rootFile, dir)
  const extras: { path: string; bytes: Uint8Array }[] = []
  if (opts.includeWorkflow) {
    extras.push({ path: WORKFLOW_PATH, bytes: utf8(buildPdfWorkflow({ rootFile: opts.rootFile, dir, branch })) })
    const gitignore = dir ? `${dir}/.gitignore` : '.gitignore'
    if (!remotePaths.has(gitignore) && !remotePaths.has('.gitignore')) {
      extras.push({ path: gitignore, bytes: utf8(latexGitignore()) })
    }
  }
  if (opts.compiledPdf) extras.push({ path: pdfPath, bytes: opts.compiledPdf })

  const plan = await planPush({ files: opts.files, extras, remote: remote.tree, dir, keep: [pdfPath] })
  return {
    opts,
    plan,
    parent,
    baseTree,
    branchExists,
    repoHtmlUrl: repoInfo.html_url,
    defaultBranch: repoInfo.default_branch,
    hasWorkflow: opts.includeWorkflow || remotePaths.has(WORKFLOW_PATH),
  }
}

/** Step 2 of a push: writes the reviewed plan as one commit (plus an optional release tag). */
export async function commitPush(client: GitHubClient, prepared: PreparedPush): Promise<PushResult> {
  const { opts, plan, parent, baseTree, branchExists } = prepared
  const { owner, repo, branch } = opts.link
  const tag = opts.tag?.trim()

  let commitSha: string | null = null
  let commitUrl: string | null = null
  if (plan.upserts.length > 0 || plan.deletes.length > 0) {
    const entries: NewTreeEntry[] = await mapLimit(plan.upserts, CONCURRENCY, async ({ path, bytes }) => ({
      path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: await client.createBlob(owner, repo, bytesToBase64(bytes)),
    }))
    for (const path of plan.deletes) entries.push({ path, mode: '100644', type: 'blob', sha: null })

    const tree = await client.createTree(owner, repo, baseTree, entries)
    const message = opts.message.trim() || 'Update from TeXAI-Studio'
    const commit = await client.createCommit(owner, repo, message, tree, [parent])
    if (branchExists) {
      try {
        await client.updateBranch(owner, repo, branch, commit.sha)
      } catch (err) {
        if (err instanceof GitHubError && err.status === 422) {
          throw new Error(`“${branch}” changed on GitHub since you reviewed this push. Review it again.`)
        }
        throw err
      }
    }
    commitSha = commit.sha
    commitUrl = commit.html_url
  }
  if (!branchExists) await client.createRef(owner, repo, `refs/heads/${branch}`, commitSha ?? parent)

  if (tag) {
    try {
      await client.createRef(owner, repo, `refs/tags/${tag}`, commitSha ?? parent)
    } catch (err) {
      if (err instanceof GitHubError && err.status === 422) {
        const prefix = commitSha ? 'Pushed, but tag' : 'Tag'
        throw new Error(`${prefix} “${tag}” already exists — pick a new version to publish a release.`)
      }
      throw err
    }
  }

  const { repoHtmlUrl, defaultBranch } = prepared
  return {
    commitSha,
    commitUrl,
    changed: plan.upserts.length,
    deleted: plan.deletes.length,
    repoUrl: branch === defaultBranch ? repoHtmlUrl : `${repoHtmlUrl}/tree/${encodeURIComponent(branch)}`,
    actionsUrl: prepared.hasWorkflow ? `${repoHtmlUrl}/actions` : null,
    releaseUrl: tag ? `${repoHtmlUrl}/releases/tag/${encodeURIComponent(tag)}` : null,
  }
}
