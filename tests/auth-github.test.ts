import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../api/auth/github'

const ORIGIN = 'https://texai.example'

beforeEach(() => {
  process.env.GITHUB_CLIENT_ID = 'client-123'
  process.env.GITHUB_CLIENT_SECRET = 'secret-456'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
})

describe('GET /api/auth/github', () => {
  it('reports whether OAuth is configured', async () => {
    expect(await (await GET(new Request(`${ORIGIN}/api/auth/github?status=1`))).json()).toEqual({ configured: true })
    delete process.env.GITHUB_CLIENT_SECRET
    expect(await (await GET(new Request(`${ORIGIN}/api/auth/github?status=1`))).json()).toEqual({ configured: false })
  })

  it('redirects to GitHub with a state cookie', async () => {
    const res = await GET(new Request(`${ORIGIN}/api/auth/github`))
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get('location')!)
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe('client-123')
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/github`)
    expect(location.searchParams.get('scope')).toBe('repo workflow read:user')
    expect(location.searchParams.get('allow_signup')).toBe('true')
    const state = location.searchParams.get('state')!
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`texai_gh_oauth_state=${state}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  })

  it('rejects a callback whose state does not match the cookie', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await GET(
      new Request(`${ORIGIN}/api/auth/github?code=abc&state=evil`, { headers: { cookie: 'texai_gh_oauth_state=good' } }),
    )
    const html = await res.text()
    expect(html).toContain('Sign-in expired')
    expect(html).not.toContain('"token"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exchanges the code and hands the token to the app', async () => {
    const fetchMock = vi.fn(async () => Response.json({ access_token: 'gho_tok</script>en' }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await GET(
      new Request(`${ORIGIN}/api/auth/github?code=abc&state=good`, { headers: { cookie: 'texai_gh_oauth_state=good' } }),
    )
    const html = await res.text()
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    // The token is embedded safely (no premature </script>).
    expect(html).toContain('gho_tok\\u003c/script>en')
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({ client_id: 'client-123', client_secret: 'secret-456', code: 'abc' })
  })

  it('surfaces GitHub errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'bad_verification_code', error_description: 'The code is bad' })))
    const res = await GET(
      new Request(`${ORIGIN}/api/auth/github?code=abc&state=s`, { headers: { cookie: 'texai_gh_oauth_state=s' } }),
    )
    expect(await res.text()).toContain('The code is bad')
  })
})
