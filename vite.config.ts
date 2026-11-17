import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { GET as githubAuth } from './api/auth/github.ts'

// Dev-only: logs cache-misses under /texlive-pkgs/ (i.e. package files the
// static mirror doesn't have yet) so missing files are easy to spot and
// harvest while building out the mirror's coverage. Returning a function
// from configureServer runs it AFTER Vite's built-in static-file middleware,
// so this only fires when the static file truly wasn't found.
function texlivePkgMissLogger(): Plugin {
  return {
    name: 'texlive-pkg-miss-logger',
    configureServer(server) {
      return () => {
        server.middlewares.use('/texlive-pkgs', (req, res) => {
          console.warn('[texlive-pkgs] MISSING', req.method, req.url)
          res.statusCode = 404
          res.end('not found')
        })
      }
    },
  }
}

// Dev-only: serves the GitHub OAuth Vercel Function (api/auth/github.ts) from
// the Vite dev server, so sign-in works with `npm run dev`. Reads
// GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET from .env.local.
function githubAuthDevRoute(): Plugin {
  return {
    name: 'github-auth-dev-route',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), 'GITHUB_'))
      server.middlewares.use('/api/auth/github', async (req, res) => {
        try {
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
          }
          // Connect strips the mount path from req.url ("/?code=…"); put it back
          // without a trailing slash, so redirect_uri matches the authorize step.
          const rest = (req.url ?? '').replace(/^\/(?=\?|$)/, '')
          const url = `http://${req.headers.host}/api/auth/github${rest}`
          const response = await githubAuth(new Request(url, { headers }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          console.error('[github-auth]', err)
          res.statusCode = 500
          res.end('GitHub auth failed')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // 'mpa' disables Vite's SPA history-fallback middleware (which would
  // otherwise serve index.html with a 200 for any unmatched path, including
  // missing /texlive-pkgs/ files) — we have no client-side router yet, so a
  // genuine 404 for missing static files matters more than SPA fallback.
  appType: 'mpa',
  plugins: [react(), texlivePkgMissLogger(), githubAuthDevRoute()],
})
