/** Directory portion of a path, or '' if the path has no directory component. */
export function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

const INVALID_CHARS_RE = /[\\:*?"<>|]/

/** Normalizes a user-typed project path ("./sections//a.tex " → "sections/a.tex")
 * and checks it can be created alongside `existingPaths` (which may include
 * "folder/" markers). Returns the clean path, or a human-readable error. */
export function validateNewPath(input: string, existingPaths: string[]): { path: string } | { error: string } {
  const path = input
    .trim()
    .replace(/^(\.\/|\/)+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '')
  if (!path) return { error: 'Enter a name.' }
  if (INVALID_CHARS_RE.test(path)) return { error: 'Names can’t contain \\ : * ? " < > |' }
  if (path.split('/').some((part) => part === '.' || part === '..')) return { error: 'Names can’t contain . or .. segments.' }

  const taken = existingPaths.map((p) => p.replace(/\/$/, ''))
  if (taken.some((p) => p === path || p.startsWith(`${path}/`))) return { error: `“${path}” already exists.` }
  // Can't nest under something that is a file, e.g. "main.tex/x".
  const blocker = taken.find((p) => path.startsWith(`${p}/`) && !existingPaths.includes(`${p}/`) && !taken.some((q) => q.startsWith(`${p}/`)))
  if (blocker) return { error: `“${blocker}” is a file, not a folder.` }
  return { path }
}
