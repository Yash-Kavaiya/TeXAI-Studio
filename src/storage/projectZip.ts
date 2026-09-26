import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import type { ProjectTemplateInput } from './projectFactory'

const TEXT_RE = /\.(tex|bib|sty|cls|bst|bbx|cbx|cfg|def|clo|txt|md)$/i
const BINARY_RE = /\.(png|jpe?g|pdf)$/i
// OS/archiver clutter that should never become project files.
const JUNK_RE = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i
const MAX_ZIP_BYTES = 50 * 1024 * 1024

/** Packs a project's files into a .zip (folder markers become directory entries). */
export function projectToZip(files: { path: string; content: string; data?: Uint8Array }[]): Uint8Array {
  const entries: Zippable = {}
  for (const file of files) {
    entries[file.path] = file.path.endsWith('/') ? new Uint8Array(0) : (file.data ?? strToU8(file.content))
  }
  return zipSync(entries, { level: 6 })
}

/** Unpacks a .zip into a new project's files. Throws with a user-facing message. */
export async function projectFromZip(zip: File): Promise<ProjectTemplateInput & { skipped: string[] }> {
  if (zip.size > MAX_ZIP_BYTES) throw new Error('That .zip is larger than 50 MB.')
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await zip.arrayBuffer()))
  } catch {
    throw new Error('That file isn’t a readable .zip archive.')
  }

  let paths = Object.keys(entries).filter((p) => !JUNK_RE.test(p))
  // Zips made by "compress folder" wrap everything in one top-level folder; drop it.
  const top = paths[0]?.split('/')[0]
  if (top && paths.every((p) => p.startsWith(`${top}/`))) {
    entries = Object.fromEntries(paths.map((p) => [p.slice(top.length + 1), entries[p]]))
    paths = Object.keys(entries).filter(Boolean)
  }

  const files: ProjectTemplateInput['files'] = []
  const skipped: string[] = []
  for (const path of paths) {
    if (path.endsWith('/')) files.push({ path, content: '' })
    else if (TEXT_RE.test(path)) files.push({ path, content: strFromU8(entries[path]) })
    else if (BINARY_RE.test(path)) files.push({ path, content: '', data: entries[path] })
    else skipped.push(path)
  }

  const texFiles = files.filter((f) => f.path.endsWith('.tex'))
  if (texFiles.length === 0) throw new Error('No .tex files found in that .zip.')
  const depth = (path: string) => path.split('/').length
  const rootFile =
    texFiles.find((f) => f.path === 'main.tex')?.path ??
    texFiles.filter((f) => /\\documentclass/.test(f.content)).sort((a, b) => depth(a.path) - depth(b.path))[0]?.path ??
    texFiles[0].path

  return { name: zip.name.replace(/\.zip$/i, '') || 'Imported Project', rootFile, files, skipped }
}
