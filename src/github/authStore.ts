import { create } from 'zustand'
import { GitHubClient, GitHubError, type GitHubUser } from './githubApi'

// Same constant as api/auth/github.ts (kept separate so the app bundle never
// imports server code).
const AUTH_MESSAGE_TYPE = 'texai-github-auth'
const AUTH_ENDPOINT = '/api/auth/github'
const LS_TOKEN = 'texai.github.token'

function readToken(): string | null {
  try {
    return localStorage.getItem(LS_TOKEN)
  } catch {
    return null
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(LS_TOKEN, token)
    else localStorage.removeItem(LS_TOKEN)
  } catch {
    // Storage blocked (private mode): the session still works until reload.
  }
}

type Status = 'signed-out' | 'checking' | 'signed-in'

interface GithubAuthState {
  token: string | null
  user: GitHubUser | null
  status: Status
  error: string | null
  /** Whether the server has a GitHub OAuth App configured (null = unknown yet). */
  oauthAvailable: boolean | null
  init: () => void
  signInWithOAuth: () => void
  signInWithToken: (token: string) => Promise<boolean>
  signOut: () => void
  clearError: () => void
}

let initialized = false

export const useGithubAuth = create<GithubAuthState>((set) => {
  async function adoptToken(token: string): Promise<boolean> {
    set({ status: 'checking', error: null })
    try {
      const user = await new GitHubClient(token).getUser()
      writeToken(token)
      set({ token, user, status: 'signed-in' })
      return true
    } catch (err) {
      const invalid = err instanceof GitHubError && err.status === 401
      if (invalid) writeToken(null)
      set({
        // Offline or GitHub down: keep the stored token and let the user retry.
        token: invalid ? null : token,
        user: null,
        status: 'signed-out',
        error: invalid ? 'That GitHub token is invalid or was revoked.' : String(err instanceof Error ? err.message : err),
      })
      return false
    }
  }

  return {
    token: null,
    user: null,
    status: 'signed-out',
    error: null,
    oauthAvailable: null,

    init() {
      if (initialized) return
      initialized = true

      // Popup flow: the callback page posts the result to its opener and
      // broadcasts it to same-origin tabs; the same message may arrive twice.
      let lastDelivered: string | undefined
      function onAuthMessage(data: { type?: string; token?: string; error?: string } | null) {
        if (data?.type !== AUTH_MESSAGE_TYPE) return
        const key = data.token ?? data.error
        if (key === lastDelivered) return
        lastDelivered = key
        if (data.token) void adoptToken(data.token)
        else set({ status: 'signed-out', error: data.error ?? 'GitHub sign-in failed.' })
      }
      window.addEventListener('message', (event) => {
        if (event.origin === window.location.origin) onAuthMessage(event.data)
      })
      if ('BroadcastChannel' in window) {
        new BroadcastChannel(AUTH_MESSAGE_TYPE).onmessage = (event) => onAuthMessage(event.data)
      }

      // Redirect flow (popup blocked): the token arrives in the URL fragment.
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const fragmentToken = hash.get('github_token')
      const fragmentError = hash.get('github_error')
      if (fragmentToken || fragmentError) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }

      fetch(`${AUTH_ENDPOINT}?status=1`)
        .then((res) => (res.ok ? res.json() : { configured: false }))
        .then((body: { configured?: boolean }) => set({ oauthAvailable: Boolean(body.configured) }))
        .catch(() => set({ oauthAvailable: false }))

      if (fragmentError) set({ error: fragmentError })
      const token = fragmentToken ?? readToken()
      if (token) void adoptToken(token)
    },

    signInWithOAuth() {
      set({ error: null })
      const width = 600
      const height = 720
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        AUTH_ENDPOINT,
        'texai-github-auth',
        `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
      )
      // Popup blocked: sign in by navigating this tab instead. Projects are
      // saved to IndexedDB as you type, so nothing is lost.
      if (!popup) window.location.assign(AUTH_ENDPOINT)
    },

    signInWithToken: (token) => adoptToken(token.trim()),

    signOut() {
      writeToken(null)
      set({ token: null, user: null, status: 'signed-out', error: null })
    },

    clearError: () => set({ error: null }),
  }
})

/** A client for the signed-in user. Throws if nobody is signed in. */
export function githubClient(): GitHubClient {
  const { token } = useGithubAuth.getState()
  if (!token) throw new Error('Sign in with GitHub first.')
  return new GitHubClient(token)
}
