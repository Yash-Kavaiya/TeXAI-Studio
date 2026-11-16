import { useEffect, useRef, useState } from 'react'
import { useGithubAuth } from '../../github/authStore'
import type { GithubLink } from '../../storage/db'
import type { ProjectFile } from '../../state/projectStore'
import { GitHubMark } from './GitHubMark'
import { ImportRepoModal } from './ImportRepoModal'
import { PushModal } from './PushModal'
import { SignInModal } from './SignInModal'
import './GitHub.css'

interface GitHubMenuProps {
  projectName: string
  files: ProjectFile[]
  rootFile: string
  link: GithubLink | undefined
  pdfBytes: Uint8Array | undefined
  onImported: (projectId: string) => void
  onLinked: (link: GithubLink | undefined) => void
}

type Dialog = 'sign-in' | 'import' | 'push' | null

/** Toolbar entry point: sign up / sign in with GitHub, import a repo, push, CI/CD. */
export function GitHubMenu({ projectName, files, rootFile, link, pdfBytes, onImported, onLinked }: GitHubMenuProps) {
  const { status, user, signOut } = useGithubAuth()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(next: Dialog) {
    setOpen(false)
    setDialog(next)
  }

  const repoUrl = link
    ? `https://github.com/${link.owner}/${link.repo}/tree/${encodeURIComponent(link.branch)}${link.dir ? `/${link.dir}` : ''}`
    : null

  return (
    <div className="gh-menu" ref={rootRef}>
      {status === 'signed-in' && user ? (
        <button
          type="button"
          className="gh-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={`Signed in to GitHub as ${user.login}`}
        >
          <img className="gh-avatar" src={user.avatar_url} alt="" />
          {user.login} <span className="project-switcher-caret">▾</span>
        </button>
      ) : (
        <button
          type="button"
          className="gh-trigger"
          onClick={() => setDialog('sign-in')}
          disabled={status === 'checking'}
        >
          <GitHubMark />
          {status === 'checking' ? 'Connecting…' : 'Sign in with GitHub'}
        </button>
      )}

      {open && user && (
        <div className="gh-dropdown" role="menu">
          <div className="gh-dropdown-header">
            Signed in as <strong>{user.login}</strong>
          </div>
          <button type="button" role="menuitem" onClick={() => choose('push')}>
            Push to GitHub…
            <span className="gh-dropdown-sub">
              {link ? `${link.owner}/${link.repo} · ${link.branch}` : 'Create a repo or pick one; adds CI that builds the PDF'}
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose('import')}>
            Import from GitHub…
            <span className="gh-dropdown-sub">Open a repository as a new project</span>
          </button>
          {repoUrl && link && (
            <>
              <a href={repoUrl} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpen(false)}>
                Open linked repository ↗
              </a>
              <a
                href={`https://github.com/${link.owner}/${link.repo}/actions`}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                CI/CD runs &amp; PDFs ↗
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onLinked(undefined)
                }}
              >
                Unlink repository
                <span className="gh-dropdown-sub">Keeps the project; the next push asks where to go</span>
              </button>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="gh-dropdown-sep"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}

      {dialog === 'sign-in' && <SignInModal onClose={() => setDialog(null)} />}
      {dialog === 'import' && (
        <ImportRepoModal
          onClose={() => setDialog(null)}
          onImported={(projectId) => {
            setDialog(null)
            onImported(projectId)
          }}
        />
      )}
      {dialog === 'push' && (
        <PushModal
          projectName={projectName}
          files={files}
          rootFile={rootFile}
          link={link}
          pdfBytes={pdfBytes}
          onLinked={onLinked}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
