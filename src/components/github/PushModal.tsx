import { useState } from 'react'
import { githubClient, useGithubAuth } from '../../github/authStore'
import { commitPush, preparePush, type PreparedPush, type PushOptions, type PushResult } from '../../github/repoSync'
import type { GithubLink } from '../../storage/db'
import type { ProjectFile } from '../../state/projectStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { RepoPicker } from './RepoPicker'
import { invalidateRepoCache, useBranches, type PickedRepo } from './repoData'
import '../ProjectSwitcher/NewProjectModal.css'
import './GitHub.css'

interface PushModalProps {
  projectName: string
  files: ProjectFile[]
  rootFile: string
  link: GithubLink | undefined
  /** PDF from the last successful in-browser compile, if any. */
  pdfBytes: Uint8Array | undefined
  onLinked: (link: GithubLink) => void
  onClose: () => void
}

type Mode = 'linked' | 'new' | 'existing'
type Step = { kind: 'form' } | { kind: 'review'; prepared: PreparedPush } | { kind: 'done'; result: PushResult }

const TAG_RE = /^v[0-9A-Za-z][0-9A-Za-z._-]*$/

function repoSlug(name: string): string {
  return (
    name
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'latex-project'
  )
}

/** Commits the project to GitHub, optionally with a CI workflow that builds the PDF and a release tag. */
export function PushModal({ projectName, files, rootFile, link, pdfBytes, onLinked, onClose }: PushModalProps) {
  const user = useGithubAuth((s) => s.user)
  const [mode, setMode] = useState<Mode>(link ? 'linked' : 'new')
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // New repository
  const [repoName, setRepoName] = useState(repoSlug(projectName))
  const [isPrivate, setIsPrivate] = useState(true)
  // Existing repository
  const [picked, setPicked] = useState<PickedRepo | null>(null)
  const [branch, setBranch] = useState('')
  const [dir, setDir] = useState('')
  const branches = useBranches(mode === 'existing' ? picked : null)
  // Commit options
  const [message, setMessage] = useState(`Update ${projectName}`)
  const [includeWorkflow, setIncludeWorkflow] = useState(true)
  const [includePdf, setIncludePdf] = useState(false)
  const [release, setRelease] = useState(false)
  const [version, setVersion] = useState('v1.0.0')

  useEscapeKey(() => {
    if (!busy) onClose()
  })

  const tagError = release && includeWorkflow && !TAG_RE.test(version.trim()) ? 'Use a version like v1.0.0 (must start with “v”).' : null

  function targetLink(): GithubLink | null {
    if (mode === 'linked' && link) return link
    if (mode === 'existing' && picked) {
      const b = branch.trim() || branches?.defaultBranch
      return b ? { owner: picked.owner, repo: picked.repo, branch: b, dir: dir.trim().replace(/^\/+|\/+$/g, '') } : null
    }
    return null
  }

  function options(target: GithubLink): PushOptions {
    return {
      link: target,
      files,
      rootFile,
      message,
      includeWorkflow,
      compiledPdf: includePdf ? pdfBytes : undefined,
      tag: release && includeWorkflow ? version.trim() : undefined,
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    setError(null)
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const review = () =>
    run('Comparing with GitHub…', async () => {
      const target = targetLink()
      if (!target) throw new Error('Choose a repository and branch.')
      setStep({ kind: 'review', prepared: await preparePush(githubClient(), options(target)) })
    })

  const createAndPush = () =>
    run('Creating repository…', async () => {
      const client = githubClient()
      const repo = await client.createRepo({
        name: repoSlug(repoName),
        private: isPrivate,
        description: `${projectName} — LaTeX project from TeXAI-Studio`,
      })
      invalidateRepoCache()
      const target: GithubLink = { owner: repo.owner.login, repo: repo.name, branch: repo.default_branch, dir: '' }
      onLinked(target)
      // GitHub creates the initial commit asynchronously; wait until it exists.
      for (let attempt = 0; attempt < 10; attempt++) {
        if (await client.getBranchHead(target.owner, target.repo, target.branch)) break
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      setBusy('Pushing…')
      const result = await commitPush(client, await preparePush(client, options(target)))
      setStep({ kind: 'done', result })
    })

  const push = (prepared: PreparedPush) =>
    run('Pushing…', async () => {
      const result = await commitPush(githubClient(), prepared)
      if (
        !link ||
        link.owner !== prepared.opts.link.owner ||
        link.repo !== prepared.opts.link.repo ||
        link.branch !== prepared.opts.link.branch ||
        link.dir !== prepared.opts.link.dir
      ) {
        onLinked(prepared.opts.link)
      }
      setStep({ kind: 'done', result })
    })

  const close = busy ? undefined : onClose

  if (step.kind === 'done') {
    const { result } = step
    return (
      <div className="modal-backdrop" onClick={close}>
        <div className="modal gh-modal" onClick={(e) => e.stopPropagation()} role="dialog">
          <h2>Pushed to GitHub</h2>
          <div className="gh-success">
            {result.commitSha
              ? `Committed ${result.changed} changed file${result.changed === 1 ? '' : 's'}${
                  result.deleted ? ` and ${result.deleted} deletion${result.deleted === 1 ? '' : 's'}` : ''
                }.`
              : 'Everything was already up to date — no new commit was needed.'}
          </div>
          {result.actionsUrl && (
            <p>
              GitHub Actions is now compiling the PDF. When the run finishes, download it from the run’s{' '}
              <em>Artifacts</em>
              {result.releaseUrl ? ', and the final PDF is attached to the release.' : '.'}
            </p>
          )}
          <div className="gh-links">
            {result.commitUrl && (
              <a href={result.commitUrl} target="_blank" rel="noreferrer">
                View commit ↗
              </a>
            )}
            <a href={result.repoUrl} target="_blank" rel="noreferrer">
              Open repository ↗
            </a>
            {result.actionsUrl && (
              <a href={result.actionsUrl} target="_blank" rel="noreferrer">
                CI/CD runs (GitHub Actions) ↗
              </a>
            )}
            {result.releaseUrl && (
              <a href={result.releaseUrl} target="_blank" rel="noreferrer">
                Release with final PDF ↗
              </a>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step.kind === 'review') {
    const { plan, opts, branchExists } = step.prepared
    const nothing = plan.upserts.length === 0 && plan.deletes.length === 0
    const target = `${opts.link.owner}/${opts.link.repo} · ${opts.link.branch}${opts.link.dir ? ` · /${opts.link.dir}` : ''}`
    return (
      <div className="modal-backdrop" onClick={close}>
        <div className="modal gh-modal" onClick={(e) => e.stopPropagation()} role="dialog">
          <h2>Review push</h2>
          <p className="gh-muted">
            {target}
            {!branchExists && ' (new branch)'}
          </p>
          {nothing ? (
            <p>
              No file changes — GitHub already matches this project.
              {opts.tag ? ` The tag ${opts.tag} will still be created to publish a release.` : ''}
            </p>
          ) : (
            <ul className="gh-changes">
              {plan.upserts.map((u) => (
                <li key={u.path} className="add" title={u.existed ? 'Modified' : 'Added'}>
                  {u.existed ? '~' : '+'} {u.path}
                </li>
              ))}
              {plan.deletes.map((p) => (
                <li key={p} className="del">
                  − {p}
                </li>
              ))}
            </ul>
          )}
          {plan.deletes.length > 0 && (
            <p className="gh-muted">Deleted files were removed from this project; they stay in the repo’s history.</p>
          )}
          {error && <div className="gh-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={() => setStep({ kind: 'form' })} disabled={!!busy}>
              Back
            </button>
            <button
              type="button"
              className="modal-primary"
              onClick={() => void push(step.prepared)}
              disabled={!!busy || (nothing && !opts.tag && branchExists)}
            >
              {busy ?? (nothing ? (opts.tag ? 'Create release' : 'Nothing to push') : 'Push')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const canSubmit =
    !busy &&
    !tagError &&
    (mode === 'new' ? repoSlug(repoName).length > 0 : mode === 'linked' ? !!link : !!targetLink())

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal gh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="gh-push-title">
        <h2 id="gh-push-title">Push to GitHub</h2>

        {mode === 'linked' && link ? (
          <div className="gh-target">
            <span>
              {link.owner}/{link.repo} · {link.branch}
              {link.dir ? ` · /${link.dir}` : ''}
            </span>
            <button type="button" className="gh-link-btn" onClick={() => setMode('existing')}>
              Change
            </button>
          </div>
        ) : (
          <div className="gh-segment" role="tablist">
            <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>
              New repository
            </button>
            <button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>
              Existing repository
            </button>
            {link && (
              <button type="button" onClick={() => setMode('linked')}>
                Linked repo
              </button>
            )}
          </div>
        )}

        {mode === 'new' && (
          <>
            <label className="modal-field">
              Repository name
              <input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} autoFocus />
            </label>
            <p className="gh-muted">
              Creates <strong>{user?.login ?? 'you'}/{repoSlug(repoName)}</strong>.
            </p>
            <label className="gh-check">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private repository
            </label>
          </>
        )}

        {mode === 'existing' && (
          <>
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
                  <input
                    type="text"
                    list="gh-push-branches"
                    value={branch}
                    placeholder={branches?.defaultBranch ?? 'Loading…'}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                  <datalist id="gh-push-branches">
                    {branches?.branches.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </label>
                <label className="modal-field">
                  Folder (optional)
                  <input type="text" value={dir} placeholder="repo root" onChange={(e) => setDir(e.target.value)} />
                </label>
              </div>
            )}
            {branches?.error && <div className="gh-error">{branches.error}</div>}
          </>
        )}

        <label className="modal-field">
          Commit message
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        <label className="gh-check">
          <input type="checkbox" checked={includeWorkflow} onChange={(e) => setIncludeWorkflow(e.target.checked)} />
          <span>
            Add CI/CD pipeline (GitHub Actions)
            <small>Compiles the PDF with latexmk on every push and pull request.</small>
          </span>
        </label>
        <label className={`gh-check${pdfBytes ? '' : ' disabled'}`}>
          <input
            type="checkbox"
            checked={includePdf && !!pdfBytes}
            disabled={!pdfBytes}
            onChange={(e) => setIncludePdf(e.target.checked)}
          />
          <span>
            Commit the compiled PDF
            <small>{pdfBytes ? 'From your last compile in the browser.' : 'Compile the project first.'}</small>
          </span>
        </label>
        <label className={`gh-check${includeWorkflow ? '' : ' disabled'}`}>
          <input
            type="checkbox"
            checked={release && includeWorkflow}
            disabled={!includeWorkflow}
            onChange={(e) => setRelease(e.target.checked)}
          />
          <span>
            Publish the final PDF as a GitHub Release
            <small>Tags this commit; the CI pipeline builds the PDF and attaches it to the release.</small>
          </span>
        </label>
        {release && includeWorkflow && (
          <label className="modal-field">
            Version tag
            <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
        )}
        {tagError && <div className="gh-error">{tagError}</div>}

        {error && <div className="gh-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={!!busy}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-primary"
            disabled={!canSubmit}
            onClick={() => void (mode === 'new' ? createAndPush() : review())}
          >
            {busy ?? (mode === 'new' ? 'Create repository & push' : 'Review changes')}
          </button>
        </div>
      </div>
    </div>
  )
}
