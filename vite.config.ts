import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  // 'mpa' disables Vite's SPA history-fallback middleware (which would
  // otherwise serve index.html with a 200 for any unmatched path, including
  // missing /texlive-pkgs/ files) — we have no client-side router yet, so a
  // genuine 404 for missing static files matters more than SPA fallback.
  appType: 'mpa',
  plugins: [react(), texlivePkgMissLogger()],
})
