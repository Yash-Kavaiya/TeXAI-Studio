# TeXAI-Studio

A browser-based LaTeX editor: CodeMirror editing, in-browser pdfTeX (WASM) compilation,
live PDF preview, multi-file projects, and optional AI-generated project templates.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build    # tsc -b && vite build → dist/
```

Node 22 (see `.nvmrc`).

## CI/CD

- **CI** — `.github/workflows/ci.yml` runs on every push to `main` and every pull request:
  lint, typecheck + build, a check that the TeX engine assets made it into `dist/`, and a
  guard against temporary `public/__*` files shipping.
- **CD** — Vercel's Git integration: pushes to `main` deploy to production, pull requests get
  preview deployments. Build settings live in `vercel.json`.

Vercel deploys from Git rather than from a GitHub Action running `vercel deploy`, because
the build output (~160 MB, ~7,800 files — mostly the TeX package mirror) exceeds the Hobby
plan's 100 MB CLI upload limit and 5,000 uploads/day; Git deployments clone the repo instead.

### One-time setup

1. In Vercel, **Add New → Project** and import `Yash-Kavaiya/TeXAI-Studio`. The settings in
   `vercel.json` are picked up automatically; no environment variables are needed (API keys
   are entered by each user in the app and stay in their browser).
2. To make deploys wait for CI, protect `main` in GitHub (**Settings → Branches**) and require
   the **Lint, typecheck & build** check before merging.

### Hosting constraint

`public/texlive-pkgs/` must return real `404`s for missing files — the pdfTeX engine treats
any `200` as "file found". Never add a catch-all SPA rewrite (e.g. `/(.*) → /index.html`) to
`vercel.json`; it would feed `index.html` to the engine in place of missing packages.
