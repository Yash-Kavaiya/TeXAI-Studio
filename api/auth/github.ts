// GitHub OAuth (web flow) for TeXAI-Studio — one Vercel Function, three modes:
//
//   GET /api/auth/github?status=1   → {"configured": boolean}
//   GET /api/auth/github            → redirect to GitHub's authorize page
//                                     (GitHub offers "Create an account" there,
//                                     so this is both sign-up and sign-in)
//   GET /api/auth/github?code=…     → GitHub's callback: exchange the code for a
//                                     token and hand it to the app
//
// The client secret never leaves the server; the access token is handed to the
// browser (which calls the GitHub API directly) via postMessage/BroadcastChannel
// to the window that opened the sign-in popup, or, without a popup, via the URL
// fragment —
// fragments are never sent to servers or leaked in Referer headers.
//
// Self-contained on purpose (no local imports): vite.config.ts mounts this same
// handler in the dev server, and Vercel bundles each function file on its own.
//
// Env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (a GitHub OAuth App whose
// callback URL is https://<your-domain>/api/auth/github).

const STATE_COOKIE = 'texai_gh_oauth_state'
// `repo` to read/push repositories, `workflow` to commit .github/workflows
// files (GitHub rejects workflow changes without it), `read:user` for the profile.
const SCOPES = 'repo workflow read:user'
const AUTH_MESSAGE_TYPE = 'texai-github-auth'

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

function stateCookie(value: string, secure: boolean, maxAge: number): string {
  return [
    `${STATE_COOKIE}=${value}`,
    'Path=/api/auth/github',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A tiny page that delivers the result to the app and closes itself. */
function resultPage(payload: { token: string } | { error: string }, secure: boolean): Response {
  // JSON inside <script>: escape `<` so the payload can't close the tag.
  const json = JSON.stringify({ type: AUTH_MESSAGE_TYPE, ...payload }).replace(/</g, '\\u003c')
  const fragment =
    'token' in payload
      ? `github_token=${encodeURIComponent(payload.token)}`
      : `github_error=${encodeURIComponent(payload.error)}`
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in…</title>
<p style="font:14px system-ui;padding:24px">Finishing GitHub sign-in…</p>
<script>
  var msg = ${json};
  // Popup: hand the result to the app window. window.opener can be severed by
  // the trip through github.com, so also broadcast to same-origin tabs.
  try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, window.location.origin); } catch (e) {}
  try { var bc = new BroadcastChannel(${JSON.stringify(AUTH_MESSAGE_TYPE)}); bc.postMessage(msg); bc.close(); } catch (e) {}
  window.close();
  // Still open, so this wasn't a popup: continue in this tab via the fragment.
  setTimeout(function () { window.location.replace('/#${fragment}'); }, 400);
</script>`
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      // Clear the one-time state cookie.
      'set-cookie': stateCookie('', secure, 0),
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  const configured = Boolean(clientId && clientSecret)
  const secure = url.protocol === 'https:'

  if (url.searchParams.has('status')) {
    return Response.json({ configured }, { headers: { 'cache-control': 'no-store' } })
  }
  if (!configured) return resultPage({ error: 'GitHub sign-in is not configured on this server.' }, secure)

  const code = url.searchParams.get('code')
  const githubError = url.searchParams.get('error')
  const redirectUri = `${url.origin}${url.pathname}`

  if (githubError) {
    return resultPage({ error: url.searchParams.get('error_description') ?? githubError }, secure)
  }

  // Step 1: send the user to GitHub.
  if (!code) {
    const state = randomState()
    const authorize = new URL('https://github.com/login/oauth/authorize')
    authorize.searchParams.set('client_id', clientId!)
    authorize.searchParams.set('redirect_uri', redirectUri)
    authorize.searchParams.set('scope', SCOPES)
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('allow_signup', 'true')
    return new Response(null, {
      status: 302,
      headers: {
        location: authorize.toString(),
        'cache-control': 'no-store',
        'set-cookie': stateCookie(state, secure, 600),
      },
    })
  }

  // Step 2: GitHub sent the user back. The state must match the cookie we set
  // in step 1, or this callback wasn't started by this browser (CSRF).
  const expected = readCookie(request, STATE_COOKIE)
  if (!expected || expected !== url.searchParams.get('state')) {
    return resultPage({ error: 'Sign-in expired or was started elsewhere. Please try again.' }, secure)
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  })
  const body = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
    error_description?: string
  }
  if (!tokenRes.ok || !body.access_token) {
    return resultPage({ error: body.error_description ?? body.error ?? 'GitHub did not return a token.' }, secure)
  }
  return resultPage({ token: body.access_token }, secure)
}
