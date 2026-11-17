import { useEffect, useState } from 'react'
import { useGithubAuth } from '../../github/authStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { GitHubMark } from './GitHubMark'
import '../ProjectSwitcher/NewProjectModal.css'
import './GitHub.css'

const TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo,workflow,read:user&description=TeXAI-Studio'

interface SignInModalProps {
  onClose: () => void
}

/** "Sign up / sign in with GitHub" — OAuth when the server supports it, else a token. */
export function SignInModal({ onClose }: SignInModalProps) {
  const { status, error, oauthAvailable, signInWithOAuth, signInWithToken, clearError } = useGithubAuth()
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  useEscapeKey(onClose)

  // Close once sign-in succeeds (from the popup or the token form).
  useEffect(() => {
    if (status === 'signed-in') onClose()
  }, [status, onClose])

  useEffect(() => clearError, [clearError])

  const checking = status === 'checking'
  const tokenFormVisible = showToken || oauthAvailable === false

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal gh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="gh-signin-title">
        <h2 id="gh-signin-title">Sign up or sign in with GitHub</h2>
        <p className="gh-muted">
          Connect GitHub to import LaTeX projects from your repositories, push your work back, and build the final PDF
          with GitHub Actions.
        </p>

        {oauthAvailable !== false && (
          <>
            <button
              type="button"
              className="gh-oauth-btn"
              onClick={signInWithOAuth}
              disabled={checking || oauthAvailable === null}
            >
              <GitHubMark />
              {checking ? 'Connecting…' : 'Continue with GitHub'}
            </button>
            <p className="gh-muted" style={{ marginTop: 8 }}>
              New to GitHub? You can create a free account on the next screen.
            </p>
          </>
        )}

        {oauthAvailable === false && (
          <p className="gh-muted">
            One-click GitHub sign-in isn’t configured on this deployment, so use a personal access token.
            Don’t have an account?{' '}
            <a href="https://github.com/signup" target="_blank" rel="noreferrer">
              Sign up for GitHub
            </a>
            .
          </p>
        )}

        {oauthAvailable !== false && !tokenFormVisible && (
          <button type="button" className="gh-link-btn" onClick={() => setShowToken(true)}>
            Use a personal access token instead
          </button>
        )}

        {tokenFormVisible && (
          <>
            {oauthAvailable !== false && <div className="gh-divider">or use a personal access token</div>}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (token.trim()) void signInWithToken(token)
              }}
            >
              <label className="modal-field">
                <span>
                  Token{' '}
                  <a href={TOKEN_URL} target="_blank" rel="noreferrer">
                    (create one with repo + workflow scopes)
                  </a>
                </span>
                <input
                  type="password"
                  value={token}
                  autoComplete="off"
                  placeholder="ghp_… or github_pat_…"
                  onChange={(e) => setToken(e.target.value)}
                />
              </label>
              <div className="modal-actions" style={{ marginTop: 0 }}>
                <button type="submit" className="modal-primary" disabled={!token.trim() || checking}>
                  {checking ? 'Checking…' : 'Sign in with token'}
                </button>
              </div>
            </form>
          </>
        )}

        {error && <div className="gh-error">{error}</div>}

        <p className="gh-muted" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          Your GitHub token is stored only in this browser and sent only to api.github.com.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
